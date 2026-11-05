'use strict';
const { test, before, after, mock } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { forbidRealSettlementMongo } = require('../fixtures/forbidRealSettlementMongo');
const { startSettlementHarness } = require('../fixtures/employeeHistorySettlementHttpHarness');
const { acceptanceBWithInitialGap } = require('../fixtures/employeeHistoryCoordinatedSettlementFixture');
const W = require('../../server/services/ergazomenoi/employeeEmploymentProfileWriter');
before(() => forbidRealSettlementMongo(mock));
after(() => mock.restoreAll());
async function run(work, options = {}) {
    const h = await startSettlementHarness({ fixture: acceptanceBWithInitialGap(), enriched: false, realHttp: true, normal: true, ...options });
    try {
        const preview = await (await h.preview()).json();
        const body = { approval: { confirmed: true, fingerprint: preview.approvalFingerprint } };
        await work(h, body, preview);
    } finally { await h.close(); }
}
const blocked = async response => {
    const value = await response.json();
    assert.equal(response.status, 503, JSON.stringify(value));
    assert.equal(value.outcome, 'BLOCKED'); assert.equal(value.retryWithSameApproval, false);
    return value;
};
test('same execution/session: committed acknowledgement loss is confirmed read-only with one durable owner', async () => {
    await run(async (h, body) => {
        h.db.failAt('COMMIT_ACK_LOST'); await blocked(await h.apply(body));
        const before = h.db.state(), evidence = h.db.protocolState();
        const saved = before.audits[0].diagnostics.normalExecution;
        assert.equal(saved.requestId, h.executionHeaders(body)['X-Employee-Settlement-Attempt']);
        assert.equal(saved.claimId, evidence.attempts[0].diagnostics.claimId);
        const guard = mock.method(W, 'applyEmployeeEmploymentHistorySettlementInSyntheticStore', () => assert.fail('read-only confirmation must not Apply'));
        try {
            const results = await Promise.all(Array.from({ length: 4 }, () => h.confirm(body)));
            for (const response of results) {
                assert.equal(response.status, 200); const result = await response.json();
                assert.equal(result.outcome, 'COMMITTED'); assert.equal(result.requestId, saved.requestId);
            }
        } finally { guard.mock.restore(); }
        assert.equal(h.requests.length, 1); assert.deepEqual(h.db.state(), before);
        assert.deepEqual(h.db.protocolState(), evidence);
    });
});
test('session B with independently issued valid context and same actor/fingerprint cannot claim session A commit, even with A requestId', async () => {
    await run(async (h, bodyA, previewA) => {
        const headersA = h.executionHeaders(bodyA);
        h.sessionIdentity.id = 'independent-session-B';
        const previewB = await (await h.preview()).json(), bodyB = structuredClone(bodyA);
        assert.equal(previewB.approvalFingerprint, previewA.approvalFingerprint);
        assert.notEqual(previewB.browserApprovalContext, previewA.browserApprovalContext);
        const headersB = h.executionHeaders(bodyB);
        h.sessionIdentity.id = 'isolated-browser-session-1';
        h.db.failAt('COMMIT_ACK_LOST'); await blocked(await h.apply(bodyA, headersA));
        const before = h.db.state(), evidence = h.db.protocolState();
        h.sessionIdentity.id = 'independent-session-B';
        await blocked(await h.confirm(bodyB, headersB));
        await blocked(await h.confirm(bodyB, { ...headersB, 'X-Employee-Settlement-Attempt': headersA['X-Employee-Settlement-Attempt'] }));
        await blocked(await h.apply(bodyB, headersB));
        h.sessionIdentity.id = 'isolated-browser-session-1';
        assert.equal((await h.confirm(bodyA, headersA)).status, 200);
        assert.deepEqual(h.db.state(), before); assert.deepEqual(h.db.protocolState(), evidence);
        assert.equal(before.audits.length, 1);
    });
});
test('same session with another Apply identity cannot recognize or replay the committed attempt', async () => {
    await run(async (h, body) => {
        assert.equal((await h.apply(body)).status, 200);
        const before = h.db.state(), evidence = h.db.protocolState();
        const other = { 'X-Employee-Settlement-Attempt': randomUUID() };
        await blocked(await h.confirm(body, other)); await blocked(await h.apply(body, other));
        assert.equal((await h.confirm(body)).status, 200);
        assert.deepEqual(h.db.state(), before); assert.deepEqual(h.db.protocolState(), evidence);
    });
});
test('concurrent different Apply identities commit once and only the actual owner can confirm', async () => {
    await run(async (h, body) => {
        const first = randomUUID(), second = randomUUID();
        const results = await Promise.all([h.apply(body, { 'X-Employee-Settlement-Attempt': first }),
            h.apply(body, { 'X-Employee-Settlement-Attempt': second })]);
        assert.deepEqual(results.map(response => response.status).sort(), [200, 503]);
        const before = h.db.state(), evidence = h.db.protocolState();
        assert.equal(before.audits.length, 1); assert.equal(evidence.attempts.length, 1);
        assert.equal(h.db.events.filter(event => event.type === 'commit').length, 1);
        const owner = before.audits[0].diagnostics.normalExecution.requestId;
        const loser = owner === first ? second : first;
        const confirmations = await Promise.all([h.confirm(body, { 'X-Employee-Settlement-Attempt': owner }),
            h.confirm(body, { 'X-Employee-Settlement-Attempt': loser })]);
        assert.equal(confirmations[0].status, 200); await blocked(confirmations[1]);
        assert.deepEqual(h.db.state(), before); assert.deepEqual(h.db.protocolState(), evidence);
        assert.equal(h.requests.length, 2);
    });
});
test('historical committed audit without original execution binding is never backfilled or confirmed', async () => {
    await run(async (h, body) => {
        await W.applyEmployeeEmploymentHistorySettlementInSyntheticStore({ syntheticStore: h.db.handle,
            scope: h.initial.scope, employeeId: h.initial.employeeId, actorUserId: h.initial.actorUserId,
            approval: body.approval, coordinated: true });
        const before = h.db.state(), evidence = h.db.protocolState();
        assert.equal(before.audits[0].diagnostics.normalExecution, undefined);
        await blocked(await h.confirm(body));
        assert.deepEqual(h.db.state(), before); assert.deepEqual(h.db.protocolState(), evidence);
        assert.equal(h.requests.length, 0);
    });
});
for (const fault of ['COMMIT_UNKNOWN_BEFORE', 'EXECUTION_OWNER_MISSING', 'REFERENCES'])
test('missing original evidence or truly uncertain commit stays blocked: ' + fault, async () => {
    await run(async (h, body) => {
        if (fault === 'COMMIT_UNKNOWN_BEFORE') h.db.failAt(fault);
        await h.apply(body);
        if (fault !== 'COMMIT_UNKNOWN_BEFORE') h.db.failAt(fault);
        const before = h.db.state(), evidence = h.db.protocolState();
        await blocked(await h.confirm(body));
        assert.deepEqual(h.db.state(), before); assert.deepEqual(h.db.protocolState(), evidence);
        assert.equal(h.requests.length, 1);
    });
});
test('BSON v2 evidence survives confirmation exactly; changed protected BSON payload is rejected', async () => {
    await run(async (h, body) => {
        h.db.failAt('COMMIT_ACK_LOST'); const outcome = await blocked(await h.apply(body));
        const before = h.db.state(); assert.equal(before.audits.length, 1, JSON.stringify(outcome));
        const summary = before.audits[0].diagnostics.protectedReferences;
        assert.equal(summary.referenceEvidenceContract, 'employee-history-settlement-reference-evidence:v2');
        assert.ok(Object.values(summary).filter(Array.isArray).flat().every(ref => /^[a-f0-9]{64}$/.test(ref.bsonSha256)));
        assert.ok(Object.values(summary).filter(Array.isArray).flat().length > 0);
        assert.ok(Object.values(summary).filter(Array.isArray).some(refs => refs.length > 1));
        assert.equal((await h.confirm(body)).status, 200); assert.deepEqual(h.db.state(), before);
        h.db.changeReferencePayload(); const changed = h.db.state();
        await blocked(await h.confirm(body)); assert.deepEqual(h.db.state(), changed);
    }, { referenceEvidenceV2: true });
});
test('confirmation uses actual application CSRF middleware, authentication and current authorization', async () => {
    await run(async (h, body) => {
        assert.equal((await h.apply(body)).status, 200);
        const before = h.db.state(), url = h.origin + '/api/ergazomenoi/' + h.initial.employeeId + '/history-automatic-settlement-confirm';
        for (const extra of [{ 'X-CSRF-Token': '' }, { 'X-CSRF-Token': 'wrong' }, { Cookie: '' }])
            assert.equal((await h.confirm(body, extra)).status, 403);
        assert.equal((await h.confirm(body)).status, 200);
        const actor = h.session.userId; delete h.session.userId;
        const unauthenticated = await fetch(url, { method: 'POST', redirect: 'manual', headers: h.executionHeaders(body), body: JSON.stringify(body) });
        assert.equal(unauthenticated.status, 302); assert.equal(unauthenticated.headers.get('location'), '/login');
        h.session.userId = actor; h.permission.update = false;
        await blocked(await h.confirm(body));
        assert.deepEqual(h.db.state(), before);
    }, { csrf: true });
});
