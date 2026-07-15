const assert = require('assert');
const { getWeeklyRepoTransferApplyIndexState, assertWeeklyRepoTransferApplyIndexesReady } = require('./apasxoliseisWeeklyRepoTransferApplyIndexGuardService');
const ExecutionModel = require('../../models/apasxoliseisWeeklyRepoTransferExecution');

assert.strictEqual(ExecutionModel.schema.options.autoIndex, false);
assert.strictEqual(ExecutionModel.schema.options.autoCreate, false);

const correct = () => Promise.resolve([
    { name: 'unique_applied_repo_transfer_decision', key: { decision_id: 1 }, unique: true },
    { name: 'unique_repo_transfer_apply_request', key: { team: 1, company_kod: 1, request_id: 1 }, unique: true }
]);
(async () => {
    assert.strictEqual((await getWeeklyRepoTransferApplyIndexState({ indexLoader: correct })).ready, true);
    for (const indexes of [
        [{ name: 'unique_repo_transfer_apply_request', key: { team: 1, company_kod: 1, request_id: 1 }, unique: true }],
        [{ name: 'unique_applied_repo_transfer_decision', key: { decision_id: 1 }, unique: true }],
        [{ name: 'unique_applied_repo_transfer_decision', key: { decision_id: 1 }, unique: false }],
        [{ name: 'unique_applied_repo_transfer_decision', key: { decision_id: 1 }, unique: true }, { name: 'unique_repo_transfer_apply_request', key: { company_kod: 1, team: 1, request_id: 1 }, unique: true }]
    ]) assert.strictEqual((await getWeeklyRepoTransferApplyIndexState({ indexLoader: async () => indexes })).ready, false);
    assert.strictEqual((await getWeeklyRepoTransferApplyIndexState({ indexLoader: async () => { const error = new Error('ns not found'); error.code = 26; throw error; } })).ready, false);
    assert.strictEqual((await getWeeklyRepoTransferApplyIndexState({ indexLoader: async () => { throw new Error('permission details'); } })).code, 'APPLY_INDEXES_NOT_READY');
    await assert.rejects(() => assertWeeklyRepoTransferApplyIndexesReady({ indexLoader: async () => [] }), (error) => error.code === 'APPLY_INDEXES_NOT_READY' && error.statusCode === 503);
    console.log('PASS repo-transfer apply read-only index guard (10 tests)');
})().catch((error) => { console.error(error); process.exitCode = 1; });
