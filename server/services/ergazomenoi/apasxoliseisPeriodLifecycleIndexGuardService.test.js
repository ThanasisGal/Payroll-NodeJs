'use strict';
const assert = require('assert');
const { REQUIRED_INDEXES, getPeriodLifecycleIndexState, assertPeriodLifecycleIndexesReady } = require('./apasxoliseisPeriodLifecycleIndexGuardService');
const indexes = (model) => REQUIRED_INDEXES.filter((item) => item.model === model).map((item) => ({ name: item.name, unique: true }));
(async () => {
    const ready = await getPeriodLifecycleIndexState({ loaders: { frozen: async () => indexes('frozen'), corrective: async () => indexes('corrective'),
        posting: async () => indexes('posting'), balance: async () => indexes('balance'), payroll: async () => indexes('payroll') } });
    assert.strictEqual(ready.ready, true);
    const empty = { frozen: async () => [], corrective: async () => [], posting: async () => [], balance: async () => [], payroll: async () => [] };
    const missing = await getPeriodLifecycleIndexState({ loaders: empty });
    assert.strictEqual(missing.ready, false);
    assert.strictEqual(missing.missing.length, 8);
    await assert.rejects(() => assertPeriodLifecycleIndexesReady({ loaders: empty }),
        (error) => error.code === 'PERIOD_LIFECYCLE_INDEXES_NOT_READY' && error.statusCode === 503);
    console.log('employment period lifecycle index readiness: PASS');
})().catch((error) => { console.error(error); process.exitCode = 1; });
