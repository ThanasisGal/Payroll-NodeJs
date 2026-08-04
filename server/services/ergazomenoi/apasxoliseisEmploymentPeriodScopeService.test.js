const assert = require('assert');
const {
    buildPostDepartureExclusionDescriptors,
    isDateWithinEmploymentPeriod,
    isWeekFullyWithinEmploymentPeriod
} = require('./apasxoliseisEmploymentPeriodScopeService');

const departed = {
    kodikos: '0014',
    ypokatasthma: '0000',
    hmeromhnia_proslhpshs: '2025-01-01',
    hmeromhnia_apoxorhshs: '2026-06-02'
};

assert.strictEqual(isDateWithinEmploymentPeriod('2026-06-01', departed), true);
assert.strictEqual(isDateWithinEmploymentPeriod('2026-06-02', departed), true);
assert.strictEqual(isDateWithinEmploymentPeriod('2026-06-03', departed), false);

assert.strictEqual(isWeekFullyWithinEmploymentPeriod('2026-05-25', departed), true);
assert.strictEqual(isWeekFullyWithinEmploymentPeriod('2026-06-01', departed), false);

const descriptors = buildPostDepartureExclusionDescriptors([departed]);
assert.strictEqual(descriptors.length, 1);
assert.strictEqual(descriptors[0].kodikos, '0014');
assert.strictEqual(descriptors[0].ypokatasthma, '0000');
assert.strictEqual(descriptors[0].departureEnd.toISOString(), '2026-06-02T23:59:59.999Z');

assert.deepStrictEqual(
    buildPostDepartureExclusionDescriptors([
        departed,
        { ...departed, hmeromhnia_apoxorhshs: null }
    ]),
    []
);

console.log('PASS employment-period scope');
