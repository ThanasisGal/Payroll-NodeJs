'use strict';
const assert = require('assert');
const { buildDeferredCrossPeriodRepoResolution } = require('./deferredCrossPeriodRepoResolutionService');
const { prepareFinalWtoDailyCanonicalControl, prepareFinalWtoDailyInput } =
    require('./wtoDailyDeferredBoundaryIntegrationService');
const { buildWTODayilyAPayload } = require('./wtoDailySubmissionProjectionService');
const identity = { team: 'T', company_kod: 'C', ypokatasthma: '0001', employee_id: 'E',
    week_start: '2026-04-27', week_end: '2026-05-03', source_period_start: '2026-04-01', source_period_end: '2026-04-30' };
const deferredWeek = { ...identity, deferred_week_id: JSON.stringify(Object.values(identity)),
    current_period_dates: ['2026-04-27', '2026-04-28', '2026-04-29', '2026-04-30'],
    next_period_context_dates: ['2026-05-01', '2026-05-02', '2026-05-03'] };
const week = Array.from({ length: 7 }, (_, i) => { const d = new Date('2026-04-27T00:00:00Z'); d.setUTCDate(d.getUTCDate() + i);
    return { row_id: `r${i}`, hmeromhnia: d.toISOString().slice(0, 10), team: 'T', company_kod: 'C',
        ypokatasthma: '0001', employee_id: 'E', cards: [], declared: {}, accounting: {} }; });
const decision = buildDeferredCrossPeriodRepoResolution({ deferredWeek, fullWeekContext: week,
    source: { row_id: 'r3', hmeromhnia: '2026-04-30' }, target: { row_id: 'r4', hmeromhnia: '2026-05-01' },
    sourcePeriod: { period_start: '2026-04-01', period_end: '2026-04-30' },
    targetPeriod: { period_start: '2026-05-01', period_end: '2026-05-31' },
    resolutionPeriod: { period_start: '2026-05-01', period_end: '2026-05-31' },
    hr: { user_id: 'U', user_name: 'HR', user_role: 'HR', resolved_at: '2026-05-04', resolution_reason: 'HR' },
    beforeValues: week, proposedAccountingAfterValues: [
        { row_id: 'r3', hmeromhnia: '2026-04-30', apologistiko_biblio: true,
            kathgoria_ergasias_apologistika: 'ΕΡΓ',
            apo_ora_01_apologistika: '08:00', eos_ora_01_apologistika: '16:00' },
        { row_id: 'r4', hmeromhnia: '2026-05-01', apologistiko_biblio: true, kathgoria_ergasias_apologistika: 'ΑΝ' }] });
const frozen = { scope: { ypokatasthma: '0001' }, daily_results: [{ _id: 'r3', hmeromhnia: '2026-04-30',
    ypokatasthma: '0001', kodikos: '1', apologistiko_biblio: true,
    kathgoria_ergasias_apologistika: 'ΑΝ' }], employees: [
    { kodikos: '1', afm: '123456789', eponymo: 'ΔΟΚΙΜΗ', onoma: 'ΑΝΝΑ',
        afora_daneismo_ergazomenoy: false, typos_ergodoth_daneismoy: false }
] };
const notRequired = prepareFinalWtoDailyInput({ frozenSnapshot: frozen,
    deferredWeeks: [{ ...deferredWeek, requirement_status: 'NOT_REQUIRED' }], decisions: [],
    periodStart: '2026-04-01', periodEnd: '2026-04-30', branch: '0001' });
assert.equal(notRequired.readiness.status, 'READY');
assert.strictEqual(notRequired.controlReport.canonicalRows, notRequired.canonicalRows);
assert.strictEqual(notRequired.projection.canonicalRows, notRequired.canonicalRows);
const requiredDeferredWeek = { ...deferredWeek, requirement_status: 'REQUIRED' };
assert.throws(() => prepareFinalWtoDailyInput({ frozenSnapshot: frozen, deferredWeeks: [requiredDeferredWeek], decisions: [],
    periodStart: '2026-04-01', periodEnd: '2026-04-30', branch: '0001', projector: () => ({}) }),
error => error.code === 'WTODAILY_DEFERRED_BOUNDARY_RESOLUTION_REQUIRED');
const april = prepareFinalWtoDailyInput({ frozenSnapshot: frozen, deferredWeeks: [requiredDeferredWeek], decisions: [decision],
    periodStart: '2026-04-01', periodEnd: '2026-04-30', branch: '0001' });
assert.equal(april.readiness.status, 'READY'); assert.equal(april.rows[0].kathgoria_ergasias_apologistika, 'ΕΡΓ');
assert.equal(april.canonicalRows[0].category, 'ΕΡΓ');
assert.equal(april.controlReport.rows[0].category, 'ΕΡΓ');
assert.equal(april.projection.canonicalRows[0].category, 'ΕΡΓ');
assert.deepStrictEqual(buildWTODayilyAPayload(april.projection).WTOS.WTO[0].Ergazomenoi
    .ErgazomenoiWTO[0].ErgazomenosAnalytics.ErgazomenosWTOAnalytics,
[{ f_type: 'ΕΡΓ', f_from: '08:00', f_to: '16:00' }]);
assert.equal(frozen.daily_results[0].kathgoria_ergasias_apologistika, 'ΑΝ');

const eligibilityFrozen = { scope: { ypokatasthma: '0001' }, daily_results: [
    { _id: 'included', hmeromhnia: '2026-04-29', ypokatasthma: '0001', kodikos: '1',
        apologistiko_biblio: true, kathgoria_ergasias_apologistika: 'ΑΝ' },
    { _id: 'excluded', hmeromhnia: '2026-04-29', ypokatasthma: '0001', kodikos: '2',
        apologistiko_biblio: true, kathgoria_ergasias_apologistika: 'ΑΝ' }
], employees: [
    { kodikos: '1', afm: '123456789', eponymo: 'ΚΑΝΟΝΙΚΟΣ', onoma: 'ΑΝΝΑ',
        afora_daneismo_ergazomenoy: false },
    { kodikos: '2', afm: '987654321', eponymo: 'ΔΑΝΕΙΖΟΜΕΝΟΣ', onoma: 'ΠΕΤΡΟΣ',
        afora_daneismo_ergazomenoy: true, typos_ergodoth_daneismoy: false }
] };
const eligibilityPrepared = prepareFinalWtoDailyCanonicalControl({ frozenSnapshot: eligibilityFrozen,
    deferredWeeks: [], decisions: [], periodStart: '2026-04-01', periodEnd: '2026-04-30' });
assert.deepStrictEqual(eligibilityPrepared.canonicalRows.map((row) => row.employee_code), ['1']);
assert.strictEqual(eligibilityPrepared.controlReport.canonicalRows,
    eligibilityPrepared.canonicalRows);
const eligibilityInput = prepareFinalWtoDailyInput({ frozenSnapshot: eligibilityFrozen,
    deferredWeeks: [], decisions: [], periodStart: '2026-04-01', periodEnd: '2026-04-30',
    branch: '0001' });
assert.strictEqual(eligibilityInput.projection.canonicalRows, eligibilityInput.canonicalRows);
assert.deepStrictEqual(buildWTODayilyAPayload(eligibilityInput.projection).WTOS.WTO[0]
    .Ergazomenoi.ErgazomenoiWTO.map((employee) => employee.f_afm), ['123456789']);
for (const employees of [
    [{ kodikos: '1', afm: '123456789', eponymo: 'LEGACY', onoma: 'ΑΝΝΑ' }],
    [{ kodikos: '1', afm: '123456789', eponymo: 'LEGACY', onoma: 'ΑΝΝΑ',
        afora_daneismo_ergazomenoy: true }]
]) {
    assert.throws(() => prepareFinalWtoDailyCanonicalControl({
        frozenSnapshot: { ...eligibilityFrozen, employees,
            daily_results: [eligibilityFrozen.daily_results[0]] },
        deferredWeeks: [], decisions: [], periodStart: '2026-04-01', periodEnd: '2026-04-30'
    }), (error) => error.code === 'WTODAILY_FROZEN_EMPLOYEE_ELIGIBILITY_MISSING' &&
        error.details.employee_code === '1');
}
assert.ok(!require('fs').readFileSync(require.resolve('./wtoDailyDeferredBoundaryIntegrationService'),
    'utf8').includes('ErgazomenoiModel'));
console.log('WTODaily deferred-boundary integration tests passed');
