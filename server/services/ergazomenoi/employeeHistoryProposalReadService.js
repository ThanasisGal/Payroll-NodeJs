'use strict';

// Proposal diagnostics only. Physical documents, write fences and the comparison
// table retain their existing readers. Reuse the operational proof, without I/O.
const { boundDecision } = require('./employeeHistoryOperationalReadService');
const Boundary = require('./employeeApprovedHistoryImmutableBoundaryService');

function proposalHistoryState(input) {
    const audits = [...(input.approvedHistoryDecisions || [])].sort((a, b) =>
        (+new Date(b.repairedAt) || 0) - (+new Date(a.repairedAt) || 0) || String(b._id).localeCompare(String(a._id)));
    const decisions = [];
    const historyRows = input.completeHistoryRows.map(original => {
        const audit = audits.find(candidate => boundDecision(candidate, original, input.currentEmployee));
        if (!audit) return original;
        decisions.push(audit);
        return { ...audit.diagnostics.rowApproval.approvedContent };
    });
    // Only server-owned, independently verified atomic boundary receipts can
    // close a predecessor logically. Physical rows and prior approvals stay as-is.
    const projected = Boundary.project({ scope:input.scope, currentEmployee:input.currentEmployee,
        physicalRows:input.completeHistoryRows, historyRows,
        atomicAudits:input.atomicBoundaryAudits || [], verifiedApprovals:decisions });
    return { historyRows:projected.historyRows, decisions,
        atomicBoundaries:projected.boundaries, atomicSuccessors:projected.successors };
}

module.exports = { proposalHistoryState };
