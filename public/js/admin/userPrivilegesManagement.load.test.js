const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, 'userPrivilegesManagement.js'), 'utf8');

function fixture(fetch) {
    const swalCalls = [];
    const consoleErrors = [];
    const elements = Object.fromEntries([
        'userPrivilegesUser', 'userPrivilegesRole', 'userPrivilegesStatus',
        'userPrivilegesTableHead', 'userPrivilegesTableBody', 'userPrivilegesEmpty',
        'userPrivilegesToggleAll', 'userPrivilegesUpdate'
    ].map((id) => [id, {
        dataset: {},
        replaceChildren() {},
        querySelectorAll() { return []; },
        addEventListener(event, handler) { this.handlers ??= {}; this.handlers[event] = handler; },
        setAttribute() {}
    }]));
    const document = {
        addEventListener(event, handler) { if (event === 'DOMContentLoaded') this.ready = handler; },
        getElementById(id) { return elements[id]; },
        querySelector() { return null; }
    };
    const window = {
        Swal: { async fire(...args) { swalCalls.push(args); } },
        showLoader() {}, hideLoader() {},
        setInterval() { return 1; }, clearInterval() {}, setTimeout() {}
    };
    vm.runInNewContext(source, {
        document, window, fetch, encodeURIComponent,
        console: { error(...args) { consoleErrors.push(args); } }
    }, { filename: 'userPrivilegesManagement.js' });
    document.ready();
    return { api: window.UserPrivilegesManagement, elements, swalCalls, consoleErrors };
}

test('failed privilege GET shows inline status without Swal', async () => {
    const f = fixture(async () => ({ ok: false, json: async () => ({ message: 'Παρουσιάστηκε σφάλμα κατά την επεξεργασία' }) }));
    await f.api.loadUser('user-1');
    assert.equal(f.elements.userPrivilegesStatus.textContent, 'Δεν ήταν δυνατή η φόρτωση των δικαιωμάτων.');
    assert.equal(f.api.getState().loaded, false);
    assert.equal(f.api.getState().loading, false);
    assert.equal(f.swalCalls.length, 0);
    assert.equal(f.consoleErrors.length, 1);
});

test('stale failed GET cannot overwrite the current selection', async () => {
    let rejectOld;
    const f = fixture((url) => url.endsWith('/old')
        ? new Promise((resolve, reject) => { rejectOld = reject; })
        : Promise.resolve({ ok: false, json: async () => ({ message: 'new failure' }) }));
    const oldRequest = f.api.loadUser('old');
    await f.api.loadUser('new');
    const status = f.elements.userPrivilegesStatus.textContent;
    rejectOld(new Error('stale failure'));
    await oldRequest;
    assert.equal(f.api.getState().userId, 'new');
    assert.equal(f.elements.userPrivilegesStatus.textContent, status);
    assert.equal(f.consoleErrors.length, 1);
    assert.equal(f.swalCalls.length, 0);
});

test('save keeps success and failure Swal messages', async () => {
    let putSucceeds = true;
    const f = fixture(async (url, options) => options?.method === 'PUT'
        ? { ok: putSucceeds, json: async () => ({ message: putSucceeds ? 'Ενημερώθηκαν' : 'Αποτυχία ενημέρωσης' }) }
        : { ok: true, json: async () => ({ columns: [], rows: [], user: {} }) });
    await f.api.loadUser('user-1');
    await f.elements.userPrivilegesUpdate.handlers.click();
    assert.deepEqual(Array.from(f.swalCalls[0]), ['Επιτυχία', 'Ενημερώθηκαν', 'success']);
    putSucceeds = false;
    await f.elements.userPrivilegesUpdate.handlers.click();
    assert.deepEqual(Array.from(f.swalCalls[1]), ['Σφάλμα', 'Αποτυχία ενημέρωσης', 'error']);
});
