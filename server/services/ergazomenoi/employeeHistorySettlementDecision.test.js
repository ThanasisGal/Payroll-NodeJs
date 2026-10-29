'use strict';
const { test, before, after, mock } = require('node:test');
const assert = require('node:assert/strict');
const { startSettlementHarness } = require('../../../test/fixtures/employeeHistorySettlementHttpHarness');
const { settlementDecisionFixture } = require('../../../test/fixtures/employeeHistorySettlementDecisionFixture');
const { forbidRealSettlementMongo } = require('../../../test/fixtures/forbidRealSettlementMongo');
const { planEmployeeHistoryAutomaticSettlement: plan } = require('./employeeHistoryAutomaticReconstructionPlannerService');
const { applyEmployeeEmploymentHistorySettlementInSyntheticStore: apply } = require('./employeeEmploymentProfileWriter');
before(() => forbidRealSettlementMongo(mock));
after(() => mock.restoreAll());
const TWO = { choiceId: 'KEEP_TWO_DAY_PROFILE' }, FOUR = { choiceId: 'KEEP_FOUR_DAY_PROFILE' };
async function withHarness(work, options = {}) {
    const h = await startSettlementHarness({ fixture: settlementDecisionFixture(), ...options });
    try { await work(h); } finally { await h.close(); }
}
const approved = result => ({ approval: { confirmed: true, fingerprint: result.approvalFingerprint }, businessDecision: result.businessDecision });
for (const businessDecision of [TWO, FOUR]) test(`one whole-period choice ${businessDecision.choiceId} resolves both competing records, protects all payloads and repeats without writes`, async () => {
    await withHarness(async h => {
        const before = h.db.state(), preview = await (await h.preview()).json();
        assert.equal(preview.settlementPreview.questions.length, 1);
        assert.equal(preview.approvalFingerprint, undefined);
        const resolved = await (await h.resolve(businessDecision)).json();
        assert.equal(resolved.settlementPreview.state, 'automatic');
        assert.deepEqual(resolved.settlementPreview.questions, []);
        assert.equal(resolved.settlementPreview.choices.length, 1);
        assert.deepEqual(h.db.state(), before, 'answering never writes');
        const response = await h.apply(approved(resolved)), result = await response.json();
        assert.equal(response.status, 200);
        assert.equal(result.historyStatus, 'CLEAN');
        assert.equal(result.corrections.choices.length, 1);
        const after = h.db.state();
        assert.equal(after.audits.length, 1);
        const competingRows = after.history.filter(row => ['0002', '0003'].includes(row.aa_eggrafhs));
        const activeCompetingRows = competingRows.filter(row => row.employment_history_canonical_status !== 'REDUNDANT_REFERENCED');
        assert.equal(competingRows.length, 2);
        assert.equal(activeCompetingRows.length, 1, 'one answer resolves the whole shared period');
        assert.equal(activeCompetingRows[0].ores_ergasias_ebdomadas, businessDecision.choiceId === TWO.choiceId ? 14 : 30);
        assert.deepEqual(after.references, before.references);
        for (let index = 0; index < before.history.length; index++) {
            const row = after.history.find(row => String(row._id) === String(before.history[index]._id));
            const { employment_history_canonical_status, employment_history_canonical_survivor_id, updatedAt, ...payload } = row;
            const { updatedAt: oldRevision, ...original } = before.history[index];
            assert.deepEqual(payload, original);
        }
        const { employee_profile_mutation_sequence, ...current } = after.employees[0];
        assert.deepEqual(current, before.employees[0]);
        const repeated = await (await h.apply(approved(resolved))).json();
        assert.equal(repeated.alreadyApplied, true);
        assert.deepEqual(h.db.state(), after);
        const clean = await (await h.preview()).json();
        assert.equal(clean.settlementPreview.state, 'clean');
        assert.deepEqual(clean.settlementPreview.actions, []);
    });
});
test('changing or reopening a choice invalidates the previously reviewed approval', async () => {
    await withHarness(async h => {
        const first = await (await h.resolve(TWO)).json(), second = await (await h.resolve(FOUR)).json();
        assert.notEqual(first.approvalFingerprint, second.approvalFingerprint);
        const before = h.db.state();
        assert.equal((await h.apply(approved(first))).status, 409);
        assert.equal((await h.apply({ ...approved(first), businessDecision: FOUR })).status, 409);
        await h.resolve(null);
        assert.equal((await h.apply(approved(second))).status, 409);
        assert.deepEqual(h.db.state(), before);
    });
});
for (const decision of [{ choiceId: 'FORGED' }, { choiceId: 'KEEP_TWO_DAY_PROFILE', effectiveDate: '2026-01-01' },
    { choiceId: 'KEEP_TWO_DAY_PROFILE', patch: {} }, { choiceId: { $ne: null } }, [], 'KEEP_TWO_DAY_PROFILE']) {
    test(`arbitrary browser decision ${JSON.stringify(decision)} has no write authority`, async () => {
        await withHarness(async h => {
            const before = h.db.state();
            const response = await h.resolve(decision);
            assert.equal(response.status, 409);
            assert.match((await response.json()).message, /Δεν αποθηκεύτηκε.*1\..*2\./s);
            assert.deepEqual(h.db.state(), before);
        });
    });
}
test('recorded split becomes a verified synthetic proposal and revokes the old whole-period approval', async () => {
    await withHarness(async h => {
        const ready = await (await h.resolve(TWO)).json(), before = h.db.state();
        const unknown = await (await h.resolve({ choiceId: 'SPLIT_AT_2026_06_29' })).json();
        assert.equal(unknown.settlementPreview.state, 'automatic');
        assert.equal(unknown.executionMode, 'SYNTHETIC_ONLY');
        assert.equal(typeof unknown.approvalFingerprint, 'string');
        assert.equal((await h.apply(approved(ready))).status, 409);
        assert.deepEqual(h.db.state(), before);
    });
});
test('missing recorded protected values cannot be repaired by a business answer', async () => {
    const input = settlementDecisionFixture();
    delete input.completeHistoryRows[0].nomimoHmeromisthio;
    assert.equal(plan({ ...input, businessDecision: TWO }).status, 'REVIEW_REQUIRED');
});
for (const change of ['employee', 'reference']) test(`choice approval is revalidated after a ${change} change`, async () => {
    await withHarness(async h => {
        const result = await (await h.resolve(TWO)).json();
        if (change === 'employee') h.db.changeEmployee({ parathrhseis: 'μεταγενέστερη συνθετική αλλαγή' });
        else h.db.addReference(h.initial.completeHistoryRows[0]._id);
        const before = h.db.state();
        assert.equal((await h.apply(approved(result))).status, 409);
        assert.deepEqual(h.db.state(), before);
    });
});
test('uncertain choice transaction safely recognizes the same approval with a single audit', async () => {
    await withHarness(async h => {
        const result = await (await h.resolve(TWO)).json();
        h.db.failAt('COMMIT_ACK_LOST');
        const uncertain = await (await h.apply(approved(result))).json();
        assert.equal(uncertain.outcome, 'UNKNOWN');
        assert.equal(uncertain.success, undefined);
        assert.equal((await (await h.apply(approved(result))).json()).alreadyApplied, true);
        assert.equal(h.db.state().audits.length, 1);
    });
});
test('writer itself rejects a different choice bound to the old fingerprint, independently of HTTP', async () => {
    await withHarness(async h => {
        const result = await (await h.resolve(TWO)).json(), before = h.db.state();
        await assert.rejects(() => apply({ syntheticStore: h.db.handle, scope: h.initial.scope,
            employeeId: h.initial.employeeId, actorUserId: h.session.userId,
            ...approved(result), businessDecision: FOUR }), { code: 'EMPLOYEE_HISTORY_SETTLEMENT_PREPARATION_STALE' });
        assert.deepEqual(h.db.state(), before);
    });
});
test('multiple employment cycles cannot be resolved by a whole-period business answer', () => {
    const input = settlementDecisionFixture();
    input.completeHistoryRows[0].hmeromhnia_proslhpshs = new Date('2025-01-01');
    assert.throws(() => plan({ ...input, businessDecision: TWO }));
});
for (const change of ['employee', 'reference']) test(`concurrent ${change} change retries the existing transaction and rejects stale choice approval`, async () => {
    await withHarness(async h => {
        const result = await (await h.resolve(TWO)).json(), barrier = h.db.pauseNextHistoryRead();
        const pending = h.apply(approved(result));
        await barrier.reached;
        if (change === 'employee') h.db.changeEmployee({ parathrhseis: 'ταυτόχρονη συνθετική αλλαγή' });
        else h.db.addReference(h.initial.completeHistoryRows[0]._id);
        const before = h.db.state();
        barrier.resume();
        assert.equal((await pending).status, 409);
        assert.deepEqual(h.db.state(), before);
        assert.ok(h.db.events.some(event => event.type === 'retry'));
    });
});
for (const failure of ['WRITE', 'AUDIT', 'FINAL']) test(`${failure} rolls back choice, snapshot fences and audit together`, async () => {
    await withHarness(async h => {
        const result = await (await h.resolve(TWO)).json(), before = h.db.state();
        h.db.failAt(failure);
        assert.equal((await h.apply(approved(result))).status, 409);
        assert.deepEqual(h.db.state(), before);
        assert.equal(h.db.events.some(event => event.type === 'commit'), false);
    });
});
