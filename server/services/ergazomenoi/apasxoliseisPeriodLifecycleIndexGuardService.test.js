'use strict';
const assert = require('assert');
const { REQUIRED_INDEXES, getPeriodLifecycleIndexState, assertPeriodLifecycleIndexesReady } = require('./apasxoliseisPeriodLifecycleIndexGuardService');
const indexes = (model) => REQUIRED_INDEXES.filter((item) => item.model === model).map((item) => ({ name: item.name, unique: true }));
(async () => {
    const ready = await getPeriodLifecycleIndexState({ loaders: { frozen: async () => indexes('frozen'), corrective: async () => indexes('corrective'),
        posting: async () => indexes('posting'), balance: async () => indexes('balance'), payroll: async () => indexes('payroll') } });
    assert.strictEqual(ready.ready, true);
    const oldFrozenIndexes = indexes('frozen').filter((index) =>
        index.name !== 'unique_apasxoliseis_frozen_snapshot_scope_version');
    oldFrozenIndexes.push({ name: 'unique_apasxoliseis_frozen_snapshot_scope', unique: true });
    const oldOnly = await getPeriodLifecycleIndexState({ loaders: { frozen: async () => oldFrozenIndexes,
        corrective: async () => indexes('corrective'), posting: async () => indexes('posting'),
        balance: async () => indexes('balance'), payroll: async () => indexes('payroll') } });
    assert.strictEqual(oldOnly.ready, false);
    assert.deepStrictEqual(oldOnly.missing, ['unique_apasxoliseis_frozen_snapshot_scope_version']);
    const empty = { frozen: async () => [], corrective: async () => [], posting: async () => [], balance: async () => [], payroll: async () => [] };
    const missing = await getPeriodLifecycleIndexState({ loaders: empty });
    assert.strictEqual(missing.ready, false);
    assert.strictEqual(missing.missing.length, 8);
    await assert.rejects(() => assertPeriodLifecycleIndexesReady({ loaders: empty }),
        (error) => error.code === 'PERIOD_LIFECYCLE_INDEXES_NOT_READY' && error.statusCode === 503);
    console.log('employment period lifecycle index readiness: PASS');
})().catch((error) => { console.error(error); process.exitCode = 1; });
