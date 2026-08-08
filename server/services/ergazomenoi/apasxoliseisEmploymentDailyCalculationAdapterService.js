'use strict';

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
    proorhProseleyshMinutes = 0, proorhApoxorhshMinutes = 0, operations }) {
    assertOperations(operations, PRELIMINARY_OPERATIONS);
    const calculationRow = operations.normalizeZeroLengthCardPairs(row);
    const context = { rec: calculationRow, ergazomenos: effectiveEmployee, argiesDateSet,
        proorhProseleyshMinutes, proorhApoxorhshMinutes,
        evelikthProselefshMinutes: parseInt(effectiveEmployee?.evelikth_proselefsh || 0, 10) || 0 };
    const update = {};
    const unresolved = operations.resolveCardPairVerification(calculationRow).hasUnresolvedCardEvidence;
    if (unresolved) Object.assign(update, operations.buildPartialVerifiedCardUpdate(calculationRow).update);
    else {
        const splitUpdate = operations.checkBrokenProgramVsBrokenCards(context);
        Object.assign(update, splitUpdate);
        if (Object.keys(splitUpdate).length === 0) for (let pair = 1; pair <= 3; pair += 1) {
            Object.assign(update, operations.checkEarlyOrLateCard(context, pair));
        }
        Object.assign(update, operations.checkContinuousVsBrokenCards(context));
        Object.assign(update, operations.checkBrokenProgramVsContinuousCards(context));
        Object.assign(update, operations.checkNoDeclaredScheduleCards(context));
    }
    return Object.freeze({ calculationRow, update, unresolved, context,
        workingRow: { ...calculationRow, ...update } });
}

function buildEmploymentDailyCalculationUpdate({ row, effectiveEmployee, argiesDateSet, weeklyState,
    appliedProtectionContext, proorhProseleyshMinutes = 0, proorhApoxorhshMinutes = 0, operations }) {
    assertOperations(operations, DAILY_OPERATIONS);
    const preliminary = buildEmploymentDailyPreliminaryUpdate({ row, effectiveEmployee, argiesDateSet,
        proorhProseleyshMinutes, proorhApoxorhshMinutes, operations });
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
    const protectedUpdate = operations.sanitizeAppliedRepoTransferUpdate({ rowId: row._id,
        currentRow: row, update, protectionContext: appliedProtectionContext });
    return Object.freeze({ ...preliminary, update,
        sanitizedUpdate: protectedUpdate.sanitizedUpdate,
        protectionDiagnostics: protectedUpdate.diagnostics || [] });
}

module.exports = { PRELIMINARY_OPERATIONS, DAILY_OPERATIONS,
    buildEmploymentDailyPreliminaryUpdate, buildEmploymentDailyCalculationUpdate };
