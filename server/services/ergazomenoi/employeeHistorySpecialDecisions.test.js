'use strict';
const { test, before, after, mock } = require('node:test');
const assert = require('node:assert/strict');
const { startSettlementHarness } = require('../../../test/fixtures/employeeHistorySettlementHttpHarness');
const { correctedPayFixture, datedPayChangeFixture, departureFactsFixture } = require('../../../test/fixtures/employeeHistorySpecialDecisionFixture');
const { periodSplitFixture } = require('../../../test/fixtures/employeeHistoryPeriodSplitFixture');
const { forbidRealSettlementMongo } = require('../../../test/fixtures/forbidRealSettlementMongo');
const { assessEmployeeHistorySpecialFacts: assess } = require('./employeeHistorySpecialFactBoundaryService');
const A = require('./employeeHistoryAutomaticReconstructionApplyContract');
before(() => forbidRealSettlementMongo(mock));
after(() => mock.restoreAll());
async function withHarness(fixture, work) {
    const h = await startSettlementHarness({ fixture });
    try { await work(h); } finally { await h.close(); }
}
const approval = payload => ({ approval: { confirmed: true, fingerprint: payload.approvalFingerprint },
    ...(payload.businessDecision ? { businessDecision: payload.businessDecision } : {}) });
test('corrected duplicate pay uses the existing unique resolver, preserves every old amount/result and commits one canonical replacement', async () => {
    await withHarness(correctedPayFixture(), async h => {
        const before = h.db.state(), preview = await (await h.preview()).json();
        assert.equal(preview.settlementPreview.state, 'automatic');
        assert.deepEqual(preview.settlementPreview.questions, []);
        assert.match(preview.settlementPreview.choices.join(' '), /διπλή εγγραφή.*καταγεγραμμένα/);
        assert.match(preview.settlementPreview.actions.join(' '), /1\.100,00/);
        const result = await (await h.apply(approval(preview))).json();
        assert.equal(result.historyStatus, 'CLEAN', JSON.stringify(result));
        const after = h.db.state(), ids = new Set(before.history.map(row => String(row._id)));
        const inserted = after.history.filter(row => !ids.has(String(row._id)));
        assert.equal(inserted.length, 1);
        assert.equal(inserted[0].synolo_symbashs, 1100);
        assert.equal(inserted[0].aa_eggrafhs, '0004');
        assert.deepEqual(after.references, before.references);
        for (const old of before.history) {
            const row = after.history.find(row => String(row._id) === String(old._id));
            const { employment_history_canonical_status, employment_history_canonical_survivor_id, updatedAt, ...payload } = row;
            const { updatedAt: oldRevision, ...original } = old;
            assert.deepEqual(payload, original);
        }
        assert.equal(after.audits.length, 1);
        assert.equal((await (await h.apply(approval(preview))).json()).alreadyApplied, true);
        assert.deepEqual(h.db.state(), after);
        assert.equal((await (await h.preview()).json()).settlementPreview.state, 'clean');
    });
});
test('real dated pay changes retain both recorded amounts, with only the existing approved boundary assumption', async () => {
    await withHarness(datedPayChangeFixture(), async h => {
        const before = h.db.state(), preview = await (await h.preview()).json();
        assert.equal(preview.settlementPreview.state, 'automatic');
        assert.deepEqual(preview.settlementPreview.questions, []);
        assert.match(preview.settlementPreview.assumptions.join(' '), /διαφορετικοί όροι σε διαφορετικές ημερομηνίες/);
        assert.equal((await (await h.apply(approval(preview))).json()).historyStatus, 'CLEAN');
        const after = h.db.state();
        assert.deepEqual(after.references, before.references);
        for (const old of before.history) {
            const row = after.history.find(row => String(row._id) === String(old._id));
            assert.equal(row.synolo_symbashs, old.synolo_symbashs);
            if (before.references.some(reference => reference.historyId === String(old._id))) assert.deepEqual(row, old);
        }
        assert.ok(after.history.some(row => row.synolo_symbashs === 1000));
        assert.ok(after.history.some(row => row.synolo_symbashs === 1100));
        assert.equal((await (await h.apply(approval(preview))).json()).alreadyApplied, true);
        assert.deepEqual(h.db.state(), after);
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
