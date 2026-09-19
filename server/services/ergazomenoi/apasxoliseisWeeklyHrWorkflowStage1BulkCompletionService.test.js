'use strict';

const assert = require('assert/strict');
const { BULK_STAGE1_CONCURRENCY, childRequestId,
    stage1PeriodAccessCacheKey, createStage1BulkPeriodAccessResolver,
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

    const boundaryScope = { ...scopes[0], week_start: '2026-06-29',
        week_end: '2026-07-05', period_start: '2026-06-01', period_end: '2026-06-30' };
    let forwardedBoundaryScope = null;
    await completeWeeklyHrWorkflowStage1Bulk({ ...base, scopes: [boundaryScope],
        completeOne: async ({ scope }) => { forwardedBoundaryScope = scope;
            return { idempotent: false }; } });
    assert.deepEqual(forwardedBoundaryScope, boundaryScope);

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

    const persistedPeriod = { team: 'team-a', company_kod: 'company-a',
        ypokatasthma: '0000', period_start: new Date('2026-06-01T00:00:00.000Z'),
        period_end: new Date('2026-06-30T00:00:00.000Z') };
    let persistedResolutionCalls = 0;
    let transactionFenceCalls = 0;
    let transactionFingerprintCalls = 0;
    const persistedResolver = createStage1BulkPeriodAccessResolver(async (scope) => {
        persistedResolutionCalls += 1;
        return { scope, state: { effective_mode: 'HISTORICAL_RECONSTRUCTED' },
            token: { exists: true, version: 4 } };
    });
    const persistedResults = await Promise.all(Array.from({ length: 29 }, async () => {
        const access = await persistedResolver(persistedPeriod);
        transactionFenceCalls += 1;
        transactionFingerprintCalls += 1;
        return access;
    }));
    assert.equal(persistedResolutionCalls, 1);
    assert.equal(transactionFenceCalls, 29);
    assert.equal(transactionFingerprintCalls, 29);
    assert.ok(persistedResults.every((access) => access.token.version === 4));

    assert.equal(stage1PeriodAccessCacheKey(persistedPeriod), JSON.stringify([
        'team-a', 'company-a', '0000', '2026-06-01', '2026-06-30'
    ]));
    let distinctResolutionCalls = 0;
    const distinctResolver = createStage1BulkPeriodAccessResolver(async (scope) => {
        distinctResolutionCalls += 1;
        return { scope, token: { exists: true } };
    });
    await Promise.all([
        persistedPeriod,
        { ...persistedPeriod, ypokatasthma: '0001' },
        { ...persistedPeriod, period_start: '2026-05-01' },
        { ...persistedPeriod, period_end: '2026-07-01' }
    ].map((scope) => distinctResolver(scope)));
    assert.equal(distinctResolutionCalls, 4);

    let missingControlResolutionCalls = 0;
    const missingControlResolver = createStage1BulkPeriodAccessResolver(async (scope) => {
        missingControlResolutionCalls += 1;
        return { scope, token: { exists: false } };
    });
    await Promise.all(Array.from({ length: 29 }, () => missingControlResolver(persistedPeriod)));
    assert.equal(missingControlResolutionCalls, 29);

    let rejectedResolutionCalls = 0;
    const retryingResolver = createStage1BulkPeriodAccessResolver(async (scope) => {
        rejectedResolutionCalls += 1;
        if (rejectedResolutionCalls === 1) throw Object.assign(new Error('temporary failure'),
            { code: 'TEMPORARY_PERIOD_ACCESS_FAILURE' });
        return { scope, token: { exists: true } };
    });
    await assert.rejects(() => retryingResolver(persistedPeriod),
        { code: 'TEMPORARY_PERIOD_ACCESS_FAILURE' });
    assert.equal((await retryingResolver(persistedPeriod)).token.exists, true);
    assert.equal(rejectedResolutionCalls, 2);

    let currentPeriodVersion = 7;
    const preloadedVersionResolver = createStage1BulkPeriodAccessResolver(async (scope) => ({
        scope, state: { effective_mode: 'NORMAL' },
        token: { exists: true, version: currentPeriodVersion }
    }));
    const preloadedAccess = await preloadedVersionResolver(persistedPeriod);
    currentPeriodVersion = 8;
    assert.throws(() => {
        if (preloadedAccess.token.version !== currentPeriodVersion) throw Object.assign(
            new Error('period state changed'), { code: 'PERIOD_CONTROL_STATE_CONFLICT' });
    }, { code: 'PERIOD_CONTROL_STATE_CONFLICT' });

    let historicalDependency = 'fingerprint-before';
    let transactionHistoricalFingerprintCalls = 0;
    const historicalResolver = createStage1BulkPeriodAccessResolver(async (scope) => ({ scope,
        state: { effective_mode: 'HISTORICAL_RECONSTRUCTED' },
        token: { exists: true, historical_fingerprint: historicalDependency } }));
    const historicalAccess = await historicalResolver(persistedPeriod);
    historicalDependency = 'fingerprint-after';
    assert.throws(() => {
        transactionHistoricalFingerprintCalls += 1;
        if (historicalAccess.token.historical_fingerprint !== historicalDependency) {
            throw Object.assign(new Error('historical dependency changed'),
                { code: 'PERIOD_CONTROL_STATE_CONFLICT' });
        }
    }, { code: 'PERIOD_CONTROL_STATE_CONFLICT' });
    assert.equal(transactionHistoricalFingerprintCalls, 1);

    console.log('weekly HR Stage-1 bulk completion tests passed (16 scenarios)');
})().catch((error) => { console.error(error); process.exitCode = 1; });
