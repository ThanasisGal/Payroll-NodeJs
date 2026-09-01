'use strict';

const {
    buildAutoAttendanceReset,
    resolveSafeStartOnlyOrphan
} = require('./apasxoliseisAttendanceDerivedScheduleService');
const {
    resolveNoCardsDisplayStatus
} = require('./apasxoliseisWeeklyRepoTransferAuthoritativeContextService');

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
    if (calculationRow.is_locked === true) {
        return Object.freeze({ calculationRow, update: {}, unresolved: false,
            rawCardEvidenceUnresolved: false, safeOrphan: null, manualOwnership: 'LOCKED_HR_ROW',
            context, workingRow: calculationRow });
    }
    const update = buildAutoAttendanceReset();
    const verification = operations.resolveCardPairVerification(calculationRow);
    const safeOrphan = verification.hasUnresolvedCardEvidence
        ? resolveSafeStartOnlyOrphan(calculationRow, {
              flexibleArrivalMinutes: context.evelikthProselefshMinutes
          })
        : null;
    const unresolved = verification.hasUnresolvedCardEvidence && !safeOrphan;
    if (safeOrphan) Object.assign(update, {
        apologistiko_biblio: safeOrphan.requiresBook,
        kathgoria_ergasias_apologistika: 'ΕΡΓ',
        apo_ora_01_apologistika: safeOrphan.start,
        eos_ora_01_apologistika: safeOrphan.end,
        apo_ora_02_apologistika: '', eos_ora_02_apologistika: '',
        apo_ora_03_apologistika: '', eos_ora_03_apologistika: '',
        ores_ergasias_apologistika: Number((safeOrphan.durationMinutes / 60).toFixed(2)),
        ores_pragmatikhs_ergasias_apologistika: Number((safeOrphan.durationMinutes / 60).toFixed(2))
    });
    else if (unresolved) Object.assign(update, operations.buildPartialVerifiedCardUpdate(calculationRow).update);
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
    return Object.freeze({ calculationRow, update, unresolved, rawCardEvidenceUnresolved:
        verification.hasUnresolvedCardEvidence, safeOrphan, context,
        workingRow: { ...calculationRow, ...update } });
}

function buildEmploymentDailyCalculationUpdate({ row, effectiveEmployee, argiesDateSet, weeklyState,
    appliedProtectionContext, proorhProseleyshMinutes = 0, proorhApoxorhshMinutes = 0, operations }) {
    assertOperations(operations, DAILY_OPERATIONS);
    const preliminary = buildEmploymentDailyPreliminaryUpdate({ row, effectiveEmployee, argiesDateSet,
        proorhProseleyshMinutes, proorhApoxorhshMinutes, operations });
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
    const protectedUpdate = operations.sanitizeAppliedRepoTransferUpdate({ rowId: row._id,
        currentRow: row, update, protectionContext: appliedProtectionContext });
    return Object.freeze({ ...preliminary, update,
        sanitizedUpdate: protectedUpdate.sanitizedUpdate,
        protectionDiagnostics: protectedUpdate.diagnostics || [] });
}

function buildStage1EffectiveHolidayDailyCalculationUpdate({ row, holidayContext, ...options }) {
    const noCardsDisplayStatus = resolveNoCardsDisplayStatus(row, holidayContext);
    const effectiveHoliday = noCardsDisplayStatus === 'ΑΡΓΙΑ';
    const rowDate = new Date(row?.hmeromhnia);
    const rowDateKey = Number.isNaN(rowDate.getTime())
        ? null
        : rowDate.toISOString().slice(0, 10);
    const hasHolidayRecord = Boolean(rowDateKey &&
        holidayContext?.argiesByDateKey?.has?.(rowDateKey));
    const calculationRow = hasHolidayRecord
        ? { ...row, argia_apologistika: effectiveHoliday }
        : row;
    const plan = buildEmploymentDailyCalculationUpdate({
        ...options,
        row: calculationRow,
        argiesDateSet: new Set(holidayContext?.argiesByDateKey?.keys?.() || [])
    });
    return Object.freeze({
        ...plan,
        noCardsDisplayStatus,
        sanitizedUpdate: hasHolidayRecord
            ? { ...plan.sanitizedUpdate, argia_apologistika: effectiveHoliday }
            : plan.sanitizedUpdate
    });
}

module.exports = { PRELIMINARY_OPERATIONS, DAILY_OPERATIONS,
    buildEmploymentDailyPreliminaryUpdate, buildEmploymentDailyCalculationUpdate,
    buildStage1EffectiveHolidayDailyCalculationUpdate };
