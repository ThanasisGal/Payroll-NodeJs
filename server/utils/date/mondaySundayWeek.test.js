const assert = require('assert');
const {
    dateKeyUtc,
    startOfWeekMondayUtc,
    getMondaySundayWeekRange,
    getMonthReadContextRange
} = require('./mondaySundayWeek');

assert.strictEqual(dateKeyUtc(startOfWeekMondayUtc('2026-07-27')), '2026-07-27');
assert.strictEqual(dateKeyUtc(startOfWeekMondayUtc('2026-08-02')), '2026-07-27');
assert.notStrictEqual(
    dateKeyUtc(startOfWeekMondayUtc('2026-08-02')),
    dateKeyUtc(startOfWeekMondayUtc('2026-08-03'))
);
assert.deepStrictEqual(
    {
        start: getMondaySundayWeekRange('2026-07-30').weekStartKey,
        end: getMondaySundayWeekRange('2026-07-30').weekEndKey
    },
    { start: '2026-07-27', end: '2026-08-02' }
);
assert.deepStrictEqual(
    {
        start: getMondaySundayWeekRange('2027-01-01').weekStartKey,
        end: getMondaySundayWeekRange('2027-01-01').weekEndKey
    },
    { start: '2026-12-28', end: '2027-01-03' }
);
assert.strictEqual(
    dateKeyUtc(getMonthReadContextRange(2026, 7).readContextStart),
    '2026-06-29'
);
assert.strictEqual(
    dateKeyUtc(getMonthReadContextRange(2026, 6).completionContextEnd),
    '2026-07-05'
);
assert.strictEqual(dateKeyUtc('2026-03-29T23:30:00-03:00'), '2026-03-30');
assert.strictEqual(dateKeyUtc(null), null);
assert.strictEqual(dateKeyUtc(''), null);
assert.strictEqual(dateKeyUtc('invalid'), null);

console.log('Monday-Sunday UTC week helper tests passed');
