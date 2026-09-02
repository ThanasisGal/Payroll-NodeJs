const {
    dateKeyUtc,
    startOfWeekMondayUtc,
    endOfWeekSundayUtc
} = require('../../utils/date/mondaySundayWeek');
const {
    resolveCardPairVerification
} = require('./apasxoliseisCardPairResolverService');

function normalizeBranch(value) {
    const raw = String(value ?? '').trim();
    return raw ? raw.padStart(4, '0') : '';
}

function employmentReviewIdentity(row = {}) {
    const kodikos = String(row.kodikos || '').trim();
    const ypokatasthma = normalizeBranch(row.ypokatasthma);
    return kodikos && ypokatasthma ? `${ypokatasthma}|${kodikos}` : '';
}

function restrictBoundaryContextToPeriodEmployees(periodRows = [], contextRows = []) {
    const eligibleIdentities = new Set(periodRows.map(employmentReviewIdentity).filter(Boolean));
    return contextRows.filter((row) => eligibleIdentities.has(employmentReviewIdentity(row)));
}

function endOfDepartureDay(value) {
    const key = dateKeyUtc(value);
    return key ? new Date(`${key}T23:59:59.999Z`) : null;
}

function startOfHireDay(value) {
    const key = dateKeyUtc(value);
    return key ? new Date(`${key}T00:00:00.000Z`) : null;
}

function buildPostDepartureExclusionDescriptors(employees = []) {
    const grouped = new Map();

    for (const employee of employees) {
        const kodikos = String(employee?.kodikos || '').trim();
        if (!kodikos) continue;
        const ypokatasthma = normalizeBranch(employee?.ypokatasthma);
        const key = `${ypokatasthma}|${kodikos}`;
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key).push(employee);
    }

    const descriptors = [];
    for (const employeesForIdentity of grouped.values()) {
        // Αν υπάρχει ενεργή εγγραφή χωρίς αποχώρηση, δεν αποκλείουμε γραμμές
        // με βάση κάποιο παλιό/διπλό employee record.
        if (employeesForIdentity.some((employee) => !endOfDepartureDay(employee.hmeromhnia_apoxorhshs))) {
            continue;
        }

        const departureEnds = employeesForIdentity
            .map((employee) => endOfDepartureDay(employee.hmeromhnia_apoxorhshs))
            .filter(Boolean)
            .sort((a, b) => b.getTime() - a.getTime());
        if (departureEnds.length === 0) continue;

        const employee = employeesForIdentity[0];
        descriptors.push({
            kodikos: String(employee.kodikos || '').trim(),
            ypokatasthma: normalizeBranch(employee.ypokatasthma),
            departureEnd: departureEnds[0]
        });
    }

    return descriptors;
}

function isDateWithinEmploymentPeriod(value, employee = {}) {
    const rowKey = dateKeyUtc(value);
    if (!rowKey) return false;
    const hireKey = dateKeyUtc(employee.hmeromhnia_proslhpshs);
    const departureKey = dateKeyUtc(employee.hmeromhnia_apoxorhshs);
    if (hireKey && rowKey < hireKey) return false;
    if (departureKey && rowKey > departureKey) return false;
    return true;
}

function isWeekFullyWithinEmploymentPeriod(value, employee = {}) {
    const weekStart = dateKeyUtc(startOfWeekMondayUtc(value));
    const weekEnd = dateKeyUtc(endOfWeekSundayUtc(value));
    if (!weekStart || !weekEnd) return false;
    const hireKey = dateKeyUtc(employee.hmeromhnia_proslhpshs);
    const departureKey = dateKeyUtc(employee.hmeromhnia_apoxorhshs);
    if (hireKey && weekStart < hireKey) return false;
    if (departureKey && weekEnd > departureKey) return false;
    return true;
}

function enumerateDateKeys(startValue, endValue) {
    const startKey = dateKeyUtc(startValue);
    const endKey = dateKeyUtc(endValue);
    if (!startKey || !endKey || startKey > endKey) return [];
    const result = [];
    for (let current = new Date(`${startKey}T00:00:00.000Z`);
        dateKeyUtc(current) <= endKey; current.setUTCDate(current.getUTCDate() + 1)) {
        result.push(dateKeyUtc(current));
    }
    return result;
}

function deriveEmploymentOwnedDateScope({ natural_week_start, natural_week_end,
    period_start = natural_week_start, period_end = natural_week_end,
    hire_date = null, departure_date = null } = {}) {
    const naturalStart = dateKeyUtc(natural_week_start);
    const naturalEnd = dateKeyUtc(natural_week_end);
    const periodStart = dateKeyUtc(period_start);
    const periodEnd = dateKeyUtc(period_end);
    const hire = dateKeyUtc(hire_date);
    const departure = dateKeyUtc(departure_date);
    if (!naturalStart || !naturalEnd || !periodStart || !periodEnd ||
        naturalStart > naturalEnd || periodStart > periodEnd) return null;
    const employmentStart = hire && hire > naturalStart ? hire : naturalStart;
    const employmentEnd = departure && departure < naturalEnd ? departure : naturalEnd;
    const employmentDates = employmentStart <= employmentEnd
        ? enumerateDateKeys(employmentStart, employmentEnd) : [];
    const ownedDates = employmentDates.filter((key) =>
        key >= periodStart && key <= periodEnd);
    return Object.freeze({
        natural_week_start: naturalStart,
        natural_week_end: naturalEnd,
        period_start: periodStart,
        period_end: periodEnd,
        employment_start: employmentStart,
        employment_end: employmentEnd,
        employment_owned_dates: Object.freeze(employmentDates),
        authoritative_date_set: Object.freeze(ownedDates),
        context_only_dates: Object.freeze(employmentDates.filter((key) =>
            !ownedDates.includes(key))),
        is_full_natural_week: employmentDates.length === 7 &&
            employmentDates[0] === naturalStart && employmentDates[6] === naturalEnd
    });
}

function isFullCalendarMonthRange(periodStartValue, periodEndValue) {
    const periodStart = dateKeyUtc(periodStartValue);
    const periodEnd = dateKeyUtc(periodEndValue);
    if (!periodStart || !periodEnd || !periodStart.endsWith('-01') ||
        periodStart.slice(0, 7) !== periodEnd.slice(0, 7)) return false;
    const [year, month] = periodStart.split('-').map(Number);
    return periodEnd === new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

function buildFullMonthBoundaryContextPreflight({ period_start, period_end,
    employees = [], previous_rows = [], next_rows = [] } = {}) {
    const periodStart = dateKeyUtc(period_start);
    const periodEnd = dateKeyUtc(period_end);
    if (!isFullCalendarMonthRange(periodStart, periodEnd)) return null;
    const naturalStart = dateKeyUtc(startOfWeekMondayUtc(periodStart));
    const naturalEnd = dateKeyUtc(endOfWeekSundayUtc(periodEnd));
    const previousEnd = new Date(`${periodStart}T00:00:00.000Z`);
    previousEnd.setUTCDate(previousEnd.getUTCDate() - 1);
    const nextStart = new Date(`${periodEnd}T00:00:00.000Z`);
    nextStart.setUTCDate(nextStart.getUTCDate() + 1);
    const previousDates = enumerateDateKeys(naturalStart, dateKeyUtc(previousEnd));
    const nextDates = enumerateDateKeys(dateKeyUtc(nextStart), naturalEnd);
    const employeeRecordsByKey = new Map();
    for (const employee of employees) {
        const employeeKey = `${normalizeBranch(employee?.ypokatasthma)}|${String(employee?.kodikos || '').trim()}`;
        if (!employeeRecordsByKey.has(employeeKey)) employeeRecordsByKey.set(employeeKey, []);
        employeeRecordsByKey.get(employeeKey).push(employee);
    }
    const periodDates = enumerateDateKeys(periodStart, periodEnd);
    const activeEmploymentRecordsByKey = new Map([...employeeRecordsByKey.entries()]
        .map(([employeeKey, records]) => [employeeKey, records.filter((employee) =>
            periodDates.some((date) => isDateWithinEmploymentPeriod(date, employee)))])
        .filter(([, records]) => records.length));
    const activeDuringPeriod = [...activeEmploymentRecordsByKey.values()].map((records) => records[0]);
    const side = (dates, rows = []) => {
        if (!dates.length) return Object.freeze({ status: 'NOT_REQUIRED', dates: Object.freeze([]),
            affected_employee_count: 0, excluded_employee_count: 0,
            employees_with_card_evidence: 0, employees_without_card_evidence: 0,
            complete_card_pairs: 0, orphan_unresolved_card_evidence: 0,
            affected_employee_codes: Object.freeze([]) });
        const affectedEmploymentRecordsByKey = new Map([...activeEmploymentRecordsByKey.entries()]
            .filter(([, records]) => records.some((employee) => dates.some((date) =>
                isDateWithinEmploymentPeriod(date, employee)))));
        const affected = [...affectedEmploymentRecordsByKey.values()].map((records) => records[0]);
        const affectedKeys = new Set(affectedEmploymentRecordsByKey.keys());
        const evidenceEmployeeKeys = new Set();
        let completeCardPairs = 0;
        let orphanUnresolvedEvidence = 0;
        for (const row of rows) {
            const rowKey = `${normalizeBranch(row?.ypokatasthma)}|${String(row?.kodikos || '').trim()}`;
            const rowDate = dateKeyUtc(row?.hmeromhnia);
            const employmentRecords = affectedEmploymentRecordsByKey.get(rowKey) || [];
            if (!affectedKeys.has(rowKey) || !dates.includes(rowDate) ||
                !employmentRecords.some((employee) => isDateWithinEmploymentPeriod(rowDate, employee))) continue;
            const verification = resolveCardPairVerification(row);
            if (verification.hasCompleteCardEvidence || verification.hasUnresolvedCardEvidence) {
                evidenceEmployeeKeys.add(rowKey);
            }
            completeCardPairs += verification.completePairs.length;
            orphanUnresolvedEvidence += verification.unresolvedPairs.length +
                (verification.aggregateHoursWithoutPairs ? 1 : 0);
        }
        const withEvidence = evidenceEmployeeKeys.size;
        return Object.freeze({ status: !affected.length ? 'NOT_REQUIRED'
            : withEvidence > 0 ? 'CARD_DATA_FOUND' : 'NO_CARD_DATA_FOUND',
            dates: Object.freeze(dates), affected_employee_count: affected.length,
            excluded_employee_count: activeDuringPeriod.length - affected.length,
            employees_with_card_evidence: withEvidence,
            employees_without_card_evidence: Math.max(0, affected.length - withEvidence),
            complete_card_pairs: completeCardPairs,
            orphan_unresolved_card_evidence: orphanUnresolvedEvidence,
            affected_employee_codes: Object.freeze(affected.map((employee) =>
                String(employee.kodikos || '')).filter(Boolean).sort()) });
    };
    return Object.freeze({ coverage_source: 'PERSISTED_CARD_DATA',
        previous: side(previousDates, previous_rows), next: side(nextDates, next_rows) });
}

module.exports = {
    buildPostDepartureExclusionDescriptors,
    endOfDepartureDay,
    startOfHireDay,
    isDateWithinEmploymentPeriod,
    isWeekFullyWithinEmploymentPeriod,
    restrictBoundaryContextToPeriodEmployees,
    deriveEmploymentOwnedDateScope,
    isFullCalendarMonthRange,
    buildFullMonthBoundaryContextPreflight
};
