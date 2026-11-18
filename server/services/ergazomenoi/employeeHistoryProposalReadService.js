'use strict';

// Proposal diagnostics only. Physical documents, write fences and the comparison
// table retain their existing readers. Reuse the operational proof, without I/O.
const { boundDecision } = require('./employeeHistoryOperationalReadService');

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
    return { historyRows, decisions };
}

module.exports = { proposalHistoryState };
