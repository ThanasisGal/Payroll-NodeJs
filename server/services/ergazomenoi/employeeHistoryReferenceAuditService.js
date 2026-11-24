'use strict';

const mongoose = require('mongoose');
const { SUPPORTED_COLLECTIONS, employeeHistoryReferenceQueryPaths } =
    require('./employeeHistoryReferenceDefinitionsService');

const REFERENCE_QUERIES = Object.freeze(SUPPORTED_COLLECTIONS.map(collectionName =>
    Object.freeze([collectionName,
        Object.freeze(employeeHistoryReferenceQueryPaths(collectionName))])));

function valuesFor(ids) {
    const values = [...new Set(ids.map(String))];
    for (const id of [...values]) {
        if (mongoose.Types.ObjectId.isValid(id)) values.push(new mongoose.Types.ObjectId(id));
    }
    return values;
}

async function findHistoryIdReferences({ connection, historyIds = [], session, sortById = false } = {}) {
    if (!historyIds.length) return [];
    if (typeof connection?.collection !== 'function') {
        throw new TypeError('MongoDB connection with collection() required');
    }
    const values = valuesFor(historyIds);
    const references = [];
    for (const [collectionName, fields] of REFERENCE_QUERIES) {
        const found = await connection.collection(collectionName).findOne({
            $or: fields.map(field => ({ [field]: { $in: values } }))
        }, { session, projection: { _id: 1 }, ...(sortById === true ? { sort: { _id: 1 } } : {}) });
        if (found) references.push({ collection: collectionName, documentId: String(found._id) });
    }
    return references;
}

// Prove absence for several ids in the SAME transaction snapshot. A positive
// collection still uses each original findOne: an unsorted $in/aggregate can
// select a different witness, which would change signed History fingerprints.
async function findHistoryIdReferenceSummary({ connection, historyIds = [], session, sortById = false } = {}) {
    const ids = [...new Set(historyIds.map(String))];
    const summary = Object.fromEntries(ids.map(id => [id, []]));
    if (!ids.length) return summary;
    if (typeof connection?.collection !== 'function') {
        throw new TypeError('MongoDB connection with collection() required');
    }
    if (ids.length === 1 || session?.inTransaction?.() !== true) {
        for (const id of ids) summary[id] = await findHistoryIdReferences({ connection,
            historyIds: [id], session, sortById });
        return summary;
    }
    for (let offset = 0; offset < ids.length; offset += 64) {
        const chunk = ids.slice(offset, offset + 64), values = valuesFor(chunk);
        let probeAbsence = chunk.length > 1;
        for (const [collectionName, fields] of REFERENCE_QUERIES) {
            const collection = connection.collection(collectionName);
            const options = { session, projection: { _id: 1 }, ...(sortById === true ? { sort: { _id: 1 } } : {}) };
            if (probeAbsence) {
                const any = await collection.findOne({
                    $or: fields.map(field => ({ [field]: { $in: values } }))
                }, options);
                if (!any) continue;
            }
            let matched = 0;
            for (const id of chunk) {
                const found = await collection.findOne({
                    $or: fields.map(field => ({ [field]: { $in: valuesFor([id]) } }))
                }, options);
                if (found) {
                    matched++;
                    summary[id].push({ collection: collectionName, documentId: String(found._id) });
                }
            }
            // Dense evidence makes more probes unhelpful. Only the query
            // strategy changes: every remaining original check still runs.
            if (matched === chunk.length) probeAbsence = false;
        }
    }
    return summary;
}

module.exports = { REFERENCE_QUERIES, findHistoryIdReferences, findHistoryIdReferenceSummary };
