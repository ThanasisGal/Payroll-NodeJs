const mongoose = require('mongoose');

const {
    ErgazomenoiModel,
    ProdhlomenaOrariaModel,
    IstorikoProslhpseonAllagonModel
} = require('../../models/ergazomenoi');
const {
    getIstorikoOronErgasiasForPeriod,
    normalizeDateOnly
} = require('../../utils/ergazomenoi/getIstorikoOronErgasiasForPeriod');
const {
    buildDailyOrarioTermsForPeriod,
    formatDateYMD,
    addDays
} = require('../../utils/ergazomenoi/buildDailyOrarioTermsForPeriod');

const HOURS_TOLERANCE = 0.01;
const WEEKLY_40H_TOLERANCE = 0.1;
const SIX_DAY_40H_FULL_DAILY_HOURS = +(40 / 6).toFixed(4);
const KATHESTOS_LABELS = {
    0: 'PLHRHS',
    1: 'MERIKH',
    2: 'EK_PERITROPHS'
};

function toTrimmedString(value) {
    return String(value ?? '').trim();
}

function toNumberOrZero(value) {
    if (value === null || value === undefined || value === '') return 0;

    const n = Number(String(value).replace(',', '.').trim());
    return Number.isFinite(n) ? n : 0;
}

function formatDateOnly(value) {
    const d = normalizeDateOnly(value);
    return d ? formatDateYMD(d) : null;
}

function buildPeriodRange(year, period) {
    const numericYear = Number.parseInt(toTrimmedString(year), 10);
    const numericPeriod = Number.parseInt(toTrimmedString(period), 10);

    if (
        !Number.isInteger(numericYear) ||
        !Number.isInteger(numericPeriod) ||
        numericPeriod < 1 ||
        numericPeriod > 12
    ) {
        return { periodStart: null, periodEnd: null };
    }

    const periodStart = new Date(Date.UTC(numericYear, numericPeriod - 1, 1, 0, 0, 0, 0));
    const lastDay = new Date(Date.UTC(numericYear, numericPeriod, 0)).getUTCDate();
    const periodEnd = new Date(Date.UTC(numericYear, numericPeriod - 1, lastDay, 0, 0, 0, 0));

    return { periodStart, periodEnd };
}

function buildExplicitPeriodRange(periodApo, periodEos) {
    const periodStart = parseDateOnlyUTC(periodApo);
    const periodEnd = parseDateOnlyUTC(periodEos);

    if (!periodStart || !periodEnd || periodStart > periodEnd) {
        return { periodStart: null, periodEnd: null };
    }

    return { periodStart, periodEnd };
}

function maxDate(a, b) {
    if (!a) return b;
    if (!b) return a;
    return a > b ? a : b;
}

function minDate(a, b) {
    if (!a) return b;
    if (!b) return a;
    return a < b ? a : b;
}

function endOfDay(value) {
    const d = normalizeDateOnly(value);
    if (!d) return null;

    d.setUTCHours(23, 59, 59, 999);
    return d;
}

function normalizeKathestosCode(value) {
    const raw = toTrimmedString(value).toUpperCase();
    if (!raw) return '';

    if (raw === '0' || raw === 'ΠΛΗΡΗΣ' || raw === 'PLHRHS') return '0';
    if (raw === '1' || raw === 'ΜΕΡΙΚΗ' || raw === 'MERIKH') return '1';
    if (
        raw === '2' ||
        raw === 'ΕΚ ΠΕΡΙΤΡΟΠΗΣ' ||
        raw === 'ΕΚ_ΠΕΡΙΤΡΟΠΗΣ' ||
        raw === 'EK_PERITROPHS'
    ) {
        return '2';
    }

    return '';
}

function buildEmployeeContractStatusInterval({
    employee = {},
    periodApo,
    periodEos,
    warnings = [],
    missingWarning,
    source = 'ERG_AKTUAL'
}) {
    const code = normalizeKathestosCode(employee.kathestos_apasxolhshs);
    if (!code) {
        if (missingWarning) warnings.push(missingWarning);
        return null;
    }

    return {
        apo: periodApo,
        eos: periodEos,
        kathestosCode: code,
        kathestos: KATHESTOS_LABELS[code] || '',
        source
    };
}

function buildContractStatusFromEmployee(employee = {}, periodApo, periodEos, warnings = []) {
    const interval = buildEmployeeContractStatusInterval({
        employee,
        periodApo,
        periodEos,
        warnings,
        missingWarning:
            'CONTRACT_STATUS_MISSING: Δεν βρέθηκε καθαρό kathestos_apasxolhshs σε ιστορικό ή εργαζόμενο. Χρησιμοποιήθηκε το υπάρχον heuristic classification.'
    });

    if (!interval) return [];

    warnings.push(
        'CONTRACT_HISTORY_MISSING: Δεν βρέθηκε ιστορικό σύμβασης με kathestos_apasxolhshs. Χρησιμοποιήθηκε fallback από ErgazomenoiModel.kathestos_apasxolhshs.'
    );

    return [interval];
}

async function loadContractStatusHistory({
    team,
    company_kod,
    kodikos,
    periodEos
}) {
    const eosEndOfDay = endOfDay(periodEos);
    if (!eosEndOfDay) return [];

    return IstorikoProslhpseonAllagonModel.find({
        team: toTrimmedString(team),
        company_kod: toTrimmedString(company_kod),
        kodikos: toTrimmedString(kodikos),
        hmeromhnia_allaghs_symbashs: mongoose.trusted({ $lte: eosEndOfDay })
    })
        .select('hmeromhnia_allaghs_symbashs kathestos_apasxolhshs')
        .sort({ hmeromhnia_allaghs_symbashs: 1, createdAt: 1 })
        .lean();
}

function buildContractStatusIntervals({
    historyRows = [],
    employee = {},
    periodApo,
    periodEos,
    warnings = []
}) {
    const apo = normalizeDateOnly(periodApo);
    const eos = normalizeDateOnly(periodEos);
    if (!apo || !eos || apo > eos) return [];

    const rows = (Array.isArray(historyRows) ? historyRows : [])
        .map((row) => ({
            date: normalizeDateOnly(row?.hmeromhnia_allaghs_symbashs),
            kathestosCode: normalizeKathestosCode(row?.kathestos_apasxolhshs)
        }))
        .filter((row) => row.date && row.kathestosCode)
        .sort((a, b) => a.date.getTime() - b.date.getTime());

    if (rows.length === 0) {
        return buildContractStatusFromEmployee(employee, apo, eos, warnings);
    }

    const effectiveRows = rows.filter((row, index) => {
        const isLastBeforePeriod = row.date <= apo && !rows
            .slice(index + 1)
            .some((nextRow) => nextRow.date <= apo);

        return isLastBeforePeriod || (row.date >= apo && row.date <= eos);
    });
    const intervals = [];

    if (effectiveRows.length > 0 && effectiveRows[0].date > apo) {
        const leadingEos = addDays(effectiveRows[0].date, -1);
        const leadingInterval = buildEmployeeContractStatusInterval({
            employee,
            periodApo: apo,
            periodEos: leadingEos,
            warnings,
            missingWarning:
                'CONTRACT_STATUS_MISSING: Δεν βρέθηκε kathestos_apasxolhshs για το leading διάστημα πριν από την πρώτη αλλαγή ιστορικού. Χρησιμοποιήθηκε το υπάρχον heuristic classification.',
            source: 'ERG_AKTUAL_LEADING_FALLBACK'
        });

        if (leadingInterval && leadingInterval.apo <= leadingInterval.eos) {
            warnings.push(
                'CONTRACT_HISTORY_MISSING: Δεν βρέθηκε ιστορικό σύμβασης πριν ή πάνω στην αρχή της περιόδου. Το leading διάστημα καλύφθηκε από ErgazomenoiModel.kathestos_apasxolhshs.'
            );
            intervals.push(leadingInterval);
        }
    }

    effectiveRows.forEach((row, index) => {
        const nextRow = effectiveRows[index + 1];
        const intervalApo = maxDate(apo, row.date);
        const intervalEos = nextRow ? minDate(eos, addDays(nextRow.date, -1)) : eos;

        if (!intervalApo || !intervalEos || intervalApo > intervalEos) return;

        intervals.push({
            apo: intervalApo,
            eos: intervalEos,
            kathestosCode: row.kathestosCode,
            kathestos: KATHESTOS_LABELS[row.kathestosCode] || '',
            source: 'ISTORIKO'
        });
    });

    if (intervals.length === 0) {
        return buildContractStatusFromEmployee(employee, apo, eos, warnings);
    }

    return intervals;
}

function getContractStatusForDate(dateValue, intervals = []) {
    const date = normalizeDateOnly(dateValue);
    if (!date) return null;

    return intervals.find((interval) => {
        const apo = normalizeDateOnly(interval.apo);
        const eos = normalizeDateOnly(interval.eos);

        return apo && eos && date >= apo && date <= eos;
    }) || null;
}

function isBoundaryPartialWeekPhase(phase = {}, activeFrom, activeTo) {
    const phaseApo = parseDateOnlyUTC(phase.apo);
    const phaseEos = parseDateOnlyUTC(phase.eos);
    const start = parseDateOnlyUTC(activeFrom);
    const end = parseDateOnlyUTC(activeTo);

    if (!phaseApo || !phaseEos || !start || !end) return false;

    const startsAtBoundary = phaseApo.getTime() === start.getTime() && start.getUTCDay() !== 1;
    const endsAtBoundary = phaseEos.getTime() === end.getTime() && end.getUTCDay() !== 0;

    return startsAtBoundary || endsAtBoundary;
}

function applyContractStatusBoundaryOverrides(phases = [], contractStatusIntervals = [], activeFrom, activeTo) {
    return phases.map((phase) => {
        if (
            phase.detectedKathestosCode !== '0' ||
            phase.phasePatternKind === 'SIX_DAY_40H_PATTERN' ||
            !isBoundaryPartialWeekPhase(phase, activeFrom, activeTo)
        ) {
            return phase;
        }

        const contractStatus = [
            getContractStatusForDate(phase.apo, contractStatusIntervals),
            getContractStatusForDate(phase.eos, contractStatusIntervals)
        ].find((status) => status?.kathestosCode === '2');

        if (!contractStatus) {
            return phase;
        }

        const warnings = Array.isArray(phase.warnings) ? [...phase.warnings] : [];
        warnings.push(
            'CONTRACT_STATUS_TIMELINE_BOUNDARY_OVERRIDE: Boundary partial week διορθώθηκε σε EK_PERITROPHS/code 2 από το ιστορικό σύμβασης.'
        );

        return {
            ...phase,
            detectedKathestos: 'EK_PERITROPHS',
            detectedKathestosCode: '2',
            contractStatusSource: contractStatus.source,
            contractStatusCode: contractStatus.kathestosCode,
            contractStatus: contractStatus.kathestos,
            contractStatusOverrideReason: 'CONTRACT_STATUS_TIMELINE_BOUNDARY_OVERRIDE',
            warnings
        };
    });
}

function buildFullDailyHours(terms = {}, warnings = []) {
    const mo = toNumberOrZero(terms.mo_oron_hmerhsias_ergasias);
    const hmeres = toNumberOrZero(terms.hmeres_ergasias_ebdomadas);

    if (mo > 0) {
        return +mo.toFixed(4);
    }

    if (hmeres === 5) return 8;
    if (hmeres === 6) return +(40 / 6).toFixed(4);

    warnings.push(
        `Δεν βρέθηκε αξιόπιστο mo_oron_hmerhsias_ergasias για ${terms.hmeromhnia}. Χρησιμοποιήθηκε fallback 8.`
    );
    return 8;
}

function classifyDay(hours, fullDailyHours) {
    if (hours >= fullDailyHours - HOURS_TOLERANCE) return 'FULL_DAY';
    if (hours > 0 && hours < fullDailyHours - HOURS_TOLERANCE) return 'PARTIAL_DAY';
    return 'NO_WORK';
}

function buildClassificationThresholdInfo(days) {
    const expectedWorkDaysForClassification = days.filter((day) => day.expectedWorkDay).length;
    const scheduledHoursTotalForClassification = days
        .filter((day) => day.expectedWorkDay)
        .reduce((sum, day) => sum + toNumberOrZero(day.scheduledHours), 0);
    const isSixDay40hPattern =
        expectedWorkDaysForClassification === 6 &&
        Math.abs(scheduledHoursTotalForClassification - 40) <= WEEKLY_40H_TOLERANCE;

    if (isSixDay40hPattern) {
        return {
            classificationFullDailyHours: SIX_DAY_40H_FULL_DAILY_HOURS,
            classificationThresholdReason: 'SIX_DAY_40H_PATTERN',
            scheduledHoursTotalForClassification: +scheduledHoursTotalForClassification.toFixed(4),
            expectedWorkDaysForClassification
        };
    }

    return {
        classificationFullDailyHours: null,
        classificationThresholdReason: 'BASE_TERMS',
        scheduledHoursTotalForClassification: +scheduledHoursTotalForClassification.toFixed(4),
        expectedWorkDaysForClassification
    };
}

function applyClassificationThresholdInfo(days, thresholdInfo) {
    days.forEach((day) => {
        day.classificationFullDailyHours =
            thresholdInfo.classificationFullDailyHours || day.fullDailyHours;
        day.classificationThresholdReason = thresholdInfo.classificationThresholdReason;
        day.scheduledHoursTotalForClassification =
            thresholdInfo.scheduledHoursTotalForClassification;
        day.expectedWorkDaysForClassification =
            thresholdInfo.expectedWorkDaysForClassification;
        day.classification = classifyDay(day.classificationHours, day.classificationFullDailyHours);
    });
}

function analyzePhasePattern(days, partialDayCount, fullDayCount) {
    const firstDay = days[0] || {};
    const classificationThresholdReason = firstDay.classificationThresholdReason || 'BASE_TERMS';
    const weeklyDaysForTerms =
        classificationThresholdReason === 'SIX_DAY_40H_PATTERN'
            ? toNumberOrZero(firstDay.expectedWorkDaysForClassification)
            : toNumberOrZero(firstDay.hmeres_ergasias_ebdomadas);
    const weeklyHoursForTerms =
        classificationThresholdReason === 'SIX_DAY_40H_PATTERN'
            ? toNumberOrZero(firstDay.scheduledHoursTotalForClassification)
            : toNumberOrZero(firstDay.ores_ergasias_ebdomadas);

    if (classificationThresholdReason === 'SIX_DAY_40H_PATTERN') {
        return {
            weeklyDaysForTerms,
            weeklyHoursForTerms,
            isReducedWeeklyTerms: false,
            reducedWeeklyTermsReason: '',
            phasePatternKind: 'SIX_DAY_40H_PATTERN'
        };
    }

    if (partialDayCount > 0) {
        return {
            weeklyDaysForTerms,
            weeklyHoursForTerms,
            isReducedWeeklyTerms: false,
            reducedWeeklyTermsReason: '',
            phasePatternKind: 'PARTIAL_DAY_TERMS'
        };
    }

    const expectedActiveWorkDays = days.filter((day) => day.expectedWorkDay).length;
    const explicitScheduledNoWorkDays = days.filter((day) => {
        const scheduledKathgoria = toTrimmedString(day.scheduledKathgoria);

        return !day.expectedWorkDay && (scheduledKathgoria === 'ΑΝ' || scheduledKathgoria === 'ΜΕ');
    }).length;
    const hasReducedExpectedFullDayPattern =
        weeklyDaysForTerms >= 5 &&
        expectedActiveWorkDays > 0 &&
        expectedActiveWorkDays < weeklyDaysForTerms &&
        expectedActiveWorkDays === fullDayCount &&
        explicitScheduledNoWorkDays > 0 &&
        expectedActiveWorkDays + explicitScheduledNoWorkDays >= weeklyDaysForTerms;

    if (hasReducedExpectedFullDayPattern) {
        return {
            weeklyDaysForTerms,
            weeklyHoursForTerms,
            isReducedWeeklyTerms: true,
            reducedWeeklyTermsReason: 'EXPECTED_FULL_WORK_DAYS_BELOW_FULL_WEEKLY_PATTERN',
            phasePatternKind: 'REDUCED_FULL_DAYS_WEEKLY_TERMS'
        };
    }

    const isReducedWeeklyTerms =
        weeklyHoursForTerms > 0 &&
        weeklyHoursForTerms < 40 &&
        weeklyDaysForTerms > 0 &&
        weeklyDaysForTerms < 5 &&
        fullDayCount > 0;
    const isReducedDailyHoursWeeklyTerms =
        weeklyHoursForTerms > 0 &&
        weeklyHoursForTerms < 40 &&
        weeklyDaysForTerms >= 5 &&
        fullDayCount > 0;

    if (isReducedDailyHoursWeeklyTerms) {
        return {
            weeklyDaysForTerms,
            weeklyHoursForTerms,
            isReducedWeeklyTerms: false,
            reducedWeeklyTermsReason: 'WEEKLY_HOURS_BELOW_FULL_TIME_WITH_FIVE_OR_MORE_DAYS',
            phasePatternKind: 'REDUCED_DAILY_HOURS_WEEKLY_TERMS'
        };
    }

    if (isReducedWeeklyTerms) {
        return {
            weeklyDaysForTerms,
            weeklyHoursForTerms,
            isReducedWeeklyTerms: true,
            reducedWeeklyTermsReason: 'WEEKLY_DAYS_AND_HOURS_BELOW_FULL_TIME_WITH_FULL_DAYS',
            phasePatternKind: 'REDUCED_FULL_DAY_WEEKLY_TERMS'
        };
    }

    if (weeklyHoursForTerms >= 40) {
        return {
            weeklyDaysForTerms,
            weeklyHoursForTerms,
            isReducedWeeklyTerms: false,
            reducedWeeklyTermsReason: '',
            phasePatternKind: 'FULL_WEEKLY_TERMS'
        };
    }

    return {
        weeklyDaysForTerms,
        weeklyHoursForTerms,
        isReducedWeeklyTerms: false,
        reducedWeeklyTermsReason: '',
        phasePatternKind: 'UNKNOWN'
    };
}

function getEffectiveKathgoria(row = {}) {
    const apologistiki = toTrimmedString(row.kathgoria_ergasias_apologistika);
    if (apologistiki) return apologistiki;

    return toTrimmedString(row.kathgoria_ergasias);
}

function buildExpectedWorkInfo(row, kartaErgasias, warnings = []) {
    const sourceField = kartaErgasias ? 'ores_ergasias_apologistika' : 'ores_ergasias';

    if (!row) {
        return {
            expectedWorkDay: false,
            actualWorkedDay: false,
            effectiveKathgoria: '',
            scheduledKathgoria: '',
            actualKathgoria: '',
            sourceField,
            classificationSourceField: sourceField,
            scheduledHours: 0,
            actualHours: 0,
            payHours: 0,
            classificationHours: 0,
            relevantHours: 0,
            repo: false,
            repo_apologistika: false,
            isRepoDay: false
        };
    }

    const effectiveKathgoria = getEffectiveKathgoria(row);
    const scheduledKathgoria = toTrimmedString(row.kathgoria_ergasias);
    const actualKathgoria = toTrimmedString(row.kathgoria_ergasias_apologistika);
    const scheduledHours = toNumberOrZero(row.ores_ergasias);
    const actualHours = toNumberOrZero(row.ores_ergasias_apologistika);
    const payHours = kartaErgasias ? actualHours : scheduledHours;
    const hasScheduledPattern = scheduledHours > 0 || scheduledKathgoria !== '';
    const classificationHours = hasScheduledPattern ? scheduledHours : payHours;
    const classificationSourceField = hasScheduledPattern ? 'ores_ergasias' : sourceField;
    const repo = row.repo === true;
    const repoApologistika = row.repo_apologistika === true;
    const isRepoDay = repo || repoApologistika || scheduledKathgoria === 'ΑΝ' || actualKathgoria === 'ΑΝ';
    const isScheduledWorkCategory = scheduledKathgoria === 'ΕΡΓ' || scheduledKathgoria === 'ΤΗΛ';
    const isScheduledNoWorkCategory = scheduledKathgoria === 'ΑΝ' || scheduledKathgoria === 'ΜΕ';
    const isActualWorkCategory = actualKathgoria === 'ΕΡΓ' || actualKathgoria === 'ΤΗΛ';
    const expectedWorkDay = isScheduledWorkCategory || scheduledHours > 0;
    const actualWorkedDay = isActualWorkCategory || actualHours > 0;

    if (isScheduledNoWorkCategory && actualWorkedDay) {
        warnings.push(
            'Υπάρχει απολογιστική εργασία σε ημέρα που δεν ήταν προδηλωμένη ως εργασία.'
        );
    }

    if (expectedWorkDay && actualHours === 0) {
        warnings.push(
            'Προδηλωμένη εργασία χωρίς απολογιστικές ώρες.'
        );
    }

    return {
        expectedWorkDay,
        actualWorkedDay,
        effectiveKathgoria,
        scheduledKathgoria,
        actualKathgoria,
        sourceField,
        classificationSourceField,
        scheduledHours,
        actualHours,
        payHours,
        classificationHours,
        relevantHours: payHours,
        repo,
        repo_apologistika: repoApologistika,
        isRepoDay
    };
}

function buildDailyFactHours(orario = null) {
    return {
        absenceHours: toNumberOrZero(orario?.ores_apoysias_apologistika),
        nightHours: toNumberOrZero(orario?.ores_nyxtas_apologistika),
        holidayHours: toNumberOrZero(orario?.ores_argion_prosayxhsh_apologistika),
        yperergasiaHours:
            toNumberOrZero(orario?.ores_yperergasias_apologistika) +
            toNumberOrZero(orario?.ores_yperergasias_nyxtas_apologistika) +
            toNumberOrZero(orario?.ores_yperergasias_argion_apologistika) +
            toNumberOrZero(orario?.ores_yperergasias_argion_nyxtas_apologistika),
        nomimiYperoriaHours:
            toNumberOrZero(orario?.ores_nominhs_yperorias_apologistika) +
            toNumberOrZero(orario?.ores_nominhs_yperorias_nyxtas_apologistika) +
            toNumberOrZero(orario?.ores_nominhs_yperorias_argion_apologistika) +
            toNumberOrZero(orario?.ores_nominhs_yperorias_argion_nyxtas_apologistika),
        paranomiYperoriaHours:
            toNumberOrZero(orario?.ores_paranomhs_yperorias_apologistika) +
            toNumberOrZero(orario?.ores_paranomhs_yperorias_nyxtas_apologistika) +
            toNumberOrZero(orario?.ores_paranomhs_yperorias_argion_apologistika) +
            toNumberOrZero(orario?.ores_paranomhs_yperorias_argion_nyxtas_apologistika),
        sixthDayHours: 0,
        prosthetiErgasiaHours: toNumberOrZero(orario?.ores_prostheths_ergasias_apologistika)
    };
}

function buildDailyRows({ activeFrom, activeTo, termsByDate, orariaByDate, kartaErgasias, warnings }) {
    const rows = [];

    for (let current = activeFrom; current <= activeTo; current = addDays(current, 1)) {
        const date = formatDateYMD(current);
        const terms = termsByDate.get(date) || {};
        const orario = orariaByDate.get(date) || null;
        const dayWarnings = [];
        const fullDailyHours = buildFullDailyHours({ ...terms, hmeromhnia: date }, dayWarnings);
        const expectedWorkInfo = buildExpectedWorkInfo(orario, kartaErgasias, dayWarnings);
        const classification = classifyDay(expectedWorkInfo.classificationHours, fullDailyHours);
        const dailyFactHours = buildDailyFactHours(orario);

        if (!orario) {
            dayWarnings.push(
                'Δεν βρέθηκε προδηλωμένη γραμμή για την ημέρα. Η expected work day εκτίμηση είναι μη αποδεδειγμένη.'
            );
        }

        warnings.push(...dayWarnings.map((warning) => `${date}: ${warning}`));

        rows.push({
            date,
            hours: expectedWorkInfo.payHours,
            scheduledHours: expectedWorkInfo.scheduledHours,
            actualHours: expectedWorkInfo.actualHours,
            payHours: expectedWorkInfo.payHours,
            classificationHours: expectedWorkInfo.classificationHours,
            fullDailyHours,
            classificationFullDailyHours: fullDailyHours,
            classificationThresholdReason: 'BASE_TERMS',
            scheduledHoursTotalForClassification: expectedWorkInfo.expectedWorkDay
                ? expectedWorkInfo.scheduledHours
                : 0,
            expectedWorkDaysForClassification: expectedWorkInfo.expectedWorkDay ? 1 : 0,
            classification,
            hmeres_ergasias_ebdomadas: toNumberOrZero(terms.hmeres_ergasias_ebdomadas),
            ores_ergasias_ebdomadas: toNumberOrZero(terms.ores_ergasias_ebdomadas),
            mo_oron_hmerhsias_ergasias: toNumberOrZero(terms.mo_oron_hmerhsias_ergasias),
            sourceField: expectedWorkInfo.sourceField,
            classificationSourceField: expectedWorkInfo.classificationSourceField,
            expectedWorkDay: expectedWorkInfo.expectedWorkDay,
            actualWorkedDay: expectedWorkInfo.actualWorkedDay,
            effectiveKathgoria: expectedWorkInfo.effectiveKathgoria,
            scheduledKathgoria: expectedWorkInfo.scheduledKathgoria,
            actualKathgoria: expectedWorkInfo.actualKathgoria,
            repo: expectedWorkInfo.repo,
            repo_apologistika: expectedWorkInfo.repo_apologistika,
            isRepoDay: expectedWorkInfo.isRepoDay,
            absenceHours: dailyFactHours.absenceHours,
            nightHours: dailyFactHours.nightHours,
            holidayHours: dailyFactHours.holidayHours,
            yperergasiaHours: dailyFactHours.yperergasiaHours,
            nomimiYperoriaHours: dailyFactHours.nomimiYperoriaHours,
            paranomiYperoriaHours: dailyFactHours.paranomiYperoriaHours,
            sixthDayHours: dailyFactHours.sixthDayHours,
            prosthetiErgasiaHours: dailyFactHours.prosthetiErgasiaHours,
            relevantHours: expectedWorkInfo.relevantHours,
            termsSource: terms.source || '',
            kathestos_apasxolhshs: terms.typos_apasxolhshs || '',
            typos_ebdomadas: terms.typos_ebdomadas || '',
            karta_ergasias: kartaErgasias,
            warnings: dayWarnings
        });
    }

    return rows;
}

function buildDayGroupKeyParts(day) {
    return {
        hmeres_ergasias_ebdomadas: day.hmeres_ergasias_ebdomadas,
        ores_ergasias_ebdomadas: day.ores_ergasias_ebdomadas,
        mo_oron_hmerhsias_ergasias: day.mo_oron_hmerhsias_ergasias,
        kathestos_apasxolhshs: day.kathestos_apasxolhshs,
        typos_ebdomadas: day.typos_ebdomadas,
        sourceField: day.sourceField,
        karta_ergasias: day.karta_ergasias
    };
}

function buildDayGroupKey(day) {
    const groupKeyParts = buildDayGroupKeyParts(day);

    return Object.values(groupKeyParts).join('|');
}

function parseDateOnlyUTC(dateValue) {
    const dateOnly = typeof dateValue === 'string'
        ? toTrimmedString(dateValue).slice(0, 10)
        : formatDateOnly(dateValue);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) return null;

    const [year, month, day] = dateOnly.split('-').map((part) => Number.parseInt(part, 10));
    return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

function addDaysUTC(date, days) {
    return new Date(Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate() + days,
        0,
        0,
        0,
        0
    ));
}

function formatDateYMDUTC(date) {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');

    return `${y}-${m}-${day}`;
}

function buildWeekGroupKey(dateValue) {
    const date = parseDateOnlyUTC(dateValue);
    if (!date) return '';

    const weekday = date.getUTCDay();
    const daysSinceMonday = weekday === 0 ? 6 : weekday - 1;
    const monday = addDaysUTC(date, -daysSinceMonday);

    return formatDateYMDUTC(monday);
}

function classifyPhase(days) {
    const workedDays = days.filter((day) => day.actualWorkedDay);
    const expectedActiveWorkDays = days.filter((day) => day.expectedWorkDay).length;
    const partialDayCount = days.filter((day) => day.classification === 'PARTIAL_DAY').length;
    const fullDayCount = days.filter((day) => day.expectedWorkDay && day.classification === 'FULL_DAY').length;
    const phasePattern = analyzePhasePattern(days, partialDayCount, fullDayCount);

    if (phasePattern.phasePatternKind === 'SIX_DAY_40H_PATTERN') {
        return { detectedKathestos: 'PLHRHS', detectedKathestosCode: '0', ...phasePattern };
    }

    if (partialDayCount > 0) {
        return { detectedKathestos: 'MERIKH', detectedKathestosCode: '1', ...phasePattern };
    }

    if (phasePattern.phasePatternKind === 'REDUCED_DAILY_HOURS_WEEKLY_TERMS') {
        return { detectedKathestos: 'MERIKH', detectedKathestosCode: '1', ...phasePattern };
    }

    if (phasePattern.isReducedWeeklyTerms) {
        return { detectedKathestos: 'EK_PERITROPHS', detectedKathestosCode: '2', ...phasePattern };
    }

    if (
        workedDays.length > 0 &&
        workedDays.length === fullDayCount &&
        expectedActiveWorkDays > workedDays.length
    ) {
        return { detectedKathestos: 'EK_PERITROPHS', detectedKathestosCode: '2', ...phasePattern };
    }

    return { detectedKathestos: 'PLHRHS', detectedKathestosCode: '0', ...phasePattern };
}

function buildPhaseFromDays(days, index, employee, kartaErgasias) {
    const phaseWarnings = [];
    const expectedActiveWorkDays = days.filter((day) => day.expectedWorkDay).length;
    const workedDays = days.filter((day) => day.actualWorkedDay).length;
    const fullDayCount = days.filter((day) => day.expectedWorkDay && day.classification === 'FULL_DAY').length;
    const partialDayCount = days.filter((day) => day.classification === 'PARTIAL_DAY').length;
    const noWorkDayCount = days.filter((day) => day.classification === 'NO_WORK').length;
    const totalHours = days.reduce((sum, day) => sum + toNumberOrZero(day.payHours), 0);
    const expectedUnknownCount = days.filter((day) => day.warnings.length > 0).length;
    const classification = classifyPhase(days);
    const firstDay = days[0] || {};

    if (expectedUnknownCount > 0) {
        phaseWarnings.push(
            'Υπάρχουν ημέρες χωρίς πλήρως αποδεδειγμένη expected work day εικόνα. Δείτε daily.warnings.'
        );
    }

    return {
        phaseNo: index + 1,
        aa_misthodosias: index + 1 <= 9 ? index + 1 : null,
        apo: days[0]?.date || null,
        eos: days[days.length - 1]?.date || null,
        typos_ergazomenon: employee.typos_ergazomenon || '',
        detectedKathestos: classification.detectedKathestos,
        detectedKathestosCode: classification.detectedKathestosCode,
        weeklyDaysForTerms: classification.weeklyDaysForTerms,
        weeklyHoursForTerms: classification.weeklyHoursForTerms,
        isReducedWeeklyTerms: classification.isReducedWeeklyTerms,
        reducedWeeklyTermsReason: classification.reducedWeeklyTermsReason,
        phasePatternKind: classification.phasePatternKind,
        source: 'ProdhlomenaOrariaModel + daily orario terms',
        karta_ergasias: kartaErgasias,
        hmeres_ergasias_ebdomadas: firstDay.hmeres_ergasias_ebdomadas,
        ores_ergasias_ebdomadas: firstDay.ores_ergasias_ebdomadas,
        mo_oron_hmerhsias_ergasias: firstDay.mo_oron_hmerhsias_ergasias,
        kathestos_apasxolhshs: firstDay.kathestos_apasxolhshs,
        typos_ebdomadas: firstDay.typos_ebdomadas,
        sourceField: firstDay.sourceField,
        groupKey: firstDay.groupKey || '',
        groupKeyParts: firstDay.groupKeyParts || {},
        classificationFullDailyHours: firstDay.classificationFullDailyHours,
        classificationThresholdReason: firstDay.classificationThresholdReason,
        scheduledHoursTotalForClassification: firstDay.scheduledHoursTotalForClassification,
        expectedWorkDaysForClassification: firstDay.expectedWorkDaysForClassification,
        totalHours: +totalHours.toFixed(4),
        workedDays,
        expectedActiveWorkDays,
        fullDayCount,
        partialDayCount,
        noWorkDayCount,
        daily: days.map((day) => ({
            date: day.date,
            hours: day.hours,
            scheduledHours: day.scheduledHours,
            actualHours: day.actualHours,
            payHours: day.payHours,
            classificationHours: day.classificationHours,
            fullDailyHours: day.fullDailyHours,
            classificationFullDailyHours: day.classificationFullDailyHours,
            classificationThresholdReason: day.classificationThresholdReason,
            classification: day.classification,
            hmeres_ergasias_ebdomadas: day.hmeres_ergasias_ebdomadas,
            ores_ergasias_ebdomadas: day.ores_ergasias_ebdomadas,
            mo_oron_hmerhsias_ergasias: day.mo_oron_hmerhsias_ergasias,
            sourceField: day.sourceField,
            classificationSourceField: day.classificationSourceField,
            relevantHours: day.relevantHours,
            expectedWorkDay: day.expectedWorkDay,
            actualWorkedDay: day.actualWorkedDay,
            effectiveKathgoria: day.effectiveKathgoria,
            scheduledKathgoria: day.scheduledKathgoria,
            actualKathgoria: day.actualKathgoria,
            repo: day.repo,
            repo_apologistika: day.repo_apologistika,
            isRepoDay: day.isRepoDay,
            absenceHours: day.absenceHours,
            nightHours: day.nightHours,
            holidayHours: day.holidayHours,
            yperergasiaHours: day.yperergasiaHours,
            nomimiYperoriaHours: day.nomimiYperoriaHours,
            paranomiYperoriaHours: day.paranomiYperoriaHours,
            sixthDayHours: day.sixthDayHours,
            prosthetiErgasiaHours: day.prosthetiErgasiaHours,
            termsSource: day.termsSource,
            kathestos_apasxolhshs: day.kathestos_apasxolhshs,
            typos_ebdomadas: day.typos_ebdomadas,
            karta_ergasias: day.karta_ergasias,
            groupKey: day.groupKey,
            groupKeyParts: day.groupKeyParts,
            scheduledHoursTotalForClassification: day.scheduledHoursTotalForClassification,
            expectedWorkDaysForClassification: day.expectedWorkDaysForClassification,
            warnings: day.warnings
        })),
        warnings: phaseWarnings
    };
}

function groupDailyRowsIntoPhases(dailyRows, employee, kartaErgasias) {
    const groups = [];

    dailyRows.forEach((day) => {
        const groupKey = buildDayGroupKey(day);
        const weekGroupKey = buildWeekGroupKey(day.date);
        day.groupKey = groupKey;
        day.groupKeyParts = buildDayGroupKeyParts(day);
        const previousGroup = groups[groups.length - 1];

        if (
            !previousGroup ||
            previousGroup.groupKey !== groupKey ||
            previousGroup.weekGroupKey !== weekGroupKey
        ) {
            groups.push({ groupKey, weekGroupKey, days: [day] });
            return;
        }

        previousGroup.days.push(day);
    });

    return groups.map((group, index) => {
        const thresholdInfo = buildClassificationThresholdInfo(group.days);
        applyClassificationThresholdInfo(group.days, thresholdInfo);

        return buildPhaseFromDays(group.days, index, employee, kartaErgasias);
    });
}

function buildOperationalPhases(phases = []) {
    const operationalGroups = [];

    phases.forEach((phase) => {
        const previousGroup = operationalGroups[operationalGroups.length - 1];

        if (
            !previousGroup ||
            previousGroup.detectedKathestosCode !== phase.detectedKathestosCode
        ) {
            operationalGroups.push({
                detectedKathestos: phase.detectedKathestos,
                detectedKathestosCode: phase.detectedKathestosCode,
                sourcePhases: [phase]
            });
            return;
        }

        previousGroup.sourcePhases.push(phase);
    });

    return operationalGroups.map((group, index) => {
        const sourcePhases = group.sourcePhases;
        const firstPhase = sourcePhases[0] || {};
        const lastPhase = sourcePhases[sourcePhases.length - 1] || {};
        const warnings = sourcePhases.flatMap((phase) => Array.isArray(phase.warnings)
            ? phase.warnings
            : []);
        const phasePatternKinds = [
            ...new Set(sourcePhases.map((phase) => phase.phasePatternKind).filter(Boolean))
        ];
        const totalHours = sourcePhases.reduce(
            (sum, phase) => sum + toNumberOrZero(phase.totalHours),
            0
        );
        const workedDays = sourcePhases.reduce(
            (sum, phase) => sum + toNumberOrZero(phase.workedDays),
            0
        );
        const expectedActiveWorkDays = sourcePhases.reduce(
            (sum, phase) => sum + toNumberOrZero(phase.expectedActiveWorkDays),
            0
        );

        return {
            phaseNo: index + 1,
            aa_misthodosias: index + 1 <= 9 ? index + 1 : null,
            apo: firstPhase.apo || null,
            eos: lastPhase.eos || null,
            detectedKathestos: group.detectedKathestos,
            detectedKathestosCode: group.detectedKathestosCode,
            sourcePhaseNos: sourcePhases.map((phase) => phase.phaseNo).filter(Boolean),
            phasePatternKinds,
            totalHours: +totalHours.toFixed(4),
            workedDays,
            expectedActiveWorkDays,
            warnings,
            hasWarnings: warnings.length > 0
        };
    });
}

async function detectPayrollPhases({
    team,
    company_kod,
    kodikos,
    ypokatasthma = '',
    year,
    period,
    periodApoOverride,
    periodEosOverride
}) {
    const warnings = [];
    const hasExplicitPeriodRange = Boolean(periodApoOverride || periodEosOverride);
    const { periodStart, periodEnd } = hasExplicitPeriodRange
        ? buildExplicitPeriodRange(periodApoOverride, periodEosOverride)
        : buildPeriodRange(year, period);

    if (!periodStart || !periodEnd) {
        const error = new Error(
            hasExplicitPeriodRange
                ? 'Λείπει ή δεν είναι έγκυρο το ημερομηνιακό διάστημα.'
                : 'Λείπει ή δεν είναι έγκυρη η μισθολογική περίοδος.'
        );
        error.statusCode = 400;
        throw error;
    }

    const employee = await ErgazomenoiModel.findOne({
        team,
        company_kod,
        kodikos
    }).lean();

    if (!employee) {
        const error = new Error('Δεν βρέθηκε εργαζόμενος για τα στοιχεία της συνεδρίας.');
        error.statusCode = 404;
        throw error;
    }

    const hireDate = normalizeDateOnly(employee.hmeromhnia_proslhpshs);
    const leaveDate = normalizeDateOnly(employee.hmeromhnia_apoxorhshs);
    const activeFrom = maxDate(periodStart, hireDate);
    const activeTo = minDate(periodEnd, leaveDate);
    const kartaErgasias = employee.karta_ergasias === true;

    const emptyPayload = {
        employee: {
            kodikos: employee.kodikos,
            eponymo: employee.eponymo || '',
            onoma: employee.onoma || '',
            typos_ergazomenon: employee.typos_ergazomenon || '',
            karta_ergasias: kartaErgasias
        },
        period: {
            year: toTrimmedString(year),
            period: toTrimmedString(period),
            periodStart: formatDateOnly(periodStart),
            periodEnd: formatDateOnly(periodEnd),
            activeFrom: formatDateOnly(activeFrom),
            activeTo: formatDateOnly(activeTo)
        },
        phases: [],
        contractStatusIntervals: [],
        operationalPhases: [],
        operationalPhasesCount: 0,
        hasOperationalSplit: false,
        warnings
    };

    if (!activeFrom || !activeTo || activeFrom > activeTo) {
        warnings.push('Δεν υπάρχει ενεργό διάστημα εργαζομένου μέσα στη μισθολογική περίοδο.');
        return emptyPayload;
    }

    const contractHistoryRows = await loadContractStatusHistory({
        team,
        company_kod,
        kodikos,
        periodEos: activeTo
    });
    const contractStatusIntervals = buildContractStatusIntervals({
        historyRows: contractHistoryRows,
        employee,
        periodApo: activeFrom,
        periodEos: activeTo,
        warnings
    });

    const istorikoRows = await getIstorikoOronErgasiasForPeriod({
        team,
        company_kod,
        kodikos,
        aa_eggrafhs: employee.aa_eggrafhs,
        periodApo: activeFrom,
        periodEos: activeTo
    });

    const dailyTerms = buildDailyOrarioTermsForPeriod({
        periodApo: activeFrom,
        periodEos: activeTo,
        istorikoRows,
        ergazomenos: employee
    });
    const termsByDate = new Map(dailyTerms.map((terms) => [terms.hmeromhnia, terms]));

    const orariaFilter = {
        team,
        company_kod,
        kodikos,
        hmeromhnia: mongoose.trusted({
            $gte: activeFrom,
            $lte: activeTo
        })
    };

    if (toTrimmedString(ypokatasthma)) {
        orariaFilter.ypokatasthma = toTrimmedString(ypokatasthma);
    }

    const orariaRows = await ProdhlomenaOrariaModel.find(orariaFilter)
        .sort({ hmeromhnia: 1 })
        .lean();
    const orariaByDate = new Map(orariaRows.map((row) => [formatDateYMD(row.hmeromhnia), row]));

    if (orariaRows.length === 0) {
        warnings.push('Δεν βρέθηκαν προδηλωμένες γραμμές για το ενεργό διάστημα.');
    }

    const dailyRows = buildDailyRows({
        activeFrom,
        activeTo,
        termsByDate,
        orariaByDate,
        kartaErgasias,
        warnings
    });
    const phases = applyContractStatusBoundaryOverrides(
        groupDailyRowsIntoPhases(dailyRows, employee, kartaErgasias),
        contractStatusIntervals,
        activeFrom,
        activeTo
    );
    const operationalPhases = buildOperationalPhases(phases);

    if (phases.length > 9) {
        warnings.push(
            'Οι ανιχνευμένες φάσεις είναι περισσότερες από 9. Το aa_misthodosias υποστηρίζει 1 έως 9 και απαιτείται manual handling.'
        );
    }

    return {
        ...emptyPayload,
        period: {
            ...emptyPayload.period,
            activeFrom: formatDateOnly(activeFrom),
            activeTo: formatDateOnly(activeTo)
        },
        phases,
        contractStatusIntervals: contractStatusIntervals.map((interval) => ({
            apo: formatDateOnly(interval.apo),
            eos: formatDateOnly(interval.eos),
            kathestos: interval.kathestos,
            kathestosCode: interval.kathestosCode,
            source: interval.source
        })),
        operationalPhases,
        operationalPhasesCount: operationalPhases.length,
        hasOperationalSplit: operationalPhases.length > 1,
        warnings
    };
}

async function detectPayrollPhasesForDateRange({
    team,
    company_kod,
    kodikos,
    ypokatasthma = '',
    apo,
    eos
}) {
    return detectPayrollPhases({
        team,
        company_kod,
        kodikos,
        ypokatasthma,
        periodApoOverride: apo,
        periodEosOverride: eos
    });
}

module.exports = {
    detectPayrollPhases,
    detectPayrollPhasesForDateRange,
    buildPeriodRange
};
