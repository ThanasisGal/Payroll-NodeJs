'use strict';
const assert = require('assert');
const { buildDeferredCrossPeriodRepoResolution } = require('./deferredCrossPeriodRepoResolutionService');
const { prepareFinalWtoDailyInput } = require('./wtoDailyDeferredBoundaryIntegrationService');
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
        { row_id: 'r3', hmeromhnia: '2026-04-30', apologistiko_biblio: true, kathgoria_ergasias_apologistika: 'ΕΡΓ' },
        { row_id: 'r4', hmeromhnia: '2026-05-01', apologistiko_biblio: true, kathgoria_ergasias_apologistika: 'ΑΝ' }] });
const frozen = { daily_results: [{ _id: 'r3', hmeromhnia: '2026-04-30', kodikos: '1',
    kathgoria_ergasias_apologistika: 'ΑΝ' }], employees: [] };
const notRequired = prepareFinalWtoDailyInput({ frozenSnapshot: frozen,
    deferredWeeks: [{ ...deferredWeek, requirement_status: 'NOT_REQUIRED' }], decisions: [],
    periodStart: '2026-04-01', periodEnd: '2026-04-30', branch: '0001', projector: ({ rows }) => ({ rows }) });
assert.equal(notRequired.readiness.status, 'READY');
const requiredDeferredWeek = { ...deferredWeek, requirement_status: 'REQUIRED' };
assert.throws(() => prepareFinalWtoDailyInput({ frozenSnapshot: frozen, deferredWeeks: [requiredDeferredWeek], decisions: [],
    periodStart: '2026-04-01', periodEnd: '2026-04-30', branch: '0001', projector: () => ({}) }),
error => error.code === 'WTODAILY_DEFERRED_BOUNDARY_RESOLUTION_REQUIRED');
const april = prepareFinalWtoDailyInput({ frozenSnapshot: frozen, deferredWeeks: [requiredDeferredWeek], decisions: [decision],
    periodStart: '2026-04-01', periodEnd: '2026-04-30', branch: '0001', projector: ({ rows }) => ({ rows }) });
assert.equal(april.readiness.status, 'READY'); assert.equal(april.rows[0].kathgoria_ergasias_apologistika, 'ΕΡΓ');
assert.equal(frozen.daily_results[0].kathgoria_ergasias_apologistika, 'ΑΝ');
console.log('WTODaily deferred-boundary integration tests passed');
