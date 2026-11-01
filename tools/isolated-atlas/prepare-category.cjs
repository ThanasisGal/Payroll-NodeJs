'use strict';
const { loadEnvironment, reportFailure } = require('./runtime.cjs');
const { verifyClient } = require('../../server/config/isolatedTestRuntime');
const FIXTURE = Object.freeze({ kodikos:'TEST_5025',
    perigrafh:'Συνθετική κατηγορία TEST 5025 — μόνο για έλεγχο εκκίνησης', prefix:'_TEST_5025_' });

async function prepare(client, ObjectId) {
    // Verify the exact authenticated destination immediately before this narrowly scoped write.
    await verifyClient(client);
    const collection = client.db().collection('Eidikes_Kathgories');
    const document = { _id:new ObjectId('502500000000000000000001'), ...FIXTURE };
    const existing = await collection.findOne({ $or:[{ _id:document._id }, { kodikos:FIXTURE.kodikos }] });
    if (existing) {
        if (String(existing._id) !== String(document._id) || Object.entries(FIXTURE).some(([key,value]) => existing[key] !== value))
            throw Error('SYNTHETIC_CATEGORY_CONFLICT');
        return { inserted:0, existing:1 };
    }
    await collection.insertOne(document);
    return { inserted:1, existing:0 };
}

async function main() {
    if (process.argv.length !== 2) throw Error('NO_ARGUMENTS_ALLOWED');
    const uri = loadEnvironment();
    const { MongoClient, ObjectId } = require('mongoose').mongo;
    const client = new MongoClient(uri, { dbName:'payroll_test_isolated', retryWrites:false,
        serverSelectionTimeoutMS:8000, maxPoolSize:1 });
    try {
        await client.connect();
        console.log(JSON.stringify({ database:'payroll_test_isolated', collection:'Eidikes_Kathgories',
            ...await prepare(client, ObjectId), fixture:FIXTURE, employeesCreated:0, companiesCreated:0 }));
    } finally { await client.close(); }
}
module.exports = { FIXTURE, prepare };
if (require.main === module) main().catch(() => { reportFailure('CATEGORY'); process.exitCode=1; });
