'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
    AUDIT_COLLECTION_NAME,
    AUDIT_SCOPE_INDEX_NAME,
    AUDIT_SCOPE_INDEX_KEYS
} = require('../../constants/employeeHistoryRepairAudit');
const {
    employeeHistoryRepairAuditCollectionExists,
    getEmployeeHistoryRepairAuditStorageState,
    setupEmployeeHistoryRepairAuditStorage
} = require('./employeeHistoryRepairAuditSetupService');

function database({ exists = false, requiredIndex = false } = {}) {
    let collectionExists = exists;
    const indexes = [{ name: '_id_', key: { _id: 1 } }];
    if (requiredIndex) indexes.push({ name: AUDIT_SCOPE_INDEX_NAME,
        key: { ...AUDIT_SCOPE_INDEX_KEYS } });
    const calls = { creates: 0, indexes: 0 };
    const collection = {
        listIndexes: () => ({ toArray: async () => structuredClone(indexes) }),
        async createIndex(key, options) {
            calls.indexes += 1;
            indexes.push({ name: options.name, key: { ...key } });
            return options.name;
        }
    };
    const db = {
        listCollections: ({ name }) => ({ async hasNext() {
            return name === AUDIT_COLLECTION_NAME && collectionExists;
        } }),
        async createCollection(name) {
            assert.equal(name, AUDIT_COLLECTION_NAME);
            calls.creates += 1;
            collectionExists = true;
            return collection;
        },
        collection(name) {
            assert.equal(name, AUDIT_COLLECTION_NAME);
            return collection;
        }
    };
    return { db, calls };
}

test('collection-exists check is read-only for present and missing storage', async () => {
    const present = database({ exists: true });
    const missing = database({ exists: false });
    assert.equal(await employeeHistoryRepairAuditCollectionExists({ db: present.db }), true);
    assert.equal(await employeeHistoryRepairAuditCollectionExists({ db: missing.db }), false);
    assert.deepEqual(present.calls, { creates: 0, indexes: 0 });
    assert.deepEqual(missing.calls, { creates: 0, indexes: 0 });
});

test('read-only readiness requires both collection and exact required index', async () => {
    assert.deepEqual(await getEmployeeHistoryRepairAuditStorageState({
        db: database({ exists: false }).db
    }), { collection: AUDIT_COLLECTION_NAME, collectionExists: false,
        requiredIndexExists: false, ready: false });
    assert.deepEqual(await getEmployeeHistoryRepairAuditStorageState({
        db: database({ exists: true }).db
    }), { collection: AUDIT_COLLECTION_NAME, collectionExists: true,
        requiredIndexExists: false, ready: false });
    assert.deepEqual(await getEmployeeHistoryRepairAuditStorageState({
        db: database({ exists: true, requiredIndex: true }).db
    }), { collection: AUDIT_COLLECTION_NAME, collectionExists: true,
        requiredIndexExists: true, ready: true });
});

test('missing collection setup creates only the collection and required index', async () => {
    const state = database();
    const result = await setupEmployeeHistoryRepairAuditStorage({ db: state.db });
    assert.deepEqual(result, { collection: AUDIT_COLLECTION_NAME,
        collectionCreated: true, indexCreated: true });
    assert.deepEqual(state.calls, { creates: 1, indexes: 1 });
});

test('setup is idempotent when collection and required index already exist', async () => {
    const state = database({ exists: true, requiredIndex: true });
    const first = await setupEmployeeHistoryRepairAuditStorage({ db: state.db });
    const second = await setupEmployeeHistoryRepairAuditStorage({ db: state.db });
    assert.deepEqual(first, { collection: AUDIT_COLLECTION_NAME,
        collectionCreated: false, indexCreated: false });
    assert.deepEqual(second, first);
    assert.deepEqual(state.calls, { creates: 0, indexes: 0 });
});
