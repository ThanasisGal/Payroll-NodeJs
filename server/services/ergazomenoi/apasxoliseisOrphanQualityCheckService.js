'use strict';

const {
    CARD_PAIR_STATE,
    resolveCardPairVerification
} = require('./apasxoliseisCardPairResolverService');

const ORPHAN_STATES = new Set([
    CARD_PAIR_STATE.START_ONLY,
    CARD_PAIR_STATE.END_ONLY
]);

function dateKey(value) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '';
    return parsed.toISOString().slice(0, 10);
}

function countOrphanHitsByEmployee(rows = [], threshold = 3) {
    const employees = new Map();

    for (const row of rows) {
        const kodikos = String(row?.kodikos || '').trim();
        if (!kodikos) continue;
        if (!employees.has(kodikos)) {
            employees.set(kodikos, { kodikos, orphan_count: 0, dates: new Map() });
        }

        const employee = employees.get(kodikos);
        const orphans = resolveCardPairVerification(row).unresolvedPairs.filter(
            (pair) => ORPHAN_STATES.has(pair.state)
        );
        if (orphans.length === 0) continue;

        const day = dateKey(row.hmeromhnia);
        employee.orphan_count += orphans.length;
        if (day) employee.dates.set(day, (employee.dates.get(day) || 0) + orphans.length);
    }

    const flagged = [...employees.values()]
        .filter((employee) => employee.orphan_count > threshold)
        .map((employee) => ({
            kodikos: employee.kodikos,
            orphan_count: employee.orphan_count,
            dates: [...employee.dates.entries()]
                .sort(([left], [right]) => left.localeCompare(right))
                .map(([date, count]) => ({ date, count }))
        }))
        .sort((left, right) =>
            right.orphan_count - left.orphan_count ||
            left.kodikos.localeCompare(right.kodikos, 'el', { numeric: true })
        );

    return {
        employees_checked: employees.size,
        employees_with_zero_to_three: employees.size - flagged.length,
        employees_over_three: flagged.length,
        employees: flagged
    };
}

module.exports = {
    ORPHAN_STATES,
    countOrphanHitsByEmployee
};
