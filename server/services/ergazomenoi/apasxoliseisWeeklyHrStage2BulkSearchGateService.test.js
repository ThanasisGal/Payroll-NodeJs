'use strict';

const assert = require('assert/strict');
const { loadWeeklyHrStage2BulkSearchPresentation } = require(
    './apasxoliseisWeeklyHrStage2BulkSearchGateService');

(async () => {
    let writableGuardCalls = 0;
    const finalizedWritablePresentation = async () => {
        writableGuardCalls++;
        throw Object.assign(new Error('Finalized periods are read-only.'),
            { code: 'EMPLOYMENT_REVIEW_PERIOD_FINALIZED' });
    };
    await assert.rejects(finalizedWritablePresentation,
        (error) => error.code === 'EMPLOYMENT_REVIEW_PERIOD_FINALIZED');
    writableGuardCalls = 0;
    const april = await loadWeeklyHrStage2BulkSearchPresentation({ finalizedReadOnly: true,
        loadWritablePresentation: finalizedWritablePresentation });
    assert.equal(april, null);
    assert.equal(writableGuardCalls, 0);

    const may = await loadWeeklyHrStage2BulkSearchPresentation({ finalizedReadOnly: false,
        loadWritablePresentation: async () => { writableGuardCalls++;
            return { preview: { total_scopes: 85, safe_bulk_count: 0,
                already_resolved_count: 66, manual_exception_count: 19 } }; } });
    assert.deepEqual(may.preview, { total_scopes: 85, safe_bulk_count: 0,
        already_resolved_count: 66, manual_exception_count: 19 });
    assert.equal(writableGuardCalls, 1);
    console.log('weekly HR Stage-2 finalized search gate tests passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
