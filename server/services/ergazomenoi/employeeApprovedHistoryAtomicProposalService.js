'use strict';

// PR406 Stage5C: an audited write *proposal*, never an executable write. Every
// invariant here is a precondition for the later atomic MongoDB boundary.
const { planApprovedHistoryChangeIntent } = require('./employeeApprovedHistoryChangeIntentService');
const { proposalHistoryState } = require('./employeeHistoryProposalReadService');
const { hash, equal } = require('./employeeHistoryAutomaticReconstructionApplyContract');
const C = require('./employeeHistoryAutomaticReconstructionContract');
const { createHistoricalComparison, workTerms: WORK_TERMS } = require('../../utils/ergazomenoi/historicalProfileComparison');

const VERSION = 'employee-approved-history-atomic-proposal:v1';
const rowId = row => String(row?._id ?? '');
function day(value) {
    if (value == null || value === '') return null;
    const date = new Date(value);
    return Number.isFinite(+date) ? date.toISOString().slice(0, 10) : null;
}
function nextDay(value) {
    const date = new Date(`${value}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + 1);
    return date.toISOString().slice(0, 10);
}
const result = (status, more = {}) => ({ version: VERSION, status,
    employeeWritten: false, historyWritten: false, auditWritten: false,
    executionEnabled: false, ...more });
function simple(value) { return value && typeof value === 'object' && !Array.isArray(value); }
function prepareApprovedHistoryAtomicProposal(input, request) {
    const decision = planApprovedHistoryChangeIntent(input, request);
    if (!['READY_FOR_ATOMIC_NEW_VERSION_PREVIEW',
        'REQUIRES_CONTROLLED_EXISTING_ROW_CORRECTION'].includes(decision.status))
        return result(decision.status, { intentStatus: decision.status });
    // An approved virtual edition is *not* a physical row. Never let it back
    // into an updateOne/findOneAndUpdate or reference-fence write.
    const projected = proposalHistoryState(input);
    const approved = projected.decisions;
    if ((!approved.length && !require('./employeeHistoryArchiveStateService').archives(input).length) || !input.protectedReferenceSummary ||
        !simple(input.protectedReferenceSummary)) return result('COMPLETE_REFERENCE_PROOF_REQUIRED');
    const physical = input.completeHistoryRows;
    const projectedTarget = projected.historyRows.find(row => rowId(row) ===
        (decision.kind === 'NEW_CHANGE' ? decision.fromHistoryId : decision.targetHistoryId));
    const original = physical.find(row => rowId(row) === rowId(projectedTarget));
    if (!projectedTarget || !original) return result('VERIFIED_TARGET_NOT_FOUND');
    if (!Object.hasOwn(input.protectedReferenceSummary, rowId(original)) ||
        !Array.isArray(input.protectedReferenceSummary[rowId(original)]))
        return result('TARGET_REFERENCE_PROOF_REQUIRED');
    const fingerprint = hash({ scope: input.scope, current: input.currentEmployee,
        history: physical, approved, references: input.protectedReferenceSummary,
        intent: decision.sourceFingerprint });
    const terms = decision.proposedTerms || decision.correctedTerms;
    if (WORK_TERMS.some(field => terms[field] === undefined || terms[field] === null))
        return result('WORK_TERMS_REQUIRED');
    const protectedTarget = input.protectedReferenceSummary[rowId(original)].length > 0;
    if (decision.kind === 'NEW_CHANGE') {
        if (day(projectedTarget[C.START]) >= decision.effectiveFrom)
            return result('NEW_VERSION_NOT_AFTER_LAST_PERIOD');
        const priorEnd = day(projectedTarget[C.END]);
        if (priorEnd && nextDay(priorEnd) !== decision.effectiveFrom)
            return result('TERMINAL_GAP_OR_OVERLAP_NEEDS_SEPARATE_REVIEW');
        // A new profile event must not accidentally inherit historical identity,
        // persisted correction markers or a previous version's audit metadata.
        // Inherit only vetted employment-profile facts, not old schedule-event
        // dates, record identifiers, audit metadata or entire physical rows.
        const inherit = [...C.SCOPE_FIELDS, C.HIRE, C.CONTRACT_END, ...C.PROFILE_FIELDS];
        const draft = Object.fromEntries(inherit.filter(field =>
            Object.hasOwn(projectedTarget, field)).map(field => [field, projectedTarget[field]]));
        Object.assign(draft, terms, {
            [C.START]: new Date(`${decision.effectiveFrom}T00:00:00.000Z`),
            [C.END]: null, [C.CHANGE]: new Date(`${decision.effectiveFrom}T00:00:00.000Z`),
            afora_proslhpsh: false, afora_allagh_oron_ergasias: true });
        const masterPatch = createHistoricalComparison(input.currentEmployee).difference(terms);
        if (rowId(original) === '' ||
            !Object.keys(masterPatch).length) return result('VALID_NEW_PROFILE_CHANGE_REQUIRED');
        return result('ATOMIC_NEW_VERSION_PREPARED_READ_ONLY', {
            intentStatus: decision.status, kind: decision.kind, sourceFingerprint: fingerprint,
            currentEmployeePatch: masterPatch, historyInsertDraft: draft, normalizedTerms:terms,
            physicalHistoryRowsToUpdate: [], physicalHistoryRowsToDelete: [],
            originalHistoryRowIds: physical.map(rowId),
            protectedOriginalReferencesMustRemainIdentical: true,
            fullValidationAndAuditRequiredBeforeCommit: true,
            signedConfirmationRequired: true,
            nextBoundary: 'SERIALIZED_EMPLOYEE_HISTORY_ATOMIC_INSERT'
        });
    }
    const currentEdit = createHistoricalComparison(input.currentEmployee).difference(terms);
    const reviewedEdit = createHistoricalComparison(projectedTarget).difference(terms);
    if (!Object.keys(currentEdit).length || !Object.keys(reviewedEdit).length)
        return result('CORRECTION_NOT_EXPLICITLY_IDENTIFIED');
    const mode = protectedTarget || !equal(projectedTarget, original)
        ? 'AUDITED_IMMUTABLE_CORRECTION_EDITION' : 'AUDITED_EXISTING_ROW_CORRECTION';
    return result('EXISTING_ERROR_CORRECTION_PREPARED_READ_ONLY', {
        intentStatus: decision.status, kind: decision.kind, mode,
        sourceFingerprint: fingerprint, targetHistoryId: rowId(original),
        effectiveFrom: decision.effectiveFrom, currentEmployeePatch: currentEdit,
        verifiedHistoryCorrection: reviewedEdit, normalizedTerms:terms,
        physicalHistoryRowsToInsert: [], physicalHistoryRowsToDelete: [],
        physicalHistoryRowsToUpdate: mode === 'AUDITED_IMMUTABLE_CORRECTION_EDITION'
            ? [] : [rowId(original)],
        previousApprovedEditionPreserved: true,
        noInventedSecondPeriod: true,
        protectedOriginalReferencesMustRemainIdentical: true,
        fullValidationAndAuditRequiredBeforeCommit: true,
        signedConfirmationRequired: true,
        nextBoundary: 'SIGNED_SAME_PERIOD_CORRECTION_WITH_FROZEN_REFERENCE_PROOF'
    });
}
module.exports = { VERSION, prepareApprovedHistoryAtomicProposal };
