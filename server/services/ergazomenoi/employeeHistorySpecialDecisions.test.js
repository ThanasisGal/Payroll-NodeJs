'use strict';
const { test, before, after, mock } = require('node:test');
const assert = require('node:assert/strict');
const { startSettlementHarness } = require('../../../test/fixtures/employeeHistorySettlementHttpHarness');
const { correctedPayFixture, datedPayChangeFixture, departureFactsFixture } = require('../../../test/fixtures/employeeHistorySpecialDecisionFixture');
const { periodSplitFixture } = require('../../../test/fixtures/employeeHistoryPeriodSplitFixture');
const { forbidRealSettlementMongo } = require('../../../test/fixtures/forbidRealSettlementMongo');
const { assessEmployeeHistorySpecialFacts: assess } = require('./employeeHistorySpecialFactBoundaryService');
const A = require('./employeeHistoryAutomaticReconstructionApplyContract');
const { classifyEmployeeHistoryResolutionCapability } = require('./employeeHistoryResolutionCapabilityService');
const { planEmployeeHistoryAutomaticSettlement, verifyEmployeeHistoryAutomaticSettlement } = require('./employeeHistoryAutomaticReconstructionPlannerService');
before(() => forbidRealSettlementMongo(mock));
after(() => mock.restoreAll());
async function withHarness(fixture, work) {
    const h = await startSettlementHarness({ fixture });
    try { await work(h); } finally { await h.close(); }
}
const approval = payload => ({ approval: { confirmed: true, fingerprint: payload.approvalFingerprint },
    ...(payload.businessDecision ? { businessDecision: payload.businessDecision } : {}) });
// A verified same-period correction includes logical retirement of the
// terminal artifact; its presentation still grants no execution approval.
test('corrected duplicate pay previews a strictly verified proposal without granting execution approval', async () => {
    const fixture = correctedPayFixture();
    const unique = classifyEmployeeHistoryResolutionCapability(fixture).uniquePlan;
    assert.equal(unique.status, 'APPLICABLE');
    const verified = verifyEmployeeHistoryAutomaticSettlement({ ...fixture,
        currentEmployee: { ...fixture.currentEmployee, ...unique.currentPatch },
        proposedRows: unique.desiredHistoryRows, requiredHistoryRows: fixture.completeHistoryRows,
        strictProfileEvidence: true });
    assert.equal(verified.status, 'CLEAN');
    assert.deepEqual(unique.physicalDeleteIds, []);
    assert.deepEqual(unique.desiredHistoryRows.map(row => String(row._id)).sort(),
        fixture.completeHistoryRows.map(row => String(row._id)).sort());
    await withHarness(fixture, async h => {
        const before = h.db.state(), preview = await (await h.preview()).json();
        // The isolated synthetic endpoint cannot approve this repair path.
        assert.equal(preview.settlementPreview.state, 'unknown');
        assert.notEqual(preview.settlementPreview.executionEnabled, true);
        assert.equal(preview.approvalFingerprint, undefined);
        assert.equal((await h.apply(approval(preview))).status, 409);
        assert.deepEqual(h.db.state(), before);
        assert.equal(h.db.events.some(event => event.type === 'commit'), false);
    });
});
test('dated pay changes preserve every recorded amount when duplicate retirement evidence is unproven', async () => {
    const fixture = datedPayChangeFixture();
    const planned = planEmployeeHistoryAutomaticSettlement(fixture);
    assert.equal(planned.status, 'REVIEW_REQUIRED');
    assert.equal(planned.reason, 'DUPLICATE_EVIDENCE_UNPROVEN');
    await withHarness(fixture, async h => {
        const before = h.db.state(), preview = await (await h.preview()).json();
        assert.equal(preview.settlementPreview.state, 'unknown');
        assert.equal(preview.approvalFingerprint, undefined);
        assert.equal((await h.apply(approval(preview))).status, 409);
        assert.deepEqual(h.db.state(), before);
        assert.equal(h.db.events.some(event => event.type === 'commit'), false);
    });
});
test('one offered date/event choice resolves all related periods and changes the approval fingerprint', async () => {
    await withHarness(periodSplitFixture({ automatic: false, intermediate: true }), async h => {
        const preview = await (await h.preview()).json();
        assert.equal(preview.settlementPreview.questions.length, 1);
        const first = await (await h.resolve({ choiceId: 'INTERMEDIATE_PROFILE_OTHER_DATE', answers: { effectiveDate: '2026-06-01' } })).json();
        const second = await (await h.resolve({ choiceId: 'INTERMEDIATE_PROFILE_OTHER_DATE', answers: { effectiveDate: '2026-06-02' } })).json();
        assert.notEqual(first.approvalFingerprint, second.approvalFingerprint);
        assert.equal((await h.apply(approval(first))).status, 409);
        assert.equal((await (await h.apply(approval(second))).json()).historyStatus, 'CLEAN');
    });
});
for (const failure of ['INSERT_EMPTY', 'INSERT_TAMPER', 'AUDIT', 'FINAL']) test(`pay correction ${failure} rolls back without changing any old financial fact`, async () => {
    await withHarness(correctedPayFixture(), async h => {
        const preview = await (await h.preview()).json(), before = h.db.state();
        h.db.failAt(failure);
        assert.notEqual((await h.apply(approval(preview))).status, 200);
        assert.deepEqual(h.db.state(), before);
        assert.equal(h.db.events.some(event => event.type === 'commit'), false);
    });
});
for (const changed of ['reference', 'amount']) test(`changed ${changed} invalidates the entire pay-correction approval`, async () => {
    await withHarness(correctedPayFixture(), async h => {
        const preview = await (await h.preview()).json();
        if (changed === 'reference') h.db.addReference(h.initial.completeHistoryRows[0]._id);
        else h.db.changeHistory(h.initial.completeHistoryRows[0]._id, { synolo_symbashs: 999 });
        const before = h.db.state();
        assert.equal((await h.apply(approval(preview))).status, 409);
        assert.deepEqual(h.db.state(), before);
    });
});
for (const pay of [false, true]) test(`${pay ? 'departure/pay' : 'departure'} facts use the existing resolver but stop at the unchanged lifecycle boundary`, async () => {
    const fixture = departureFactsFixture(pay), facts = { departureOutcome: 'DEPARTED_ON_FIRST_RECORDED_DATE',
        ...(pay ? { payEffectiveOutcome: 'PAY_APPLIED_FROM_HIRE' } : {}) };
    const before = A.stringify(fixture), assessment = assess(fixture, { facts });
    assert.equal(assessment.canonicalStatus, 'CLEAN');
    assert.equal(assessment.status, 'ADMIN_REQUIRED');
    assert.ok(assessment.changedCurrentFields.includes('energos'));
    assert.equal(A.stringify(fixture), before);
    await withHarness(fixture, async h => {
        const stored = h.db.state(), preview = await (await h.preview()).json();
        assert.equal(preview.settlementPreview.state, 'unknown');
        const decision = await (await h.resolve({ facts })).json();
        assert.equal(decision.settlementPreview.state, 'unknown');
        assert.equal(decision.approvalFingerprint, undefined);
        assert.deepEqual(h.db.state(), stored);
    });
});
test('invented pay, invalid date and unsupported departure facts never obtain approval', async () => {
    await withHarness(departureFactsFixture(true), async h => {
        const before = h.db.state();
        for (const facts of [
            { departureOutcome: 'NO_DEPARTURE', payEffectiveOutcome: 'PAY_APPLIED_FROM_HIRE', amount: 9999 },
            { departureOutcome: 'DEPARTED_ON_OTHER_DATE', departureDate: '2026-02-30', payEffectiveOutcome: 'PAY_APPLIED_FROM_HIRE' },
            { departureOutcome: 'FORGED', payEffectiveOutcome: 'PAY_APPLIED_FROM_HIRE' }
        ]) assert.equal((await h.resolve({ facts })).status, 400);
        assert.deepEqual(h.db.state(), before);
    });
});
test('missing financial facts never become inferred zero amounts in a corrected duplicate', async () => {
    const fixture = correctedPayFixture();
    for (const row of [fixture.currentEmployee, ...fixture.completeHistoryRows]) delete row.poso_symbashs_15;
    await withHarness(fixture, async h => {
        const before = h.db.state(), preview = await (await h.preview()).json();
        assert.equal(preview.settlementPreview.state, 'unknown');
        assert.equal(preview.approvalFingerprint, undefined);
        assert.deepEqual(h.db.state(), before);
    });
});
