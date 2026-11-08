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
const VERSION = 'employee-history-proposal-xlsx:v2';
const UNCERTAIN = 'Παραμένει αβέβαιο';
const CONFIRMED = 'Δηλώνω τεκμηριωμένα στοιχεία';
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
const greekDay = text => String(text || '').replace(/(\d{4})-(\d{2})-(\d{2})/g, '$3/$2/$1');

// ExcelJS has no AutoFit measurement. Estimate wrapped lines conservatively in
// column character units, including explicit line breaks and long single words.
function contentHeight(row) {
    let lines = 1;
    row.eachCell(cell => {
        const width = Math.max(1, (row.worksheet.getColumn(cell.col).width || 28) - 3);
        const wrapped = cell.text.split(/\r?\n/).reduce((sum, paragraph) => {
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
async function buildEmployeeHistoryProposalWorkbook(input, catalogs = {}) {
    const plan = coordinateEmployeeHistorySettlement(input, { catalogs });
    const preview = buildUnifiedEmployeeHistorySettlementPreview(input, catalogs);
    const inspection = inspectEmployeeHistorySave({ scope: input.scope, currentEmployee: input.currentEmployee,
        historyRows: input.completeHistoryRows });
    const finalInspection = plan.status === 'CLEAN' ? inspectEmployeeHistorySave({ scope: input.scope,
        currentEmployee: { ...input.currentEmployee, ...plan.currentPatch }, historyRows: plan.proposedRows }) : null;
    const proposalStatus = plan.status === 'CLEAN' && finalInspection?.status !== 'CLEAN' ? 'REVIEW_REQUIRED' : plan.status;
    const snapshot = A.hash({ version: VERSION, scope: input.scope, employee: input.currentEmployee,
        history: A.ordered(input.completeHistoryRows), references: input.protectedReferenceSummary,
        schedules: input.predeclaredScheduleRows || [], catalogs });
    const proposalHash = A.hash({ snapshot, plan, preview });
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
        ws.addRow(['Δεν αποθηκεύτηκε αλλαγή.', 'Η εισαγωγή του αρχείου δεν υποστηρίζεται ακόμη.']);
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
        errorTitle: 'Μη επιτρεπόμενη τιμή', error: '1. Διάλεξε επιτρεπόμενη τιμή ή άφησε το πεδίο κενό. 2. Αν δεν γνωρίζεις, κράτησε «Παραμένει αβέβαιο». Δεν αποθηκεύεται αλλαγή στην εφαρμογή.' };
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
    if (proposalStatus === 'CLEAN' && plan.verification?.status === 'CLEAN') {
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
    if (!visibleSheets.length) {
        const ws = book.addWorksheet('Προτεινόμενες διορθώσεις');
        ws.columns = [{ width: 95 }];
        ws.addRow([proposalStatus === 'CLEAN' ? 'Δεν υπάρχουν προτεινόμενες διορθώσεις ή εκκρεμή στοιχεία.' :
            'Δεν προέκυψε πλήρως τεκμηριωμένη πρόταση ή ασφαλής ερώτηση συμπλήρωσης.']);
        ws.addRow([proposalStatus === 'CLEAN' ? 'Δεν αποθηκεύτηκε καμία αλλαγή.' :
            '1. Ελέγξτε τα έγγραφα της περιόδου.\n2. Ζητήστε έλεγχο από διαχειριστή. Δεν αποθηκεύτηκε καμία αλλαγή.']);
        visibleSheets.push(ws);
    }
    instructions.addRows([
        [1, 'Διάβασε πρώτα τη Σύνοψη. CLEAN της πρότασης δεν σημαίνει ότι άλλαξε το αποθηκευμένο Ιστορικό.'],
        [2, 'Έλεγξε ΠΡΙΝ/ΜΕΤΑ και τα φυσικά IDs. Τα λογικά IDs νέων προτεινόμενων περιόδων δεν είναι αποθηκευμένες εγγραφές.'],
        [3, 'Στις Αμφίβολες περιπτώσεις επεξεργάσου μόνο τα κίτρινα κελιά H, I και J των υπαρχουσών ερωτήσεων. Χρησιμοποίησε τις λίστες επιλογών.'],
        [4, 'Δήλωσε πραγματικές τιμές και συγκεκριμένα τεκμήρια. Διατήρησε «Παραμένει αβέβαιο» όταν δεν γνωρίζεις. Μην αντιγράφεις μεταγενέστερους όρους σε παλαιότερες περιόδους.'],
        [5, 'Η προστασία φύλλου αποτρέπει ακούσιες αλλαγές και δεν είναι μηχανισμός ασφάλειας. Η τροποποίηση IDs, περιόδων ή μεταδεδομένων δεν παρέχει κανένα δικαίωμα.'],
        [6, 'Η εισαγωγή XLSX δεν υποστηρίζεται στην παρούσα φάση. Το αρχείο δεν αποτελεί έγκριση ή εντολή αποθήκευσης. Δεν έγινε μεταβολή Ιστορικού.'],
        [7, 'Μελλοντική εισαγωγή απαιτεί νέο έλεγχο στον διακομιστή: δικαιώματα, έκδοση, IDs, επιτρεπόμενα κελιά, τεκμήρια, παλιά κατάσταση και πλήρη τελική επικύρωση πριν από χωριστή συναλλακτική έγκριση.']
    ]);
    metadata.addRows([['schemaVersion', VERSION], ['exportId', randomUUID()], ['plannerVersion', plan.version],
        ['scope', JSON.stringify(input.scope)], ['employeeId', id(input.currentEmployee)],
        ['snapshotFingerprint', snapshot], ['proposalFingerprint', proposalHash], ['plannerSnapshotFingerprint', plan.snapshotFingerprint || ''],
        ['exportBasis', 'CURRENT_PERSISTED_SNAPSHOT'], ['plannerStatus', plan.status], ['proposalStatus', proposalStatus],
        ['finalValidationIssues', JSON.stringify(finalInspection?.issues.map(item => ({ reason: item.reason, field: item.field })) || [])],
        ['importEnabled', 'false'], ['executionCapability', 'NONE']]);
    for (const entry of editable) metadata.addRow(['editableCell', JSON.stringify(entry)]);
    metadata.addRow(['layoutVersion', 'business-sheets:v2']);
    metadata.addRow(['decisionContext', JSON.stringify(preview.decisionContext || null)]);
    book.views = [{ activeTab: book.worksheets.indexOf(visibleSheets[0]), firstSheet: book.worksheets.indexOf(visibleSheets[0]) }];
    for (const ws of book.worksheets) {
        ws.eachRow(row => {
            row.eachCell({ includeEmpty: true }, cell => {
                cell.font = { name: 'Calibri', size: 11, color: { argb: COLORS.text } };
                cell.alignment = { vertical: 'top', wrapText: true };
                if (cell.protection?.locked !== false) cell.protection = { locked: true };
                if (row.number === (ws.state === 'visible' ? 3 : 1)) {
                    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: COLORS.white } };
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.header } };
                } else if (ws.state === 'visible') {
                    if (cell.protection.locked !== false) cell.fill = { type: 'pattern', pattern: 'solid',
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
    return { workbook: book, snapshotFingerprint: snapshot, proposalFingerprint: proposalHash, editableCells: editable,
        filename: `employee-history-${String(input.scope.kodikos).replace(/[^\w-]/g, '_')}-${snapshot.slice(0, 10)}.xlsx` };
}

async function serializeEmployeeHistoryProposalWorkbook(workbook) {
    const zip = await JSZip.loadAsync(await workbook.xlsx.writeBuffer());
    for (const ws of workbook.worksheets.filter(sheet => sheet.state === 'visible')) {
        const path = `xl/worksheets/sheet${ws.id}.xml`;
        const xml = await zip.file(path).async('string');
        // ExcelJS always marks a measured height as custom/fixed. OOXML permits
        // a measured initial height with customHeight=0: retain the readable
        // fallback while allowing Calc/Excel to AutoFit after the user edits.
        zip.file(path, xml.replace(/<row\b[^>]*>/g, tag => tag.replace(/customHeight="1"/g, 'customHeight="0"')));
    }
    return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
async function sendEmployeeHistoryProposalXlsx(res, input, catalogs = {}) {
    const result = await buildEmployeeHistoryProposalWorkbook(input, catalogs);
    const buffer = await serializeEmployeeHistoryProposalWorkbook(result.workbook);
    res.set('Cache-Control', 'no-store');
    res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.set('Content-Disposition', `attachment; filename="${result.filename}"`);
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
module.exports = { VERSION, buildEmployeeHistoryProposalWorkbook, serializeEmployeeHistoryProposalWorkbook, sendEmployeeHistoryProposalXlsx,
    sendEmployeeHistoryProposalXlsxFailure };
