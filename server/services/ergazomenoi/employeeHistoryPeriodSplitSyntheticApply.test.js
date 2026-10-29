'use strict';
const { test, before, after, mock } = require('node:test');
const assert = require('node:assert/strict');
const { startSettlementHarness } = require('../../../test/fixtures/employeeHistorySettlementHttpHarness');
const { periodSplitFixture } = require('../../../test/fixtures/employeeHistoryPeriodSplitFixture');
const { forbidRealSettlementMongo } = require('../../../test/fixtures/forbidRealSettlementMongo');
const A = require('./employeeHistoryAutomaticReconstructionApplyContract');
before(() => forbidRealSettlementMongo(mock));
after(() => mock.restoreAll());
async function withHarness(work, { manual = false, priorCycle = false } = {}) {
    const fixture = periodSplitFixture({ yearly: true, automatic: !manual, priorCycle });
    if (priorCycle) fixture.completeHistoryRows[0].aa_eggrafhs = '0000';
    const h = await startSettlementHarness({ fixture });
    const businessDecision = manual ? { choiceId: 'SPLIT_AT_2026_07_01' } : undefined;
    try {
        const preview = await (await (manual ? h.resolve(businessDecision) : h.preview())).json();
        assert.equal(preview.executionMode, 'SYNTHETIC_ONLY');
        const body = { approval: { confirmed: true, fingerprint: preview.approvalFingerprint },
            ...(manual ? { businessDecision } : {}) };
        await work({ ...h, body });
    } finally { await h.close(); }
}
for (const manual of [false, true]) test(`${manual ? 'confirmed' : 'documented'} annual split commits exact periods, one audit and stable identities on replay`, async () => {
    await withHarness(async h => {
        const before = h.db.state(), response = await h.apply(h.body), result = await response.json();
        assert.equal(response.status, 200, JSON.stringify(result));
        assert.equal(result.message, 'Το Ιστορικό τακτοποιήθηκε επιτυχώς');
        assert.equal(result.historyStatus, 'CLEAN');
        const committed = h.db.state(), oldIds = new Set(before.history.map(row => String(row._id)));
        const inserted = committed.history.filter(row => !oldIds.has(String(row._id))).sort((a, b) => a.aa_eggrafhs.localeCompare(b.aa_eggrafhs));
        assert.deepEqual(inserted.map(row => ({ aa: row.aa_eggrafhs, from: row.hmeromhnia_isxyos_oron_ergasias_apo.toISOString().slice(0, 10),
            to: row.hmeromhnia_isxyos_oron_ergasias_eos.toISOString().slice(0, 10), hours: row.ores_ergasias_ebdomadas })), [
            { aa: '0006', from: '2026-01-01', to: '2026-06-30', hours: 14 },
            { aa: '0007', from: '2026-07-01', to: '2026-12-31', hours: 30 } ]);
        assert.equal(new Set(committed.history.map(row => String(row._id))).size, committed.history.length);
        assert.ok(inserted.every(row => row._id?._bsontype === 'ObjectId'));
        assert.deepEqual(committed.references, before.references);
        for (const old of before.history) {
            const stored = committed.history.find(row => String(row._id) === String(old._id));
            const { employment_history_canonical_status, employment_history_canonical_survivor_id, updatedAt, ...payload } = stored;
            const { updatedAt: oldRevision, ...oldPayload } = old;
            assert.deepEqual(payload, oldPayload);
        }
        const { employee_profile_mutation_sequence, ...current } = committed.employees[0];
        assert.deepEqual(current, before.employees[0]);
        assert.equal(committed.audits.length, 1);
        const audit = committed.audits[0].diagnostics;
        assert.equal(audit.approvalFingerprint, h.body.approval.fingerprint);
        assert.equal(audit.settlementKind, 'PERIOD_SPLIT');
        assert.deepEqual(A.ordered(audit.historyAfter), A.ordered(committed.history));
        assert.equal(h.db.events.filter(event => event.type === 'commit').length, 1);
        assert.equal(h.db.events.filter(event => event.type === 'syntheticInsert').length, 2);
        const replay = await (await h.apply(h.body)).json();
        assert.equal(replay.alreadyApplied, true, JSON.stringify(replay));
        assert.deepEqual(h.db.state(), committed);
        assert.equal(h.db.events.filter(event => event.type === 'syntheticInsert').length, 2);
        assert.equal((await (await h.preview()).json()).settlementPreview.state, 'clean');
    }, { manual, priorCycle: true });
});
for (const fault of ['INSERT', 'INSERT_EMPTY', 'INSERT_TAMPER', 'AUDIT', 'AUDIT_EMPTY', 'AUDIT_TAMPER', 'FINAL']) {
    test(`${fault}: rollback both inserts, retirements, fences and approval audit together`, async () => {
        await withHarness(async h => {
            const before = h.db.state(); h.db.failAt(fault);
            assert.notEqual((await h.apply(h.body)).status, 200);
            assert.deepEqual(h.db.state(), before);
            assert.equal(h.db.events.some(event => event.type === 'commit'), false);
            assert.ok(h.db.events.some(event => event.type === 'syntheticInsert'));
        });
    });
}
for (const changed of ['employee', 'reference', 'approval', 'extraFields']) test(`stale/altered ${changed} approval cannot create periods`, async () => {
    await withHarness(async h => {
        if (changed === 'employee') h.db.changeEmployee({ parathrhseis: 'συνθετική παράλληλη αλλαγή' });
        if (changed === 'reference') h.db.addReference(h.initial.completeHistoryRows[0]._id);
        if (changed === 'approval') h.body.approval.fingerprint = 'x'.repeat(43);
        if (changed === 'extraFields') h.body.rowsToInsert = [];
        const before = h.db.state();
        assert.equal((await h.apply(h.body)).status, 409);
        assert.deepEqual(h.db.state(), before);
    });
});
for (const fault of ['COMMIT_ACK_LOST', 'COMMIT_UNKNOWN_BEFORE']) test(`${fault}: same approval safely resolves uncertainty without duplicate IDs`, async () => {
    await withHarness(async h => {
        h.db.failAt(fault);
        const response = await h.apply(h.body), unknown = await response.json();
        assert.equal(response.status, 503);
        assert.equal(unknown.outcome, 'UNKNOWN');
        assert.equal(unknown.success, undefined);
        assert.equal((await h.apply(h.body)).status, 200);
        const committed = h.db.state();
        assert.equal((await (await h.apply(h.body)).json()).alreadyApplied, true);
        assert.deepEqual(h.db.state(), committed);
        assert.equal(committed.audits.length, 1);
        assert.equal(committed.history.length, h.initial.completeHistoryRows.length + 2);
        assert.equal(h.db.events.filter(event => event.type === 'commit').length, 1);
    });
});
for (const changed of ['employee', 'reference']) test(`concurrent ${changed} conflicts, retries and rejects the original approval`, async () => {
    await withHarness(async h => {
        const barrier = h.db.pauseNextHistoryRead(), pending = h.apply(h.body);
        await barrier.reached;
        if (changed === 'employee') h.db.changeEmployee({ parathrhseis: 'άλλη συνθετική αποθήκευση' });
        else h.db.addReference(h.initial.completeHistoryRows[0]._id);
        const before = h.db.state(); barrier.resume();
        assert.equal((await pending).status, 409);
        assert.deepEqual(h.db.state(), before);
        assert.ok(h.db.events.some(event => event.type === 'retry'));
    });
});
for (const changed of ['role', 'permission', 'active']) test(`revoked ${changed} blocks initial execution and already-applied recognition`, async () => {
    for (const completed of [false, true]) await withHarness(async h => {
        if (completed) assert.equal((await h.apply(h.body)).status, 200);
        if (changed === 'role') h.actor.privileges = 'S';
        if (changed === 'permission') h.permission.update = false;
        if (changed === 'active') h.actor.situation = 'I';
        const before = h.db.state();
        assert.equal((await h.apply(h.body)).status, 403);
        assert.deepEqual(h.db.state(), before);
    });
});
for (const changed of ['employee', 'reference']) test(`replay after a later ${changed} change preserves all inserted identities and rejects stale approval`, async () => {
    await withHarness(async h => {
        assert.equal((await h.apply(h.body)).status, 200);
        if (changed === 'employee') h.db.changeEmployee({ parathrhseis: 'μεταγενέστερη συνθετική μεταβολή' });
        else h.db.addReference(h.initial.completeHistoryRows[0]._id);
        const afterChange = h.db.state();
        assert.equal((await h.apply(h.body)).status, 409);
        assert.deepEqual(h.db.state(), afterChange);
        assert.equal(h.db.events.filter(event => event.type === 'syntheticInsert').length, 2);
    });
});
