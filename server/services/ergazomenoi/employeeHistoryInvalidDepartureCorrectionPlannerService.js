'use strict';

const C = require('../../utils/ergazomenoi/employmentProfileContract');
const {
    CANONICAL_STATUSES,
    isPersistedReferencedRedundant,
    calculateCanonicalDiff,
    canonicalizeEmployeeHistory
} = require('./employeeHistoryCanonicalizationService');
const { stableStringify, sha256 } = require('./employeeLegacyOpenCycleCleanupService');

const OPERATION = 'HISTORY_INVALID_DEPARTURE_CORRECTION';
const BLOCKER_REASON = 'EMPLOYMENT_CYCLE_DEPARTURE_BEFORE_HIRE';
const DEPARTURE_FIELD = 'hmeromhnia_apoxorhshs';
const SCOPE_FIELDS = Object.freeze(['team', 'company_kod', 'kodikos']);
const PLAN_STATUSES = Object.freeze({
    APPLYABLE: 'APPLYABLE',
    BLOCKED_NOT_DEPARTURE_BEFORE_HIRE: 'BLOCKED_NOT_DEPARTURE_BEFORE_HIRE',
    BLOCKED_TARGET_MISMATCH: 'BLOCKED_TARGET_MISMATCH',
    BLOCKED_COMPETING_DEPARTURE: 'BLOCKED_COMPETING_DEPARTURE',
    BLOCKED_CURRENT_CHANGE_REQUIRED: 'BLOCKED_CURRENT_CHANGE_REQUIRED',
    BLOCKED_REMAINING_AMBIGUITY: 'BLOCKED_REMAINING_AMBIGUITY',
    BLOCKED_OTHER: 'BLOCKED_OTHER'
});

function day(value) {
    return C.calendarDate(value)?.toISOString().slice(0, 10) || '';
}

function historyId(row = {}) {
    return row._id == null ? null : String(row._id);
}

function normalizedScope(scope = {}) {
    return Object.fromEntries(SCOPE_FIELDS.map(field =>
        [field, String(scope[field] ?? '').trim()]));
}

function fingerprinted(plan) {
    const input = {
        status: plan.status,
        reason: plan.reason,
        scope: plan.scope,
        currentEmployeeId: plan.currentEmployeeId,
        targetHistoryId: plan.targetHistoryId,
        previousDeparture: plan.previousDeparture,
        currentPatch: plan.currentPatch,
        desiredHistoryRows: plan.desiredHistoryRows,
        updateIds: plan.updateIds,
        survivingHistoryIds: plan.survivingHistoryIds,
        diagnostics: plan.diagnostics
    };
    return { ...plan, planFingerprint: sha256(input) };
}

function basePlan({ scope, currentEmployee, completeHistoryRows, targetHistoryId }) {
    return {
        status: PLAN_STATUSES.BLOCKED_OTHER,
        reason: 'EMPLOYEE_HISTORY_INVALID_DEPARTURE_CORRECTION_BLOCKED_OTHER',
        scope,
        currentEmployeeId: currentEmployee?._id == null ? null : String(currentEmployee._id),
        targetHistoryId,
        previousDeparture: day(currentEmployee?.[DEPARTURE_FIELD]) || null,
        currentPatch: {},
        desiredHistoryRows: [],
        updateIds: [],
        survivingHistoryIds: [],
        canonicalResult: null,
        finalCanonicalResult: null,
        diagnostics: {
            operation: OPERATION,
            blockerReason: null,
            currentHireDate: day(currentEmployee?.hmeromhnia_proslhpshs) || null,
            previousDeparture: day(currentEmployee?.[DEPARTURE_FIELD]) || null,
            newDeparture: null,
            currentEmployeeDepartureCleared: false,
            originalHistoryIds: completeHistoryRows.map(historyId).filter(Boolean).sort(),
            canonicalUpdateIds: [],
            survivingHistoryIds: [],
            secondPassIdempotent: false
        }
    };
}

function blocked(plan, status, reason, extraDiagnostics = {}) {
    return fingerprinted({ ...plan, status, reason,
        diagnostics: { ...plan.diagnostics, ...extraDiagnostics } });
}

function sameScope(record, scope) {
    return SCOPE_FIELDS.every(field => String(record?.[field] ?? '') === scope[field]);
}

function planEmployeeHistoryInvalidDepartureCorrection({ scope: rawScope, currentEmployee,
    completeHistoryRows = [], targetHistoryId: rawTargetHistoryId } = {}) {
    const scope = normalizedScope(rawScope);
    const targetHistoryId = String(rawTargetHistoryId ?? '').trim();
    const plan = basePlan({ scope, currentEmployee, completeHistoryRows, targetHistoryId });
    const currentBefore = stableStringify(currentEmployee || null);
    try {
        if (!currentEmployee || !Array.isArray(completeHistoryRows) || !targetHistoryId ||
            SCOPE_FIELDS.some(field => !scope[field]) || !sameScope(currentEmployee, scope) ||
            completeHistoryRows.some(row => !sameScope(row, scope))) {
            return blocked(plan, PLAN_STATUSES.BLOCKED_OTHER,
                'EMPLOYEE_HISTORY_INVALID_DEPARTURE_CORRECTION_INVALID_REQUEST');
        }

        const baseline = canonicalizeEmployeeHistory({ scope, currentEmployee,
            historyRows: completeHistoryRows });
        plan.diagnostics.blockerReason = baseline.diagnostics?.reason || null;
        const currentHire = day(currentEmployee.hmeromhnia_proslhpshs);
        const currentDeparture = day(currentEmployee[DEPARTURE_FIELD]);
        if (!currentHire || !currentDeparture || currentDeparture >= currentHire) {
            return blocked(plan, PLAN_STATUSES.BLOCKED_NOT_DEPARTURE_BEFORE_HIRE,
                'EMPLOYEE_HISTORY_INVALID_DEPARTURE_NOT_APPLICABLE');
        }

        const target = completeHistoryRows.find(row => historyId(row) === targetHistoryId);
        const implicated = new Set((baseline.diagnostics?.historyIds || []).map(String));
        if (!target || isPersistedReferencedRedundant(target) ||
            day(target.hmeromhnia_proslhpshs) !== currentHire ||
            day(target[DEPARTURE_FIELD]) !== currentDeparture) {
            return blocked(plan, PLAN_STATUSES.BLOCKED_TARGET_MISMATCH,
                'EMPLOYEE_HISTORY_INVALID_DEPARTURE_TARGET_MISMATCH');
        }

        const competingDepartureIds = completeHistoryRows
            .filter(row => !isPersistedReferencedRedundant(row) &&
                historyId(row) !== targetHistoryId &&
                day(row.hmeromhnia_proslhpshs) === currentHire &&
                day(row[DEPARTURE_FIELD]) &&
                day(row[DEPARTURE_FIELD]) !== currentDeparture)
            .map(historyId).filter(Boolean).sort();
        if (competingDepartureIds.length) {
            return blocked(plan, PLAN_STATUSES.BLOCKED_COMPETING_DEPARTURE,
                'EMPLOYEE_HISTORY_INVALID_DEPARTURE_COMPETING_DEPARTURE',
                { competingDepartureIds });
        }
        if (baseline.status !== CANONICAL_STATUSES.TRUE_AMBIGUITY ||
            baseline.diagnostics?.reason !== BLOCKER_REASON) {
            return blocked(plan, PLAN_STATUSES.BLOCKED_NOT_DEPARTURE_BEFORE_HIRE,
                'EMPLOYEE_HISTORY_INVALID_DEPARTURE_NOT_APPLICABLE');
        }
        if (!implicated.has(targetHistoryId)) {
            return blocked(plan, PLAN_STATUSES.BLOCKED_TARGET_MISMATCH,
                'EMPLOYEE_HISTORY_INVALID_DEPARTURE_TARGET_MISMATCH');
        }

        // MongoDB driver documents contain BSON ObjectId values. structuredClone()
        // turns them into plain objects, which destroys persisted row identity and
        // makes calculateCanonicalDiff() report a false delete. Only top-level
        // departure fields are changed here, so shallow copies preserve BSON and
        // Date identities without mutating the supplied records.
        const proposedCurrent = { ...currentEmployee };
        proposedCurrent[DEPARTURE_FIELD] = null;
        const proposedHistory = completeHistoryRows.map(row => {
            const copy = { ...row };
            if (historyId(row) === targetHistoryId) copy[DEPARTURE_FIELD] = null;
            return copy;
        });
        if (day(proposedCurrent.hmeromhnia_proslhpshs) !== currentHire ||
            stableStringify(currentEmployee) !== currentBefore) {
            return blocked(plan, PLAN_STATUSES.BLOCKED_CURRENT_CHANGE_REQUIRED,
                'EMPLOYEE_HISTORY_INVALID_DEPARTURE_CURRENT_CHANGE_REQUIRED');
        }

        const canonical = canonicalizeEmployeeHistory({ scope, currentEmployee: proposedCurrent,
            historyRows: proposedHistory });
        plan.canonicalResult = canonical;
        if (canonical.status === CANONICAL_STATUSES.TRUE_AMBIGUITY) {
            return blocked(plan, PLAN_STATUSES.BLOCKED_REMAINING_AMBIGUITY,
                'EMPLOYEE_HISTORY_INVALID_DEPARTURE_REMAINING_AMBIGUITY',
                { canonicalReason: canonical.diagnostics?.reason || null });
        }
        if (Object.keys(canonical.employeePatch || {}).length ||
            canonical.rowsToDelete?.length || canonical.rowsToInsert?.length) {
            return blocked(plan, PLAN_STATUSES.BLOCKED_CURRENT_CHANGE_REQUIRED,
                'EMPLOYEE_HISTORY_INVALID_DEPARTURE_CURRENT_CHANGE_REQUIRED');
        }

        const retainedArtifacts = proposedHistory.filter(isPersistedReferencedRedundant);
        const desiredHistoryRows = [...canonical.canonicalRows.map(row => ({ ...row })),
            ...retainedArtifacts.map(row => ({ ...row }))];
        const second = canonicalizeEmployeeHistory({ scope, currentEmployee: proposedCurrent,
            historyRows: desiredHistoryRows });
        plan.finalCanonicalResult = second;
        const secondPassIdempotent = second.status === CANONICAL_STATUSES.CLEAN &&
            second.cleanupRequired === false && second.idempotent === true &&
            stableStringify(second.canonicalRows) === stableStringify(canonical.canonicalRows);
        if (!secondPassIdempotent) {
            return blocked(plan, PLAN_STATUSES.BLOCKED_REMAINING_AMBIGUITY,
                'EMPLOYEE_HISTORY_INVALID_DEPARTURE_REMAINING_AMBIGUITY',
                { canonicalReason: second.diagnostics?.reason || 'FINAL_STATE_NOT_IDEMPOTENT' });
        }

        const diff = calculateCanonicalDiff(completeHistoryRows, desiredHistoryRows);
        const targetUpdate = diff.rowsToUpdate.find(item => item.historyId === targetHistoryId);
        const targetFields = Object.keys(targetUpdate?.patch || {});
        if (diff.rowsToDelete.length || diff.rowsToInsert.length || !targetUpdate ||
            diff.rowsToUpdate.length !== 1 || targetFields.length !== 1 ||
            targetFields[0] !== DEPARTURE_FIELD ||
            !Object.hasOwn(targetUpdate.patch, DEPARTURE_FIELD) ||
            targetUpdate.patch[DEPARTURE_FIELD] !== null) {
            return blocked(plan, PLAN_STATUSES.BLOCKED_OTHER,
                'EMPLOYEE_HISTORY_INVALID_DEPARTURE_CORRECTION_BLOCKED_OTHER');
        }

        plan.status = PLAN_STATUSES.APPLYABLE;
        plan.reason = 'EMPLOYEE_HISTORY_INVALID_DEPARTURE_CORRECTION_PLAN_READY';
        plan.currentPatch = { [DEPARTURE_FIELD]: null };
        plan.desiredHistoryRows = desiredHistoryRows;
        plan.updateIds = diff.rowsToUpdate.map(item => item.historyId).sort();
        plan.survivingHistoryIds = desiredHistoryRows.map(historyId).filter(Boolean).sort();
        plan.diagnostics.currentEmployeeDepartureCleared = true;
        plan.diagnostics.canonicalUpdateIds = [...plan.updateIds];
        plan.diagnostics.survivingHistoryIds = [...plan.survivingHistoryIds];
        plan.diagnostics.secondPassIdempotent = true;
        return fingerprinted(plan);
    } catch (error) {
        return blocked(plan, PLAN_STATUSES.BLOCKED_OTHER,
            'EMPLOYEE_HISTORY_INVALID_DEPARTURE_CORRECTION_BLOCKED_OTHER',
            { plannerException: error?.message || String(error) });
    }
}

module.exports = { OPERATION, BLOCKER_REASON, DEPARTURE_FIELD, PLAN_STATUSES,
    planEmployeeHistoryInvalidDepartureCorrection };
