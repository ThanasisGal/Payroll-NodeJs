'use strict';

const assert = require('node:assert/strict');
const { INDEX_NAME, assertDeferredCrossPeriodResolutionIndexReady } =
    require('./deferredCrossPeriodRepoResolutionIndexGuardService');

function model(indexes) {
    return { collection: { indexes: async () => indexes } };
}

(async () => {
    await assert.rejects(() => assertDeferredCrossPeriodResolutionIndexReady({ model: model([]) }),
        (error) => error.code === 'DEFERRED_CROSS_PERIOD_RESOLUTION_INDEX_NOT_READY' &&
            error.statusCode === 503);
    await assert.rejects(() => assertDeferredCrossPeriodResolutionIndexReady({ model: model([{
        name: 'unique_resolved_deferred_cross_period_week', unique: true,
        key: { team: 1, company_kod: 1, ypokatasthma: 1, deferred_week_id: 1 },
        partialFilterExpression: { resolution_kind: 'DEFERRED_CROSS_PERIOD_REPO_RESOLUTION',
            resolution_status: 'RESOLVED' }
    }]) }), (error) => error.code === 'DEFERRED_CROSS_PERIOD_RESOLUTION_INDEX_NOT_READY');
    assert.equal(await assertDeferredCrossPeriodResolutionIndexReady({ model: model([{
        name: INDEX_NAME, unique: true,
        key: { team: 1, company_kod: 1, ypokatasthma: 1, deferred_week_id: 1,
            resolution_revision: 1 },
        partialFilterExpression: { resolution_kind: 'DEFERRED_CROSS_PERIOD_REPO_RESOLUTION',
            resolution_status: 'RESOLVED' }
    }]) }), true);
    console.log('deferred cross-period resolution index guard tests passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
