'use strict';

const assert = require('assert/strict');
const { BULK_STAGE1_CONCURRENCY, childRequestId,
    completeWeeklyHrWorkflowStage1Bulk } = require(
    './apasxoliseisWeeklyHrWorkflowStage1BulkCompletionService'
);

const actor = { role: 'HR' };
const scopes = Array.from({ length: 10 }, (_, index) => ({ ypokatasthma: '0000',
    employee_id: `employee-${index}`, week_start: '2026-06-01', week_end: '2026-06-07' }));
const base = { reason_or_notes: 'Μαζικός έλεγχος', bulk_request_id: 'bulk-stage1-202606', actor,
    indexGuard: async () => ({ ready: true }) };

(async () => {
    const calls = [];
    const three = await completeWeeklyHrWorkflowStage1Bulk({ ...base, scopes: scopes.slice(0, 3),
        completeOne: async (command) => { calls.push(command); return { idempotent: false }; } });
    assert.equal(calls.length, 3);
    assert.equal(three.completed_count, 3);

    const already = await completeWeeklyHrWorkflowStage1Bulk({ ...base, scopes: scopes.slice(0, 1),
        completeOne: async () => ({ idempotent: true }) });
    assert.equal(already.results[0].status, 'ALREADY_COMPLETED');
    assert.equal(already.already_completed_count, 1);

    const continued = [];
    const partial = await completeWeeklyHrWorkflowStage1Bulk({ ...base, scopes,
        completeOne: async ({ scope }) => { continued.push(scope.employee_id);
            if (scope.employee_id === 'employee-4') throw Object.assign(new Error('conflict'),
                { code: 'STAGE1_INPUT_CHANGED', statusCode: 409 });
            return { idempotent: false }; } });
    assert.equal(continued.length, 10);
    assert.equal(partial.completed_count, 9);
    assert.equal(partial.failed_count, 1);
    assert.equal(partial.results[4].status, 'STALE_RETRY_REQUIRED');

    let guardedCalls = 0;
    await assert.rejects(() => completeWeeklyHrWorkflowStage1Bulk({ ...base, scopes,
        indexGuard: async () => { throw Object.assign(new Error('indexes'),
            { code: 'WEEKLY_HR_WORKFLOW_INDEXES_NOT_READY', statusCode: 503 }); },
        completeOne: async () => { guardedCalls += 1; } }),
    (error) => error.code === 'WEEKLY_HR_WORKFLOW_INDEXES_NOT_READY');
    assert.equal(guardedCalls, 0);

    let unauthorizedCalls = 0;
    await assert.rejects(() => completeWeeklyHrWorkflowStage1Bulk({ ...base, scopes,
        actor: { role: 'E' }, completeOne: async () => { unauthorizedCalls += 1; } }),
    (error) => error.code === 'CRITICAL_EMPLOYMENT_DECISION_NOT_AUTHORIZED');
    assert.equal(unauthorizedCalls, 0);

    const identityA = childRequestId(base.bulk_request_id, scopes[0]);
    assert.equal(identityA, childRequestId(base.bulk_request_id, { ...scopes[0] }));
    const firstIds = []; const replayIds = [];
    for (const target of [firstIds, replayIds]) await completeWeeklyHrWorkflowStage1Bulk({
        ...base, scopes: scopes.slice(0, 3), completeOne: async ({ request_id }) => {
            target.push(request_id); return { idempotent: target === replayIds }; } });
    assert.deepEqual(firstIds, replayIds);

    let active = 0; let maximum = 0;
    await completeWeeklyHrWorkflowStage1Bulk({ ...base,
        scopes: Array.from({ length: 30 }, (_, index) => ({ ...scopes[0], employee_id: `x-${index}` })),
        completeOne: async () => { active += 1; maximum = Math.max(maximum, active);
            await new Promise((resolve) => setImmediate(resolve)); active -= 1;
            return { idempotent: false }; } });
    assert.ok(maximum <= BULK_STAGE1_CONCURRENCY);
    assert.ok(maximum > 1);

    const stale = await completeWeeklyHrWorkflowStage1Bulk({ ...base, scopes: scopes.slice(0, 1),
        completeOne: async () => ({ idempotent: false, previous_fingerprint: 'a'.repeat(64) }) });
    assert.equal(stale.results[0].status, 'COMPLETED');

    let forbiddenPayloadCalls = 0;
    const forbiddenPayload = await completeWeeklyHrWorkflowStage1Bulk({ ...base,
        scopes: [{ ...scopes[0], updates: { adeia_apologistika: true } }],
        completeOne: async () => { forbiddenPayloadCalls += 1; } });
    assert.equal(forbiddenPayload.results[0].status, 'FAILED');
    assert.equal(forbiddenPayload.results[0].code,
        'STAGE1_COMPLETION_SCOPE_FIELDS_NOT_ALLOWED');
    assert.equal(forbiddenPayloadCalls, 0);
    console.log('weekly HR Stage-1 bulk completion tests passed (10 scenarios)');
})().catch((error) => { console.error(error); process.exitCode = 1; });
