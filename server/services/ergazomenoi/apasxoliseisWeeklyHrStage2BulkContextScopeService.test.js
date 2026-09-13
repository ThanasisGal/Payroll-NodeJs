'use strict';

const assert = require('assert/strict');
const { buildWeeklyHrStage2BulkContextScope } = require(
    './apasxoliseisWeeklyHrStage2BulkContextScopeService');
const { buildWeeklyHrStage2BulkPreview } = require(
    './apasxoliseisWeeklyHrStage2BulkPreviewService');

const row = { _id: 'row-1', employee_id: 'employee-1', kodikos: '0001', team: 'team-a',
    company_kod: 'company-a', ypokatasthma: '1', hmeromhnia: new Date('2026-05-04T00:00:00Z'),
    updatedAt: new Date('2026-05-04T00:00:00Z'), kathgoria_ergasias: 'ΕΡΓ',
    cards_ores_ergasias: 0, apologistiko_biblio: false, repo_apologistika: false,
    kathgoria_ergasias_apologistika: '', kathgoria_adeias_apologistika: '',
    adeia_apologistika: false, astheneia_apologistika: false,
    apousia_apologistika: null, ores_ergasias_apologistika: 0 };
const completedLifecycle = { requires_hr_action: false,
    stages: { stage2: { pending_count: 0, pending_items: [] },
    stage3: { stage2_automatic_resolution_items: [] } } };
const contextWithoutScope = { scope: undefined, rows: [row], lifecycle: completedLifecycle,
    workflowState: { stage2: { status: 'COMPLETED' } } };
const before = buildWeeklyHrStage2BulkPreview({ contexts: [contextWithoutScope] });
assert.equal(before._all_exceptions[0].code, 'STAGE2_AUTHORITATIVE_CONTEXT_MISSING');

const scope = buildWeeklyHrStage2BulkContextScope({ key: '0001|2026-05-04',
    lifecycle: completedLifecycle, weekRows: [row] });
assert.deepEqual(scope, { team: 'team-a', company_kod: 'company-a', ypokatasthma: '0001',
    employee_id: 'employee-1', employee_kodikos: '0001', week_start: '2026-05-04',
    week_end: '2026-05-10' });
const resolved = buildWeeklyHrStage2BulkPreview({ contexts: [{ ...contextWithoutScope, scope }] });
assert.equal(resolved.already_resolved_count, 1);
assert.equal(resolved.manual_exception_count, 0);
assert.equal(resolved._all_exceptions.some((item) =>
    item.code === 'STAGE2_AUTHORITATIVE_CONTEXT_MISSING'), false);
const nonApplicable = buildWeeklyHrStage2BulkPreview({ contexts: [{
    scope, rows: [row], lifecycle: completedLifecycle, workflowState: {} }] });
assert.equal(nonApplicable.already_resolved_count, 1);
assert.equal(nonApplicable.manual_exception_count, 0);

const deferredScope = buildWeeklyHrStage2BulkContextScope({ key: '0001|2026-05-04',
    lifecycle: { deferred_week: { employee_id: 'deferred-employee', team: 'deferred-team',
        company_kod: 'deferred-company', ypokatasthma: '0002', week_end: '2026-05-10',
        period_start: '2026-05-01', period_end: '2026-05-31' } }, weekRows: [row] });
assert.equal(deferredScope.employee_id, 'employee-1');
assert.equal(deferredScope.week_end, '2026-05-10');
assert.equal(deferredScope.period_start, '2026-05-01');
assert.equal(deferredScope.period_end, '2026-05-31');

const genuinelyMissing = buildWeeklyHrStage2BulkPreview({ contexts: [{
    scope: { ...scope, employee_id: '' }, rows: [row], lifecycle: completedLifecycle }] });
assert.equal(genuinelyMissing._all_exceptions[0].code,
    'STAGE2_AUTHORITATIVE_CONTEXT_MISSING');

for (const preview of [before, resolved, nonApplicable, genuinelyMissing]) {
    assert.equal(preview.safe_bulk_count + preview.already_resolved_count +
        preview.manual_exception_count, preview.total_scopes);
    assert.equal(preview.safe_bulk_count,
        preview.safe_pair_count + preview.safe_automatic_count);
}

console.log('weekly HR Stage-2 authoritative bulk scope regression tests passed');
