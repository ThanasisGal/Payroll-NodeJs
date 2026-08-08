'use strict';
const { ErgazomenoiErganhModel } = require('../../models/ergazomenoi');
const REQUIRED_INDEXES = Object.freeze([
    Object.freeze({ name: 'unique_ergani_submission_command_request', unique: true }),
    Object.freeze({ name: 'ergani_final_submission_payload_lookup', unique: false })
]);
async function getWtoDailySubmissionIndexState({ loader = () => ErgazomenoiErganhModel.collection.indexes() } = {}) {
    try {
        const indexes = await loader();
        const missing = REQUIRED_INDEXES.filter((required) => !indexes.some((index) =>
            index?.name === required.name && Boolean(index?.unique) === required.unique)).map((item) => item.name);
        return Object.freeze({ ready: missing.length === 0, missing });
    } catch { return Object.freeze({ ready: false, missing: REQUIRED_INDEXES.map((item) => item.name) }); }
}
async function assertWtoDailySubmissionIndexesReady(options) {
    const state = await getWtoDailySubmissionIndexState(options);
    if (!state.ready) { const error = new Error('Οι indexes ασφαλούς WTODayilyA υποβολής δεν είναι διαθέσιμοι.');
        error.code = 'WTODAILY_INDEXES_NOT_READY'; error.statusCode = 503; throw error; }
    return state;
}
module.exports = { REQUIRED_INDEXES, getWtoDailySubmissionIndexState, assertWtoDailySubmissionIndexesReady };
