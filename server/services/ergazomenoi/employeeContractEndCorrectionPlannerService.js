'use strict';

const crypto = require('node:crypto');
const C = require('../../utils/ergazomenoi/employmentProfileContract');
const { effectiveStart } = require('../../utils/ergazomenoi/employmentProfileHistory');
const { CANONICAL_STATUSES, canonicalizeEmployeeHistory } =
    require('./employeeHistoryCanonicalizationService');
const { isSparseHireLifecycleEvidence } = require('./employeeHistoryRebuilderService');
const { partitionHistoryUpdateReferences } =
    require('./employeeHistoryReferenceSemanticsService');
const { stableStringify } = require('./employeeLegacyOpenCycleCleanupService');

const OPERATION = 'HISTORY_CONTRACT_END_SEGMENT_SYNC';
const CONTRACT_END_FIELD = 'hmeromhnia_lhxhs_symbashs';
const HIRE_FIELD = 'hmeromhnia_proslhpshs';
const SEGMENT_START_FIELD = 'hmeromhnia_allaghs_symbashs';

const PLAN_STATUSES = Object.freeze({
    APPLYABLE: 'APPLYABLE',
    APPLYABLE_PARTIAL_SEGMENT_SYNC: 'APPLYABLE_PARTIAL_SEGMENT_SYNC',
    NO_OP: 'NO_OP',
    BLOCKED_INVALID_DATE: 'BLOCKED_INVALID_DATE',
    BLOCKED_SCOPE: 'BLOCKED_SCOPE',
    BLOCKED_CYCLE_AMBIGUITY: 'BLOCKED_CYCLE_AMBIGUITY',
    BLOCKED_SEGMENT_AMBIGUITY: 'BLOCKED_SEGMENT_AMBIGUITY',
    BLOCKED_INCONSISTENT_SEGMENT: 'BLOCKED_INCONSISTENT_SEGMENT',
    BLOCKED_REFERENCE: 'BLOCKED_REFERENCE',
    BLOCKED_FINAL_CANONICAL: 'BLOCKED_FINAL_CANONICAL'
});

function day(value) {
    return C.calendarDate(value)?.toISOString().slice(0, 10) || null;
}

function sameScope(scope, record) {
    return ['team', 'company_kod', 'kodikos'].every(field =>
        String(scope?.[field] ?? '') === String(record?.[field] ?? ''));
}

function fingerprint(value) {
    return crypto.createHash('sha256').update(stableStringify(value)).digest('hex');
}

function blocked(status, reason, diagnostics = {}) {
    return {
        operation: OPERATION,
        status,
        reason,
        currentPatch: {},
        historyPatches: {},
        changedHistoryIds: [],
        unchangedHistoryIds: [],
        targetSegmentHistoryIds: [],
        desiredHistoryRows: [],
        planFingerprint: null,
        finalCanonical: null,
        cleanupRequired: false,
        idempotent: false,
        diagnostics
    };
}

function latestCanonicalProfileId(canonicalRows, hire, segmentStart) {
    const candidates = canonicalRows.filter(row =>
        day(row[HIRE_FIELD]) === hire && day(row[SEGMENT_START_FIELD]) === segmentStart &&
        !isSparseHireLifecycleEvidence(row) && effectiveStart(row));
    if (!candidates.length) return null;
    const latestTime = Math.max(...candidates.map(row => effectiveStart(row).getTime()));
    const latest = candidates.filter(row => effectiveStart(row).getTime() === latestTime);
    return latest.length === 1 ? String(latest[0]._id) : null;
}

function planEmployeeContractEndCorrection({
    scope,
    currentEmployee,
    completeHistoryRows = [],
    requestedContractEnd,
    protectedReferences = {},
    referencePartitioner = partitionHistoryUpdateReferences
} = {}) {
    if (!scope || !['team', 'company_kod', 'kodikos'].every(field =>
        String(scope[field] ?? '').trim()) || !currentEmployee || !sameScope(scope, currentEmployee) ||
        completeHistoryRows.some(row => !sameScope(scope, row))) {
        return blocked(PLAN_STATUSES.BLOCKED_SCOPE, 'CONTRACT_SEGMENT_SCOPE_MISMATCH');
    }
    const requested = day(requestedContractEnd);
    const hire = day(currentEmployee[HIRE_FIELD]);
    const segmentStart = day(currentEmployee[SEGMENT_START_FIELD]);
    if (!requested || !hire || !segmentStart || requested < segmentStart) {
        return blocked(PLAN_STATUSES.BLOCKED_INVALID_DATE,
            'CONTRACT_END_OR_SEGMENT_DATE_INVALID', { hire, segmentStart, requestedContractEnd: requested });
    }

    const cycleRows = completeHistoryRows.filter(row => day(row[HIRE_FIELD]) === hire);
    if (!cycleRows.length) {
        return blocked(PLAN_STATUSES.BLOCKED_CYCLE_AMBIGUITY,
            'CURRENT_EMPLOYMENT_CYCLE_NOT_FOUND', { hire, segmentStart });
    }
    const rowsMissingSegmentIdentity = cycleRows.filter(row => !day(row[SEGMENT_START_FIELD]));
    if (rowsMissingSegmentIdentity.length) {
        return blocked(PLAN_STATUSES.BLOCKED_SEGMENT_AMBIGUITY,
            'CURRENT_CYCLE_CONTAINS_UNOWNED_CONTRACT_ROWS', {
                historyIds: rowsMissingSegmentIdentity.map(row => String(row._id)).sort()
            });
    }
    const segmentRows = cycleRows.filter(row => day(row[SEGMENT_START_FIELD]) === segmentStart);
    if (!segmentRows.length) {
        return blocked(PLAN_STATUSES.BLOCKED_SEGMENT_AMBIGUITY,
            'CURRENT_CONTRACT_SEGMENT_NOT_FOUND', { hire, segmentStart });
    }
    // A sparse hire anchor proves lifecycle identity, not a mutable work-terms
    // snapshot. Keep it untouched when the segment also has recorded profiles.
    const recordedSegmentRows = segmentRows.filter(row => !isSparseHireLifecycleEvidence(row));
    const mutableSegmentRows = recordedSegmentRows.length ? recordedSegmentRows : segmentRows;

    const canonicalBefore = canonicalizeEmployeeHistory({ scope, currentEmployee,
        historyRows: completeHistoryRows });
    if (canonicalBefore.status === CANONICAL_STATUSES.TRUE_AMBIGUITY) {
        return blocked(PLAN_STATUSES.BLOCKED_SEGMENT_AMBIGUITY,
            'CURRENT_HISTORY_CANONICAL_AMBIGUITY', {
                canonicalReason: canonicalBefore.diagnostics?.reason || null
            });
    }
    const latestProfileId = latestCanonicalProfileId(
        canonicalBefore.canonicalRows || completeHistoryRows, hire, segmentStart);
    const latestPhysicalProfile = mutableSegmentRows.find(row => String(row._id) === latestProfileId);
    if (!latestProfileId || !latestPhysicalProfile) {
        return blocked(PLAN_STATUSES.BLOCKED_SEGMENT_AMBIGUITY,
            'CURRENT_CONTRACT_SEGMENT_PROFILE_NOT_UNIQUE', { hire, segmentStart });
    }

    const currentValue = day(currentEmployee[CONTRACT_END_FIELD]);
    const latestProfileValue = day(latestPhysicalProfile[CONTRACT_END_FIELD]);
    const physicalValues = [...new Set(mutableSegmentRows.map(row => day(row[CONTRACT_END_FIELD])))]
        .sort((left, right) => String(left).localeCompare(String(right)));
    const segmentAlreadyConsistent = physicalValues.length === 1;
    const authoritativeValueProven = segmentAlreadyConsistent
        ? currentValue === physicalValues[0]
        : currentValue === latestProfileValue;
    if (!authoritativeValueProven) {
        return blocked(PLAN_STATUSES.BLOCKED_INCONSISTENT_SEGMENT,
            'CONTRACT_SEGMENT_AUTHORITATIVE_END_NOT_UNIQUE', {
                hire, segmentStart, currentValue, latestProfileId,
                latestProfileValue, physicalValues
            });
    }

    const changedRows = mutableSegmentRows.filter(row => day(row[CONTRACT_END_FIELD]) !== requested);
    const unchangedRows = mutableSegmentRows.filter(row => day(row[CONTRACT_END_FIELD]) === requested);
    const protectedReferenceSummary = {};
    for (const row of changedRows) {
        const historyId = String(row._id);
        if (!Object.hasOwn(protectedReferences, historyId) ||
            !Array.isArray(protectedReferences[historyId])) {
            return blocked(PLAN_STATUSES.BLOCKED_REFERENCE,
                'CONTRACT_SEGMENT_REFERENCE_EVIDENCE_MISSING', { historyId });
        }
        let partitioned;
        try {
            partitioned = referencePartitioner(protectedReferences[historyId]);
        } catch {
            return blocked(PLAN_STATUSES.BLOCKED_REFERENCE,
                'CONTRACT_SEGMENT_REFERENCE_SEMANTICS_UNKNOWN', { historyId });
        }
        if (partitioned.liveDereference.length) {
            return blocked(PLAN_STATUSES.BLOCKED_REFERENCE,
                'LIVE_DEREFERENCE_BLOCKS_CONTRACT_END_SEGMENT_SYNC', { historyId });
        }
        protectedReferenceSummary[historyId] = {
            frozenProvenance: partitioned.frozenProvenance.length,
            liveDereference: 0
        };
    }

    const currentPatch = currentValue === requested ? {} : { [CONTRACT_END_FIELD]: requestedContractEnd };
    const historyPatches = Object.fromEntries(changedRows.map(row =>
        [String(row._id), { [CONTRACT_END_FIELD]: requestedContractEnd }]));
    const desiredHistoryRows = completeHistoryRows.map(row => historyPatches[String(row._id)]
        ? { ...row, ...historyPatches[String(row._id)] } : row);
    const expectedCurrent = { ...currentEmployee, ...currentPatch };
    const finalCanonical = canonicalizeEmployeeHistory({ scope, currentEmployee: expectedCurrent,
        historyRows: desiredHistoryRows });
    const secondCanonical = canonicalizeEmployeeHistory({ scope, currentEmployee: expectedCurrent,
        historyRows: finalCanonical.canonicalRows });
    const finalClean = finalCanonical.status === CANONICAL_STATUSES.CLEAN &&
        !finalCanonical.cleanupRequired && finalCanonical.idempotent &&
        secondCanonical.status === CANONICAL_STATUSES.CLEAN &&
        !secondCanonical.cleanupRequired && secondCanonical.idempotent &&
        stableStringify(secondCanonical.canonicalRows) ===
            stableStringify(finalCanonical.canonicalRows);
    if (!finalClean) {
        return blocked(PLAN_STATUSES.BLOCKED_FINAL_CANONICAL,
            'CONTRACT_SEGMENT_FINAL_CANONICAL_NOT_CLEAN', {
                firstStatus: finalCanonical.status,
                firstCleanupRequired: finalCanonical.cleanupRequired,
                secondStatus: secondCanonical.status,
                secondCleanupRequired: secondCanonical.cleanupRequired
            });
    }

    const changedHistoryIds = changedRows.map(row => String(row._id)).sort();
    const unchangedHistoryIds = unchangedRows.map(row => String(row._id)).sort();
    const targetSegmentHistoryIds = mutableSegmentRows.map(row => String(row._id)).sort();
    const oldContractEndsByHistoryId = Object.fromEntries(mutableSegmentRows.map(row =>
        [String(row._id), day(row[CONTRACT_END_FIELD])]));
    const status = !changedHistoryIds.length && !Object.keys(currentPatch).length
        ? PLAN_STATUSES.NO_OP
        : unchangedHistoryIds.length || !Object.keys(currentPatch).length
            ? PLAN_STATUSES.APPLYABLE_PARTIAL_SEGMENT_SYNC
            : PLAN_STATUSES.APPLYABLE;
    const fingerprintInput = {
        operation: OPERATION, scope, employeeId: String(currentEmployee._id || ''),
        hire, segmentStart, currentValue, requested, latestProfileId,
        oldContractEndsByHistoryId, changedHistoryIds, unchangedHistoryIds,
        currentPatch: Object.keys(currentPatch), protectedReferenceSummary
    };
    return {
        operation: OPERATION,
        status,
        reason: null,
        currentPatch,
        historyPatches,
        changedHistoryIds,
        unchangedHistoryIds,
        targetSegmentHistoryIds,
        desiredHistoryRows,
        planFingerprint: fingerprint(fingerprintInput),
        finalCanonical,
        cleanupRequired: false,
        idempotent: true,
        diagnostics: {
            employeeId: String(currentEmployee._id || ''),
            scope: { ...scope },
            employmentHire: hire,
            contractSegmentStart: segmentStart,
            authoritativeOldContractEnd: currentValue,
            latestCanonicalProfileId: latestProfileId,
            oldContractEndsByHistoryId,
            newContractEnd: requested,
            changedHistoryIds,
            unchangedHistoryIds,
            protectedReferenceSummary
        }
    };
}

module.exports = { OPERATION, CONTRACT_END_FIELD, PLAN_STATUSES,
    planEmployeeContractEndCorrection };
