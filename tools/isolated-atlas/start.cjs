'use strict';
const { loadEnvironment, reportFailure } = require('./runtime.cjs');
const policy = require('../../server/config/isolatedTestRuntime');
let mongoose, store;

async function main() {
    const {FLAG:flag,EXECUTE_FLAG}=require('../../server/services/ergazomenoi/employeeHistorySettlementIsolatedTestPolicy');
    if (process.argv.length !== 2 && !(process.argv.length===3 && [flag,EXECUTE_FLAG].includes(process.argv[2]))) throw Error('ARGUMENT_REJECTED');
    const uri = loadEnvironment();
    if([flag,EXECUTE_FLAG].includes(process.argv[2]))process.env.JWT_SECRET_KEY=require('node:crypto').randomBytes(48).toString('hex');
    await new Promise((resolve,reject) => {
        const probe = require('node:net').createServer();
        probe.once('error', reject);
        probe.listen(5025,'127.0.0.1', () => probe.close(resolve));
    });
    mongoose = require('mongoose');
    require('../../server/config/automaticDbSchemaOperations').configureMongooseAutomaticSchemaOperations(mongoose);
    await mongoose.connect(uri, { autoIndex:false, autoCreate:false, serverSelectionTimeoutMS:8000 });
    store = require('../../config/sessionOpts').sessionOpts.store;
    store.on('error', () => { reportFailure('SESSION'); process.exit(1); });
    const sessions = await store.clientP;
    const collection = await store.collectionP;
    if (collection.namespace.split('.')[0] !== 'payroll_test_isolated' || store.options.autoRemove !== 'disabled')
        throw Error('SESSION_TARGET_REJECTED');
    await policy.activate({ clients:[mongoose.connection.getClient(), sessions] });
    if (!await mongoose.connection.db.collection('Eidikes_Kathgories').findOne({ kodikos:'TEST_5025', prefix:'_TEST_5025_' }))
        throw Error('SYNTHETIC_CATEGORY_REQUIRED');
    // This smoke-test instance cannot make external HTTP submissions or fetch cloud resources.
    const blocked = () => { throw Error('ISOLATED_EXTERNAL_HTTP_DISABLED'); };
    for (const name of ['node:http','node:https']) {
        const transport = require(name); transport.request = blocked; transport.get = blocked;
    }
    globalThis.fetch = blocked;
    console.log(JSON.stringify({ database:mongoose.connection.name, user:'payroll_dev_test', connectionsVerified:2,
        automaticTasksEnabled:policy.automaticTasksEnabled(), externalHttpEnabled:false, historyExecutionEnabled:false }));
    require('../../app');
}
process.on('uncaughtException', () => { reportFailure('RUNTIME'); process.exit(1); });
process.on('unhandledRejection', () => { reportFailure('RUNTIME'); process.exit(1); });
main().catch(async () => {
    reportFailure('START');
    try { if (store) await store.close(); if (mongoose) await mongoose.disconnect(); } catch {}
    process.exitCode=1;
});
