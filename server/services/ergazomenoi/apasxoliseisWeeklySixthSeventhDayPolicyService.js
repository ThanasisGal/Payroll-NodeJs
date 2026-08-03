const {
    dateKeyUtc,
    getMondaySundayWeekRange
} = require('../../utils/date/mondaySundayWeek');
const {
    resolveDailyActualWorkFacts
} = require('./apasxoliseisDailyActualWorkFactsService');

const POLICY_VERSION = 'sepe-weekly-sixth-seventh-day:v2';
const STATUS = Object.freeze({ READY: 'READY', NOT_APPLICABLE: 'NOT_APPLICABLE', NEEDS_HR_DECISION: 'NEEDS_HR_DECISION' });
const ZERO_RATE_EXEMPT_SPECIAL_CATEGORIES = new Set(['0009']);

function validRate(value) {
    if (value === null || value === undefined || String(value).trim() === '') return null;
    const rate = Number(String(value).replace(',', '.').trim());
    return Number.isFinite(rate) && rate >= 0 ? rate : null;
}

function selectSixthDay(candidates) {
    const cardProvenCandidates = candidates.filter(
        (day) => day.cardHours > 0
    );
    const preferred = cardProvenCandidates.filter(
        (day) => day.actualWorkHours > 0 && day.actualWorkHours <= 8
    ).sort((a, b) =>
        a.actualWorkHours - b.actualWorkHours ||
        a.hmeromhnia.localeCompare(b.hmeromhnia)
    );
    if (preferred.length > 0) {
        const day = preferred[preferred.length - 1];
        return {
            day,
            warnings: day.hasCompleteCardEvidence
                ? []
                : ['SIXTH_DAY_INCOMPLETE_CARD_INTERVAL']
        };
    }
    const overEight = cardProvenCandidates
        .filter((day) => day.actualWorkHours > 8)
        .sort((a, b) =>
            a.actualWorkHours - b.actualWorkHours ||
            b.hmeromhnia.localeCompare(a.hmeromhnia)
        );
    if (overEight.length > 0) {
        const day = overEight[0];
        return {
            day,
            warnings: [
                'SIXTH_DAY_DAILY_HOURS_EXCEED_EIGHT',
                ...(day.hasCompleteCardEvidence
                    ? []
                    : ['SIXTH_DAY_INCOMPLETE_CARD_INTERVAL'])
            ]
        };
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
    const sixthDayHours = Math.min(selected.day.actualWorkHours, 8);
    const illegalOvertimeHours = Math.max(selected.day.actualWorkHours - 8, 0);
    const classification = illegalOvertimeHours > 0
        ? 'SIXTH_DAY_WITH_ILLEGAL_OVERTIME'
        : 'SIXTH_DAY';
    const sixthDayWithoutAmounts = {
        ...selected.day,
        sixthDayHours,
        illegalOvertimeHours,
        baseAmount: null,
        premiumAmount: null,
        value: null,
        classification
    };
    const classificationWarnings = [...new Set([
        ...dailyFacts.flatMap((day) => day.warnings),
        ...(selected.warnings || []),
        ...(seventhDay ? ['SEVENTH_CONSECUTIVE_ACTUAL_WORK_DAY_CONTRACT_VIOLATION'] : [])
    ])];
    const premiumRate = validRate(effectiveProfile.pososto_prosayxhshs_6hs_hmeras);
    if (premiumRate === null) {
        return Object.freeze({
            policyVersion: POLICY_VERSION,
            status: STATUS.NEEDS_HR_DECISION,
            reasons: ['MISSING_OR_INVALID_SIXTH_DAY_PREMIUM_RATE'],
            warnings: classificationWarnings,
            dailyFacts,
            sixthDay: sixthDayWithoutAmounts,
            seventhDay
        });
    }
    const specialCategory = String(
        effectiveProfile.eidikh_kathgoria_ergazomenoy ||
        effectiveProfile.eidikh_periptosh ||
        ''
    ).trim().padStart(4, '0');
    if (
        premiumRate === 0 &&
        !ZERO_RATE_EXEMPT_SPECIAL_CATEGORIES.has(specialCategory)
    ) {
        return Object.freeze({
            policyVersion: POLICY_VERSION,
            status: STATUS.NEEDS_HR_DECISION,
            reasons: ['ZERO_SIXTH_DAY_PREMIUM_RATE_WITHOUT_EXEMPTION'],
            warnings: classificationWarnings,
            dailyFacts,
            sixthDay: sixthDayWithoutAmounts,
            seventhDay
        });
    }
    const rate = Number(String(hourlyRate).replace(',', '.'));
    const baseAmount = Number.isFinite(rate) && rate >= 0
        ? Number((sixthDayHours * rate).toFixed(2))
        : null;
    const premiumAmount = baseAmount === null
        ? null
        : Number((baseAmount * premiumRate / 100).toFixed(2));
    const sixthDayValue = baseAmount === null
        ? null
        : Number((baseAmount + premiumAmount).toFixed(2));
    return Object.freeze({
        policyVersion: POLICY_VERSION,
        status: STATUS.READY,
        reasons: [],
        warnings: classificationWarnings,
        week: { start: range.weekStartKey, end: range.weekEndKey },
        premiumRate,
        premiumRateSource: effectiveProfile.source || null,
        dailyFacts,
        sixthDay: {
            ...selected.day,
            sixthDayHours,
            illegalOvertimeHours,
            baseAmount,
            premiumAmount,
            value: sixthDayValue,
            classification
        },
        seventhDay: seventhDay
            ? {
                  ...seventhDay,
                  severity: 'SERIOUS_VIOLATION',
                  classification: 'SEVENTH_DAY_ILLEGAL_OVERTIME',
                  illegalOvertimeHours: seventhDay.actualWorkHours
              }
            : null
    });
}

module.exports = {
    POLICY_VERSION,
    STATUS,
    ZERO_RATE_EXEMPT_SPECIAL_CATEGORIES,
    validRate,
    selectSixthDay,
    analyzeWeeklySixthSeventhDay
};
