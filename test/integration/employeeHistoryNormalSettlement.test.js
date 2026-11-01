'use strict';
const { test, before, after, mock } = require('node:test');
const assert = require('node:assert/strict');
const { forbidRealSettlementMongo } = require('../fixtures/forbidRealSettlementMongo');
const { startSettlementHarness } = require('../fixtures/employeeHistorySettlementHttpHarness');
const { acceptanceBWithInitialGap, typedFixture } = require('../fixtures/employeeHistoryCoordinatedSettlementFixture');
const F = require('../../server/services/ergazomenoi/fixtures/unifiedEmployeeHistorySettlementFixtures');
before(() => forbidRealSettlementMongo(mock));
after(() => mock.restoreAll());
async function harness(work, fixture = acceptanceBWithInitialGap()) {
    const h = await startSettlementHarness({ fixture, realHttp: true, normal: true, enriched: false });
    try {
        const proposal = await (await h.preview()).json();
        assert.equal(proposal.executionMode, 'NORMAL');
        await work(h, { approval: { confirmed: true, fingerprint: proposal.approvalFingerprint } });
    } finally { await h.close(); }
}
test('normal Admin application records one final audit, verifies CLEAN and safely recognizes repetition', async () => {
    await harness(async (h, body) => {
        const response = await h.apply(body), result = await response.json();
        assert.equal(response.status, 200, JSON.stringify(result));
        assert.equal(result.historyStatus, 'CLEAN'); assert.ok(result.corrections.actions.length);
        const after = h.db.state(); assert.equal(after.audits.length, 1);
        assert.equal(after.audits[0].mutationSource, 'EMPLOYEE_HISTORY_SETTLEMENT');
        assert.equal((await (await h.preview()).json()).noOp, true);
        assert.equal((await (await h.apply(body)).json()).alreadyApplied, true);
        assert.deepEqual(h.db.state(), after);
    });
});
for (const changed of ['role', 'permission', 'active', 'company', 'team', 'employee', 'fingerprint', 'current'])
test('normal application rejects changed ' + changed + ' without business writes', async () => {
    await harness(async (h, body) => {
        if (changed === 'role') h.actor.privileges = 'S';
        if (changed === 'permission') h.permission.update = false;
        if (changed === 'active') h.actor.situation = 'I';
        if (changed === 'company') h.session.companyInUse = '720000000000000000000001';
        if (changed === 'team') h.session.userTeam = 'OTHER';
        if (changed === 'fingerprint') body.approval.fingerprint = 'x'.repeat(43);
        if (changed === 'current') h.db.changeEmployee({ parathrhseis: 'Συνθετική αλλαγή' });
        const before = h.db.state(), response = changed === 'employee' ? await fetch(
            h.origin + '/api/ergazomenoi/720000000000000000000002/history-automatic-settlement-apply',
            { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) : await h.apply(body);
        assert.equal(response.status, ['fingerprint', 'current'].includes(changed) ? 409 : 403);
        assert.deepEqual(h.db.state(), before);
    });
});
test('normal CLEAN/noOp does not reserve a receipt or commit a transaction', async () => {
    await harness(async (h, body) => {
        const before = h.db.state();
        for (let i = 0; i < 2; i++) assert.equal((await h.apply(body)).status, 200);
        assert.deepEqual(h.db.state(), before);
        assert.equal(h.db.events.some(event => event.type === 'commit'), false);
    }, typedFixture(F.families.find(f => f.number === 23).make()));
});
test('normal concurrent approval cannot apply twice', async () => {
    await harness(async (h, body) => {
        const responses = await Promise.all([h.apply(body), h.apply(body)]);
        assert.ok(responses.some(response => response.status === 200));
        assert.ok(responses.every(response => [200, 503].includes(response.status)));
        assert.equal(h.db.state().audits.length, 1);
        assert.equal(h.db.events.filter(event => event.type === 'commit').length, 1);
    });
});
for (const fault of ['COMMIT_ACK_LOST', 'COMMIT_UNKNOWN_BEFORE'])
test('normal uncertain ' + fault + ' permits recognition only', async () => {
    await harness(async (h, body) => {
        h.db.failAt(fault);
        const first = await h.apply(body); assert.equal(first.status, 503);
        assert.equal((await first.json()).outcome, 'UNKNOWN');
        const before = h.db.state(), second = await h.apply(body), result = await second.json();
        if (fault === 'COMMIT_ACK_LOST') {
            assert.equal(second.status, 200, JSON.stringify(result)); assert.equal(result.alreadyApplied, true);
        } else {
            assert.equal(second.status, 503, JSON.stringify(result)); assert.equal(result.outcome, 'UNKNOWN');
            assert.match(result.message, /διαχειριστή/);
        }
        assert.deepEqual(h.db.state(), before);
    });
});
