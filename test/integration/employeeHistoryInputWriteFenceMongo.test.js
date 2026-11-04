'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { assertMongoTarget, assertMongoConnection } = require('../fixtures/employeeHistorySettlementMongoTarget');
const uri = process.env.PAYROLL_SETTLEMENT_TEST_MONGO_URI;

test('PR365 real transaction wrapper and moved input write fence', { skip: !uri, timeout: 90000 }, async t => {
    assertMongoTarget({ uri, ci: process.env.GITHUB_ACTIONS,
        disposable: process.env.PAYROLL_SETTLEMENT_TEST_DISPOSABLE, job: process.env.GITHUB_JOB });
    await mongoose.connect(uri, { autoIndex: false, autoCreate: false, monitorCommands: true,
        serverSelectionTimeoutMS: 5000, appName: 'payroll-pr365-input-fence-regression' });
    t.after(() => mongoose.disconnect());
    assertMongoConnection(mongoose.connection);
    const client = mongoose.connection.getClient(), hello = await mongoose.connection.db.admin().command({ hello: 1 });
    assert.equal(hello.setName, 'payrollDraftTest'); assert.deepEqual(hello.hosts, ['127.0.0.1:27139']);
    const M = require('../../server/models/ergazomenoi');
    for (const model of [M.ErgazomenoiModel, M.IstorikoProslhpseonAllagonModel, M.ProdhlomenaOrariaModel,
        require('../../server/models/companies').CompaniesModel, require('../../server/models/employeeHistoryRepairAudit'),
        require('../../server/models/userModel'), require('../../server/models/privileges').UserPrivilegesModel]) await model.createCollection();
    const markers = await mongoose.connection.db.createCollection('PR365_Input_Fence_Regression');
    const { createMongoSettlementStore } = require('../fixtures/employeeHistorySettlementMongoStore');
    const { acceptanceBWithInitialGap } = require('../fixtures/employeeHistoryCoordinatedSettlementFixture');
    const { claimWeeklyRepoTransferInputs: claim } = require('../../server/services/ergazomenoi/apasxoliseisWeeklyRepoTransferInputWriteFenceService');
    const { claimUnchangedHistoryReferences: historyClaim } = require('../../server/services/ergazomenoi/employeeHistoryReferenceWriteFenceService');
    const events = []; client.on('commandStarted', event => events.push(event));
    const bson = value => mongoose.mongo.BSON.serialize(value);
    async function setup(sequence = 2) {
        const db = await createMongoSettlementStore({ fixture: acceptanceBWithInitialGap(), enriched: false });
        if (sequence !== null) await db.changeEmployee({ employee_profile_mutation_sequence: sequence });
        const rows = [0, 1].map(i => ({ _id: new mongoose.Types.ObjectId(), ...db.scope,
            hmeromhnia: new Date('2026-11-0' + (i + 1)), ...(i ? {} : { __v: 7 }) }));
        await M.ProdhlomenaOrariaModel.collection.insertMany(rows);
        return { db, rows, rebuilt: { context: { employee: { _id: new mongoose.Types.ObjectId(db.employeeId) }, weekRows: rows } } };
    }
    async function state(x) {
        const opts = { promoteValues: false, promoteLongs: false };
        return { employee: bson(await M.ErgazomenoiModel.collection.findOne({ _id: x.rebuilt.context.employee._id }, opts)),
            schedules: (await M.ProdhlomenaOrariaModel.collection.find({ _id: { $in: x.rows.map(row => row._id) } }, opts).sort({ _id: 1 }).toArray()).map(bson),
            history: (await M.IstorikoProslhpseonAllagonModel.collection.find(x.db.scope, opts).sort({ _id: 1 }).toArray()).map(bson) };
    }
    async function transaction(x, work) {
        const session = await x.db.protocolDependencies.connection.startSession();
        try { return await session.withTransaction(s => { assert.equal(s, session); return work(s); },
            { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' }, readPreference: 'primary' }); }
        finally { await session.endSession(); }
    }
    for (const sequence of [null, 2]) await t.test('same-session real write intents restore exact BSON, sequence=' + sequence, async () => {
        const x = await setup(sequence), before = await state(x), start = events.length;
        let identity;
        await transaction(x, async session => { identity = bson(session.id); assert.equal(session.inTransaction(), true);
            await claim({ rebuilt: x.rebuilt, scope: x.db.scope, session }); });
        assert.deepEqual(await state(x), before);
        const updates = events.slice(start).filter(event => event.commandName === 'update');
        assert.equal(updates.length, 6);
        for (const event of updates) { assert.equal(event.command.autocommit, false); assert.deepEqual(bson(event.command.lsid), identity); }
        assert.equal(x.db.transactionCallbacks(), 1);
    });
    await t.test('actual driver retry reruns the moved fence and commits exactly one marker', async () => {
        const x = await setup(), before = await state(x), id = new mongoose.Types.ObjectId(); let calls = 0;
        await transaction(x, async session => {
            calls++; await claim({ rebuilt: x.rebuilt, scope: x.db.scope, session });
            await markers.insertOne({ _id: id, purpose: 'synthetic-driver-retry' }, { session });
            if (calls === 1) throw new mongoose.mongo.MongoServerError({ message: 'synthetic transient conflict', code: 112,
                errorLabels: ['TransientTransactionError'] });
        });
        assert.equal(calls, 2); assert.equal(x.db.transactionCallbacks(), 2);
        assert.equal(await markers.countDocuments({ _id: id }), 1); assert.deepEqual(await state(x), before);
    });
    await t.test('real rollback after fence and insert preserves every original BSON and no marker', async () => {
        const x = await setup(), before = await state(x), id = new mongoose.Types.ObjectId();
        await assert.rejects(() => transaction(x, async session => {
            await claim({ rebuilt: x.rebuilt, scope: x.db.scope, session });
            await markers.insertOne({ _id: id, purpose: 'synthetic-rollback' }, { session });
            throw Error('PR365_AFTER_REAL_WRITES');
        }), { message: 'PR365_AFTER_REAL_WRITES' });
        assert.equal(await markers.countDocuments({ _id: id }), 0); assert.deepEqual(await state(x), before);
    });
    await t.test('acknowledgement loss is injected only after the real driver commit', async () => {
        const x = await setup(), id = new mongoose.Types.ObjectId(); x.db.failAt('COMMIT_ACK_LOST');
        await assert.rejects(() => transaction(x, session => markers.insertOne({ _id: id,
            purpose: 'synthetic-ack-loss' }, { session })), { message: 'INJECTED_AFTER_REAL_COMMIT' });
        assert.equal(await markers.countDocuments({ _id: id }), 1); assert.equal(x.db.transactionCallbacks(), 1);
    });
    await t.test('missing transaction or missing reconstructed row fails closed without data changes', async () => {
        const x = await setup(), before = await state(x), start = events.length;
        await assert.rejects(() => claim({ rebuilt: x.rebuilt, scope: x.db.scope, session: null }), { code: 'REPO_DECISION_INPUT_CHANGED', statusCode: 409 });
        assert.equal(events.length, start);
        const missing = { context: { ...x.rebuilt.context, weekRows: [...x.rows, { _id: new mongoose.Types.ObjectId() }] } };
        await assert.rejects(() => transaction(x, session => claim({ rebuilt: missing, scope: x.db.scope, session })),
            { code: 'REPO_DECISION_INPUT_CHANGED', statusCode: 409 });
        assert.deepEqual(await state(x), before);
    });
    await t.test('input and History write intents retain a real conflict against a concurrent sequence mutation', async () => {
        const x = await setup(), before = await state(x), input = await x.db.approvalInput();
        let release, reached, conflict;
        const hold = new Promise(resolve => { release = resolve; }), ready = new Promise(resolve => { reached = resolve; });
        const conflicted = new Promise(resolve => { conflict = resolve; });
        const failed = event => { if (event.failure?.code === 112) conflict(); }; client.on('commandFailed', failed);
        let first, second;
        const bounded = async promise => { let timer; try { return await Promise.race([promise,
            new Promise((_, reject) => { timer = setTimeout(() => reject(Error('PR365_CONFLICT_TIMEOUT')), 5000); })]); }
            finally { clearTimeout(timer); } };
        try {
            first = transaction(x, async session => {
                await claim({ rebuilt: x.rebuilt, scope: x.db.scope, session });
                await historyClaim({ historyRows: input.completeHistoryRows, scope: x.db.scope,
                    historyModel: M.IstorikoProslhpseonAllagonModel, session });
                reached(); await hold;
            });
            await bounded(ready);
            second = transaction(x, session => M.ErgazomenoiModel.collection.updateOne({ _id: x.rebuilt.context.employee._id },
                { $inc: { employee_profile_mutation_sequence: 1 } }, { session }));
            await bounded(conflicted); release(); await Promise.all([first, second]);
            const after = await state(x); assert.deepEqual(after.history, before.history); assert.deepEqual(after.schedules, before.schedules);
            const employee = mongoose.mongo.BSON.deserialize(after.employee); assert.equal(employee.employee_profile_mutation_sequence, 3);
            assert.ok(x.db.transactionCallbacks() >= 3, 'The driver must retry the conflicting second transaction');
        } finally { release(); await Promise.allSettled([first, second]); client.off('commandFailed', failed); }
    });
});
