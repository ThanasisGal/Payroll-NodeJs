'use strict';

const PeriodControlModel = require('../../models/apasxoliseisPeriodControl');

const REQUIRED_INDEX = Object.freeze({
    name: 'unique_apasxoliseis_period_control_scope',
    key: Object.freeze({ team: 1, company_kod: 1, ypokatasthma: 1, period_start: 1, period_end: 1 })
});
function sameKey(actual, expected) {
    const left = Object.entries(actual || {}); const right = Object.entries(expected || {});
    return left.length === right.length && left.every(([key, value], index) => right[index]?.[0] === key && right[index]?.[1] === value);
}
async function getPeriodControlIndexState({ indexLoader = () => PeriodControlModel.collection.indexes() } = {}) {
    try {
        const indexes = await indexLoader();
        const index = Array.isArray(indexes) ? indexes.find((item) => item?.name === REQUIRED_INDEX.name) : null;
        const ready = index?.unique === true && sameKey(index?.key, REQUIRED_INDEX.key);
        return Object.freeze({ ready, code: ready ? null : 'PERIOD_CONTROL_INDEXES_NOT_READY' });
    } catch { return Object.freeze({ ready: false, code: 'PERIOD_CONTROL_INDEXES_NOT_READY' }); }
}
async function assertPeriodControlIndexesReady(options) {
    const state = await getPeriodControlIndexState(options);
    if (!state.ready) { const error = new Error('Η ασφαλής μεταβολή κατάστασης περιόδου δεν είναι διαθέσιμη.'); error.code = state.code; error.statusCode = 503; throw error; }
    return state;
}
module.exports = { REQUIRED_INDEX, sameKey, getPeriodControlIndexState, assertPeriodControlIndexesReady };
