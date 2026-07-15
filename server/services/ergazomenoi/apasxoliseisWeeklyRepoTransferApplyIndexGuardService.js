const ExecutionModel = require('../../models/apasxoliseisWeeklyRepoTransferExecution');
const { applyError } = require('./apasxoliseisWeeklyRepoTransferApplyCommandService');

const REQUIRED_INDEXES = Object.freeze({
    unique_applied_repo_transfer_decision: Object.freeze({ decision_id: 1 }),
    unique_repo_transfer_apply_request: Object.freeze({ team: 1, company_kod: 1, request_id: 1 })
});

function sameKey(actual, expected) {
    const actualEntries = Object.entries(actual || {});
    const expectedEntries = Object.entries(expected);
    return actualEntries.length === expectedEntries.length &&
        actualEntries.every(([key, value], index) => expectedEntries[index]?.[0] === key && expectedEntries[index]?.[1] === value);
}

async function getWeeklyRepoTransferApplyIndexState({
    indexLoader = () => ExecutionModel.collection.indexes()
} = {}) {
    try {
        const indexes = await indexLoader();
        const ready = Object.entries(REQUIRED_INDEXES).every(([name, key]) => {
            const index = Array.isArray(indexes) ? indexes.find((item) => item?.name === name) : null;
            return index?.unique === true && sameKey(index.key, key);
        });
        return Object.freeze({ ready, code: ready ? null : 'APPLY_INDEXES_NOT_READY' });
    } catch {
        return Object.freeze({ ready: false, code: 'APPLY_INDEXES_NOT_READY' });
    }
}

async function assertWeeklyRepoTransferApplyIndexesReady(options) {
    const state = await getWeeklyRepoTransferApplyIndexState(options);
    if (!state.ready) throw applyError(state.code, 503);
    return state;
}

module.exports = { REQUIRED_INDEXES, sameKey, getWeeklyRepoTransferApplyIndexState, assertWeeklyRepoTransferApplyIndexesReady };
