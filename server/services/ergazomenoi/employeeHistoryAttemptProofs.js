'use strict';
// Deliberately owned by ONE withTransaction callback invocation. Nothing is
// reused by another attempt, transaction, preview or independent reconcile.
const { BSON } = require('mongoose').mongo;
const { createHash } = require('node:crypto');
const P = require('./employeeHistoryApprovedProposalContract');
const digest = raw => createHash('sha256').update(raw).digest('hex');
const allowed = new Set(['Apasxoliseis_Period_Controls', 'Apasxoliseis_Period_Frozen_Snapshots']);
function createAttemptProofs(connection, session) {
    const transaction = session?.transaction, number = String(session?.serverSession?.txnNumber);
    const records = new Map(), claimed = new Set();
    const assertAttempt = () => {
        if (!session?.inTransaction?.() || session.transaction !== transaction ||
            String(session.serverSession?.txnNumber) !== number) throw P.failure('BOUNDARY');
    };
    const key = (collection, identityBson) => collection + ':' + identityBson;
    const identity = raw => {
        const doc = BSON.deserialize(raw, { promoteValues: false, raw: true });
        if (doc._id == null) throw P.failure('REFERENCE');
        return BSON.serialize({ _id: doc._id }).toString('base64');
    };
    function remember(collection, raw) {
        assertAttempt();
        if (!allowed.has(collection) || !Buffer.isBuffer(raw)) throw P.failure('BOUNDARY');
        const identityBson = identity(raw), sha256 = digest(raw), id = key(collection, identityBson);
        if (records.has(id) && records.get(id).sha256 !== sha256) throw P.failure('STALE');
        const record = { collection, identityBson, sha256, raw };
        records.set(id, record); return record;
    }
    async function load(collection, identities, { fresh = false } = {}) {
        assertAttempt();
        if (!allowed.has(collection)) throw P.failure('BOUNDARY');
        const unique = [...new Set(identities)], missing = unique.filter(id => fresh || !records.has(key(collection, id)));
        // Keep identities complete and bounded; the SHA covers the actual raw
        // BSON, including all numeric types, provenance and payroll payloads.
        for (let offset = 0; offset < missing.length; offset += 64) {
            const chunk = missing.slice(offset, offset + 64), expected = new Set(chunk);
            const rows = await connection.collection(collection).find({ $or: chunk.map(id =>
                BSON.deserialize(Buffer.from(id, 'base64'), { promoteValues: false })) }, { session, raw: true }).toArray();
            if (rows.length !== chunk.length) throw P.failure('STALE');
            for (const raw of rows) {
                if (!Buffer.isBuffer(raw) || !expected.delete(identity(raw))) throw P.failure('REFERENCE');
                remember(collection, raw);
            }
            if (expected.size) throw P.failure('REFERENCE');
        }
        return unique.map(id => records.get(key(collection, id)));
    }
    async function claim(proofs) {
        assertAttempt();
        const groups = new Map();
        for (const proof of proofs) {
            if (!allowed.has(proof.collection) || !/^[a-f\d]{64}$/.test(proof.sha256)) throw P.failure('BOUNDARY');
            const id = key(proof.collection, proof.identityBson);
            const existing = records.get(id);
            if (existing && existing.sha256 !== proof.sha256) throw P.failure('STALE');
            if (claimed.has(id)) continue;
            const group = groups.get(proof.collection) || new Map();
            if (group.has(proof.identityBson) && group.get(proof.identityBson).sha256 !== proof.sha256) throw P.failure('STALE');
            group.set(proof.identityBson, proof); groups.set(proof.collection, group);
        }
        const field = '__employee_history_legacy_protection_claim';
        for (const [collection, group] of groups) {
            const entries = [...group.values()];
            const before = await load(collection, entries.map(p => p.identityBson));
            if (before.some((p, i) => p.sha256 !== entries[i].sha256)) throw P.failure('STALE');
            for (let offset = 0; offset < entries.length; offset += 64) {
                const chunk = entries.slice(offset, offset + 64);
                const writes = chunk.flatMap(proof => {
                    const id = BSON.deserialize(Buffer.from(proof.identityBson, 'base64'), { promoteValues: false });
                    return [{ updateOne: { filter: { ...id, [field]: { $exists: false } }, update: { $set: { [field]: true } } } },
                        { updateOne: { filter: { ...id, [field]: true }, update: { $unset: { [field]: 1 } } } }];
                });
                const result = await connection.collection(collection).bulkWrite(writes, { session, ordered: true });
                if (result.matchedCount !== writes.length || result.modifiedCount !== writes.length) throw P.failure('STALE');
            }
            await load(collection, entries.map(p => p.identityBson), { fresh: true });
            for (const proof of entries) claimed.add(key(collection, proof.identityBson));
        }
    }
    return { remember, load, claim };
}
module.exports = { createAttemptProofs };
