'use strict';

const { test, before, after, mock } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { prepareEmployeeEmploymentHistorySettlement: prepare } = require('./employeeEmploymentProfileWriter');
const S = require('./employeeHistoryAutomaticSettlementPreparationContract');
const A = require('./employeeHistoryAutomaticReconstructionApplyContract');
const { planEmployeeHistoryAutomaticSettlement: settle } = require('./employeeHistoryAutomaticReconstructionPlannerService');
const F = require('./fixtures/automaticEmployeeHistoryReconstructionFixtures');

// These tests must fail, not silently use an in-memory substitute, if any
// production connection, transaction, query or model write is attempted.
before(() => {
    const forbidden = () => assert.fail('MongoDB access is forbidden during preparation');
    for (const method of ['connect', 'createConnection', 'startSession']) mock.method(mongoose, method, forbidden);
    for (const method of ['openUri', 'startSession', 'transaction']) mock.method(mongoose.connection, method, forbidden);
    mock.method(mongoose.Model.prototype, 'save', forbidden);
    for (const method of ['find', 'findOne', 'findById', 'aggregate', 'create',
        'updateOne', 'updateMany', 'deleteOne', 'deleteMany', 'insertMany', 'bulkWrite']) {
        mock.method(mongoose.Model, method, forbidden);
    }
});
after(() => mock.restoreAll());

const now = new Date('2026-10-28T12:00:00.000Z');
function input(protectedCount = 2) {
    const data = F.real0006BoundaryStructure();
    // Explicit synthetic historical facts, not inferred defaults. The original
    // sparse factory is unchanged and now has separate fail-closed coverage.
    for (const row of data.completeHistoryRows) {
        Object.assign(row, { evelikth_proselefsh: 0, symbatikes_ores_ergasias: 40 });
    }
    const protectedReferenceSummary = Object.fromEntries(data.completeHistoryRows.map((row, index) => [String(row._id),
        index < protectedCount ? [{ collection: 'Apasxoliseis_Period_Frozen_Snapshots',
            documentId: `synthetic-${index}`, historyId: String(row._id),
            frozen_snapshot: { finalized: true, amount: 123.45 } }] : []]));
    const options = { ...data, protectedReferenceSummary, actorUserId: '700000000000000000000001',
        employeeId: String(data.currentEmployee._id), now };
    options.proposal = settle(options);
    assert.equal(options.proposal.status, 'CLEAN');
    return options;
}
function approve(options) {
    return { ...options, approval: { confirmed: true,
        fingerprint: S.buildEmployeeHistorySettlementApprovalFingerprint(options) } };
}
function rejected(action) {
    assert.throws(action, error => error.code?.startsWith(S.PREFIX));
}

test('0006 with recorded numeric evidence: exact three updates, protected payloads, BSON identities and no writes', () => {
    const options = approve(input());
    const original = A.stringify(options);
    const result = prepare(options);
    assert.equal(result.mode, 'PREPARATION_ONLY');
    assert.equal(result.executionEnabled, false);
    assert.equal(result.authorizationVerified, false);
    assert.equal(result.requiresTransactionalRevalidation, true);
    assert.equal(result.actorUserId, options.actorUserId);
    assert.equal(result.employeeId, options.employeeId);
    assert.deepEqual(result.scope, options.scope);
    assert.deepEqual(result.currentPatch, {});
    const plan = result.physicalPlan;
    assert.equal(plan.rowsToUpdate.length, 3);
    assert.deepEqual(plan.rowsToInsert, []);
    assert.deepEqual(plan.rowsToDelete, []);
    assert.equal(plan.finalRows.length, 3);
    for (const row of options.completeHistoryRows.slice(0, 2)) {
        const update = plan.rowsToUpdate.find(item => item.historyId === String(row._id));
        assert.deepEqual(Object.keys(update.patch).sort(), ['employment_history_canonical_status',
            'employment_history_canonical_survivor_id', 'updatedAt']);
        const target = plan.finalRows.find(item => String(item._id) === String(row._id));
        assert.ok(target._id instanceof mongoose.Types.ObjectId);
        assert.ok(target.employment_history_canonical_survivor_id instanceof mongoose.Types.ObjectId);
        assert.equal(String(target.employment_history_canonical_survivor_id), '600000000000000000000003');
        const { employment_history_canonical_status, employment_history_canonical_survivor_id, updatedAt, ...payload } = target;
        const { updatedAt: previous, ...beforePayload } = row;
        assert.equal(employment_history_canonical_status, 'REDUNDANT_REFERENCED');
        assert.deepEqual(payload, beforePayload);
        assert.deepEqual(updatedAt, now);
    }
    const survivorUpdate = plan.rowsToUpdate.find(item => item.historyId.endsWith('003'));
    assert.deepEqual(survivorUpdate.patch, {
        hmeromhnia_isxyos_oron_ergasias_apo: new Date('2026-04-23'),
        hmeromhnia_isxyos_oron_ergasias_eos: new Date('2026-10-15'),
        updatedAt: now
    });
    assert.equal(result.physicalPlanFingerprint, A.hash(plan));
    assert.throws(() => A.buildAutomaticReconstructionPhysicalPlan({ plan: result,
        completeHistoryRows: options.completeHistoryRows }), { code: A.PREFIX + 'BOUNDARY_FAILED' });
    assert.equal(A.stringify(options), original);
    // Prepared documents are detached from the reviewed snapshot.
    plan.finalRows[0].hmeres_ergasias_ebdomadas = 1;
    assert.equal(A.stringify(options), original);
    assert.equal(mongoose.connection.readyState, 0);
});

test('missing, refused, wrong and malformed approvals fail closed', () => {
    const options = input();
    rejected(() => prepare(options));
    for (const approval of [null, {}, { confirmed: false, fingerprint: 'x'.repeat(43) },
        { confirmed: true, fingerprint: 'x'.repeat(43) },
        { ...approve(options).approval, extra: true }]) rejected(() => prepare({ ...options, approval }));
});

test('modified proposal, assumptions, retirement instructions and verification cannot be approved', () => {
    const original = approve(input());
    const changes = [
        p => { p.assumptions[0].businessRationale += ' altered'; },
        p => { p.redundantRows[0].disposition = 'EXCLUDE_FROM_ACTIVE_HISTORY'; },
        p => { p.redundantRows[0].originalRow.ores_ergasias_ebdomadas = 10; },
        p => { p.proposedRows[0].hmeres_ergasias_ebdomadas = 6; },
        p => { p.verification.canonicalIdempotent = false; },
        p => { p.fieldChanges = []; },
        p => { p.status = 'REVIEW_REQUIRED'; }
    ];
    for (const change of changes) {
        const options = S.clone(original);
        change(options.proposal);
        rejected(() => prepare(options));
        rejected(() => S.buildEmployeeHistorySettlementApprovalFingerprint(options));
    }
});

test('approval binds actor, entire initial state, reference fences and frozen evidence', () => {
    const original = approve(input());
    for (const change of [
        o => { o.actorUserId = '700000000000000000000002'; },
        o => { o.currentEmployee.unrelated_snapshot_field = true; },
        o => { o.completeHistoryRows[0].history_reference_fence++; },
        o => { o.protectedReferenceSummary[String(o.completeHistoryRows[0]._id)][0].frozen_snapshot.amount++; },
        o => { o.completeHistoryRows[0].hmeromhnia_allaghs_orarioy_apo = new Date('2032-01-01'); }
    ]) {
        const changed = S.clone(original);
        change(changed);
        // Even a fresh valid proposal cannot reuse the previous approval.
        changed.proposal = settle(changed);
        assert.equal(changed.proposal.status, 'CLEAN');
        assert.notEqual(S.buildEmployeeHistorySettlementApprovalFingerprint(changed), original.approval.fingerprint);
        rejected(() => prepare(changed));
    }
});

test('full actor, employee and company identity is mandatory without admin fallback', () => {
    const original = approve(input());
    for (const actorUserId of [undefined, null, '', ' ', true, {}, 'not-an-identity']) {
        rejected(() => prepare({ ...original, actorUserId }));
    }
    for (const change of [
        o => { delete o.employeeId; },
        o => { o.employeeId = '600000000000000000000007'; },
        o => { delete o.scope.company_kod; },
        o => { o.scope.team = 'OTHER'; },
        o => { o.currentEmployee.company_kod = 'OTHER'; },
        o => { o.accessMode = 'ADMIN_FULL'; }
    ]) {
        const changed = S.clone(original);
        change(changed);
        rejected(() => prepare(changed));
    }
});

test('unexpected inserts, deletions, protected changes and extra current patches are rejected', () => {
    const original = approve(input());
    for (const change of [
        p => { p.proposedRows.push({ ...p.proposedRows[0], _id: new mongoose.Types.ObjectId() }); },
        p => { p.proposedRows.pop(); },
        p => { p.proposedRows[1].ores_ergasias_ebdomadas = 1; },
        p => { p.proposedRows[1].employment_history_canonical_survivor_id = '600000000000000000000002'; }
    ]) {
        const changed = S.clone(original);
        change(changed.proposal);
        rejected(() => prepare(changed));
    }
    rejected(() => prepare({ ...original, currentPatch: { energos: false } }));
    rejected(() => prepare({ ...original, connection: mongoose.connection }));
});

test('physical boundary independently rejects injected changes, inserts, deletes and renumbering', () => {
    const options = approve(input());
    const result = prepare(options);
    const { IstorikoProslhpseonAllagonModel } = require('../../models/ergazomenoi');
    const expectedRows = options.proposal.proposedRows.map(row => ({ ...row,
        ...(row.employment_history_canonical_survivor_id ? { employment_history_canonical_survivor_id:
            IstorikoProslhpseonAllagonModel.schema.path('employment_history_canonical_survivor_id')
                .cast(row.employment_history_canonical_survivor_id) } : {}) }));
    for (const change of [
        p => { p.rowsToInsert.push({ _id: new mongoose.Types.ObjectId() }); },
        p => { p.rowsToDelete.push({ historyId: String(options.completeHistoryRows[0]._id) }); },
        p => { p.rowsToUpdate[0].patch.aa_eggrafhs = '0099'; },
        p => { p.rowsToUpdate[0].patch.ores_ergasias_ebdomadas = 1; },
        p => { p.finalRows[0].pragmatikosMisthos = 9999; },
        p => { p.rowsToUpdate.pop(); },
        p => { p.extraCurrentPatch = { energos: false }; },
        p => { p.rowsToUpdate[0].extraOperation = true; },
        p => { p.rowsToUpdate[0].patch.updatedAt = new Date('2020-01-01'); }
    ]) {
        const physicalPlan = S.clone(result.physicalPlan);
        change(physicalPlan);
        rejected(() => S.assertSettlementPhysicalPlan({ ...options, physicalPlan, expectedRows, now }));
    }
});

test('only explicitly proposed unreferenced duplicates may appear as physical deletions', () => {
    const options = approve(input(0));
    const plan = prepare(options).physicalPlan;
    assert.equal(plan.rowsToDelete.length, 2);
    assert.ok(plan.rowsToDelete.every(row => row.survivingHistoryId === '600000000000000000000003'));
    assert.deepEqual(plan.rowsToInsert, []);
    const changed = S.clone(options);
    changed.protectedReferenceSummary[String(changed.completeHistoryRows[0]._id)] = [{
        collection: 'Apasxoliseis_Period_Frozen_Snapshots', documentId: 'new-synthetic-reference' }];
    rejected(() => prepare(changed));
});

test('already inactive originals remain untouched on a second preparation', () => {
    const first = approve(input());
    const rows = prepare(first).physicalPlan.finalRows;
    const second = { ...first, completeHistoryRows: rows };
    second.proposal = settle(second);
    second.approval = { confirmed: true, fingerprint: S.buildEmployeeHistorySettlementApprovalFingerprint(second) };
    assert.equal(second.proposal.noOp, true);
    const plan = prepare(second).physicalPlan;
    assert.deepEqual(plan.rowsToUpdate, []);
    assert.deepEqual(plan.rowsToDelete, []);
    assert.deepEqual(plan.rowsToInsert, []);
    assert.deepEqual(plan.finalRows, rows);
});

test('technical revisions are monotonic even when preparation clock predates stored revision', () => {
    const options = approve(input());
    const result = prepare({ ...options, now: new Date('2020-01-01') });
    for (const update of result.physicalPlan.rowsToUpdate) {
        const before = options.completeHistoryRows.find(row => String(row._id) === update.historyId);
        assert.equal(update.patch.updatedAt.getTime(), before.updatedAt.getTime() + 1);
    }
});

test('unknown reference semantics and forged CLEAN certificates are rejected', () => {
    const options = approve(input());
    options.protectedReferenceSummary[String(options.completeHistoryRows[0]._id)][0].collection = 'Unknown';
    rejected(() => prepare(options));
});
