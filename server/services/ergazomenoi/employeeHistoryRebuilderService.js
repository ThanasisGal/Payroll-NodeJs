'use strict';

const {
    CANONICAL_STATUSES,
    DEFAULT_MAX_HISTORY_ROWS,
    PERIOD_IDENTITY_FIELDS,
    PERIOD_STATE_FIELDS,
    CURRENT_SYNC_FIELDS,
    isSparseHireLifecycleEvidence,
    calculateCanonicalDiff,
    canonicalizeEmployeeHistory
} = require('./employeeHistoryCanonicalizationService');

// Compatibility vocabulary for existing callers. All reconstruction and
// classification is owned by canonicalizeEmployeeHistory; this module contains
// no second history algorithm.
const REBUILD_STATUSES = Object.freeze({
    NO_CHANGE: 'NO_CHANGE',
    CLEAN: CANONICAL_STATUSES.CLEAN,
    AUTO_REPAIRABLE: CANONICAL_STATUSES.AUTO_REPAIRABLE,
    MANUAL_REVIEW_REQUIRED: 'MANUAL_REVIEW_REQUIRED'
});

function rebuildEmployeeHistory(options = {}) {
    const result = canonicalizeEmployeeHistory(options);
    if (result.status !== CANONICAL_STATUSES.TRUE_AMBIGUITY) return result;
    return { ...result, status: REBUILD_STATUSES.MANUAL_REVIEW_REQUIRED };
}

module.exports = {
    REBUILD_STATUSES,
    DEFAULT_MAX_HISTORY_ROWS,
    PERIOD_IDENTITY_FIELDS,
    PERIOD_STATE_FIELDS,
    CURRENT_SYNC_FIELDS,
    isSparseHireLifecycleEvidence,
    calculateCanonicalDiff,
    rebuildEmployeeHistory
};
