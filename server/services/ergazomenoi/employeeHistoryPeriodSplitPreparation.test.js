'use strict';
const { test, before, after, mock } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { prepareEmployeeEmploymentHistorySettlement: prepare } = require('./employeeEmploymentProfileWriter');
const { buildEmployeeHistoryPeriodSplitProposal: split } = require('./employeeHistoryPeriodSplitPreviewService');
const { verifyEmployeeHistoryAutomaticSettlement: verify } = require('./employeeHistoryAutomaticReconstructionPlannerService');
const S = require('./employeeHistoryAutomaticSettlementPreparationContract');
const A = require('./employeeHistoryAutomaticReconstructionApplyContract');
const { periodSplitFixture } = require('../../../test/fixtures/employeeHistoryPeriodSplitFixture');
const { forbidRealSettlementMongo } = require('../../../test/fixtures/forbidRealSettlementMongo');
const { startSettlementHarness } = require('../../../test/fixtures/employeeHistorySettlementHttpHarness');
const actorUserId = '700000000000000000000001';
before(() => forbidRealSettlementMongo(mock));
after(() => mock.restoreAll());
function input({ manual = false, priorCycle = false } = {}) {
    const fixture = periodSplitFixture({ yearly: true, automatic: !manual, priorCycle });
    if (priorCycle) fixture.completeHistoryRows[0].aa_eggrafhs = '0000';
    const options = { scope: fixture.scope, currentEmployee: fixture.currentEmployee,
        completeHistoryRows: fixture.completeHistoryRows, protectedReferenceSummary: fixture.protectedReferenceSummary,
        employeeId: String(fixture.currentEmployee._id), actorUserId, now: new Date('2026-10-29T10:00:00Z'),
        ...(manual ? { businessDecision: { choiceId: 'SPLIT_AT_2026_07_01' } } : {}) };
    options.proposal = split(options, options.businessDecision);
    options.approval = { confirmed: true, fingerprint: S.buildEmployeeHistorySettlementApprovalFingerprint(options) };
    return options;
}
for (const manual of [false, true]) test(`approved ${manual ? 'business choice' : 'documented change'} prepares exact inserts through the shared identity/number allocator`, () => {
    const options = input({ manual }), before = A.stringify(options), result = prepare(options);
    assert.equal(result.kind, 'PERIOD_SPLIT');
    assert.equal(result.mode, 'PREPARATION_ONLY');
    assert.equal(result.executionEnabled, false);
    assert.equal(result.authorizationVerified, false);
    assert.equal(result.requiresTransactionalRevalidation, true);
    assert.equal(result.requiresWriterContractExtension, false);
    assert.equal(result.syntheticExecutionOnly, true);
    const { physicalPlan } = result;
    assert.deepEqual(physicalPlan.rowsToDelete, []);
    assert.equal(physicalPlan.rowsToInsert.length, 2);
    assert.equal(physicalPlan.rowsToUpdate.length, 2);
    assert.deepEqual(physicalPlan.rowsToInsert.map(row => row.aa_eggrafhs), ['0006', '0007']);
    assert.equal(new Set(physicalPlan.finalRows.map(row => String(row._id))).size, physicalPlan.finalRows.length);
    const periods = physicalPlan.rowsToInsert.map(row => ({ aa: row.aa_eggrafhs,
        from: row.hmeromhnia_isxyos_oron_ergasias_apo.toISOString().slice(0, 10),
        to: row.hmeromhnia_isxyos_oron_ergasias_eos.toISOString().slice(0, 10), hours: row.ores_ergasias_ebdomadas }));
    assert.deepEqual(periods, [ { aa: '0006', from: '2026-01-01', to: '2026-06-30', hours: 14 },
        { aa: '0007', from: '2026-07-01', to: '2026-12-31', hours: 30 } ]);
    for (const row of physicalPlan.rowsToInsert) {
        assert.ok(row._id instanceof mongoose.Types.ObjectId);
        assert.deepEqual(row.createdAt, options.now);
        assert.deepEqual(row.updatedAt, options.now);
        assert.equal(row.team, options.scope.team);
        assert.equal(row.company_kod, options.scope.company_kod);
        assert.equal(row.hmeromhnia_proslhpshs.toISOString().slice(0, 10), '2025-12-30');
    }
    for (const original of options.completeHistoryRows) {
        const row = physicalPlan.finalRows.find(row => String(row._id) === String(original._id));
        assert.equal(row.aa_eggrafhs, original.aa_eggrafhs);
        const { employment_history_canonical_status, employment_history_canonical_survivor_id, updatedAt, ...payload } = row;
        const { updatedAt: oldTime, ...originalPayload } = original;
        assert.deepEqual(payload, originalPayload);
        if (employment_history_canonical_survivor_id) assert.ok(physicalPlan.rowsToInsert.some(row =>
            String(row._id) === String(employment_history_canonical_survivor_id)));
    }
    assert.equal(verify({ ...options, proposedRows: physicalPlan.finalRows, requiredHistoryRows: options.completeHistoryRows }).status, 'CLEAN');
    assert.equal(A.stringify(options), before);
    assert.equal(mongoose.connection.readyState, 0);
});
test('previous finalized cycle and all references remain intact during preparation', () => {
    const options = input({ priorCycle: true }), before = A.stringify(options);
    const prepared = prepare(options);
    assert.deepEqual(prepared.physicalPlan.finalRows.find(row => String(row._id) === '600000000000000000000099'), options.completeHistoryRows[0]);
    assert.equal(verify({ ...options, proposedRows: prepared.physicalPlan.finalRows }).cycles.length, 2);
    assert.equal(A.stringify(options), before);
});
for (const changed of ['approval', 'employee', 'reference', 'history', 'proposal']) test(`stale or altered ${changed} cannot prepare any insert`, () => {
    const options = input();
    if (changed === 'approval') options.approval.fingerprint = 'x'.repeat(43);
    if (changed === 'employee') options.currentEmployee.parathrhseis = 'μεταγενέστερη συνθετική αλλαγή';
    if (changed === 'reference') options.protectedReferenceSummary[String(options.completeHistoryRows[0]._id)].push({
        collection: 'Apasxoliseis_Period_Frozen_Snapshots', documentId: 'synthetic-new-reference' });
    if (changed === 'history') options.completeHistoryRows[0].updatedAt = new Date('2026-10-29T11:00:00Z');
    if (changed === 'proposal') options.proposal.proposedRows.at(-1).energos = true;
    const before = A.stringify(options);
    assert.throws(() => prepare(options), error => error.code?.startsWith(S.PREFIX));
    assert.equal(A.stringify(options), before);
});
for (const kind of ['number', 'terms', 'hire', 'revision', 'versionKey', 'protectedPayload', 'survivor', 'extraInsert', 'missingOld']) {
    test(`physical ${kind} tampering is rejected even when the caller supplies matching expectedRows`, () => {
        const options = input(), prepared = prepare(options), physicalPlan = S.clone(prepared.physicalPlan);
        const inserted = physicalPlan.rowsToInsert[0], old = physicalPlan.rowsToUpdate[0];
        const target = physicalPlan.finalRows.find(row => String(row._id) === String(inserted._id));
        if (kind === 'number') { inserted.aa_eggrafhs = '0001'; target.aa_eggrafhs = '0001'; }
        if (kind === 'terms') { inserted.ores_ergasias_ebdomadas = 40; target.ores_ergasias_ebdomadas = 40; }
        if (kind === 'hire') { inserted.hmeromhnia_proslhpshs = new Date('2020-01-01'); target.hmeromhnia_proslhpshs = new Date('2020-01-01'); }
        if (kind === 'revision') { inserted.createdAt = new Date('2020-01-01'); target.createdAt = new Date('2020-01-01'); }
        if (kind === 'versionKey') { inserted.__v = 9; target.__v = 9; }
        if (kind === 'protectedPayload') physicalPlan.finalRows.find(row => String(row._id) === old.historyId).aa_eggrafhs = '9999';
        if (kind === 'survivor') physicalPlan.finalRows.find(row => String(row._id) === old.historyId).employment_history_canonical_survivor_id = new mongoose.Types.ObjectId();
        if (kind === 'extraInsert') { physicalPlan.rowsToInsert.push(S.clone(inserted)); physicalPlan.finalRows.push(S.clone(inserted)); }
        if (kind === 'missingOld') physicalPlan.finalRows = physicalPlan.finalRows.filter(row => String(row._id) !== old.historyId);
        assert.throws(() => S.assertSettlementPhysicalPlan({ proposal: options.proposal,
            completeHistoryRows: options.completeHistoryRows, protectedReferenceSummary: options.protectedReferenceSummary,
            physicalPlan, expectedRows: physicalPlan.finalRows, now: options.now, splitOptions: options }),
        error => error.code?.startsWith(S.PREFIX));
    });
}
test('repeated detached preparation keeps the approval and numbering, without reserving IDs or writing anything', () => {
    const options = input(), before = A.stringify(options), first = prepare(options), second = prepare(options);
    assert.equal(first.approvalFingerprint, second.approvalFingerprint);
    assert.deepEqual(first.physicalPlan.rowsToInsert.map(row => row.aa_eggrafhs), second.physicalPlan.rowsToInsert.map(row => row.aa_eggrafhs));
    const firstIds = new Set(first.physicalPlan.rowsToInsert.map(row => String(row._id)));
    assert.ok(second.physicalPlan.rowsToInsert.every(row => !firstIds.has(String(row._id))));
    assert.equal(A.stringify(options), before);
});
test('existing duplicate sequence numbers are rejected instead of renumbering protected rows', () => {
    const options = input();
    options.completeHistoryRows[0].aa_eggrafhs = options.completeHistoryRows[1].aa_eggrafhs;
    options.proposal = split(options);
    options.approval.fingerprint = S.buildEmployeeHistorySettlementApprovalFingerprint(options);
    const before = A.stringify(options);
    assert.throws(() => prepare(options), { code: S.PREFIX + 'HISTORY_SEQUENCE_INVALID' });
    assert.equal(A.stringify(options), before);
});
test('the approved preparation executes once and repeats without another insertion or audit', async () => {
    const h = await startSettlementHarness({ fixture: periodSplitFixture({ yearly: true }) });
    try {
        const data = h.db.approvalInput(actorUserId);
        data.proposal = split(data);
        const approval = { confirmed: true, fingerprint: S.buildEmployeeHistorySettlementApprovalFingerprint(data) };
        assert.equal((await h.apply({ approval })).status, 200);
        const committed = h.db.state();
        assert.equal((await (await h.apply({ approval })).json()).alreadyApplied, true);
        assert.deepEqual(h.db.state(), committed);
        assert.equal(committed.audits.length, 1);
        assert.equal(h.db.events.filter(event => event.type === 'commit').length, 1);
    } finally { await h.close(); }
});
