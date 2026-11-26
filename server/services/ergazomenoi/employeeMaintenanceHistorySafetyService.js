'use strict';

// The ordinary writer and deployment assessment share this read-only routing
// decision. A preserved legacy history is never certified CLEAN or repaired.
const { canonicalizeEmployeeHistory, CANONICAL_STATUSES } = require('./employeeHistoryCanonicalizationService');
const { planEmployeeMaintenanceHistory } = require('./employeeMaintenanceHistoryPlannerService');
const { STATES } = require('./employeeEmploymentProfileMutationResolverService');
const { semanticHistoryRows } = require('../../utils/ergazomenoi/employmentHistoryCanonicalStatus');
const { buildEmploymentCycles } = require('./employeeEmploymentCycleResolverService');

function inspectPersistedEmployeeMaintenanceHistory({ scope, currentEmployee, historyRows }) {
    if (!historyRows.length) return { preserveHistory: true, reason: 'HISTORY_COVERAGE_MISSING' };
    try {
        const canonical = canonicalizeEmployeeHistory({ scope, currentEmployee, historyRows });
        if (canonical.status !== CANONICAL_STATUSES.CLEAN || canonical.cleanupRequired)
            return { preserveHistory: true, reason: canonical.diagnostics?.reason || 'HISTORY_CLEANUP_REQUIRED' };
        const selected = planEmployeeMaintenanceHistory({ scope, currentEmployee,
            historyRows: semanticHistoryRows(historyRows), submittedState: {} });
        if (selected.state === STATES.CONFLICT || !selected.targetHistoryId)
            return { preserveHistory: true, reason: selected.responseCode || 'HISTORY_TARGET_MISSING' };
        buildEmploymentCycles({ currentEmployee, history: canonical.canonicalRows });
        return { preserveHistory: false, reason: null };
    } catch (error) {
        if (String(error.code || '').startsWith('EMPLOYEE_PROFILE_') ||
            String(error.code || '').startsWith('EMPLOYMENT_CYCLE_') ||
            error.code === 'INVALID_EMPLOYMENT_PROFILE' ||
            String(error.code || '').startsWith('CONFLICT_'))
            return { preserveHistory: true, reason: error.code };
        throw error;
    }
}
module.exports = { inspectPersistedEmployeeMaintenanceHistory };
