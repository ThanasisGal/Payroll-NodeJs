'use strict';

const assert = require('assert/strict');
const { WeeklyHrStage2BulkStateCache, MAX_SCOPES_PER_BATCH } = require(
    './apasxoliseisWeeklyHrStage2BulkStateCacheService');

const scope = { team: 'team-a', company_kod: 'company-a', ypokatasthma: '0001',
    period_start: '2026-05-01', period_end: '2026-05-31', user_id: 'hr-1' };
function preview(count, exceptionCount = 0) {
    return { preview_fingerprint: 'a'.repeat(64), exception_page_size: 50,
        safe_scope_ids: Array.from({ length: count }, (_, index) => ({
            employee_id: `employee-${index}`, week_start: '2026-05-04',
            week_end: '2026-05-10', scope_fingerprint: String(index) })),
        _all_exceptions: Array.from({ length: exceptionCount }, (_, index) => ({
            employee_id: `manual-${index}` })) };
}

{
    const cache = new WeeklyHrStage2BulkStateCache();
    cache.put({ preview: preview(9500), scope });
    let continuation = ''; let batches = 0; let total = 0; let max = 0;
    do {
        const batch = cache.batch({ preview_fingerprint: 'a'.repeat(64),
            continuation_token: continuation, scope });
        batches++; total += batch.processed_in_batch;
        max = Math.max(max, batch.processed_in_batch);
        continuation = batch.continuation_token;
        if (!batch.has_more) break;
    } while (true);
    assert.equal(batches, 95);
    assert.equal(total, 9500);
    assert.equal(max, MAX_SCOPES_PER_BATCH);
}
{
    const cache = new WeeklyHrStage2BulkStateCache();
    cache.put({ preview: preview(500), scope });
    let continuation = ''; let batches = 0;
    while (true) {
        const batch = cache.batch({ preview_fingerprint: 'a'.repeat(64),
            continuation_token: continuation, scope });
        batches++;
        if (!batch.has_more) break;
        continuation = batch.continuation_token;
    }
    assert.equal(batches, 5);
}
{
    const cache = new WeeklyHrStage2BulkStateCache();
    cache.put({ preview: preview(250), scope });
    const first = cache.batch({ preview_fingerprint: 'a'.repeat(64), scope });
    const second = cache.batch({ preview_fingerprint: 'a'.repeat(64), scope,
        continuation_token: first.continuation_token });
    const retry = cache.batch({ preview_fingerprint: 'a'.repeat(64), scope,
        continuation_token: first.continuation_token });
    assert.deepEqual(retry.scopes, second.scopes);
    assert.equal(retry.continuation_token, second.continuation_token);
    const third = cache.batch({ preview_fingerprint: 'a'.repeat(64), scope,
        continuation_token: second.continuation_token });
    assert.equal(third.processed_in_batch, 50);
    assert.equal(third.has_more, false);
}
{
    const cache = new WeeklyHrStage2BulkStateCache();
    cache.put({ preview: preview(1, 120), scope });
    assert.throws(() => cache.batch({ preview_fingerprint: 'a'.repeat(64),
        scope: { ...scope, company_kod: 'company-b' } }),
    { code: 'STAGE2_BULK_PREVIEW_SCOPE_MISMATCH', statusCode: 403 });
    assert.throws(() => cache.exceptionPage({ preview_fingerprint: 'a'.repeat(64),
        scope: { ...scope, ypokatasthma: '0002' }, exception_page: 2 }),
    { code: 'STAGE2_BULK_PREVIEW_SCOPE_MISMATCH', statusCode: 403 });
    const page = cache.exceptionPage({ preview_fingerprint: 'a'.repeat(64), scope,
        exception_page: 2 });
    assert.equal(page.exceptions.length, 50);
    assert.equal(page.exceptions[0].employee_id, 'manual-50');
}
{
    let now = 0;
    const cache = new WeeklyHrStage2BulkStateCache({ ttlMs: 10, hardTtlMs: 100,
        now: () => now });
    cache.put({ preview: preview(1), scope });
    now = 11;
    assert.throws(() => cache.batch({ preview_fingerprint: 'a'.repeat(64), scope }),
    { code: 'STAGE2_BULK_PREVIEW_EXPIRED', statusCode: 409 });
}
{
    let now = 0;
    const activeCache = new WeeklyHrStage2BulkStateCache({ ttlMs: 10, hardTtlMs: 1000,
        now: () => now });
    activeCache.put({ preview: preview(9500), scope });
    let continuation = '';
    for (let index = 0; index < 95; index++) {
        now += 9;
        const batch = activeCache.batch({ preview_fingerprint: 'a'.repeat(64), scope,
            continuation_token: continuation });
        continuation = batch.continuation_token;
    }
    assert.equal(now > 10, true);
    now += 11;
    assert.throws(() => activeCache.batch({ preview_fingerprint: 'a'.repeat(64), scope }),
    { code: 'STAGE2_BULK_PREVIEW_EXPIRED' });

    now = 0;
    const hardCache = new WeeklyHrStage2BulkStateCache({ ttlMs: 10,
        hardTtlMs: 25, now: () => now });
    hardCache.put({ preview: preview(500), scope });
    now = 9; hardCache.batch({ preview_fingerprint: 'a'.repeat(64), scope });
    now = 18; hardCache.batch({ preview_fingerprint: 'a'.repeat(64), scope });
    now = 26;
    assert.throws(() => hardCache.batch({ preview_fingerprint: 'a'.repeat(64), scope }),
    { code: 'STAGE2_BULK_PREVIEW_EXPIRED' });
}

console.log('weekly HR Stage-2 scoped continuation cache tests passed');
