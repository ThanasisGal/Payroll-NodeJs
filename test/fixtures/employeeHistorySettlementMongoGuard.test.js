'use strict';
const { test, before, after, mock } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const mongoose = require('mongoose');
const createDocuments = mongoose.Model.create;
const { URI, DISPOSABLE, JOB, assertMongoTarget } = require('./employeeHistorySettlementMongoTarget');
const { createMongoSettlementStore, mongoSettlementContext } = require('./employeeHistorySettlementMongoStore');
const { createEmployeeHistoryAutomaticSettlementController: createController } = require('../../server/controllers/ergazomenoi/employeeHistoryAutomaticSettlementController');
const { applyEmployeeEmploymentHistorySettlementInSyntheticStore: apply } = require('../../server/services/ergazomenoi/employeeEmploymentProfileWriter');
let attempts = 0;
before(() => {
    const forbidden = () => { attempts++; assert.fail('No connection or real collection operation is permitted in guard tests'); };
    for (const method of ['connect', 'createConnection', 'startSession']) mock.method(mongoose, method, forbidden);
    for (const method of ['openUri', 'startSession', 'transaction']) mock.method(mongoose.connection, method, forbidden);
    for (const method of ['find', 'findOne', 'findById', 'create', 'insertMany', 'updateOne', 'updateMany', 'bulkWrite'])
        mock.method(mongoose.Model, method, forbidden);
});
after(() => { assert.equal(attempts, 0, 'All refusals must happen before database access'); mock.restoreAll(); });

test('only the exact disposable address, provisioning marker and dedicated CI job are accepted', () => {
    const safe = { uri: URI, ci: 'true', disposable: DISPOSABLE, job: JOB };
    assert.doesNotThrow(() => assertMongoTarget(safe));
    for (const change of [{ job: undefined }, { job: 'employee-mongodb' }, { ci: 'false' }, { disposable: undefined },
        { uri: URI.replace('payroll_settlement_test_ci', 'payrollDB') }, { uri: URI.replace('27139', '27017') },
        { uri: URI.replace('127.0.0.1', 'localhost') }, { uri: URI + '&directConnection=true' },
        { uri: URI.replace('mongodb://', 'mongodb://user:password@') }]) {
        assert.throws(() => assertMongoTarget({ ...safe, ...change }));
    }
});
test('the MongoDB adapter refuses an unconnected process before loading repositories or seeding documents', async () => {
    assert.equal(mongoose.connection.readyState, 0);
    await assert.rejects(() => createMongoSettlementStore());
    assert.equal(attempts, 0);
});
test('shared enriched 0006 evidence passes the actual definitive-save validator before any database access', () => {
    const { createSettlementInputFixture } = require('./employeeHistorySettlementInputFixture');
    const { inspectEmployeeHistorySave } = require('../../server/services/ergazomenoi/employeeHistorySaveValidationService');
    const P = require('../../server/services/ergazomenoi/employeeHistoryAutomaticReconstructionPlannerService');
    const input = createSettlementInputFixture();
    input.protectedReferenceSummary = Object.fromEntries(input.completeHistoryRows.map((row, index) =>
        [String(row._id), index < 2 ? [{ collection: 'Apasxoliseis_Period_Frozen_Snapshots', documentId: 'synthetic-' + index }] : []]));
    for (const row of [input.currentEmployee, ...input.completeHistoryRows]) {
        assert.equal(row.symbash, '01'); assert.equal(row.kathgoria_symbashs, '01');
        assert.equal(row.eidikothta_symbashs, '01');
        assert.equal(row.nomimosMisthos, 1200); assert.equal(row.pragmatikosMisthos, 1300);
    }
    const proposal = P.planEmployeeHistoryAutomaticSettlement(input);
    assert.equal(proposal.status, 'CLEAN');
    const inspected = inspectEmployeeHistorySave({ scope: input.scope, currentEmployee: input.currentEmployee,
        historyRows: proposal.proposedRows });
    assert.equal(inspected.status, 'CLEAN', JSON.stringify(inspected.issues));
    const survivor = proposal.proposedRows.find(row => row.aa_eggrafhs === '0003');
    assert.deepEqual([survivor.hmeromhnia_isxyos_oron_ergasias_apo, survivor.hmeromhnia_isxyos_oron_ergasias_eos],
        [new Date('2026-04-23'), new Date('2026-10-15')]);
    // Every mandatory fact is still enforced independently by production code.
    for (const field of ['symbash', 'kathgoria_symbashs', 'eidikothta_symbashs', 'nomimosMisthos', 'pragmatikosMisthos']) {
        const rows = require('../../server/services/ergazomenoi/employeeHistoryAutomaticSettlementPreparationContract').clone(proposal.proposedRows);
        delete rows.find(row => row.aa_eggrafhs === '0003')[field];
        const rejected = inspectEmployeeHistorySave({ scope: input.scope, currentEmployee: input.currentEmployee, historyRows: rows });
        assert.equal(rejected.status, 'LEGACY_REVIEW_REQUIRED');
        assert.ok(rejected.issues.some(issue => issue.field === field && issue.reason === 'REQUIRED_PROFILE_FIELD'), field);
    }
    assert.equal(mongoose.connection.readyState, 0); assert.equal(attempts, 0);
});
test('enriched:false keeps the original incomplete typed evidence exactly unchanged and still rejects', async () => {
    const { createSettlementInputFixture } = require('./employeeHistorySettlementInputFixture');
    const raw = require('../../server/services/ergazomenoi/fixtures/automaticEmployeeHistoryReconstructionFixtures').real0006BoundaryStructure();
    assert.deepEqual(createSettlementInputFixture({ enriched: false }), raw);
    assert.equal(raw.currentEmployee.dialleima_se_lepta, 30);
    assert.equal(raw.currentEmployee.evelikth_proselefsh, 120);
    assert.ok(raw.completeHistoryRows.every(row => !Object.hasOwn(row, 'symbash')));
    const { createSyntheticSettlementStore } = require('./employeeHistorySettlementSyntheticStore');
    const actorUserId = '700000000000000000000001';
    const db = createSyntheticSettlementStore({ enriched: false,
        actor: { _id: actorUserId, privileges: 'A', team: 'THA', situation: 'A' }, permission: { update: true } });
    const before = db.state(), input = db.approvalInput(actorUserId);
    assert.deepEqual(input.currentEmployee, raw.currentEmployee); assert.deepEqual(input.completeHistoryRows, raw.completeHistoryRows);
    assert.equal(require('../../server/services/ergazomenoi/employeeHistoryAutomaticReconstructionPlannerService')
        .planEmployeeHistoryAutomaticSettlement(input).status, 'REVIEW_REQUIRED');
    await assert.rejects(() => apply({ syntheticStore: db.handle, scope: input.scope, employeeId: input.employeeId,
        actorUserId, approval: { confirmed: true, fingerprint: 'x'.repeat(43) } }),
    { code: 'EMPLOYEE_HISTORY_SETTLEMENT_PREPARATION_REVIEW_REQUIRED' });
    assert.deepEqual(db.state(), before); assert.equal(attempts, 0);
});
test('caller-supplied historical fixtures never acquire the positive 0006 contract facts', () => {
    const S = require('../../server/services/ergazomenoi/employeeHistoryAutomaticSettlementPreparationContract');
    const { createSettlementInputFixture } = require('./employeeHistorySettlementInputFixture');
    const fixture = require('./employeeHistoryCoordinatedSettlementFixture').acceptanceB();
    const before = S.clone(fixture), input = createSettlementInputFixture({ fixture });
    assert.deepEqual(input.currentEmployee, before.currentEmployee);
    for (let i = 0; i < input.completeHistoryRows.length; i++) {
        const { evelikth_proselefsh, symbatikes_ores_ergasias, ...row } = input.completeHistoryRows[i];
        const { evelikth_proselefsh: ignoredFlexible, symbatikes_ores_ergasias: ignoredHours, ...original } = before.completeHistoryRows[i];
        assert.deepEqual(row, original);
    }
    assert.deepEqual(input.completeHistoryRows.map(row => row.pragmatikosMisthos), [1100, 1300, 1300, 1450]);
    assert.deepEqual(fixture, before);
});
test('unissued handles and real connection objects never become test capabilities', async () => {
    for (const handle of [undefined, {}, mongoose.connection, { disposableMongo: true }, { readHttpSnapshot() {} }]) {
        assert.throws(() => mongoSettlementContext(handle), { code: 'EMPLOYEE_HISTORY_SETTLEMENT_PREPARATION_SYNTHETIC_STORE_REQUIRED' });
        await assert.rejects(() => apply({ syntheticStore: handle, businessDecision: { choiceId: 'KEEP_FOUR_DAY_PROFILE' } }),
            { code: 'EMPLOYEE_HISTORY_SETTLEMENT_PREPARATION_SYNTHETIC_STORE_REQUIRED' });
        if (handle !== undefined) assert.throws(() => createController({ syntheticStore: handle }));
    }
});
test('ordinary apply remains 423 regardless of HTTP, session, role or browser activation claims', () => {
    const controller = createController();
    for (const req of [{}, { session: { privileges: 'A', syntheticStore: {} }, headers: { 'x-execution-mode': 'SYNTHETIC_ONLY' },
        query: { executionEnabled: 'true' }, body: { executionMode: 'SYNTHETIC_ONLY', syntheticStore: {}, confirmed: true } }]) {
        const res = { set() { return this; }, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
        controller.apply(req, res);
        assert.equal(res.code, 423);
        assert.equal(res.body.executionEnabled, false);
        assert.equal(res.body.success, false);
    }
    assert.equal(attempts, 0);
});
test('the HTTP constructor keeps its memory-only guard while the CI adapter uses the existing transaction engine', () => {
    const controller = fs.readFileSync(__dirname + '/../../server/controllers/ergazomenoi/employeeHistoryAutomaticSettlementController.js', 'utf8');
    const adapter = fs.readFileSync(__dirname + '/employeeHistorySettlementMongoStore.js', 'utf8');
    assert.match(controller, /memorySettlementContext\(options\.syntheticStore\)/);
    assert.doesNotMatch(controller, /mongoSettlementContext|createMongoSettlementStore|process\.env/);
    assert.match(adapter, /const withTransaction = session\.withTransaction\.bind\(session\)/);
    assert.match(adapter, /session\.withTransaction = async \(work, \.\.\.transactionOptions\) => \{[\s\S]*await withTransaction\(async \(\.\.\.args\) => \{\s*transactionCallbacks\+\+;\s*return work\(\.\.\.args\);\s*\}, \.\.\.transactionOptions\)/);
    assert.doesNotMatch(adapter, /commitTransaction\(|abortTransaction\(|\.connect\(/);
});

test('split physical inserts exactly match actual Mongoose create serialization without connecting to MongoDB', async () => {
    const { IstorikoProslhpseonAllagonModel: History } = require('../../server/models/ergazomenoi');
    const W = require('../../server/services/ergazomenoi/employeeEmploymentProfileWriter');
    const S = require('../../server/services/ergazomenoi/employeeHistoryAutomaticSettlementPreparationContract');
    const { buildEmployeeHistoryPeriodSplitProposal: split } = require('../../server/services/ergazomenoi/employeeHistoryPeriodSplitPreviewService');
    const { createSyntheticSettlementStore } = require('./employeeHistorySettlementSyntheticStore');
    const fixture = require('./employeeHistoryPeriodSplitFixture').periodSplitFixture({ yearly: true });
    const input = createSyntheticSettlementStore({ fixture }).approvalInput('700000000000000000000001');
    const proposal = split(input);
    const approval = { confirmed: true, fingerprint: S.buildEmployeeHistorySettlementApprovalFingerprint({ ...input, proposal }) };
    const prepared = W.prepareEmployeeEmploymentHistorySettlement({ ...input, proposal, approval, now: new Date('2026-10-28') });
    const serialized = [];
    const insertion = mock.method(History.collection, 'insertOne', async document => {
        serialized.push(S.clone(document));
        return { acknowledged: true, insertedId: document._id };
    });
    try {
        for (const row of prepared.physicalPlan.rowsToInsert) await createDocuments.call(History, [row]);
        assert.deepEqual(serialized, prepared.physicalPlan.rowsToInsert);
        assert.ok(serialized.every(row => row.__v === 0));
        assert.equal(mongoose.connection.readyState, 0);
        assert.equal(attempts, 0);
    } finally { insertion.mock.restore(); }
});

test('coordinated insert serialization retains the approved documents without manufacturing missing amounts', async () => {
    const { IstorikoProslhpseonAllagonModel: History } = require('../../server/models/ergazomenoi');
    const W = require('../../server/services/ergazomenoi/employeeEmploymentProfileWriter');
    const U = require('../../server/services/ergazomenoi/employeeHistoryCoordinatedSettlementContract');
    const S = require('../../server/services/ergazomenoi/employeeHistoryAutomaticSettlementPreparationContract');
    const { acceptanceBWithInitialGap } = require('./employeeHistoryCoordinatedSettlementFixture');
    const { createSyntheticSettlementStore } = require('./employeeHistorySettlementSyntheticStore');
    const input = createSyntheticSettlementStore({ fixture: acceptanceBWithInitialGap(), enriched: false })
        .approvalInput('700000000000000000000001');
    const proposal = U.buildCoordinatedSettlementProposal(input);
    const approval = { confirmed: true, fingerprint: S.buildEmployeeHistorySettlementApprovalFingerprint({ ...input, proposal }) };
    const prepared = W.prepareEmployeeEmploymentHistorySettlement({ ...input, proposal, approval, now: new Date('2026-10-31') });
    assert.equal(prepared.physicalPlan.rowsToInsert.length, 1);
    const serialized = [];
    const insertion = mock.method(History.collection, 'insertOne', async document => {
        serialized.push(S.clone(document)); return { acknowledged: true, insertedId: document._id };
    });
    try {
        for (const row of prepared.physicalPlan.rowsToInsert) await createDocuments.call(History, [U.coordinatedHistoryDocument(row)]);
        assert.deepEqual(serialized, prepared.physicalPlan.rowsToInsert);
        for (const row of serialized) for (const field of ['nomimoOromisthio','pragmatikoOromisthio','poso_symbashs_15'])
            assert.equal(Object.hasOwn(row, field), false);
        assert.equal(mongoose.connection.readyState, 0); assert.equal(attempts, 0);
    } finally { insertion.mock.restore(); }
});

test('coordinated audit matches actual Mongoose serialization including omission of an empty current patch', async () => {
    const W = require('../../server/services/ergazomenoi/employeeEmploymentProfileWriter');
    const U = require('../../server/services/ergazomenoi/employeeHistoryCoordinatedSettlementContract');
    const S = require('../../server/services/ergazomenoi/employeeHistoryAutomaticSettlementPreparationContract');
    const Audit = require('../../server/models/employeeHistoryRepairAudit');
    const { acceptanceBWithInitialGap } = require('./employeeHistoryCoordinatedSettlementFixture');
    const { createSyntheticSettlementStore } = require('./employeeHistorySettlementSyntheticStore');
    const actor = { _id: '700000000000000000000001', privileges: 'A', team: 'THA', situation: 'A' };
    const db = createSyntheticSettlementStore({ fixture: acceptanceBWithInitialGap(), enriched: false, actor, permission: { update: true } });
    const input = db.approvalInput(actor._id), proposal = U.buildCoordinatedSettlementProposal(input);
    const approval = { confirmed: true, fingerprint: S.buildEmployeeHistorySettlementApprovalFingerprint({ ...input, proposal }) };
    await W.applyEmployeeEmploymentHistorySettlementInSyntheticStore({ syntheticStore: db.handle,
        scope: input.scope, employeeId: input.employeeId, actorUserId: actor._id, approval, coordinated: true });
    const record = db.state().audits[0], serialized = [];
    const insertion = mock.method(Audit.collection, 'insertOne', async document => {
        serialized.push(S.clone(document)); return { acknowledged: true, insertedId: document._id };
    });
    try {
        await createDocuments.call(Audit, [record]);
        assert.deepEqual(serialized[0].diagnostics, record.diagnostics);
        assert.equal(Object.hasOwn(serialized[0].diagnostics, 'approvedCurrentPatch'), false);
        assert.equal(mongoose.connection.readyState, 0); assert.equal(attempts, 0);
    } finally { insertion.mock.restore(); }
});
