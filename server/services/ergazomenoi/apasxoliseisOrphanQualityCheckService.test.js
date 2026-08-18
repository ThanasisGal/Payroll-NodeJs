'use strict';

const assert = require('assert');
const {
    countOrphanHitsByEmployee
} = require('./apasxoliseisOrphanQualityCheckService');

function row(kodikos, date, pairs, approved = false) {
    const value = { kodikos, hmeromhnia: `${date}T00:00:00.000Z` };
    pairs.forEach((pair, index) => {
        const number = String(index + 1).padStart(2, '0');
        value[`cards_apo_ora_${number}`] = pair[0];
        value[`cards_eos_ora_${number}`] = pair[1];
    });
    if (approved) value.orphan_card_resolution = { status: 'HR_APPROVED' };
    return value;
}

const orphan = [['08:00', '']];
const none = countOrphanHitsByEmployee([row('0001', '2026-06-01', [])]);
assert.strictEqual(none.employees_over_three, 0);
assert.strictEqual(countOrphanHitsByEmployee([row('0001', '2026-06-01', orphan)]).employees_over_three, 0);
assert.strictEqual(countOrphanHitsByEmployee([
    row('0001', '2026-06-01', orphan), row('0001', '2026-06-02', orphan),
    row('0001', '2026-06-03', orphan)
]).employees_over_three, 0);

const four = countOrphanHitsByEmployee([
    row('0004', '2026-06-03', orphan),
    row('0004', '2026-06-08', [['08:00', ''], ['', '17:00']]),
    row('0004', '2026-06-17', orphan, true)
]);
assert.strictEqual(four.employees[0].orphan_count, 4);
assert.deepStrictEqual(four.employees[0].dates, [
    { date: '2026-06-03', count: 1 },
    { date: '2026-06-08', count: 2 },
    { date: '2026-06-17', count: 1 }
]);

const five = countOrphanHitsByEmployee([
    ...Array.from({ length: 5 }, (_, index) =>
        row('0005', `2026-06-${String(index + 1).padStart(2, '0')}`, orphan))
]);
assert.strictEqual(five.employees[0].orphan_count, 5);

const approved = countOrphanHitsByEmployee([
    row('0007', '2026-06-01', [['08:00', ''], ['', '17:00']], true),
    row('0007', '2026-06-02', [['08:00', ''], ['', '17:00']], true)
]);
assert.strictEqual(approved.employees[0].orphan_count, 4);

const sorted = countOrphanHitsByEmployee([
    ...Array.from({ length: 4 }, (_, index) => row('0010', `2026-06-0${index + 1}`, orphan)),
    ...Array.from({ length: 5 }, (_, index) => row('0009', `2026-06-0${index + 1}`, orphan)),
    ...Array.from({ length: 4 }, (_, index) => row('0002', `2026-06-0${index + 1}`, orphan))
]);
assert.deepStrictEqual(sorted.employees.map((item) => item.kodikos), ['0009', '0002', '0010']);

console.log('orphan quality check service tests passed');
