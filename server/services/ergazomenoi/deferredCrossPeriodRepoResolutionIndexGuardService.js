'use strict';
const Decision = require('../../models/apasxoliseisWeeklyRepoTransferDecision');
const INDEX_NAME = 'unique_deferred_cross_period_resolution_revision';
const INDEX_KEY = Object.freeze({ team: 1, company_kod: 1, ypokatasthma: 1,
    deferred_week_id: 1, resolution_revision: 1 });
async function assertDeferredCrossPeriodResolutionIndexReady({ model = Decision } = {}) {
    const indexes = await model.collection.indexes();
    const index = indexes.find((item) => item.name === INDEX_NAME);
    if (!index?.unique || JSON.stringify(index.key) !== JSON.stringify(INDEX_KEY) ||
        index.partialFilterExpression?.resolution_kind !==
        'DEFERRED_CROSS_PERIOD_REPO_RESOLUTION' || index.partialFilterExpression?.resolution_status !== 'RESOLVED') {
        throw Object.assign(new Error('Ο μοναδικός δείκτης επίλυσης οριακής εβδομάδας δεν είναι διαθέσιμος.'),
            { code: 'DEFERRED_CROSS_PERIOD_RESOLUTION_INDEX_NOT_READY', statusCode: 503 });
    }
    return true;
}
module.exports = { INDEX_NAME, INDEX_KEY, assertDeferredCrossPeriodResolutionIndexReady };
