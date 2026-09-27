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

async function findHistoryIdReferences({ connection, historyIds = [], session } = {}) {
    if (!historyIds.length) return [];
    if (typeof connection?.collection !== 'function') {
        throw new TypeError('MongoDB connection with collection() required');
    }
    const values = valuesFor(historyIds);
    const references = [];
    for (const [collectionName, fields] of REFERENCE_QUERIES) {
        const found = await connection.collection(collectionName).findOne({
            $or: fields.map(field => ({ [field]: { $in: values } }))
        }, { session, projection: { _id: 1 } });
        if (found) references.push({ collection: collectionName, documentId: String(found._id) });
    }
    return references;
}

module.exports = { REFERENCE_QUERIES, findHistoryIdReferences };
