const assert = require('assert');
const {
    buildPostDepartureExclusionDescriptors,
    isDateWithinEmploymentPeriod,
    isWeekFullyWithinEmploymentPeriod,
    deriveEmploymentOwnedDateScope
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

assert.deepStrictEqual(deriveEmploymentOwnedDateScope({
    natural_week_start: '2026-06-08', natural_week_end: '2026-06-14',
    hire_date: '2026-06-09'
}).authoritative_date_set, [
    '2026-06-09', '2026-06-10', '2026-06-11',
    '2026-06-12', '2026-06-13', '2026-06-14'
]);
assert.deepStrictEqual(deriveEmploymentOwnedDateScope({
    natural_week_start: '2026-06-22', natural_week_end: '2026-06-28',
    hire_date: '2026-06-27'
}).authoritative_date_set, ['2026-06-27', '2026-06-28']);
assert.deepStrictEqual(deriveEmploymentOwnedDateScope({
    natural_week_start: '2026-06-01', natural_week_end: '2026-06-07',
    departure_date: '2026-06-02'
}).authoritative_date_set, ['2026-06-01', '2026-06-02']);
assert.deepStrictEqual(deriveEmploymentOwnedDateScope({
    natural_week_start: '2026-06-29', natural_week_end: '2026-07-05',
    period_start: '2026-06-01', period_end: '2026-06-30',
    hire_date: '2026-06-30', departure_date: '2026-07-02'
}), Object.freeze({
    natural_week_start: '2026-06-29', natural_week_end: '2026-07-05',
    period_start: '2026-06-01', period_end: '2026-06-30',
    employment_start: '2026-06-30', employment_end: '2026-07-02',
    employment_owned_dates: Object.freeze(['2026-06-30', '2026-07-01', '2026-07-02']),
    authoritative_date_set: Object.freeze(['2026-06-30']),
    context_only_dates: Object.freeze(['2026-07-01', '2026-07-02']),
    is_full_natural_week: false
}));

console.log('PASS employment-period scope');
