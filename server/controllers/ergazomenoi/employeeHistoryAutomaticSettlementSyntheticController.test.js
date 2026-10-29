'use strict';
const { test, before, after, mock } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { startSettlementHarness } = require('../../../test/fixtures/employeeHistorySettlementHttpHarness');
const { forbidRealSettlementMongo } = require('../../../test/fixtures/forbidRealSettlementMongo');
const { createEmployeeHistoryAutomaticSettlementSyntheticController: create } = require('./employeeHistoryAutomaticSettlementSyntheticController');
before(() => forbidRealSettlementMongo(mock));
after(() => mock.restoreAll());
async function withHarness(options, work) {
    const h = await startSettlementHarness(options);
    try { await work(h); } finally { await h.close(); }
}
async function approval(h) {
    const response = await h.preview(), payload = await response.json();
    assert.equal(response.status, 200);
    return { confirmed: true, fingerprint: payload.approvalFingerprint };
}
test('HTTP approval commits through the existing writer, preserves finalized data and reports actual audit changes', async () => {
    await withHarness({}, async h => {
        const approved = await approval(h), before = h.db.state();
        assert.equal(before.audits.length, 0);
        const response = await h.apply({ approval: approved }), payload = await response.json();
        assert.equal(response.status, 200);
        assert.equal(payload.message, 'Το Ιστορικό τακτοποιήθηκε επιτυχώς');
        assert.equal(payload.historyStatus, 'CLEAN');
        assert.ok(payload.corrections.actions.length >= 3);
        assert.ok(payload.corrections.actions.some(item => /διατηρήθηκε.*ιστορικές αναφορές/.test(item)));
        assert.deepEqual(h.db.state().references, before.references);
        assert.equal(h.db.state().audits.length, 1);
        const committed = h.db.state();
        const repeat = await (await h.apply({ approval: approved })).json();
        assert.equal(repeat.alreadyApplied, true);
        assert.deepEqual(repeat.corrections, payload.corrections);
        assert.deepEqual(h.db.state(), committed);
    });
});
for (const change of ['employee', 'reference', 'approval']) test(`HTTP rejects stale ${change} approval without losing other changes`, async () => {
    await withHarness({}, async h => {
        const approved = await approval(h);
        if (change === 'employee') h.db.changeEmployee({ parathrhseis: 'συνθετική μεταβολή' });
        if (change === 'reference') h.db.addReference(h.initial.completeHistoryRows[0]._id);
        if (change === 'approval') approved.fingerprint = 'x'.repeat(43);
        const before = h.db.state(), response = await h.apply({ approval: approved });
        assert.equal(response.status, 409);
        assert.match((await response.json()).code, /_STALE$/);
        assert.deepEqual(h.db.state(), before);
    });
});
for (const fault of ['COMMIT_ACK_LOST', 'COMMIT_UNKNOWN_BEFORE']) test(`HTTP ${fault} stays UNKNOWN and repeats the same approval safely`, async () => {
    await withHarness({}, async h => {
        const approved = await approval(h);
        h.db.failAt(fault);
        const response = await h.apply({ approval: approved }), payload = await response.json();
        assert.equal(response.status, 503);
        assert.equal(payload.outcome, 'UNKNOWN');
        assert.equal(payload.success, undefined);
        assert.equal(payload.retryWithSameApproval, true);
        assert.doesNotMatch(payload.message, /Δεν αποθηκεύτηκε καμία αλλαγή/);
        assert.equal((await (await h.apply({ approval: approved })).json()).success, true);
        assert.equal(h.db.state().audits.length, 1);
        assert.equal(h.db.events.filter(event => event.type === 'commit').length, 1);
    });
});
test('incomplete History has no approval and forged application cannot write', async () => {
    await withHarness({ enriched: false }, async h => {
        const before = h.db.state(), preview = await (await h.preview()).json();
        assert.equal(preview.settlementPreview.state, 'unknown');
        assert.equal(preview.approvalFingerprint, undefined);
        const response = await h.apply({ approval: { confirmed: true, fingerprint: 'x'.repeat(43) } });
        assert.equal(response.status, 409);
        assert.deepEqual(h.db.state(), before);
    });
});
test('a presentation-only unique plan returns an unknown preview without minting synthetic approval', async () => {
    const fixture = require('../../../test/fixtures/employeeHistorySpecialDecisionFixture').correctedPayFixture();
    fixture.currentEmployee.hmeromhnia_isxyos_oron_ergasias_eos = null;
    const presentation = require('../../services/ergazomenoi/employeeHistorySettlementPreviewService')
        .buildEmployeeHistorySettlementPreview(fixture);
    assert.equal(presentation.state, 'automatic');
    assert.equal(presentation.executionEnabled, false);
    await withHarness({ fixture }, async h => {
        const before = h.db.state(), response = await h.preview(), preview = await response.json();
        assert.equal(response.status, 200);
        assert.equal(preview.settlementPreview.state, 'unknown');
        assert.equal(preview.settlementPreview.executionEnabled, false);
        assert.equal(preview.approvalFingerprint, undefined);
        assert.equal(preview.executionMode, undefined);
        assert.equal((await h.apply({ approval: { confirmed: true, fingerprint: 'x'.repeat(43) } })).status, 409);
        assert.deepEqual(h.db.state(), before);
    });
});
test('browser proposals, scope, role and business choices are rejected as additional instructions', async () => {
    await withHarness({}, async h => {
        const approved = await approval(h), before = h.db.state();
        for (const extra of [{ proposal: {} }, { scope: {} }, { privileges: 'A' }, { answers: {} }, { operations: [] }]) {
            assert.equal((await h.apply({ approval: approved, ...extra })).status, 409);
            assert.deepEqual(h.db.state(), before);
        }
    });
});
for (const revoked of ['active', 'permission', 'role', 'identity', 'company']) test(`HTTP revalidates ${revoked} before application and duplicate recognition`, async () => {
    for (const alreadyApplied of [false, true]) await withHarness({}, async h => {
        const approved = await approval(h);
        if (alreadyApplied) assert.equal((await h.apply({ approval: approved })).status, 200);
        if (revoked === 'active') h.actor.situation = 'I';
        if (revoked === 'permission') h.permission.update = false;
        if (revoked === 'role') h.actor.privileges = 'U';
        if (revoked === 'identity') h.session.userId = '700000000000000000000099';
        if (revoked === 'company') h.session.companyInUse = '700000000000000000000099';
        const before = h.db.state();
        assert.equal((await h.apply({ approval: approved })).status, 403);
        assert.deepEqual(h.db.state(), before);
    });
});
test('real routes never register the synthetic handler and only issued memory capabilities construct it', () => {
    for (const syntheticStore of [undefined, {}, require('mongoose').connection]) {
        assert.throws(() => create({ syntheticStore }), { code: 'EMPLOYEE_HISTORY_SETTLEMENT_PREPARATION_SYNTHETIC_STORE_REQUIRED' });
    }
    const routes = fs.readFileSync(__dirname + '/../../routes/usersRoute.js', 'utf8');
    assert.doesNotMatch(routes, /employeeHistoryAutomaticSettlementSynthetic|history-automatic-settlement-apply/);
    assert.equal(require('mongoose').connection.readyState, 0);
});
