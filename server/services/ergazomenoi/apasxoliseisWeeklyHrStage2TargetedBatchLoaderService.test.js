'use strict';

const assert = require('assert/strict');
const { loadWeeklyHrStage2TargetedReadGroups } = require(
    './apasxoliseisWeeklyHrStage2TargetedBatchLoaderService');

(async () => {
    const scopes = Array.from({ length: 100 }, (_, index) => ({ employee_id: `${index}` }));
    const calls = new Map();
    const names = ['rows', 'states', 'workflowAudits', 'employees', 'histories',
        'rowAudits', 'decisions', 'executions'];
    const readGroups = Object.fromEntries(names.map((name) => [name, async () => {
        calls.set(name, (calls.get(name) || 0) + 1); return [name];
    }]));
    const result = await loadWeeklyHrStage2TargetedReadGroups({
        batchScopes: scopes, readGroups });
    assert.deepEqual(Object.keys(result), names);
    assert.equal([...calls.values()].every((count) => count === 1), true);
    assert.equal([...calls.values()].reduce((sum, count) => sum + count, 0), names.length);
    await assert.rejects(() => loadWeeklyHrStage2TargetedReadGroups({
        batchScopes: Array.from({ length: 101 }, () => ({})), readGroups }),
    { code: 'STAGE2_BULK_BATCH_INVALID' });
    console.log('weekly HR Stage-2 targeted batch loader tests passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
