'use strict';

// Local safety assessment only: no recovery endpoint, grant, reset or real data.
const { test, before, after, mock } = require('node:test');
const assert = require('node:assert/strict');
const { forbidRealSettlementMongo } = require('../fixtures/forbidRealSettlementMongo');
const { createSyntheticSettlementStore } = require('../fixtures/employeeHistorySettlementSyntheticStore');
const { acceptanceBWithInitialGap } = require('../fixtures/employeeHistoryCoordinatedSettlementFixture');
const { deferred } = require('../fixtures/employeeProfileTransactionStore');
const S = require('../../server/services/ergazomenoi/employeeHistoryAutomaticSettlementPreparationContract');
const U = require('../../server/services/ergazomenoi/employeeHistoryCoordinatedSettlementContract');
const N = require('../../server/services/ergazomenoi/employeeHistorySettlementNormalActivation');
const W = require('../../server/services/ergazomenoi/employeeEmploymentProfileWriter');

before(() => forbidRealSettlementMongo(mock));
after(() => mock.restoreAll());

function setup(t, { pauseFirstClaim = false, attemptStorageFailure = null } = {}) {
    const actor = { _id: '700000000000000000000001', privileges: 'A', team: 'THA', situation: 'A' };
    const db = createSyntheticSettlementStore({ fixture: acceptanceBWithInitialGap(), enriched: false,
        actor, permission: { update: true }, executionMode: 'NORMAL' });
    const input = db.approvalInput(actor._id);
    const proposal = U.buildCoordinatedSettlementProposal(input);
    assert.equal(proposal.status, 'CLEAN');
    assert.equal(proposal.noOp, false);
    const fingerprint = S.buildEmployeeHistorySettlementApprovalFingerprint({ ...input, proposal });
    const options = { syntheticStore: db.handle, scope: input.scope, employeeId: input.employeeId,
        actorUserId: actor._id, coordinated: true, approval: { confirmed: true, fingerprint } };
    const claimed = deferred(), resume = deferred();
    let receiptId, receiptModel, claims = 0;
    const originalClaim = N.claimNormalSettlementAttempt;
    t.mock.method(N, 'claimNormalSettlementAttempt', async args => {
        const number = ++claims;
        receiptModel = args.auditModel;
        await originalClaim({ ...args, auditModel: { ...args.auditModel,
            async create(...values) {
                if (attemptStorageFailure === 'BEFORE_WRITE') throw Error('SYNTHETIC_ATTEMPT_STORAGE_UNAVAILABLE');
                const created = await args.auditModel.create(...values);
                receiptId = created[0]._id;
                if (attemptStorageFailure === 'ACK_LOST') throw Error('SYNTHETIC_ATTEMPT_ACK_LOST');
                return created;
            }
        } });
        if (pauseFirstClaim && number === 1) {
            claimed.resolve();
            await resume.promise;
        }
    });
    return { db, input, actor, options, claimed: claimed.promise, resume: resume.resolve,
        apply: () => W.applyEmployeeEmploymentHistorySettlementInSyntheticStore(options),
        claims: () => claims,
        async receipt() {
            return S.clone(await receiptModel.findById(receiptId).session(null).read('primary').readConcern('majority').lean());
        }
    };
}

const commits = h => h.db.events.filter(event => event.type === 'commit').length;
const uncertain = error => error.statusCode === 503 && error.code.endsWith('COMMIT_UNCERTAIN');

test('recovery BLOCKED: live attempt and definitively rolled-back attempt have identical persisted evidence',
    { timeout: 10000 }, async t => {
        const h = setup(t, { pauseFirstClaim: true });
        const pending = h.apply();
        // Attach rejection handling before releasing the deterministic barrier.
        const outcome = pending.then(value => ({ value }), error => ({ error }));
        t.after(h.resume);
        await h.claimed;
        const liveState = h.db.state(), liveReceipt = await h.receipt();
        assert.equal(liveReceipt.mutationSource, 'EMPLOYEE_HISTORY_SETTLEMENT_ATTEMPT');
        assert.equal(liveState.audits.length, 0);
        assert.equal(commits(h), 0);
        h.db.failAt('WRITE');
        h.resume();
        const result = await outcome;
        assert.equal(result.error.message, 'SYNTHETIC_HISTORY_WRITE_FAILED');
        assert.deepEqual(h.db.state(), liveState);
        assert.deepEqual(await h.receipt(), liveReceipt);
        assert.equal(commits(h), 0);
        h.db.failAt(null);
        await assert.rejects(h.apply, uncertain);
        assert.deepEqual(h.db.state(), liveState);
        assert.deepEqual(await h.receipt(), liveReceipt);
    });

test('recovery BLOCKED: a live owner can still commit after an unchanged snapshot with no final audit',
    { timeout: 10000 }, async t => {
        const h = setup(t, { pauseFirstClaim: true });
        const pending = h.apply();
        t.after(h.resume);
        await h.claimed;
        const original = h.db.state(), receipt = await h.receipt();
        assert.equal(original.audits.length, 0);
        assert.equal(commits(h), 0);
        await assert.rejects(h.apply, uncertain);
        assert.deepEqual(h.db.state(), original);
        assert.deepEqual(await h.receipt(), receipt);
        h.resume();
        assert.equal((await pending).applied, true);
        assert.equal(commits(h), 1);
        assert.equal(h.db.state().audits.length, 1);
        assert.equal(h.db.state().audits[0].mutationSource, 'EMPLOYEE_HISTORY_SETTLEMENT');
        const after = h.db.state(), claimCount = h.claims();
        assert.equal((await h.apply()).alreadyApplied, true);
        assert.equal(h.claims(), claimCount);
        assert.equal(commits(h), 1);
        assert.deepEqual(h.db.state(), after);
        assert.deepEqual(await h.receipt(), receipt);
    });

test('recovery BLOCKED: unknown transaction outcome without final audit never permits another application', async t => {
    const h = setup(t), before = h.db.state();
    h.db.failAt('COMMIT_UNKNOWN_BEFORE');
    await assert.rejects(h.apply, uncertain);
    const receipt = await h.receipt();
    assert.equal(receipt.mutationSource, 'EMPLOYEE_HISTORY_SETTLEMENT_ATTEMPT');
    assert.deepEqual(h.db.state(), before);
    assert.equal(commits(h), 0);
    await assert.rejects(h.apply, uncertain);
    assert.deepEqual(h.db.state(), before);
    assert.deepEqual(await h.receipt(), receipt);
    assert.equal(commits(h), 0);
});

test('completed transaction: lost acknowledgement is recognized from final audit without a second application', async t => {
    const h = setup(t);
    h.db.failAt('COMMIT_ACK_LOST');
    await assert.rejects(h.apply, uncertain);
    const receipt = await h.receipt(), after = h.db.state();
    assert.equal(after.audits.length, 1);
    assert.equal(after.audits[0].mutationSource, 'EMPLOYEE_HISTORY_SETTLEMENT');
    assert.equal(after.audits[0].diagnostics.approvalFingerprint, h.options.approval.fingerprint);
    assert.equal(commits(h), 1);
    const claimCount = h.claims();
    const result = await h.apply();
    assert.equal(result.alreadyApplied, true);
    assert.equal(result.applied, false);
    assert.equal(h.claims(), claimCount);
    assert.equal(commits(h), 1);
    assert.deepEqual(h.db.state(), after);
    assert.deepEqual(await h.receipt(), receipt);
});

for (const changed of ['current', 'history', 'references'])
test('recovery BLOCKED: changed ' + changed + ' rejects old approval and preserves its prior receipt', async t => {
    const h = setup(t);
    h.db.failAt('WRITE');
    await assert.rejects(h.apply, /SYNTHETIC_HISTORY_WRITE_FAILED/);
    const receipt = await h.receipt();
    h.db.failAt(null);
    if (changed === 'current') h.db.changeEmployee({ parathrhseis: 'SYNTHETIC_CHANGED' });
    if (changed === 'history') h.db.changeHistory(h.input.completeHistoryRows[0]._id, { synolo_symbashs: 9999 });
    if (changed === 'references') h.db.addReference(h.input.completeHistoryRows[0]._id);
    const before = h.db.state(), claimCount = h.claims();
    await assert.rejects(h.apply, error => error.statusCode === 409);
    assert.equal(h.claims(), claimCount, 'changed evidence must be rejected before another claim');
    assert.equal(commits(h), 0);
    assert.deepEqual(h.db.state(), before);
    assert.deepEqual(await h.receipt(), receipt);
});

test('attempt storage failure blocks business writes before acquiring the employee mutation fence', async t => {
    const h = setup(t, { attemptStorageFailure: 'BEFORE_WRITE' });
    const before = h.db.state();
    await assert.rejects(h.apply, uncertain);
    assert.equal(h.db.events.some(event => ['fence', 'write', 'commit'].includes(event.type)), false);
    assert.deepEqual(h.db.state(), before);
});

test('lost attempt-storage acknowledgement preserves the durable receipt and blocks another invocation', async t => {
    const h = setup(t, { attemptStorageFailure: 'ACK_LOST' });
    const before = h.db.state();
    await assert.rejects(h.apply, uncertain);
    const receipt = await h.receipt();
    assert.equal(receipt.mutationSource, 'EMPLOYEE_HISTORY_SETTLEMENT_ATTEMPT');
    await assert.rejects(h.apply, uncertain);
    assert.equal(h.db.events.some(event => ['fence', 'write', 'commit'].includes(event.type)), false);
    assert.deepEqual(h.db.state(), before);
    assert.deepEqual(await h.receipt(), receipt);
});
