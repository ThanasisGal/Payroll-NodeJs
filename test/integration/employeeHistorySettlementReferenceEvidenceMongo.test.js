'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { URI, DISPOSABLE, JOB, assertMongoTarget, assertMongoConnection } = require('../fixtures/employeeHistorySettlementMongoTarget');
const uri = process.env.PAYROLL_SETTLEMENT_TEST_MONGO_URI;

test('Gate 2: NORMAL all-reference BSON evidence on the isolated replica set', { skip: !uri, timeout: 120000 }, async t => {
    assertMongoTarget({ uri, ci: process.env.GITHUB_ACTIONS,
        disposable: process.env.PAYROLL_SETTLEMENT_TEST_DISPOSABLE, job: process.env.GITHUB_JOB });
    const mongoose = require('mongoose');
    assert.equal(mongoose.connection.readyState, 0);
    await mongoose.connect(uri, { autoIndex: false, autoCreate: false, monitorCommands: true, serverSelectionTimeoutMS: 5000 });
    t.after(() => mongoose.disconnect());
    assertMongoConnection(mongoose.connection);
    const hello = await mongoose.connection.db.admin().command({ hello: 1 });
    assert.equal(hello.setName, 'payrollDraftTest'); assert.deepEqual(hello.hosts, ['127.0.0.1:27139']);
    const models = require('../../server/models/ergazomenoi');
    const audit = require('../../server/models/employeeHistoryRepairAudit');
    for (const model of [models.ErgazomenoiModel, models.IstorikoProslhpseonAllagonModel, audit,
        require('../../server/models/userModel'), require('../../server/models/privileges').UserPrivilegesModel,
        require('../../server/models/companies').CompaniesModel]) await model.createCollection();
    const E = require('../../server/services/ergazomenoi/employeeHistorySettlementReferenceEvidence');
    const S = require('../../server/services/ergazomenoi/employeeHistoryAutomaticSettlementPreparationContract');
    const A = require('../../server/services/ergazomenoi/employeeHistoryAutomaticReconstructionApplyContract');
    const U = require('../../server/services/ergazomenoi/employeeHistoryCoordinatedSettlementContract');
    const P = require('../../server/services/ergazomenoi/employeeHistorySettlementProtocol');
    const W = require('../../server/services/ergazomenoi/employeeEmploymentProfileWriter');
    const { createMongoSettlementStore } = require('../fixtures/employeeHistorySettlementMongoStore');
    const { acceptanceBWithInitialGap } = require('../fixtures/employeeHistoryCoordinatedSettlementFixture');
    const frozen = mongoose.connection.collection('Apasxoliseis_Period_Frozen_Snapshots');
    const writes = [];
    const conflicts = [];
    mongoose.connection.getClient().on('commandStarted', event => {
        if (['insert', 'update', 'delete', 'commitTransaction'].includes(event.commandName)) writes.push(event.commandName);
    });
    mongoose.connection.getClient().on('commandFailed', event => {
        if (event.failure?.code === 112) conflicts.push(event.commandName);
    });
    async function setup(initialSequence) {
        const db = await createMongoSettlementStore({ fixture: acceptanceBWithInitialGap(), enriched: false,
            executionMode: 'NORMAL', settlementReferenceEvidence: true, referenceCopies: 8 });
        if (initialSequence !== undefined) await db.changeEmployee({ employee_profile_mutation_sequence: initialSequence });
        const input = await db.approvalInput();
        assert.equal(input.completeHistoryRows.length, 3);
        for (const row of input.completeHistoryRows) assert.equal(input.protectedReferenceSummary[String(row._id)].length, 8);
        const fingerprint = data => S.buildEmployeeHistorySettlementApprovalFingerprint({ ...data,
            proposal: U.buildCoordinatedSettlementProposal(data) });
        const approved = fingerprint(input);
        const run = (fingerprintValue = approved) => W.applyEmployeeEmploymentHistorySettlementInSyntheticStore({
            syntheticStore: db.handle, scope: db.scope, employeeId: db.employeeId, actorUserId: db.actorUserId,
            coordinated: true, approval: { confirmed: true, fingerprint: fingerprintValue } });
        return { db, input, approved, run, fingerprint };
    }
    const rejectsStale = error => error.code === S.PREFIX + 'STALE';
    function preserved(before, after) {
        assert.deepEqual(after.references, before.references);
        for (const original of before.history) {
            const actual = after.history.find(row => String(row._id) === String(original._id));
            const { employment_history_canonical_status, employment_history_canonical_survivor_id, updatedAt, ...payload } = actual;
            const { updatedAt: oldUpdatedAt, ...oldPayload } = original;
            assert.deepEqual(payload, oldPayload);
        }
    }
    async function preview(db) {
        const controller = require('../../server/controllers/ergazomenoi/employeeHistorySettlementHttpController')
            .createEmployeeHistorySettlementHttpController({ contextProvider: () => db.handle });
        const res = { set() { return this; }, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
        await controller.preview({ method: 'GET', params: { id: db.employeeId }, sessionID: 'synthetic-reference-evidence-session',
            session: { userId: db.actorUserId, userTeam: db.scope.team, companyInUse: db.scope.company_kod } }, res);
        assert.equal(res.body.success, true, JSON.stringify(res.body));
        return res.body;
    }
    await t.test('24 frozen documents: repeated read-only HTTP previews match Apply and record one new exact approval', async () => {
        const { db, approved, run } = await setup(), before = await db.state(), start = writes.length;
        for (let i = 0; i < 5; i++) assert.equal((await preview(db)).approvalFingerprint, approved);
        assert.equal(writes.length, start, 'Preview must issue no write command');
        assert.deepEqual(await db.state(), before);
        assert.equal((await run()).applied, true);
        const after = await db.state(); preserved(before, after);
        assert.equal(after.audits.length, 1);
        assert.equal(after.audits[0].diagnostics.approvalFingerprint, approved);
        assert.equal(after.audits[0].diagnostics.protectedReferences.referenceEvidenceContract, E.VERSION);
        assert.equal((await run()).alreadyApplied, true); assert.deepEqual(await db.state(), after);
    });
    await t.test('real NORMAL startup handle and HTTP routes use the same v2 evidence and exact approval', async () => {
        const { db, approved } = await setup();
        const express = require('express'), { once } = require('node:events');
        const N = require('../../server/services/ergazomenoi/employeeHistorySettlementNormalActivation');
        const controller = require('../../server/controllers/ergazomenoi/employeeHistorySettlementHttpController')
            .createEmployeeHistorySettlementHttpController();
        const app = express(); app.use(express.json());
        app.use((req, res, next) => { req.session = { userId: db.actorUserId,
            userTeam: db.scope.team, companyInUse: db.scope.company_kod };
            req.sessionID = 'synthetic-reference-evidence-http-session'; next(); });
        app.get('/api/ergazomenoi/:id/history-reconstruction-preview', controller.preview);
        require('../../server/routes/employeeHistorySettlementRoutes').registerEmployeeHistorySettlementRoutes(app, {
            controller: { apply: controller.apply, resolve: controller.preview },
            checkAuth: require('../../server/middlewares/checkValidUser'), requireUserPrivilegeAction: () => (req, res, next) => next() });
        const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
        try {
            assert.equal(N.initializeEmployeeHistorySettlementNormal({ server }), true, 'Run with the startup flag enabled only in this guarded test process');
            const prefix = `http://127.0.0.1:${server.address().port}/api/ergazomenoi/${db.employeeId}`;
            const start = writes.length;
            let browserApprovalContext;
            for (let i = 0; i < 3; i++) {
                const response = await fetch(prefix + '/history-reconstruction-preview');
                const body = await response.json(); assert.equal(response.status, 200, JSON.stringify(body));
                assert.equal(body.approvalFingerprint, approved); assert.equal(body.executionMode, 'NORMAL');
                assert.equal(typeof body.browserApprovalContext, 'string');
                browserApprovalContext = body.browserApprovalContext;
            }
            assert.equal(writes.length, start);
            const requestId = require('node:crypto').randomUUID();
            const apply = () => fetch(prefix + '/history-automatic-settlement-apply', { method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Employee-Settlement-Context': browserApprovalContext,
                    'X-Employee-Settlement-Attempt': requestId },
                body: JSON.stringify({ approval: { confirmed: true, fingerprint: approved } }) });
            const first = await apply(); assert.equal(first.status, 200, JSON.stringify(await first.clone().json()));
            const after = await db.state();
            const execution = after.audits[0].diagnostics.normalExecution;
            assert.equal(execution.requestId, requestId);
            assert.equal(execution.browserApprovalContext, browserApprovalContext);
            const owner = await audit.findOne({ 'employeeScope.employee_id': db.employeeId, mutationSource: P.ATTEMPT }).lean();
            assert.equal(execution.claimId, owner.diagnostics.claimId);
            const second = await apply(); assert.equal(second.status, 200, JSON.stringify(await second.clone().json()));
            assert.equal((await second.json()).alreadyApplied, true); assert.deepEqual(await db.state(), after);
        } finally { await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }); }
    });
    for (const change of ['employee', 'history', 'representative', 'nonrepresentative-add', 'nonrepresentative-remove', 'nonrepresentative-modify', 'BSON-number-type']) {
        await t.test('reject changed ' + change + ' before any settlement write', async () => {
            const { db, input, run } = await setup(), state = await db.state();
            const document = state.references[change === 'representative' ? 0 : 7];
            if (change === 'employee') await db.changeEmployee({ parathrhseis: 'changed synthetic employee' });
            else if (change === 'history') await models.IstorikoProslhpseonAllagonModel.collection.updateOne({ _id: input.completeHistoryRows[0]._id }, { $set: { parathrhseis: 'changed synthetic history' } });
            else if (change === 'nonrepresentative-add') await frozen.insertOne({ ...document, ...db.nextFrozenReferenceIdentity(), _id: new mongoose.Types.ObjectId() });
            else if (change === 'nonrepresentative-remove') await frozen.deleteOne({ _id: document._id });
            else await frozen.updateOne({ _id: document._id }, { $set: { 'frozen_snapshot.hours': change === 'BSON-number-type'
                ? new mongoose.mongo.Double(8) : 9 } });
            const changed = await db.state(), start = writes.length;
            await assert.rejects(run, rejectsStale);
            assert.equal(writes.length, start); assert.deepEqual(await db.state(), changed);
        });
    }
    for (const change of ['add-with-writer-fence', 'remove', 'modify']) {
        await t.test('concurrent nonrepresentative ' + change + ': real conflict, retry and rejection', async () => {
            const { db, input, run } = await setup(), state = await db.state(), barrier = db.pauseNextEmployeeRead();
            const conflictStart = conflicts.length;
            const pending = assert.rejects(run(), rejectsStale);
            try {
                await barrier.reached;
                if (change === 'add-with-writer-fence') await db.addReference(input.completeHistoryRows[0]._id);
                else if (change === 'remove') await frozen.deleteOne({ _id: state.references[7]._id });
                else await frozen.updateOne({ _id: state.references[7]._id }, { $set: { 'frozen_snapshot.amount': 999 } });
            } finally { barrier.resume(); }
            await pending;
            const after = await db.state();
            assert.deepEqual(after.history.map(({ history_reference_fence, ...row }) => row), state.history.map(({ history_reference_fence, ...row }) => row));
            assert.deepEqual(after.employee, state.employee); assert.equal(after.audits.length, 0);
            assert.ok(conflicts.length > conflictStart, 'MongoDB must actually reject a conflicting write before the driver retries');
        });
    }
    for (const [collectionName, shape] of [
        ['Prodhlomena_Oraria_Deviations', id => ({ effective_profile_istoriko_id: id })],
        ['Oraria_Apologistika', id => ({ effective_profile_istoriko_id: id })],
        ['Apasxoliseis_Period_Frozen_Snapshots', id => ({ frozen_snapshot: { daily_results: [{ effective_profile_istoriko_id: id }] } })],
        ['Apasxoliseis_Weekly_Canonical_Decisions', id => ({ canonical_snapshot: { profile_history: [{ _id: id }] } })],
        ['Apasxoliseis_Weekly_Repo_Transfer_Decisions', id => ({ canonical_snapshot: { employment_profile: { profile_istoriko_id: id } } })]
    ]) await t.test('every protected collection claims its matching document: ' + collectionName, async () => {
        const { db, input, run, fingerprint } = await setup();
        const collection = mongoose.connection.collection(collectionName);
        const document = { _id: new mongoose.Types.ObjectId(), ...db.scope,
            ...(collectionName === 'Apasxoliseis_Period_Frozen_Snapshots' ? db.nextFrozenReferenceIdentity() : {}),
            ...shape(input.completeHistoryRows[0]._id), historicalAmount: new mongoose.mongo.Double(123.45) };
        await collection.insertOne(document);
        const approved = fingerprint(await db.approvalInput()), barrier = db.pauseNextEmployeeRead(), start = conflicts.length;
        const pending = assert.rejects(run(approved), rejectsStale);
        try { await barrier.reached; await collection.deleteOne({ _id: document._id }); }
        finally { barrier.resume(); }
        await pending;
        assert.ok(conflicts.length > start); assert.equal((await db.state()).audits.length, 0);
    });
    await t.test('legacy unrecorded approval fails closed; legacy uncertain attempt cannot be renamed by v2 evidence', async () => {
        const { db, input, run } = await setup();
        const oldInput = { ...input, protectedReferenceSummary: await require('../../server/services/ergazomenoi/employeeHistoryLegacyFenceService')
            .legacyFenceReferenceSummary(mongoose.connection, input.completeHistoryRows) };
        const oldFingerprint = S.buildEmployeeHistorySettlementApprovalFingerprint({ ...oldInput, proposal: U.buildCoordinatedSettlementProposal(oldInput) });
        assert.notEqual(oldFingerprint, S.buildEmployeeHistorySettlementApprovalFingerprint({ ...input, proposal: U.buildCoordinatedSettlementProposal(input) }));
        await assert.rejects(() => run(oldFingerprint), rejectsStale);
        const identity = { scope: db.scope, employeeId: db.employeeId, actorUserId: db.actorUserId, fingerprint: oldFingerprint };
        const old = P.record(input, P.rootId(identity), P.ATTEMPT, { ...identity, claimId: 'legacy-uncertain' });
        await audit.create([old]);
        const before = await audit.findById(old._id).lean();
        await assert.rejects(run, { reason: 'PRIOR_APPROVAL_REQUIRES_RECONCILIATION' });
        assert.deepEqual(await audit.findById(old._id).lean(), before);
        assert.equal((await db.state()).audits.length, 0);
    });
    await t.test('new uncertain attempt remains owned and cannot apply twice', async () => {
        const { db, run } = await setup(); db.failAt('AUDIT');
        await assert.rejects(run);
        const before = await db.state();
        await assert.rejects(run, error => error.outcome === 'BLOCKED');
        assert.deepEqual(await db.state(), before);
    });
    await t.test('new fingerprint after changed references cannot bypass an uncertain v2 attempt', async () => {
        const { db, run, fingerprint } = await setup(); db.failAt('AUDIT'); await assert.rejects(run);
        const state = await db.state();
        await frozen.updateOne({ _id: state.references[7]._id }, { $set: { 'frozen_snapshot.hours': 12 } });
        const newlyCalculated = fingerprint(await db.approvalInput());
        await assert.rejects(() => run(newlyCalculated), { reason: 'PRIOR_APPROVAL_REQUIRES_RECONCILIATION' });
        assert.deepEqual((await db.state()).history, state.history);
    });
    await t.test('a versioned FENCED attempt keeps its successor ownership instead of admitting a new root', async () => {
        const { db, input, approved, run, fingerprint } = await setup(); db.failAt('AUDIT'); await assert.rejects(run);
        const state = await db.state();
        await frozen.updateOne({ _id: state.references[7]._id }, { $set: { 'frozen_snapshot.hours': 12 } });
        const fresh = await db.approvalInput(), newFingerprint = fingerprint(fresh);
        const grant = await P.fenceAndGrant({ ...db.protocolDependencies, auditModel: audit,
            original: { scope: db.scope, employeeId: db.employeeId, actorUserId: db.actorUserId, fingerprint: approved },
            generation: 0, confirmed: true, approval: { confirmed: true, fingerprint: newFingerprint },
            revalidate: async session => ({ ...fresh, fingerprint: S.assertApprovedSettlement({ ...fresh,
                proposal: U.buildCoordinatedSettlementProposal(fresh), approval: { confirmed: true, fingerprint: newFingerprint } }) }) });
        assert.equal(grant.outcome, 'GRANTED');
        await assert.rejects(() => run(newFingerprint), { reason: 'PRIOR_APPROVAL_REQUIRES_RECONCILIATION' });
        db.failAt(null);
        const recovered = await W.applyEmployeeEmploymentHistorySettlementInSyntheticStore({
            syntheticStore: db.issueRecoveryHandle(grant.protocol), scope: db.scope, employeeId: db.employeeId,
            actorUserId: db.actorUserId, coordinated: true, approval: { confirmed: true, fingerprint: newFingerprint } });
        assert.equal(recovered.applied, true);
        assert.equal(String((await db.state()).audits[0]._id), grant.protocol.finalAuditId);
    });
    await t.test('completed legacy sequence fence requires a fresh independent v2 approval', async () => {
        const { db, input, approved, run, fingerprint } = await setup(2);
        const legacyService = require('../../server/services/ergazomenoi/employeeHistoryLegacyFenceService');
        const oldInput = { ...input, protectedReferenceSummary: await legacyService.legacyFenceReferenceSummary(mongoose.connection, input.completeHistoryRows) };
        const oldFingerprint = fingerprint(oldInput);
        const identity = { scope: db.scope, employeeId: db.employeeId, actorUserId: db.actorUserId, fingerprint: oldFingerprint };
        await audit.create([P.record(input, P.rootId(identity), P.ATTEMPT, { ...identity, claimId: 'legacy' })]);
        await require('../fixtures/employeeHistoryLegacyFenceAdmin').fenceLegacyApproval({ connection: mongoose.connection,
            context: { deps: { ...db.protocolDependencies, auditModel: audit } }, ...identity, legacyAttemptId: P.rootId(identity) });
        const fresh = await db.approvalInput(), newFingerprint = fingerprint(fresh);
        assert.equal(fresh.currentEmployee.employee_profile_mutation_sequence, 3);
        assert.notEqual(newFingerprint, approved); assert.notEqual(newFingerprint, oldFingerprint);
        await assert.rejects(() => run(approved), rejectsStale);
        assert.equal((await run(newFingerprint)).applied, true);
        assert.equal((await run(newFingerprint)).alreadyApplied, true);
    });
});
