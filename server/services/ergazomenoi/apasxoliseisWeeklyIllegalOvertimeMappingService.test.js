const assert = require('assert');
const {
    OVERLAPPING_LEGAL_FIELDS,
    buildWeeklyIllegalOvertimePersistenceMapping
} = require('./apasxoliseisWeeklyIllegalOvertimeMappingService');

const existing = {
    ores_nominhs_yperorias_apologistika: 6.78,
    ores_yperergasias_apologistika: 1,
    ores_nyxtas_apologistika: 0.45,
    ores_argion_prosayxhsh_apologistika: 6.78
};
const classified = { normal: 0, night: 0, holiday: 5.83, holidayNight: 0.95 };
const first = { ...existing, ...buildWeeklyIllegalOvertimePersistenceMapping(classified) };
const second = { ...first, ...buildWeeklyIllegalOvertimePersistenceMapping(classified) };

assert.deepStrictEqual(second, first);
assert.strictEqual(first.ores_nyxtas_apologistika, 0.45);
assert.strictEqual(first.ores_argion_prosayxhsh_apologistika, 6.78);
assert.strictEqual(
    first.ores_paranomhs_yperorias_argion_apologistika +
        first.ores_paranomhs_yperorias_argion_nyxtas_apologistika,
    6.78
);
OVERLAPPING_LEGAL_FIELDS.forEach((field) => assert.strictEqual(first[field], 0));
const sixthDayMapping = buildWeeklyIllegalOvertimePersistenceMapping(classified, {
    clearOverlappingLegal: false
});
OVERLAPPING_LEGAL_FIELDS.forEach((field) => assert.ok(!(field in sixthDayMapping)));

console.log('weekly illegal overtime persistence mapping tests passed');
