'use strict';

const ExcelJS = require('exceljs');
const JSZip = require('jszip');
const { randomUUID } = require('node:crypto');
const A = require('./employeeHistoryAutomaticReconstructionApplyContract');
const C = require('./employeeHistoryAutomaticReconstructionContract');
const { coordinateEmployeeHistorySettlement } = require('./employeeHistorySettlementCoordinatorService');
const { buildUnifiedEmployeeHistorySettlementPreview } = require('./employeeHistorySettlementPreviewService');
const { inspectEmployeeHistorySave } = require('./employeeHistorySaveValidationService');
const labels = require('../../../public/js/ergazomenoi/genika/employeeHistoryFieldLabels');
const { formatValue } = require('./employeeHistoryReconstructionPreviewService');
const { CORRECTION_FIELD_REGISTRY } = require('./employeeHistoryCorrectionFieldRegistryService');
const { buildEmployeeHistoryProposalComparisons } = require('./employeeHistoryProposalComparisonService');
const { DATE_FIELDS } = require('./employeeHistoryReconstructionPreviewService');
const { selectEmployeeHistoryProposalCase, unavailableEmployeeHistoryProposalCase } = require('./employeeHistoryProposalCaseService');
const { PARENT_FIELDS, parentKeyForCatalog } = require('./employeeContractDescriptionService');
const { catalogFor, employmentOptions, storesCode, EMPLOYMENT_FIELDS } = require('./employeeHistoryProposalChoicesService');
const { employeeHistoryProposalFilename } = require('./employeeHistoryProposalFilenameService');
const VERSION = 'employee-history-proposal-xlsx:v2';
const LAYOUT_VERSION = 'business-comparison:v5';
const LEGACY_LAYOUT_VERSION = 'business-comparison:v4';
// Existing Payroll UI: .istoriko-card-header, .stage3-decision-before-after
// and .employee-history-correction-confirm in public/css/main.css.
const COLORS = { header: 'FF4F7358', secondary: 'FFD1E7DD', input: 'FFFFF3CD',
    locked: 'FFF8F9FA', text: 'FF212529', muted: 'FF495057', warning: 'FF664D03', white: 'FFFFFFFF' };
const id = row => String(row?._id || '');
const day = value => value == null ? '' : require('../../utils/ergazomenoi/employmentProfileContract')
    .calendarDate(value)?.toISOString().slice(0, 10) || '';
const value = input => input === undefined ? 'Δεν υπάρχει καταγεγραμμένη τιμή' : input === null ? 'Κενό' :
    input instanceof Date ? day(input) : input?._bsontype === 'ObjectId' ? String(input) :
        typeof input === 'boolean' ? input ? 'Ναι' : 'Όχι' : typeof input === 'object' ? JSON.stringify(input) : input;
const publicText = text => String(text ?? '').replace(/\b[a-f\d]{24,}\b/gi, 'μη διαθέσιμη περιγραφή')
    .replace(/\b[A-Za-z][A-Za-z\d]*_[A-Za-z\d_]+\b/g, 'μη διαθέσιμη περιγραφή');
const workbookCellText = cell => cell.value instanceof Date ? day(cell.value).split('-').reverse().join('/') :
    typeof cell.value === 'number' ? new Intl.NumberFormat('el-GR', { minimumFractionDigits: cell.numFmt?.includes('0.00') ? 2 : 0, maximumFractionDigits: 6 }).format(cell.value) : cell.text;
const greekDay = text => String(text || '').replace(/(\d{4})-(\d{2})-(\d{2})/g, '$3/$2/$1');

// ExcelJS has no AutoFit measurement. Estimate wrapped lines conservatively in
// column character units, including explicit line breaks and long single words.
function contentHeight(row) {
    let lines = 1;
    row.eachCell(cell => {
        if (cell.isMerged && cell.master.address !== cell.address) return;
        let availableWidth = row.worksheet.getColumn(cell.col).width || 28;
        for (let column = cell.col + 1; cell.isMerged && column <= row.worksheet.columnCount; column++) {
            const next = row.getCell(column);
            if (!next.isMerged || next.master.address !== cell.address) break;
            availableWidth += row.worksheet.getColumn(column).width || 28;
        }
        const width = Math.max(1, availableWidth - 3);
        const wrapped = workbookCellText(cell).split(/\r?\n/).reduce((sum, paragraph) => {
            let count = 1, used = 0;
            for (const word of paragraph.split(/\s+/)) {
                const size = [...word].reduce((n, char) => n + (/[MWΜΩ]/.test(char) ? 1.4 : 1), 0);
                if (used && used + size + 1 > width) { count++; used = 0; }
                count += Math.max(0, Math.ceil(size / width) - 1);
                used = size > width ? size % width : used + size + (used ? 1 : 0);
            }
            return sum + count;
        }, 0);
        lines = Math.max(lines, wrapped);
    });
    return Math.max(22, lines * 16 + 8);
}

// Export is a read-only projection of the existing planner. Nothing in this
// module allocates physical identities, writes history or grants approval.
async function buildEmployeeHistoryProposalWorkbook(input, catalogs = {}, { selection = '', legacyLayout = false } = {}) {
    // Legacy generation is used only to verify an uploaded v4 workbook in full.
    const UNCERTAIN = legacyLayout ? 'Παραμένει αβέβαιο' : 'Όχι';
    const CONFIRMED = legacyLayout ? 'Δηλώνω τεκμηριωμένα στοιχεία' : 'Ναι';
    let plan, preview;
    try {
        plan = coordinateEmployeeHistorySettlement(input, { catalogs });
        preview = buildUnifiedEmployeeHistorySettlementPreview(input, catalogs);
    } catch (error) {
        if (error.code !== 'INVALID_EMPLOYMENT_PROFILE') throw error;
        return { workbook: null, caseSelection: unavailableEmployeeHistoryProposalCase(
            'τα καταγεγραμμένα χρονικά ή εργασιακά στοιχεία δεν έχουν έγκυρη μορφή'),
        snapshotFingerprint: null, proposalFingerprint: null, editableCells: [], filename: null };
    }
    const inspection = inspectEmployeeHistorySave({ scope: input.scope, currentEmployee: input.currentEmployee,
        historyRows: input.completeHistoryRows });
    const finalInspection = plan.status === 'CLEAN' ? inspectEmployeeHistorySave({ scope: input.scope,
        currentEmployee: { ...input.currentEmployee, ...plan.currentPatch }, historyRows: plan.proposedRows }) : null;
    const caseSelection = selectEmployeeHistoryProposalCase(input, plan, inspection, selection);
    const proposalStatus = caseSelection.historyStatus;
    const snapshot = A.hash({ version: VERSION, scope: input.scope, employee: input.currentEmployee,
        history: A.ordered(input.completeHistoryRows), references: input.protectedReferenceSummary,
        ...(input.approvedHistoryDecisions?.length ? { rowDecisions: input.approvedHistoryDecisions.map(audit => audit.diagnostics.rowApproval) } : {}),
        schedules: input.predeclaredScheduleRows || [], companyBusinessCode: input.companyBusinessCode || null, catalogs });
    const proposalHash = A.hash({ snapshot, plan, preview });
    if (!caseSelection.selectedCase) return { workbook: null, caseSelection, snapshotFingerprint: snapshot,
        proposalFingerprint: proposalHash, editableCells: [], filename: null };
    const selectedCase = caseSelection.selectedCase;
    const book = new ExcelJS.Workbook();
    book.creator = 'Payroll-NodeJs'; book.created = new Date();
    const editable = [];
    function sheet(name, headers, widths) {
        const ws = book.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }],
            pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
        ws.columns = headers.map((header, i) => ({ header, width: widths?.[i] || 28 }));
        return ws;
    }
    const summary = sheet('Σύνοψη', ['Στοιχείο', 'Αποτέλεσμα'], [38, 120]);
    const changes = sheet('Τεκμηριωμένες διορθώσεις', ['Είδος εγγραφής', 'Φυσικό ID', 'Λογικό ID πρότασης', 'Α/Α',
        'Περίοδος ΠΡΙΝ', 'Περίοδος ΜΕΤΑ', 'Πεδίο', 'ΠΡΙΝ', 'ΜΕΤΑ', 'Αιτιολογία', 'Προέλευση'],
    [24, 30, 30, 10, 28, 28, 36, 35, 35, 75, 70]);
    const ambiguous = sheet('Αμφίβολες περιπτώσεις', ['Ερώτηση', 'Περίπτωση', 'Φυσικά IDs πλαισίου', 'Περίοδος ΑΠΟ',
        'Περίοδος ΕΩΣ', 'Αναγνωριστικό πεδίου', 'Ζήτημα / ζητούμενο', 'Απάντηση χρήστη',
        'Τεκμήριο / αιτιολόγηση', 'Δήλωση'], [28, 26, 45, 18, 18, 28, 90, 55, 65, 38]);
    const history = sheet('Αρχικό Ιστορικό', ['Φυσικό ID', 'Α/Α', 'Πρόσληψη', 'Ισχύς ΑΠΟ', 'Ισχύς ΕΩΣ',
        'Αποχώρηση', 'Κατάσταση', 'Διατηρούμενο φυσικό ID', 'Αποτύπωμα αρχικής εγγραφής', 'Πλήθος αναφορών'],
    [30, 10, 18, 18, 18, 18, 30, 30, 55, 22]);
    const instructions = sheet('Οδηγίες', ['Βήμα', 'Οδηγία'], [12, 140]);
    const metadata = sheet('Ταυτοποίηση', ['Κλειδί', 'Τιμή'], [42, 140]);
    const lists = sheet('Επιλογές', ['Επιτρεπόμενες τιμές'], [100]); lists.state = 'veryHidden';
    // Keep every existing technical table, identifier and version intact. The
    // public sheets are projections; their cell mappings are recorded below.
    for (const ws of book.worksheets) ws.state = 'veryHidden';
    const visibleSheets = [];
    function businessSheet(name, headers, widths, instructionsText) {
        const ws = book.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 3 }],
            pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
        ws.columns = widths.map(width => ({ width }));
        ws.addRow([`Εργαζόμενος ${publicText(input.scope.kodikos)}`, ...instructionsText]);
        ws.addRow(['Δεν αποθηκεύτηκε αλλαγή.', legacyLayout ? 'Η εισαγωγή του αρχείου δεν υποστηρίζεται ακόμη.' : 'Η εισαγωγή φορτώνει μόνο τα ΜΕΤΑ για έλεγχο.']);
        ws.addRow(headers);
        ws.pageSetup.printTitlesRow = '1:3';
        visibleSheets.push(ws);
        return ws;
    }
    let publicChanges, publicAnswers;
    const getChanges = () => publicChanges ||= businessSheet('Προτεινόμενες διορθώσεις',
        ['Περίοδος / εγγραφή', 'Τι διορθώνεται', 'ΠΡΙΝ', 'ΜΕΤΑ', 'Αιτιολογία'], [26, 30, 24, 24, 44],
        ['1. Ελέγξτε την περίοδο.', '2. Συγκρίνετε ΠΡΙΝ και ΜΕΤΑ.', '3. Διαβάστε την αιτιολογία.']);
    const getAnswers = () => publicAnswers ||= businessSheet('Στοιχεία προς συμπλήρωση',
        ['Περίοδος', 'Στοιχείο προς διευκρίνιση', 'Υπάρχουσα τιμή', 'Απάντηση χρήστη', 'Τεκμηρίωση', 'Δήλωση για την περίοδο'],
        [23, 32, 23, 28, 32, 25], ['1. Συμπληρώστε μόνο τα κίτρινα κελιά.',
            '2. Χρησιμοποιήστε στοιχεία της περιόδου.', '3. Τεκμηρίωση: έγγραφο και ημερομηνία.',
            '4. Μην αντιγράφετε μεταγενέστερους όρους.',
            'Η δήλωση αφορά όλη την περίοδο. Χωρίς τεκμήριο: «Παραμένει αβέβαιο».']);
    const publicValue = (field, inputValue, row) => {
        if (['kathestos_apasxolhshs', 'typos_apasxolhshs'].includes(field)) {
            const type = require('../../utils/ergazomenoi/employmentTypeSemantics').normalizeEmploymentTypeValue(inputValue);
            if (type) return ['Πλήρης απασχόληση', 'Μερική απασχόληση', 'Εκ περιτροπής εργασία'][Number(type)];
            if (inputValue !== null && inputValue !== undefined && inputValue !== '')
                return `${publicText(inputValue)} — Μη έγκυρη τιμή· χρειάζεται έλεγχος`;
        }
        if (field === 'eidikh_kathgoria_ergazomenoy') {
            const item = (catalogs.SPECIAL_EMPLOYEE_CATEGORY || []).find(item => item.code === inputValue);
            if (item) return `${item.code} - ${publicText(item.label)}`;
        }
        if (field === 'typos_ebdomadas' && ['5HMERH', '6HMERH'].includes(inputValue))
            return inputValue === '5HMERH' ? 'Πενθήμερο' : 'Εξαήμερο';
        return publicText(formatValue(field, inputValue, catalogs, row));
    };
    const publicPeriod = row => greekDay(period(row));
    function visibleChange(technicalRow, field, original, proposed, reason) {
        if (C.FIELD_GROUPS.CANONICAL_METADATA.includes(field) && field !== 'employment_history_canonical_status') return;
        const canonical = field === 'employment_history_canonical_status';
        if (!canonical && !labels[field]) return;
        const ws = getChanges();
        const before = canonical ? 'Ανεξάρτητη καταχώριση' : publicValue(field, original?.[field], original);
        const after = canonical ? 'Συνδυασμός με συμβατή εγγραφή. Διατηρούνται τα αρχικά στοιχεία και οι συνδέσεις.' :
            publicValue(field, proposed[field], proposed);
        const row = ws.addRow([`${original ? `Εγγραφή ${original.aa_eggrafhs || 'χωρίς αρίθμηση'}` : 'Νέα περίοδος'}\n${publicPeriod(proposed)}`,
            canonical ? 'Συνδυασμός πλεονάζουσας εγγραφής' : labels[field], before, after,
            publicText(reason)]);
        metadata.addRow(['presentationRow', JSON.stringify({ sheet: ws.name, row: row.number,
            sourceSheet: changes.name, sourceRow: technicalRow.number, field })]);
    }
    let listNumber = 0;
    function listValidation(options) {
        const first = lists.rowCount + 1;
        for (const option of options) lists.addRow([String(option)]);
        const name = `HISTORY_OPTIONS_${++listNumber}`;
        book.definedNames.add(`'Επιλογές'!$A$${first}:$A$${lists.rowCount}`, name);
        return { type: 'list', formulae: [name] };
    }
    // Column F uses fixed guidance; answer cells get one concise input message.
    const validationMessages = { allowBlank: true, showInputMessage: false, showErrorMessage: true, errorStyle: 'stop',
        errorTitle: 'Μη επιτρεπόμενη τιμή', error: legacyLayout ? '1. Διάλεξε επιτρεπόμενη τιμή ή άφησε το πεδίο κενό. 2. Αν δεν γνωρίζεις, κράτησε «Παραμένει αβέβαιο». Δεν αποθηκεύεται αλλαγή στην εφαρμογή.' : 'Η τιμή δεν επιτρέπεται και η συμπλήρωση σταμάτησε. Δεν αποθηκεύτηκε αλλαγή στην εφαρμογή. 1. Ελέγξτε τις επιτρεπόμενες τιμές. 2. Διορθώστε το πεδίο και επαναλάβετε τον έλεγχο.' };
    const period = row => row ? `${day(row[C.START]) || 'Χωρίς έναρξη'} — ${day(row[C.END]) || 'Χωρίς λήξη'}` : 'Δεν υπάρχει εγγραφή';
    summary.addRows([
        ['Κατάσταση αποθηκευμένου Ιστορικού', inspection.status], ['Κατάσταση πρότασης', proposalStatus],
        ['Ερμηνεία', proposalStatus === 'CLEAN' ? 'Η πρόταση επαληθεύτηκε. Το αποθηκευμένο Ιστορικό δεν μεταβλήθηκε.' :
            'Υπάρχουν εκκρεμότητες. Το αρχείο δεν αποτελεί καθαρό Ιστορικό ή έγκριση οριστικοποίησης.'],
        ['Βάση εξαγωγής', 'Τρέχον αποθηκευμένο στιγμιότυπο — χωρίς μη αποθηκευμένες επιλογές της οθόνης.'],
        ['Κωδικός εργαζομένου', input.scope.kodikos], ['Φυσικό ID εργαζομένου', id(input.currentEmployee)],
        ['Αποτύπωμα στιγμιοτύπου', snapshot], ['Αποτύπωμα πρότασης', proposalHash],
        ['Διατήρηση', 'Δεν γίνεται φυσική διαγραφή, απόσυρση, μεταβολή όρων, αναφορών ή ελέγχων από την εξαγωγή.']
    ]);
    for (const text of [preview.message, ...(preview.actions || []), ...(preview.assumptions || []), ...(preview.choices || [])].filter(Boolean))
        summary.addRow(['Εύρημα / πρόταση του υπάρχοντος ελέγχου', String(text)]);
    const originals = new Map(input.completeHistoryRows.map(row => [id(row), row]));
    const businessFields = [...new Set([...C.PROFILE_FIELDS, ...C.FIELD_GROUPS.TEMPORAL_SEMANTIC,
        ...C.FIELD_GROUPS.CANONICAL_METADATA])];
    if (plan.status === 'CLEAN' && finalInspection?.status === 'CLEAN' && plan.verification?.status === 'CLEAN') {
        for (const row of plan.proposedRows) {
            const original = originals.get(id(row));
            for (const field of businessFields) {
                if (A.equal(original?.[field], row[field])) continue;
                const assumptions = (plan.assumptions || []).filter(item => !item.field || item.field === field);
                const reason = assumptions.map(item => item.businessRationale || item.code).filter(Boolean).join('\n') ||
                    (field.startsWith('employment_history_canonical_') ? 'Διατήρηση αρχικής φυσικής εγγραφής εκτός ενεργού Ιστορικού, σύμφωνα με την επαληθευμένη πρόταση.' :
                        'Τιμή της πλήρους τελικής πρότασης του υπάρχοντος μηχανισμού προεπισκόπησης.');
                const sources = [...(plan.sources || []), ...assumptions.map(item => item.sourceHistoryId).filter(Boolean)];
                const technicalRow = changes.addRow([original ? 'Υπάρχουσα ιστορική εγγραφή' : 'Νέα λογική περίοδος — χωρίς φυσικό ID',
                    original ? id(original) : '', original ? '' : id(row), original?.aa_eggrafhs || '',
                    period(original), period(row), labels[field] || field, value(original?.[field]), value(row[field]),
                    reason, sources.join('\n') || `Υπάρχουσα προεπισκόπηση ${plan.version}`]);
                visibleChange(technicalRow, field, original, row,
                    assumptions.map(item => item.businessRationale).filter(Boolean).join('\n') ||
                    (original ? 'Η διόρθωση προκύπτει από τη συνολική επαληθευμένη πρόταση των καταγεγραμμένων στοιχείων.' :
                        'Συμπλήρωση περιόδου από τεκμηριωμένους ιστορικούς όρους.'));
            }
        }
        for (const [field, after] of Object.entries(plan.currentPatch || {})) {
            const technicalRow = changes.addRow([
            'Τρέχοντα στοιχεία εργαζομένου', id(input.currentEmployee), '', '', period(input.currentEmployee),
            period({ ...input.currentEmployee, ...plan.currentPatch }), labels[field] || field,
            value(input.currentEmployee[field]), value(after), 'Ρητή διαφορά της ενιαίας τελικής πρότασης.', plan.version]);
            visibleChange(technicalRow, field, input.currentEmployee, { ...input.currentEmployee, ...plan.currentPatch },
                'Τα τρέχοντα στοιχεία συμφωνούν με την τεκμηριωμένη τελική περίοδο.');
        }
    }
    if (changes.rowCount === 1) changes.addRow(['Δεν υπάρχει πλήρως επαληθευμένη αλλαγή προς εφαρμογή.']);
    for (const row of input.completeHistoryRows) history.addRow([id(row), row.aa_eggrafhs || '', day(row[C.HIRE]),
        day(row[C.START]), day(row[C.END]), day(row[C.DEPARTURE]), row.employment_history_canonical_status || 'ACTIVE',
        String(row.employment_history_canonical_survivor_id || ''), A.hash(row), input.protectedReferenceSummary?.[id(row)]?.length ?? 'Άγνωστο']);
    function currentValue(field, conflict) {
        const canonicalField = CORRECTION_FIELD_REGISTRY.find(entry => entry.id === field.id)?.fields[0] ||
            ({ VALID_FROM: C.START, VALID_UNTIL: C.END })[field.id] || field.id;
        const applicable = input.completeHistoryRows.filter(row => {
            const from = day(row[C.START]), to = day(row[C.END]);
            return !conflict?.period || from && from <= (conflict.period.to || '9999-12-31') &&
                (!to || to >= conflict.period.from);
        }).filter(row => row[canonicalField] !== undefined && row[canonicalField] !== null && row[canonicalField] !== '');
        return applicable.length ? applicable.map(row => `Εγγραφή ${row.aa_eggrafhs || 'χωρίς αρίθμηση'}: ${publicValue(canonicalField, row[canonicalField], row)}`).join('\n') :
            'Δεν έχει καταχωριστεί.';
    }
    function answer(question, conflict, field, options = [], group = {}) {
        // IDs and periods are immutable context. No physical withdrawal command
        // is ever offered as a spreadsheet answer.
        options = options.filter(option => !/REMOVE|DELETE|WITHDRAW|RETIRE/.test(String(option.id || option.value || '')));
        if (!options.length && ['kathestos_apasxolhshs', 'typos_apasxolhshs'].includes(field.id))
            options = ['Πλήρης απασχόληση', 'Μερική απασχόληση', 'Εκ περιτροπής εργασία'].map((label, index) => ({ id: String(index), label }));
        if (!options.length && field.id === 'typos_ebdomadas') options = [
            { id: '5HMERH', label: 'Πενθήμερο' }, { id: '6HMERH', label: 'Εξαήμερο' }];
        if (!options.length && field.id === 'typos_orarioy') options = [
            { id: false, label: 'Σταθερό' }, { id: true, label: 'Μεταβαλλόμενο' }];
        const technicalRow = ambiguous.addRow([question.id, conflict?.conflictId || question.id,
            input.completeHistoryRows.map(id).join('\n'), conflict?.period?.from || '', conflict?.period?.to || '',
            field.id, [conflict?.issue, field.label].filter(Boolean).join('\n'), null, null, UNCERTAIN]);
        const schema = { questionId: question.id, conflictId: conflict?.conflictId || null,
            fieldId: field.id, type: field.inputType || question.type, min: field.min ?? null, max: field.max ?? null,
            options: options.map(option => ({ id: option.id ?? option.value, label: option.label ?? String(option.value) })) };
        const ws = getAnswers(), isEvidence = /EVIDENCE$/.test(field.id);
        const from = conflict?.period?.from || input.completeHistoryRows.map(row => day(row[C.START]) || day(row[C.HIRE])).filter(Boolean).sort()[0];
        const to = conflict?.period?.to || input.completeHistoryRows.map(row => day(row[C.END]) || day(row[C.DEPARTURE]) || day(row[C.CONTRACT_END])).filter(Boolean).sort().at(-1);
        const first = !group.firstRow;
        const row = isEvidence && group.firstRow && !group.evidenceUsed ? group.firstRow : ws.addRow([
            `${greekDay(from) || 'Χωρίς έναρξη'} — ${greekDay(to) || 'Χωρίς λήξη'}`,
            publicText([field.label, first ? conflict?.issue : null].filter(Boolean).join('\n')),
            isEvidence ? 'Αναφέρετε το σχετικό έγγραφο.' : currentValue(field, conflict)]);
        group.firstRow ||= row;
        if (isEvidence) group.evidenceUsed = true;
        const validation = options.length ? listValidation(schema.options.map(option => option.label)) :
            field.inputType === 'BOOLEAN' ? listValidation(['Ναι', 'Όχι']) :
                field.inputType === 'DECIMAL' ? { type: 'decimal', operator: 'between', formulae: [field.min ?? 0, field.max ?? 1000000000] } :
                    field.inputType === 'DATE' ? { type: 'date', operator: 'between',
                        formulae: [new Date(field.min || '1900-01-01'), new Date(field.max || '9999-12-31')] } :
                        { type: 'textLength', operator: 'lessThanOrEqual', formulae: [4000] };
        const columns = [isEvidence ? 'E' : 'D', ...(first ? ['F'] : [])];
        // One shared evidence/declaration per group replaces repetitive empty
        // cells. Explicit evidence fields retain their original field identity.
        if (first && !group.hasEvidence) columns.push('E');
        for (const column of columns) {
            const cell = row.getCell(column);
            cell.protection = { locked: false };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.input } };
            const help = column === 'D' ? field.inputType === 'DATE' ?
                'Συμπληρώστε την πραγματική ημερομηνία (ηη/μμ/εεεε), εφόσον τεκμηριώνεται. Διαφορετικά αφήστε το πεδίο κενό.' :
                options.length || field.inputType === 'BOOLEAN' ?
                    'Επιλέξτε την τιμή που τεκμηριώνεται για την περίοδο. Χωρίς τεκμήριο αφήστε το πεδίο κενό.' :
                    'Συμπληρώστε την πραγματική τιμή που τεκμηριώνεται για την περίοδο. Χωρίς τεκμήριο αφήστε το πεδίο κενό.' :
                'Αναφέρετε το έγγραφο και την ημερομηνία του που στηρίζουν τις απαντήσεις της περιόδου. Μην καταχωρίζετε κωδικούς πρόσβασης.';
            // Comments grow with their row anchors in Calc. Use just an input
            // message for answers, and fixed header guidance for declarations.
            cell.dataValidation = { ...validationMessages,
                ...(column !== 'F' ? { showInputMessage: true, promptTitle: 'Συμπλήρωση', prompt: help } : {}),
                ...(column === 'D' || isEvidence && column === 'E' ? validation : column === 'F' ?
                listValidation([UNCERTAIN, CONFIRMED]) : { type: 'textLength', operator: 'lessThanOrEqual', formulae: [4000] }) };
            if (column === 'F') cell.value = UNCERTAIN;
            if (column === 'D' && field.inputType === 'DATE') cell.numFmt = 'dd/mm/yyyy';
            editable.push({ sheet: ws.name, cell: cell.address, ...schema,
                sourceSheet: ambiguous.name, sourceRow: technicalRow.number,
                ...(column === 'F' || column === 'E' && !isEvidence ? { appliesTo: group.fields || [field.id] } : {}),
                role: column === 'D' || isEvidence && column === 'E' ? 'ANSWER' : column === 'E' ? 'EVIDENCE' : 'DECLARATION' });
        }
    }
    for (const question of preview.questions || []) {
        if (question.type === 'HISTORY_FACTS') {
            for (const conflict of question.resolution?.conflicts || []) for (const intent of conflict.intents || []) {
                if (/REMOVE|DELETE|WITHDRAW|RETIRE/.test(intent.id)) continue;
                const fields = intent.valueControl?.fields || [];
                const group = { fields: fields.map(field => field.id), hasEvidence: fields.some(field => /EVIDENCE$/.test(field.id)) };
                for (const field of [...fields.filter(field => !/EVIDENCE$/.test(field.id)), ...fields.filter(field => /EVIDENCE$/.test(field.id))])
                    answer(question, conflict, field, field.catalogValues || [], group);
            }
        } else answer(question, null, { id: question.id, label: question.label,
            inputType: question.type === 'DECIMAL' ? 'DECIMAL' : question.type === 'DATE' ? 'DATE' : 'TEXT',
            min: question.min, max: question.max }, question.options || []);
    }
    if (ambiguous.rowCount === 1) ambiguous.addRow([proposalStatus === 'CLEAN' ? 'Δεν υπάρχουν αμφίβολες ερωτήσεις στην επαληθευμένη πρόταση.' :
        'Η προεπισκόπηση δεν παρέχει δομημένες ασφαλείς απαντήσεις. Απαιτείται έλεγχος διαχειριστή. Δεν επιτρέπεται οριστικοποίηση.']);
    // Preserve the existing technical tables and source mappings. Retire only
    // their old difference/question-only presentation; hidden cells stay locked.
    const previousAnswerMappings = editable.splice(0);
    for (const entry of previousAnswerMappings) metadata.addRow(['sourceAnswer', JSON.stringify(entry)]);
    for (const ws of book.worksheets) {
        ws.state = 'veryHidden';
        ws.eachRow(row => row.eachCell({ includeEmpty: true }, cell => { cell.protection = { locked: true }; }));
    }
    visibleSheets.length = 0;
    const comparison = buildEmployeeHistoryProposalComparisons(input, plan, caseSelection, catalogs);
    const business = book.addWorksheet('ΠΡΙΝ - ΜΕΤΑ', {
        views: [{ state: 'frozen', ySplit: 5 }],
        pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0,
            paperSize: 9, printTitlesRow: '1:5',
            margins: { left: 0.25, right: 0.25, top: 0.35, bottom: 0.35, header: 0.15, footer: 0.15 } }
    });
    business.columns = [36, 32, 36, 38].map(width => ({ width }));
    business.addRow(['ΠΡΙΝ — ΑΠΟΘΗΚΕΥΜΕΝΑ ΣΤΟΙΧΕΙΑ', '', 'ΜΕΤΑ — ΥΠΟΨΗΦΙΑ ΣΤΟΙΧΕΙΑ', '']);
    business.mergeCells('A1:B1'); business.mergeCells('C1:D1');
    const initial = comparison.comparisons[0];
    const pendingIndex = caseSelection.cases.indexOf(selectedCase);
    business.addRow([`${pendingIndex >= 0 ? `Περίπτωση ${pendingIndex + 1} από ${caseSelection.total}` : 'Επιλεγμένη εγγραφή'} · ${selectedCase.label} · Εργαζόμενος ${publicText(input.scope.kodikos)} · Εξεταζόμενη περίοδος ${greekDay(initial?.period.from) || 'χωρίς καταγεγραμμένη έναρξη'}–${greekDay(initial?.period.to) || 'χωρίς καταγεγραμμένη λήξη'} · Πηγές: ${initial?.original?.aa_eggrafhs || 'χωρίς προηγούμενη εγγραφή'} / ${initial?.next?.aa_eggrafhs || 'χωρίς επόμενη εγγραφή'}`]);
    business.mergeCells('A2:D2');
    business.addRow(['Πρόταση προς έλεγχο — δεν αποθηκεύτηκε καμία αλλαγή. Η συμπλήρωση αφορά μόνο τοπικό αρχείο. Δεν υποστηρίζεται εισαγωγή XLSX στην εφαρμογή.']);
    business.mergeCells('A3:D3');
    business.addRow(['ΠΡΙΝ: Περιγραφή πεδίου', 'ΠΡΙΝ: Αποθηκευμένη τιμή',
        'ΜΕΤΑ: Περιγραφή πεδίου', 'ΜΕΤΑ: Προτεινόμενη / συμπληρώσιμη τιμή']);
    business.addRow(['Πράσινο: χρονικά συμβατή καταγεγραμμένη τιμή. Κίτρινο: επιβεβαίωση ή συμπλήρωση. Γκρι: αρχικό συμβάν που δεν μεταφέρεται. Τα ΠΡΙΝ παραμένουν κλειδωμένα. Στο INSERT τα αρχικά συμβάντα δεν μεταφέρονται. Στο UPDATE διορθώνεται μόνο η επιλεγμένη εγγραφή, χωρίς νέο συμβάν. Οι αλλαγές ιστορικών ορίων απαιτούν νέο έλεγχο κάλυψης και νέες προτάσεις INSERT.']);
    business.mergeCells('A5:D5');
    visibleSheets.push(business);
    const sourceLabel = row => row ? `Εγγραφή ${row.aa_eggrafhs || 'χωρίς αρίθμηση'}` : 'Δεν υπάρχει προηγούμενη εγγραφή';
    const periodLabel = period => `${greekDay(period.from) || 'χωρίς έναρξη'}–${greekDay(period.to) || 'χωρίς λήξη'}`;
    const putBusinessValue = (cell, field, raw, context, blank = false) => {
        if (DATE_FIELDS.has(field)) cell.numFmt = 'dd/mm/yyyy';
        else if (C.PROFILE_FIELD_TYPES[field] === 'Number') cell.numFmt = /Misthos|Hmeromisthio|Oromisthio|poso_|synolo_symbashs/.test(field)
            ? '[$-408]#,##0.00####' : '[$-408]0.####';
        if (raw === null || raw === undefined || raw === '') { cell.value = blank ? null : 'Δεν έχει καταχωριστεί'; return; }
        if (DATE_FIELDS.has(field)) {
            try { cell.value = require('../../utils/ergazomenoi/employmentProfileContract').calendarDate(raw); }
            catch { cell.value = 'Μη έγκυρη καταγεγραμμένη ημερομηνία'; }
            cell.numFmt = 'dd/mm/yyyy';
        } else if (typeof raw === 'number' && Number.isFinite(raw)) {
            cell.value = raw;
            cell.numFmt = /Misthos|Hmeromisthio|Oromisthio|poso_|synolo_symbashs/.test(field)
                ? '[$-408]#,##0.00####' : '[$-408]0.####';
        } else cell.value = publicValue(field, raw, context);
    };
    const enumOptions = field => {
        if (EMPLOYMENT_FIELDS.includes(field)) return employmentOptions();
        if (field === 'typos_ebdomadas') return ['5HMERH', '6HMERH'].map(value => ({ id: value, label: publicValue(field, value) }));
        if (C.PROFILE_FIELD_TYPES[field] === 'Boolean') return [false, true].map(value => ({ id: value, label: publicValue(field, value) }));
        return [];
    };
    const registryFor = field => CORRECTION_FIELD_REGISTRY.find(entry => entry.fields.includes(field));
    function optionsFor(field, candidate) {
        const catalog = catalogFor(field);
        if (!catalog) return enumOptions(field);
        const parentField = PARENT_FIELDS[catalog], parent = parentKeyForCatalog(catalog, candidate);
        return (catalogs[catalog] || []).filter(item => !parentField || String(item[parentField] || '') === parent)
            .map(item => ({ id: item.code, label: publicValue(field, item.code, candidate) }));
    }
    const provenance = businessSheet('Προέλευση και εκκρεμότητες',
        ['Περίοδος', 'Πεδίο', 'Προέλευση', 'Λόγος αβεβαιότητας', 'Απαιτούμενη επιβεβαίωση'],
        [26, 38, 46, 65, 48], [legacyLayout ? 'Μόνο στοιχεία που χρειάζονται τεκμηρίωση για την περίοδο.' : 'Μόνο στοιχεία που χρειάζονται έλεγχο για την περίοδο.']);
    function unlock(cell, mapping, validation) {
        cell.protection = { locked: false };
        cell.dataValidation = { ...validationMessages, ...validation, showInputMessage: false };
        editable.push({ ...mapping, sheet: business.name, cell: cell.address });
    }
    for (const item of comparison.comparisons) {
        const title = business.addRow([`${item.period.missing ? 'Ελλείπουσα περίοδος' : 'Καταγεγραμμένη περίοδος'} ${periodLabel(item.period)} · ΠΡΙΝ: ${sourceLabel(item.original)} · επόμενη πηγή: ${sourceLabel(item.next)}`]);
        business.mergeCells(`A${title.number}:D${title.number}`);
        title.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.secondary } };
        let group;
        for (const field of item.values) {
            if (group !== field.group) {
                group = field.group;
                const header = business.addRow([group, '', group, '']);
                header.eachCell({ includeEmpty: true }, cell => {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.secondary } };
                    cell.font = { bold: true };
                });
            }
            const row = business.addRow([field.label, null, field.label, null]);
            putBusinessValue(row.getCell('B'), field.field, field.before, item.original);
            const cell = row.getCell('D');
            putBusinessValue(cell, field.field, field.displayAfter, field.displayOnly ? item.original : item.candidate, true);
            if (storesCode(field.field) && !field.displayOnly) {
                cell.value = field.after ?? null; cell.numFmt = '@';
            }
            if (field.field === 'eidikh_kathgoria_ergazomenoy') cell.numFmt = '@';
            const informational = field.displayOnly;
            const confirmed = informational || ['CONTINUING', 'RECORDED', 'GAP_BOUNDARY'].includes(field.state);
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: informational ? COLORS.locked : confirmed ? COLORS.secondary : COLORS.input } };
            const missing = field.coverage.uncovered.map(periodLabel).join(', ');
            const fieldSource = input.completeHistoryRows.find(row => id(row) === field.sourceHistoryId);
            const laterSource = input.completeHistoryRows.find(row => id(row) === field.laterHistoryId);
            const recorded = value => value !== undefined && value !== null && value !== '' && (!Array.isArray(value) || value.length > 0);
            const needsAttention = !confirmed && (recorded(field.before) || recorded(field.after) ||
                C.COMPATIBILITY_FIELDS.includes(field.field) || C.CRITICAL_NUMBERS.includes(field.field));
            const confirmation = field.state === 'SUGGESTED_LATER' ? 'Προγενέστερη ισχύς της μεταγενέστερης τιμής' :
                !recorded(field.before) ? legacyLayout ? 'Τιμή και τεκμήριο' : 'Τιμή της εξεταζόμενης περιόδου' : field.coverage.covered ? 'Τιμή που ίσχυε στην περίοδο' :
                    legacyLayout ? 'Τεκμήριο συνέχισης της προηγούμενης τιμής' : 'Επιβεβαίωση συνέχισης της προηγούμενης τιμής';
            if (needsAttention) provenance.addRow([periodLabel(item.period), field.label,
                publicText(`${sourceLabel(fieldSource)}${field.coverage.from ? ` · ισχύς ${periodLabel(field.coverage)}` : ''}${laterSource && laterSource !== fieldSource ? ` · μεταγενέστερη πηγή: ${sourceLabel(laterSource)}` : ''}`),
                publicText([field.reason, field.nextValue !== undefined && field.nextValue !== null ? `Μεταγενέστερη τιμή: ${publicValue(field.field, field.nextValue, laterSource)}.` : '', missing ? `Ακάλυπτο διάστημα: ${missing}.` : ''].filter(Boolean).join('\n')),
                confirmation]);
            const oldMapping = previousAnswerMappings.find(entry => {
                if (entry.role !== 'ANSWER' || ![field.field, registryFor(field.field)?.id].includes(entry.fieldId)) return false;
                const technical = ambiguous.getRow(entry.sourceRow);
                return (!technical.getCell(4).value || technical.getCell(4).value === item.period.from) &&
                    (!technical.getCell(5).value || technical.getCell(5).value === item.period.to);
            });
            const mapping = { caseId: item.caseId, operation: item.operation, targetHistoryId: item.targetHistoryId,
                candidatePeriodId: item.candidatePeriodId, comparisonId: item.id, fieldId: oldMapping?.fieldId || field.field,
                canonicalField: field.field, sourceHistoryId: field.sourceHistoryId,
                previousHistoryId: field.previousHistoryId, nextHistoryId: field.nextHistoryId,
                period: item.period, state: field.state, confirmationRequired: !confirmed,
                coverage: field.coverage, ...((oldMapping?.sourceRow) ? {
                    questionId: oldMapping.questionId, sourceSheet: oldMapping.sourceSheet, sourceRow: oldMapping.sourceRow } : {}),
                rawBefore: field.before ?? null, rawProposed: field.after ?? null,
                rawDisplay: field.displayAfter ?? null, displayOnly: field.displayOnly,
                selectionRequired: field.selectionRequired, storeCode: storesCode(field.field),
                choiceDiagnostic: field.selectionRequired ? field.reason : '' };
            metadata.addRow(['comparisonField', JSON.stringify({ ...mapping, sheet: business.name, row: row.number,
                cell: cell.address, editable: field.editable })]);
            if (field.editable) {
                const options = optionsFor(field.field, item.candidate);
                const type = C.PROFILE_FIELD_TYPES[field.field];
                const validation = options.length || catalogFor(field.field) ?
                    { ...listValidation(options.length ? options.map(option => storesCode(field.field) ? option.id : option.label) : ['']),
                        allowBlank: true } :
                    DATE_FIELDS.has(field.field) ? { type: 'date', operator: 'between', formulae: [new Date('1900-01-01'), new Date('9999-12-31')] } :
                        type === 'Number' ? { type: registryFor(field.field)?.dataType === 'INTEGER' ? 'whole' : 'decimal',
                            operator: 'between', formulae: [registryFor(field.field)?.min ?? 0, registryFor(field.field)?.max ?? 1000000000] } :
                            { type: 'textLength', operator: 'lessThanOrEqual', formulae: [4000] };
                unlock(cell, { ...mapping, options, catalog: catalogFor(field.field),
                    role: 'ANSWER', type: type || 'Date' }, validation);
            }
        }
        const evidence = business.addRow(['', '', legacyLayout ? 'Τεκμήριο για την εξεταζόμενη περίοδο' : 'Αιτιολογία μεταβολών (προαιρετική)', null]);
        const declaration = business.addRow(['', '', legacyLayout ? 'Επιβεβαίωση προτεινόμενων στοιχείων' : 'Έγκριση μεταβολών', UNCERTAIN]);
        for (const [row, role] of [[evidence, 'EVIDENCE'], [declaration, 'DECLARATION']]) {
            const cell = row.getCell('D');
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.input } };
            unlock(cell, { caseId: item.caseId, operation: item.operation, targetHistoryId: item.targetHistoryId,
                candidatePeriodId: item.candidatePeriodId, comparisonId: item.id, period: item.period, fieldId: role,
                role, options: role === 'DECLARATION' ? [UNCERTAIN, CONFIRMED].map(label => ({ id: label, label })) : [],
                appliesTo: item.values.filter(field => field.editable).map(field => field.field) },
            role === 'DECLARATION' ? { ...listValidation([UNCERTAIN, CONFIRMED]), allowBlank: legacyLayout,
                ...(!legacyLayout ? { error: 'Η έγκριση δέχεται μόνο Ναι ή Όχι. Δεν αποθηκεύτηκε αλλαγή στην εφαρμογή. 1. Επιλέξτε Ναι ή Όχι. 2. Επαναλάβετε τον έλεγχο.' } : {}) } : { type: 'textLength', operator: 'lessThanOrEqual', formulae: [4000] });
        }
    }
    // Questions without a unique binding to this case stay in the hidden source
    // sheets. They must never become answers for another historical case.
    if (provenance.rowCount === 3) provenance.addRow(['Δεν υπάρχουν στοιχεία που απαιτούν πρόσθετη επιβεβαίωση.']);
    for (const option of employmentOptions()) provenance.addRow(['Κατάλογος επιλογών', 'Τύπος / καθεστώς απασχόλησης',
        option.label, '', 'Στο ΜΕΤΑ αποθηκεύεται ο κωδικός 0, 1 ή 2. Δεν αφορά πενθήμερη ή εξαήμερη εβδομάδα.']);
    for (const option of catalogs.SPECIAL_EMPLOYEE_CATEGORY || []) provenance.addRow(['Κατάλογος επιλογών', labels.eidikh_kathgoria_ergazomenoy,
        publicText(`${option.code} - ${option.label}`), '', 'Η επιλογή δείχνει κωδικό και περιγραφή. Ο αντίστοιχος κωδικός διατηρείται ως κείμενο στις προστατευμένες αντιστοιχίσεις, με όλα τα αρχικά μηδενικά.']);
    metadata.addRow(['selectedCase', JSON.stringify({ ...selectedCase, snapshotFingerprint: snapshot,
        sourceFingerprint: caseSelection.sourceFingerprint, caseCount: caseSelection.total, approval: false })]);
    metadata.addRow(['pendingCases', JSON.stringify(caseSelection.cases)]);
    metadata.addRow(['coverageGaps', JSON.stringify(comparison.gaps)]);
    instructions.addRows([
        [1, 'Διαβάστε τη σύγκριση ΠΡΙΝ - ΜΕΤΑ. Η κατάσταση της πρότασης δεν αλλάζει το αποθηκευμένο Ιστορικό.'],
        [2, 'Οι στήλες Α και Β διατηρούν την προηγούμενη εγγραφή. Στη στήλη Δ εμφανίζονται όλα τα υποψήφια στοιχεία της πραγματικής ελλείπουσας περιόδου.'],
        [3, 'Επεξεργαστείτε μόνο τα ξεκλείδωτα κελιά της στήλης Δ. Τα σχόλια περιγράφουν την προέλευση και τη χρονική κάλυψη κάθε πεδίου. Οι τεχνικές ταυτότητες παραμένουν κρυφές και κλειδωμένες.'],
        [4, 'Το κίτρινο απαιτεί ανθρώπινη επιβεβαίωση. Η πρόταση από επόμενη εγγραφή δεν αποδεικνύει προγενέστερη ισχύ. Χωρίς στοιχεία αφήστε το πεδίο κενό και διατηρήστε «Παραμένει αβέβαιο».'],
        [5, 'Η προστασία φύλλου αποτρέπει ακούσιες αλλαγές και δεν είναι μηχανισμός ασφάλειας. Η τροποποίηση IDs, περιόδων ή μεταδεδομένων δεν παρέχει κανένα δικαίωμα.'],
        [6, 'Η εισαγωγή XLSX δεν υποστηρίζεται στην παρούσα φάση. Το αρχείο δεν αποτελεί έγκριση ή εντολή αποθήκευσης. Δεν έγινε μεταβολή Ιστορικού.'],
        [7, 'Μελλοντική εισαγωγή απαιτεί νέο έλεγχο στον διακομιστή: δικαιώματα, έκδοση, IDs, επιτρεπόμενα κελιά, τεκμήρια, παλιά κατάσταση και πλήρη τελική επικύρωση πριν από χωριστή συναλλακτική έγκριση.']
    ]);
    if (!legacyLayout) {
        instructions.getCell('B5').value = 'Συμπληρώστε τις πραγματικές τιμές της περιόδου. Η αιτιολογία μεταβολών είναι προαιρετική και μπορεί να μείνει κενή ή να περιέχει παύλα ή ελεύθερο κείμενο.';
        instructions.getCell('B7').value = 'Η εισαγωγή XLSX φορτώνει τα ΜΕΤΑ για αναγνωστικό έλεγχο. Δεν αποθηκεύει αλλαγή στο Ιστορικό.';
        instructions.getCell('B8').value = 'Η εφαρμογή απαιτεί Έγκριση μεταβολών: Ναι, επιτυχή τελική προεπισκόπηση και ξεχωριστή επιβεβαίωση εφαρμογής. Με Όχι παραμένει διαθέσιμη η προεπισκόπηση.';
        business.getCell('A3').value = 'Πρόταση προς έλεγχο — δεν αποθηκεύτηκε καμία αλλαγή. Η εισαγωγή φορτώνει μόνο τα ΜΕΤΑ. Η πραγματική εφαρμογή απαιτεί χωριστή έγκριση και τελική προεπισκόπηση.';
    }
    metadata.addRows([['schemaVersion', VERSION], ['exportId', randomUUID()], ['plannerVersion', plan.version],
        ['scope', JSON.stringify(input.scope)], ['employeeId', id(input.currentEmployee)],
        ['snapshotFingerprint', snapshot], ['proposalFingerprint', proposalHash], ['plannerSnapshotFingerprint', plan.snapshotFingerprint || ''],
        ['exportBasis', 'CURRENT_PERSISTED_SNAPSHOT'], ['plannerStatus', plan.status], ['proposalStatus', proposalStatus],
        ['finalValidationIssues', JSON.stringify(finalInspection?.issues.map(item => ({ reason: item.reason, field: item.field })) || [])],
        ['importEnabled', 'false'], ['executionCapability', 'NONE'],
        ['coverageRecheckRequired', 'true'], ['previousInsertProposalsReusable', 'false']]);
    for (const entry of editable) metadata.addRow(['editableCell', JSON.stringify(entry)]);
    metadata.addRow(['layoutVersion', legacyLayout ? LEGACY_LAYOUT_VERSION : LAYOUT_VERSION]);
    metadata.addRow(['decisionContext', JSON.stringify(preview.decisionContext || null)]);
    book.views = [{ activeTab: book.worksheets.indexOf(visibleSheets[0]), firstSheet: book.worksheets.indexOf(visibleSheets[0]) }];
    for (const ws of book.worksheets) {
        ws.eachRow(row => {
            row.eachCell({ includeEmpty: true }, cell => {
                cell.font = { name: 'Calibri', size: 11, color: { argb: COLORS.text }, ...cell.font };
                cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
                if (ws === business && !cell.isMerged) {
                    cell.alignment.indent = 1;
                    cell.border = { bottom: { style: 'hair', color: { argb: 'FFDEE2E6' } },
                        right: { style: cell.col === 2 ? 'medium' : 'thin', color: { argb: cell.col === 2 ? COLORS.header : 'FFDEE2E6' } } };
                }
                if (cell.protection?.locked !== false) cell.protection = { locked: true };
                if (row.number === (ws === business ? 4 : ws.state === 'visible' ? 3 : 1)) {
                    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: COLORS.white } };
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.header } };
                } else if (ws.state === 'visible') {
                    if (cell.protection.locked !== false && !cell.fill?.fgColor) cell.fill = { type: 'pattern', pattern: 'solid',
                        fgColor: { argb: row.number === 1 ? COLORS.secondary : COLORS.locked } };
                    if (row.number === 1) cell.font.bold = true;
                    if (row.number === 2) cell.font.color = { argb: COLORS.muted };
                    if (cell.value === UNCERTAIN || ws === publicAnswers && row.number === 1 && cell.col === 6)
                        cell.font.color = { argb: COLORS.warning };
                }
            });
            if (ws.state === 'visible') row.height = contentHeight(row);
        });
        // Active protection, deliberately not an authentication mechanism.
        await ws.protect(undefined, { selectLockedCells: true, selectUnlockedCells: true,
            formatRows: true,
            insertRows: false, deleteRows: false, insertColumns: false, deleteColumns: false });
    }
    uniformBusinessRowHeights(book);
    return { workbook: book, caseSelection, snapshotFingerprint: snapshot, proposalFingerprint: proposalHash, editableCells: editable,
        filename: employeeHistoryProposalFilename(input, selectedCase) };
}

function businessFieldRows(workbook) {
    const numbers = new Set();
    workbook.getWorksheet('Ταυτοποίηση').eachRow(row => {
        if (!['comparisonField', 'editableCell'].includes(row.getCell(1).value)) return;
        const mapping = JSON.parse(row.getCell(2).value);
        if (mapping.sheet === 'ΠΡΙΝ - ΜΕΤΑ') numbers.add(mapping.row || workbook.getWorksheet(mapping.sheet).getCell(mapping.cell).row);
    });
    return numbers;
}
function uniformBusinessRowHeights(workbook) {
    const sheet = workbook.getWorksheet('ΠΡΙΝ - ΜΕΤΑ'), rows = businessFieldRows(workbook);
    const height = Math.max(56, ...[...rows].map(number => contentHeight(sheet.getRow(number))));
    for (const number of rows) sheet.getRow(number).height = height;
}
async function serializeEmployeeHistoryProposalWorkbook(workbook) {
    uniformBusinessRowHeights(workbook);
    const zip = await JSZip.loadAsync(await workbook.xlsx.writeBuffer());
    const fieldRows = businessFieldRows(workbook);
    for (const ws of workbook.worksheets.filter(sheet => sheet.state === 'visible')) {
        const path = `xl/worksheets/sheet${ws.id}.xml`;
        const xml = await zip.file(path).async('string');
        // Fixed, equal field heights must survive Calc's automatic row sizing.
        // Titles and guidance may still use the measured AutoFit fallback.
        zip.file(path, xml.replace(/<row\b[^>]*>/g, tag => {
            const number = Number(tag.match(/\br="(\d+)"/)?.[1]);
            return ws.name === 'ΠΡΙΝ - ΜΕΤΑ' && fieldRows.has(number) ? tag :
                tag.replace(/customHeight="1"/g, 'customHeight="0"');
        }));
    }
    return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
async function sendEmployeeHistoryProposalXlsx(res, input, catalogs = {}, options = {}) {
    const result = await buildEmployeeHistoryProposalWorkbook(input, catalogs, options);
    if (!result.workbook) return res.json({ success: true, exportAvailable: false,
        historyStatus: result.caseSelection.historyStatus, message: result.caseSelection.diagnostic });
    const buffer = await serializeEmployeeHistoryProposalWorkbook(result.workbook);
    res.set('Cache-Control', 'no-store');
    res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.attachment(result.filename);
    return res.send(Buffer.from(buffer));
}
function sendEmployeeHistoryProposalXlsxFailure(res, error) {
    const status = [401, 403, 404, 409].includes(error?.statusCode) ? error.statusCode : 500;
    const code = 'EMPLOYEE_HISTORY_XLSX_EXPORT_FAILED';
    res.set('Cache-Control', 'no-store');
    return res.status(status).json({ success: false, code,
        message: 'Ζητήσατε εξαγωγή πρότασης Ιστορικού σε XLSX, αλλά το αρχείο δεν δημιουργήθηκε επειδή δεν επιβεβαιώθηκαν η πρόσβαση ή όλα τα απαιτούμενα στοιχεία. Δεν αποθηκεύτηκε καμία αλλαγή.\n' +
            '1. Ελέγξτε τη σύνδεση, την εταιρεία και τον εργαζόμενο.\n' +
            '2. Ανοίξτε ξανά το Ιστορικό και επαναλάβετε την εξαγωγή. Αν αποτύχει ξανά, ζητήστε έλεγχο από διαχειριστή.\n' +
            `Κωδικός αναφοράς: ${code}.` });
}
module.exports = { VERSION, LAYOUT_VERSION, LEGACY_LAYOUT_VERSION, buildEmployeeHistoryProposalWorkbook, serializeEmployeeHistoryProposalWorkbook, sendEmployeeHistoryProposalXlsx,
    sendEmployeeHistoryProposalXlsxFailure, workbookCellText };
