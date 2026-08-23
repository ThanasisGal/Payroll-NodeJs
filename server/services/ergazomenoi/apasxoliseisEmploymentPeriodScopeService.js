const {
    dateKeyUtc,
    startOfWeekMondayUtc,
    endOfWeekSundayUtc
} = require('../../utils/date/mondaySundayWeek');

function normalizeBranch(value) {
    const raw = String(value ?? '').trim();
    return raw ? raw.padStart(4, '0') : '';
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

module.exports = {
    buildPostDepartureExclusionDescriptors,
    endOfDepartureDay,
    startOfHireDay,
    isDateWithinEmploymentPeriod,
    isWeekFullyWithinEmploymentPeriod,
    deriveEmploymentOwnedDateScope
};
