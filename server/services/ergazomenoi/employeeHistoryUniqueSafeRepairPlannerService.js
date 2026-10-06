'use strict';

const crypto = require('node:crypto');
const C = require('../../utils/ergazomenoi/employmentProfileContract');
const { effectiveStart } = require('../../utils/ergazomenoi/employmentProfileHistory');
const { REDUNDANT_STATUS_FIELD, REDUNDANT_SURVIVOR_FIELD, REDUNDANT_REFERENCED } =
    require('../../utils/ergazomenoi/employmentHistoryCanonicalStatus');
const { resolveEmploymentTypeSemantics } =
    require('../../utils/ergazomenoi/employmentTypeSemantics');
const { buildEmploymentCycles } = require('./employeeEmploymentCycleResolverService');
const { partitionHistoryUpdateReferences } =
    require('./employeeHistoryReferenceSemanticsService');
const { CANONICAL_STATUSES, PROFILE_EQUIVALENCE_FIELDS, calculateCanonicalDiff,
    canonicalizeEmployeeHistory } = require('./employeeHistoryCanonicalizationService');
const { AMBIGUITY_REASON: LIFECYCLE_REASON,
    PLAN_STATUSES: LIFECYCLE_STATUSES,
    planEmployeeHistoryLifecycleReclassification } =
    require('./employeeHistoryLifecycleReclassificationPlannerService');
const { REFERENCE_CLASSES } = require('./employeeHistoryResolutionAnalysisService');

const UNIQUE_SAFE_REPAIR_VERSION = 'employee-history-unique-safe-repair:v1';
const OPERATION = 'EMPLOYEE_HISTORY_UNIQUE_SAFE_REPAIR';
const PLAN_STATUSES = Object.freeze({
    APPLICABLE: 'APPLICABLE',
    NOT_APPLICABLE: 'NOT_APPLICABLE',
    BLOCKED: 'BLOCKED'
});
const PLAN_KINDS = Object.freeze({
    LIFECYCLE_FLAG_RECLASSIFICATION: 'LIFECYCLE_FLAG_RECLASSIFICATION',
    CORRECTED_SAME_DATE_REFERENCED_PROFILE: 'CORRECTED_SAME_DATE_REFERENCED_PROFILE'
});
const SCOPE_FIELDS = Object.freeze(['team', 'company_kod', 'kodikos']);
const DATE_FIELDS = new Set([
    'hmeromhnia_proslhpshs', 'hmeromhnia_allaghs_symbashs',
    'hmeromhnia_allaghs_orarioy_apo', 'hmeromhnia_allaghs_orarioy_eos',
    'hmeromhnia_isxyos_oron_ergasias_apo', 'hmeromhnia_isxyos_oron_ergasias_eos',
    'hmeromhnia_apoxorhshs'
]);
const CORROBORATED_PROFILE_FIELDS = Object.freeze([...new Set([
    ...PROFILE_EQUIVALENCE_FIELDS,
    'kathestos_apasxolhshs', 'typos_apasxolhshs', 'hmeromhnia_lhxhs_symbashs'
])].filter(field => !DATE_FIELDS.has(field) || field === 'hmeromhnia_lhxhs_symbashs'));

function stableValue(value) {
    if (Array.isArray(value)) return value.map(stableValue);
    if (!value || typeof value !== 'object') return value;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? String(value) : value.toISOString();
    if (typeof value.toHexString === 'function') return value.toHexString();
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, stableValue(value[key])]));
}

function stableStringify(value) { return JSON.stringify(stableValue(value)); }
function fingerprint(value) {
    return crypto.createHash('sha256').update(stableStringify(value)).digest('hex');
}
function day(value) { return C.calendarDate(value)?.toISOString().slice(0, 10) || ''; }
function historyId(row = {}) { return row._id == null ? '' : String(row._id); }
function meaningful(value) {
    return value !== undefined && value !== null && value !== '' &&
        (typeof value !== 'number' || Number.isFinite(value));
}
function equal(left, right) { return stableStringify(left) === stableStringify(right); }
function normalizedScope(scope = {}) {
    return Object.fromEntries(SCOPE_FIELDS.map(field =>
        [field, String(scope[field] ?? '').trim()]));
}
function rowOrder(row = {}) {
    const createdAt = row.createdAt ? new Date(row.createdAt).getTime() : NaN;
    const sequence = Number(row.aa_eggrafhs);
    return { createdAt, sequence };
}
function isStrictlyLater(left, right) {
    const a = rowOrder(left); const b = rowOrder(right);
    if (!Number.isFinite(a.createdAt) || !Number.isFinite(b.createdAt) ||
        !Number.isSafeInteger(a.sequence) || !Number.isSafeInteger(b.sequence)) return false;
    return a.createdAt > b.createdAt && a.sequence > b.sequence;
}

function referenceStateForRows(rows, summary, referencePartitioner) {
    const byId = {};
    let hasProvenance = false;
    for (const row of rows) {
        const id = historyId(row);
        if (!Object.hasOwn(summary || {}, id) || !Array.isArray(summary[id])) {
            return { referenceClass: REFERENCE_CLASSES.UNKNOWN_REFERENCE,
                byId, safeForUpdate: false, reason: 'REFERENCE_STATE_NOT_LOADED' };
        }
        let partitioned;
        try { partitioned = referencePartitioner(summary[id]); } catch {
            return { referenceClass: REFERENCE_CLASSES.UNKNOWN_REFERENCE,
                byId, safeForUpdate: false, reason: 'REFERENCE_SEMANTICS_UNKNOWN' };
        }
        if (partitioned.liveDereference.length) {
            return { referenceClass: REFERENCE_CLASSES.LIVE_REFERENCE,
                byId, safeForUpdate: false, reason: 'LIVE_REFERENCE_BLOCKS_REPAIR' };
        }
        const collections = [...new Set(partitioned.frozenProvenance
            .map(reference => String(reference.collection)))].sort();
        byId[id] = { count: partitioned.frozenProvenance.length, collections };
        if (collections.length) hasProvenance = true;
    }
    return { referenceClass: hasProvenance
        ? REFERENCE_CLASSES.PROVENANCE_ONLY : REFERENCE_CLASSES.NO_REFERENCES,
    byId, safeForUpdate: true, reason: null };
}

function basePlan({ scope, currentEmployee, completeHistoryRows, canonicalBefore }) {
    return {
        version: UNIQUE_SAFE_REPAIR_VERSION,
        status: PLAN_STATUSES.NOT_APPLICABLE,
        reason: canonicalBefore?.diagnostics?.reason || canonicalBefore?.status || 'NOT_APPLICABLE',
        operation: OPERATION,
        planKind: null,
        scope,
        currentPatch: {},
        desiredHistoryRows: [],
        historyPatches: {},
        changedHistoryIds: [],
        physicalDeleteIds: [],
        insertedRows: [],
        referenceClass: REFERENCE_CLASSES.UNKNOWN_REFERENCE,
        canonicalBefore,
        hypotheticalCanonicalResult: null,
        secondCanonicalResult: null,
        noOp: false,
        diagnostics: {
            currentEmployeeId: currentEmployee?._id == null ? null : String(currentEmployee._id),
            completeHistoryIds: completeHistoryRows.map(historyId).sort()
        }
    };
}

function finish(plan, status, reason, additions = {}) {
    const result = { ...plan, ...additions, status, reason };
    result.planFingerprint = fingerprint({
        version: result.version, status, reason, operation: result.operation,
        planKind: result.planKind, scope: result.scope, currentPatch: result.currentPatch,
        desiredHistoryRows: result.desiredHistoryRows,
        historyPatches: result.historyPatches, changedHistoryIds: result.changedHistoryIds,
        physicalDeleteIds: result.physicalDeleteIds, insertedRows: result.insertedRows,
        referenceClass: result.referenceClass, diagnostics: result.diagnostics
    });
    return result;
}
function blocked(plan, reason, diagnostics = {}) {
    return finish({ ...plan, diagnostics: { ...plan.diagnostics, ...diagnostics } },
        PLAN_STATUSES.BLOCKED, reason);
}

function lifecyclePlan({ plan, currentEmployee, completeHistoryRows,
    protectedReferenceSummary, referencePartitioner, canonicalizer }) {
    let cycles;
    try { cycles = buildEmploymentCycles({ currentEmployee, history: completeHistoryRows }); } catch (error) {
        return blocked(plan, error.code || 'EMPLOYMENT_CYCLE_UNRESOLVED');
    }
    if (cycles.length !== 1) return blocked(plan, 'EXACTLY_ONE_EMPLOYMENT_CYCLE_REQUIRED');
    const lifecycle = planEmployeeHistoryLifecycleReclassification({
        scope: plan.scope, currentEmployee, completeHistoryRows, protectedReferenceSummary,
        referencePartitioner, canonicalizer
    });
    if (lifecycle.status !== LIFECYCLE_STATUSES.APPLYABLE) {
        return blocked(plan, lifecycle.reason || lifecycle.status,
            { lifecycleStatus: lifecycle.status });
    }
    const refs = referenceStateForRows(completeHistoryRows, protectedReferenceSummary,
        referencePartitioner);
    if (!refs.safeForUpdate) return blocked(plan, refs.reason,
        { referenceClass: refs.referenceClass });
    if (Object.keys(lifecycle.currentPatch || {}).length || lifecycle.physicalDeleteIds.length ||
        lifecycle.insertedRows.length || !lifecycle.changedHistoryIds.length ||
        Object.values(lifecycle.historyPatches).some(patch =>
            Object.keys(patch).length !== 1 || patch.afora_proslhpsh !== false)) {
        return blocked(plan, 'LIFECYCLE_PLAN_EXCEEDS_FLAG_RECLASSIFICATION');
    }
    return finish({ ...plan,
        planKind: PLAN_KINDS.LIFECYCLE_FLAG_RECLASSIFICATION,
        currentPatch: {}, desiredHistoryRows: lifecycle.desiredHistoryRows.map(row => ({ ...row })),
        historyPatches: stableValue(lifecycle.historyPatches),
        changedHistoryIds: [...lifecycle.changedHistoryIds],
        referenceClass: refs.referenceClass,
        hypotheticalCanonicalResult: lifecycle.canonicalResult,
        secondCanonicalResult: lifecycle.secondCanonicalResult,
        diagnostics: { ...plan.diagnostics, referenceState: refs.byId,
            lifecyclePlanFingerprint: lifecycle.planFingerprint,
            cycleCount: cycles.length, finalLifecycleEvents: lifecycle.diagnostics.finalLifecycleEvents }
    }, PLAN_STATUSES.APPLICABLE, 'UNIQUE_LIFECYCLE_FLAG_RECLASSIFICATION');
}

function correctedProfilePlan({ plan, currentEmployee, completeHistoryRows,
    protectedReferenceSummary, referencePartitioner, canonicalizer }) {
    const conflictIds = [...new Set((plan.canonicalBefore?.diagnostics?.historyIds || [])
        .map(String))];
    if (conflictIds.length !== 2) return blocked(plan, 'EXACTLY_TWO_CONFLICTING_PROFILES_REQUIRED');
    const byId = new Map(completeHistoryRows.map(row => [historyId(row), row]));
    const candidates = conflictIds.map(id => byId.get(id));
    if (candidates.some(row => !row)) return blocked(plan, 'CONFLICT_SCOPE_NOT_COMPLETE');
    const candidateStart = day(effectiveStart(candidates[0]));
    if (new Set(candidates.map(row => day(row.hmeromhnia_proslhpshs))).size !== 1 ||
        new Set(candidates.map(row => day(effectiveStart(row)))).size !== 1 ||
        !candidateStart) {
        return blocked(plan, 'CONFLICTING_PROFILES_NOT_SAME_PERIOD');
    }
    let cycles;
    try { cycles = buildEmploymentCycles({ currentEmployee, history: completeHistoryRows }); } catch (error) {
        return blocked(plan, error.code || 'EMPLOYMENT_CYCLE_UNRESOLVED');
    }
    if (cycles.length !== 1) return blocked(plan, 'EXACTLY_ONE_EMPLOYMENT_CYCLE_REQUIRED');
    const departure = day(currentEmployee?.hmeromhnia_apoxorhshs);
    const hire = day(currentEmployee?.hmeromhnia_proslhpshs);
    if (!departure || departure < hire || currentEmployee?.energos !== false) {
        return blocked(plan, 'TERMINAL_CURRENT_STATE_REQUIRED');
    }
    const terminalRows = completeHistoryRows.filter(row => !conflictIds.includes(historyId(row)) &&
        day(row.hmeromhnia_proslhpshs) === hire && day(row.hmeromhnia_apoxorhshs) === departure &&
        day(effectiveStart(row)) === candidateStart &&
        row.afora_allagh_oron_ergasias === true &&
        candidates.every(candidate => isStrictlyLater(row, candidate)));
    if (terminalRows.length !== 1) return blocked(plan, 'UNIQUE_TERMINAL_PROFILE_EVIDENCE_REQUIRED');
    const terminal = terminalRows[0];

    const corroboratedFields = CORROBORATED_PROFILE_FIELDS.filter(field =>
        meaningful(currentEmployee[field]) && meaningful(terminal[field]) &&
        equal(currentEmployee[field], terminal[field]));
    const conflictingTerminalFields = CORROBORATED_PROFILE_FIELDS.filter(field =>
        meaningful(currentEmployee[field]) && meaningful(terminal[field]) &&
        !equal(currentEmployee[field], terminal[field]));
    if (conflictingTerminalFields.length || !corroboratedFields.length) {
        return blocked(plan, 'CURRENT_AND_TERMINAL_PROFILE_NOT_CORROBORATED',
            { conflictingTerminalFields });
    }
    const distinguishingFields = PROFILE_EQUIVALENCE_FIELDS.filter(field =>
        meaningful(candidates[0][field]) && meaningful(candidates[1][field]) &&
        !equal(candidates[0][field], candidates[1][field]));
    const typeKeys = candidates.map(row => resolveEmploymentTypeSemantics(row).comparisonKey);
    const typeDistinguishes = typeKeys.every(Boolean) && typeKeys[0] !== typeKeys[1];
    if (typeDistinguishes) distinguishingFields.push('__employmentType');
    if (!distinguishingFields.length) return blocked(plan, 'NO_CORROBORATABLE_PROFILE_DIFFERENCE');

    const agreesOnDifference = row => distinguishingFields.every(field => {
        if (field === '__employmentType') {
            const expected = resolveEmploymentTypeSemantics(currentEmployee).comparisonKey;
            const terminalExpected = resolveEmploymentTypeSemantics(terminal).comparisonKey;
            return expected && expected === terminalExpected &&
                resolveEmploymentTypeSemantics(row).comparisonKey === expected;
        }
        return meaningful(currentEmployee[field]) && meaningful(terminal[field]) &&
            equal(currentEmployee[field], terminal[field]) && equal(row[field], currentEmployee[field]);
    });
    const corroboratedCandidates = candidates.filter(agreesOnDifference);
    if (corroboratedCandidates.length !== 1) {
        return blocked(plan, 'SURVIVOR_NOT_UNIQUELY_CORROBORATED', { distinguishingFields });
    }
    const survivor = corroboratedCandidates[0];
    const loser = candidates.find(row => row !== survivor);
    if (!isStrictlyLater(survivor, loser)) {
        return blocked(plan, 'CORROBORATED_PROFILE_NOT_LATER_CORRECTION');
    }

    const refs = referenceStateForRows(completeHistoryRows, protectedReferenceSummary,
        referencePartitioner);
    if (!refs.safeForUpdate) return blocked(plan, refs.reason,
        { referenceClass: refs.referenceClass });
    if (!refs.byId[historyId(loser)]?.count) {
        return blocked(plan, 'LOSING_PROFILE_MUST_BE_PROVENANCE_REFERENCED');
    }

    const synchronized = { ...survivor };
    for (const field of corroboratedFields) synchronized[field] = currentEmployee[field];
    synchronized.hmeromhnia_isxyos_oron_ergasias_eos = C.calendarDate(departure);
    const retired = { ...loser,
        [REDUNDANT_STATUS_FIELD]: REDUNDANT_REFERENCED,
        [REDUNDANT_SURVIVOR_FIELD]: historyId(survivor) };
    const desiredHistoryRows = completeHistoryRows.map(row =>
        row === loser ? retired : row === survivor ? synchronized : { ...row });
    const currentEnd = day(currentEmployee.hmeromhnia_isxyos_oron_ergasias_eos);
    const currentPatch = currentEnd === departure ? {} : {
        hmeromhnia_isxyos_oron_ergasias_eos: C.calendarDate(departure)
    };
    const proposedCurrent = { ...currentEmployee, ...currentPatch };
    const canonical = canonicalizer({ scope: plan.scope, currentEmployee: proposedCurrent,
        historyRows: desiredHistoryRows });
    if (canonical.status !== CANONICAL_STATUSES.CLEAN || canonical.cleanupRequired ||
        !canonical.idempotent || canonical.rowsToDelete.length || canonical.rowsToInsert.length ||
        canonical.rowsToUpdate.length || Object.keys(canonical.employeePatch || {}).length) {
        return blocked(plan, 'HYPOTHETICAL_RESULT_NOT_STRICTLY_CLEAN',
            { hypotheticalReason: canonical.diagnostics?.reason || canonical.status });
    }
    const second = canonicalizer({ scope: plan.scope, currentEmployee: proposedCurrent,
        historyRows: desiredHistoryRows });
    if (second.status !== CANONICAL_STATUSES.CLEAN || second.cleanupRequired ||
        !second.idempotent || stableStringify(second.canonicalRows) !==
            stableStringify(canonical.canonicalRows)) {
        return blocked(plan, 'HYPOTHETICAL_RESULT_NOT_IDEMPOTENT');
    }
    const diff = calculateCanonicalDiff(completeHistoryRows, desiredHistoryRows);
    if (diff.rowsToDelete.length || diff.rowsToInsert.length || diff.rowsToUpdate.length < 2) {
        return blocked(plan, 'PHYSICAL_PLAN_REQUIRES_UNEXPECTED_MUTATION');
    }
    const historyPatches = Object.fromEntries(diff.rowsToUpdate.map(item =>
        [item.historyId, item.patch]));
    return finish({ ...plan,
        planKind: PLAN_KINDS.CORRECTED_SAME_DATE_REFERENCED_PROFILE,
        currentPatch, desiredHistoryRows, historyPatches,
        changedHistoryIds: diff.rowsToUpdate.map(item => item.historyId).sort(),
        referenceClass: refs.referenceClass,
        hypotheticalCanonicalResult: canonical, secondCanonicalResult: second,
        diagnostics: { ...plan.diagnostics, referenceState: refs.byId,
            cycleCount: cycles.length, survivorHistoryId: historyId(survivor),
            retiredHistoryId: historyId(loser), terminalHistoryId: historyId(terminal),
            distinguishingFields: distinguishingFields.sort(),
            synchronizedProfileFields: corroboratedFields.sort(), departure }
    }, PLAN_STATUSES.APPLICABLE, 'UNIQUE_CORRECTED_SAME_DATE_PROFILE');
}

function planEmployeeHistoryUniqueSafeRepair({ scope: rawScope, currentEmployee,
    completeHistoryRows = [], canonicalResult = null, protectedReferenceSummary = {},
    referencePartitioner = partitionHistoryUpdateReferences,
    canonicalizer = canonicalizeEmployeeHistory } = {}) {
    const scope = normalizedScope(rawScope);
    const canonicalBefore = canonicalResult || canonicalizer({ scope, currentEmployee,
        historyRows: completeHistoryRows });
    const plan = basePlan({ scope, currentEmployee, completeHistoryRows, canonicalBefore });
    if (!currentEmployee || !Array.isArray(completeHistoryRows) || !completeHistoryRows.length ||
        SCOPE_FIELDS.some(field => !scope[field] ||
            String(currentEmployee[field] ?? '') !== scope[field]) ||
        completeHistoryRows.some(row => !historyId(row) || SCOPE_FIELDS.some(field =>
            String(row[field] ?? '') !== scope[field])) ||
        new Set(completeHistoryRows.map(historyId)).size !== completeHistoryRows.length) {
        return blocked(plan, 'INVALID_OR_CONFLICTING_INPUT');
    }
    if (canonicalBefore.status === CANONICAL_STATUSES.CLEAN) {
        return finish({ ...plan, noOp: true, desiredHistoryRows: completeHistoryRows.map(row => ({ ...row })),
            referenceClass: REFERENCE_CLASSES.NO_REFERENCES,
            hypotheticalCanonicalResult: canonicalBefore, secondCanonicalResult: canonicalBefore },
        PLAN_STATUSES.NOT_APPLICABLE, 'ALREADY_CLEAN');
    }
    if (canonicalBefore.status !== CANONICAL_STATUSES.TRUE_AMBIGUITY) {
        return finish(plan, PLAN_STATUSES.NOT_APPLICABLE,
            canonicalBefore.diagnostics?.reason || canonicalBefore.status);
    }
    if (canonicalBefore.diagnostics?.reason === LIFECYCLE_REASON) {
        return lifecyclePlan({ plan, currentEmployee, completeHistoryRows,
            protectedReferenceSummary, referencePartitioner, canonicalizer });
    }
    if (canonicalBefore.diagnostics?.reason === 'CONFLICTING_PROFILE_EVENTS') {
        return correctedProfilePlan({ plan, currentEmployee, completeHistoryRows,
            protectedReferenceSummary, referencePartitioner, canonicalizer });
    }
    return finish(plan, PLAN_STATUSES.NOT_APPLICABLE,
        canonicalBefore.diagnostics?.reason || 'UNSUPPORTED_AMBIGUITY');
}

module.exports = { UNIQUE_SAFE_REPAIR_VERSION, OPERATION, PLAN_STATUSES, PLAN_KINDS,
    CORROBORATED_PROFILE_FIELDS, stableValue, fingerprint,
    planEmployeeHistoryUniqueSafeRepair };
