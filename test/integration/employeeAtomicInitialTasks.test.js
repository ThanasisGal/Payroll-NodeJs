'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');

function contractFixture({ failure = '' } = {}) {
    const text = fs.readFileSync(path.join(root, 'public/js/ergazomenoi/genika/editStoixeiaSymbaseon.js'), 'utf8');
    const tasks = [], finalizers = [], amounts = [], fields = new Map();
    const field = id => {
        if (!fields.has(id)) fields.set(id, { value: '', classList: { add() {}, remove() {} }, removeAttribute() {}, setAttribute() {} });
        return fields.get(id);
    };
    for (const id of ['symbash_stathera', 'kathgoria_symbashs_stathera', 'eidikothta_symbashs_stathera', 'stoixeioSymbashsHidden_01']) field(id).value = '0001';
    field('posoSymbashsHidden_01').value = '123.45';
    field('posoSymbashsBaseiOronErgasiasHidden_01').value = '100.00';
    let start, totals = 0;
    const readiness = { loading: () => true, track(name, promise) { tasks.push({ name, promise }); }, beforeReveal(callback) { finalizers.push(callback); } };
    const noop = () => {};
    const context = vm.createContext({ window: { EmployeeFormReadiness: readiness, location: { origin: 'https://payroll.test' } },
        document: { getElementById: field, addEventListener(name, callback) { start = callback; } }, URL,
        generateSelectRowsOfSymbaseis: noop, initializeStoredActualWagesSnapshot: noop, setupAutocompleteHack: noop,
        addEventListeners: noop, watchEidikothtaChanges: noop, setupManualPragmatikoOromisthioEditor: noop,
        fetchGenikesParametroi: async () => { if (failure === 'parameters') throw new Error('parameters unavailable'); return Array(60).fill({ timh: '1' }); },
        updateGeneralParameters: noop, toDecimal: () => ({ toNumber: () => 1 }), pad4: value => String(value).padStart(4, '0'),
        getEffectiveRowCount: () => 1, syncHiddenTarget: noop, syncStoixeioRowTrash: noop, applyLockedTomStyle: noop,
        setRowAmounts(...args) { amounts.push(args); }, calculateTotal() { totals++; },
        activateStoredActualWagesSnapshotIfManualExtraExists: noop, applyNomimaFromSymbashTotals: noop,
        initTomDropdown({ selector }) { field(selector.slice(1)).tomselect = { options: {}, addOption(item) { this.options[item.value] = item; },
            setValue(value) { this.value = value; }, refreshItems: noop, refreshState: noop }; },
        fetch: async () => ({ ok: failure !== 'catalog', status: failure === 'catalog' ? 503 : 200,
            json: async () => ({ items: failure === 'missing' ? [] : [{ value: '0001', label: 'Συνθετική επιλογή' }] }) }),
        requestAnimationFrame() { throw new Error('Initial hydration must not wait for a frame'); },
        setTimeout() { throw new Error('Initial hydration must not leave delayed field writes'); }, console: { error: noop, warn: noop }
    });
    const countStart = text.indexOf('async function fetchAvailableStoixeiaCount(');
    const initialStart = text.indexOf('function initialFrame(');
    const end = text.indexOf('// EVENT LISTENERS', initialStart);
    vm.runInContext(text.slice(countStart, initialStart) + text.slice(initialStart, end), context);
    const listenerStart = text.indexOf("document.addEventListener('DOMContentLoaded'");
    vm.runInContext(text.slice(listenerStart, text.indexOf('});', listenerStart) + 3), context);
    start();
    return { tasks, finalizers, amounts, field, context, totals: () => totals };
}

test('stored contract selection and amounts complete before the readiness finalizer, without hidden-tab timers', async () => {
    const h = contractFixture();
    assert.equal(h.tasks.length, 1); assert.equal(h.tasks[0].name, 'initial-contract-elements');
    await h.tasks[0].promise;
    assert.equal(h.field('stoixeio_symbashs_01').tomselect.value, '0001');
    assert.deepEqual(h.amounts, [['01', '123.45', '100.00']]);
    assert.equal(h.finalizers.length, 1); assert.equal(h.totals(), 1);
    h.finalizers[0]();
    assert.equal(h.totals(), 2); assert.equal(h.context._isHydratingStoixeia, false);
});

for (const failure of ['parameters', 'catalog', 'missing']) test(`initial contract ${failure} failure rejects the tracked task`, async () => {
    const h = contractFixture({ failure });
    await assert.rejects(h.tasks[0].promise);
    assert.equal(h.finalizers.length, 0);
});

test('initial tax label is tracked until the response is applied; lookup failure rejects readiness', async () => {
    const source = fs.readFileSync(path.join(root, 'public/js/ergazomenoi/genika/autoLoadTaxScale.js'), 'utf8');
    for (const ok of [true, false]) {
        const tasks = [], fields = new Map(); let release;
        const field = id => { if (!fields.has(id)) fields.set(id, { value: '', addEventListener() {} }); return fields.get(id); };
        field('forologikh_klimaka').value = '0101';
        const response = new Promise(resolve => { release = resolve; });
        vm.runInNewContext(source, { document: {
            querySelector: selector => selector.includes('meta') ? { getAttribute: () => 'synthetic' } : field('birth'),
            getElementById: field },
            window: { EmployeeFormReadiness: { loading: () => true, track(name, promise) { tasks.push({ name, promise }); } } },
            fetch: () => response, console, setTimeout, clearTimeout });
        assert.equal(tasks.length, 1); assert.equal(tasks[0].name, 'initial-tax-scale');
        assert.equal(field('forologikh_klimaka').value, '0101');
        release({ ok, json: async () => ({ success: true, kodikos: '0101', taxScale: { perigrafh: 'Συνθετική κλίμακα' } }) });
        if (ok) { await tasks[0].promise; assert.equal(field('forologikh_klimaka').value, '0101 - Συνθετική κλίμακα'); }
        else await assert.rejects(tasks[0].promise);
    }
});
