'use strict';

const { CANONICAL_STATUSES, ROW_DISPOSITIONS, canonicalizeEmployeeHistory } =
    require('./employeeHistoryCanonicalizationService');

function historyId(value) {
    return value == null ? '' : String(value);
}

function baseResult(canonicalResult) {
    return {
        overallStatus: canonicalResult.status,
        overallReason: canonicalResult.diagnostics?.reason || null,
        problematicHistoryIds: [],
        problemReasonByHistoryId: {},
        deterministicallyResolved: true,
        canonicalResult
    };
}

function failClosed(result, reason = 'PROBLEM_SCOPE_UNRESOLVED') {
    return { ...result, problematicHistoryIds: [], problemReasonByHistoryId: {},
        deterministicallyResolved: false, problemScopeFailureReason: reason };
}

function identifyEmployeeHistoryProblemScope({ scope, currentEmployee,
    completeHistoryRows = [], canonicalizer = canonicalizeEmployeeHistory } = {}) {
    const canonical = canonicalizer({ scope, currentEmployee, historyRows: completeHistoryRows });
    const result = baseResult(canonical);
    if (canonical.status === CANONICAL_STATUSES.CLEAN) return result;

    const persistedIds = new Set(completeHistoryRows.map(row => historyId(row._id)).filter(Boolean));
    const reasons = new Map();
    const add = (id, reason) => {
        const normalized = historyId(id);
        if (normalized && persistedIds.has(normalized)) reasons.set(normalized, reason);
    };

    if (canonical.status === CANONICAL_STATUSES.AUTO_REPAIRABLE) {
        for (const item of canonical.classifications || []) {
            if (item.disposition === ROW_DISPOSITIONS.UPDATE ||
                (item.disposition === ROW_DISPOSITIONS.REDUNDANT && item.referenced !== true)) {
                add(item.historyId, item.disposition);
            }
        }
        for (const item of canonical.rowsToUpdate || []) add(item.historyId, ROW_DISPOSITIONS.UPDATE);
        for (const item of canonical.rowsToDelete || []) add(item.historyId, ROW_DISPOSITIONS.REDUNDANT);
        if (canonical.cleanupRequired && reasons.size === 0) {
            return failClosed(result, 'AUTO_REPAIRABLE_WITHOUT_IDENTIFIABLE_ROWS');
        }
    } else if (canonical.status === CANONICAL_STATUSES.TRUE_AMBIGUITY) {
        const reported = new Set([
            ...(canonical.diagnostics?.historyIds || []).map(historyId),
            ...(canonical.classifications || [])
                .filter(item => item.disposition === ROW_DISPOSITIONS.TRUE_AMBIGUITY)
                .map(item => historyId(item.historyId))
        ].filter(Boolean));
        if (!reported.size || [...reported].some(id => !persistedIds.has(id))) {
            return failClosed(result, 'TRUE_AMBIGUITY_WITHOUT_PERSISTED_ROW_SCOPE');
        }
        for (const id of reported) add(id, canonical.diagnostics?.reason || ROW_DISPOSITIONS.TRUE_AMBIGUITY);
    } else {
        return failClosed(result, 'UNKNOWN_CANONICAL_STATUS');
    }

    const problematicHistoryIds = [...reasons.keys()].sort();
    return { ...result, problematicHistoryIds,
        problemReasonByHistoryId: Object.fromEntries(problematicHistoryIds
            .map(id => [id, reasons.get(id)])) };
}

module.exports = { identifyEmployeeHistoryProblemScope };
