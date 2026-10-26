'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { getEventListeners } = require('node:events');

const template = fs.readFileSync(path.join(__dirname,
    '../../views/ergazomenoi/ergazomenoi/partials/employeeFormLoading.ejs'), 'utf8');
const source = template.slice(template.indexOf('\n(() =>'), template.lastIndexOf('</script>'));
const drain = () => new Promise(resolve => setImmediate(resolve));

function fixture({ visibility = 'visible', missingControl = false } = {}) {
    const listeners = new Map(), frames = new Map(), controllers = [];
    const deadline = new AbortController();
    let frameId = 0, readyEvents = 0, finalizers = 0;
    const content = { inert: true, getClientRects: () => [{}] };
    const save = { disabled: false };
    const retry = { hidden: true, addEventListener() {} };
    const back = { hidden: true, removeAttribute() { this.hidden = false; } };
    const panel = { hidden: false, setAttribute() {}, querySelector: selector =>
        selector === '[data-employee-form-retry]' ? retry : selector === '[data-employee-form-back]' ? back : { textContent: '' } };
    const control = { id: 'required', tomselect: missingControl ? null : {} };
    const page = {
        dataset: { employeeFormState: 'loading', employeeScheduleInitialized: 'true' },
        querySelector: selector => selector === '.tadded-container' ? content : panel,
        querySelectorAll: selector => selector === '.submitButton' ? [save]
            : selector === 'select.tom-dropdown[data-api]' ? [control] : [],
        addEventListener() {}, setAttribute() {},
        dispatchEvent(event) { if (event.type === 'employeeform:ready') readyEvents++; }
    };
    const document = {
        visibilityState: visibility, readyState: 'complete',
        querySelector: () => page,
        addEventListener(name, callback) {
            if (!listeners.has(name)) listeners.set(name, new Set());
            listeners.get(name).add(callback);
        },
        removeEventListener(name, callback) { listeners.get(name)?.delete(callback); }
    };
    const emit = name => [...(listeners.get(name) || [])].forEach(callback => callback());
    const window = { addEventListener() {}, initAllTomSelects() {} };
    vm.runInNewContext(source, {
        window, document, performance: { now: () => 100 }, queueMicrotask,
        requestAnimationFrame(callback) { frames.set(++frameId, callback); return frameId; },
        cancelAnimationFrame(id) { frames.delete(id); },
        getComputedStyle: () => ({ visibility: 'visible' }),
        AbortController: class extends AbortController {
            constructor() { super(); controllers.push(this); }
        },
        AbortSignal: { timeout(ms) { assert.equal(ms, 20000); return deadline.signal; } },
        CustomEvent: class { constructor(type) { this.type = type; } }, console: { error() {} }
    });
    const readiness = window.EmployeeFormReadiness;
    readiness.beforeReveal(() => finalizers++);
    return {
        readiness, frames, content, save, deadline,
        events: () => readyEvents, finalizers: () => finalizers,
        state: () => page.dataset.employeeFormState,
        async start() { emit('DOMContentLoaded'); await drain(); },
        async visibility(value) { document.visibilityState = value; emit('visibilitychange'); await drain(); },
        async frame() {
            const callbacks = [...frames.values()]; frames.clear();
            callbacks.forEach(callback => callback(100)); await drain();
        },
        assertClean() {
            assert.equal(listeners.get('visibilitychange')?.size || 0, 0);
            assert.equal(getEventListeners(controllers[0].signal, 'abort').length, 0);
            // Only the independent visibility measurement may remain unpainted.
            assert.ok(frames.size <= 1);
        }
    };
}

test('visible form requires both render frames and emits readiness once', async () => {
    const h = fixture(); await h.start();
    assert.equal(h.state(), 'loading'); assert.equal(h.content.inert, true);
    await h.frame();
    assert.equal(h.state(), 'loading'); assert.equal(h.finalizers(), 1);
    await h.frame();
    assert.equal(h.state(), 'ready'); assert.equal(h.events(), 1);
    assert.equal(h.content.inert, false); assert.equal(h.save.disabled, false);
    await h.frame(); h.assertClean(); assert.equal(h.events(), 1);
});

test('already hidden form completes validation without requesting render frames', async () => {
    const h = fixture({ visibility: 'hidden' }); await h.start();
    assert.equal(h.state(), 'ready'); assert.equal(h.finalizers(), 1);
    assert.equal(h.events(), 1); assert.equal(h.frames.size, 1); h.assertClean();
});

for (const stage of [1, 2]) test(`hiding during render wait ${stage} cancels its frame and completes once`, async () => {
    const h = fixture(); await h.start();
    if (stage === 2) await h.frame();
    const lateCallbacks = [...h.frames.values()];
    await h.visibility('hidden');
    assert.equal(h.state(), 'ready'); assert.equal(h.events(), 1);
    h.assertClean();
    await h.visibility('visible'); await h.visibility('hidden');
    lateCallbacks.forEach(callback => callback(100)); await drain();
    assert.equal(h.events(), 1); assert.equal(h.finalizers(), 1); h.assertClean();
});

test('returning to visible while data is pending still requires data and both frames', async () => {
    const h = fixture({ visibility: 'hidden' });
    let release; h.readiness.track('initial-schedule', new Promise(resolve => { release = resolve; }));
    await h.start(); await h.visibility('visible');
    assert.equal(h.state(), 'loading'); assert.equal(h.events(), 0);
    release(); await drain(); await h.frame();
    assert.equal(h.state(), 'loading'); await h.frame();
    assert.equal(h.state(), 'ready'); assert.equal(h.events(), 1); h.assertClean();
});

for (const visibility of ['visible', 'hidden']) test(`missing mandatory control blocks ${visibility} readiness`, async () => {
    const h = fixture({ visibility, missingControl: true }); await h.start();
    if (visibility === 'visible') await h.frame();
    assert.equal(h.state(), 'failed'); assert.equal(h.events(), 0);
    assert.equal(h.content.inert, true); assert.equal(h.save.disabled, true); h.assertClean();
});

for (const stage of [1, 2]) test(`deadline during render wait ${stage} cleans callbacks and cannot be revived`, async () => {
    const h = fixture(); await h.start();
    if (stage === 2) await h.frame();
    const callbacks = [...h.frames.values()];
    h.deadline.abort(); await drain(); h.assertClean();
    assert.equal(h.state(), 'failed'); assert.equal(h.events(), 0);
    assert.equal(h.readiness.diagnostics().reason, 'deadline-exceeded');
    await h.visibility('hidden'); await h.visibility('visible');
    callbacks.forEach(callback => callback(100)); await drain();
    assert.equal(h.state(), 'failed'); assert.equal(h.events(), 0); h.assertClean();
});

test('explicit cancellation during a frame wait preserves the failure and cleans listeners', async () => {
    const h = fixture(); await h.start();
    h.readiness.fail(new Error('synthetic cancellation'), '', 'cancelled'); await drain();
    assert.equal(h.state(), 'failed'); assert.equal(h.events(), 0); h.assertClean();
});

test('deadline still fails genuinely pending hidden work; late completion cannot unlock it', async () => {
    const h = fixture({ visibility: 'hidden' });
    let release; h.readiness.track('initial-schedule', new Promise(resolve => { release = resolve; }));
    await h.start();
    assert.equal(h.state(), 'loading'); assert.equal(h.content.inert, true);
    h.deadline.abort(); await drain();
    assert.equal(h.state(), 'failed'); assert.equal(h.readiness.diagnostics().pending.length, 1);
    release(); await drain(); await h.visibility('visible'); await h.frame();
    assert.equal(h.events(), 0); assert.equal(h.content.inert, true); h.assertClean();
});

test('new pending work registered by finalizers still prevents premature readiness', async () => {
    const h = fixture(); let release;
    h.readiness.beforeReveal(() => h.readiness.track('initial-schedule',
        new Promise(resolve => { release = resolve; })));
    await h.start(); await h.frame(); await h.visibility('hidden');
    assert.equal(h.state(), 'loading'); assert.equal(h.events(), 0);
    release(); await drain();
    assert.equal(h.state(), 'ready'); assert.equal(h.finalizers(), 1);
    assert.equal(h.events(), 1); h.assertClean();
});

test('deadline after successful readiness never fails or emits a second event', async () => {
    const h = fixture({ visibility: 'hidden' }); await h.start();
    h.deadline.abort(); await h.visibility('visible'); await h.frame();
    assert.equal(h.state(), 'ready'); assert.equal(h.events(), 1); h.assertClean();
});
