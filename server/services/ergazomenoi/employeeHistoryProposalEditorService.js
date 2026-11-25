'use strict';

const { createHmac } = require('node:crypto');
const A = require('./employeeHistoryAutomaticReconstructionApplyContract');
const X = require('./employeeHistoryProposalXlsxService');
const { PROPOSAL_GROUPS } = require('./employeeHistoryProposalComparisonService');
const { calendarDate, FACT_FIELDS } = require('../../utils/ergazomenoi/employmentProfileContract');
const { formatValue } = require('./employeeHistoryReconstructionPreviewService');
const { PARENT_FIELDS, parentKeyForCatalog } = require('./employeeContractDescriptionService');
const { semanticHistoryRows } = require('../../utils/ergazomenoi/employmentHistoryCanonicalStatus');
const historyFieldLabels = require('../../../public/js/ergazomenoi/genika/employeeHistoryFieldLabels');
const PARENTS = { CONTRACT_CATEGORY: ['symbash'], CONTRACT_SPECIALTY: ['symbash', 'kathgoria_symbashs'],
    CONTRACT_ITEM: ['symbash', 'kathgoria_symbashs', 'eidikothta_symbashs'] };
const DAYS = ['Δευτέρα', 'Τρίτη', 'Τετάρτη', 'Πέμπτη', 'Παρασκευή', 'Σάββατο', 'Κυριακή'];
const entryType = entry => ({ DECIMAL: 'Number', DATE: 'Date', TEXT: 'String' })[entry.type] || entry.type;
const reject = statusCode => Object.assign(new Error('LOCAL_XLSX_COMPLETION_REJECTED'), { statusCode });

// Stateless binding to the existing authenticated session; never a History approval.
function editorContext(req, snapshot, caseId = '') {
    if (!req.sessionID || !req.session?.userId) throw reject(403);
    return createHmac('sha256', req.sessionID).update(A.stringify(['local-xlsx-completion:v2:single-case',
        req.session.userId, req.session.userTeam, req.session.companyInUse, req.params.id, snapshot, caseId])).digest('base64url');
}
function editorChoices(entry, catalogs) {
    if (!entry.catalog) return entry.options || [];
    return (catalogs[entry.catalog] || []).map(item => ({ id: item.code,
        label: `${item.code} - ${item.label}`.replace(/\b[a-f\d]{24,}\b/gi, 'μη διαθέσιμη περιγραφή')
            .replace(/\b[A-Za-z][A-Za-z\d]*_[A-Za-z\d_]+\b/g, 'μη διαθέσιμη περιγραφή'),
        parent: PARENT_FIELDS[entry.catalog] ? String(item[PARENT_FIELDS[entry.catalog]] || '') : '' }));
}
// Presentation sources stay outside workbook fingerprints and XLSX mappings.
async function loadEditorSources() {
    const { KrathseisModel } = require('../../models/stathera_arxeia');
    const [deductions, profile] = await Promise.all([
        KrathseisModel.find({}, { _id: 0, kodikos: 1, perigrafh: 1 }).sort({ kodikos: 1 }).lean(),
        require('../../utils/ergazomenoi/employmentProfileUiContext').getEmploymentProfileUiContext()
    ]);
    return { deductions, ...profile };
}
function presentationChoices(field, sources) {
    const rows = /^krathsh_0[2-7]$/.test(field) ? sources.deductions :
        field === 'kathgoria_adeias_egkekrimenhs_rythmishs' ? sources.categories : null;
    if (rows) return rows.filter(row => typeof row.kodikos === 'string' && row.kodikos && row.perigrafh)
        .map(row => ({ id: row.kodikos, label: `${row.kodikos} - ${row.perigrafh}` }));
    if (field === 'typos_egkekrimenhs_rythmishs') return (sources.types || []).map(row => ({
        id: row.value, label: row.label, disabled: row.disabled }));
    return null;
}
function editorModel(result, catalogs = {}, sources = {}) {
    if (!result.workbook) return { exportAvailable: false, title: 'Έλεγχος πρότασης Ιστορικού', message: result.caseSelection.diagnostic, rows: [], attention: [] };
    const sheet = result.workbook.getWorksheet('ΠΡΙΝ - ΜΕΤΑ');
    const edits = new Map(result.editableCells.map((entry, index) => [entry.cell, { ...entry, index }]));
    const rows = [];
    sheet.eachRow(row => {
        if (row.number <= 5) return;
        if (row.getCell('A').isMerged) {
            rows.push({ kind: 'period', title: row.getCell('A').text }); return;
        }
        if (PROPOSAL_GROUPS.includes(row.getCell('A').text) && row.getCell('A').text === row.getCell('C').text) {
            rows.push({ kind: 'group', title: row.getCell('A').text }); return;
        }
        const cell = row.getCell('D'), entry = edits.get(cell.address);
        const raw = entry?.rawProposed;
        const displayChoices = entry ? presentationChoices(entry.canonicalField, sources) : null;
        const options = displayChoices ?? (entry ? editorChoices(entry, catalogs) : []);
        let control = null;
        if (entry) {
            const type = entry.role !== 'ANSWER' ? 'String' : entryType(entry);
            const time = /^(dialleima_(apo|eos)_ora_|diakoph_(apo|eos)_ora_)/.test(entry.canonicalField || '');
            control = { index: entry.index, fieldId: entry.canonicalField || entry.fieldId, type: time ? 'Time' : type, options: options.map((option, i) => ({ value: String(i), label: option.label, code: String(option.id), rawValue: option.id, parent: option.parent || '', disabled: option.disabled === true })),
                rawCompletion: displayChoices !== null,
                catalog: entry.catalog || '', parents: (PARENTS[entry.catalog] || []).map(field =>
                    result.editableCells.findIndex(other => other.comparisonId === entry.comparisonId && other.canonicalField === field)),
                value: type === 'Date' && raw ? calendarDate(raw)?.toISOString().slice(0, 10) :
                    raw ?? (entry.role === 'DECLARATION' ? String(options.findIndex(option => option.label === cell.text)) : ''),
                min: cell.dataValidation?.formulae?.[0], max: cell.dataValidation?.formulae?.[1],
                integer: cell.dataValidation?.type === 'whole' };
            if ((options.length || displayChoices !== null) && entry.role === 'ANSWER') {
                const original = Object.fromEntries(result.editableCells.filter(other => other.comparisonId === entry.comparisonId)
                    .map(other => [other.canonicalField, other.rawProposed]));
                const parent = parentKeyForCatalog(entry.catalog, original);
                control.value = displayChoices !== null && (raw == null || raw === '') ? '' :
                    String(options.findIndex(option => A.equal(option.id, raw) &&
                        (!PARENT_FIELDS[entry.catalog] || option.parent === parent)));
            }
            if (type === 'Array') control.options = DAYS.map((label, i) => ({ value: String(i + 1), rawValue: i + 1, label }));
            control.recordedRaw = raw ?? entry.rawBefore;
            control.proposedRaw = raw;
            control.profileFact = FACT_FIELDS.includes(entry.canonicalField);
            control.required = entry.role === 'DECLARATION';
            control.message = entry.choiceDiagnostic || '';
            if (entry.selectionRequired) control.value = '';
        }
        rows.push({ kind: 'field', beforeLabel: row.getCell('A').text, before: displayChoices?.find(option => A.equal(option.id, entry.rawBefore))?.label ??
                (displayChoices !== null && entry.rawBefore ? String(entry.rawBefore) : X.workbookCellText(row.getCell('B'))),
            afterLabel: row.getCell('C').text, after: X.workbookCellText(cell), color: cell.fill.fgColor?.argb?.slice(2) || 'F8F9FA', control });
    });
    const provenance = result.workbook.getWorksheet('Προέλευση και εκκρεμότητες');
    const attention = [];
    provenance.eachRow(row => { if (row.number > 3) attention.push([1, 2, 3, 4, 5].map(i => row.getCell(i).text)); });
    return { exportAvailable: true, caseId: result.caseSelection.selectedCase.id, operation: result.caseSelection.selectedCase.operation, rows, attention, filename: result.filename, title: sheet.getCell('A2').text };
}
function completedValue(entry, value, cell, choices) {
    if (require('./employeeHistoryRowApprovalService').blank(value)) {
        if (entry.role === 'DECLARATION') return { raw: 'Όχι', display: 'Όχι' };
        return { raw: entry.role === 'EVIDENCE' ? '' : null, display: null };
    }
    if (choices.length) {
        if (typeof value !== 'string' || !/^(0|[1-9]\d*)$/.test(value) || !choices[Number(value)]) throw reject(400);
        const option = choices[Number(value)];
        return { raw: option.id, display: entry.storeCode ? option.id : option.label };
    }
    if (entry.catalog) throw reject(400);
    if (entryType(entry) === 'Number') {
        if (typeof value === 'string') {
            if (!/^[+-]?\d+(?:[.,]\d+)?$/.test(value)) throw reject(400);
            value = Number(value.replace(',', '.'));
        }
        const [min, max] = cell.dataValidation.formulae;
        if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max ||
            cell.dataValidation.type === 'whole' && !Number.isInteger(value)) throw reject(400);
        return { raw: value, display: value };
    }
    if (entryType(entry) === 'Date') {
        if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw reject(400);
        let date;
        try { date = calendarDate(value); } catch { throw reject(400); }
        if (!date || date.toISOString().slice(0, 10) !== value || value < '1900-01-01' || value > '9999-12-31') throw reject(400);
        return { raw: value, display: date };
    }
    if (entryType(entry) === 'Array') {
        if (!Array.isArray(value) || value.length > 7 || new Set(value).size !== value.length ||
            !value.every(day => Number.isInteger(day) && day >= 1 && day <= 7)) throw reject(400);
        return { raw: value, display: formatValue(entry.canonicalField, value) };
    }
    if (typeof value !== 'string' || value.length > 4000) throw reject(400);
    if (/^(dialleima_(apo|eos)_ora_|diakoph_(apo|eos)_ora_)/.test(entry.canonicalField || '') && !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) throw reject(400);
    return { raw: value, display: value };
}
function completionCandidate(result, prepared, entry) {
    const candidate = Object.fromEntries(result.editableCells.filter(other => other.comparisonId === entry.comparisonId)
        .map(other => [other.canonicalField, other.rawProposed]));
    for (const edited of prepared.filter(edited => edited.entry.comparisonId === entry.comparisonId))
        if (!require('./employeeHistoryRowApprovalService').blank(edited.raw)) candidate[edited.entry.canonicalField] = edited.raw;
    return candidate;
}
function prepareLocalCompletion(result, body, req, catalogs = {}) {
    if (!body || Array.isArray(body) || !A.equal(Object.keys(body).sort(), ['caseId', 'changes', 'context', 'snapshotFingerprint'])) throw reject(400);
    if (!A.tokenMatches(body.context, editorContext(req, body.snapshotFingerprint, body.caseId))) throw reject(403);
    if (body.snapshotFingerprint !== result.snapshotFingerprint || !result.workbook ||
        body.caseId !== result.caseSelection.selectedCase.id) throw reject(409);
    if (!Array.isArray(body.changes) || body.changes.length > result.editableCells.length) throw reject(400);
    const used = new Set(), prepared = [], validationIssues = [];
    for (const change of body.changes) {
        if (!change || !A.equal(Object.keys(change).sort(), ['index', 'value']) || !Number.isInteger(change.index) || used.has(change.index)) throw reject(400);
        const entry = result.editableCells[change.index];
        if (!entry) throw reject(400);
        const cell = result.workbook.getWorksheet(entry.sheet).getCell(entry.cell);
        if (entry.caseId !== body.caseId || entry.sheet !== 'ΠΡΙΝ - ΜΕΤΑ' || cell.col !== 4 || cell.protection?.locked !== false) throw reject(400);
        try { prepared.push({ entry, cell, ...completedValue(entry, change.value, cell, editorChoices(entry, catalogs)) }); }
        catch (error) {
            if (entry.role !== 'ANSWER') throw error;
            validationIssues.push({ reason: entryType(entry) === 'Date' ? 'INVALID_TEMPORAL_DATE' :
                entryType(entry) === 'Number' ? 'INVALID_NUMERIC_PROFILE_FACT' : 'INVALID_EMPLOYMENT_PROFILE',
            field: entry.canonicalField, check: entryType(entry) === 'Date' ? 'INVALID_CALENDAR_DATE' : 'VALUE_REJECTED' });
        }
        used.add(change.index);
    }
    if (validationIssues.length) throw Object.assign(reject(400), { validationIssues });
    const candidateFor = entry => completionCandidate(result, prepared, entry);
    for (const change of prepared.filter(change => change.raw !== null && PARENT_FIELDS[change.entry.catalog])) {
        const parent = parentKeyForCatalog(change.entry.catalog, candidateFor(change.entry));
        if (!(catalogs[change.entry.catalog] || []).some(item => item.code === change.raw &&
            String(item[PARENT_FIELDS[change.entry.catalog]] || '') === parent)) throw reject(400);
    }
    return prepared;
}
function applyLocalCompletion(result, body, req, catalogs = {}) {
    const prepared = prepareLocalCompletion(result, body, req, catalogs);
    // Local export remains read-only. The separate approved-apply boundary owns writes.
    for (const change of prepared) {
        change.cell.value = change.display;
        result.workbook.getWorksheet('Ταυτοποίηση').addRow(['localCompletion', JSON.stringify({
            caseId: body.caseId, operation: change.entry.operation, targetHistoryId: change.entry.targetHistoryId,
            candidatePeriodId: change.entry.candidatePeriodId, confirmed: false, cell: change.cell.address, canonicalField: change.entry.canonicalField || change.entry.fieldId,
            value: change.raw, approval: false, importEnabled: false })]);
    }
    // Keep the local file's dependent dropdowns consistent with the edited parents.
    const lists = result.workbook.getWorksheet('Επιλογές');
    for (const [index, entry] of result.editableCells.entries()) {
        if (!entry.catalog || !prepared.some(change => change.entry.comparisonId === entry.comparisonId)) continue;
        const parentField = PARENT_FIELDS[entry.catalog], parent = parentKeyForCatalog(entry.catalog, completionCandidate(result, prepared, entry));
        const choices = editorChoices(entry, catalogs).filter(choice => !parentField || choice.parent === parent);
        const first = lists.rowCount + 1;
        for (const label of choices.length ? choices.map(choice => entry.storeCode ? choice.id : choice.label) : ['']) lists.addRow([label]);
        const name = `LOCAL_XLSX_OPTIONS_${index}`;
        result.workbook.definedNames.add(`'Επιλογές'!$A$${first}:$A$${lists.rowCount}`, name);
        const cell = result.workbook.getWorksheet(entry.sheet).getCell(entry.cell);
        cell.dataValidation = { ...cell.dataValidation, type: 'list', formulae: [name], showInputMessage: false };
    }
    return result;
}
function sendEditorFailure(res, error) {
    const status = [400, 401, 403, 404, 409].includes(error?.statusCode) ? error.statusCode : 500;
    const code = status === 409 ? 'EMPLOYEE_HISTORY_XLSX_STALE' : 'EMPLOYEE_HISTORY_XLSX_COMPLETION_FAILED';
    const reason = status === 409 ? 'Τα αρχικά στοιχεία άλλαξαν μετά το άνοιγμα της καρτέλας και η παραγωγή σταμάτησε για να διατηρηθούν οι συμπληρώσεις σας.' :
        status === 400 ? 'Κάποια συμπληρωμένη τιμή δεν επιτρέπεται ή δεν έχει την απαιτούμενη μορφή και η παραγωγή σταμάτησε.' :
            'Δεν επιβεβαιώθηκαν η πρόσβαση ή όλα τα απαιτούμενα στοιχεία και η παραγωγή σταμάτησε.';
    return res.status(status).json({ success: false, code, message: `Ζητήσατε αποθήκευση συμπληρωμένου XLSX. ${reason} Δεν αποθηκεύτηκε καμία αλλαγή στην εφαρμογή και δεν δημιουργήθηκε συμπληρωμένο αρχείο.\n1. Διατηρήστε ανοικτή αυτή την καρτέλα και ελέγξτε τις τιμές σας.\n2. ${status === 409 ? 'Ανοίξτε νέα πρόταση σε άλλη καρτέλα και μεταφέρετε τις συμπληρώσεις σας αφού συγκρίνετε τα νέα στοιχεία.' : 'Ελέγξτε τη σύνδεση, την εταιρεία και τις συμπληρωμένες τιμές. Αν το πρόβλημα παραμένει, επικοινωνήστε με τον διαχειριστή.'}\nΚωδικός αναφοράς: ${code}.` });
}
async function respondEmployeeHistoryProposal(req, res, input, catalogs, { loadImportProtection, loadSources = loadEditorSources, archiveAccess = async () => null } = {}) {
    res.set('Cache-Control', 'no-store');
    if (!input.approvedHistoryDecisions && input.historyAuditModel) input.approvedHistoryDecisions =
        await require('./employeeHistoryRowApprovalService').loadDecisions(input, input.historyAuditModel);
    if (!input.archiveAudits && input.historyAuditModel) input.archiveAudits =
        await require('./employeeHistoryArchiveStateService').loadArchives(input, input.historyAuditModel);
    if (req.path?.endsWith('/history-proposal-import-preview')) {
        const service=require('./employeeHistoryProposalImportService');
        try {
            const result=await service.previewEmployeeHistoryProposalImport({buffer:req.file?.buffer,input,catalogs,req,
                ...(loadImportProtection?{loadProtection:loadImportProtection}:{})});
            return res.json(result);
        } catch(error) {return service.sendImportFailure(res,error);}
    }
    try {
        const selection = req.query?.selection ?? '';
        if (req.method !== 'POST' && !req.path?.endsWith('/history-proposal-editor'))
            return await X.sendEmployeeHistoryProposalXlsx(res, input, catalogs, { selection });
        const result = await X.buildEmployeeHistoryProposalWorkbook(input, catalogs, { selection });
        if (req.method === 'POST') {
            applyLocalCompletion(result, req.body, req, catalogs);
            const buffer = await X.serializeEmployeeHistoryProposalWorkbook(result.workbook);
            res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.attachment(result.filename);
            return res.send(buffer);
        }
        const prefix = `/api/ergazomenoi/${encodeURIComponent(req.params.id)}`;
        const model = editorModel(result, catalogs, result.workbook ? await loadSources() : {});
        model.selection = selection;
        const selected = result.caseSelection.selectedCase;
        const original = input.completeHistoryRows.find(row => String(row._id) === selected?.targetHistoryId);
        model.archive = original ? await archiveAccess(req, input, original) : null;
        model.rowDecision = original ? require('./employeeHistoryProposalReadService').proposalHistoryState(input).decisions
            .find(audit => audit.diagnostics.targetHistoryId === String(original._id))?.diagnostics.rowApproval : null;
        model.pendingTotal = result.caseSelection.total;
        model.completedRows = result.caseSelection.completedRows || [];
        model.reviewFindings = (result.caseSelection.reviewFindings || []).map(finding => ({
            ...finding,
            sequence: input.completeHistoryRows.find(row =>
                String(row._id) === String(finding.approvedHistoryId))?.aa_eggrafhs || 'χωρίς αρίθμηση',
            fieldLabels: finding.fields.map(field => historyFieldLabels[field] || field)
        }));
        const activePending = result.caseSelection.cases.includes(selected);
        model.caseStateLabel = activePending ? 'Ανοιχτή περίπτωση' : model.rowDecision ? 'Εγκεκριμένη — Ολοκληρωμένη' :
            selected ? 'Επιλεγμένη εγγραφή' : 'Καμία ανοιχτή επεξεργάσιμη περίπτωση';
        const date = (value, empty = 'χωρίς λήξη') => value ? formatValue('hmeromhnia_allaghs_symbashs', value) : empty;
        model.activeLabel = selected && ['UPDATE','INSERT'].includes(selected.operation) ? `${selected.operation} · ${selected.operation === 'UPDATE' ?
            `Ιστορική εγγραφή ${original?.aa_eggrafhs || 'χωρίς αρίθμηση'}` : 'Ελλείπουσα περίοδος'} · ${date(selected.period.from, 'χωρίς καταγεγραμμένη έναρξη')} – ${date(selected.period.to)}` : selected ?
                `${selected.label} · ${date(selected.period.from, 'χωρίς καταγεγραμμένη έναρξη')} – ${date(selected.period.to)}` : 'Δεν έχει ανοίξει επεξεργάσιμη περίπτωση';
        model.choices = [
            ...result.caseSelection.cases.filter(item => item.operation === 'INSERT').map(item => ({
                value: `INSERT:${item.id}`, operation: 'INSERT', label: `Ελλείπουσα περίοδος ${item.period.from} – ${item.period.to || 'χωρίς λήξη'}` })),
            ...require('./employeeHistoryArchiveStateService').visibleRows(input, semanticHistoryRows(input.completeHistoryRows)).filter(row => ['team', 'company_kod', 'kodikos'].every(field => row[field] === input.scope[field]))
                .map(row => ({ value: `UPDATE:${String(row._id)}`, operation: 'UPDATE',
                    completed: model.completedRows.some(item => item.historyId === String(row._id)),
                    label: `Εγγραφή ${row.aa_eggrafhs || 'χωρίς αρίθμηση'} · ${formatValue('hmeromhnia_allaghs_symbashs', row.hmeromhnia_allaghs_symbashs)}` }))
        ];
        return require('../../controllers/ergazomenoi/employeeHistoryProposalEditorController').renderEmployeeHistoryProposalEditor(res, { layout: false,
            model, pageContext: editorContext(req, ''), snapshotFingerprint: result.snapshotFingerprint,
            editorContext: result.caseSelection.selectedCase ? editorContext(req, result.snapshotFingerprint, result.caseSelection.selectedCase.id) : '', csrfToken: res.locals.csrfToken || '',
            selectionUrl: `${prefix}/history-proposal-editor`,
            importUrl: `${prefix}/history-proposal-import-preview`,
            exportUrl: `${prefix}/history-proposal.xlsx${selection ? `?selection=${encodeURIComponent(selection)}` : ''}` });
    } catch (error) { return sendEditorFailure(res, error); }
}
module.exports = { respondEmployeeHistoryProposal, editorModel, applyLocalCompletion, prepareLocalCompletion, editorContext, sendEditorFailure,
    editorChoices, completedValue, loadEditorSources, presentationChoices };
