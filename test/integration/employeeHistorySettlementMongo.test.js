'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { URI, DISPOSABLE, assertMongoTarget } = require('../fixtures/employeeHistorySettlementMongoTarget');
const uri = process.env.PAYROLL_SETTLEMENT_TEST_MONGO_URI;

test('MongoDB settlement target guard rejects every target except the exact disposable CI address', () => {
    const safe = { uri: URI, ci: 'true', disposable: DISPOSABLE };
    assert.doesNotThrow(() => assertMongoTarget(safe));
    for (const value of [undefined, '', URI + '&directConnection=true',
        URI.replace('127.0.0.1', 'localhost'), URI.replace('27139', '27017'),
        URI.replace('payroll_settlement_test_ci', 'payrollDB'),
        URI.replace('127.0.0.1', '192.0.2.1'), URI.replace('payrollDraftTest', 'other')]) {
        assert.throws(() => assertMongoTarget({ ...safe, uri: value }));
    }
    assert.throws(() => assertMongoTarget({ ...safe, ci: undefined }));
    assert.throws(() => assertMongoTarget({ ...safe, disposable: undefined }));
});

// This is deliberately skipped locally when the existing CI has not provisioned
// its disposable replica set. A skip is NOT evidence of a real transaction.
test('settlement against the existing CI real MongoDB replica set', { skip: !uri, timeout: 90000 }, async t => {
    assertMongoTarget({ uri, ci: process.env.GITHUB_ACTIONS,
        disposable: process.env.PAYROLL_SETTLEMENT_TEST_DISPOSABLE });
    const mongoose = require('mongoose');
    const W = require('../../server/services/ergazomenoi/employeeEmploymentProfileWriter');
    const P = require('../../server/services/ergazomenoi/employeeHistoryAutomaticReconstructionPlannerService');
    const S = require('../../server/services/ergazomenoi/employeeHistoryAutomaticSettlementPreparationContract');
    const A = require('../../server/services/ergazomenoi/employeeHistoryAutomaticReconstructionApplyContract');
    const { isInactiveHistoryRow } = require('../../server/utils/ergazomenoi/employmentHistoryCanonicalStatus');
    const { createMongoSettlementStore } = require('../fixtures/employeeHistorySettlementMongoStore');
    const { SUPPORTED_COLLECTIONS } = require('../../server/services/ergazomenoi/employeeHistoryReferenceDefinitionsService');
    const models = require('../../server/models/ergazomenoi');
    const auditModel = require('../../server/models/employeeHistoryRepairAudit');
    const userModel = require('../../server/models/userModel');
    const { UserPrivilegesModel } = require('../../server/models/privileges');
    t.after(() => mongoose.disconnect());
    await mongoose.connect(uri, { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 10000,
        monitorCommands: true });
    const hello = await mongoose.connection.db.admin().command({ hello: 1 });
    assert.equal(hello.setName, 'payrollDraftTest');
    assert.deepEqual(hello.hosts, ['127.0.0.1:27139']);
    assert.equal(hello.isWritablePrimary, true);
    for (const model of [models.ErgazomenoiModel, models.IstorikoProslhpseonAllagonModel,
        auditModel, userModel, UserPrivilegesModel]) await model.createCollection();
    for (const name of SUPPORTED_COLLECTIONS) {
        if (!await mongoose.connection.db.listCollections({ name }).hasNext())
            await mongoose.connection.db.createCollection(name);
    }
    const commands = [];
    mongoose.connection.getClient().on('commandStarted', event => {
        if (['commitTransaction', 'abortTransaction', 'update', 'insert'].includes(event.commandName))
            commands.push({ name: event.commandName, transaction: event.command.autocommit === false,
                txnNumber: String(event.command.txnNumber), session: String(event.command.lsid?.id) });
    });
    const now = new Date('2026-10-28T12:00:00.000Z');
    async function setup(options) {
        const db = await createMongoSettlementStore(options), input = await db.approvalInput();
        const proposal = P.planEmployeeHistoryAutomaticSettlement(input);
        const fingerprint = proposal.status === 'CLEAN'
            ? S.buildEmployeeHistorySettlementApprovalFingerprint({ ...input, proposal }) : 'x'.repeat(43);
        const args = { syntheticStore: db.handle, scope: db.scope, employeeId: db.employeeId,
            actorUserId: db.actorUserId, approval: { confirmed: true, fingerprint }, now };
        return { db, input, proposal, args,
            run: (overrides = {}) => W.applyEmployeeEmploymentHistorySettlementInSyntheticStore({ ...args, ...overrides }) };
    }
    await t.test('enriched 0006: one active, two protected inactive, unchanged facts/references, one approval audit, CLEAN', async () => {
        const { db, run, args } = await setup(), before = await db.state(), commandStart = commands.length;
        const result = await run(), after = await db.state();
        assert.equal(result.applied, true);
        assert.equal(result.historyStatus, 'CLEAN');
        assert.equal(result.verification.status, 'CLEAN');
        assert.equal(result.verification.canonicalIdempotent, true);
        assert.deepEqual(result.verification.coverageGaps, []);
        assert.equal(after.history.length, 3);
        assert.equal(after.history.filter(isInactiveHistoryRow).length, 2);
        assert.equal((await models.IstorikoProslhpseonAllagonModel.find(db.scope).lean()).length, 1);
        const { employee_profile_mutation_sequence: fence, ...business } = after.employee;
        assert.equal(fence, 1);
        assert.deepEqual(business, before.employee);
        assert.deepEqual(after.references, before.references);
        for (const old of before.history.slice(0, 2)) {
            const current = after.history.find(row => String(row._id) === String(old._id));
            const { employment_history_canonical_status, employment_history_canonical_survivor_id,
                updatedAt, ...payload } = current;
            const { updatedAt: oldRevision, ...oldPayload } = old;
            assert.equal(employment_history_canonical_status, 'REDUNDANT_REFERENCED');
            assert.equal(String(employment_history_canonical_survivor_id), String(before.history[2]._id));
            assert.deepEqual(updatedAt, now);
            assert.deepEqual(payload, oldPayload);
        }
        assert.deepEqual(after.history.find(row => !isInactiveHistoryRow(row)), {
            ...before.history[2], hmeromhnia_isxyos_oron_ergasias_apo: new Date('2026-04-23'),
            hmeromhnia_isxyos_oron_ergasias_eos: new Date('2026-10-15'), updatedAt: now });
        assert.equal(after.audits.length, 1);
        assert.equal(after.audits[0].diagnostics.approvalFingerprint, args.approval.fingerprint);
        assert.deepEqual(after.audits[0].diagnostics.historyBefore, before.history);
        assert.deepEqual(A.ordered(after.audits[0].diagnostics.historyAfter), A.ordered(after.history));
        const transactionCommands = commands.slice(commandStart).filter(command => command.transaction);
        assert.equal(transactionCommands.filter(command => command.name === 'commitTransaction').length, 1);
        assert.equal(new Set(transactionCommands.map(command => command.session + ':' + command.txnNumber)).size, 1);
        assert.deepEqual(await run(), { applied: false, alreadyApplied: true, historyStatus: 'CLEAN' });
        assert.deepEqual(await db.state(), after);
        assert.equal(commands.slice(commandStart).filter(command => command.name === 'commitTransaction').length, 1);
    });
    for (const failure of ['WRITE', 'AUDIT', 'FINAL']) {
        await t.test(`${failure}: real writes abort together, including employee fence, history and approval audit`, async () => {
            const { db, run } = await setup(), before = await db.state(), commandStart = commands.length;
            db.failAt(failure);
            await assert.rejects(run, failure === 'FINAL'
                ? { code: S.PREFIX + 'FINAL_VERIFICATION_FAILED' } : /INJECTED_AFTER_REAL_/);
            assert.deepEqual(await db.state(), before);
            assert.ok(db.events.some(event => event.type === 'history-write'));
            if (failure !== 'WRITE') assert.ok(db.events.some(event => event.type === 'audit-write'));
            assert.equal(new Set(db.events.map(event => event.session)).size, 1);
            assert.ok(commands.slice(commandStart).some(command => command.name === 'abortTransaction'));
            assert.equal(commands.slice(commandStart).some(command => command.name === 'commitTransaction'), false);
        });
    }
    await t.test('overlapping transactions produce a real write conflict, retry and exactly one committed audit', async () => {
        const { db, run } = await setup(), paused = db.pauseNextEmployeeRead();
        const first = run();
        try {
            await paused.reached;
            const winner = await run();
            assert.equal(winner.applied, true);
        } finally { paused.resume(); }
        assert.equal((await first).alreadyApplied, true);
        assert.ok(db.events.some(event => event.type === 'fence-error' && event.code === 112 && event.transient));
        const after = await db.state();
        assert.equal(after.audits.length, 1);
        assert.equal(after.history.length, 3);
        assert.equal(after.employee.employee_profile_mutation_sequence, 1);
    });
    for (const change of ['employee', 'reference', 'approval']) {
        await t.test(`${change}: changed evidence or stale approval rejects without settlement writes`, async () => {
            const { db, run, input } = await setup();
            if (change === 'employee') await db.changeEmployee({ parathrhseis: 'synthetic concurrent edit' });
            if (change === 'reference') await db.addReference(input.completeHistoryRows[0]._id);
            const before = await db.state();
            await assert.rejects(() => run(change === 'approval'
                ? { approval: { confirmed: true, fingerprint: 'x'.repeat(43) } } : {}), { code: S.PREFIX + 'STALE' });
            assert.deepEqual(await db.state(), before);
        });
    }
    for (const change of ['employee', 'reference']) {
        await t.test(`${change}: replay after a later change cannot reuse the old approval or add another audit`, async () => {
            const { db, run, input } = await setup();
            assert.equal((await run()).applied, true);
            if (change === 'employee') await db.changeEmployee({ parathrhseis: 'synthetic later edit' });
            else await db.addReference(input.completeHistoryRows[0]._id);
            const before = await db.state();
            await assert.rejects(run, { code: S.PREFIX + 'STALE' });
            assert.deepEqual(await db.state(), before);
            assert.equal(before.audits.length, 1);
        });
    }
    await t.test('a new fenced reference committed during the settlement snapshot forces rollback and stale retry', async () => {
        const { db, run, input } = await setup(), paused = db.pauseNextEmployeeRead();
        const pending = run();
        // Attach the rejection handler before releasing the other transaction.
        const rejected = assert.rejects(pending, { code: S.PREFIX + 'STALE' });
        let before;
        try { await paused.reached; await db.addReference(input.completeHistoryRows[0]._id); before = await db.state(); }
        finally { paused.resume(); }
        await rejected;
        assert.deepEqual(await db.state(), before);
        assert.ok(db.events.some(event => event.type === 'history-error' && event.code === 112 && event.transient));
        assert.equal(before.audits.length, 0);
    });
    await t.test('original incomplete 0006 still rejects without saving even its technical fence', async () => {
        const { db, run, proposal } = await setup({ enriched: false }), before = await db.state();
        assert.equal(proposal.status, 'REVIEW_REQUIRED');
        await assert.rejects(run, { code: S.PREFIX + 'REVIEW_REQUIRED' });
        assert.deepEqual(await db.state(), before);
    });
    // No failCommand, network proxy or driver replacement is used. Losing a
    // commit acknowledgement cannot be faithfully reproduced by throwing in a
    // callback, which would test abort rather than UnknownTransactionCommitResult.
    await t.test('UnknownTransactionCommitResult: real lost-ack outcome remains unverified',
        { skip: 'Requires faithful network/commit acknowledgement fault injection; memory tests are not MongoDB evidence' }, () => {});
});
