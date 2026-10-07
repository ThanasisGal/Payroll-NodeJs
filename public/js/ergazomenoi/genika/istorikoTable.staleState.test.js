'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(__dirname + '/istorikoTable.js', 'utf8');
const expected = 'a'.repeat(64);
const staleMessage = 'Το Ιστορικό άλλαξε. Δεν αποθηκεύτηκε καμία αλλαγή. 1. Ανανεώστε τη σελίδα. 2. Ελέγξτε τα στοιχεία. Κωδικός αναφοράς: EMPLOYEE_HISTORY_EDITOR_STALE';

function browser({ status = 200, result = { success: true }, recover = false, cancelSave = false } = {}) {
    const requests = [], dialogs = [];
    let saveHandler, reloads = 0;
    const children = Array.from({ length: 9 }, () => ({ dataset: {}, textContent: '', innerHTML: '' }));
    const row = { dataset: { state: 'modified', id: 'history-id', original: JSON.stringify({
        hmeromhnia_proslhpshs: '2026-01-01', hmeromhnia_lhxhs_symbashs: '2026-11-30'
    }) }, children, classList: { add() {}, remove() {} },
    querySelector(selector) {
        if (selector === '.istoriko-aa-col') return children[0];
        if (selector.includes('data-field-input')) return null;
        const field = selector.match(/data-field="([^"]+)"/)?.[1];
        return field ? children.find(cell => cell.dataset.field === field) : null;
    } };
    const table = { dataset: { canManageHistory: 'true', expectedStateToken: expected },
        addEventListener() {}, querySelectorAll: () => [row] };
    const document = { addEventListener(event, callback) { assert.equal(event, 'DOMContentLoaded'); callback(); },
        getElementById(id) {
            if (id === 'istorikoTable') return table;
            if (id === 'istorikoEmployeeId') return { value: 'employee-id' };
            if (id === 'updateIstorikoBtn') return { addEventListener(event, callback) { saveHandler = callback; } };
            return null;
        }, querySelector: () => ({ content: 'synthetic-csrf-token' }) };
    vm.runInNewContext(source, { document, Intl, Date,
        window: { location: { reload() { reloads++; } } },
        Swal: { async fire(options) {
            dialogs.push(options);
            if (options.icon === 'question') return { isConfirmed: !cancelSave };
            return { isConfirmed: recover };
        } },
        async fetch(url, options) {
            requests.push({ url, options, body: JSON.parse(options.body) });
            return { status, ok: status < 400, json: async () => result };
        } });
    return { save: () => saveHandler(), requests, dialogs, table, row, reloads: () => reloads };
}

test('actual History save sends the exact rendered expectedStateToken alongside unchanged row updates', async () => {
    const page = browser();
    await page.save();
    assert.equal(page.requests.length, 1);
    const request = page.requests[0];
    assert.equal(request.url, '/ergazomenoi/ergazomenoi/istoriko/update');
    assert.equal(request.body.expectedStateToken, expected);
    assert.deepEqual(Object.keys(request.body).sort(), ['employeeId', 'expectedStateToken', 'updates']);
    assert.equal(request.body.employeeId, 'employee-id');
    assert.equal(request.body.updates[0]._id, 'history-id');
    assert.equal(request.body.updates[0].data.hmeromhnia_lhxhs_symbashs, '2026-11-30');
    assert.equal(page.reloads(), 1);
});

test('stale 409 shows dedicated warning and declining recovery neither reloads nor retries', async () => {
    const page = browser({ status: 409, result: { success: false, reason: 'EMPLOYEE_HISTORY_EDITOR_STALE', message: staleMessage } });
    await page.save();
    assert.equal(page.requests.length, 1); assert.equal(page.reloads(), 0);
    const dialog = page.dialogs[1];
    assert.equal(dialog.icon, 'warning');
    assert.equal(dialog.title, 'Το Ιστορικό χρειάζεται ανανέωση');
    assert.equal(dialog.text, staleMessage);
    assert.equal(dialog.confirmButtonText, 'Ανανέωση σελίδας');
    assert.equal(dialog.showCancelButton, true);
    assert.equal(page.table.dataset.expectedStateToken, expected);
    assert.equal(page.row.dataset.state, 'modified');
    assert.equal(page.dialogs.length, 2);
});

test('explicit stale recovery reloads once and never replays old updates', async () => {
    const page = browser({ status: 409, recover: true,
        result: { success: false, reason: 'EMPLOYEE_HISTORY_EDITOR_STALE', message: staleMessage } });
    await page.save();
    assert.equal(page.reloads(), 1); assert.equal(page.requests.length, 1);
});

test('browser does not silently adopt a replacement token returned by a failed save', async () => {
    const page = browser({ status: 409, result: { success: false, reason: 'EMPLOYEE_HISTORY_EDITOR_STALE',
        message: staleMessage, expectedStateToken: 'b'.repeat(64) } });
    await page.save(); await page.save();
    assert.deepEqual(page.requests.map(request => request.body.expectedStateToken), [expected, expected]);
    assert.equal(page.reloads(), 0);
});

test('other HTTP 409 and server errors preserve the existing generic error behavior', async () => {
    for (const status of [409, 500]) {
        const page = browser({ status, result: { success: false, reason: 'OTHER_ERROR', message: 'Existing failure' } });
        await page.save();
        assert.equal(page.dialogs[1].icon, 'error'); assert.equal(page.dialogs[1].text, 'Existing failure');
        assert.equal(page.reloads(), 0); assert.equal(page.requests.length, 1);
    }
});

test('canceling save makes no request and leaves the page usable', async () => {
    const page = browser({ cancelSave: true }); await page.save();
    assert.equal(page.requests.length, 0); assert.equal(page.reloads(), 0);
});
