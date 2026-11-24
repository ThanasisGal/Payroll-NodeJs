'use strict';

// In-memory BSON only. No connection, URI, server, application bootstrap or writes.
const assert = require('node:assert/strict');
const { BSON } = require('mongoose').mongo;
const scope = { team: 'SYNTHETIC', company_kod: 'synthetic-company' };
const session = Object.freeze({ synthetic: true });
const period = { from: '2026-12-01', to: null };
const row = (extra = {}) => ({ _id: new BSON.ObjectId('650000000000000000000001'), ...scope,
    ypokatasthma: '0000', period_start: new Date('2026-01-01'), period_end: new Date('2026-01-31'),
    status: 'OPEN', ...extra });

function syntheticProtectionStore({ controls = [], snapshots = [], latencyMs = 0, invalidRaw = false,
    session: readSession = session, bsonOptions = undefined } = {}) {
    const reads = [];
    let active = false;
    const matches = (document, filter) => Object.entries(filter).every(([key, expected]) => {
        if (expected && typeof expected === 'object' && !(expected instanceof Date)) {
            if ('$lte' in expected) return document[key] <= expected.$lte;
            if ('$gte' in expected) return document[key] >= expected.$gte;
        }
        return document[key] === expected;
    });
    const model = (name, documents) => {
        const source = documents.map(document => BSON.serialize(document));
        const query = (filter, raw, options = {}) => ({
            sort(value) { assert.deepEqual(value, { _id: 1 }); return this; },
            limit(value) { assert.equal(value, 1001); this.cap = value; return this; },
            session(value) { options.session = value; return this; },
            async lean() { return this.run(); }, async toArray() { return this.run(); },
            async run() {
                assert.equal(options.session, readSession);
                assert.equal(active, false, 'Synthetic reads must remain serial');
                active = true;
                try {
                    const selected = source.filter(bytes => matches(BSON.deserialize(bytes), filter))
                        .sort((a, b) => String(BSON.deserialize(a)._id).localeCompare(String(BSON.deserialize(b)._id)))
                        .slice(0, this.cap);
                    reads.push({ collection: name, raw, bytes: selected.reduce((sum, bytes) => sum + bytes.length, 0) });
                    if (latencyMs) await new Promise(resolve => setTimeout(resolve, latencyMs));
                    return raw ? selected.map(bytes => invalidRaw ? {} : Buffer.from(bytes)) : selected.map(bytes => BSON.deserialize(bytes, bsonOptions));
                } finally { active = false; }
            }
        });
        return { find: filter => query(filter, false), collection: { name, collection: { bsonOptions },
            find(filter, options) { assert.equal(options.raw, true); return query(filter, true, options); } } };
    };
    return { reads, input: { scope }, period, session: readSession, dependencies: {
        periodControlModel: model('Apasxoliseis_Period_Controls', controls),
        frozenModel: model('Apasxoliseis_Period_Frozen_Snapshots', snapshots)
    } };
}

module.exports = { syntheticProtectionStore, row, scope, session, period };
