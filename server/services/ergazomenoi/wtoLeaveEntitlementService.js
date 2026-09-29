'use strict';

const {
    resolveDailyActualWorkFacts
} = require('./apasxoliseisDailyActualWorkFactsService');

const DAY_MS = 24 * 60 * 60 * 1000;

function entitlementError(code, message, details = {}) {
    const error = new Error(message || code);
    error.code = code;
    error.statusCode = 409;
    error.details = details;
    return error;
}

function utcDate(value, field) {
    const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
    if (Number.isNaN(date.getTime())) {
        throw entitlementError('WTOLEAVE_INVALID_ENTITLEMENT_DATE', `Μη έγκυρη ${field}.`);
    }
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function dateKey(value) {
    return utcDate(value, 'ημερομηνία').toISOString().slice(0, 10);
}

function daysInUtcMonth(year, month) {
    return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function addYearsClamped(value, years) {
    const date = utcDate(value, 'ημερομηνία πρόσληψης');
    const year = date.getUTCFullYear() + years;
    const month = date.getUTCMonth();
    const day = Math.min(date.getUTCDate(), daysInUtcMonth(year, month));
    return new Date(Date.UTC(year, month, day));
}

function addDays(value, days) {
    return new Date(utcDate(value, 'ημερομηνία').getTime() + days * DAY_MS);
}

function completedServiceMonths(hireDate, referenceDate) {
    const hire = utcDate(hireDate, 'ημερομηνία πρόσληψης');
    const reference = utcDate(referenceDate, 'ημερομηνία αναφοράς');
    let months = (reference.getUTCFullYear() - hire.getUTCFullYear()) * 12 +
        reference.getUTCMonth() - hire.getUTCMonth();
    const anniversaryDay = Math.min(hire.getUTCDate(),
        daysInUtcMonth(reference.getUTCFullYear(), reference.getUTCMonth()));
    if (reference.getUTCDate() < anniversaryDay) months -= 1;
    return Math.max(0, months);
}

function completedServiceYears(hireDate, referenceDate) {
    let years = utcDate(referenceDate, 'ημερομηνία αναφοράς').getUTCFullYear() -
        utcDate(hireDate, 'ημερομηνία πρόσληψης').getUTCFullYear();
    if (utcDate(referenceDate, 'ημερομηνία αναφοράς') < addYearsClamped(hireDate, years)) years -= 1;
    return Math.max(0, years);
}

function largeServiceBasis({ weeklyDays, sameEmployerYears, previousLeaveServiceYears }) {
    if (sameEmployerYears >= 25 || previousLeaveServiceYears >= 25) {
        return weeklyDays === 5 ? 26 : 31;
    }
    if (sameEmployerYears >= 10 || previousLeaveServiceYears >= 12) {
        return weeklyDays === 5 ? 25 : 30;
    }
    return null;
}

function normalBasis(weeklyDays, completedMonths) {
    if (completedMonths < 12) return weeklyDays === 5 ? 20 : 24;
    if (completedMonths < 24) return weeklyDays === 5 ? 21 : 25;
    return weeklyDays === 5 ? 22 : 26;
}

function proratedCalendarMonths(startDate, endDate, annualBasisDays, mode) {
    const start = utcDate(startDate, 'έναρξη τμήματος');
    const end = utcDate(endDate, 'λήξη τμήματος');
    if (end < start) return null;
    let cursor = start;
    let monthEquivalent = 0;
    const monthFractions = [];
    while (cursor <= end) {
        const year = cursor.getUTCFullYear();
        const month = cursor.getUTCMonth();
        const monthEnd = new Date(Date.UTC(year, month + 1, 0));
        const coveredEnd = end < monthEnd ? end : monthEnd;
        const coveredDays = Math.floor((coveredEnd - cursor) / DAY_MS) + 1;
        const fraction = coveredDays / daysInUtcMonth(year, month);
        monthEquivalent += fraction;
        monthFractions.push(Object.freeze({
            month: `${year}-${String(month + 1).padStart(2, '0')}`,
            covered_days: coveredDays,
            calendar_days: daysInUtcMonth(year, month),
            month_fraction: fraction
        }));
        cursor = addDays(coveredEnd, 1);
    }
    return Object.freeze({
        mode,
        from: dateKey(start),
        to: dateKey(end),
        annual_basis_days: annualBasisDays,
        month_equivalent: monthEquivalent,
        raw_days: annualBasisDays * monthEquivalent / 12,
        month_fractions: monthFractions
    });
}

function regularSegments({ hireDate, referenceDate, weeklyDays, overrideBasis }) {
    const hire = utcDate(hireDate, 'ημερομηνία πρόσληψης');
    const reference = utcDate(referenceDate, 'ημερομηνία αναφοράς');
    const calendarEmploymentYear = reference.getUTCFullYear() - hire.getUTCFullYear() + 1;
    if (calendarEmploymentYear === 1) {
        return [proratedCalendarMonths(hire, reference,
            overrideBasis || (weeklyDays === 5 ? 20 : 24), 'FIRST_CALENDAR_YEAR')];
    }
    if (calendarEmploymentYear === 2) {
        const yearStart = new Date(Date.UTC(reference.getUTCFullYear(), 0, 1));
        if (overrideBasis) {
            return [proratedCalendarMonths(yearStart, reference, overrideBasis,
                'SECOND_CALENDAR_YEAR_OVERRIDE')];
        }
        const anniversary12 = addYearsClamped(hire, 1);
        const segments = [];
        const beforeEnd = addDays(anniversary12, -1);
        if (yearStart <= beforeEnd && yearStart <= reference) {
            segments.push(proratedCalendarMonths(yearStart,
                reference < beforeEnd ? reference : beforeEnd,
                weeklyDays === 5 ? 20 : 24, 'SECOND_YEAR_BEFORE_12_MONTHS'));
        }
        if (reference >= anniversary12) {
            segments.push(proratedCalendarMonths(anniversary12 < yearStart ? yearStart : anniversary12,
                reference, weeklyDays === 5 ? 21 : 25, 'SECOND_YEAR_FROM_12_MONTHS'));
        }
        return segments.filter(Boolean);
    }
    const basis = overrideBasis || normalBasis(weeklyDays, completedServiceMonths(hire, reference));
    return [Object.freeze({ mode: 'THIRD_CALENDAR_YEAR_OR_LATER',
        from: `${reference.getUTCFullYear()}-01-01`, to: dateKey(reference),
        annual_basis_days: basis, month_equivalent: 12, raw_days: basis,
        month_fractions: [] })];
}

function rotationalDateSegments({ startDate, referenceDate, hireDate, weeklyDays, overrideBasis }) {
    const start = utcDate(startDate, 'έναρξη υπολογισμού');
    const reference = utcDate(referenceDate, 'ημερομηνία αναφοράς');
    const boundaries = [start, addYearsClamped(hireDate, 1), addYearsClamped(hireDate, 2),
        addDays(reference, 1)]
        .filter((date) => date >= start && date <= addDays(reference, 1))
        .sort((left, right) => left - right);
    const unique = [...new Map(boundaries.map((date) => [dateKey(date), date])).values()];
    if (unique[0] > start) unique.unshift(start);
    if (unique[unique.length - 1] <= reference) unique.push(addDays(reference, 1));
    const segments = [];
    for (let index = 0; index < unique.length - 1; index += 1) {
        const from = unique[index];
        const to = addDays(unique[index + 1], -1);
        if (to < from) continue;
        segments.push({
            from,
            to,
            annualBasisDays: overrideBasis || normalBasis(weeklyDays,
                completedServiceMonths(hireDate, from))
        });
    }
    return segments;
}

function halfUp(value) {
    return Math.floor(value + 0.5 + Number.EPSILON);
}

function type2Round(value) {
    const floor = Math.floor(value + Number.EPSILON);
    return value - floor > 0.5 + Number.EPSILON ? floor + 1 : floor;
}

function calculateAnnualLeaveEntitlement({ hireDate, referenceDate, weeklyDays,
    employmentType, previousLeaveServiceYears = 0, actualWorkRows = [] } = {}) {
    const hire = utcDate(hireDate, 'ημερομηνία πρόσληψης');
    const reference = utcDate(referenceDate, 'ημερομηνία αναφοράς');
    if (reference < hire) {
        throw entitlementError('WTOLEAVE_REFERENCE_BEFORE_HIRE',
            'Η ημερομηνία άδειας προηγείται της ημερομηνίας πρόσληψης.');
    }
    const normalizedWeeklyDays = Number(weeklyDays);
    if (![5, 6].includes(normalizedWeeklyDays)) {
        throw entitlementError('WTOLEAVE_INVALID_WEEKLY_DAYS',
            'Οι ημέρες εβδομαδιαίας εργασίας πρέπει να είναι 5 ή 6.');
    }
    const normalizedType = String(employmentType ?? '').trim();
    if (!['0', '1', '2'].includes(normalizedType)) {
        throw entitlementError('WTOLEAVE_INVALID_EMPLOYMENT_TYPE',
            'Ο τύπος απασχόλησης πρέπει να είναι 0, 1 ή 2.');
    }
    const previousYears = Number(previousLeaveServiceYears || 0);
    if (!Number.isFinite(previousYears) || previousYears < 0) {
        throw entitlementError('WTOLEAVE_INVALID_PREVIOUS_SERVICE',
            'Η αναγνωριζόμενη προϋπηρεσία άδειας δεν είναι έγκυρη.');
    }
    const serviceMonths = completedServiceMonths(hire, reference);
    const sameEmployerYears = completedServiceYears(hire, reference);
    const overrideBasis = largeServiceBasis({ weeklyDays: normalizedWeeklyDays,
        sameEmployerYears, previousLeaveServiceYears: previousYears });
    const calendarEmploymentYear = reference.getUTCFullYear() - hire.getUTCFullYear() + 1;
    let segments;
    let entitledDaysRaw;
    let calculationMode;

    if (normalizedType === '2') {
        calculationMode = 'ROTATIONAL_INTERMITTENT_ACTUAL_DAYS';
        const jan1 = new Date(Date.UTC(reference.getUTCFullYear(), 0, 1));
        const start = hire > jan1 ? hire : jan1;
        const datedRows = new Map();
        for (const row of actualWorkRows || []) {
            const key = dateKey(row.hmeromhnia);
            if (key >= dateKey(start) && key <= dateKey(reference) && !datedRows.has(key)) {
                datedRows.set(key, row);
            }
        }
        segments = rotationalDateSegments({ startDate: start, referenceDate: reference,
            hireDate: hire, weeklyDays: normalizedWeeklyDays, overrideBasis }).map((segment) => {
            const actualDates = [...datedRows.entries()].filter(([key, row]) =>
                key >= dateKey(segment.from) && key <= dateKey(segment.to) &&
                resolveDailyActualWorkFacts(row).actualWorkHours > 0).map(([key]) => key);
            const actualEmploymentDays = actualDates.length;
            const monthEquivalent = actualEmploymentDays / 25;
            return Object.freeze({ mode: 'TYPE_2_ACTUAL_EMPLOYMENT_DAYS',
                from: dateKey(segment.from), to: dateKey(segment.to),
                annual_basis_days: segment.annualBasisDays,
                actual_employment_days: actualEmploymentDays,
                actual_work_dates: actualDates,
                month_equivalent: monthEquivalent,
                raw_days: monthEquivalent * segment.annualBasisDays / 12 });
        });
        entitledDaysRaw = segments.reduce((sum, segment) => sum + segment.raw_days, 0);
    } else {
        calculationMode = normalizedType === '1' ? 'REGULAR_PART_TIME_DAYS' : 'REGULAR_FULL_DAYS';
        segments = regularSegments({ hireDate: hire, referenceDate: reference,
            weeklyDays: normalizedWeeklyDays, overrideBasis });
        entitledDaysRaw = segments.reduce((sum, segment) => sum + segment.raw_days, 0);
    }
    const entitledDaysRounded = normalizedType === '2' ? type2Round(entitledDaysRaw) : halfUp(entitledDaysRaw);
    return Object.freeze({
        entitledDaysRaw,
        entitledDaysRounded,
        annualBasisDays: overrideBasis || normalBasis(normalizedWeeklyDays, serviceMonths),
        weeklyDays: normalizedWeeklyDays,
        calendarEmploymentYear,
        completedServiceMonths: serviceMonths,
        completedSameEmployerYears: sameEmployerYears,
        previousLeaveServiceYears: previousYears,
        employmentType: normalizedType,
        calculationMode,
        largeServiceOverride: overrideBasis !== null,
        segments
    });
}

module.exports = {
    calculateAnnualLeaveEntitlement,
    completedServiceMonths,
    completedServiceYears,
    proratedCalendarMonths,
    halfUp,
    type2Round,
    dateKey,
    addYearsClamped
};
