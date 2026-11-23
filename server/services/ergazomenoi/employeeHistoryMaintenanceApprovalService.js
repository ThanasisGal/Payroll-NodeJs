'use strict';

const A = require('./employeeHistoryAutomaticReconstructionApplyContract');
const C = require('./employeeHistoryAutomaticReconstructionContract');
const Row = require('./employeeHistoryRowApprovalService');
const Boundary = require('./employeeApprovedHistoryImmutableBoundaryService');
const { proposalHistoryState } = require('./employeeHistoryProposalReadService');

const id = row => String(row._id);
const source = row => Object.fromEntries(Object.entries(row || {})
    .filter(([field]) => field !== 'history_reference_fence'));

// Loaded only by the server, from the same snapshot as Employee and History.
// Missing audit support grants no exemptions (including injected test stores).
async function loadMaintenanceApprovalInput(input, auditModel, session) {
    if (!auditModel?.find) return null;
    const approvedHistoryDecisions = await Row.loadDecisions(input, auditModel, session);
    const atomicBoundaryAudits = await auditModel.find({
        'employeeScope.team': input.scope.team,
        'employeeScope.company_kod': input.scope.company_kod,
        'employeeScope.kodikos': input.scope.kodikos,
        'employeeScope.employee_id': input.currentEmployee._id,
        mutationSource: Boundary.OPERATION,
        'diagnostics.version': Boundary.WRITER_VERSION,
        'diagnostics.operation': 'NEW_CHANGE'
    }).sort({ repairedAt: -1, _id: -1 }).session(session).lean();
    return { ...input, approvedHistoryDecisions, atomicBoundaryAudits };
}

function immutableFailure() {
    return require('./employeeHistorySaveValidationService').historySaveFailure({
        issues: [{ reason: 'APPROVED_HISTORY_CHANGED' }] });
}

function maintenanceHistoryState(input, historyRows = input?.completeHistoryRows,
    currentEmployee = input?.currentEmployee) {
    if (!input) return { historyRows, decisions: [], atomicBoundaries: [] };
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
    approvedMaintenanceRows, physicalMaintenanceRows };
