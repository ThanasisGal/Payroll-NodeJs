'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(__dirname + '/employeeHistoryLegacyFenceActivation.js', 'utf8');
function policy(flag) {
    const context = { require() { throw Error('Unexpected database dependency'); }, module: { exports: {} },
        process: { env: { PAYROLL_EMPLOYEE_HISTORY_LEGACY_FENCE_ENABLED: flag,
            PAYROLL_EMPLOYEE_HISTORY_SETTLEMENT_ENABLED: 'true', PAYROLL_EMPLOYEE_HISTORY_SETTLEMENT_RECOVERY_ENABLED: 'true' }, argv: ['node', 'app.js'] } };
    vm.runInNewContext(source, context); return context;
}
for (const value of [undefined, '', 'false', 'TRUE', '1', true]) test('independent fence flag remains off for ' + String(value), () => {
    const p = policy(value), server = { listening: true, address: () => ({ port: 3000 }) };
    assert.equal(p.module.exports.initialize({ server }), false);
    p.process.env.PAYROLL_EMPLOYEE_HISTORY_LEGACY_FENCE_ENABLED = 'true';
    assert.equal(p.module.exports.initialize({ server }), false);
    assert.equal(p.module.exports.contextFor({ socket: { server }, body: { enabled: true } }), null);
});
for (const port of [5000, 5025]) test('fence activation rejects protected port ' + port, () => {
    assert.equal(policy('true').module.exports.initialize({ server: { listening: true, address: () => ({ port }) } }), false);
});
test('closed HTTP endpoints return BLOCKED before all identity or database access', async () => {
    const api = require('../../controllers/ergazomenoi/employeeHistoryLegacyFenceController').createEmployeeHistoryLegacyFenceController({ contextProvider: () => null });
    for (const action of ['preview', 'apply']) {
        const res = { set() {}, status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; return this; } };
        await api[action]({ body: { enabled: true } }, res);
        assert.equal(res.statusCode, 423); assert.equal(res.body.outcome, 'BLOCKED'); assert.equal(res.body.autoSettlement, false);
    }
});

test('independent activation binds only its listening server and closes with it', () => {
    const { EventEmitter } = require('node:events');
    const p = policy('true');
    p.require = name => name === 'mongoose' ? { connection: {} } : {};
    const server = Object.assign(new EventEmitter(), { listening: true, address: () => ({ port: 3000 }) });
    assert.equal(p.module.exports.initialize({ server }), true);
    assert.equal(p.module.exports.contextFor({ socket: { server } }).legacyFenceEnabled, true);
    assert.equal(p.module.exports.contextFor({ socket: { server: {} } }), null);
    server.listening = false; server.emit('close');
    assert.equal(p.module.exports.contextFor({ socket: { server } }), null);
});
