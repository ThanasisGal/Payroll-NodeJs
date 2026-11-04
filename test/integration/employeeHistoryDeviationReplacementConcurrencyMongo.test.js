'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const target = require('../fixtures/employeeHistorySettlementMongoTarget');
const uri = process.env.PAYROLL_SETTLEMENT_TEST_MONGO_URI;

test('Gate 2 real replaceDeviations against NORMAL Settlement v2', { skip: !uri, timeout: 180000 }, async t => {
    target.assertMongoTarget({ uri, ci: process.env.GITHUB_ACTIONS,
        disposable: process.env.PAYROLL_SETTLEMENT_TEST_DISPOSABLE, job: process.env.GITHUB_JOB });
    const mongoose = require('mongoose');
    assert.equal(mongoose.connection.readyState, 0);
    await mongoose.connect(uri, { autoIndex: false, autoCreate: false, monitorCommands: true,
        appName: 'payroll-gate2-deviation-proof', serverSelectionTimeoutMS: 5000 });
    t.after(() => mongoose.disconnect()); target.assertMongoConnection(mongoose.connection);
    const hello = await mongoose.connection.db.admin().command({ hello: 1 });
    assert.equal(hello.setName, 'payrollDraftTest'); assert.deepEqual(hello.hosts, ['127.0.0.1:27139']);
    const M = require('../../server/models/ergazomenoi');
    const D = M.ProdhlomenaOrariaDeviationsModel, H = M.IstorikoProslhpseonAllagonModel;
    const Period = require('../../server/models/apasxoliseisPeriodControl');
    const P = require('../../server/services/ergazomenoi/apasxoliseisPeriodControlService');
    for (const model of [M.ErgazomenoiModel, H, D, Period,
        require('../../server/models/employeeHistoryRepairAudit'), require('../../server/models/userModel'),
        require('../../server/models/privileges').UserPrivilegesModel, require('../../server/models/companies').CompaniesModel])
        await model.createCollection();
    // Build the schema's exact unique index only on the guarded disposable DB.
    await Period.createIndexes();
    await require('../../server/services/ergazomenoi/apasxoliseisPeriodControlIndexGuardService')
        .assertPeriodControlIndexesReady();
    const replace = require('../../server/controllers/ergazomenoi/erganhController')
        .__weeklyRepoDeviationWriteTestHooks.replaceWeeklyRepoDeviations;
    const S = require('../../server/services/ergazomenoi/employeeHistoryAutomaticSettlementPreparationContract');
    const U = require('../../server/services/ergazomenoi/employeeHistoryCoordinatedSettlementContract');
    const W = require('../../server/services/ergazomenoi/employeeEmploymentProfileWriter');
    const { createMongoSettlementStore } = require('../fixtures/employeeHistorySettlementMongoStore');
    const { acceptanceBWithInitialGap } = require('../fixtures/employeeHistoryCoordinatedSettlementFixture');
    const client = mongoose.connection.getClient(), conflicts = [], commands = [];
    client.on('commandFailed', e => { if (e.failure?.code === 112) conflicts.push(e); });
    client.on('commandStarted', e => commands.push(e));
    async function bounded(promise) {
        let timer; try { return await Promise.race([promise, new Promise((_, reject) => {
            timer = setTimeout(() => reject(Error('DEVIATION_BARRIER_TIMEOUT')), 10000);
        })]); } finally { clearTimeout(timer); }
    }
    function waitConflict() {
        let listener;
        const reached = new Promise(resolve => { listener = e => { if (e.failure?.code === 112) resolve(e); }; });
        client.on('commandFailed', listener);
        return { reached, close: () => client.off('commandFailed', listener) };
    }
    const stale = e => e.code === S.PREFIX + 'STALE';
    const business = row => {
        const { history_reference_fence, updatedAt, employment_history_canonical_status,
            employment_history_canonical_survivor_id, ...value } = row; return value;
    };
    async function setup(branch, variant = 'empty') {
        const db = await createMongoSettlementStore({ fixture: acceptanceBWithInitialGap(), enriched: false,
            executionMode: 'NORMAL', settlementReferenceEvidence: true, referenceCopies: 0 });
        const initial = await db.state(), periodStart = new Date('2026-11-01T00:00:00Z'),
            periodEnd = new Date('2026-11-30T00:00:00Z'), cleanupEnd = new Date('2026-11-30T23:59:59.999Z');
        const scope = { team: db.scope.team, company_kod: db.scope.company_kod, ypokatasthma: '0001',
            period_start: periodStart, period_end: periodEnd };
        const cleanup = { team: db.scope.team, company_kod: db.scope.company_kod,
            period_apo: periodStart, period_eos: cleanupEnd, ypokatasthma: '0001' };
        const document = (historyId, overrides = {}) => ({ ...cleanup, kodikos: db.scope.kodikos,
            week_apo: new Date('2026-11-02'), week_eos: new Date('2026-11-08'),
            effective_profile_istoriko_id: historyId, actual_repo: 1, expected_repo: 2,
            note: 'isolated old deviation', ...overrides });
        const nonrepresentative = ['nonrepresentative-delete', 'same-id-bson'].includes(variant);
        const old = await D.create(Array.from({ length: 8 }, (_, i) => document(initial.history[0]._id,
            nonrepresentative && i < 7 ? { period_apo: new Date('2026-10-01') } : {})));
        let incoming = [], otherHistory;
        if (variant === 'different-reference') incoming = [document(initial.history[1]._id, { note: 'new history reference' })];
        if (variant === 'same-id-bson') incoming = [document(initial.history[0]._id,
            { _id: old[7]._id, note: 'BSON changed with identical identity', actual_repo: 3 })];
        if (variant === 'multi-employee') {
            otherHistory = { ...initial.history[0], _id: new mongoose.Types.ObjectId(), kodikos: db.scope.kodikos + '-other' };
            await H.collection.insertOne(otherHistory);
            await M.ErgazomenoiModel.collection.insertOne({ ...initial.employee, _id: new mongoose.Types.ObjectId(), kodikos: otherHistory.kodikos });
            await D.create(document(otherHistory._id, { kodikos: otherHistory.kodikos }));
            incoming = [document(initial.history[1]._id, { note: 'first employee replacement' }),
                document(otherHistory._id, { kodikos: otherHistory.kodikos, note: 'second employee replacement' })];
        }
        const calculationId = 'gate2-deviations-' + db.employeeId;
        if (branch === 'period') await P.acquirePeriodCalculationOwnership({ scope, calculationId,
            now: new Date('2026-11-03T12:00:00Z') });
        const input = await db.approvalInput();
        const approved = S.buildEmployeeHistorySettlementApprovalFingerprint({ ...input,
            proposal: U.buildCoordinatedSettlementProposal(input) });
        const run = () => W.applyEmployeeEmploymentHistorySettlementInSyntheticStore({ syntheticStore: db.handle,
            scope: db.scope, employeeId: db.employeeId, actorUserId: db.actorUserId, coordinated: true,
            approval: { confirmed: true, fingerprint: approved } });
        const writer = () => replace({ deviationsCleanupFilter: cleanup, deviationRecords: incoming,
            periodControlScope: branch === 'period' ? scope : null, calculationId });
        const read = () => D.collection.find({ team: db.scope.team, company_kod: db.scope.company_kod }).sort({ _id: 1 }).toArray();
        const before = { ...await db.state(), deviations: await read() };
        async function assertReplacement() {
            const matching = await D.collection.find(cleanup).toArray(); assert.equal(matching.length, incoming.length);
            if (branch === 'period') assert.equal((await Period.findOne(scope).lean()).write_fence_version, 1,
                'Retried callbacks must increment the period fence only once');
            else assert.equal(await Period.countDocuments(scope), 0);
            for (const record of incoming) {
                const saved = matching.find(row => row.kodikos === record.kodikos);
                assert.ok(saved); assert.equal(String(saved.effective_profile_istoriko_id), String(record.effective_profile_istoriko_id));
                assert.equal(saved.note, record.note);
            }
            if (nonrepresentative) {
                const after = await read(); assert.equal(after.length, 7 + incoming.length);
                for (const row of before.deviations.slice(0, 7)) assert.deepEqual(after.find(x => String(x._id) === String(row._id)), row);
                if (variant === 'same-id-bson') {
                    const updated = after.find(row => String(row._id) === String(old[7]._id));
                    assert.equal(updated.actual_repo, 3); assert.notDeepEqual(updated, before.deviations[7]);
                }
            }
            if (otherHistory) {
                const saved = await H.collection.findOne({ _id: otherHistory._id });
                assert.deepEqual(business(saved), business(otherHistory));
            }
        }
        return { db, run, writer, read, before, incoming, cleanup, document, scope, calculationId, assertReplacement };
    }
    for (const branch of ['standalone', 'period']) {
        for (const variant of ['empty', 'different-reference', 'nonrepresentative-delete', 'same-id-bson', 'multi-employee']) {
            await t.test(`${branch} ${variant}: replacement first, real snapshot conflict and stale approval`, async () => {
                const c = await setup(branch, variant), barrier = c.db.pauseNextEmployeeRead(), start = conflicts.length;
                const pending = assert.rejects(c.run(), stale);
                try { await bounded(barrier.reached); await c.writer(); } finally { barrier.resume(); }
                await pending; assert.ok(conflicts.length > start); assert.ok(c.db.transactionCallbacks() >= 2);
                await c.assertReplacement();
                const after = await c.db.state(); assert.equal(after.audits.length, 0);
                assert.deepEqual(after.employee, c.before.employee); assert.deepEqual(after.references, c.before.references);
                assert.deepEqual(after.history.map(business), c.before.history.map(business));
            });
            await t.test(`${branch} ${variant}: settlement first, writer conflicts then serializes after commit`, async () => {
                const c = await setup(branch, variant), barrier = c.db.pauseNextReferenceClaim(), conflict = waitConflict();
                const pending = c.run(); let writing, done = false;
                try {
                    await bounded(barrier.reached);
                    writing = c.writer().then(value => { done = true; return value; });
                    const actualConflict = await bounded(conflict.reached); assert.equal(done, false);
                    if (['empty', 'nonrepresentative-delete'].includes(variant)) assert.equal(actualConflict.commandName, 'delete');
                } finally { barrier.resume(); conflict.close(); }
                assert.equal((await pending).applied, true); await writing; await c.assertReplacement();
                const after = await c.db.state(); assert.equal(after.audits.length, 1);
                assert.equal(after.employee.employee_profile_mutation_sequence,
                    (c.before.employee.employee_profile_mutation_sequence || 0) + 1);
                assert.deepEqual(after.references, c.before.references);
                for (const original of c.before.history) assert.deepEqual(business(after.history.find(row => String(row._id) === String(original._id))), business(original));
                const deletes = commands.filter(e => e.commandName === 'delete' && e.command.deletes?.[0]?.q?.company_kod === c.db.scope.company_kod);
                assert.ok(deletes.length >= (['empty', 'nonrepresentative-delete'].includes(variant) ? 2 : 1),
                    'A conflict at delete must rerun the actual replacement body');
            });
        }
        await t.test(`${branch}: completed empty replacement rejects the prior approval before any settlement write`, async () => {
            const c = await setup(branch);
            await c.writer(); const start = commands.length;
            const before = { state: await c.db.state(), rows: await c.read() };
            await assert.rejects(c.run, stale);
            assert.equal(commands.slice(start).filter(e => ['insert', 'update', 'delete'].includes(e.commandName)).length, 0);
            assert.deepEqual(await c.db.state(), before.state); assert.deepEqual(await c.read(), before.rows);
        });
        await t.test(`${branch}: insertMany duplicate error rolls back real delete and all partial inserts`, async () => {
            const c = await setup(branch, 'different-reference');
            const preserved = await D.create(c.document(c.before.history[0]._id,
                { period_apo: new Date('2026-10-01'), note: 'outside cleanup' }));
            c.incoming.push(c.document(c.before.history[0]._id, { _id: preserved._id }));
            const before = { state: await c.db.state(), rows: await c.read() };
            await assert.rejects(c.writer, error => error.code === 11000);
            assert.deepEqual(await c.read(), before.rows); assert.deepEqual(await c.db.state(), before.state);
            if (branch === 'period') assert.equal((await Period.findOne(c.scope).lean()).write_fence_version, 0);
        });
        await t.test(`${branch}: unrelated employee in same company and another branch progresses while settlement holds references`, async () => {
            const c = await setup(branch), otherCode = c.db.scope.kodikos + '-independent', historyId = new mongoose.Types.ObjectId();
            await H.collection.insertOne({ ...c.before.history[0], _id: historyId, kodikos: otherCode });
            const cleanup = { ...c.cleanup, ypokatasthma: '0002' }, otherScope = { ...c.scope, ypokatasthma: '0002' };
            const record = c.document(historyId, { kodikos: otherCode, ypokatasthma: '0002' });
            await D.create(record);
            if (branch === 'period') await P.acquirePeriodCalculationOwnership({ scope: otherScope,
                calculationId: c.calculationId, now: new Date('2026-11-03T12:00:00Z') });
            const barrier = c.db.pauseNextReferenceClaim(), pending = c.run();
            try {
                await bounded(barrier.reached);
                await bounded(replace({ deviationsCleanupFilter: cleanup, deviationRecords: [],
                    periodControlScope: branch === 'period' ? otherScope : null, calculationId: c.calculationId }));
                assert.equal(await D.countDocuments(cleanup), 0);
            } finally { barrier.resume(); }
            assert.equal((await pending).applied, true); assert.equal((await c.db.state()).audits.length, 1);
        });
    }
});
