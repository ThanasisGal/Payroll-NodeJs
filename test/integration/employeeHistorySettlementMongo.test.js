'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { URI, DISPOSABLE, JOB, assertMongoTarget } = require('../fixtures/employeeHistorySettlementMongoTarget');
const uri = process.env.PAYROLL_SETTLEMENT_TEST_MONGO_URI;

test('MongoDB settlement target guard rejects every target except the exact disposable CI address', () => {
    const safe = { uri: URI, ci: 'true', disposable: DISPOSABLE, job: JOB };
    assert.doesNotThrow(() => assertMongoTarget(safe));
    for (const value of [undefined, '', URI + '&directConnection=true',
        URI.replace('127.0.0.1', 'localhost'), URI.replace('27139', '27017'),
        URI.replace('payroll_settlement_test_ci', 'payrollDB'),
        URI.replace('127.0.0.1', '192.0.2.1'), URI.replace('payrollDraftTest', 'other')]) {
        assert.throws(() => assertMongoTarget({ ...safe, uri: value }));
    }
    assert.throws(() => assertMongoTarget({ ...safe, ci: undefined }));
    assert.throws(() => assertMongoTarget({ ...safe, disposable: undefined }));
    assert.throws(() => assertMongoTarget({ ...safe, job: undefined }));
    assert.throws(() => assertMongoTarget({ ...safe, job: 'employee-mongodb' }));
});

// This is deliberately skipped locally when the existing CI has not provisioned
// its disposable replica set. A skip is NOT evidence of a real transaction.
test('settlement against the existing CI real MongoDB replica set', { skip: !uri, timeout: 90000 }, async t => {
    assertMongoTarget({ uri, ci: process.env.GITHUB_ACTIONS,
        disposable: process.env.PAYROLL_SETTLEMENT_TEST_DISPOSABLE, job: process.env.GITHUB_JOB });
    const mongoose = require('mongoose');
    const W = require('../../server/services/ergazomenoi/employeeEmploymentProfileWriter');
    const P = require('../../server/services/ergazomenoi/employeeHistoryAutomaticReconstructionPlannerService');
    const S = require('../../server/services/ergazomenoi/employeeHistoryAutomaticSettlementPreparationContract');
    const A = require('../../server/services/ergazomenoi/employeeHistoryAutomaticReconstructionApplyContract');
    const Split = require('../../server/services/ergazomenoi/employeeHistoryPeriodSplitPreviewService');
    const { isInactiveHistoryRow } = require('../../server/utils/ergazomenoi/employmentHistoryCanonicalStatus');
    const { createMongoSettlementStore } = require('../fixtures/employeeHistorySettlementMongoStore');
    const { SUPPORTED_COLLECTIONS } = require('../../server/services/ergazomenoi/employeeHistoryReferenceDefinitionsService');
    const models = require('../../server/models/ergazomenoi');
    const auditModel = require('../../server/models/employeeHistoryRepairAudit');
    const userModel = require('../../server/models/userModel');
    const { UserPrivilegesModel } = require('../../server/models/privileges');
    assert.equal(mongoose.connection.readyState, 0, 'Never reuse an application connection');
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
    async function setup(options, businessDecision) {
        const db = await createMongoSettlementStore(options), input = await db.approvalInput();
        const proposal = Split.buildEmployeeHistoryPeriodSplitProposal(input, businessDecision) ||
            P.planEmployeeHistoryAutomaticSettlement({ ...input, ...(businessDecision ? { businessDecision } : {}) });
        const fingerprint = proposal.status === 'CLEAN'
            ? S.buildEmployeeHistorySettlementApprovalFingerprint({ ...input, proposal,
                ...(businessDecision ? { businessDecision } : {}) }) : 'x'.repeat(43);
        const args = { syntheticStore: db.handle, scope: db.scope, employeeId: db.employeeId,
            actorUserId: db.actorUserId, approval: { confirmed: true, fingerprint }, now,
            ...(businessDecision ? { businessDecision } : {}) };
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

    const { periodSplitFixture } = require('../fixtures/employeeHistoryPeriodSplitFixture');
    const { settlementDecisionFixture } = require('../fixtures/employeeHistorySettlementDecisionFixture');
    for (const manual of [false, true]) await t.test(`${manual ? 'confirmed' : 'documented'} annual split uses real inserts and the existing transaction; replay preserves identities`, async () => {
        const businessDecision = manual ? { choiceId: 'SPLIT_AT_2026_07_01' } : undefined;
        const { db, run, args } = await setup({ fixture: periodSplitFixture({ yearly: true, priorCycle: true, automatic: !manual }) }, businessDecision);
        const before = await db.state(), start = commands.length;
        const result = await run(), after = await db.state();
        assert.equal(result.historyStatus, 'CLEAN');
        assert.equal(result.verification.status, 'CLEAN');
        assert.deepEqual(after.references, before.references);
        const originalIds = new Set(before.history.map(row => String(row._id)));
        const inserted = after.history.filter(row => !originalIds.has(String(row._id)));
        assert.equal(inserted.length, 2);
        assert.deepEqual(inserted.map(row => [row.hmeromhnia_isxyos_oron_ergasias_apo.toISOString().slice(0, 10),
            row.hmeromhnia_isxyos_oron_ergasias_eos.toISOString().slice(0, 10), row.ores_ergasias_ebdomadas]),
        [['2026-01-01', '2026-06-30', 14], ['2026-07-01', '2026-12-31', 30]]);
        for (const original of before.history) {
            const stored = after.history.find(row => String(row._id) === String(original._id));
            const { employment_history_canonical_status, employment_history_canonical_survivor_id, updatedAt, ...payload } = stored;
            const { updatedAt: previousRevision, ...originalPayload } = original;
            assert.deepEqual(payload, originalPayload, 'protected historical facts remain unchanged');
        }
        assert.equal(after.audits.length, 1);
        assert.equal(after.audits[0].diagnostics.approvalFingerprint, args.approval.fingerprint);
        assert.equal(after.audits[0].diagnostics.settlementKind, 'PERIOD_SPLIT');
        assert.deepEqual(A.ordered(after.audits[0].diagnostics.historyAfter), A.ordered(after.history));
        assert.equal(commands.slice(start).filter(command => command.name === 'commitTransaction').length, 1);
        assert.equal((await run()).alreadyApplied, true);
        assert.deepEqual(await db.state(), after);
        assert.equal(commands.slice(start).filter(command => command.name === 'commitTransaction').length, 1);
    });
    await t.test('recorded whole-period business choice is recomputed inside the real transaction', async () => {
        const { db, run } = await setup({ fixture: settlementDecisionFixture() }, { choiceId: 'KEEP_FOUR_DAY_PROFILE' });
        const before = await db.state();
        assert.equal((await run()).historyStatus, 'CLEAN');
        const after = await db.state();
        assert.deepEqual(after.references, before.references);
        assert.equal(after.audits[0].diagnostics.businessDecision.choiceId, 'KEEP_FOUR_DAY_PROFILE');
        assert.equal((await run()).alreadyApplied, true);
        assert.deepEqual(await db.state(), after);
    });
    for (const fault of ['INSERT', 'AUDIT', 'FINAL']) await t.test(`split ${fault}: inserted periods, protected-row markers and approval audit roll back together`, async () => {
        const { db, run } = await setup({ fixture: periodSplitFixture({ yearly: true }) });
        const before = await db.state(), start = commands.length;
        db.failAt(fault);
        await assert.rejects(run);
        assert.deepEqual(await db.state(), before);
        assert.ok(db.events.some(event => event.type === 'history-insert'));
        assert.ok(commands.slice(start).some(command => command.name === 'abortTransaction'));
        assert.equal(commands.slice(start).some(command => command.name === 'commitTransaction'), false);
    });
    for (const revoked of ['role', 'permission', 'active']) await t.test(`real transaction revalidates ${revoked} before execution and replay`, async () => {
        for (const committed of [false, true]) {
            const { db, run } = await setup();
            if (committed) await run();
            if (revoked === 'role') await db.changeActor({ privileges: 'U' });
            if (revoked === 'permission') await db.changePermission(false);
            if (revoked === 'active') await db.changeActor({ situation: 'I' });
            const before = await db.state();
            await assert.rejects(run, { code: 'EMPLOYEE_HISTORY_MANAGEMENT_FORBIDDEN' });
            assert.deepEqual(await db.state(), before);
        }
    });
    for (const changed of ['employee', 'reference', 'approval']) await t.test(`split stale ${changed} approval cannot insert periods`, async () => {
        const { db, input, run } = await setup({ fixture: periodSplitFixture({ yearly: true }) });
        if (changed === 'employee') await db.changeEmployee({ parathrhseis: 'synthetic later edit' });
        if (changed === 'reference') await db.addReference(input.completeHistoryRows[0]._id);
        const before = await db.state();
        await assert.rejects(() => run(changed === 'approval'
            ? { approval: { confirmed: true, fingerprint: 'x'.repeat(43) } } : {}), { code: S.PREFIX + 'STALE' });
        assert.deepEqual(await db.state(), before);
    });
    for (const split of [false, true]) await t.test(`application acknowledgement lost after real commit, split=${split}: UNKNOWN then exact replay without duplicates`, async () => {
        const { db, run } = await setup(split ? { fixture: periodSplitFixture({ yearly: true }) } : {});
        db.failAt('COMMIT_ACK_LOST');
        await assert.rejects(run, { code: A.PREFIX + 'COMMIT_UNCERTAIN', commitStatus: 'UNKNOWN', retryWithSameApproval: true });
        const committed = await db.state();
        assert.equal(committed.audits.length, 1);
        assert.equal((await run()).alreadyApplied, true);
        assert.deepEqual(await db.state(), committed);
    });
    // The same guarded disposable CI replica set also exercises the unified
    // adapter. This does not relax the local/production target restrictions.
    const U = require('../../server/services/ergazomenoi/employeeHistoryCoordinatedSettlementContract');
    const { acceptanceB, acceptanceBWithInitialGap, typedFixture } = require('../fixtures/employeeHistoryCoordinatedSettlementFixture');
    const F = require('../../server/services/ergazomenoi/fixtures/unifiedEmployeeHistorySettlementFixtures');
    async function setupCoordinated(fixture) {
        const db = await createMongoSettlementStore({ fixture, enriched: false });
        const input = await db.approvalInput(), proposal = U.buildCoordinatedSettlementProposal(input);
        const fingerprint = S.buildEmployeeHistorySettlementApprovalFingerprint({ ...input, proposal });
        return { db, input, run: (overrides = {}) => W.applyEmployeeEmploymentHistorySettlementInSyntheticStore({
            syntheticStore: db.handle, scope: db.scope, employeeId: db.employeeId, actorUserId: db.actorUserId,
            approval: { confirmed: true, fingerprint }, coordinated: true, now, ...overrides }) };
    }
    await t.test('coordinated A: CLEAN/noOp issues zero MongoDB update, insert or commit commands', async () => {
        const { db, run } = await setupCoordinated(typedFixture(F.families.find(f => f.number === 23).make()));
        const before = await db.state(), start = commands.length;
        assert.deepEqual(await run(), { applied: false, alreadyApplied: false, historyStatus: 'CLEAN' });
        assert.deepEqual(await db.state(), before);
        assert.equal(commands.slice(start).some(command => ['update','insert','commitTransaction'].includes(command.name)), false);
    });
    await t.test('coordinated B: exact periods, one retirement, no inserts, one real transaction and stable replay', async () => {
        const { db, run } = await setupCoordinated(acceptanceB()), before = await db.state(), start = commands.length;
        const result = await run(), after = await db.state();
        assert.equal(result.historyStatus, 'CLEAN'); assert.equal(result.applied, true);
        assert.deepEqual(after.references, before.references); assert.equal(after.history.length, before.history.length);
        assert.equal(after.history.filter(isInactiveHistoryRow).length, 1);
        const day = value => value.toISOString().slice(0,10);
        assert.deepEqual(after.history.filter(row => !isInactiveHistoryRow(row)).sort((a,b) =>
            a.hmeromhnia_isxyos_oron_ergasias_apo - b.hmeromhnia_isxyos_oron_ergasias_apo).map(row =>
            [day(row.hmeromhnia_isxyos_oron_ergasias_apo),day(row.hmeromhnia_isxyos_oron_ergasias_eos)]),
            [['2025-12-01','2026-03-31'],['2026-04-01','2026-07-31'],['2026-09-16','2027-07-30']]);
        assert.equal(after.audits.length, 1);
        const writes = commands.slice(start).filter(command => command.transaction);
        assert.equal(writes.filter(command => command.name === 'commitTransaction').length, 1);
        assert.equal(new Set(writes.map(command => command.session + ':' + command.txnNumber)).size, 1);
        assert.equal((await run()).alreadyApplied, true); assert.deepEqual(await db.state(), after);
        const input = await db.approvalInput(), second = U.buildCoordinatedSettlementProposal(input);
        assert.equal(second.status, 'CLEAN'); assert.equal(second.noOp, true);
    });
    function assertProtectedOriginals(before, after) {
        assert.deepEqual(after.references, before.references, 'Every frozen result and provenance identity is immutable');
        for (const original of before.history) {
            const stored = after.history.find(row => String(row._id) === String(original._id));
            assert.ok(stored, 'Original physical identity survives');
            if (isInactiveHistoryRow(stored) && !isInactiveHistoryRow(original)) {
                const { employment_history_canonical_status: status, employment_history_canonical_survivor_id: survivor,
                    updatedAt, ...payload } = stored;
                const { updatedAt: oldRevision, ...originalPayload } = original;
                assert.deepEqual(payload, originalPayload);
                assert.equal(status, 'REDUNDANT_REFERENCED');
                assert.ok(after.history.some(row => !isInactiveHistoryRow(row) && String(row._id) === String(survivor)));
            } else assert.deepEqual(stored, original);
        }
    }
    await t.test('coordinated B with initial gap: insert foundation, retain two actual cycles and finalized references', async () => {
        const { db, run } = await setupCoordinated(acceptanceBWithInitialGap());
        const before = await db.state(), start = commands.length, result = await run(), after = await db.state();
        assert.equal(result.applied, true); assert.equal(result.historyStatus, 'CLEAN');
        assertProtectedOriginals(before, after);
        const oldIds = new Set(before.history.map(row => String(row._id)));
        const inserted = after.history.filter(row => !oldIds.has(String(row._id)));
        assert.equal(inserted.length, 1); assert.equal(after.history.filter(isInactiveHistoryRow).length, 1);
        assert.equal(inserted[0].hmeromhnia_isxyos_oron_ergasias_apo.toISOString().slice(0,10), '2025-12-01');
        assert.equal(inserted[0].hmeromhnia_isxyos_oron_ergasias_eos.toISOString().slice(0,10), '2026-03-31');
        const { buildEmploymentCycles } = require('../../server/services/ergazomenoi/employeeEmploymentCycleResolverService');
        const cycles = buildEmploymentCycles({ currentEmployee: after.employee, history: after.history });
        assert.equal(cycles.length, 2); assert.equal(cycles[0].departure_date, '2026-07-31');
        assert.equal(cycles[1].hire_date, '2026-09-16'); assert.equal(after.audits.length, 1);
        assert.equal(commands.slice(start).filter(command => command.name === 'commitTransaction').length, 1);
        assert.equal((await run()).alreadyApplied, true); assert.deepEqual(await db.state(), after);
        const second = U.buildCoordinatedSettlementProposal(await db.approvalInput());
        assert.equal(second.status, 'CLEAN'); assert.equal(second.noOp, true);
    });
    await t.test('coordinated simultaneous approvals: actual write conflict retries and commits exactly once', async () => {
        const { db, run } = await setupCoordinated(acceptanceBWithInitialGap());
        const before = await db.state(), paused = db.pauseNextEmployeeRead();
        const first = run().then(result => ({ result }), error => ({ error }));
        try { await paused.reached; assert.equal((await run()).applied, true); }
        finally { paused.resume(); }
        const firstOutcome = await first;
        if (firstOutcome.error) throw firstOutcome.error;
        assert.equal(firstOutcome.result.alreadyApplied, true);
        assert.ok(db.events.some(event => event.type === 'fence-error' && event.code === 112 && event.transient));
        const after = await db.state(); assertProtectedOriginals(before, after);
        assert.equal(after.audits.length, 1); assert.equal(after.history.length, before.history.length + 1);
        assert.equal(after.employee.employee_profile_mutation_sequence, 1);
    });
    for (const changed of ['employee','reference']) await t.test(`coordinated concurrent ${changed} edit conflicts then rejects stale approval`, async () => {
        const { db, run, input } = await setupCoordinated(acceptanceBWithInitialGap());
        const paused = db.pauseNextEmployeeRead(), pending = run();
        // Attach the rejection assertion immediately so a fast conflict is never unhandled.
        const rejected = assert.rejects(pending, { code: S.PREFIX + 'STALE' });
        let afterChange;
        try {
            await paused.reached;
            if (changed === 'employee') await db.changeEmployee({ parathrhseis: 'synthetic concurrent change' });
            else await db.addReference(input.completeHistoryRows[0]._id);
            afterChange = await db.state();
        } finally { paused.resume(); }
        await rejected; assert.deepEqual(await db.state(), afterChange);
        const conflictSource = changed === 'reference' ? 'history-error' : 'fence-error';
        assert.ok(db.events.some(event => event.type === conflictSource && event.code === 112 && event.transient));
    });
    await t.test('coordinated stale approval fingerprint cannot issue any write command', async () => {
        const { db, run } = await setupCoordinated(acceptanceBWithInitialGap());
        const before = await db.state(), start = commands.length;
        await assert.rejects(() => run({ approval: { confirmed: true, fingerprint: 'x'.repeat(43) } }), { code: S.PREFIX + 'STALE' });
        assert.deepEqual(await db.state(), before);
        assert.equal(commands.slice(start).some(command => ['update','insert','commitTransaction'].includes(command.name)), false);
    });
    for (const failure of ['INSERT','AUDIT','FINAL']) await t.test(`coordinated ${failure}: actual MongoDB rollback includes new periods and protected originals`, async () => {
        const { db, run } = await setupCoordinated(acceptanceB({ overlap: true }));
        const before = await db.state(), start = commands.length; db.failAt(failure);
        await assert.rejects(run); assert.deepEqual(await db.state(), before);
        assert.ok(db.events.some(event => event.type === 'history-insert'));
        assert.ok(commands.slice(start).some(command => command.name === 'abortTransaction'));
        assert.equal(commands.slice(start).some(command => command.name === 'commitTransaction'), false);
    });
    for (const change of ['employee','reference']) await t.test(`coordinated MongoDB stale ${change}: no write commands`, async () => {
        const { db, run, input } = await setupCoordinated(acceptanceB());
        if (change === 'employee') await db.changeEmployee({ parathrhseis: 'synthetic later edit' });
        else await db.addReference(input.completeHistoryRows[0]._id);
        const before = await db.state(), start = commands.length;
        await assert.rejects(run, { code: S.PREFIX + 'STALE' }); assert.deepEqual(await db.state(), before);
        assert.equal(commands.slice(start).some(command => ['update','insert','commitTransaction'].includes(command.name)), false);
    });
    await t.test('coordinated acknowledgement lost after actual commit: same approval discovers one audit', async () => {
        const { db, run } = await setupCoordinated(acceptanceBWithInitialGap()); const before = await db.state(); db.failAt('COMMIT_ACK_LOST');
        await assert.rejects(run, { code: A.PREFIX + 'COMMIT_UNCERTAIN', commitStatus: 'UNKNOWN' });
        const after = await db.state(); assert.equal(after.audits.length, 1);
        assertProtectedOriginals(before, after); assert.equal(after.history.length, before.history.length + 1);
        assert.equal((await run()).alreadyApplied, true); assert.deepEqual(await db.state(), after);
    });
    // No failCommand, network proxy or driver replacement is used. Losing a
    // commit acknowledgement cannot be faithfully reproduced by throwing in a
    // callback, which would test abort rather than UnknownTransactionCommitResult.
    await t.test('UnknownTransactionCommitResult: real lost-ack outcome remains unverified',
        { skip: 'Requires faithful network/commit acknowledgement fault injection; memory tests are not MongoDB evidence' }, () => {});
});
