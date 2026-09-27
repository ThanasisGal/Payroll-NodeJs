'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
    validateSetupRequest,
    runSetup
} = require('./setupEmployeeHistoryRepairAudit');
const { runCheck } = require('./checkEmployeeHistoryRepairAudit');
const {
    AUDIT_COLLECTION_NAME,
    AUDIT_SCOPE_INDEX_NAME,
    AUDIT_SCOPE_INDEX_KEYS
} = require('../server/constants/employeeHistoryRepairAudit');

const developmentUri = 'mongodb://dev.invalid/payroll_dev';
const productionUri = 'mongodb+srv://user:secret@prod.invalid/payroll_prod?retryWrites=true';

function argv(database, extra = []) {
    return ['--apply', `--expected-database=${database}`, ...extra];
}

function fakeClient({ exists = false, requiredIndex = false } = {}) {
    let collectionExists = exists;
    const indexes = [{ name: '_id_', key: { _id: 1 } }];
    if (requiredIndex) indexes.push({ name: AUDIT_SCOPE_INDEX_NAME,
        key: { ...AUDIT_SCOPE_INDEX_KEYS } });
    const calls = { connect: 0, close: 0, creates: 0, indexes: 0 };
    const collection = {
        listIndexes: () => ({ toArray: async () => structuredClone(indexes) }),
        async createIndex(key, options) {
            calls.indexes += 1;
            indexes.push({ name: options.name, key: { ...key } });
        }
    };
    const db = {
        listCollections: ({ name }) => ({ hasNext: async () =>
            name === AUDIT_COLLECTION_NAME && collectionExists }),
        async createCollection() { calls.creates += 1; collectionExists = true; },
        collection: () => collection
    };
    const client = {
        async connect() { calls.connect += 1; },
        async close() { calls.close += 1; },
        db: () => db
    };
    return { client, calls };
}

test('development target with known distinct production target is accepted', () => {
    const result = validateSetupRequest({ argv: argv('payroll_dev'),
        env: { NODE_ENV: 'development', MONGODB_URL: developmentUri },
        knownProductionUri: productionUri });
    assert.equal(result.database, 'payroll_dev');
    assert.equal(result.production, false);
});

test('production target requires approval regardless of NODE_ENV', () => {
    for (const nodeEnvironment of ['production', 'development']) {
        assert.throws(() => validateSetupRequest({ argv: argv('payroll_prod'),
            env: { NODE_ENV: nodeEnvironment, MONGODB_URL: productionUri },
            knownProductionUri: productionUri }), /--allow-production/);
        assert.equal(validateSetupRequest({
            argv: argv('payroll_prod', ['--allow-production']),
            env: { NODE_ENV: nodeEnvironment, MONGODB_URL: productionUri },
            knownProductionUri: productionUri
        }).production, true);
    }
});

test('ambiguous target identity, missing apply and wrong expected database are refused', () => {
    for (const nodeEnvironment of ['development', 'production']) {
        assert.throws(() => validateSetupRequest({ argv: argv('payroll_dev'),
            env: { NODE_ENV: nodeEnvironment, MONGODB_URL: developmentUri },
            knownProductionUri: null }), /ασαφής/);
    }
    assert.throws(() => validateSetupRequest({ argv: ['--expected-database=payroll_dev'],
        env: { NODE_ENV: 'development', MONGODB_URL: developmentUri },
        knownProductionUri: productionUri }), /--apply/);
    assert.throws(() => validateSetupRequest({ argv: argv('wrong'),
        env: { NODE_ENV: 'development', MONGODB_URL: developmentUri },
        knownProductionUri: productionUri }), /expected-database/);
});

test('setup connects only after validation and remains idempotent', async () => {
    const target = fakeClient();
    const options = { argv: argv('payroll_dev'),
        env: { NODE_ENV: 'development', MONGODB_URL: developmentUri },
        knownProductionUri: productionUri, clientFactory: () => target.client,
        output: () => {} };
    await runSetup(options);
    await runSetup(options);
    assert.deepEqual(target.calls, { connect: 2, close: 2, creates: 1, indexes: 1 });
});

test('read-only release check accepts ready storage and rejects missing storage', async () => {
    const ready = fakeClient({ exists: true, requiredIndex: true });
    const result = await runCheck({ env: { MONGODB_URL: developmentUri },
        clientFactory: () => ready.client, output: () => {} });
    assert.equal(result.ready, true);
    assert.deepEqual(ready.calls, { connect: 1, close: 1, creates: 0, indexes: 0 });

    const missing = fakeClient();
    await assert.rejects(runCheck({ env: { MONGODB_URL: developmentUri },
        clientFactory: () => missing.client, output: () => {} }),
    /EMPLOYEE_HISTORY_REPAIR_AUDIT_NOT_READY/);
    assert.deepEqual(missing.calls, { connect: 1, close: 1, creates: 0, indexes: 0 });
});
