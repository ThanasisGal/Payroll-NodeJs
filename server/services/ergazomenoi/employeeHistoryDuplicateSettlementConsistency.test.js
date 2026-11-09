'use strict';
const { test, before, after, mock } = require('node:test');
const assert = require('node:assert/strict');
const { forbidRealSettlementMongo } = require('../../../test/fixtures/forbidRealSettlementMongo');
const { periodSplitFixture } = require('../../../test/fixtures/employeeHistoryPeriodSplitFixture');
const { createSyntheticSettlementStore } = require('../../../test/fixtures/employeeHistorySettlementSyntheticStore');
const { buildEmployeeHistoryPeriodSplitProposal: split } = require('./employeeHistoryPeriodSplitPreviewService');
const { settleProvenHistoryDuplicates: settle } = require('./employeeHistoryCanonicalizationService');
const { verifyEmployeeHistoryAutomaticSettlement: verify } = require('./employeeHistoryAutomaticReconstructionPlannerService');
const { inspectEmployeeHistorySave: inspect } = require('./employeeHistorySaveValidationService');
const { applyEmployeeEmploymentHistorySettlementInSyntheticStore: apply } = require('./employeeEmploymentProfileWriter');
const S = require('./employeeHistoryAutomaticSettlementPreparationContract');
const { isInactiveHistoryRow } = require('../../utils/ergazomenoi/employmentHistoryCanonicalStatus');
const actor = { _id: '700000000000000000000001', privileges: 'A', team: 'THA', situation: 'A' };
const duplicateId = '600000000000000000000004', survivorId = '600000000000000000000005';
before(() => forbidRealSettlementMongo(mock));
after(() => mock.restoreAll());
function setup(fixture = periodSplitFixture({ yearly: true })) {
    const db = createSyntheticSettlementStore({ fixture, actor, permission: { update: true } });
    const input = db.approvalInput(actor._id);
    let proposal;
    try { proposal = split(input); }
    catch (error) {
        // The established resolver may explicitly reject contradictory facts.
        if (error.code !== 'EMPLOYEE_HISTORY_MULTIPLE_SAFE_SIMULATION_FAILED') throw error;
        proposal = null;
    }
    const fingerprint = proposal ? S.buildEmployeeHistorySettlementApprovalFingerprint({ ...input, proposal }) : 'x'.repeat(43);
    const run = () => apply({ syntheticStore: db.handle, scope: input.scope, employeeId: input.employeeId,
        actorUserId: actor._id, approval: { confirmed: true, fingerprint } });
    return { db, input, proposal, run };
}
test('proven original duplicate: complete preview is CLEAN and one atomic commit preserves physical identities, references and audit evidence', async () => {
    const { db, input, proposal, run } = setup(), before = db.state();
    assert.equal(proposal.status, 'CLEAN');
    assert.equal(inspect({ ...input, historyRows: proposal.proposedRows }).status, 'CLEAN');
    assert.deepEqual(proposal.duplicateRetirements, [{ historyId: duplicateId, survivingHistoryId: survivorId,
        reason: 'IDENTICAL_ORIGINAL_PROFILE_WITH_RECORDED_DEPARTURE' }]);
    assert.equal((await run()).historyStatus, 'CLEAN');
    const after = db.state();
    assert.deepEqual(after.references, before.references);
    for (const original of before.history) {
        const persisted = after.history.find(row => String(row._id) === String(original._id));
        const strip = ({ employment_history_canonical_status, employment_history_canonical_survivor_id, updatedAt, ...row }) => row;
        assert.deepEqual(strip(persisted), strip(original));
    }
    assert.deepEqual(after.history.find(row => String(row._id) === survivorId), before.history.find(row => String(row._id) === survivorId));
    assert.equal(String(after.history.find(row => String(row._id) === duplicateId).employment_history_canonical_survivor_id), survivorId);
    assert.deepEqual(after.audits[0].diagnostics.duplicateRetirements, proposal.duplicateRetirements);
    assert.deepEqual(after.audits[0].diagnostics.historyBefore, before.history);
    assert.equal(after.audits.length, 1);
    assert.equal(db.events.filter(event => event.type === 'commit').length, 1);
    assert.equal(inspect({ ...input, currentEmployee: after.employees[0], historyRows: after.history }).status, 'CLEAN');
});
for (const field of ['krathsh_01', 'original_document_evidence']) test(`different original ${field}: no arbitrary retirement, CLEAN or commit`, async () => {
    const fixture = periodSplitFixture({ yearly: true });
    fixture.completeHistoryRows.find(row => String(row._id) === duplicateId)[field] = 'DIFFERENT_ORIGINAL';
    const { db, input, proposal, run } = setup(fixture), before = db.state();
    assert.equal(proposal, null);
    const candidate = settle({ ...input, historyRows: input.completeHistoryRows });
    assert.deepEqual(candidate.retirements, []);
    assert.deepEqual(candidate.rows, input.completeHistoryRows);
    await assert.rejects(run, error => [400, 409].includes(error.statusCode));
    assert.deepEqual(db.state(), before);
    assert.equal(db.events.some(event => event.type === 'commit'), false);
});
test('active duplicates in the final proposal never receive a CLEAN certificate', () => {
    const { input, proposal } = setup();
    const rows = proposal.proposedRows.map(row => {
        if (String(row._id) !== duplicateId) return row;
        const { employment_history_canonical_status, employment_history_canonical_survivor_id, ...active } = row;
        return active;
    });
    assert.equal(verify({ ...input, proposedRows: rows, strictProfileEvidence: true }).status, 'REVIEW_REQUIRED');
    assert.notEqual(inspect({ ...input, historyRows: rows }).status, 'CLEAN');
});
test('proven unreferenced duplicate is retired without any physical deletion', async () => {
    const fixture = periodSplitFixture({ yearly: true });
    fixture.protectedReferenceSummary[duplicateId] = [];
    const { db, proposal, run } = setup(fixture), before = db.state();
    assert.equal(proposal.status, 'CLEAN');
    await run(); const after = db.state();
    for (const row of before.history) assert.ok(after.history.some(saved => String(saved._id) === String(row._id)));
    assert.equal(after.history.find(row => String(row._id) === duplicateId).employment_history_canonical_status, 'REDUNDANT_REFERENCED');
    assert.equal(after.audits[0].deletedLegacyHistoryIds.length, 0);
});
test('complete original equality selects the same physical survivor regardless of input order', () => {
    const { input, proposal } = setup();
    const rows = proposal.proposedRows.filter(row => !isInactiveHistoryRow(row));
    const original = rows.find(row => String(row._id) === survivorId);
    const duplicate = { ...original, _id: duplicateId, aa_eggrafhs: '0004', createdAt: new Date('2027-01-01') };
    const forward = settle({ ...input, historyRows: [...rows, duplicate] });
    const reverse = settle({ ...input, historyRows: [duplicate, ...rows].reverse() });
    assert.equal(forward.reason, undefined);
    assert.equal(forward.retirements.length, 1);
    assert.equal(forward.retirements[0].reason, 'IDENTICAL_ORIGINAL_PAYLOAD');
    assert.deepEqual(forward.retirements, reverse.retirements);
    const active = forward.rows.filter(row => !isInactiveHistoryRow(row));
    assert.ok(active.some(row => String(row._id) === forward.retirements[0].survivingHistoryId));
});
test('a matching reconstructed payload cannot manufacture original duplicate evidence', () => {
    const { input, proposal } = setup();
    const originals = S.clone(input.completeHistoryRows);
    originals.find(row => String(row._id) === duplicateId).original_document_evidence = 'DIFFERENT';
    const rows = proposal.proposedRows.map(row => String(row._id) === duplicateId
        ? input.completeHistoryRows.find(original => String(original._id) === duplicateId) : row);
    const result = settle({ ...input, historyRows: rows, requiredHistoryRows: originals });
    assert.equal(result.reason, 'DUPLICATE_EVIDENCE_UNPROVEN');
    assert.deepEqual(result.retirements, []);
});
test('repeating the same approval or settlement adds no retirement, write or audit', async () => {
    const { db, input, proposal, run } = setup();
    const again = settle({ ...input, historyRows: proposal.proposedRows });
    assert.deepEqual(again.retirements, []);
    assert.deepEqual(again.rows, proposal.proposedRows);
    await run(); const committed = db.state();
    assert.equal((await run()).alreadyApplied, true);
    assert.deepEqual(db.state(), committed);
    assert.equal(committed.history.filter(isInactiveHistoryRow).length, 3);
    assert.equal(db.events.filter(event => event.type === 'commit').length, 1);
});
for (const kind of ['employee', 'history', 'reference']) test(`stale ${kind} after preview rejects before finalization`, async () => {
    const { db, run } = setup();
    if (kind === 'employee') db.changeEmployee({ parathrhseis: 'later synthetic edit' });
    if (kind === 'history') db.changeHistory(duplicateId, { updatedAt: new Date('2026-11-07') });
    if (kind === 'reference') db.addReference(duplicateId);
    const changed = db.state();
    await assert.rejects(run, error => error.statusCode === 409);
    assert.deepEqual(db.state(), changed);
    assert.equal(db.events.some(event => event.type === 'commit'), false);
});
for (const failure of ['WRITE', 'AUDIT', 'FINAL']) test(`${failure} failure rolls back retirement, inserted periods, audit and fences`, async () => {
    const { db, run } = setup(), before = db.state();
    db.failAt(failure);
    await assert.rejects(run);
    assert.deepEqual(db.state(), before);
    assert.equal(db.events.some(event => event.type === 'commit'), false);
    assert.ok(db.events.some(event => event.type === 'write'));
});
test('concurrent mutation retries the transaction and rejects the obsolete preview without losing the other change', async () => {
    const { db, run } = setup(), barrier = db.pauseNextHistoryRead();
    const pending = run(); await barrier.reached;
    db.addReference(duplicateId); const changed = db.state(); barrier.resume();
    await assert.rejects(() => pending, error => error.statusCode === 409);
    assert.deepEqual(db.state(), changed);
    assert.ok(db.events.some(event => event.type === 'retry'));
    assert.equal(db.events.some(event => event.type === 'commit'), false);
});
