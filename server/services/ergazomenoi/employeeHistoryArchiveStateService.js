'use strict';

// Management retirement lives in the existing immutable audit ledger. History
// BSON, approval editions, references and operational readers stay unchanged.
const A = require('./employeeHistoryAutomaticReconstructionApplyContract');
const C = require('./employeeHistoryAutomaticReconstructionContract');
const VERSION = 'employee-history-management-archive:v1';
const OPERATION = 'EMPLOYEE_HISTORY_MANAGEMENT_ARCHIVE';
const STATUS = 'ARCHIVED_MANAGEMENT';
const source = row => Object.fromEntries(Object.entries(row || {}).filter(([key]) => key !== 'history_reference_fence'));
const rowHash = row => A.hash(source(row));
const scopeFilter = input => Object.fromEntries(Object.entries({ ...input.scope, employee_id: input.currentEmployee._id })
    .map(([key, value]) => ['employeeScope.' + key, value]));
async function loadArchives(input, auditModel, session = null) {
    if (!auditModel?.find) return [];
    return auditModel.find({ ...scopeFilter(input), mutationSource: OPERATION,
        'diagnostics.version': VERSION, 'diagnostics.newState': STATUS })
        .sort({ repairedAt: -1, _id: -1 }).session(session).lean();
}
function archives(input) {
    return (input?.archiveAudits || []).filter(audit => audit.mutationSource === OPERATION &&
        audit.diagnostics?.version === VERSION && audit.diagnostics.newState === STATUS &&
        audit.diagnostics.outcome === 'COMMITTED' && audit.diagnostics.actorUserId &&
        String(audit.employeeScope?.employee_id) === String(input.currentEmployee?._id) &&
        ['team', 'company_kod', 'kodikos'].every(key => audit.employeeScope[key] === input.scope[key]));
}
function archivedIds(input) { return new Set(archives(input).map(audit => audit.diagnostics.targetHistoryId)); }
function visibleRows(input, rows = input.completeHistoryRows) {
    const ids = archivedIds(input);
    return rows.filter(row => !ids.has(String(row._id)));
}
function contextHash(input) {
    // Independent Employee contact fields and reference-fence increments are
    // not new employment facts. New terms/dates and other rows remain bound.
    return A.hash({ scope: input.scope, current: Object.fromEntries([...new Set([...C.PROFILE_FIELDS,
        ...C.FIELD_GROUPS.TEMPORAL_SEMANTIC])].map(key => [key, input.currentEmployee[key]])),
    rows: A.ordered(input.completeHistoryRows.map(source)) });
}
function findingHash(input, item) {
    return A.hash({ kind: item.kind, operation: item.operation, reasons: [...item.reasons].sort(), fields: [...item.fields].sort(),
        period: item.period, sources: [...item.sourceHistoryIds].sort().map(id => ({ id,
            hash: rowHash(input.completeHistoryRows.find(row => String(row._id) === id)) })),
        ...((item.reasons || []).some(reason => ['CURRENT_PROFILE_MISMATCH', 'ACTIVE_PERIOD_NOT_OPEN'].includes(reason))
            ? { current: Object.fromEntries(C.PROFILE_FIELDS.map(key => [key, input.currentEmployee[key]])) } : {}) });
}
function findingResolved(input, item) {
    const signature = findingHash(input, item);
    return archives(input).some(audit => audit.diagnostics.acceptedFindings.includes(signature) &&
        input.completeHistoryRows.some(row => String(row._id) === audit.diagnostics.targetHistoryId &&
            rowHash(row) === audit.diagnostics.originalRowHash));
}
function issueHash(issue, input) {
    const { from, until, sequence, ...finding } = issue;
    return A.hash({ ...finding, ...(['CURRENT_PROFILE_MISMATCH', 'ACTIVE_PERIOD_NOT_OPEN'].includes(issue.reason)
        ? { currentValue: input?.currentEmployee?.[issue.field || C.END] } : {}) });
}
function managementInspection(input, inspection) {
    const receipts = archives(input).filter(audit => input.completeHistoryRows.some(row =>
        String(row._id) === audit.diagnostics.targetHistoryId && rowHash(row) === audit.diagnostics.originalRowHash));
    if (!receipts.length || inspection.status === 'CLEAN') return inspection;
    const cases = require('./employeeHistoryProposalCaseService').selectEmployeeHistoryProposalCase(
        { ...input, archiveAudits: [] }, { status: 'REVIEW_REQUIRED' }).cases;
    const issues = inspection.issues.filter(issue => {
        if (issue.historyId) return !receipts.some(audit => audit.diagnostics.targetHistoryId === issue.historyId &&
            audit.diagnostics.acceptedIssues.includes(issueHash(issue, input)));
        const related = cases.filter(item => item.reasons.includes(issue.reason));
        if (related.length) return !related.every(item => findingResolved(input, item));
        // Unattributed diagnostics are retired only for the exact original
        // business context; they never grant a blanket waiver to new data.
        return !receipts.some(audit => audit.diagnostics.contextHash === contextHash(input) &&
            audit.diagnostics.acceptedIssues.includes(issueHash(issue, input)));
    });
    return { ...inspection, issues, status: issues.length ? inspection.status : 'MANAGEMENT_RESOLVED',
        accessMode: issues.length ? inspection.accessMode : 'NORMAL',
        managementResolved: !issues.length, historyCertified: false,
        archivedFindingCount: inspection.issues.length - issues.length };
}
function managementPreview(input) {
    if (!archives(input).length) return null;
    const selection = require('./employeeHistoryProposalCaseService').selectEmployeeHistoryProposalCase(
        input, { status: 'REVIEW_REQUIRED' });
    const remaining = selection.cases.length + (selection.reviewFindings || []).length;
    return { state: remaining ? 'unknown' : 'resolved', previewOnly: true, executionEnabled: false,
        questions: [], assumptions: [], actions: [], managementResolved: !remaining,
        historyStatus: remaining ? 'REVIEW_REQUIRED' : 'MANAGEMENT_RESOLVED',
        message: remaining
            ? `Παραμένουν ${remaining} ξεχωριστές περιπτώσεις Ιστορικού προς έλεγχο. Οι αρχειοθετημένες εγγραφές δεν αποτελούν εκκρεμότητα. Δεν αποθηκεύτηκε αλλαγή.\n1. Ανοίξτε την αντίστοιχη περίπτωση στον επεξεργαστή Ιστορικού.\n2. Ελέγξτε τα πραγματικά στοιχεία πριν εγκρίνετε νέα μεταβολή.\nΚωδικός αναφοράς: ΙΣΤ-ΑΡΧΕΙΟ-ΕΛΕΓΧΟΣ.`
            : 'Δεν υπάρχουν ανοιχτές εκκρεμότητες Ιστορικού. Οι αρχειοθετημένες εγγραφές διατηρούν την ιστορική ισχύ και τις αναφορές τους. Η αρχειοθέτηση δεν αποτελεί επιβεβαίωση της ορθότητας των τιμών.' };
}
const managementReady = inspection => ['CLEAN', 'MANAGEMENT_RESOLVED'].includes(inspection?.status);
function assertArchivesPreserved(input, rows) {
    for (const audit of archives(input)) {
        const original = input.completeHistoryRows.find(row => String(row._id) === audit.diagnostics.targetHistoryId);
        const after = rows.find(row => String(row._id) === audit.diagnostics.targetHistoryId);
        if (!original || !after || rowHash(after) !== rowHash(original)) throw Object.assign(
            new Error('EMPLOYEE_HISTORY_ARCHIVE_IMMUTABLE'), { code: 'EMPLOYEE_HISTORY_ARCHIVE_IMMUTABLE', statusCode: 409 });
    }
}
module.exports = { VERSION, OPERATION, STATUS, source, rowHash, scopeFilter, loadArchives, archives,
    archivedIds, visibleRows, contextHash, findingHash, findingResolved, issueHash, managementInspection,
    managementReady, managementPreview, assertArchivesPreserved };
