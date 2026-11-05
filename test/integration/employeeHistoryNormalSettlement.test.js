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
        const result = await response.json();
        const changedContext = ['company', 'team', 'employee', 'fingerprint'].includes(changed);
        assert.equal(response.status, changedContext || changed === 'current' ? 409 : 403);
        if (changedContext) assert.equal(result.code, 'EMPLOYEE_HISTORY_SETTLEMENT_BROWSER_APPROVAL_CONTEXT_CHANGED');
        if (['permission', 'active'].includes(changed)) assert.equal(result.code, 'EMPLOYEE_HISTORY_MANAGEMENT_FORBIDDEN');
        if (changed === 'role') assert.equal(result.code, 'EMPLOYEE_HISTORY_SETTLEMENT_REJECTED');
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
        assert.equal((await first.json()).outcome, 'BLOCKED');
        const before = h.db.state(), second = await h.apply(body), result = await second.json();
        if (fault === 'COMMIT_ACK_LOST') {
            assert.equal(second.status, 200, JSON.stringify(result)); assert.equal(result.alreadyApplied, true);
        } else {
            assert.equal(second.status, 503, JSON.stringify(result)); assert.equal(result.outcome, 'BLOCKED');
            assert.match(result.message, /διαχειριστή/);
        }
        assert.deepEqual(h.db.state(), before);
    });
});
for (const fault of [null, 'COMMIT_ACK_LOST', 'COMMIT_UNKNOWN_BEFORE'])
test('normal read-only confirmation after ' + (fault || 'successful commit') + ' never applies again', async () => {
    await harness(async (h, body) => {
        if (fault) h.db.failAt(fault);
        await h.apply(body);
        const before = h.db.state(), protocol = h.db.protocolState();
        const writes = () => h.db.events.filter(event => ['write', 'fence', 'syntheticInsert'].includes(event.type)).length;
        const writeCount = writes();
        const W = require('../../server/services/ergazomenoi/employeeEmploymentProfileWriter');
        const guard = mock.method(W, 'applyEmployeeEmploymentHistorySettlementInSyntheticStore', () => assert.fail('confirmation must never invoke Apply'));
        try {
            for (const response of await Promise.all([h.confirm(body), h.confirm(body)])) {
                const result = await response.json();
                if (fault === 'COMMIT_UNKNOWN_BEFORE') {
                    assert.equal(response.status, 503); assert.equal(result.outcome, 'BLOCKED');
                    assert.equal(result.retryWithSameApproval, false);
                } else {
                    assert.equal(response.status, 200, JSON.stringify(result));
                    assert.equal(result.outcome, 'COMMITTED'); assert.equal(result.noOp, true);
                    assert.equal(result.reconciledReadOnly, true); assert.equal(result.executionEnabled, false);
                    assert.equal(result.approvalFingerprint, body.approval.fingerprint);
                    assert.equal(result.auditId, String(before.audits[0]._id));
                    assert.ok(result.corrections.actions.length);
                }
            }
        } finally { guard.mock.restore(); }
        assert.equal(h.requests.length, 1); assert.equal(writes(), writeCount);
        assert.deepEqual(h.db.state(), before); assert.deepEqual(h.db.protocolState(), protocol);
    });
});
test('normal CLEAN history alone cannot prove the requested commit', async () => {
    await harness(async (h, body) => {
        const before = h.db.state();
        const response = await h.confirm(body);
        assert.equal(response.status, 503); assert.equal((await response.json()).outcome, 'BLOCKED');
        assert.deepEqual(h.db.state(), before); assert.equal(h.requests.length, 0);
    }, typedFixture(F.families.find(f => f.number === 23).make()));
});
for (const changed of ['current', 'history', 'references', 'permission', 'role', 'session', 'company', 'team', 'actor', 'fingerprint', 'request', 'terminal'])
test('normal confirmation rejects changed ' + changed + ' without writes', async () => {
    await harness(async (h, body) => {
        assert.equal((await h.apply(body)).status, 200);
        if (changed === 'current') h.db.changeEmployee({ parathrhseis: 'Συνθετική μεταγενέστερη αλλαγή' });
        if (changed === 'history') h.db.changeHistory(String(h.db.state().history[0]._id), { parathrhseis: 'Συνθετική αλλαγή' });
        if (changed === 'references') h.db.addReference(String(h.db.state().history[0]._id));
        if (changed === 'permission') h.permission.update = false;
        if (changed === 'role') h.actor.privileges = 'S';
        if (changed === 'session') h.sessionIdentity.id = 'different-synthetic-session';
        if (changed === 'company') h.session.companyInUse = '720000000000000000000002';
        if (changed === 'team') h.session.userTeam = 'OTHER';
        if (changed === 'actor') h.session.userId = '720000000000000000000003';
        if (changed === 'fingerprint') body.approval.fingerprint = 'x'.repeat(43);
        if (changed === 'request') body.extra = true;
        if (changed === 'terminal') h.db.failAt('COMMIT_EVIDENCE_MISSING');
        const before = h.db.state(), protocol = h.db.protocolState();
        const response = await h.confirm(body), result = await response.json();
        assert.equal(response.status, 503); assert.equal(result.outcome, 'BLOCKED');
        assert.equal(result.retryWithSameApproval, false);
        assert.deepEqual(h.db.state(), before); assert.deepEqual(h.db.protocolState(), protocol);
        assert.equal(h.requests.length, 1);
    });
});
