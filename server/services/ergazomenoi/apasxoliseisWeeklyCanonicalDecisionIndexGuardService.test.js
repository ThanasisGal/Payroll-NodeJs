'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const Model = require('../../models/apasxoliseisWeeklyCanonicalDecision');
const {
    REQUIRED_INDEXES,
    getWeeklyCanonicalDecisionIndexState,
    assertWeeklyCanonicalDecisionIndexesReady
} = require('./apasxoliseisWeeklyCanonicalDecisionIndexGuardService');

const readyIndexes = Object.entries(REQUIRED_INDEXES).map(([name, contract]) => ({
    name,
    key: contract.key,
    unique: true,
    ...(contract.partialFilterExpression
        ? { partialFilterExpression: contract.partialFilterExpression }
        : {})
}));

(async () => {
    assert.equal(Model.schema.options.autoIndex, false);
    assert.equal(Model.schema.options.autoCreate, false);
    assert.equal((await getWeeklyCanonicalDecisionIndexState({
        indexLoader: async () => readyIndexes
    })).ready, true);
    for (const indexes of [
        [],
        readyIndexes.slice(0, 1),
        readyIndexes.map((index, position) => position === 0 ? { ...index, unique: false } : index),
        readyIndexes.map((index, position) => position === 1
            ? { name: index.name, key: index.key, unique: true }
            : index),
        readyIndexes.map((index, position) => position === 1
            ? { ...index, partialFilterExpression: { decision_status: 'SUPERSEDED' } }
            : index),
        readyIndexes.map((index, position) => position === 1
            ? { ...index, unique: false }
            : index),
        readyIndexes.map((index, position) => position === 1
            ? { ...index, key: { employee_kodikos: 1, team: 1 } }
            : index)
    ]) {
        assert.equal((await getWeeklyCanonicalDecisionIndexState({
            indexLoader: async () => indexes
        })).ready, false);
    }
    await assert.rejects(() => assertWeeklyCanonicalDecisionIndexesReady({
        indexLoader: async () => []
    }), (error) => error.code === 'CANONICAL_DECISION_INDEXES_NOT_READY' &&
        error.statusCode === 503);
    assert.equal((await getWeeklyCanonicalDecisionIndexState({
        indexLoader: async () => { throw new Error('metadata unavailable'); }
    })).ready, false);

    const sources = [
        'apasxoliseisWeeklyCanonicalDecisionIndexGuardService.js',
        '../../models/apasxoliseisWeeklyCanonicalDecision.js'
    ].map((file) => fs.readFileSync(path.join(__dirname, file), 'utf8')).join('\n');
    assert.doesNotMatch(sources, /syncIndexes|createIndex|createCollection|\.init\s*\(/);
    console.log('weekly canonical decision read-only index guard tests passed (13 contracts)');
})().catch((error) => { console.error(error); process.exitCode = 1; });
