'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, 'dropdown-item.js'), 'utf8').replace(/^export /gm, '');
function harness() {
    const calls = [], events = {};
    const meta = { 'user-id': { content: 'user-1' }, 'csrf-token': { content: 'session-1' } };
    const branch = { value: '0001' }, context = { company: 'company-1', team: 'team-1', xrhsh: '2026' };
    let loading = true;
    const window = { EmployeeFormReadiness: { loading: () => loading }, getSessionContext: () => context,
        addEventListener: (name, handler) => { events[name] = handler; } };
    const document = { cookie: 'synthetic=1',
        querySelector: selector => meta[/meta\[name="([^"]+)"\]/.exec(selector)?.[1]],
        getElementById: () => branch, addEventListener: (name, handler) => { events[name] = handler; } };
    const sandbox = { window, document, URL, Headers, AbortController, DOMException, location: { origin: 'https://payroll.test' },
        fetch(url, options) {
            let resolve, reject;
            const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
            calls.push({ url: String(url), options, resolveText: (body, status = 200) => resolve(new Response(body, { status })), resolve: (data, status = 200) => resolve(new Response(JSON.stringify(data), { status })), reject });
            return promise;
        } };
    vm.createContext(sandbox); vm.runInContext(source, sandbox);
    return { get: window.fetchTomDropdown, calls, events, meta, branch, context, window, document,
        finish() { loading = false; events['employeeform:ready'](); } };
}
const url = 'https://payroll.test/api/dropdown/test?value=ΕΡΓ&team=one&company=one&branch=0001';

test('identical pending GETs share one response with independent data and no completed cache', async () => {
    const h = harness(), one = h.get(url), two = h.get(url);
    assert.equal(h.calls.length, 1);
    h.calls[0].resolve({ items: [{ value: 'ΕΡΓ', label: 'Εργασία' }] });
    const [a, b] = await Promise.all([one.then(r => r.json()), two.then(r => r.json())]);
    a.items[0].label = 'changed'; assert.equal(b.items[0].label, 'Εργασία');
    const third = h.get(url); assert.equal(h.calls.length, 2);
    h.calls[1].resolve({ items: [] }); await third;
});

test('cancelling one subscriber leaves the other active; cancelling all aborts transport', async () => {
    const h = harness(), a = new AbortController(), b = new AbortController();
    const one = h.get(url, { signal: a.signal }), two = h.get(url, { signal: b.signal });
    const cancelled = assert.rejects(one, { name: 'AbortError' }); a.abort(); await cancelled;
    assert.equal(h.calls[0].options.signal.aborted, false);
    h.calls[0].resolve({ items: [] }); await two;
    const c = new AbortController(), three = h.get(url, { signal: c.signal });
    const allCancelled = assert.rejects(three, { name: 'AbortError' }); c.abort(); await allCancelled;
    assert.equal(h.calls[1].options.signal.aborted, true);
    const fresh = h.get(url); h.calls[1].resolve({ stale: true });
    const another = h.get(url); assert.equal(h.calls.length, 3);
    h.calls[2].resolve({ fresh: true }); await Promise.all([fresh, another]);
});

for (const field of ['user', 'session', 'company', 'team', 'branch', 'cookie']) test(`scope change: ${field} never shares or applies a stale response`, async () => {
    const h = harness(), old = h.get(url);
    const rejection = assert.rejects(old, { name: 'AbortError' });
    if (field === 'user') h.meta['user-id'].content = 'user-2';
    else if (field === 'session') h.meta['csrf-token'].content = 'session-2';
    else if (field === 'branch') h.branch.value = '0002';
    else if (field === 'cookie') h.document.cookie = 'synthetic=2';
    else h.context[field] = field + '-2';
    const fresh = h.get(url); assert.equal(h.calls.length, 2);
    assert.equal(h.calls[0].options.signal.aborted, true);
    h.calls[0].resolve({ stale: true }); h.calls[1].resolve({ fresh: true });
    await rejection; assert.equal((await (await fresh).json()).fresh, true);
});

for (const field of ['url', 'authorization', 'credentials']) test(`request key includes ${field}`, async () => {
    const h = harness(), first = h.get(url);
    const second = field === 'url' ? h.get(url + '&extra=2') : field === 'authorization'
        ? h.get(url, { headers: { Authorization: 'Bearer synthetic-other' } })
        : h.get(url, { credentials: 'include' });
    assert.equal(h.calls.length, 2);
    for (const call of h.calls) call.resolve({ items: [] }); await Promise.all([first, second]);
});

test('errors evict pending entry; HTTP status and JSON errors remain observable', async () => {
    const h = harness(), first = h.get(url), second = h.get(url);
    const a = assert.rejects(first, /synthetic failure/), b = assert.rejects(second, /synthetic failure/);
    h.calls[0].reject(new Error('synthetic failure')); await Promise.all([a, b]);
    const retry = h.get(url); assert.equal(h.calls.length, 2);
    h.calls[1].resolve({ error: 'synthetic' }, 503);
    assert.equal((await retry).status, 503);
    const malformed = h.get(url); h.calls[2].resolveText('invalid JSON');
    await assert.rejects((await malformed).json(), error => error.name === 'SyntaxError');
    const final = h.get(url); assert.equal(h.calls.length, 4);
    h.calls[3].resolve({ items: [] }); await final;
});

test('completion, page exit, missing identity and different documents cannot retain shared data', async () => {
    const h = harness(), pending = h.get(url), rejected = assert.rejects(pending, { name: 'AbortError' });
    h.finish(); assert.equal(h.calls[0].options.signal.aborted, true);
    h.calls[0].resolve({ stale: true }); await rejected;
    h.get(url); h.get(url); assert.equal(h.calls.length, 3);
    const missing = harness(); missing.meta['user-id'].content = '';
    missing.get(url); missing.get(url); assert.equal(missing.calls.length, 2);
    const other = harness(); const outgoing = other.get(url); const exit = assert.rejects(outgoing, { name: 'AbortError' }); assert.equal(other.calls.length, 1);
    other.events.pagehide(); assert.equal(other.calls[0].options.signal.aborted, true);
    other.calls[0].resolve({ stale: true }); await exit;
});


test('a replacement readiness coordinator invalidates pending reads even with the same session', async () => {
    const h = harness(), old = h.get(url), rejected = assert.rejects(old, { name: 'AbortError' });
    h.window.EmployeeFormReadiness = { loading: () => true };
    const fresh = h.get(url); assert.equal(h.calls.length, 2);
    h.calls[0].resolve({ stale: true }); h.calls[1].resolve({ fresh: true });
    await rejected; assert.equal((await (await fresh).json()).fresh, true);
});


test('padding the same branch during hydration does not invalidate its pending requests', async () => {
    const h = harness(); h.branch.value = '1';
    const first = h.get(url); h.branch.value = '0001'; const second = h.get(url);
    assert.equal(h.calls.length, 1); assert.equal(h.calls[0].options.signal.aborted, false);
    h.calls[0].resolve({ items: [] }); await Promise.all([first, second]);
});


test('a resolved wrapper cannot apply data after its readiness generation was replaced', async () => {
    const h = harness(), request = h.get(url); h.calls[0].resolve({ stale: true });
    const response = await request;
    h.window.EmployeeFormReadiness = { loading: () => true };
    const fresh = h.get(url); h.calls[1].resolve({ fresh: true });
    await assert.rejects(response.json(), { name: 'AbortError' }); await fresh;
});
