'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
    getOrCreateRequestRead,
    requestReadKey
} = require('./employmentReviewRequestReadContextService');

(async () => {
    const request = { method: 'GET' };
    let loaderCalls = 0;
    const sharedResult = { period_start: '2026-05-01', period_end: '2026-05-31' };
    const key = ['active-period-scope', 'team-a', 'company-a', '2026', '05', '0000'];
    const consumers = Array.from({ length: 4 }, () =>
        getOrCreateRequestRead(request, key, async () => {
            loaderCalls += 1;
            await Promise.resolve();
            return sharedResult;
        }));
    const results = await Promise.all(consumers);
    assert.equal(loaderCalls, 1, 'before=4 loaders, after=1 loader for the same request key');
    assert.ok(results.every((result) => result === sharedResult));

    await getOrCreateRequestRead(request,
        ['active-period-scope', 'team-a', 'company-a', '2026', '05', '0001'],
        async () => { loaderCalls += 1; return { branch: '0001' }; });
    assert.equal(loaderCalls, 2, 'different branch key must load independently');

    const failure = new Error('read failed');
    let failureCalls = 0;
    const rejected = [1, 2].map(() => getOrCreateRequestRead(request,
        ['active-period-dates', 'team-a', 'company-a', '2026', '05'],
        async () => { failureCalls += 1; throw failure; }));
    const settled = await Promise.allSettled(rejected);
    assert.equal(failureCalls, 1);
    assert.ok(settled.every((result) => result.status === 'rejected' && result.reason === failure));

    const nextRequest = { method: 'GET' };
    await getOrCreateRequestRead(nextRequest, key,
        async () => { loaderCalls += 1; return sharedResult; });
    assert.equal(loaderCalls, 3, 'a new Search/request starts with an empty cache');

    const writeRequest = { method: 'POST' };
    let writeLoaderCalls = 0;
    await Promise.all([1, 2].map(() => getOrCreateRequestRead(writeRequest, key,
        async () => { writeLoaderCalls += 1; return sharedResult; })));
    assert.equal(writeLoaderCalls, 2, 'write requests must never reuse the read cache');

    assert.notEqual(
        requestReadKey(['active-period-scope', 'team-a', 'company-a', '2026', '05', '0000']),
        requestReadKey(['active-period-scope', 'team-a', 'company-a', '2026', '05', '0001'])
    );
    assert.notEqual(
        requestReadKey(['active-period-scope', 'team-a', 'company-a', '2026', '05', '0000']),
        requestReadKey(['active-period-scope', 'team-a', 'company-a', '2026', '06', '0000'])
    );
    const controller = fs.readFileSync(path.join(__dirname, '..', '..', 'controllers',
        'ergazomenoi', 'erganhController.js'), 'utf8');
    const datesStart = controller.indexOf('async function activeEmploymentReviewPeriodDates(');
    const scopeStart = controller.indexOf('async function activeEmploymentReviewPeriodScope(', datesStart);
    const scopeEnd = controller.indexOf('async function assertActiveEmploymentReviewPeriodNormal(', scopeStart);
    assert.ok(datesStart >= 0 && scopeStart > datesStart && scopeEnd > scopeStart);
    const datesSource = controller.slice(datesStart, scopeStart);
    const scopeSource = controller.slice(scopeStart, scopeEnd);
    for (const required of ['userTeam', 'companyInUse', 'yearInUse', 'periodInUse']) {
        assert.match(datesSource, new RegExp(`req\\.session\\.${required}`));
        assert.match(scopeSource, new RegExp(`req\\.session\\.${required}`));
    }
    assert.match(scopeSource, /normalizedBranch/);
    assert.match(datesSource, /getOrCreateRequestRead\(req, key/);
    assert.match(scopeSource, /getOrCreateRequestRead\(req, key/);
    console.log('employment review request-scoped read promise cache: PASS');
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
