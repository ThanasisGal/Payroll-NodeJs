const assert = require('assert');
const fs = require('fs');
const path = require('path');
const MongoStore = require('connect-mongo');
const {
    automaticDbSchemaOperationsEnabled,
    configureMongooseAutomaticSchemaOperations,
    buildMongooseConnectionOptions,
    buildSessionStoreOptions
} = require('./automaticDbSchemaOperations');

for (const value of [undefined, 'true']) {
    const env = value === undefined ? {} : { PAYROLL_AUTOMATIC_DB_SCHEMA_OPERATIONS_ENABLED: value };
    const calls = [];
    assert.strictEqual(automaticDbSchemaOperationsEnabled(env), true);
    assert.deepStrictEqual(configureMongooseAutomaticSchemaOperations({ set: (...args) => calls.push(args) }, env), {
        enabled: true, autoIndex: undefined, autoCreate: undefined
    });
    assert.deepStrictEqual(calls, []);
    assert.deepStrictEqual(buildMongooseConnectionOptions({ maxPoolSize: 7 }, env), { maxPoolSize: 7 });
    assert.deepStrictEqual(buildSessionStoreOptions({ autoRemove: 'native', ttl: 60 }, env), {
        autoRemove: 'native', ttl: 60
    });
}

const disabledEnv = { PAYROLL_AUTOMATIC_DB_SCHEMA_OPERATIONS_ENABLED: 'false' };
const mongooseCalls = [];
assert.deepStrictEqual(configureMongooseAutomaticSchemaOperations({
    set: (...args) => mongooseCalls.push(args)
}, disabledEnv), { enabled: false, autoIndex: false, autoCreate: false });
assert.deepStrictEqual(mongooseCalls, [['autoIndex', false], ['autoCreate', false]]);
assert.deepStrictEqual(buildMongooseConnectionOptions({ maxPoolSize: 7 }, disabledEnv), {
    maxPoolSize: 7, autoIndex: false, autoCreate: false
});
assert.deepStrictEqual(buildSessionStoreOptions({ autoRemove: 'native', ttl: 60 }, disabledEnv), {
    autoRemove: 'disabled', ttl: 60
});

async function testExistingSessionCollectionCanStillStoreDocument() {
    let createIndexCalls = 0;
    let updateOneCalls = 0;
    const collection = {
        createIndex: async () => { createIndexCalls++; },
        updateOne: async () => { updateOneCalls++; return { acknowledged: true }; }
    };
    const client = { db: () => ({ collection: () => collection }) };
    const store = MongoStore.create(buildSessionStoreOptions({
        clientPromise: Promise.resolve(client),
        ttl: 60,
        autoRemove: 'native'
    }, disabledEnv));
    await store.collectionP;
    await new Promise((resolve, reject) => store.set('test-session', {
        cookie: { expires: new Date(Date.now() + 60000) }, userId: 'test-user'
    }, (error) => error ? reject(error) : resolve()));
    assert.strictEqual(createIndexCalls, 0);
    assert.strictEqual(updateOneCalls, 1);
}

const appSource = fs.readFileSync(path.join(__dirname, '../../app.js'), 'utf8');
assert.ok(appSource.indexOf('configureMongooseAutomaticSchemaOperations') <
    appSource.indexOf("require('./config/sessionOpts')"));
assert.doesNotMatch(appSource, /\.syncIndexes\(|\.createIndexes\(|\.ensureIndexes\(/);

testExistingSessionCollectionCanStillStoreDocument().then(() => {
    console.log('automatic DB schema operation safeguard tests passed');
}).catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
