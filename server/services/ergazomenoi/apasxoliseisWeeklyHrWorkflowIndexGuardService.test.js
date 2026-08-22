'use strict';

const assert = require('assert/strict');
const { REQUIRED_INDEXES, getWeeklyHrWorkflowIndexState,
    assertWeeklyHrWorkflowIndexesReady } = require('./apasxoliseisWeeklyHrWorkflowIndexGuardService');

const state = REQUIRED_INDEXES[0];
const audit = REQUIRED_INDEXES[1];
const readyOptions = {
    stateIndexLoader: async () => [{ name: state.name, key: state.key, unique: true }],
    auditIndexLoader: async () => [{ name: audit.name, key: audit.key, unique: true }]
};

(async () => {
    assert.equal((await getWeeklyHrWorkflowIndexState(readyOptions)).ready, true);
    assert.equal((await getWeeklyHrWorkflowIndexState({ ...readyOptions,
        auditIndexLoader: async () => [] })).ready, false);
    assert.equal((await getWeeklyHrWorkflowIndexState({ ...readyOptions,
        stateIndexLoader: async () => [{ name: state.name, key: state.key, unique: false }]
    })).ready, false);
    await assert.rejects(() => assertWeeklyHrWorkflowIndexesReady({ ...readyOptions,
        stateIndexLoader: async () => { throw new Error('read failed'); }
    }), (error) => error.code === 'WEEKLY_HR_WORKFLOW_INDEXES_NOT_READY' &&
        error.statusCode === 503);
    console.log('apasxoliseisWeeklyHrWorkflowIndexGuardService tests passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
