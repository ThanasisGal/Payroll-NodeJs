'use strict';

const A = require('./employeeHistoryAutomaticReconstructionApplyContract');
const C = require('./employeeHistoryAutomaticReconstructionContract');
const Row = require('./employeeHistoryRowApprovalService');
const Boundary = require('./employeeApprovedHistoryImmutableBoundaryService');
const { proposalHistoryState } = require('./employeeHistoryProposalReadService');

const id = row => String(row._id);
const source = row => Object.fromEntries(Object.entries(row || {})
    .filter(([field]) => field !== 'history_reference_fence'));

// Preserve Mongo scalar equality on dotted paths, including malformed array
// shapes. Such receipts still reach the original verifiers and fingerprints;
// grouping must not silently drop or certify any previously matched evidence.
function matchesAuditPredicate(document, predicate) {
    const matches = (value, parts, expected) => {
        if (!parts.length) return Array.isArray(value) ? value.some(item => item === expected) : value === expected;
        if (Array.isArray(value)) return value.some(item => matches(item, parts, expected));
        if (value == null) return false;
        return matches(value[parts[0]], parts.slice(1), expected);
    };
    return Object.entries(predicate).every(([field, value]) => matches(document, field.split('.'), value));
}

// Loaded only by the server, from the same snapshot as Employee and History.
// Missing audit support grants no exemptions (including injected test stores).
async function loadMaintenanceApprovalInput(input, auditModel, session) {
    if (!auditModel?.find) return null;
    const rowOperation = require('./employeeHistoryApprovedProposalContract').OPERATION;
    const rowPredicate = { mutationSource: rowOperation, 'diagnostics.rowApproval.version': Row.VERSION,
        'diagnostics.rowApproval.status': Row.STATUS };
    const boundaryPredicate = { mutationSource: Boundary.OPERATION, 'diagnostics.version': Boundary.WRITER_VERSION,
        'diagnostics.operation': 'NEW_CHANGE' };
    const Archive = require('./employeeHistoryArchiveStateService');
    const archivePredicate = { mutationSource: Archive.OPERATION, 'diagnostics.version': Archive.VERSION,
        'diagnostics.newState': Archive.STATUS };
    const audits = await auditModel.find({
        'employeeScope.team': input.scope.team,
        'employeeScope.company_kod': input.scope.company_kod,
        'employeeScope.kodikos': input.scope.kodikos,
        'employeeScope.employee_id': input.currentEmployee._id,
        $or: [rowPredicate, boundaryPredicate, archivePredicate]
    }).sort({ repairedAt: -1, _id: -1 }).session(session).lean();
    // Both original predicates and their ordering remain identical. Splitting
    // one ordered result does not confer approval; the existing verifiers do.
    const approvedHistoryDecisions = audits.filter(audit => matchesAuditPredicate(audit, rowPredicate));
    const atomicBoundaryAudits = audits.filter(audit => matchesAuditPredicate(audit, boundaryPredicate));
    return { ...input, approvedHistoryDecisions, atomicBoundaryAudits,
        archiveAudits: audits.filter(audit => matchesAuditPredicate(audit, archivePredicate)) };
}

function immutableFailure() {
    return require('./employeeHistorySaveValidationService').historySaveFailure({
        issues: [{ reason: 'APPROVED_HISTORY_CHANGED' }] });
}

function maintenanceHistoryState(input, historyRows = input?.completeHistoryRows,
    currentEmployee = input?.currentEmployee) {
    if (!input) return { historyRows, decisions: [], atomicBoundaries: [] };
    require('./employeeHistoryArchiveStateService').assertArchivesPreserved(input, historyRows);
    const before = proposalHistoryState(input);
    for (const audit of before.decisions) {
        const key = audit.diagnostics.targetHistoryId;
        const original = input.completeHistoryRows.find(row => id(row) === key);
        const candidate = historyRows.find(row => id(row) === key);
        if (!candidate || !A.equal(source(original), source(candidate))) throw immutableFailure();
    }
    return proposalHistoryState({ ...input, currentEmployee, completeHistoryRows: historyRows });
}

// Only the exact verified edition can skip completeness checks. A logical end
// introduced by a contiguous successor does not change that edition's facts;
// the physical write boundary still verifies the receipt and untouched source.
function approvedMaintenanceRows(input, historyRows) {
    if (!input) return new Set();
    const before = proposalHistoryState(input);
    const approvedIds = new Set(before.decisions.map(audit => audit.diagnostics.targetHistoryId));
    const approved = new Map(before.historyRows.filter(row => approvedIds.has(id(row)))
        .map(row => [id(row), row]));
    return new Set(historyRows.filter(row => {
        const original = approved.get(id(row));
        if (!original) return false;
        if (A.equal(source(original), source(row))) return true;
        if (original[C.END] != null || !row[C.END] ||
            !A.equal(source({ ...original, [C.END]: row[C.END] }), source(row))) return false;
        const end = +new Date(row[C.END]), start = +new Date(row[C.START]);
        return Number.isFinite(end) && end >= start && historyRows.some(next =>
            id(next) !== id(row) && A.equal(next[C.HIRE], row[C.HIRE]) &&
            +new Date(next[C.START]) === end + 86400000);
    }));
}

// Canonicalization normally synchronizes the latest period from Employee.
// An unchanged master value is not evidence against a verified correction
// edition. Use that edition only for this read-only comparison; actual master
// changes must still be reconciled, and neither stored document is rewritten.
function canonicalMaintenanceEmployee(input, historyRows, currentEmployee) {
    if (!input) return currentEmployee;
    const approved = approvedMaintenanceRows(input, historyRows);
    if (!approved.size) return currentEmployee;
    const { calendarDate } = require('../../utils/ergazomenoi/employmentProfileContract');
    const { semanticHistoryRows } = require('../../utils/ergazomenoi/employmentHistoryCanonicalStatus');
    const date = value => {
        try { return calendarDate(value)?.getTime() ?? null; }
        catch { return null; } // The existing aggregate validator reports invalid dates.
    };
    const hire = date(currentEmployee[C.HIRE]);
    const terminal = semanticHistoryRows(historyRows).filter(row => date(row[C.START]) !== null &&
        date(row[C.HIRE]) === hire).sort((a, b) => date(a[C.START]) - date(b[C.START])).at(-1);
    if (!terminal || !approved.has(terminal)) return currentEmployee;
    const schema = require('../../models/ergazomenoi').ErgazomenoiModel.schema;
    return { ...currentEmployee, ...Object.fromEntries(C.PROFILE_FIELDS.filter(field =>
        Object.hasOwn(currentEmployee, field) && schema.path(field) &&
        A.equal(schema.path(field).cast(currentEmployee[field]),
            schema.path(field).cast(input.currentEmployee[field])))
        .map(field => [field, terminal[field]])) };
}

// Projections are read models. Never feed approved contents or receipt-based
// period ends back into an UPDATE of their original physical documents.
function physicalMaintenanceRows(input, historyRows) {
    if (!input) return historyRows;
    const before = proposalHistoryState(input);
    const physical = new Map(input.completeHistoryRows.map(row => [id(row), row]));
    const projected = new Map(before.historyRows.map(row => [id(row), row]));
    const protectedIds = new Set([
        ...before.decisions.map(audit => audit.diagnostics.targetHistoryId),
        ...before.atomicBoundaries.map(boundary => boundary.priorHistoryId)
    ]);
    for (const key of protectedIds) if (!historyRows.some(row => id(row) === key)) throw immutableFailure();
    return historyRows.map(row => {
        if (!protectedIds.has(id(row))) return row;
        if (!A.equal(source(row), source(projected.get(id(row))))) throw immutableFailure();
        return physical.get(id(row));
    });
}

module.exports = { loadMaintenanceApprovalInput, maintenanceHistoryState,
    approvedMaintenanceRows, canonicalMaintenanceEmployee, physicalMaintenanceRows };
