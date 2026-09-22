const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, 'disconnectUsers.js'), 'utf8');

function fixture({ confirmed, response }) {
    const calls = [], alerts = [], navigations = [];
    const option = { dataset: { name: 'Επώνυμο Όνομα' }, textContent: 'label' };
    const select = { value: 'target-id', selectedOptions: [option] };
    const button = { disabled: false };
    const status = { textContent: '' };
    const form = { addEventListener(event, handler) { this.handler = handler; },
        querySelector() { return { value: 'csrf-token' }; } };
    const elements = { disconnectUsersForm: form, disconnectUsersTarget: select,
        disconnectUsersSubmit: button, disconnectUsersStatus: status };
    const document = { addEventListener(event, handler) { this.ready = handler; },
        getElementById(id) { return elements[id]; } };
    const location = { reload() { calls.push('reload'); },
        replace(url) { navigations.push(url); }, set href(url) { navigations.push(url); } };
    const window = { Swal: { async fire(...args) { alerts.push(args); return { isConfirmed: confirmed }; } },
        get location() { return location; }, set location(url) { navigations.push(url); } };
    vm.runInNewContext(source, { document, window, fetch: async (...args) => {
        calls.push(args);
        return response;
    }, console: { error() {} }, JSON }, { filename: 'disconnectUsers.js' });
    document.ready();
    return { form, button, status, calls, alerts, navigations };
}

test('cancelled confirmation does not send a POST', async () => {
    const f = fixture({ confirmed: false });
    await f.form.handler({ preventDefault() {} });
    assert.equal(f.calls.length, 0);
    assert.deepEqual(f.navigations, []);
    assert.match(f.alerts[0][0].text, /Επώνυμο Όνομα/);
});

test('confirmed logout submits CSRF token and refreshes the dropdown after success', async () => {
    const f = fixture({ confirmed: true, response: { ok: true,
        json: async () => ({ success: true, destroyedSessions: 2, message: 'Ο χρήστης αποσυνδέθηκε επιτυχώς.' }) } });
    await f.form.handler({ preventDefault() {} });
    assert.equal(f.calls[0][0], '/admin/disconnect-users');
    assert.equal(f.calls[0][1].method, 'POST');
    assert.equal(f.calls[0][1].headers['X-CSRF-Token'], 'csrf-token');
    assert.equal(f.status.textContent, 'Ο χρήστης αποσυνδέθηκε επιτυχώς.');
    assert.equal(f.calls[1], 'reload');
    assert.equal(f.calls.filter((call) => call === 'reload').length, 1);
    assert.deepEqual(f.navigations, []);
});

test('failed request exposes only a safe message', async () => {
    const f = fixture({ confirmed: true, response: { ok: false,
        json: async () => ({ message: 'raw database error' }) } });
    await f.form.handler({ preventDefault() {} });
    assert.equal(f.status.textContent, 'Η αποσύνδεση δεν ολοκληρώθηκε. Δοκιμάστε ξανά.');
    assert.equal(f.button.disabled, false);
    assert.equal(f.calls.filter((call) => call === 'reload').length, 0);
    assert.deepEqual(f.navigations, []);
    assert.ok(!JSON.stringify(f.alerts).includes('raw database error'));
});

test('return button points to mainapp, not admin', () => {
    const ejs = fs.readFileSync(path.join(__dirname, '../../../views/admin/disconnectUsers.ejs'), 'utf8');
    assert.match(ejs, /<a href="\/mainapp"[^>]*>Επιστροφή<\/a>/);
    assert.doesNotMatch(ejs, /<a href="\/admin"[^>]*>Επιστροφή<\/a>/);
});
