'use strict';

const DecisionModel = require('../../models/apasxoliseisWeeklyCanonicalDecision');

const REQUIRED_INDEXES = Object.freeze({
    unique_weekly_canonical_decision_request: Object.freeze({
        key: Object.freeze({ team: 1, company_kod: 1, request_id: 1 }),
        partialFilterExpression: null
    }),
    unique_active_weekly_canonical_decision_snapshot_slot: Object.freeze({
        key: Object.freeze({
            team: 1,
            company_kod: 1,
            ypokatasthma: 1,
            employee_kodikos: 1,
            week_start: 1,
            week_end: 1,
            snapshot_fingerprint: 1
        }),
        partialFilterExpression: Object.freeze({ decision_status: 'RECORDED' })
    })
});

function sameKey(actual, expected) {
    const actualEntries = Object.entries(actual || {});
    const expectedEntries = Object.entries(expected);
    return actualEntries.length === expectedEntries.length &&
        actualEntries.every(([key, value], index) =>
            expectedEntries[index]?.[0] === key && expectedEntries[index]?.[1] === value
        );
}

async function getWeeklyCanonicalDecisionIndexState({
    indexLoader = () => DecisionModel.collection.indexes()
} = {}) {
    try {
        const indexes = await indexLoader();
        const ready = Object.entries(REQUIRED_INDEXES).every(([name, contract]) => {
            const index = Array.isArray(indexes)
                ? indexes.find((candidate) => candidate?.name === name)
                : null;
            const partialReady = contract.partialFilterExpression === null
                ? index?.partialFilterExpression == null
                : sameKey(index?.partialFilterExpression, contract.partialFilterExpression);
            return index?.unique === true && sameKey(index.key, contract.key) && partialReady;
        });
        return Object.freeze({
            ready,
            code: ready ? null : 'CANONICAL_DECISION_INDEXES_NOT_READY'
        });
    } catch {
        return Object.freeze({ ready: false, code: 'CANONICAL_DECISION_INDEXES_NOT_READY' });
    }
}

async function assertWeeklyCanonicalDecisionIndexesReady(options) {
    const state = await getWeeklyCanonicalDecisionIndexState(options);
    if (!state.ready) {
        const error = new Error('Τα απαιτούμενα indexes εβδομαδιαίων αποφάσεων δεν είναι έτοιμα.');
        error.statusCode = 503;
        error.code = state.code;
        throw error;
    }
    return state;
}

module.exports = {
    REQUIRED_INDEXES,
    sameKey,
    getWeeklyCanonicalDecisionIndexState,
    assertWeeklyCanonicalDecisionIndexesReady
};
