'use strict';
const assert = require('assert');
const { REQUIRED_INDEXES, getWtoDailySubmissionIndexState, assertWtoDailySubmissionIndexesReady } = require('./wtoDailySubmissionIndexGuardService');
(async () => {
    const indexes = REQUIRED_INDEXES.map((item) => ({ name: item.name, unique: item.unique }));
    assert.strictEqual((await getWtoDailySubmissionIndexState({ loader: async () => indexes })).ready, true);
    const missing = await getWtoDailySubmissionIndexState({ loader: async () => [] });
    assert.strictEqual(missing.ready, false);
    await assert.rejects(() => assertWtoDailySubmissionIndexesReady({ loader: async () => [] }),
        (error) => error.code === 'WTODAILY_INDEXES_NOT_READY');
    console.log('WTODayilyA index readiness tests passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
