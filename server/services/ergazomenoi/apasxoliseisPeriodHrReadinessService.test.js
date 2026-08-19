'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildPeriodHrReadiness, assertPeriodHrReady,
    collectPeriodWideUiProjections } = require('./apasxoliseisPeriodHrReadinessService');
function weekly(employee, pending = 0, requires = false, extra = {}) { return {
    scope: { employee_kodikos: employee, week_start: '2026-06-01', week_end: '2026-06-07' },
    lifecycle_projection: { total_pending_count: pending, requires_hr_action: requires, ...extra } }; }
test('completed και εργαζόμενος χωρίς projection δεν μπλοκάρουν', () => {
    const result = buildPeriodHrReadiness({ employeeCodes: ['001', '002'], weeklyProjections: [weekly('001', 0, false,
        { stages: { stage4: { business_status: 'COMPLETED', pending_count: 0 } } })] });
    assert.equal(result.ready, true); assert.equal(result.employees_count, 2);
    assert.equal(result.employees_with_weekly_projections_count, 1);
});
test('requires_hr_action και total_pending_count μπλοκάρουν ανεξάρτητα', () => {
    assert.equal(buildPeriodHrReadiness({ employeeCodes: ['001'], weeklyProjections: [weekly('001', 0, true)] }).ready, false);
    const result = buildPeriodHrReadiness({ employeeCodes: ['001'], weeklyProjections: [weekly('001', 2, false)] });
    assert.equal(result.ready, false); assert.equal(result.total_pending_count, 2);
    assert.throws(() => assertPeriodHrReady(result), (error) => error.code === 'PERIOD_HAS_PENDING_HR_ACTIONS');
});
test('ενεργό Stage 1–4 με πραγματικό pending μπλοκάρει', () => {
    const result = buildPeriodHrReadiness({ employeeCodes: ['001'], weeklyProjections: [weekly('001', 0, false,
        { stages: { stage3: { business_status: 'OPEN', pending_count: 1 } } })] });
    assert.equal(result.ready, false);
});
test('trailing partial/deferred ολοκληρωμένη lifecycle εβδομάδα δεν μπλοκάρει', () => {
    const stages = Object.fromEntries(['stage1', 'stage2', 'stage3', 'stage4'].map((key) =>
        [key, { business_status: 'COMPLETED', pending_count: 0 }]));
    assert.equal(buildPeriodHrReadiness({ employeeCodes: ['001'], weeklyProjections: [weekly('001', 0, false,
        { deferred_weekly_dates: ['2026-06-30'], trailing_partial_week: { active: true }, stages })] }).ready, true);
});
test('εκκρεμότητα εκτός πρώτης σελίδας μπλοκάρει period-wide', () => {
    const employees = Array.from({ length: 51 }, (_, index) => String(index + 1).padStart(3, '0'));
    const result = buildPeriodHrReadiness({ employeeCodes: employees,
        weeklyProjections: employees.map((employee, index) => weekly(employee, index === 50 ? 1 : 0, index === 50)) });
    assert.equal(result.ready, false); assert.equal(result.pending_cases[0].employee_kodikos, '051');
});
test('period-wide συλλογή διατηρεί απαράλλακτη την UI lifecycle projection του 0002', async () => {
    const completedStages = Object.fromEntries(['stage1', 'stage2', 'stage3', 'stage4'].map((key) =>
        [key, { business_status: 'COMPLETED', pending_count: 0 }]));
    const uiProjection = weekly('0002', 0, false, { current_stage: null, stages: completedStages });
    const loaded = await collectPeriodWideUiProjections({ loadPage: async () => ({ success: true,
        totalPages: 1, employeeCodes: ['0002'], weekly_hr_projections: [uiProjection] }) });
    const periodProjection = loaded.weeklyProjections[0].lifecycle_projection;
    assert.equal(periodProjection.current_stage, uiProjection.lifecycle_projection.current_stage);
    assert.equal(periodProjection.requires_hr_action, uiProjection.lifecycle_projection.requires_hr_action);
    assert.equal(periodProjection.total_pending_count, uiProjection.lifecycle_projection.total_pending_count);
    assert.deepEqual(periodProjection.stages, uiProjection.lifecycle_projection.stages);
});
