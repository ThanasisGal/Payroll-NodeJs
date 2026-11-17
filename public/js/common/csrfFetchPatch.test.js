'use strict';
const { test } = require('node:test'), assert = require('node:assert/strict');
const vm = require('node:vm'), fs = require('node:fs');
const source = fs.readFileSync(__dirname + '/csrfFetchPatch.js', 'utf8');
function harness() {
    const calls = [], window = { fetch: async (input, init) => {
        calls.push({ input, init }); return new Response(JSON.stringify({ code: 'CSRF_TOKEN_INVALID', error: 'CSRF validation failed', message: 'Invalid or missing CSRF token' }), { status: 403 });
    } };
    vm.runInNewContext(source, { window, document: { querySelector: () => ({ getAttribute: () => 'private-tab-token' }) },
        location: { href: 'https://payroll.example/editor', origin: 'https://payroll.example' }, URL, Request, Headers });
    return { window, calls };
}
for (const suffix of ['apply', 'apply-preview', 'apply-reconcile', 'certification-preview', 'import-preview', 'xlsx'])
    test(`Ο καθολικός χειριστής δεν επαναλαμβάνει αυτόνομα διαδρομή Ιστορικού ${suffix}`, async () => {
        const { window, calls } = harness();
        await window.fetch(`https://payroll.example/api/ergazomenoi/synthetic/history-proposal${suffix === 'xlsx' ? '.xlsx' : '-' + suffix}`, { method: 'POST', body: '{}' });
        assert.equal(calls.length, 1);
        assert.equal(calls[0].init.headers, undefined);
    });
test('Καμία διαρροή διακριτικού ή εξαναγκασμός cookies προς άλλη προέλευση, και με Request', async () => {
    const { window, calls } = harness();
    await window.fetch(new Request('https://external.example/upload', { method: 'POST', body: 'synthetic' }));
    assert.equal(calls.length, 1); assert.equal(calls[0].init.headers, undefined); assert.equal(calls[0].init.credentials, undefined);
});

test('Η προστασία επανάληψης καλύπτει και διαδρομές με κεφαλαία γράμματα', async () => {
    const { window, calls } = harness();
    await window.fetch('/API/ERGAZOMENOI/synthetic/HISTORY-PROPOSAL-APPLY', { method: 'POST', body: '{}' });
    assert.equal(calls.length, 1); assert.equal(calls[0].init.headers, undefined);
});
