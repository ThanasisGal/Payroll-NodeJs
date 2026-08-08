'use strict';
const assert = require('assert');
const { REQUIRED_INDEXES, getWtoDailySubmissionIndexState, assertWtoDailySubmissionIndexesReady } = require('./wtoDailySubmissionIndexGuardService');
(async () => {
    const indexes = REQUIRED_INDEXES.map((item) => ({ name: item.name, key: item.key,
        unique: item.unique, ...(item.partialFilterExpression ? {
            partialFilterExpression: item.partialFilterExpression } : {}) }));
    const exact = await getWtoDailySubmissionIndexState({ loader: async () => indexes });
    assert.strictEqual(exact.ready, true);
    assert.deepStrictEqual(exact.missing, []); assert.deepStrictEqual(exact.mismatched, []);
    const missing = await getWtoDailySubmissionIndexState({ loader: async () => [] });
    assert.strictEqual(missing.ready, false);
    assert.strictEqual(missing.missing.length, 2);
    const sparse = await getWtoDailySubmissionIndexState({ loader: async () => indexes.map((index) =>
        index.name === 'unique_ergani_submission_command_request' ? {
            name: index.name, key: index.key, unique: true, sparse: true } : index) });
    assert.strictEqual(sparse.ready, false);
    assert.deepStrictEqual(sparse.mismatched, ['unique_ergani_submission_command_request']);
    const wrongPartial = await getWtoDailySubmissionIndexState({ loader: async () => indexes.map((index) =>
        index.name === 'unique_ergani_submission_command_request' ? { ...index,
            partialFilterExpression: { request_id: { $exists: true } } } : index) });
    assert.strictEqual(wrongPartial.ready, false);
    assert.deepStrictEqual(wrongPartial.mismatched, ['unique_ergani_submission_command_request']);
    await assert.rejects(() => assertWtoDailySubmissionIndexesReady({ loader: async () => [] }),
        (error) => error.code === 'WTODAILY_INDEXES_NOT_READY');
    console.log('WTODailyA index readiness tests passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
