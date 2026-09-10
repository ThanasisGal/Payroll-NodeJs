'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { buildWeeklyHrLifecycleProjection } = require('../../../../server/services/ergazomenoi/apasxoliseisWeeklyHrLifecycleProjectionService');
const source = fs.readFileSync(path.join(__dirname, 'elegxosApasxolhseonPeriodoy.js'), 'utf8');
const start = source.indexOf('function compareLifecyclePendingItems(');
const end = source.indexOf('function stage2LifecycleClassificationLabel(', start);
assert.ok(start >= 0 && end > start);
const derive = vm.runInNewContext(`${source.slice(start, end)}; derivePeriodLifecyclePresentation;`);
const scope = { team: 'T', company_kod: 'C', ypokatasthma: '0001', employee_id: 'E',
    employee_kodikos: '0001', week_start: '2026-06-29', week_end: '2026-07-05' };
const rows = ['2026-06-29', '2026-06-30'].map(date => ({ ...scope, hmeromhnia: date,
    kathgoria_ergasias: 'ΕΡΓ', kathgoria_adeias_apologistika: 'POSSIBLE_LEAVE',
    cards_ores_ergasias: 0, ores_ergasias: 8 }));
const projection = buildWeeklyHrLifecycleProjection({ scope, weekRows: rows,
    periodScope: { period_start: '2026-06-01', period_end: '2026-06-30' },
    effectiveProfile: { typos_apasxolhshs: '0',
        hmeres_ergasias_ebdomadas: 5, ores_ergasias_ebdomadas: 40 } });
const payload = { scope, lifecycle_projection: projection };
const result = derive([payload, payload]);
assert.equal(result.requires_hr_action, false);
assert.equal(result.total_pending_count, 0);
assert.equal(result.current_stage, null);
assert.equal(result.deferred_weeks.length, 1);
assert.equal(result.deferred_weeks[0].deferred_action_required, true);
assert.equal(result.deferred_weeks[0].possible_leave_dates.length, 2);
assert.ok(Object.values(result.stages).every(stage =>
    stage.presentation_status === 'DEFERRED_TO_NEXT_PERIOD' && stage.enabled === false));

for (const status of ['OPEN', 'BLOCKED', 'STALE']) {
    const pending = { scope: { ...scope, employee_id: 'OTHER', employee_kodikos: '0002' },
        lifecycle_projection: { stages: { stage1: { business_status: status,
            pending_count: 1, pending_reasons: ['REAL_CURRENT_PERIOD_ISSUE'] } } } };
    const mixed = derive([payload, pending]);
    assert.equal(mixed.requires_hr_action, true);
    assert.equal(mixed.total_pending_count, 1);
    assert.equal(mixed.deferred_weeks.length, 1);
    assert.equal(mixed.stages.STAGE1.business_status, status);
}
const display = vm.runInNewContext(`${source.slice(start, end)};
    ({ groupDeferredWeeksForDisplay, renderDeferredWeekGroups });`, {
    escapeHtml: value => String(value),
    formatStage1DateKey: value => String(value).slice(0, 10).split('-').reverse().join('/')
});
const aprilPayloads = Array.from({ length: 20 }, (_, index) => {
    const employee = String(index + 1).padStart(4, '0');
    const employeeScope = { ...scope, employee_id: `employee-${employee}`, employee_kodikos: employee,
        week_start: '2026-04-27', week_end: '2026-05-03' };
    return { scope: employeeScope, lifecycle_projection: { ...projection,
        deferred_possible_leave_dates: index < 3 ? ['2026-04-29', '2026-04-30'] : [],
        deferred_week: { ...projection.deferred_week, ...employeeScope,
            deferred_week_id: `unchanged-employee-identity-${employee}`,
            period_start: '2026-04-01', period_end: '2026-04-30',
            previous_period_context_dates: [], next_period_context_dates: ['2026-05-01', '2026-05-02', '2026-05-03'] }
    } };
});
const originalPayloads = JSON.stringify(aprilPayloads);
const april = derive(aprilPayloads);
const originalInternalEntries = JSON.stringify(april.deferred_weeks);
const groups = display.groupDeferredWeeksForDisplay(april.deferred_weeks);
assert.equal(april.deferred_weeks.length, 20);
assert.equal(groups.length, 1);
assert.equal(groups[0].employee_count, 20);
assert.equal(groups[0].employee_entries.length, 20);
assert.equal(groups[0].possible_leave_count, 6);
assert.equal(groups[0].possible_leave_employee_count, 3);
assert.deepEqual([...groups[0].employee_kodikoi], aprilPayloads.map(item => item.scope.employee_kodikos));
assert.equal(april.total_pending_count, 0);
assert.equal(april.requires_hr_action, false);
assert.equal(JSON.stringify(aprilPayloads), originalPayloads);
assert.equal(JSON.stringify(april.deferred_weeks), originalInternalEntries);
const repeated = display.groupDeferredWeeksForDisplay([...april.deferred_weeks].reverse().concat(april.deferred_weeks));
assert.equal(repeated[0].employee_count, 20);
assert.equal(repeated[0].possible_leave_count, 6);
assert.deepEqual([...repeated[0].employee_kodikoi], [...groups[0].employee_kodikoi]);
for (const difference of [
    { week_start: '2026-05-25', week_end: '2026-05-31' },
    { ypokatasthma: '0002' }, { team: 'OTHER' }, { company_kod: 'OTHER' },
    { period_start: '2026-05-01', period_end: '2026-05-31' },
    { handoff_from_previous_period: true }
]) {
    const separated = display.groupDeferredWeeksForDisplay([...april.deferred_weeks,
        { ...april.deferred_weeks[0], ...difference }]);
    assert.equal(separated.length, 2);
}
const html = display.renderDeferredWeekGroups(groups);
assert.equal((html.match(/data-deferred-week-group=/g) || []).length, 1);
assert.equal((html.match(/ΑΝΑΜΟΝΗ ΠΛΗΡΟΥΣ ΕΒΔΟΜΑΔΙΑΙΟΥ ΕΛΕΓΧΟΥ/g) || []).length, 1);
assert.match(html, /Τελευταία οριακή εβδομάδα: 27\/04\/2026–03\/05\/2026/);
assert.match(html, /Ημέρες επόμενης περιόδου: 01\/05\/2026–03\/05\/2026/);
assert.match(html, /Επηρεαζόμενοι εργαζόμενοι: 20/);
assert.match(html, /Πιθανές άδειες σε αναμονή: 6/);
assert.match(html, /<details.*<summary>Κωδικοί εργαζομένων<\/summary>/);
const handoff = display.groupDeferredWeeksForDisplay(april.deferred_weeks.map(entry => ({ ...entry,
    handoff_from_previous_period: true, period_start: '2026-05-01', period_end: '2026-05-31',
    previous_period_context_dates: ['2026-04-27', '2026-04-28', '2026-04-29', '2026-04-30'],
    next_period_context_dates: [] })));
assert.equal(handoff.length, 1);
assert.equal(handoff[0].employee_count, 20);
assert.match(display.renderDeferredWeekGroups(handoff), /Ημέρες προηγούμενης περιόδου: 27\/04\/2026–30\/04\/2026/);

const view = fs.readFileSync(path.join(__dirname,
    '../../../../views/ergazomenoi/programmata/elegxosApasxolhseonPeriodoy.ejs'), 'utf8');
assert.ok(!view.includes('id="employmentReviewDeferredWeeks"'));
assert.ok(view.includes('id="employmentReviewBoundaryContextButton"'));
console.log('PASS deferred week UI: visible obligation, idempotent counts and preserved HR blockers');
