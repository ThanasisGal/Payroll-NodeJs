'use strict';

const {
    AUDIT_COLLECTION_NAME,
    AUDIT_SCOPE_INDEX_NAME,
    AUDIT_SCOPE_INDEX_KEYS
} = require('../../constants/employeeHistoryRepairAudit');

function databaseFrom({ db, connection } = {}) {
    const database = db || connection?.db;
    if (!database?.listCollections || !database?.collection) {
        throw new TypeError('MongoDB database handle required');
    }
    return database;
}

async function employeeHistoryRepairAuditCollectionExists(options = {}) {
    const db = databaseFrom(options);
    return db.listCollections({ name: AUDIT_COLLECTION_NAME }, { nameOnly: true }).hasNext();
}

async function getEmployeeHistoryRepairAuditStorageState(options = {}) {
    const db = databaseFrom(options);
    const collectionExists = await employeeHistoryRepairAuditCollectionExists({ db });
    if (!collectionExists) {
        return { collection: AUDIT_COLLECTION_NAME, collectionExists: false,
            requiredIndexExists: false, ready: false };
    }
    const existingIndexes = await db.collection(AUDIT_COLLECTION_NAME).listIndexes().toArray();
    const requiredIndexExists = existingIndexes.some(index =>
        index.name === AUDIT_SCOPE_INDEX_NAME &&
        JSON.stringify(index.key) === JSON.stringify(AUDIT_SCOPE_INDEX_KEYS));
    return { collection: AUDIT_COLLECTION_NAME, collectionExists: true,
        requiredIndexExists, ready: requiredIndexExists };
}

async function setupEmployeeHistoryRepairAuditStorage(options = {}) {
    const db = databaseFrom(options);
    let collectionCreated = false;
    const initialState = await getEmployeeHistoryRepairAuditStorageState({ db });
    if (!initialState.collectionExists) {
        if (typeof db.createCollection !== 'function') throw new TypeError('createCollection required');
        await db.createCollection(AUDIT_COLLECTION_NAME);
        collectionCreated = true;
    }

    const collection = db.collection(AUDIT_COLLECTION_NAME);
    let indexCreated = false;
    if (!initialState.requiredIndexExists) {
        await collection.createIndex(AUDIT_SCOPE_INDEX_KEYS, {
            name: AUDIT_SCOPE_INDEX_NAME,
            background: false
        });
        indexCreated = true;
    }

    return {
        collection: AUDIT_COLLECTION_NAME,
        collectionCreated,
        indexCreated
    };
}

module.exports = {
    employeeHistoryRepairAuditCollectionExists,
    getEmployeeHistoryRepairAuditStorageState,
    setupEmployeeHistoryRepairAuditStorage
};
