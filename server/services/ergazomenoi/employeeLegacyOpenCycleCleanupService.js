'use strict';

const crypto = require('node:crypto');
const C = require('../../utils/ergazomenoi/employmentProfileContract');
const { LEGACY_OPEN_CYCLE_CLEANUP_FOUNDATION_SOURCE: FOUNDATION_SOURCE } =
    require('../../constants/employeeLegacyOpenCycleCleanup');
const {
    CANONICAL_STATUSES,
    isPersistedReferencedRedundant,
    canonicalizeEmployeeHistory
} = require('./employeeHistoryCanonicalizationService');

const PLAN_STATUSES = Object.freeze({
    APPLYABLE: 'APPLYABLE',
    BLOCKED_REMAINING_AMBIGUITY: 'BLOCKED_REMAINING_AMBIGUITY',
    BLOCKED_CURRENT_CHANGE_REQUIRED: 'BLOCKED_CURRENT_CHANGE_REQUIRED',
    BLOCKED_OTHER: 'BLOCKED_OTHER'
});
const SCOPE_FIELDS = Object.freeze(['team', 'company_kod', 'kodikos']);

function day(value) {
    return C.calendarDate(value)?.toISOString().slice(0, 10) || '';
}

function normalized(value) {
    if (value === undefined) return { $undefined: true };
    if (value === null) return null;
    if (value instanceof Date) return { $date: value.toISOString() };
    if (value && typeof value.toHexString === 'function') return { $oid: value.toHexString() };
    if (value?.buffer instanceof Uint8Array && value.buffer.length === 12) {
        return { $oid: Buffer.from(value.buffer).toString('hex') };
    }
    if (Array.isArray(value)) return value.map(normalized);
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.keys(value).sort().map(key => [key, normalized(value[key])]));
    }
    return value;
}

function stableStringify(value) {
    return JSON.stringify(normalized(value));
}

function sha256(value) {
    return crypto.createHash('sha256').update(stableStringify(value)).digest('hex');
}

function historyId(row = {}) {
    return row._id == null ? null : String(row._id);
}

function scopeValue(scope = {}) {
    return Object.fromEntries(SCOPE_FIELDS.map(field => [field, String(scope[field] ?? '').trim()]));
}

function validScope(scope) {
    return SCOPE_FIELDS.every(field => scope[field]);
}

function rowsEqual(left = [], right = []) {
    return stableStringify(left) === stableStringify(right);
}

function foundationSequence(rows = []) {
    const latest = Math.max(0, ...rows.map(row => Number(row.aa_eggrafhs))
        .filter(Number.isSafeInteger));
    return String(latest + 1).padStart(4, '0');
}

function minimalCurrentHireFoundation(scope, currentEmployee, rows) {
    return {
        _id: sha256({ scope, currentEmployeeId: String(currentEmployee._id),
            currentHireDate: day(currentEmployee.hmeromhnia_proslhpshs),
            source: FOUNDATION_SOURCE }).slice(0, 24),
        ...scope,
        aa_eggrafhs: foundationSequence(rows),
        hmeromhnia_proslhpshs: currentEmployee.hmeromhnia_proslhpshs,
        afora_proslhpsh: true,
        afora_allagh_oron_ergasias: false,
        employment_profile_source: FOUNDATION_SOURCE
    };
}

function basePlan({ scope, currentEmployee, completeHistoryRows }) {
    return {
        status: PLAN_STATUSES.BLOCKED_OTHER,
        reason: 'UNPLANNED',
        scope,
        currentEmployeeId: currentEmployee?._id == null ? null : String(currentEmployee._id),
        currentEmployeeFingerprint: sha256(currentEmployee || null),
        historyInputFingerprint: sha256(completeHistoryRows || []),
        desiredHistoryRows: [],
        policyRemovedHistoryIds: [],
        canonicalRemovedHistoryIds: [],
        updatedHistoryIds: [],
        preservedHistoryIds: [],
        insertedFoundationRows: [],
        replacementByDeletedId: {},
        canonicalResult: null,
        finalCanonicalResult: null,
        diagnostics: {
            corruptedCycleHireDates: [],
            closedCycleHireDates: [],
            currentHireDate: null,
            originalHistoryIds: (completeHistoryRows || []).map(historyId).filter(Boolean),
            currentEmployeeUnchanged: true,
            secondPassIdempotent: false
        }
    };
}

function finalizeFingerprint(plan) {
    const fingerprintInput = {
        status: plan.status,
        reason: plan.reason,
        scope: plan.scope,
        currentEmployeeId: plan.currentEmployeeId,
        currentEmployeeFingerprint: plan.currentEmployeeFingerprint,
        historyInputFingerprint: plan.historyInputFingerprint,
        policyRemovedHistoryIds: plan.policyRemovedHistoryIds,
        canonicalRemovedHistoryIds: plan.canonicalRemovedHistoryIds,
        updatedHistoryIds: plan.updatedHistoryIds,
        preservedHistoryIds: plan.preservedHistoryIds,
        insertedFoundationRows: plan.insertedFoundationRows,
        desiredHistoryRows: plan.desiredHistoryRows,
        replacementByDeletedId: plan.replacementByDeletedId,
        diagnostics: plan.diagnostics
    };
    return { ...plan, planFingerprint: sha256(fingerprintInput) };
}

function blocked(plan, status, reason, extra = {}) {
    return finalizeFingerprint({ ...plan, ...extra, status, reason });
}

function planEmployeeLegacyOpenCycleCleanup({ scope: rawScope, currentEmployee,
    completeHistoryRows = [] } = {}) {
    const scope = scopeValue(rawScope);
    const plan = basePlan({ scope, currentEmployee, completeHistoryRows });
    const currentBefore = stableStringify(currentEmployee || null);
    try {
        if (!validScope(scope) || !currentEmployee || !Array.isArray(completeHistoryRows)) {
            return blocked(plan, PLAN_STATUSES.BLOCKED_OTHER, 'INVALID_PLANNER_INPUT');
        }
        if (SCOPE_FIELDS.some(field => String(currentEmployee[field] ?? '') !== scope[field]) ||
            completeHistoryRows.some(row => SCOPE_FIELDS.some(field =>
                String(row[field] ?? '') !== scope[field]))) {
            return blocked(plan, PLAN_STATUSES.BLOCKED_OTHER, 'CONFLICT_SCOPE');
        }
        const currentHireDate = day(currentEmployee.hmeromhnia_proslhpshs);
        plan.diagnostics.currentHireDate = currentHireDate;
        if (!currentHireDate) {
            return blocked(plan, PLAN_STATUSES.BLOCKED_CURRENT_CHANGE_REQUIRED,
                'AUTHORITATIVE_CURRENT_HIRE_MISSING');
        }

        const referencedArtifacts = completeHistoryRows.filter(isPersistedReferencedRedundant)
            .map(row => ({ ...row }));
        const activeRows = completeHistoryRows.filter(row => !isPersistedReferencedRedundant(row));
        const rowsByHire = new Map();
        for (const row of activeRows) {
            const hire = day(row.hmeromhnia_proslhpshs);
            if (!hire) continue;
            if (!rowsByHire.has(hire)) rowsByHire.set(hire, []);
            rowsByHire.get(hire).push(row);
        }
        const hireDates = [...new Set([...rowsByHire.keys(), currentHireDate])].sort();
        const corruptedHireDates = [];
        const closedHireDates = [];
        const policyRemoved = new Set();
        const closedDepartureByHire = new Map();
        for (const hire of hireDates) {
            const rows = rowsByHire.get(hire) || [];
            const departures = [...new Set(rows.map(row => day(row.hmeromhnia_apoxorhshs))
                .filter(Boolean))];
            if (departures.length) {
                closedHireDates.push(hire);
                closedDepartureByHire.set(hire, departures);
                continue;
            }
            const isCurrent = hire === currentHireDate;
            const followedByLaterHire = hireDates.some(candidate => candidate > hire);
            if (!isCurrent && followedByLaterHire) {
                corruptedHireDates.push(hire);
                for (const row of rows) if (historyId(row)) policyRemoved.add(historyId(row));
            }
        }
        plan.diagnostics.corruptedCycleHireDates = corruptedHireDates;
        plan.diagnostics.closedCycleHireDates = closedHireDates;
        plan.policyRemovedHistoryIds = [...policyRemoved].sort();

        const policySurvivors = activeRows.filter(row => !policyRemoved.has(historyId(row)))
            .map(row => ({ ...row }));
        const currentHireRepresented = policySurvivors.some(row =>
            day(row.hmeromhnia_proslhpshs) === currentHireDate);
        const insertedFoundationRows = currentHireRepresented ? [] : [
            minimalCurrentHireFoundation(scope, currentEmployee, [
                ...policySurvivors, ...referencedArtifacts
            ])
        ];
        plan.insertedFoundationRows = insertedFoundationRows;
        const proposedSemanticRows = [...policySurvivors, ...insertedFoundationRows];
        const canonical = canonicalizeEmployeeHistory({ scope, currentEmployee,
            historyRows: proposedSemanticRows });
        plan.canonicalResult = canonical;
        if (stableStringify(currentEmployee) !== currentBefore ||
            Object.keys(canonical.employeePatch || {}).length) {
            plan.diagnostics.currentEmployeeUnchanged = false;
            return blocked(plan, PLAN_STATUSES.BLOCKED_CURRENT_CHANGE_REQUIRED,
                'CANONICAL_CURRENT_CHANGE_REQUIRED');
        }
        if (canonical.status === CANONICAL_STATUSES.TRUE_AMBIGUITY) {
            return blocked(plan, PLAN_STATUSES.BLOCKED_REMAINING_AMBIGUITY,
                canonical.diagnostics?.reason || 'TRUE_AMBIGUITY', {
                    desiredHistoryRows: [...proposedSemanticRows, ...referencedArtifacts]
                });
        }

        const finalSemanticRows = canonical.canonicalRows.map(row => ({ ...row }));
        for (const [hire, departures] of closedDepartureByHire) {
            const preserved = departures.every(departure => finalSemanticRows.some(row =>
                day(row.hmeromhnia_proslhpshs) === hire &&
                day(row.hmeromhnia_apoxorhshs) === departure));
            if (!preserved) {
                return blocked(plan, PLAN_STATUSES.BLOCKED_OTHER,
                    'EXPLICITLY_CLOSED_CYCLE_NOT_PRESERVED');
            }
        }
        if (!finalSemanticRows.some(row => day(row.hmeromhnia_proslhpshs) === currentHireDate)) {
            return blocked(plan, PLAN_STATUSES.BLOCKED_OTHER,
                'CURRENT_HIRE_NOT_REPRESENTED');
        }
        const finalCompleteRows = [...finalSemanticRows, ...referencedArtifacts];
        const second = canonicalizeEmployeeHistory({ scope, currentEmployee,
            historyRows: finalCompleteRows });
        plan.finalCanonicalResult = second;
        const secondPassIdempotent = second.status !== CANONICAL_STATUSES.TRUE_AMBIGUITY &&
            second.cleanupRequired === false && second.idempotent === true &&
            rowsEqual(second.canonicalRows, finalSemanticRows);
        plan.diagnostics.secondPassIdempotent = secondPassIdempotent;
        if (!secondPassIdempotent) {
            return blocked(plan, PLAN_STATUSES.BLOCKED_OTHER,
                'FINAL_CANONICAL_STATE_NOT_IDEMPOTENT');
        }

        const desiredExistingIds = new Set(finalCompleteRows.map(historyId).filter(Boolean));
        const policySurvivorIds = new Set(policySurvivors.map(historyId).filter(Boolean));
        const canonicalRemovedHistoryIds = canonical.rowsToDelete.map(item => item.historyId)
            .filter(id => policySurvivorIds.has(id)).sort();
        plan.desiredHistoryRows = finalCompleteRows;
        plan.canonicalRemovedHistoryIds = canonicalRemovedHistoryIds;
        plan.updatedHistoryIds = canonical.rowsToUpdate.map(item => item.historyId).sort();
        plan.preservedHistoryIds = completeHistoryRows.map(historyId).filter(id =>
            id && desiredExistingIds.has(id)).sort();
        plan.replacementByDeletedId = { ...canonical.replacementByDeletedId };
        plan.status = PLAN_STATUSES.APPLYABLE;
        plan.reason = 'LEGACY_OPEN_CYCLE_POLICY_PLAN_READY';
        plan.diagnostics.currentEmployeeUnchanged = stableStringify(currentEmployee) === currentBefore;
        return finalizeFingerprint(plan);
    } catch (error) {
        return blocked(plan, PLAN_STATUSES.BLOCKED_OTHER,
            error?.code || error?.message || 'PLANNER_EXCEPTION', {
                diagnostics: { ...plan.diagnostics, plannerException: error?.message || String(error) }
            });
    }
}

module.exports = {
    PLAN_STATUSES,
    FOUNDATION_SOURCE,
    stableStringify,
    sha256,
    planEmployeeLegacyOpenCycleCleanup
};
