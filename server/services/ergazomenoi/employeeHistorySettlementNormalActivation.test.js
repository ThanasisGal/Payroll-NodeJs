'use strict';
const { test, before, after, mock } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const { forbidRealSettlementMongo } = require('../../../test/fixtures/forbidRealSettlementMongo');
const source = fs.readFileSync(__dirname + '/employeeHistorySettlementNormalActivation.js', 'utf8');
before(() => forbidRealSettlementMongo(mock)); after(() => mock.restoreAll());
function policy(value, argv = ['node', 'app.js']) {
    const context = { require, module: { exports: {} }, process: {
        env: { PAYROLL_EMPLOYEE_HISTORY_SETTLEMENT_ENABLED: value }, argv } };
    vm.runInNewContext(source, context);
    return { api: context.module.exports, environment: context.process.env };
}
function server(port = 5000) {
    return Object.assign(new EventEmitter(), { listening: true, address: () => ({ port }) });
}
for (const value of [undefined, '', 'false', 'TRUE', '1', true])
test('normal activation stays closed for ' + String(value), () => {
    const p = policy(value), s = server();
    assert.equal(p.api.initializeEmployeeHistorySettlementNormal({ server: s, enabled: true }), false);
    assert.equal(p.api.getEmployeeHistorySettlementNormalHandle({ socket: { server: s },
        body: { enabled: true }, query: { enabled: true }, headers: { enabled: 'true' } }), null);
    p.environment.PAYROLL_EMPLOYEE_HISTORY_SETTLEMENT_ENABLED = 'true';
    assert.equal(p.api.initializeEmployeeHistorySettlementNormal({ server: s }), false);
});
test('only exact true captured at startup issues a handle bound to the listening server', () => {
    const p = policy('true'), s = server();
    assert.equal(p.api.initializeEmployeeHistorySettlementNormal({ server: s }), true);
    const handle = p.api.getEmployeeHistorySettlementNormalHandle({ socket: { server: s } });
    assert.ok(handle); assert.equal(p.api.normalSettlementContext(handle).mode, 'NORMAL');
    assert.equal(p.api.getEmployeeHistorySettlementNormalHandle({ socket: { server: server() } }), null);
    assert.equal(p.api.normalSettlementContext({}), undefined);
    s.listening = false; s.emit('close');
    assert.equal(p.api.getEmployeeHistorySettlementNormalHandle({ socket: { server: s } }), null);
});
test('normal activation does not alter TEST 5025 or pilot invocations', () => {
    assert.equal(policy('true').api.initializeEmployeeHistorySettlementNormal({ server: server(5025) }), false);
    assert.equal(policy('true', ['node', 'app.js', '--employee-history-settlement-dev=x'])
        .api.initializeEmployeeHistorySettlementNormal({ server: server() }), false);
});

test('durable receipt permits only internal transaction retry and rejects another request owner', async () => {
    const receipts = new Map();
    const auditModel = { async create([record], options) {
        assert.equal(options.session, null); assert.equal(options.writeConcern.w, 'majority');
        if (receipts.has(record._id)) throw Object.assign(Error('duplicate'), { code: 11000 });
        receipts.set(record._id, record); return [record];
    }, findById(id) { return { session(value) { assert.equal(value, null); return this; },
        read(value) { assert.equal(value, 'primary'); return this; },
        readConcern(value) { assert.equal(value, 'majority'); return this; }, async lean() { return receipts.get(id); } }; } };
    const claim = require('./employeeHistorySettlementNormalActivation').claimNormalSettlementAttempt;
    const input = { auditModel, scope: { team: 'THA', company_kod: 'company', kodikos: 'synthetic' },
        employeeId: 'employee', actorUserId: 'actor', fingerprint: 'x'.repeat(43), claimId: 'first-invocation',
        currentEmployee: { _id: 'employee' }, completeHistoryRows: [] };
    await claim(input); await claim(input); assert.equal(receipts.size, 1);
    await assert.rejects(() => claim({ ...input, claimId: 'second-invocation' }), { statusCode: 503 });
    assert.equal(receipts.size, 1);
});
