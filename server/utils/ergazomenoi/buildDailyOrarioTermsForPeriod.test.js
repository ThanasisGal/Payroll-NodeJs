const assert = require('assert');
const {
    addDays,
    buildDailyOrarioTermsForPeriod,
    formatDateYMD
} = require('./buildDailyOrarioTermsForPeriod');

assert.strictEqual(process.env.TZ, 'Europe/Athens');

function dateKeys(start, steps) {
    const keys = [];
    let current = new Date(`${start}T00:00:00.000Z`);
    for (let index = 0; index < steps; index += 1) {
        keys.push(formatDateYMD(current));
        current = addDays(current, 1);
    }
    return keys;
}

assert.deepStrictEqual(dateKeys('2026-03-28', 4), [
    '2026-03-28',
    '2026-03-29',
    '2026-03-30',
    '2026-03-31'
]);

const fullRange = buildDailyOrarioTermsForPeriod({
    periodApo: '2026-02-23',
    periodEos: '2026-04-05'
});
const fullRangeKeys = fullRange.map((row) => row.hmeromhnia);
assert.strictEqual(fullRange.length, 42);
assert.strictEqual(new Set(fullRangeKeys).size, 42);
assert.strictEqual(fullRangeKeys[0], '2026-02-23');
assert.strictEqual(fullRangeKeys.at(-1), '2026-04-05');
assert.strictEqual(
    fullRangeKeys[fullRangeKeys.indexOf('2026-03-29') + 1],
    '2026-03-30'
);
assert.deepStrictEqual(fullRangeKeys, dateKeys('2026-02-23', 42));

assert.deepStrictEqual(dateKeys('2026-10-24', 4), [
    '2026-10-24',
    '2026-10-25',
    '2026-10-26',
    '2026-10-27'
]);

console.log('buildDailyOrarioTermsForPeriod DST regression tests: PASS');
