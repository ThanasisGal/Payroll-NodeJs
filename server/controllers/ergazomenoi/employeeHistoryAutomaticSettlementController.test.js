'use strict';
const { test, before, after, mock } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const express = require('express');
const { once } = require('node:events');
const mongoose = require('mongoose');
const { createEmployeeHistoryAutomaticSettlementController: create } = require('./employeeHistoryAutomaticSettlementController');
const { registerEmployeeHistorySettlementRoutes: register } = require('../../routes/employeeHistorySettlementRoutes');
const checkAuth = require('../../middlewares/checkValidUser');
const { forbidRealSettlementMongo } = require('../../../test/fixtures/forbidRealSettlementMongo');
const { startSettlementHarness } = require('../../../test/fixtures/employeeHistorySettlementHttpHarness');
before(() => forbidRealSettlementMongo(mock));
after(() => mock.restoreAll());

test('real application apply is unconditionally closed before request reads or MongoDB access', () => {
    const controller = create();
    const req = new Proxy({}, { get() { assert.fail('disabled apply must not inspect requests or look up data'); } });
    const res = { set() { return this; }, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
    controller.apply(req, res);
    assert.equal(res.code, 423);
    assert.equal(res.body.executionEnabled, false);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /δεν αποθηκεύτηκε καμία αλλαγή.*1\..*2\..*ΙΣΤ-ΑΥΤ-4Α/s);
    assert.equal(mongoose.connection.readyState, 0);
});
test('connections, model overrides, flags and unissued synthetic capabilities cannot open the boundary', () => {
    for (const options of [{ connection: mongoose.connection }, { executionEnabled: true }, { writer() {} },
        { syntheticStore: {} }, { syntheticStore: mongoose.connection }, { syntheticStore: null }]) {
        assert.throws(() => create(options));
    }
});
test('the registered application POST rejects forged activation without invoking database permission middleware', async () => {
    const app = express(); app.use(express.json());
    app.use((req, res, next) => { req.session = { userId: 'synthetic' }; next(); });
    register(app, { checkAuth, requireUserPrivilegeAction: () => () => assert.fail('apply must block before DB-backed rights lookup') });
    const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
    try {
        for (const body of [{}, { executionEnabled: true, syntheticStore: {}, privileges: 'A' },
            { approval: { confirmed: true, fingerprint: 'x'.repeat(43) }, executionMode: 'SYNTHETIC_ONLY' }]) {
            const response = await fetch(`http://127.0.0.1:${server.address().port}/api/ergazomenoi/700000000000000000000006/history-automatic-settlement-apply`,
                { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            assert.equal(response.status, 423);
            assert.equal((await response.json()).executionEnabled, false);
        }
    } finally { await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }); }
});
test('normal routes use the shared closed boundary and never register the synthetic controller directly', () => {
    const source = fs.readFileSync(__dirname + '/../../routes/usersRoute.js', 'utf8');
    assert.match(source, /registerEmployeeHistorySettlementRoutes\(router, \{ checkAuth, requireUserPrivilegeAction \}\)/);
    assert.doesNotMatch(source, /employeeHistoryAutomaticSettlementSyntheticController/);
});
for (const fault of ['WRITE', 'AUDIT', 'FINAL']) test(`shared route ${fault} rolls the entire synthetic transaction back`, async () => {
    const h = await startSettlementHarness();
    try {
        const preview = await (await h.preview()).json(), before = h.db.state();
        h.db.failAt(fault);
        const response = await h.apply({ approval: { confirmed: true, fingerprint: preview.approvalFingerprint } });
        assert.notEqual(response.status, 200);
        assert.deepEqual(h.db.state(), before);
    } finally { await h.close(); }
});
test('shared route rechecks Supervisor scope and preserves finalized references on exact repetition', async () => {
    const h = await startSettlementHarness({ actor: { _id: '700000000000000000000001', situation: 'A', privileges: 'S', team: 'TEST' }, recordedCoverage: true });
    try {
        const preview = await (await h.preview()).json(), before = h.db.state();
        const approval = { confirmed: true, fingerprint: preview.approvalFingerprint };
        assert.equal((await (await h.apply({ approval })).json()).historyStatus, 'CLEAN');
        const committed = h.db.state();
        assert.deepEqual(committed.references, before.references);
        assert.equal((await (await h.apply({ approval })).json()).alreadyApplied, true);
        assert.deepEqual(h.db.state(), committed);
    } finally { await h.close(); }
});
