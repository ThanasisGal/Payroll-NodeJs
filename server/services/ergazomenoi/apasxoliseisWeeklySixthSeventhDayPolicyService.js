const {
    dateKeyUtc,
    getMondaySundayWeekRange
} = require('../../utils/date/mondaySundayWeek');
const {
    resolveDailyActualWorkFacts
} = require('./apasxoliseisDailyActualWorkFactsService');

const POLICY_VERSION = 'sepe-weekly-sixth-seventh-day:v1';
const STATUS = Object.freeze({ READY: 'READY', NOT_APPLICABLE: 'NOT_APPLICABLE', NEEDS_HR_DECISION: 'NEEDS_HR_DECISION' });

function validRate(value) {
    if (value === null || value === undefined || String(value).trim() === '') return null;
    const rate = Number(String(value).replace(',', '.').trim());
    return Number.isFinite(rate) && rate >= 0 ? rate : null;
}

function selectSixthDay(candidates) {
    const preferred = candidates.filter((day) => day.actualWorkHours > 5 && day.actualWorkHours <= 8);
    if (preferred.length > 0) return { day: preferred[preferred.length - 1], warning: null };
    const overEight = candidates.filter((day) => day.actualWorkHours > 8);
    if (overEight.length > 0) {
        return { day: overEight[overEight.length - 1], warning: 'SIXTH_DAY_DAILY_HOURS_EXCEED_EIGHT' };
    }
    return { day: null, reason: 'SIXTH_DAY_CANDIDATE_NOT_DETERMINISTIC' };
}

function analyzeWeeklySixthSeventhDay({
    weekRows = [],
    effectiveProfile = {},
    hourlyRate = null
} = {}) {
    const rows = Array.isArray(weekRows) ? weekRows : [];
    const dates = rows.map((row) => dateKeyUtc(row?.hmeromhnia));
    const range = dates[0] ? getMondaySundayWeekRange(dates[0]) : null;
    if (
        rows.length !== 7 ||
        dates.some((date) => !date) ||
        new Set(dates).size !== 7 ||
        !range ||
        dates.some((date) => getMondaySundayWeekRange(date)?.weekStartKey !== range.weekStartKey)
    ) {
        return Object.freeze({ policyVersion: POLICY_VERSION, status: STATUS.NEEDS_HR_DECISION, reasons: ['INVALID_OR_INCOMPLETE_MONDAY_SUNDAY_WEEK'], warnings: [], dailyFacts: [] });
    }
    if (effectiveProfile.profile_changed_inside_week === true) {
        return Object.freeze({ policyVersion: POLICY_VERSION, status: STATUS.NEEDS_HR_DECISION, reasons: ['PROFILE_CHANGED_INSIDE_WEEK'], warnings: [], dailyFacts: [] });
    }
    if (Number(effectiveProfile.hmeres_ergasias_ebdomadas) !== 5) {
        return Object.freeze({ policyVersion: POLICY_VERSION, status: STATUS.NOT_APPLICABLE, reasons: [], warnings: [], dailyFacts: [] });
    }
    const premiumRate = validRate(effectiveProfile.pososto_prosayxhshs_6hs_hmeras);
    if (premiumRate === null) {
        return Object.freeze({ policyVersion: POLICY_VERSION, status: STATUS.NEEDS_HR_DECISION, reasons: ['MISSING_OR_INVALID_SIXTH_DAY_PREMIUM_RATE'], warnings: [], dailyFacts: [] });
    }
    const dailyFacts = rows
        .map((row) => ({ hmeromhnia: dateKeyUtc(row.hmeromhnia), ...resolveDailyActualWorkFacts(row) }))
        .sort((a, b) => a.hmeromhnia.localeCompare(b.hmeromhnia));
    const factReasons = [...new Set(dailyFacts.flatMap((day) => day.reasons))];
    if (factReasons.length > 0) {
        return Object.freeze({ policyVersion: POLICY_VERSION, status: STATUS.NEEDS_HR_DECISION, reasons: factReasons, warnings: [], dailyFacts });
    }
    const actualDays = dailyFacts.filter((day) => day.countsAsActualWorkDay);
    if (actualDays.length <= 5) {
        return Object.freeze({ policyVersion: POLICY_VERSION, status: STATUS.NOT_APPLICABLE, reasons: [], warnings: [...new Set(dailyFacts.flatMap((day) => day.warnings))], dailyFacts, sixthDay: null, seventhDay: null });
    }
    const seventhDay = actualDays.length === 7 ? actualDays[actualDays.length - 1] : null;
    const sixthCandidates = seventhDay ? actualDays.slice(0, -1) : actualDays;
    const selected = selectSixthDay(sixthCandidates);
    if (!selected.day) {
        return Object.freeze({ policyVersion: POLICY_VERSION, status: STATUS.NEEDS_HR_DECISION, reasons: [selected.reason], warnings: [...new Set(dailyFacts.flatMap((day) => day.warnings))], dailyFacts, sixthDay: null, seventhDay });
    }
    const rate = Number(String(hourlyRate).replace(',', '.'));
    const sixthDayValue = Number.isFinite(rate) && rate >= 0
        ? Number((selected.day.actualWorkHours * rate * (1 + premiumRate / 100)).toFixed(2))
        : null;
    const warnings = [...new Set([
        ...dailyFacts.flatMap((day) => day.warnings),
        ...(selected.warning ? [selected.warning] : []),
        ...(seventhDay ? ['SEVENTH_CONSECUTIVE_ACTUAL_WORK_DAY_CONTRACT_VIOLATION'] : [])
    ])];
    return Object.freeze({
        policyVersion: POLICY_VERSION,
        status: STATUS.READY,
        reasons: [],
        warnings,
        week: { start: range.weekStartKey, end: range.weekEndKey },
        premiumRate,
        premiumRateSource: effectiveProfile.source || null,
        dailyFacts,
        sixthDay: { ...selected.day, value: sixthDayValue },
        seventhDay
    });
}

module.exports = { POLICY_VERSION, STATUS, validRate, selectSixthDay, analyzeWeeklySixthSeventhDay };
