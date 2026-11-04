'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const target = require('../fixtures/employeeHistorySettlementMongoTarget');
const uri = process.env.PAYROLL_SETTLEMENT_TEST_MONGO_URI;

// Real service, real models, production index/role/period guards and MongoDB
// retries. Neither the reference fence nor any persistence operation is mocked.
test('Gate 2 actual canonical writer concurrency', { skip: !uri, timeout: 120000 }, async t => {
    target.assertMongoTarget({ uri, ci: process.env.GITHUB_ACTIONS,
        disposable: process.env.PAYROLL_SETTLEMENT_TEST_DISPOSABLE, job: process.env.GITHUB_JOB });
    const mongoose = require('mongoose');
    assert.equal(mongoose.connection.readyState, 0);
    await mongoose.connect(uri, { autoCreate: false, autoIndex: false, monitorCommands: true,
        appName: 'payroll-gate2-writer-proof', serverSelectionTimeoutMS: 5000 });
    t.after(() => mongoose.disconnect());
    target.assertMongoConnection(mongoose.connection);
    const hello = await mongoose.connection.db.admin().command({ hello: 1 });
    assert.equal(hello.setName, 'payrollDraftTest'); assert.deepEqual(hello.hosts, ['127.0.0.1:27139']);
    const models = require('../../server/models/ergazomenoi');
    const canonical = require('../../server/models/apasxoliseisWeeklyCanonicalDecision');
    const period = require('../../server/models/apasxoliseisPeriodControl');
    for (const model of [models.ErgazomenoiModel, models.IstorikoProslhpseonAllagonModel,
        require('../../server/models/employeeHistoryRepairAudit'), require('../../server/models/userModel'),
        require('../../server/models/privileges').UserPrivilegesModel, require('../../server/models/companies').CompaniesModel,
        canonical, period]) await model.createCollection();
    await canonical.createIndexes(); await period.createIndexes();
    const C = require('../../server/services/ergazomenoi/apasxoliseisWeeklyCanonicalDecisionService');
    const P = require('../../server/services/ergazomenoi/apasxoliseisPeriodControlService');
    const S = require('../../server/services/ergazomenoi/employeeHistoryAutomaticSettlementPreparationContract');
    const U = require('../../server/services/ergazomenoi/employeeHistoryCoordinatedSettlementContract');
    const W = require('../../server/services/ergazomenoi/employeeEmploymentProfileWriter');
    const { createMongoSettlementStore } = require('../fixtures/employeeHistorySettlementMongoStore');
    const { acceptanceBWithInitialGap } = require('../fixtures/employeeHistoryCoordinatedSettlementFixture');
    const conflicts = [];
    const client = mongoose.connection.getClient();
    client.on('commandFailed', event => { if (event.failure?.code === 112) conflicts.push(event); });
    const bounded = async promise => {
        let timer; try { return await Promise.race([promise, new Promise((_, reject) => {
            timer = setTimeout(() => reject(Error('CONCURRENCY_BARRIER_TIMEOUT')), 10000);
        })]); } finally { clearTimeout(timer); }
    };
    async function setup(copies = 1) {
        const db = await createMongoSettlementStore({ fixture: acceptanceBWithInitialGap(), enriched: false,
            executionMode: 'NORMAL', settlementReferenceEvidence: true, referenceCopies: copies });
        const input = await db.approvalInput();
        const approved = S.buildEmployeeHistorySettlementApprovalFingerprint({ ...input,
            proposal: U.buildCoordinatedSettlementProposal(input) });
        const run = () => W.applyEmployeeEmploymentHistorySettlementInSyntheticStore({
            syntheticStore: db.handle, scope: db.scope, employeeId: db.employeeId, actorUserId: db.actorUserId,
            coordinated: true, approval: { confirmed: true, fingerprint: approved } });
        const scope = { team: db.scope.team, company_kod: db.scope.company_kod, ypokatasthma: '0001',
            period_start: '2026-06-01', period_end: '2026-06-30' };
        const now = new Date('2026-06-15T12:00:00Z');
        await period.create({ ...scope, deadline: P.calculatePeriodDeadline(scope.period_end), status: 'OPEN' });
        const currentInput = { ...scope, employee_kodikos: db.scope.kodikos, employee_id: db.employeeId,
            week_start: '2026-06-01', week_end: '2026-06-07',
            weekly_rows: [{ _id: new mongoose.Types.ObjectId(), hmeromhnia: '2026-06-01',
                kathgoria_ergasias: 'ΕΡΓ', kathgoria_ergasias_apologistika: 'ΕΡΓ', cards_ores_ergasias: 8 }],
            effective_profile: { hmeres_ergasias_ebdomadas: 5, istorikoId: String(input.completeHistoryRows[0]._id) },
            profile_history: [{ _id: String(input.completeHistoryRows[0]._id), kodikos: db.scope.kodikos }],
            canonical_status: 'NEEDS_HR_DECISION', canonical_reasons: ['CARD_VERIFICATION_PENDING'] };
        const session = { userTeam: db.scope.team, companyInUse: db.scope.company_kod, userId: db.actorUserId,
            userRole: 'A', userName: 'Gate 2 isolated actor', userStatus: 'A' };
        const command = { decision_type: 'CARD_VERIFICATION_PENDING', request_id: 'gate2-canonical-' + db.employeeId,
            decision_payload: { verified: true, evidence_reference: 'AUDIT:gate2-isolated-card',
                corrected_row_ids: [String(currentInput.weekly_rows[0]._id)] } };
        let callbacks = 0;
        const mutationRunner = async write => (await P.runWithPeriodWriteFence({ scope, now,
                transactionRunner: async work => {
                    const tx = await mongoose.startSession(); let result;
                    try { await tx.withTransaction(async () => { callbacks++; result = await work(tx); }); return result; }
                    finally { await tx.endSession(); }
                }, work: ({ session: tx }) => write(tx) })).result;
        const writer = () => C.recordWeeklyCanonicalDecision({ session, command, currentInput, mutationRunner });
        return { db, input, run, writer, callbacks: () => callbacks, scope, session, command, currentInput, mutationRunner };
    }
    const stale = error => error.code === S.PREFIX + 'STALE';
    const withoutFence = row => { const { history_reference_fence, updatedAt, ...value } = row; return value; };
    const withoutCanonicalMetadata = row => {
        const { employment_history_canonical_status, employment_history_canonical_survivor_id, updatedAt, ...value } = row;
        return value;
    };
    for (const copies of [0, 1, 7]) await t.test(`canonical writer first: reference ${copies + 1}, real conflict and stale rejection`, async () => {
        const { db, input, run, writer } = await setup(copies);
        assert.equal(input.protectedReferenceSummary[String(input.completeHistoryRows[0]._id)].length, copies);
        const before = await db.state(), barrier = db.pauseNextEmployeeRead(), start = conflicts.length;
        const pending = assert.rejects(run(), stale);
        try { await bounded(barrier.reached); assert.equal((await writer()).idempotent, false); }
        finally { barrier.resume(); }
        await pending;
        const after = await db.state();
        assert.ok(conflicts.length > start, 'Must observe actual MongoDB WriteConflict');
        assert.ok(db.transactionCallbacks() >= 2, 'Settlement must rerun its real transaction callback');
        assert.deepEqual(after.employee, before.employee); assert.equal(after.audits.length, 0);
        assert.deepEqual(after.history.map(withoutFence), before.history.map(withoutFence));
        assert.deepEqual(after.references, before.references);
        const fresh = await db.approvalInput();
        assert.equal(fresh.protectedReferenceSummary[String(input.completeHistoryRows[0]._id)].length, copies + 1);
    });
    await t.test('canonical settlement first: writer callback retries, then commits once without permanent lock', async () => {
        const { db, run, writer, callbacks } = await setup(7);
        const before = await db.state(), barrier = db.pauseNextReferenceClaim();
        const settlement = run(); let writerDone = false, pending;
        let onFailure;
        const failed = new Promise(resolve => { onFailure = event => { if (event.failure?.code === 112) resolve(); }; });
        client.on('commandFailed', onFailure);
        try {
            await bounded(barrier.reached);
            pending = writer().then(result => { writerDone = true; return result; });
            await bounded(failed); assert.equal(writerDone, false);
        } finally { barrier.resume(); client.off('commandFailed', onFailure); }
        assert.equal((await settlement).applied, true);
        assert.equal((await pending).idempotent, false); assert.ok(callbacks() >= 2);
        const after = await db.state();
        assert.equal(after.audits.length, 1);
        assert.equal(after.employee.employee_profile_mutation_sequence, (before.employee.employee_profile_mutation_sequence || 0) + 1);
        assert.deepEqual(after.references, before.references);
        // This approved fixture also inserts the missing initial period. Compare
        // every original row by identity; its historical payload must survive.
        for (const original of before.history) {
            const persisted = after.history.find(row => String(row._id) === String(original._id));
            assert.ok(persisted);
            assert.deepEqual(withoutFence(withoutCanonicalMetadata(persisted)), withoutFence(withoutCanonicalMetadata(original)));
        }
        assert.equal(await canonical.countDocuments({ team: db.scope.team, company_kod: db.scope.company_kod }), 1);
        assert.equal((await writer()).idempotent, true);
        assert.deepEqual(await db.state(), after);
    });
    await t.test('canonical writer for a different employee commits while settlement holds its references', async () => {
        const first = await setup();
        const otherHistoryId = new mongoose.Types.ObjectId(), otherEmployeeId = new mongoose.Types.ObjectId();
        const otherCode = first.db.scope.kodikos + '-other';
        await models.IstorikoProslhpseonAllagonModel.collection.insertOne({ ...first.input.completeHistoryRows[0],
            _id: otherHistoryId, kodikos: otherCode });
        await models.ErgazomenoiModel.collection.insertOne({ ...first.input.currentEmployee,
            _id: otherEmployeeId, kodikos: otherCode });
        const otherInput = { ...first.currentInput, employee_id: String(otherEmployeeId), employee_kodikos: otherCode,
            effective_profile: { ...first.currentInput.effective_profile, istorikoId: String(otherHistoryId) },
            profile_history: [{ _id: String(otherHistoryId), kodikos: otherCode }] };
        const otherWriter = () => C.recordWeeklyCanonicalDecision({ session: first.session, currentInput: otherInput,
            command: { ...first.command, request_id: first.command.request_id + '-other' }, mutationRunner: first.mutationRunner });
        const barrier = first.db.pauseNextReferenceClaim(), pending = first.run();
        try { await bounded(barrier.reached); assert.equal((await bounded(otherWriter())).idempotent, false); }
        finally { barrier.resume(); }
        assert.equal((await pending).applied, true);
        assert.equal((await first.db.state()).audits.length, 1);
        assert.equal(await canonical.countDocuments({ company_kod: first.scope.company_kod, employee_kodikos: otherCode }), 1);
    });
    await t.test('canonical writer rollback: real inserted decision and History fence both roll back', async () => {
        const { db, scope, writer } = await setup();
        const before = await db.state();
        // Inject a failure AFTER the real insert and real History fence, so
        // MongoDB must roll both back. All authorization checks stay active.
        const originalCreate = canonical.create;
        canonical.create = async function (...args) {
            const records = await originalCreate.apply(this, args);
            throw Error('GATE2_AFTER_REAL_CANONICAL_INSERT');
        };
        try { await assert.rejects(writer, /GATE2_AFTER_REAL_CANONICAL_INSERT/); }
        finally { canonical.create = originalCreate; }
        assert.deepEqual(await db.state(), before);
        assert.equal(await canonical.countDocuments({ team: scope.team, company_kod: scope.company_kod }), 0);
    });
    await t.test('settlement rollback releases History: waiting canonical writer retries and commits without settlement audit or sequence increment', async () => {
        const { db, run, writer, callbacks } = await setup();
        const before = await db.state(), barrier = db.pauseNextReferenceClaim();
        db.failAt('AUDIT');
        const settlement = assert.rejects(run(), { outcome: 'BLOCKED', reason: 'FINAL_AUDIT_FAILED' });
        let pending, onFailure;
        const failed = new Promise(resolve => { onFailure = event => { if (event.failure?.code === 112) resolve(); }; });
        client.on('commandFailed', onFailure);
        try { await bounded(barrier.reached); pending = writer(); await bounded(failed); }
        finally { barrier.resume(); client.off('commandFailed', onFailure); }
        await settlement; assert.equal((await pending).idempotent, false); assert.ok(callbacks() >= 2);
        const after = await db.state(); assert.deepEqual(after.employee, before.employee);
        assert.equal(after.audits.length, 0); assert.deepEqual(after.references, before.references);
        assert.deepEqual(after.history.map(withoutFence), before.history.map(withoutFence));
        assert.equal(await canonical.countDocuments({ team: db.scope.team, company_kod: db.scope.company_kod }), 1);
    });
    await t.test('settlement uncertain commit: real server reply retries commit with one sequence increment and one final audit', async () => {
        const { db, run } = await setup(7);
        const before = await db.state(); let commitCommands = 0, uncertainReplies = 0;
        const started = event => { if (event.commandName === 'commitTransaction') commitCommands++; };
        const succeeded = event => { if (event.commandName === 'commitTransaction' &&
            event.reply?.writeConcernError?.code === 64) uncertainReplies++; };
        client.on('commandStarted', started); client.on('commandSucceeded', succeeded);
        const admin = mongoose.connection.db.admin();
        try {
            await admin.command({ configureFailPoint: 'failCommand', mode: { times: 1 }, data: {
                failCommands: ['commitTransaction'], appName: 'payroll-gate2-writer-proof',
                writeConcernError: { code: 64, errmsg: 'Gate 2 isolated settlement commit uncertainty' },
                errorLabels: ['UnknownTransactionCommitResult'] } });
            assert.equal((await run()).applied, true);
        } finally {
            await admin.command({ configureFailPoint: 'failCommand', mode: 'off' });
            client.off('commandStarted', started); client.off('commandSucceeded', succeeded);
        }
        assert.equal(uncertainReplies, 1); assert.ok(commitCommands >= 2); assert.equal(db.transactionCallbacks(), 1);
        const after = await db.state(); assert.equal(after.audits.length, 1);
        assert.equal(after.employee.employee_profile_mutation_sequence, (before.employee.employee_profile_mutation_sequence || 0) + 1);
        assert.deepEqual(after.references, before.references);
        assert.deepEqual(before.history.map(original => withoutCanonicalMetadata(
            after.history.find(row => String(row._id) === String(original._id)))), before.history.map(withoutCanonicalMetadata));
        assert.equal((await run()).alreadyApplied, true); assert.deepEqual(await db.state(), after);
    });
    await t.test('canonical uncertain commit: real server write concern error retries commit without repeating callback or fence', async () => {
        const { db, writer, callbacks, input } = await setup();
        const before = await db.state(); let commitCommands = 0, uncertainReplies = 0;
        const started = event => { if (event.commandName === 'commitTransaction') commitCommands++; };
        const succeeded = event => { if (event.commandName === 'commitTransaction' &&
            event.reply?.writeConcernError?.code === 64) uncertainReplies++; };
        client.on('commandStarted', started); client.on('commandSucceeded', succeeded);
        const admin = mongoose.connection.db.admin();
        try {
            await admin.command({ configureFailPoint: 'failCommand', mode: { times: 1 }, data: {
                failCommands: ['commitTransaction'], appName: 'payroll-gate2-writer-proof',
                writeConcernError: { code: 64, errmsg: 'Gate 2 isolated commit acknowledgement uncertainty' },
                errorLabels: ['UnknownTransactionCommitResult'] } });
            assert.equal((await writer()).idempotent, false);
        } finally {
            await admin.command({ configureFailPoint: 'failCommand', mode: 'off' });
            client.off('commandStarted', started); client.off('commandSucceeded', succeeded);
        }
        assert.equal(uncertainReplies, 1); assert.ok(commitCommands >= 2); assert.equal(callbacks(), 1);
        const after = await db.state(); assert.deepEqual(after.employee, before.employee);
        assert.equal(after.audits.length, 0); assert.deepEqual(after.references, before.references);
        const rowId = String(input.completeHistoryRows[0]._id);
        const previous = before.history.find(row => String(row._id) === rowId);
        const current = after.history.find(row => String(row._id) === rowId);
        assert.equal(current.history_reference_fence, (previous.history_reference_fence || 0) + 1);
        assert.equal(await canonical.countDocuments({ team: db.scope.team, company_kod: db.scope.company_kod }), 1);
        assert.equal((await writer()).idempotent, true); assert.deepEqual(await db.state(), after);
    });
});
