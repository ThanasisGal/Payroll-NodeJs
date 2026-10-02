'use strict';

const assert = require('node:assert/strict');
const {
    loadWeeklyHrStage2BulkSearchPresentation
} = require('./apasxoliseisWeeklyHrStage2BulkSearchGateService');

(async () => {
    let loads = 0;
    const loader = async () => { loads += 1; return { preview: { can_apply: true } }; };
    assert.equal(await loadWeeklyHrStage2BulkSearchPresentation({
        reconstructionRequiredReadOnly: true, loadWritablePresentation: loader
    }), null);
    assert.equal(loads, 0,
        'reconstruction-required Search must not invoke the writable Stage-2 loader');
    assert.equal(await loadWeeklyHrStage2BulkSearchPresentation({
        finalizedReadOnly: true, loadWritablePresentation: loader
    }), null);
    assert.equal(loads, 0);
    assert.deepEqual(await loadWeeklyHrStage2BulkSearchPresentation({
        loadWritablePresentation: loader
    }), { preview: { can_apply: true } });
    assert.equal(loads, 1);
    console.log('Stage-2 bulk Search read-only gate tests passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
