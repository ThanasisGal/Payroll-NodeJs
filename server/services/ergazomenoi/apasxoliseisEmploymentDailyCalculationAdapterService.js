'use strict';

const {
    buildAutoAttendanceReset
} = require('./apasxoliseisAttendanceDerivedScheduleService');
const {
    applyCardDerivedAbsenceMetrics
} = require('./apasxoliseisStage1DailyClassificationBulkService');

function assertOperations(operations, names) {
    for (const name of names) if (typeof operations?.[name] !== 'function') {
        throw new TypeError(`Missing authoritative daily operation: ${name}`);
    }
}

const PRELIMINARY_OPERATIONS = Object.freeze([
    'normalizeZeroLengthCardPairs', 'resolveCardPairVerification', 'buildPartialVerifiedCardUpdate',
    'checkBrokenProgramVsBrokenCards', 'checkEarlyOrLateCard', 'checkContinuousVsBrokenCards',
    'checkBrokenProgramVsContinuousCards', 'checkNoDeclaredScheduleCards'
]);
const DAILY_OPERATIONS = Object.freeze([...PRELIMINARY_OPERATIONS, 'checkNightHours',
    'checkSundayHolidayHours', 'checkRepoAdeiaAstheneiaApologistika', 'checkOresApoysias',
    'calculateAdditionalAndOverworkForDay', 'sanitizeAppliedRepoTransferUpdate']);

function buildEmploymentDailyPreliminaryUpdate({ row, effectiveEmployee, argiesDateSet,
    proorhProseleyshMinutes = 0, proorhApoxorhshMinutes = 0, operations,
    orphanReusableResolution = null, orphanApprovedResolution = null }) {
    assertOperations(operations, PRELIMINARY_OPERATIONS);
    const calculationRow = operations.normalizeZeroLengthCardPairs(row);
    const context = { rec: calculationRow, ergazomenos: effectiveEmployee, argiesDateSet,
        proorhProseleyshMinutes, proorhApoxorhshMinutes,
        evelikthProselefshMinutes: parseInt(effectiveEmployee?.evelikth_proselefsh || 0, 10) || 0 };
    if (calculationRow.is_locked === true) {
        return Object.freeze({ calculationRow, update: {}, unresolved: false,
            rawCardEvidenceUnresolved: false, safeOrphan: null, manualOwnership: 'LOCKED_HR_ROW',
            context, workingRow: calculationRow });
    }
    const update = buildAutoAttendanceReset();
    const verification = operations.resolveCardPairVerification(calculationRow);
    const directApprovedOrphan = orphanApprovedResolution?.eligible === true &&
        orphanApprovedResolution?.canApprove === true && orphanApprovedResolution?.approvedUpdates
        ? orphanApprovedResolution : null;
    const safeOrphan = directApprovedOrphan ||
        (orphanReusableResolution?.automaticReusableApplied === true
            ? orphanReusableResolution : null);
    const unresolved = verification.hasUnresolvedCardEvidence && !safeOrphan;
    if (safeOrphan) Object.assign(update, safeOrphan.approvedUpdates, {
        orphan_card_resolution: directApprovedOrphan?.persistedMetadata || {
            status: 'HR_APPROVED', policy_version: safeOrphan.policyVersion,
            orphan_type: safeOrphan.orphanType, approved_start: safeOrphan.proposal.start,
            approved_end: safeOrphan.proposal.end,
            approved_hours: safeOrphan.proposal.workDurationHours ??
                safeOrphan.proposal.durationHours,
            apologistiko_book_update: safeOrphan.apologistikoBookUpdate,
            reuse_scope: directApprovedOrphan ? 'ONE_TIME' : 'FUTURE_IDENTICAL',
            automatically_reused: !directApprovedOrphan,
            rest_risk_acknowledged: false, rest_conflicts: [], raw_cards_preserved: true
        }
    });
    if (unresolved) Object.assign(update, operations.buildPartialVerifiedCardUpdate(calculationRow).update);
    else if (!safeOrphan) {
        const splitUpdate = operations.checkBrokenProgramVsBrokenCards(context);
        Object.assign(update, splitUpdate);
        if (Object.keys(splitUpdate).length === 0) for (let pair = 1; pair <= 3; pair += 1) {
            Object.assign(update, operations.checkEarlyOrLateCard(context, pair));
        }
        Object.assign(update, operations.checkContinuousVsBrokenCards(context));
        Object.assign(update, operations.checkBrokenProgramVsContinuousCards(context));
        Object.assign(update, operations.checkNoDeclaredScheduleCards(context));
    }
    return Object.freeze({ calculationRow, update, unresolved, rawCardEvidenceUnresolved:
        verification.hasUnresolvedCardEvidence, safeOrphan, context,
        workingRow: { ...calculationRow, ...update } });
}

function buildEmploymentDailyCalculationUpdate({ row, effectiveEmployee, argiesDateSet, weeklyState,
    appliedProtectionContext, proorhProseleyshMinutes = 0, proorhApoxorhshMinutes = 0, operations,
    orphanReusableResolution = null, orphanApprovedResolution = null }) {
    assertOperations(operations, DAILY_OPERATIONS);
    const preliminary = buildEmploymentDailyPreliminaryUpdate({ row, effectiveEmployee, argiesDateSet,
        proorhProseleyshMinutes, proorhApoxorhshMinutes, operations, orphanReusableResolution,
        orphanApprovedResolution });
    if (preliminary.manualOwnership) {
        return Object.freeze({ ...preliminary, update: {}, sanitizedUpdate: {},
            protectionDiagnostics: [] });
    }
    const update = { ...preliminary.update };
    const workingContext = { ...preliminary.context, rec: preliminary.workingRow };
    Object.assign(update, operations.checkNightHours(workingContext));
    Object.assign(update, operations.checkSundayHolidayHours(workingContext));
    if (!preliminary.unresolved) {
        Object.assign(update, operations.checkRepoAdeiaAstheneiaApologistika(workingContext));
        Object.assign(update, operations.checkOresApoysias(workingContext));
    }
    if (weeklyState) Object.assign(update,
        operations.calculateAdditionalAndOverworkForDay(workingContext, weeklyState));
    Object.assign(update, applyCardDerivedAbsenceMetrics(row, update));
    const protectedUpdate = operations.sanitizeAppliedRepoTransferUpdate({ rowId: row._id,
        currentRow: row, update, protectionContext: appliedProtectionContext });
    return Object.freeze({ ...preliminary, update,
        sanitizedUpdate: protectedUpdate.sanitizedUpdate,
        protectionDiagnostics: protectedUpdate.diagnostics || [] });
}

module.exports = { PRELIMINARY_OPERATIONS, DAILY_OPERATIONS,
    buildEmploymentDailyPreliminaryUpdate, buildEmploymentDailyCalculationUpdate };
