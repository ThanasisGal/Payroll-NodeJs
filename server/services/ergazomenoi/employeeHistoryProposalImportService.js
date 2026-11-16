'use strict';

const A = require('./employeeHistoryAutomaticReconstructionApplyContract');
const C = require('./employeeHistoryAutomaticReconstructionContract');
const X = require('./employeeHistoryProposalXlsxService');
const E = require('./employeeHistoryProposalEditorService');
const F = require('./employeeHistoryProposalImportFileService');
const { PARENT_FIELDS, parentKeyForCatalog } = require('./employeeContractDescriptionService');
const { calendarDate } = require('../../utils/ergazomenoi/employmentProfileContract');
const { effectiveStart, effectiveEnd } = require('../../utils/ergazomenoi/employmentProfileHistory');
const { validateWorkTermRelationships } = require('./employeeHistoryCorrectionFieldRegistryService');
const { buildEmploymentCycles } = require('./employeeEmploymentCycleResolverService');
const { semanticHistoryRows } = require('../../utils/ergazomenoi/employmentHistoryCanonicalStatus');
const { employeeHistoryCoverageGaps } = require('../../utils/ergazomenoi/employmentHistoryCoverage');
const { partitionHistoryUpdateReferences } = require('./employeeHistoryReferenceSemanticsService');
const { readImportProtection, assertImportProtection } = require('./employeeHistoryProposalImportProtectionService');
const labels = require('../../../public/js/ergazomenoi/genika/employeeHistoryFieldLabels');
const DAYS = ['Δευτέρα','Τρίτη','Τετάρτη','Πέμπτη','Παρασκευή','Σάββατο','Κυριακή'];
const PARENTS = { CONTRACT_CATEGORY:['symbash'], CONTRACT_SPECIALTY:['symbash','kathgoria_symbashs'],
    CONTRACT_ITEM:['symbash','kathgoria_symbashs','eidikothta_symbashs'] };
const day = value => { try { return calendarDate(value)?.toISOString().slice(0,10) || null; } catch { throw F.rejected('DATES'); } };
const sameValue = (field, left, right) => C.PROFILE_FIELD_TYPES[field] === 'Date' || field.startsWith('hmeromhnia_')
    ? day(left) === day(right) : A.equal(left ?? null, right ?? null);

function decodeAnswers(uploaded, baseline, catalogs) {
    const decoded = new Map();
    const decode = entry => {
        if (decoded.has(entry)) return decoded.get(entry);
        try {
            const cell = uploaded.getWorksheet(entry.sheet).getCell(entry.cell), original = baseline.workbook.getWorksheet(entry.sheet).getCell(entry.cell);
            let value = F.cellValue(cell), choices = E.editorChoices(entry, catalogs), input = value;
            if (value !== null && choices.length) {
                const parents = Object.fromEntries((PARENTS[entry.catalog] || []).map(field => {
                    const parent = baseline.editableCells.find(other => other.canonicalField === field);
                    return [field, parent ? decode(parent).raw : null];
                }));
                const parent = parentKeyForCatalog(entry.catalog, parents);
                const matching = choices.map((option,index) => ({option,index})).filter(({option}) =>
                    (!PARENT_FIELDS[entry.catalog] || option.parent === parent) &&
                    (A.equal(value, option.id) || value === option.label ||
                        entry.storeCode && typeof value==='number' && Number.isInteger(value) && String(value)===option.id));
                if (matching.length !== 1) throw F.rejected('VALUE');
                input = String(matching[0].index);
            } else if (value !== null && entry.type === 'Date') {
                if (value instanceof Date) {
                    if (value.getUTCHours() || value.getUTCMinutes() || value.getUTCSeconds() || value.getUTCMilliseconds()) throw F.rejected('DATES');
                    input = value.toISOString().slice(0,10);
                } else if (typeof value === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(value)) input = value.split('/').reverse().join('-');
                else if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw F.rejected('DATES');
            } else if (value !== null && entry.type === 'Array') {
                if (value === 'Καμία ημέρα') input = [];
                else if (typeof value === 'string') input = value.split(',').map(item => {
                    const part = item.trim(); return /^[1-7]$/.test(part) ? Number(part) : DAYS.indexOf(part) + 1;
                });
                else throw F.rejected('VALUE');
            }
            let result;
            try { result = E.completedValue(entry, input ?? '', original, choices); }
            catch { throw F.rejected('VALUE'); }
            decoded.set(entry, { ...result, input: input ?? '' }); return decoded.get(entry);
        } catch (error) {
            // Report only the first field actually rejected by the typed decoder.
            // A failing parent keeps its own identity through recursive decoding.
            if (error.importReason && !error.importField && entry.role === 'ANSWER' && labels[entry.canonicalField])
                error.importField = { id: entry.canonicalField, kind: entry.catalog || E.editorChoices(entry, catalogs).length ? 'CHOICE' : entry.type };
            throw error;
        }
    };
    for (const entry of baseline.editableCells) decode(entry);
    return decoded;
}
function validateCandidate(input, baseline, answers) {
    const selected = baseline.caseSelection.selectedCase;
    const original = input.completeHistoryRows.find(row => String(row._id) === selected.targetHistoryId);
    const candidate = selected.operation === 'UPDATE' ? { ...original } : { ...input.scope,
        [C.HIRE]: selected.period.hire, [C.START]: selected.period.from, [C.END]: selected.period.to };
    for (const [entry, value] of answers) if (entry.role === 'ANSWER' &&
        (selected.operation==='INSERT' || value.raw!==null || Object.hasOwn(original,entry.canonicalField))) candidate[entry.canonicalField] = value.raw;
    // Reuse the complete typed submission contract; it never persists or repairs.
    try { validateWorkTermRelationships(candidate); } catch { throw F.rejected('WORK_TERMS'); }
    const from = day(effectiveStart(candidate)), to = day(effectiveEnd(candidate)), hire = day(candidate[C.HIRE]);
    const cycles = buildEmploymentCycles({ currentEmployee:input.currentEmployee, history:input.completeHistoryRows });
    const cycle = cycles.find(item => item.hire_date === hire);
    if (!from || !hire || !cycle || from < hire || to && to < from || cycle.departure_date && (!to || to > cycle.departure_date)) throw F.rejected('DATES');
    for (const field of [C.CHANGE, C.CONTRACT_END, 'hmeromhnia_allaghs_orarioy_apo','hmeromhnia_allaghs_orarioy_eos',
        'hmnia_enarxhs_egkekrimenhs_rythmishs','hmnia_lhxhs_egkekrimenhs_rythmishs','hmeromhnia_isxyos_dialleimatos_apo']) {
        const date = day(candidate[field]);
        if (date && (date < hire || cycle.departure_date && date > cycle.departure_date)) throw F.rejected('DATES');
    }
    for (const [start,end] of [[C.CHANGE,C.CONTRACT_END],['hmeromhnia_allaghs_orarioy_apo','hmeromhnia_allaghs_orarioy_eos'],
        ['hmnia_enarxhs_egkekrimenhs_rythmishs','hmnia_lhxhs_egkekrimenhs_rythmishs']])
        if (day(candidate[start]) && day(candidate[end]) && day(candidate[start]) > day(candidate[end])) throw F.rejected('DATES');
    const active = semanticHistoryRows(input.completeHistoryRows);
    const intersects = (row, a, b) => day(effectiveStart(row)) && day(row[C.HIRE]) === hire &&
        day(effectiveStart(row)) <= (b || '9999-12-31') && (!day(effectiveEnd(row)) || day(effectiveEnd(row)) >= a);
    const overlaps = active.filter(row => String(row._id) !== selected.targetHistoryId && intersects(row,from,to));
    if (overlaps.length) throw F.rejected('COVERAGE',409);
    if (selected.operation==='UPDATE') {
        const before=employeeHistoryCoverageGaps({currentEmployee:input.currentEmployee,historyRows:input.completeHistoryRows});
        const after=employeeHistoryCoverageGaps({currentEmployee:input.currentEmployee,
            historyRows:input.completeHistoryRows.map(row=>String(row._id)===selected.targetHistoryId?candidate:row),
            requiredHistoryRows:input.completeHistoryRows});
        if (after.some(gap=>gap.reason || !before.some(old=>!old.reason && old.hire===gap.hire &&
            old.from<=gap.from && (old.to||'9999-12-31')>=(gap.to||'9999-12-31')))) throw F.rejected('COVERAGE_GAP',409);
    }
    if (selected.operation === 'INSERT') {
        const gaps = employeeHistoryCoverageGaps({ currentEmployee:input.currentEmployee, historyRows:input.completeHistoryRows });
        if (!gaps.some(gap => !gap.reason && gap.hire === hire && gap.from === from && gap.to === to)) throw F.rejected('STALE',409);
    }
    const oldFrom = original ? day(effectiveStart(original)) || hire : hire, oldTo = original ? day(effectiveEnd(original)) : null;
    return { candidate, original, period:{from,to}, affected:{from:selected.operation==='UPDATE'?[oldFrom,from].sort()[0]:from,
        to:selected.operation==='UPDATE' ? !oldTo || !to ? null : [oldTo,to].sort().at(-1) : to} };
}
async function previewEmployeeHistoryProposalImport({ buffer, input, catalogs, req, loadProtection = readImportProtection }) {
    const uploaded = await F.readImportWorkbook(buffer), rows = F.metadataRows(uploaded);
    if (F.oneMetadata(rows,'schemaVersion') !== X.VERSION || ![X.LAYOUT_VERSION, X.LEGACY_LAYOUT_VERSION].includes(F.oneMetadata(rows,'layoutVersion'))) throw F.rejected('VERSION');
    if (!A.equal(F.oneMetadata(rows,'scope',true),input.scope) || F.oneMetadata(rows,'employeeId') !== String(input.currentEmployee._id)) throw F.rejected('SCOPE',403);
    const hint = F.oneMetadata(rows,'selectedCase',true);
    if (!hint || !['UPDATE','INSERT'].includes(hint.operation)) throw F.rejected('CASE',409);
    let selection;
    if (hint.operation === 'UPDATE') {
        const target = input.completeHistoryRows.find(row => String(row._id) === hint.targetHistoryId);
        if (!target || !C.SCOPE_FIELDS.every(field => target[field] === input.scope[field])) throw F.rejected('SCOPE',403);
        selection = hint.manualSelection === true ? `UPDATE:${String(target._id)}` : '';
    } else selection = `INSERT:${hint.id}`;
    const legacyLayout = F.oneMetadata(rows,'layoutVersion') === X.LEGACY_LAYOUT_VERSION;
    let baseline;
    try { baseline = await X.buildEmployeeHistoryProposalWorkbook(input,catalogs,{selection,legacyLayout}); }
    catch { throw F.rejected('STALE',409); }
    if (!baseline.workbook || baseline.caseSelection.selectedCase.id !== hint.id ||
        baseline.snapshotFingerprint !== F.oneMetadata(rows,'snapshotFingerprint')) throw F.rejected('STALE',409);
    F.compareProtectedWorkbook(uploaded,baseline,rows,baseline.editableCells.flatMap(entry=>E.editorChoices(entry,catalogs)));
    let answers = decodeAnswers(uploaded,baseline,catalogs);
    // Existing completion validation owns canonical choices, dependent catalogs,
    // numeric ranges and aliases. The body/context below are rebuilt by server.
    try { E.applyLocalCompletion(baseline,{caseId:baseline.caseSelection.selectedCase.id,snapshotFingerprint:baseline.snapshotFingerprint,
        context:E.editorContext(req,baseline.snapshotFingerprint,baseline.caseSelection.selectedCase.id),
        changes:baseline.editableCells.map((entry,index)=>({index,value:answers.get(entry).input}))},req,catalogs); }
    catch { throw F.rejected('VALUE'); }
    let checked;
    try { checked = validateCandidate(input,baseline,answers); } catch(error) { throw error.importReason ? error : F.rejected('DATES'); }
    const selected = baseline.caseSelection.selectedCase;
    const branch = checked.original?.ypokatasthma ?? input.currentEmployee.ypokatasthma;
    if (typeof branch !== 'string' || !branch.trim() || branch!==branch.trim()) throw F.rejected('BRANCH',409);
    let referenceCount = 0;
    for (const id of selected.operation === 'UPDATE' ? [selected.targetHistoryId] : selected.sourceHistoryIds) {
        const references = input.protectedReferenceSummary?.[id];
        if (!Array.isArray(references)) throw F.rejected('PROTECTION_UNKNOWN',409);
        try { if (partitionHistoryUpdateReferences(references).liveDereference.length) throw F.rejected('PROTECTION_UNKNOWN',409); }
        catch { throw F.rejected('PROTECTION_UNKNOWN',409); }
        referenceCount += references.length;
    }
    const protectionScope = {scope:input.scope,branch,period:checked.affected};
    let protection;
    try {protection=await loadProtection(protectionScope);} catch(error) {throw error.importReason?error:F.rejected('PROTECTION_UNKNOWN',409);}
    assertImportProtection(protection,protectionScope);
    if (legacyLayout) {
        const current = await X.buildEmployeeHistoryProposalWorkbook(input,catalogs,{selection});
        if (!current.workbook || current.snapshotFingerprint !== baseline.snapshotFingerprint ||
            current.caseSelection.selectedCase.id !== selected.id || current.editableCells.length !== baseline.editableCells.length) throw F.rejected('STALE',409);
        answers = new Map(current.editableCells.map((entry,index) => {
            const previous = baseline.editableCells[index];
            if (entry.cell !== previous.cell || entry.role !== previous.role || entry.canonicalField !== previous.canonicalField) throw F.rejected('PROTECTED');
            return [entry, entry.role === 'DECLARATION' ? {raw:'Όχι',input:'0'} : answers.get(previous)];
        }));
    }
    const evidence = [...answers].find(([entry])=>entry.role==='EVIDENCE')?.[1].raw;
    const declaration = [...answers].find(([entry])=>entry.role==='DECLARATION')?.[1].raw;
    const proposalRows=[];
    for (const [entry,value] of answers) {
        if (entry.role !== 'ANSWER' || selected.operation==='UPDATE' && sameValue(entry.canonicalField,checked.original[entry.canonicalField],value.raw)) continue;
        if (selected.operation==='INSERT' && value.raw===null) continue;
        const sheet=baseline.workbook.getWorksheet(entry.sheet), cell=sheet.getCell(entry.cell);
        const source=input.completeHistoryRows.find(row=>String(row._id)===entry.sourceHistoryId);
        const origin=source?`${entry.state==='SUGGESTED_LATER'?'Μεταγενέστερη πηγή':'Καταγεγραμμένη πηγή'}: εγγραφή ${source.aa_eggrafhs||'χωρίς αρίθμηση'}`:'Δεν υπάρχει καταγεγραμμένη πηγή για το πεδίο';
        proposalRows.push({field:labels[entry.canonicalField],before:selected.operation==='UPDATE' ? X.workbookCellText(sheet.getCell(`B${cell.row}`)) : 'Δεν υπάρχει εγγραφή στην ελλείπουσα περίοδο',
            after:X.workbookCellText(cell)||'Κενό',source:`${origin}. Προτεινόμενη τιμή από το ΜΕΤΑ του XLSX, περιλαμβανομένων αλλαγών στο Calc.${entry.choiceDiagnostic?` ${entry.choiceDiagnostic}`:''}`,
            documentation:declaration==='Ναι' ? 'Ο χρήστης επέλεξε έγκριση μεταβολών. Απαιτείται τελική προεπισκόπηση και χωριστή επιβεβαίωση εφαρμογής.' : 'Δεν έχει δοθεί έγκριση εφαρμογής των μεταβολών. Η αναγνωστική προεπισκόπηση παραμένει διαθέσιμη.'});
    }
    return {success:true,previewOnly:true,executionEnabled:false,saved:false,historyStatus:'REVIEW_REQUIRED',
        employeeCode:input.scope.kodikos,companyCode:input.companyBusinessCode||'',team:input.scope.team,branch,
        historySequence:checked.original?.aa_eggrafhs||null,operation:selected.operation,period:checked.period,
        // Only server-owned editable mappings and decoded, validated raw answers leave
        // this boundary. No Excel coordinates, protected values or plan are exposed.
        editorValues:{caseId:selected.id,snapshotFingerprint:baseline.snapshotFingerprint,
            selectionLabel:selection.startsWith('UPDATE:') ? `Εγγραφή ${checked.original.aa_eggrafhs || 'χωρίς αρίθμηση'}` :
                selected.operation==='INSERT' ? `Ελλείπουσα περίοδος ${selected.period.from} – ${selected.period.to || 'χωρίς λήξη'}` : 'Επόμενη εκκρεμότητα του ελέγχου',
            values:[...answers].map(([entry,value])=>({fieldId:entry.canonicalField || entry.fieldId,value:value.raw}))},
        editorSelection:selection,rows:proposalRows,referenceCount,evidence:evidence||'',declaration:declaration||'Όχι',legacyFormat:legacyLayout,
        pendingCases:baseline.caseSelection.cases.filter(item=>item.id!==selected.id).length,
        coverageRecheckRequired:true,previousInsertProposalsReusable:false,
        message:'Αναγνωστική προεπισκόπηση της συγκεκριμένης περίπτωσης. Δεν αποθηκεύτηκε καμία αλλαγή. Το Ιστορικό παραμένει προς έλεγχο και δεν παρέχεται δυνατότητα εφαρμογής. Αλλαγές ιστορικών ορίων απαιτούν νέο έλεγχο κάλυψης και νέες προτάσεις INSERT.'};
}
const DIAGNOSES = {
    SIZE:'Το αρχείο υπερβαίνει τα επιτρεπόμενα όρια μεγέθους ή περιεχομένου.',FORMAT:'Το αρχείο δεν αναγνωρίστηκε ως έγκυρη πρόταση XLSX.',
    ACTIVE_CONTENT:'Βρέθηκαν τύποι υπολογισμού, εξωτερικές συνδέσεις ή ενεργό περιεχόμενο που δεν επιτρέπονται.',
    STRUCTURE:'Η δομή των φύλλων ή των πεδίων διαφέρει από την αναμενόμενη πρόταση.',METADATA:'Τα στοιχεία ταυτοποίησης του αρχείου λείπουν ή είναι αλλοιωμένα.',
    PROTECTED:'Κάποιο ΠΡΙΝ, κλειδωμένο πεδίο ή προστατευμένο στοιχείο έχει μεταβληθεί.',VERSION:'Η έκδοση της πρότασης δεν υποστηρίζεται.',
    SCOPE:'Η εταιρεία, ο εργαζόμενος ή η ιστορική εγγραφή δεν συμφωνούν με την εξουσιοδοτημένη επιλογή.',
    CASE:'Δεν επιβεβαιώθηκε μία συγκεκριμένη περίπτωση UPDATE ή INSERT.',STALE:'Το αποθηκευμένο Ιστορικό, η περίπτωση ή οι κατάλογοι έχουν αλλάξει από την εξαγωγή.',
    VALUE:'Κάποιο ΜΕΤΑ δεν έχει επιτρεπόμενη τιμή, τύπο ή ασφαλή επιλογή καταλόγου.',WORK_TERMS:'Οι προτεινόμενες ημέρες, ώρες ή λοιποί όροι δεν συμφωνούν μεταξύ τους.',
    DATES:'Οι ημερομηνίες δεν συμφωνούν με την περίοδο ή τον καταγεγραμμένο εργασιακό κύκλο.',COVERAGE:'Η προτεινόμενη περίοδος επικαλύπτει άλλη αποθηκευμένη εγγραφή.',
    COVERAGE_GAP:'Οι προτεινόμενες ημερομηνίες αφήνουν νέο ακάλυπτο διάστημα στο Ιστορικό.',
    BRANCH:'Δεν επιβεβαιώθηκε το υποκατάστημα της συγκεκριμένης περίπτωσης.',PROTECTION_UNKNOWN:'Δεν ολοκληρώθηκε με ασφάλεια ο έλεγχος προστατευμένων αναφορών και περιόδων.',
    PERIOD_PROTECTED:'Η πρόταση αφορά κλειδωμένη ή οριστικοποιημένη περίοδο.',ACCESS:'Δεν επιβεβαιώθηκε η πρόσβαση στα απαιτούμενα στοιχεία.'
};
const FIELD_PROBLEMS = {
    Date:['Μη επιτρεπόμενη ημερομηνία.', 'Ελέγξτε την ημερομηνία και γράψτε την ως ΗΗ/ΜΜ/ΕΕΕΕ.'],
    Number:['Μη επιτρεπόμενος αριθμός.', 'Ελέγξτε τα επιτρεπόμενα όρια. Χρησιμοποιήστε τελεία ή κόμμα για τα δεκαδικά, χωρίς διαχωριστικά χιλιάδων.'],
    Array:['Μη επιτρεπόμενη επιλογή ημερών.', 'Επιλέξτε έγκυρες ημέρες εβδομάδας χωρίς επαναλήψεις.'],
    CHOICE:['Η τιμή δεν αντιστοιχεί σε έγκυρη επιλογή της συγκεκριμένης περίπτωσης.', 'Επιλέξτε τιμή από τον διαθέσιμο κατάλογο και ελέγξτε τις σχετικές γονικές επιλογές.'],
    String:['Η συμπληρωμένη τιμή δεν έχει την επιτρεπόμενη μορφή.', 'Ελέγξτε τη μορφή και το επιτρεπόμενο μήκος του πεδίου στο αρχικό XLSX.']
};
function sendImportFailure(res,error) {
    const reason=DIAGNOSES[error?.importReason]?error.importReason:'ACCESS';
    const code=`EMPLOYEE_HISTORY_XLSX_IMPORT_${reason}`;
    const field = error?.importField;
    const details = ['VALUE','DATES'].includes(reason) && labels[field?.id] && FIELD_PROBLEMS[field?.kind];
    const problems = details ? [{fieldId:field.id,field:labels[field.id],problem:details[0],action:details[1]}] : [];
    res.set('Cache-Control','no-store');
    return res.status([400,401,403,404,409,413,415,422].includes(error?.statusCode)?error.statusCode:500)
        .json({success:false,previewOnly:true,executionEnabled:false,saved:false,code,problems,
            message:`Ο έλεγχος του XLSX σταμάτησε. ${details ? 'Βρέθηκε μη επιτρεπόμενη τιμή στο πεδίο που εμφανίζεται παρακάτω.' : DIAGNOSES[reason]} Οι προηγούμενες συμπληρώσεις διατηρούνται. Δεν αποθηκεύτηκε καμία αλλαγή.\n1. ${details ? 'Διορθώστε το πεδίο σύμφωνα με την οδηγία.' : 'Ελέγξτε ότι το αρχείο αφορά τη σωστή εταιρεία και τον σωστό εργαζόμενο.'}\n2. ${details ? 'Επιλέξτε ξανά το διορθωμένο XLSX.' : 'Αν χρειάζεται, δημιουργήστε νέα πρόταση ή ζητήστε έλεγχο από διαχειριστή.'}\nΚωδικός αναφοράς: ${code}.`});
}
module.exports={previewEmployeeHistoryProposalImport,sendImportFailure,validateCandidate,sameValue};
