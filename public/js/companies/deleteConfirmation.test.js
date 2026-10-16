'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Οι πραγματικοί χειριστές και οι κοινοί μηχανισμοί αναμονής, χωρίς διακομιστή ή βάση.
const root = path.resolve(__dirname, '../../..');
const layout = fs.readFileSync(path.join(root, 'views/layouts/main.ejs'), 'utf8');
const scripts = [...layout.replace(/<%[\s\S]*?%>/g, '').matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)]
    .map(m => m[1]);
const loaderScripts = ['const efkaRoot =', 'const _fetch =', '// Links:'].map(marker => {
    const source = scripts.find(script => script.includes(marker));
    assert.ok(source, marker);
    return source;
});

function deferred() {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return { promise, resolve };
}

function element(attributes = {}) {
    const attrs = { ...attributes };
    const listeners = {};
    const classes = new Set();
    return {
        dataset: { allowed: '1' }, listeners,
        get href() { return attrs.href; },
        set href(value) { attrs.href = value; },
        getAttribute: name => attrs[name] ?? null,
        hasAttribute: name => Object.hasOwn(attrs, name),
        setAttribute(name, value) { attrs[name] = value; },
        closest() { return this; },
        addEventListener(type, handler) { (listeners[type] ||= []).push(handler); },
        classList: {
            add: name => classes.add(name), remove: name => classes.delete(name),
            contains: name => classes.has(name)
        }
    };
}

function createPage(section, allowed = true) {
    const row = element({ 'data-id': 'selected-record' });
    const edit = element({ href: '#' });
    const remove = element({ href: '#' });
    remove.dataset.allowed = allowed ? '1' : '0';
    const overlay = element();
    overlay.querySelector = () => ({});
    const main = {};
    const documentListeners = [];
    const confirmation = deferred();
    const response = deferred();
    const calls = { alerts: [], requests: [], begin: 0 };
    const timers = new Map();
    let nextTimer = 0;
    const context = {
        URL, console,
        setTimeout(fn) { timers.set(++nextTimer, fn); return nextTimer; },
        clearTimeout(id) { timers.delete(id); },
        document: {
            body: {},
            addEventListener(type, handler, capture) {
                documentListeners.push({ type, handler, capture });
            },
            getElementById(id) { return { 'edit-btn': edit, 'delete-btn': remove }[id] || null; },
            querySelectorAll() { return [row]; },
            querySelector(selector) {
                if (selector === 'main.payroll-form-layout') return main;
                if (selector.includes('data-loader="simple"')) return overlay;
                if (selector === 'meta[name="csrf-token"]') return { content: 'mock-csrf' };
                return null;
            }
        },
        location: { origin: 'http://localhost', href: `http://localhost/companies/${section}` },
        addEventListener() {},
        fetch(url, options) { calls.requests.push({ url, options }); return response.promise; },
        Swal: {
            fire(options) {
                calls.alerts.push(options);
                return options.showCancelButton ? confirmation.promise : Promise.resolve({});
            },
            getCancelButton() { return { focus() {} }; },
            showLoading() { assert.fail('Δεν επιτρέπεται loading SweetAlert'); }
        }
    };
    context.window = context;
    vm.createContext(context);
    const directory = section === 'ypokatasthmata' ? section : 'nomimoiekprosopoi';
    vm.runInContext(fs.readFileSync(path.join(__dirname, directory, 'selectRowInTable.js'), 'utf8'), context);
    loaderScripts.forEach(source => vm.runInContext(source, context));
    const begin = context.AppLoader.begin.bind(context.AppLoader);
    context.AppLoader.begin = (...args) => { calls.begin++; begin(...args); };
    documentListeners.filter(e => e.type === 'DOMContentLoaded').forEach(e => e.handler());

    function click(target) {
        const event = { target, preventDefault() {}, stopPropagation() {} };
        documentListeners.filter(e => e.type === 'click' && e.capture).forEach(e => e.handler(event));
        return Promise.all((target.listeners.click || []).map(handler => handler.call(target, event)));
    }
    return {
        calls, row, edit, remove, overlay, context, confirmation, response, click,
        runTimers() {
            const pending = [...timers.values()];
            timers.clear();
            pending.forEach(fn => fn());
        }
    };
}

for (const section of ['ypokatasthmata', 'nomimoi_ekprosopoi']) {
    for (const dismiss of ['cancel', 'esc', 'close']) {
        test(`${section}: ${dismiss} χωρίς αναμονή, αίτημα ή απώλεια επιλογής`, async () => {
            const page = createPage(section);
            await page.click(page.row);
            const originalHref = page.context.location.href;
            const editHref = page.edit.href;
            const pending = page.click(page.remove);
            page.runTimers();
            assert.equal(page.calls.begin, 0, 'Η επιβεβαίωση δεν είναι πλοήγηση');
            assert.equal(page.calls.requests.length, 0);
            assert.equal(page.overlay.classList.contains('is-visible'), false);
            page.confirmation.resolve({ isConfirmed: false, isDismissed: true, dismiss });
            await pending;
            page.runTimers();
            assert.equal(page.calls.alerts.length, 1);
            assert.equal(page.calls.requests.length, 0);
            assert.equal(page.context.location.href, originalHref);
            assert.equal(page.row.classList.contains('selected-row'), true);
            assert.equal(page.edit.href, editHref);
            assert.equal(page.remove.href, `/companies/${section}/delete/selected-record`);
            assert.equal(page.overlay.classList.contains('is-visible'), false);
            await page.click(page.edit);
            assert.equal(page.context.location.href, `/companies/${section}/edit/selected-record`);
            assert.equal(page.calls.begin, 1, 'Η κανονική πλοήγηση διατηρεί την ένδειξη αναμονής');
        });
    }

    test(`${section}: διαγραφή και αναμονή μόνο μετά από επιβεβαίωση`, async () => {
        const page = createPage(section);
        await page.click(page.row);
        const pending = page.click(page.remove);
        assert.equal(page.calls.requests.length, 0);
        page.confirmation.resolve({ isConfirmed: true, isDismissed: false });
        await new Promise(setImmediate);
        assert.equal(page.calls.requests.length, 1);
        const request = page.calls.requests[0];
        assert.equal(request.url, `/companies/${section}/delete/selected-record`);
        assert.equal(request.options.method, 'DELETE');
        assert.equal(request.options.headers['CSRF-Token'], 'mock-csrf');
        assert.equal(request.options.credentials, 'include');
        assert.equal(page.calls.begin, 1);
        page.runTimers();
        assert.equal(page.overlay.classList.contains('is-visible'), true);
        page.response.resolve({ status: 204 });
        await pending;
        page.runTimers();
        assert.equal(page.overlay.classList.contains('is-visible'), false);
    });

    test(`${section}: χωρίς δικαίωμα δεν ξεκινά αναμονή ή αίτημα`, async () => {
        const page = createPage(section, false);
        await page.click(page.row);
        await page.click(page.remove);
        assert.equal(page.calls.begin, 0);
        assert.equal(page.calls.requests.length, 0);
        assert.equal(page.calls.alerts.length, 0);
    });

    test(`${section}: χωρίς επιλογή εμφανίζεται μόνο η υπάρχουσα ειδοποίηση`, async () => {
        const page = createPage(section);
        await page.click(page.remove);
        assert.equal(page.calls.begin, 0);
        assert.equal(page.calls.requests.length, 0);
        assert.equal(page.calls.alerts[0].title, 'Καμία επιλογή');
    });
}
