'use strict';

// PR406 / Stage 5B. Pure server-owned *intent* planner: no persistence or
// authorization delegated to the browser. Distinguish new real terms from a
// correction of an erroneous saved term, before the atomic mutation boundary.
const { assessApprovedMaintenanceBaseline } = require('./employeeApprovedHistoryMaintenanceBaselineService');
const { proposalHistoryState } = require('./employeeHistoryProposalReadService');
const { hash } = require('./employeeHistoryAutomaticReconstructionApplyContract');
const C = require('./employeeHistoryAutomaticReconstructionContract');
const { normalizeProfileChangeTerms } = require('../../utils/ergazomenoi/historicalProfileChange');
const { createHistoricalComparison } = require('../../utils/ergazomenoi/historicalProfileComparison');

const VERSION = 'employee-approved-legacy-change-intent:v1';
const START = C.START;
const HIRE = C.HIRE;
const END = C.END;
const DAYS = 'hmeres_ergasias_ebdomadas';

function exactDay(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const d = new Date(value + 'T00:00:00.000Z');
    return Number.isFinite(+d) && d.toISOString().slice(0, 10) === value ? value : null;
}
function day(value) {
    if (value == null || value === '') return null;
    const d = new Date(value);
    return Number.isFinite(+d) ? d.toISOString().slice(0,10) : null;
}
function status(code, extra = {}) {
    return { version: VERSION, status: code, newMutationAuthorized: false,
        employeeWritten: false, historyWritten: false, ...extra };
}
function latestCurrentRow(history, current) {
    const hire = day(current?.[HIRE]);
    const candidates = history.filter(row => day(row?.[HIRE]) === hire && day(row?.[START]));
    candidates.sort((a,b) => day(b[START]).localeCompare(day(a[START])));
    if (!candidates.length || candidates.length > 1 && day(candidates[0][START]) === day(candidates[1][START])) return null;
    return candidates[0];
}
function planApprovedHistoryChangeIntent(input, request) {
    if (!input?.scope || !input?.currentEmployee || !Array.isArray(input.completeHistoryRows) ||
        !Array.isArray(input.approvedHistoryDecisions)) return status('INPUT_NOT_VERIFIED');
    if (!request || !['NEW_CHANGE', 'CORRECT_SAVED_ERROR'].includes(request.kind))
        return status('EXPLICIT_CHANGE_KIND_REQUIRED');
    // Never trust form-supplied identifiers, original state, history snapshots,
    // approval statuses, or account permissions as evidence. The caller must
    // load input itself from the same scoped server transaction later.
    if (Object.keys(request).some(key => !['kind', 'effectiveFrom', 'correctedTerms', 'targetHistoryId'].includes(key)))
        return status('UNEXPECTED_CLIENT_EVIDENCE');
    const effectiveFrom = exactDay(request.effectiveFrom);
    const correctedTerms = normalizeProfileChangeTerms(request.correctedTerms,input.currentEmployee);
    if (!effectiveFrom) return status('EXPLICIT_VALID_DATE_REQUIRED');
    if (!correctedTerms) return status('COMPLETE_COHERENT_WORK_TERMS_REQUIRED');
    const current = input.currentEmployee;
    if (current.employee_pending_history) return status('FIRST_CHANGE_STILL_PENDING');
    const hire = day(current[HIRE]), depart = day(current.hmeromhnia_apoxorhshs);
    if (!hire || effectiveFrom < hire || depart && effectiveFrom > depart)
        return status('EFFECTIVE_DATE_OUTSIDE_EMPLOYMENT');
    if (current.energos === false) return status('CLOSED_EMPLOYMENT_REQUIRES_SEPARATE_WORKFLOW');
    const projected = proposalHistoryState(input);
    const archived = require('./employeeHistoryArchiveStateService').archivedIds(input);
    if (!projected.decisions.length && !archived.size) return status('NO_VERIFIED_PRIOR_APPROVAL');
    if (request.kind === 'CORRECT_SAVED_ERROR' && archived.has(request.targetHistoryId)) return status('ARCHIVED_ROW_IMMUTABLE');
    const target = latestCurrentRow(projected.historyRows, current);
    if (!target) return status('UNIQUE_CURRENT_HISTORY_TARGET_REQUIRED');
    const previousDays = current[DAYS];
    const changedProfile = createHistoricalComparison(current).difference(correctedTerms);
    if (!Object.keys(changedProfile).length) return status('NO_CHANGE');
    if (request.kind === 'NEW_CHANGE') {
        if (request.targetHistoryId != null) return status('NEW_EVENT_CANNOT_REWRITE_AN_EXISTING_ROW');
        const approved = assessApprovedMaintenanceBaseline(input, {
            effectiveFrom, weekDays: correctedTerms[DAYS], profileChanges: changedProfile });
        if (!approved.priorFindingsResolved) return status('UNRESOLVED_PREEXISTING_FINDINGS', {
            pendingCaseCount: approved.pendingCaseCount, reviewFindingCount: approved.reviewFindingCount });
        if (approved.newVersionPlanningStatus !== 'ELIGIBLE_FOR_FURTHER_VERSION_PLANNING')
            return status(approved.newVersionPlanningStatus);
        if (day(target[END]) && effectiveFrom <= day(target[END]))
            return status('NEW_EVENT_OVERLAPS_PREVIOUS_PERIOD');
        // No old record is changed in this pure plan. A separate, freshly
        // authorized transaction must allocate an identity and prove full
        // coverage and references before committing a new History period.
        return status('READY_FOR_ATOMIC_NEW_VERSION_PREVIEW', {
            kind: 'NEW_CHANGE', effectiveFrom, fromHistoryId: String(target._id),
            fromDays: previousDays, proposedTerms: correctedTerms,
            existingHistoryMutationIds: [],
            sourceFingerprint: hash({ scope: input.scope, current, physicalHistory: input.completeHistoryRows,
                verifiedDecisions: projected.decisions, effectiveFrom, correctedTerms }),
            nextStep: 'SERVER_SIDE_ATOMIC_HISTORY_VERSION_WITH_SIGNED_CONFIRMATION'
        });
    }
    // A mistaken recorded 6-day week must be corrected *on its original
    // effective date*, not represented as an invented later 6->5 period.
    if (!request.targetHistoryId || String(request.targetHistoryId) !== String(target._id))
        return status('EXACT_LATEST_ERRONEOUS_HISTORY_ID_REQUIRED');
    if (effectiveFrom !== day(target[START]))
        return status('CORRECTION_MUST_KEEP_ORIGINAL_EFFECTIVE_DATE');
    if (Number(target[DAYS]) !== Number(previousDays))
        return status('HISTORY_EMPLOYEE_TERMS_DISAGREE');
    const physical = input.completeHistoryRows.find(row => String(row._id) === String(target._id));
    if (!physical) return status('ERRONEOUS_PHYSICAL_ROW_NOT_FOUND');
    const protectedRefs = input.protectedReferenceSummary?.[String(target._id)];
    return status('REQUIRES_CONTROLLED_EXISTING_ROW_CORRECTION', {
        kind:'CORRECT_SAVED_ERROR', targetHistoryId:String(target._id), effectiveFrom,
        originalDays: previousDays, correctedTerms,
        hasProtectedReferences: Array.isArray(protectedRefs) ? protectedRefs.length > 0 : null,
        willCreateSecondHistoryEvent: false, existingHistoryMutationIds: [],
        sourceFingerprint: hash({ scope: input.scope, current, physical, approved: projected.decisions, correctedTerms }),
        nextStep: 'SIGNED_CORRECTION_WITH_REFERENCE_AUDIT_AND_FROZEN_PERIOD_GUARDS'
    });
}
module.exports = { VERSION, planApprovedHistoryChangeIntent };
