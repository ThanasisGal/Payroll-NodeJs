'use strict';
const { test, before, after, mock } = require('node:test');
const assert = require('node:assert/strict');
const { forbidRealSettlementMongo } = require('../fixtures/forbidRealSettlementMongo');
const { createSyntheticSettlementStore } = require('../fixtures/employeeHistorySettlementSyntheticStore');
const { acceptanceBWithInitialGap } = require('../fixtures/employeeHistoryCoordinatedSettlementFixture');
const P = require('../../server/services/ergazomenoi/employeeHistorySettlementProtocol');
const S = require('../../server/services/ergazomenoi/employeeHistoryAutomaticSettlementPreparationContract');
const U = require('../../server/services/ergazomenoi/employeeHistoryCoordinatedSettlementContract');
const W = require('../../server/services/ergazomenoi/employeeEmploymentProfileWriter');
before(() => forbidRealSettlementMongo(mock)); after(() => mock.restoreAll());
function setup({ recoveryEnabled = false } = {}) {
    const actor = { _id: '700000000000000000000001', privileges: 'A', team: 'THA', situation: 'A' };
    const db = createSyntheticSettlementStore({ fixture: acceptanceBWithInitialGap(), enriched: false,
        actor, permission: { update: true }, executionMode: 'NORMAL', recoveryEnabled });
    const input = db.approvalInput(actor._id), proposal = U.buildCoordinatedSettlementProposal(input);
    const fingerprint = S.buildEmployeeHistorySettlementApprovalFingerprint({ ...input, proposal });
    const approval = { confirmed: true, fingerprint }, original = { ...input, fingerprint };
    const options = { syntheticStore: db.handle, scope: input.scope, employeeId: input.employeeId,
        actorUserId: actor._id, coordinated: true, approval };
    const apply = extra => W.applyEmployeeEmploymentHistorySettlementInSyntheticStore({ ...options, ...extra });
    const recover = (extra = {}) => P.fenceAndGrant({ ...db.protocolDependencies, original, generation: 0,
        approval, confirmed: true, revalidate: async () => {
            const fresh = db.approvalInput(actor._id), proposal = U.buildCoordinatedSettlementProposal(fresh);
            return { ...fresh, fingerprint: S.assertApprovedSettlement({ ...fresh, proposal, approval }) };
        }, ...extra });
    return { db, input, actor, approval, original, apply, recover };
}
const blocked = reason => error => error.outcome === 'BLOCKED' && (!reason || error.reason === reason);
test('functional protocol: failed writer, permanent fence, explicit successor, one final root audit', async () => {
    const h = setup(); h.db.failAt('WRITE');
    await assert.rejects(() => h.apply(), /SYNTHETIC_HISTORY_WRITE_FAILED/);
    const before = h.db.state(), attempts = h.db.protocolState().attempts;
    h.db.failAt(null);
    await assert.rejects(() => h.recover({ confirmed: false }), blocked('EXPLICIT_APPROVAL_REQUIRED'));
    const grant = await h.recover(); assert.equal(grant.outcome, 'GRANTED');
    assert.deepEqual(h.db.state(), before);
    assert.deepEqual(h.db.protocolState().attempts, attempts);
    await assert.rejects(() => h.apply(), blocked());
    await assert.rejects(() => h.recover(), blocked('ALREADY_FENCED'));
    const result = await h.apply({ syntheticStore: h.db.issueRecoveryHandle(grant.protocol) });
    assert.equal(result.applied, true);
    const state = h.db.protocolState();
    assert.equal(h.db.state().audits.length, 1);
    assert.equal(state.records.filter(row => row.mutationSource === P.TERMINAL).length, 2);
    assert.deepEqual(state.records.filter(row => row.mutationSource === P.TERMINAL).map(row => row.diagnostics.outcome), ['FENCED', 'COMMITTED']);
    assert.equal(String(h.db.state().audits[0]._id), P.binding(h.original).finalAuditId);
    assert.deepEqual(state.attempts[0], attempts[0]);
});
test('functional protocol: late owner and internal retry cannot pass a committed fence', async () => {
    const h = setup(), N = require('../../server/services/ergazomenoi/employeeHistorySettlementNormalActivation');
    const { deferred } = require('../fixtures/employeeProfileTransactionStore');
    const reached = deferred(), resume = deferred(), originalClaim = N.claimNormalSettlementAttempt;
    let first = true;
    const method = mock.method(N, 'claimNormalSettlementAttempt', async input => {
        await originalClaim(input);
        if (first) { first = false; reached.resolve(); await resume.promise; }
    });
    const pending = h.apply().then(value => ({ value }), error => ({ error }));
    try {
        await reached.promise;
        const grant = await h.recover(); assert.equal(grant.outcome, 'GRANTED');
        resume.resolve();
        // Also verify a repeated callback with the SAME invocation identity.
        // Real unique-key contention is covered by the mandatory Mongo CI suite.
        const receipt = h.db.protocolState().attempts[0];
        await W.inProfileTransaction(h.db.protocolDependencies.connection, async () => true, async session => {
            await assert.rejects(() => P.claim({ auditModel: h.db.protocolDependencies.auditModel,
                input: { ...h.original, claimId: receipt.diagnostics.claimId }, session,
                claimAttempt: () => Promise.resolve() }), blocked('FENCED'));
        });
        const old = await pending; assert.equal(old.error?.outcome, 'BLOCKED');
        assert.equal(h.db.state().audits.length, 0);
    } finally { resume.resolve(); await pending; method.mock.restore(); }
});
for (const failure of ['AUDIT', 'AUDIT_EMPTY', 'AUDIT_TAMPER', 'COMMIT_UNKNOWN_BEFORE', 'COMMIT_ACK_LOST'])
test('functional protocol blocks ' + failure + ' and preserves attempt evidence', async () => {
    const h = setup(); h.db.failAt(failure);
    await assert.rejects(() => h.apply(), blocked());
    const after = h.db.state(), attempts = h.db.protocolState().attempts;
    assert.equal(after.audits.length, failure === 'COMMIT_ACK_LOST' ? 1 : 0);
    if (failure === 'COMMIT_ACK_LOST') assert.equal((await h.apply()).alreadyApplied, true);
    else await assert.rejects(() => h.apply(), blocked());
    assert.deepEqual(h.db.state(), after); assert.deepEqual(h.db.protocolState().attempts, attempts);
});
test('functional protocol rejects stale recovery approval and missing predecessor', async () => {
    const h = setup();
    await assert.rejects(() => h.recover(), blocked('ATTEMPT_MISSING'));
    h.db.failAt('WRITE'); await assert.rejects(() => h.apply()); h.db.failAt(null);
    h.db.changeEmployee({ parathrhseis: 'Νεότερα στοιχεία' });
    const before = h.db.protocolState(); await assert.rejects(() => h.recover(), blocked());
    assert.deepEqual(h.db.protocolState(), before);
});
test('legacy receipt stays LEGACY_UNRESOLVED and immutable', async () => {
    const h = setup(), legacy = P.record(h.original, P.rootId(h.original), P.ATTEMPT,
        { actorUserId: h.input.actorUserId, fingerprint: h.approval.fingerprint, claimId: 'legacy' });
    const auditModel = { findById() { return { session() { return this; }, async lean() { return S.clone(legacy); } }; },
        async create() { assert.fail('Legacy recovery must never write'); } };
    const before = S.clone(legacy);
    await assert.rejects(() => h.recover({ auditModel }), blocked('LEGACY_UNRESOLVED'));
    assert.deepEqual(legacy, before);
});
test('recovery HTTP route remains closed before database access even with normal settlement enabled', async () => {
    const controller = require('../../server/controllers/ergazomenoi/employeeHistorySettlementHttpController')
        .createEmployeeHistorySettlementHttpController({ contextProvider: () => null });
    const res = { set() {}, status(value) { this.statusCode = value; return this; }, json(value) { return value; } };
    const result = await controller.recover({ body: { recoveryConfirmed: true } }, res);
    assert.equal(res.statusCode, 503); assert.equal(result.outcome, 'BLOCKED');
    assert.equal(result.reason, 'RECOVERY_DISABLED');
});

for (const failure of ['AUDIT', 'COMMIT_UNKNOWN_BEFORE', 'COMMIT_ACK_LOST'])
test('recovery blocks fence/grant persistence or acknowledgement failure: ' + failure, async () => {
    const h = setup(); h.db.failAt('WRITE'); await assert.rejects(() => h.apply());
    const before = h.db.state(), attempts = h.db.protocolState().attempts;
    h.db.failAt(failure); await assert.rejects(() => h.recover(), blocked()); h.db.failAt(null);
    assert.deepEqual(h.db.state(), before); assert.deepEqual(h.db.protocolState().attempts, attempts);
    await assert.rejects(() => h.apply(), blocked());
    if (failure === 'COMMIT_ACK_LOST') await assert.rejects(() => h.recover(), blocked('ALREADY_FENCED'));
});
test('stored COMMITTED without matching final audit can never confirm success', async () => {
    const h = setup(), protocol = P.binding(h.original);
    await assert.rejects(() => P.assertCommitted({ auditModel: { findById() { return { session() { return this; }, async lean() { return null; } }; } },
        audit: { _id: protocol.finalAuditId, employeeScope: { ...h.input.scope, employee_id: h.input.employeeId },
            diagnostics: { protocol, actorUserId: h.input.actorUserId, approvalFingerprint: h.approval.fingerprint } }, session: {} }), blocked('COMMIT_EVIDENCE_MISSING'));
});

for (const variation of ['approved', 'no-confirmation', 'role-changed', 'stale-data'])
test('recovery controller with actual writer and repositories: ' + variation, async t => {
    const h = setup({ recoveryEnabled: true }); h.db.failAt('WRITE');
    await assert.rejects(() => h.apply()); h.db.failAt(null);
    const N = require('../../server/services/ergazomenoi/employeeHistorySettlementNormalActivation');
    t.mock.method(N, 'issueRecoveryHandle', (_, protocol) => h.db.issueRecoveryHandle(protocol));
    const controller = require('../../server/controllers/ergazomenoi/employeeHistorySettlementHttpController')
        .createEmployeeHistorySettlementHttpController({ contextProvider: () => h.db.handle,
            readSessionProvider: () => { const state = h.db.state(); return { draft: state,
                syntheticActor: { ...h.actor }, syntheticPermission: { update: true }, syntheticReferences: state.references }; } });
    if (variation === 'role-changed') h.actor.privileges = 'S';
    if (variation === 'stale-data') h.db.changeEmployee({ parathrhseis: 'Μεταγενέστερη αλλαγή' });
    const req = { session: { userId: h.input.actorUserId, companyInUse: h.input.scope.company_kod, userTeam: h.input.scope.team },
        params: { id: h.input.employeeId }, body: { approval: h.approval, originalFingerprint: h.approval.fingerprint,
            generation: 0, recoveryConfirmed: variation !== 'no-confirmation' } };
    const res = { set() {}, status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; return value; } };
    const before = h.db.protocolState(); await controller.recover(req, res);
    if (variation === 'approved') {
        assert.equal(res.body.outcome, 'COMMITTED', JSON.stringify(res.body)); assert.equal(res.body.applied, true);
        assert.equal(h.db.state().audits.length, 1);
    } else {
        assert.equal(res.body.outcome, 'BLOCKED'); assert.equal(res.statusCode, 503);
        assert.deepEqual(h.db.protocolState(), before);
    }
});
