'use strict';

// Legacy duration-only behavior extracted from 45b046b33e209f26be59cba6a634db4800f86519.
// Exact profile breaks now use temporal subtraction before payroll classification.
const CALCULATION_SOURCE_VERSION = 'weekly-illegal-overtime:45b046b:v2';
const { resolveCardPairVerification } = require('./apasxoliseisCardPairResolverService');
const { buildWeeklyIllegalOvertimePersistenceMapping } = require('./apasxoliseisWeeklyIllegalOvertimeMappingService');
const { hasExactExternalBreaks, subtractExternalBreakIntervals } = require('../../utils/ergazomenoi/subtractExternalBreakIntervals');

function timeToMinutesSafe(time) {
    if (!time) return null;

    const s = String(time).trim();
    if (!/^\d{2}:\d{2}$/.test(s)) return null;

    const [hh, mm] = s.split(':').map(Number);
    if (isNaN(hh) || isNaN(mm)) return null;

    return hh * 60 + mm;
}

function minutesToTimeSafe(totalMinutes) {
    if (totalMinutes === null || totalMinutes === undefined) return '';

    const normalized = ((totalMinutes % 1440) + 1440) % 1440;
    const hh = Math.floor(normalized / 60);
    const mm = normalized % 60;

    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function hasTime(value) {
    return value !== null && value !== undefined && String(value).trim() !== '';
}

function addDaysUtc(date, days) {
    const d = new Date(date);
    d.setUTCDate(d.getUTCDate() + days);
    return d;
}

function dateKeyUtc(date) {
    const d = new Date(date);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
        d.getUTCDate()
    ).padStart(2, '0')}`;
}

function isSundayOrHoliday(date, argiesDateSet) {
    const d = new Date(date);

    // Κυριακή σε UTC
    const isSunday = d.getUTCDay() === 0;

    // Αργία από ArgiesModel
    const isHoliday = argiesDateSet.has(dateKeyUtc(d));

    return isSunday || isHoliday;
}

function getBreakOffsetMinutes(ergazomenos) {
    const dialleimaEntos = ergazomenos.dialleima_entos_ektos_orarioy === true;
    const dialleimaMinutes = parseInt(ergazomenos.dialleima_se_lepta || 0, 10) || 0;

    return dialleimaEntos ? 0 : dialleimaMinutes;
}

function isDeclaredContinuousSchedule(rec) {
    return (
        hasTime(rec.apo_ora_01) &&
        hasTime(rec.eos_ora_01) &&
        !hasTime(rec.apo_ora_02) &&
        !hasTime(rec.eos_ora_02) &&
        !hasTime(rec.apo_ora_03) &&
        !hasTime(rec.eos_ora_03)
    );
}

function isCardsContinuousSchedule(rec) {
    return (
        hasTime(rec.cards_apo_ora_01) &&
        hasTime(rec.cards_eos_ora_01) &&
        !hasTime(rec.cards_apo_ora_02) &&
        !hasTime(rec.cards_eos_ora_02) &&
        !hasTime(rec.cards_apo_ora_03) &&
        !hasTime(rec.cards_eos_ora_03)
    );
}

function isZeroLengthTimePair(apoOra, eosOra) {
    const apo = timeToMinutesSafe(apoOra);
    const eos = timeToMinutesSafe(eosOra);

    return apo !== null && eos !== null && apo === eos;
}

function getRawCardIntervals(rec) {
    return [
        {
            index: 1,
            apo: rec.cards_apo_ora_01,
            eos: rec.cards_eos_ora_01
        },
        {
            index: 2,
            apo: rec.cards_apo_ora_02,
            eos: rec.cards_eos_ora_02
        },
        {
            index: 3,
            apo: rec.cards_apo_ora_03,
            eos: rec.cards_eos_ora_03
        }
    ]
        .map((interval) => {
            if (isZeroLengthTimePair(interval.apo, interval.eos)) return null;

            const expanded = expandIntervalFromTimes(interval.apo, interval.eos);

            if (!expanded) return null;

            return {
                ...interval,
                start: expanded.start,
                end: expanded.end
            };
        })
        .filter(Boolean);
}

function getRawDailyCardsMinutes(rec) {
    return getRawCardIntervals(rec).reduce(
        (total, interval) => total + Math.max(0, interval.end - interval.start),
        0
    );
}

function shouldSubtractExternalBreak(rec, ergazomenos) {
    if (!ergazomenos) return false;

    const breakMinutes = getBreakOffsetMinutes(ergazomenos);

    if (breakMinutes <= 0) return false;
    if (!isDeclaredContinuousSchedule(rec)) return false;
    if (!isCardsContinuousSchedule(rec)) return false;

    const rawCardsMinutes = getRawDailyCardsMinutes(rec);

    // Αν οι πραγματικές ώρες καρτών μείον το διάλειμμα πέφτουν κάτω από 4 ώρες,
    // δεν αφαιρούμε διάλειμμα για τη συγκεκριμένη ημερομηνία.
    return rawCardsMinutes - breakMinutes >= 4 * 60;
}

function expandIntervalFromTimes(apoOra, eosOra) {
    const apo = timeToMinutesSafe(apoOra);
    const eos = timeToMinutesSafe(eosOra);

    if (apo === null || eos === null) return null;

    let start = apo;
    let end = eos;

    if (end <= start) {
        end += 1440;
    }

    return { start, end };
}

function emptyClassifiedMinutes() {
    return {
        normal: 0,
        night: 0,
        holiday: 0,
        holidayNight: 0
    };
}

function addClassifiedMinute(bucket, rec, minuteFromBaseDate, argiesDateSet) {
    const isNight = isMinuteNight(minuteFromBaseDate);
    const isHoliday = isMinuteSundayOrHoliday(rec.hmeromhnia, minuteFromBaseDate, argiesDateSet);

    if (isNight && isHoliday) {
        bucket.holidayNight++;
    } else if (isHoliday) {
        bucket.holiday++;
    } else if (isNight) {
        bucket.night++;
    } else {
        bucket.normal++;
    }
}

function toHours(minutes) {
    return +(minutes / 60).toFixed(2);
}

function buildWeeklyIllegalOvertimeUpdate(
    rec,
    workTerms,
    illegalOvertimeHours,
    argiesDateSet,
    options = {}
) {
    const targetMinutes = Math.max(0, Math.round(Number(illegalOvertimeHours || 0) * 60));
    const workedMinutes = [];

    for (const interval of getPayrollCalculationIntervals(rec, workTerms)) {
        for (let minute = interval.start; minute < interval.end; minute++) {
            workedMinutes.push(minute);
        }
    }

    const illegalMinutes = workedMinutes.slice(Math.max(0, workedMinutes.length - targetMinutes));
    const classified = emptyClassifiedMinutes();
    for (const minute of illegalMinutes) {
        addClassifiedMinute(classified, rec, minute, argiesDateSet);
    }

    return buildWeeklyIllegalOvertimePersistenceMapping(
        {
            normal: toHours(classified.normal),
            night: toHours(classified.night),
            holiday: toHours(classified.holiday),
            holidayNight: toHours(classified.holidayNight)
        },
        { ...options, authoritativeTotalHours: Number(illegalOvertimeHours || 0) }
    );
}

function getCardIntervals(rec, ergazomenos = null) {
    const intervals = getRawCardIntervals(rec);

    if (hasExactExternalBreaks(ergazomenos)) {
        return subtractExternalBreakIntervals(intervals, ergazomenos);
    }

    if (!shouldSubtractExternalBreak(rec, ergazomenos)) {
        return intervals;
    }

    const breakMinutes = getBreakOffsetMinutes(ergazomenos);

    return intervals
        .map((interval) => {
            if (interval.index !== 1) return interval;

            const adjustedEnd = interval.end - breakMinutes;

            if (adjustedEnd <= interval.start) {
                return null;
            }

            return {
                ...interval,
                eos: minutesToTimeSafe(adjustedEnd),
                end: adjustedEnd,
                externalBreakSubtractedMinutes: breakMinutes
            };
        })
        .filter(Boolean);
}

function isMinuteNight(minuteFromBaseDate) {
    const minute = minuteFromBaseDate % 1440;

    // Νύχτα: 22:01 - 06:00.
    // Πρακτικά σε λεπτά: >= 22:00 και <= 06:00.
    return minute >= 22 * 60 || minute < 6 * 60;
}

function isMinuteSundayOrHoliday(baseDate, minuteFromBaseDate, argiesDateSet) {
    const dayOffset = Math.floor(minuteFromBaseDate / 1440);
    const d = addDaysUtc(baseDate, dayOffset);

    return isSundayOrHoliday(d, argiesDateSet);
}

function getApologistikaIntervals(rec = {}) {
    return [
        {
            index: 1,
            apo: rec.apo_ora_01_apologistika,
            eos: rec.eos_ora_01_apologistika
        },
        {
            index: 2,
            apo: rec.apo_ora_02_apologistika,
            eos: rec.eos_ora_02_apologistika
        },
        {
            index: 3,
            apo: rec.apo_ora_03_apologistika,
            eos: rec.eos_ora_03_apologistika
        }
    ]
        .map((interval) => {
            const expanded = expandIntervalFromTimes(interval.apo, interval.eos);

            if (!expanded) return null;

            return {
                ...interval,
                start: expanded.start,
                end: expanded.end,
                source: 'APOLOGISTIKA'
            };
        })
        .filter(Boolean);
}

function getPayrollCalculationIntervals(rec, ergazomenos = null) {
    const verification = resolveCardPairVerification(rec);
    const apologistikaIntervals = getApologistikaIntervals(rec);

    if (rec?.orphan_card_resolution?.status === 'HR_APPROVED' &&
        apologistikaIntervals.length > 0) {
        return subtractExternalBreakIntervals(apologistikaIntervals, ergazomenos);
    }

    if (verification.hasUnresolvedCardEvidence) {
        return subtractExternalBreakIntervals(verification.completePairs.map((pair) => ({
            index: Number(pair.pairNumber),
            apo: pair.start,
            eos: pair.end,
            start: pair.startMinutes,
            end: pair.isOvernight ? pair.endMinutes + 1440 : pair.endMinutes,
            source: 'CARD_PARTIALLY_VERIFIED'
        })), ergazomenos);
    }

    const rawIntervals = getCardIntervals(rec, ergazomenos);
    if (rec.egkekrimenh_oroadeia_apologistika === true || rec.egkekrimenh_anaplhrosh_apologistika) {
        let previousStart = -Infinity;
        const declaredStart = timeToMinutesSafe(rec.apo_ora_01);
        const declaredEnd = timeToMinutesSafe(rec.eos_ora_01);
        if (declaredStart !== null && declaredEnd !== null && declaredEnd < declaredStart &&
            rawIntervals[0]?.start < declaredStart && rawIntervals[0]?.start < declaredEnd) previousStart = 1440;
        return rawIntervals.map(interval => {
            let { start, end } = interval;
            while (start < previousStart) { start += 1440; end += 1440; }
            previousStart = start;
            return { ...interval, start, end };
        });
    }
    if (rawIntervals.length > 0 ||
        (hasExactExternalBreaks(ergazomenos) && getRawCardIntervals(rec).length > 0)) {
        return rawIntervals;
    }

    return apologistikaIntervals;
}

module.exports = { CALCULATION_SOURCE_VERSION,
    timeToMinutesSafe,
    minutesToTimeSafe,
    hasTime,
    addDaysUtc,
    dateKeyUtc,
    isSundayOrHoliday,
    getBreakOffsetMinutes,
    isDeclaredContinuousSchedule,
    isCardsContinuousSchedule,
    isZeroLengthTimePair,
    getRawCardIntervals,
    getRawDailyCardsMinutes,
    shouldSubtractExternalBreak,
    expandIntervalFromTimes,
    emptyClassifiedMinutes,
    addClassifiedMinute,
    toHours,
    buildWeeklyIllegalOvertimeUpdate,
    getCardIntervals,
    isMinuteNight,
    isMinuteSundayOrHoliday,
    getApologistikaIntervals,
    getPayrollCalculationIntervals };
