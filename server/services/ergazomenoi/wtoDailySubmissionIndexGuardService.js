'use strict';
const { ErgazomenoiErganhModel } = require('../../models/ergazomenoi');
const REQUIRED_INDEXES = Object.freeze([
    Object.freeze({ name: 'unique_ergani_submission_command_request', unique: true,
        key: Object.freeze({ team: 1, companykod_object: 1, request_id: 1, submission_code: 1 }),
        partialFilterExpression: Object.freeze({ request_id: Object.freeze({ $type: 'string' }) }) }),
    Object.freeze({ name: 'ergani_final_submission_payload_lookup', unique: false,
        key: Object.freeze({ team: 1, companykod_object: 1, ypokatasthma_kodikos: 1,
            employment_period_start: 1, employment_period_end: 1, submission_code: 1,
            payload_fingerprint: 1, submission_status: 1, document_status: 1 }) })
]);
function exactObject(actual, expected) { return JSON.stringify(actual || {}) === JSON.stringify(expected || {}); }
function exactIndex(index, required) {
    if (!index || index.name !== required.name || !exactObject(index.key, required.key) ||
        Boolean(index.unique) !== required.unique) return false;
    if (required.partialFilterExpression) {
        return index.sparse !== true && exactObject(index.partialFilterExpression,
            required.partialFilterExpression);
    }
    return index.partialFilterExpression === undefined;
}
async function getWtoDailySubmissionIndexState({ loader = () => ErgazomenoiErganhModel.collection.indexes() } = {}) {
    try {
        const indexes = await loader();
        const missing = []; const mismatched = [];
        for (const required of REQUIRED_INDEXES) {
            const named = indexes.find((index) => index?.name === required.name);
            if (!named) missing.push(required.name);
            else if (!exactIndex(named, required)) mismatched.push(required.name);
        }
        return Object.freeze({ ready: missing.length === 0 && mismatched.length === 0,
            missing: Object.freeze(missing), mismatched: Object.freeze(mismatched) });
    } catch { return Object.freeze({ ready: false, missing: REQUIRED_INDEXES.map((item) => item.name) }); }
}
async function assertWtoDailySubmissionIndexesReady(options) {
    const state = await getWtoDailySubmissionIndexState(options);
    if (!state.ready) { const error = new Error('Οι indexes ασφαλούς WTODayilyA υποβολής δεν είναι διαθέσιμοι.');
        error.code = 'WTODAILY_INDEXES_NOT_READY'; error.statusCode = 503; throw error; }
    return state;
}
module.exports = { REQUIRED_INDEXES, exactIndex, getWtoDailySubmissionIndexState,
    assertWtoDailySubmissionIndexesReady };
