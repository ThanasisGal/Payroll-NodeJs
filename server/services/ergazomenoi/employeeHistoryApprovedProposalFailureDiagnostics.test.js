'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const D = require('./employeeHistoryApprovedProposalFailureDiagnostics');
const { createEmployeeHistoryApprovedProposalController } = require('../../controllers/ergazomenoi/employeeHistoryApprovedProposalController');
function response() {
    return { headers: {}, statusCode: 200, set(key, value) { this.headers[key] = value; return this; },
        status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}
test('Ασφαλής πρωτογενής εξαίρεση: στάδιο, συσχέτιση και θέσεις κώδικα χωρίς περιεχόμενο ή προσωπικά στοιχεία', () => {
    const privateValue = 'PRIVATE_PAYLOAD_SECRET_TOKEN_EMPLOYEE';
    const original = Object.assign(new TypeError(privateValue), { code: 'ERR_INVALID_ARG_TYPE',
        errorLabels: ['TransientTransactionError', privateValue] });
    original.stack = `TypeError: ${privateValue}\n    at privateFunction (${path.join(__dirname, 'employeeHistoryApprovedProposalService.js')}:240:12)\n    at ${privateValue} (/home/private/person.js:1:2)`;
    D.capture(original, 'EXECUTE_WRITER');
    const translated = D.translate(Object.assign(new Error('generic'), { reason: 'TRANSACTION_FAILED' }), original);
    const records = [], correlation = D.logFailure({ error(event, record) { records.push({ event, ...record }); } },
        { id: 'f3cfbf86-e1e2-4dd9-80af-1eeb296222d1', body: { token: privateValue }, session: { userId: privateValue } }, 'apply', translated);
    assert.equal(correlation, 'f3cfbf86-e1e2-4dd9-80af-1eeb296222d1');
    assert.equal(records[0].name, 'TypeError'); assert.equal(records[0].code, 'ERR_INVALID_ARG_TYPE');
    assert.equal(records[0].transactionStage, 'EXECUTE_WRITER');
    assert.deepEqual(records[0].errorLabels, ['TransientTransactionError']);
    assert.equal(records[0].stack, 'at server/services/ergazomenoi/employeeHistoryApprovedProposalService.js:240:12');
    assert.equal(JSON.stringify(records).includes(privateValue), false);
    assert.equal(JSON.stringify(records).includes('/home/'), false);
});
test('Ο controller καταγράφει την πρωτογενή εξαίρεση πριν από το γενικό TRANSACTION_FAILED', async () => {
    const records = [], error = D.capture(Object.assign(new Error('private document'), { name: 'MongoServerError', code: 13 }), 'AUDIT_STORAGE');
    const controller = createEmployeeHistoryApprovedProposalController({ service: { async apply() { throw error; } },
        logger: { error(event, record) { records.push({ event, ...record }); } } });
    const res = response(); await controller.apply({ body: {} }, res);
    assert.equal(records[0].code, 13); assert.equal(records[0].transactionStage, 'AUDIT_STORAGE');
    assert.equal(res.headers['X-Request-Id'], records[0].correlationId);
    assert.equal(res.body.code, 'EMPLOYEE_HISTORY_APPROVED_XLSX_APPLY_TRANSACTION_FAILED');
    assert.equal(res.body.outcome, 'UNKNOWN'); assert.equal(res.body.saved, null);
    assert.equal(JSON.stringify(records).includes('private document'), false);
});
test('Αβέβαιο commit και απουσία αποδεικτικού reconcile διατηρούνται UNKNOWN', async () => {
    const original = Object.assign(new Error('private server details'), { name: 'MongoServerError', code: 91,
        errorLabels: ['UnknownTransactionCommitResult'] });
    const wrapped = D.translate(Object.assign(new Error('COMMIT_UNCERTAIN'), { reason: 'COMMIT_UNCERTAIN', statusCode: 503 }),
        D.capture(original, 'TRANSACTION_COMMIT'));
    const records = [], controller = createEmployeeHistoryApprovedProposalController({
        service: { async apply() { throw wrapped; }, async reconcile() { throw Object.assign(new Error(), { reason: 'COMMIT_UNCERTAIN', statusCode: 503 }); } },
        logger: { error(event, record) { records.push(record); } } });
    const apply = response(); await controller.apply({ body: {} }, apply);
    assert.equal(apply.body.outcome, 'UNKNOWN'); assert.equal(apply.body.saved, null);
    assert.equal(records[0].code, 91); assert.deepEqual(records[0].errorLabels, ['UnknownTransactionCommitResult']);
    assert.equal(records[0].transactionStage, 'TRANSACTION_COMMIT');
    const reconcile = response(); await controller.reconcile({ body: {} }, reconcile);
    assert.equal(reconcile.body.outcome, 'UNKNOWN'); assert.equal(reconcile.body.saved, null);
});
test('Αποτυχία καταγραφής δεν αλλάζει την πρωτογενή απόκριση', async () => {
    const controller = createEmployeeHistoryApprovedProposalController({ service: { async apply() { throw Object.assign(new Error(), { reason: 'STALE', statusCode: 409 }); } },
        logger: { error() { throw Error('log unavailable'); } } });
    const res = response(); await controller.apply({ body: {} }, res);
    assert.equal(res.body.code, 'EMPLOYEE_HISTORY_APPROVED_XLSX_APPLY_STALE');
    assert.equal(res.body.saved, false); assert.equal(res.body.outcome, 'REJECTED');
});
