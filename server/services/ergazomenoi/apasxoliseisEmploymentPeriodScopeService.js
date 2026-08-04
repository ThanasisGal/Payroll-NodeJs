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

module.exports = {
    buildPostDepartureExclusionDescriptors,
    endOfDepartureDay,
    startOfHireDay,
    isDateWithinEmploymentPeriod,
    isWeekFullyWithinEmploymentPeriod
};
