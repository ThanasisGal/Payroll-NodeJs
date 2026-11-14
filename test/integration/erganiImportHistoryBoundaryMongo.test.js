'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { employmentFixture, inputRow, scheduleSheet } = require('../fixtures/erganiImportTransactionFixture');
const uri = process.env.PAYROLL_ERGANI_IMPORT_TEST_MONGO_URI || process.env.PAYROLL_SETTLEMENT_TEST_MONGO_URI;
const localUri = 'mongodb://127.0.0.1:27143/payroll_pr383_synthetic?replicaSet=payrollErganiImportTest';

test('PR383 primary ERGANI imports on a disposable real MongoDB replica set', { skip: !uri, timeout: 120000 }, async t => {
    // No application configuration, Atlas targets, credentials or general URI override.
    if (uri === localUri) {
        assert.equal(process.env.PAYROLL_ERGANI_IMPORT_TEST_DISPOSABLE, 'pr383-local-synthetic');
    } else {
        require('../fixtures/employeeHistorySettlementMongoTarget').assertMongoTarget({ uri,
            ci: process.env.GITHUB_ACTIONS, disposable: process.env.PAYROLL_SETTLEMENT_TEST_DISPOSABLE,
            job: process.env.GITHUB_JOB });
    }
    await mongoose.connect(uri, { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 5000 });
    t.after(() => mongoose.disconnect());
    assert.equal(mongoose.connection.host, '127.0.0.1');
    assert.equal(mongoose.connection.name, uri === localUri ? 'payroll_pr383_synthetic' : 'payroll_settlement_test_ci');
    const hello = await mongoose.connection.db.admin().command({ hello: 1 });
    assert.equal(hello.setName, uri === localUri ? 'payrollErganiImportTest' : 'payrollDraftTest');
    assert.deepEqual(hello.hosts, [uri === localUri ? '127.0.0.1:27143' : '127.0.0.1:27139']);
    const M = require('../../server/models/ergazomenoi');
    const Period = require('../../server/models/apasxoliseisPeriodControl');
    for (const model of [M.ErgazomenoiModel, M.IstorikoProslhpseonAllagonModel, M.ProdhlomenaOrariaModel, Period]) {
        await model.createCollection();
    }
    const controller = require('../../server/controllers/ergazomenoi/erganhController');
    const { saveTelikoToProdhlomena, assertErganiImportApplied } = controller.__scheduleDownloadTestHooks;
    const { saveKartesPayloadToMongo } = controller.__cardsDownloadTestHooks;
    const bson = row => mongoose.mongo.BSON.serialize(row);
    async function setup({ history = 'valid', existing = true, locked = false, periodStatus = null } = {}) {
        const f = employmentFixture(history), company = new mongoose.Types.ObjectId().toHexString();
        const scope = { team: 'PR383_SYNTHETIC', company_kod: company, ypokatasthma: '0000' };
        Object.assign(f.employee, scope, { _id: new mongoose.Types.ObjectId() });
        for (const row of f.history) Object.assign(row, scope, { _id: new mongoose.Types.ObjectId() });
        await M.ErgazomenoiModel.collection.insertOne(f.employee);
        await M.IstorikoProslhpseonAllagonModel.collection.insertMany(f.history);
        if (existing) await M.ProdhlomenaOrariaModel.collection.insertOne({ ...scope,
            kodikos: f.employee.kodikos, hmeromhnia: new Date('2026-06-01'), is_locked: locked });
        if (periodStatus) await Period.collection.insertOne({ ...scope,
            period_start: new Date('2026-06-01'), period_end: new Date('2026-06-30'), status: periodStatus,
            write_fence_version: 0, version: 1, deadline: new Date('2026-07-31'),
            frozen_snapshot_id: new mongoose.Types.ObjectId(), frozen_snapshot_fingerprint: 'synthetic-frozen' });
        const deps = { authorizedScope: scope, loadAppliedProtectionForRows: async () => ({ entriesByRowId: {}, diagnostics: [], hasConflicts: false }),
            argiesModel: { find: () => ({ lean: async () => [] }) } };
        const readRows = () => M.ProdhlomenaOrariaModel.collection.find(scope).sort({ _id: 1 }).toArray();
        const state = async () => ({
            employee: bson(await M.ErgazomenoiModel.collection.findOne({ _id: f.employee._id })),
            history: (await M.IstorikoProslhpseonAllagonModel.collection.find(scope).sort({ _id: 1 }).toArray()).map(bson),
            rows: (await readRows()).map(bson)
        });
        const receive = async (kind, rows = [inputRow]) => assertErganiImportApplied(kind === 'schedule'
            ? await saveTelikoToProdhlomena(scheduleSheet(rows), '2026', scope, deps)
            : await saveKartesPayloadToMongo(rows, deps));
        return { f, scope, deps, state, readRows, receive };
    }
    for (const kind of ['schedule', 'cards']) {
        for (const history of ['valid', 'missing', 'incomplete-past', 'overlap']) await t.test(`${kind}: ${history}, repeat and unchanged History`, async () => {
            const h = await setup({ history, existing: kind === 'cards' }), before = await h.state();
            const first = await h.receive(kind);
            assert.equal(first.matchedCount + (first.upsertedCount || 0), 1);
            const second = await h.receive(kind);
            assert.equal(second.matchedCount, 1); assert.equal(second.modifiedCount, 0);
            const rows = await h.readRows(); assert.equal(rows.length, 1);
            assert.equal(rows[0][kind === 'cards' ? 'cards_apo_ora_01' : 'apo_ora_01'], '08:00');
            assert.deepEqual((await h.state()).history, before.history);
        });
        for (const history of ['before-hire', 'after-departure', 'gap']) await t.test(`${kind}: ${history} permits primary evidence without changing History`, async () => {
            const h = await setup({ history }), before = await h.state();
            await h.receive(kind);
            assert.deepEqual((await h.state()).history, before.history);
        });
        for (const periodStatus of ['LOCKED', 'FINALIZED']) await t.test(`${kind}: ${periodStatus} protects missing rows`, async () => {
            const h = await setup({ periodStatus, existing: false }), before = await h.state();
            await assert.rejects(h.receive(kind), { code: 'EMPLOYEE_WORK_WRITE_PERIOD_PROTECTED' });
            assert.deepEqual(await h.state(), before);
        });
        await t.test(`${kind}: locked row cannot change`, async () => {
            const h = await setup({ locked: true }), before = await h.state();
            await assert.rejects(h.receive(kind), { code: 'EMPLOYEE_WORK_WRITE_NOT_APPLIED' });
            assert.deepEqual(await h.state(), before);
        });
        await t.test(`${kind}: driver transaction failure after database writes rolls back exact BSON`, async () => {
            const h = await setup(), before = await h.state(), original = M.ProdhlomenaOrariaModel.bulkWrite;
            try {
                M.ProdhlomenaOrariaModel.bulkWrite = async function (...args) {
                    await original.apply(this, args); throw Error('PR383_AFTER_REAL_WRITES');
                };
                await assert.rejects(h.receive(kind), /PR383_AFTER_REAL_WRITES/);
            } finally { M.ProdhlomenaOrariaModel.bulkWrite = original; }
            assert.deepEqual(await h.state(), before);
        });
        await t.test(`${kind}: real driver retries the full batch and commits exactly once`, async () => {
            const h = await setup(), original = M.ProdhlomenaOrariaModel.bulkWrite; let calls = 0;
            try {
                M.ProdhlomenaOrariaModel.bulkWrite = async function (...args) {
                    const result = await original.apply(this, args);
                    if (++calls === 1) throw new mongoose.mongo.MongoServerError({ message: 'PR383_SYNTHETIC_RETRY', code: 112,
                        errorLabels: ['TransientTransactionError'] });
                    return result;
                };
                await h.receive(kind);
            } finally { M.ProdhlomenaOrariaModel.bulkWrite = original; }
            assert.equal(calls, 2); assert.equal((await h.readRows()).length, 1);
            assert.equal((await M.ErgazomenoiModel.collection.findOne({ _id: h.f.employee._id })).employee_profile_mutation_sequence, 1);
        });
        await t.test(`${kind}: concurrent period finalization forces retry and then rejects the entire import`, async () => {
            const h = await setup({ periodStatus: 'OPEN' }), before = await h.state(), original = Period.updateOne;
            let raced = false;
            try {
                Period.updateOne = async function (...args) {
                    if (!raced) { raced = true; await Period.collection.updateOne(h.scope, { $set: { status: 'FINALIZED' } }); }
                    return original.apply(this, args);
                };
                await assert.rejects(h.receive(kind), { code: 'EMPLOYEE_WORK_WRITE_PERIOD_PROTECTED' });
            } finally { Period.updateOne = original; }
            assert.equal(raced, true); assert.deepEqual(await h.state(), before);
        });
        await t.test(`${kind}: acknowledgement failure after a real commit does not claim rollback`, async () => {
            const h = await setup(), connection = mongoose.connection, start = connection.startSession;
            try {
                connection.startSession = async function (...args) {
                    const session = await start.apply(this, args), transaction = session.withTransaction;
                    session.withTransaction = async function (...work) {
                        await transaction.apply(this, work); throw Error('PR383_AFTER_REAL_COMMIT');
                    };
                    return session;
                };
                await assert.rejects(h.receive(kind), { code: 'EMPLOYEE_WORK_WRITE_COMMIT_UNCONFIRMED' });
            } finally { connection.startSession = start; }
            assert.equal((await h.readRows())[0][kind === 'cards' ? 'cards_apo_ora_01' : 'apo_ora_01'], '08:00');
        });
    }
    await t.test('cards partial matches roll back all records and fences', async () => {
        const h = await setup(), before = await h.state();
        await assert.rejects(h.receive('cards', [inputRow, { ...inputRow, hmeromhnia_raw: '02/06/2026' }]),
            { code: 'EMPLOYEE_WORK_WRITE_NOT_APPLIED' });
        assert.deepEqual(await h.state(), before);
    });
});
