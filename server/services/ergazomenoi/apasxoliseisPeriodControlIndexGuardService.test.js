'use strict';

const assert = require('assert');
const { REQUIRED_INDEX, getPeriodControlIndexState, assertPeriodControlIndexesReady } = require('./apasxoliseisPeriodControlIndexGuardService');

(async () => {
    const correct = { name: REQUIRED_INDEX.name, key: { ...REQUIRED_INDEX.key }, unique: true };
    assert.strictEqual((await getPeriodControlIndexState({ indexLoader: async () => [correct] })).ready, true);
    assert.strictEqual((await getPeriodControlIndexState({ indexLoader: async () => [] })).ready, false);
    assert.strictEqual((await getPeriodControlIndexState({ indexLoader: async () => [{ ...correct, unique: false }] })).ready, false);
    assert.strictEqual((await getPeriodControlIndexState({ indexLoader: async () => [{ ...correct, key: { company_kod: 1, team: 1 } }] })).ready, false);
    assert.strictEqual((await getPeriodControlIndexState({ indexLoader: async () => { throw new Error('metadata'); } })).ready, false);
    await assert.rejects(() => assertPeriodControlIndexesReady({ indexLoader: async () => [] }), (error) => error.code === 'PERIOD_CONTROL_INDEXES_NOT_READY' && error.statusCode === 503);
    let unsafeCalls = 0;
    await getPeriodControlIndexState({ indexLoader: async () => { unsafeCalls++; return [correct]; } });
    assert.strictEqual(unsafeCalls, 1);
    assert.ok(!/syncIndexes|createIndex|createCollection|\.init\(/.test(require('fs').readFileSync(__filename.replace('.test.js', '.js'), 'utf8')));
    console.log('apasxoliseisPeriodControlIndexGuardService tests: 8/8 PASS');
})().catch((error) => { console.error(error); process.exitCode = 1; });
