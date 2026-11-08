'use strict';

const { canonicalizeEmployeeHistory, settleProvenHistoryDuplicates } =
    require('./employeeHistoryCanonicalizationService');

// A selected proposal is checked as the complete physical history, including
// every retired original. Only the existing original-payload duplicate proof
// may add retirements; normalization is never used to manufacture that proof.
function inspectFinalEmployeeHistoryProposal({ scope, currentEmployee,
    desiredHistoryRows, completeHistoryRows, canonicalizer = canonicalizeEmployeeHistory }) {
    const settled = settleProvenHistoryDuplicates({ scope, currentEmployee,
        historyRows: desiredHistoryRows, requiredHistoryRows: completeHistoryRows });
    const rows = settled.rows;
    const canonical = canonicalizer({ scope, currentEmployee, historyRows: rows,
        strictProfileEvidence: true });
    const inspection = require('./employeeHistorySaveValidationService')
        .inspectEmployeeHistorySave({ scope, currentEmployee, historyRows: rows });
    return { status: !settled.reason && inspection.status === 'CLEAN' ? 'CLEAN' : 'REVIEW_REQUIRED',
        rows, canonical, inspection, duplicateRetirements: settled.retirements,
        reason: settled.reason || inspection.issues[0]?.reason || null };
}

module.exports = { inspectFinalEmployeeHistoryProposal };
