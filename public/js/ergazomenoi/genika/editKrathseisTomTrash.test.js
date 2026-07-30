const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ejs = require('ejs');

const root = path.resolve(__dirname, '../../../..');
const viewSource = fs.readFileSync(
    path.join(
        root,
        'views/ergazomenoi/ergazomenoi/partials/edit/cardBodies/section3/krathseis.ejs'
    ),
    'utf8'
);
const scriptSource = fs.readFileSync(
    path.join(root, 'public/js/ergazomenoi/genika/editKrathseisTomTrash.js'),
    'utf8'
);
const cssSource = fs.readFileSync(path.join(root, 'public/css/main.css'), 'utf8');
const renderedView = ejs.render(viewSource, { rec: {} });
const {
    syncKrathseisExternalTrash,
    clearEditKrathseisTom,
    initializeEditKrathseisTomTrash
} = require('./editKrathseisTomTrash');
const {
    rebuildKrathseisTableFromRows,
    handleKrathshChange,
    handleAmaFocus
} = require('./checkAmaTameioy');

function classList() {
    const values = new Set(['d-none']);
    return {
        remove(...names) {
            names.forEach((name) => values.delete(name));
        },
        contains(name) {
            return values.has(name);
        }
    };
}

function createTom(value, option) {
    const calls = {
        enable: 0,
        clear: 0,
        clearOptions: 0,
        load: 0,
        refresh: [],
        close: 0,
        open: 0
    };
    const listeners = new Map();
    const tom = {
        value,
        options: value ? { [value]: option } : {},
        nextPage: '/page/2',
        wrapper: { classList: classList() },
        control_input: { blur() {} },
        getValue() {
            return this.value;
        },
        enable() {
            calls.enable += 1;
        },
        clear() {
            calls.clear += 1;
            this.value = '';
        },
        close() {
            calls.close += 1;
        },
        open() {
            calls.open += 1;
        },
        clearOptions() {
            calls.clearOptions += 1;
            this.options = {};
        },
        setTextboxValue() {},
        clearFilter() {},
        on(name, fn) {
            listeners.set(name, fn);
        },
        off(name, fn) {
            if (listeners.get(name) === fn) listeners.delete(name);
        },
        load(query) {
            assert.equal(query, '');
            calls.load += 1;
            this.options = {
                '0002': {
                    kodikos: '0002',
                    kodikos_tameioy: '0101',
                    perigrafh: 'Νέα κράτηση'
                }
            };
            queueMicrotask(() => listeners.get('load')?.());
        },
        refreshOptions(open) {
            calls.refresh.push(open);
        }
    };
    return { tom, calls };
}

function createHarness() {
    const option = { kodikos: '0001', kodikos_tameioy: '0101', perigrafh: 'Παλιά' };
    const { tom, calls } = createTom('0001', option);
    const row = { classList: classList() };
    const select = {
        id: 'select_krathsh_01',
        value: '0001',
        dataset: { rowIndex: '01', targetInput: 'krathsh_01' },
        tomselect: tom,
        closest() {
            return row;
        }
    };
    const hidden = { value: '0001' };
    const amaAttributes = new Map([['data-copied-from', 'ama_krathshs_02']]);
    const ama = {
        value: '123',
        style: { backgroundColor: '#f0f0f0' },
        setAttribute(name, value) {
            amaAttributes.set(name, value);
        },
        removeAttribute(name) {
            amaAttributes.delete(name);
        },
        getAttribute(name) {
            return amaAttributes.get(name);
        }
    };
    const table = { value: '[]' };
    const trash = { hidden: true };
    const elements = {
        select_krathsh_01: select,
        krathsh_01: hidden,
        ama_krathshs_01: ama,
        krathseis_table: table
    };
    const scope = {
        querySelector(selector) {
            return selector === '[data-tom-target="select_krathsh_01"]' ? trash : null;
        }
    };
    global.document = {
        getElementById(id) {
            return elements[id] || null;
        },
        dispatchEvent() {}
    };
    global.window = { rebuildKrathseisTableFromRows };
    global.CustomEvent = class {
        constructor(name, init) {
            this.type = name;
            this.detail = init.detail;
        }
    };
    return { scope, select, hidden, ama, table, trash, tom, calls, row, elements };
}

test('edit Κρατήσεις markup owns exactly ten external trash3 controls', () => {
    assert.match(renderedView, /id="editKrathseisTomDropdownScope"/);
    assert.equal((renderedView.match(/data-external-reset="true"/g) || []).length, 10);
    assert.equal((renderedView.match(/data-tom-target=/g) || []).length, 10);
    assert.equal((renderedView.match(/bi bi-trash3 cdarkred/g) || []).length, 10);
    assert.doesNotMatch(renderedView, /bi bi-trash(?!3)/);
    assert.doesNotMatch(renderedView, /bi bi-x-lg/);
    assert.doesNotMatch(renderedView, /\son(?:click|change)\s*=/i);
    assert.match(renderedView, /Ακύρωση τρέχουσας επιλογής/);
    assert.match(cssSource, /#editKrathseisTomDropdownScope \.edit-employee-tom-trash/);
});

test('preselected, empty and newly selected values synchronize trash visibility', () => {
    const harness = createHarness();
    assert.equal(syncKrathseisExternalTrash(harness.scope, harness.select.id), true);
    assert.equal(harness.trash.hidden, false);
    harness.tom.value = '';
    harness.select.value = '';
    assert.equal(syncKrathseisExternalTrash(harness.scope, harness.select.id), false);
    assert.equal(harness.trash.hidden, true);
    harness.tom.value = '0002';
    assert.equal(syncKrathseisExternalTrash(harness.scope, harness.select.id), true);
    assert.equal(harness.trash.hidden, false);
});

test('main row clear resets selection, hidden, AMA, table and reloads once without opening', async () => {
    const harness = createHarness();
    rebuildKrathseisTableFromRows();
    assert.match(harness.table.value, /0001/);
    await clearEditKrathseisTom(harness.scope, harness.select.id);

    assert.equal(harness.tom.value, '');
    assert.equal(harness.hidden.value, '');
    assert.equal(harness.ama.value, '');
    assert.equal(harness.ama.style.backgroundColor, '');
    assert.equal(harness.ama.getAttribute('data-copied-from'), undefined);
    assert.equal(harness.table.value, '[]');
    assert.equal(harness.trash.hidden, true);
    assert.equal(harness.row.classList.contains('d-none'), false);
    assert.equal(harness.calls.clear, 1);
    assert.equal(harness.calls.clearOptions, 1);
    assert.equal(harness.calls.load, 1);
    assert.deepEqual(harness.calls.refresh, [false]);
    assert.equal(harness.calls.open, 0);
    assert.equal(harness.tom.nextPage, null);
    assert.ok(harness.calls.enable >= 2);
});

test('clear and reselect replaces stale table value and shows trash again', async () => {
    const harness = createHarness();
    await clearEditKrathseisTom(harness.scope, harness.select.id);
    harness.tom.value = '0002';
    harness.select.value = '0002';
    handleKrathshChange('01', '0002');
    syncKrathseisExternalTrash(harness.scope, harness.select.id);

    assert.equal(harness.hidden.value, '0002');
    assert.doesNotMatch(harness.table.value, /0001/);
    assert.match(harness.table.value, /0002/);
    assert.equal(harness.trash.hidden, false);
});

test('table deduplicates by fund while AMA copy uses real row IDs', () => {
    const harness = createHarness();
    const option2 = { kodikos: '0002', kodikos_tameioy: '0101', perigrafh: 'Δεύτερη' };
    const second = createTom('0002', option2).tom;
    const ama2Attributes = new Map();
    harness.elements.select_krathsh_02 = {
        id: 'select_krathsh_02',
        value: '0002',
        dataset: { rowIndex: '02' },
        tomselect: second
    };
    harness.elements.krathsh_02 = { value: '0002' };
    harness.elements.ama_krathshs_02 = {
        value: '',
        style: { backgroundColor: '' },
        setAttribute(name, value) {
            ama2Attributes.set(name, value);
        },
        removeAttribute(name) {
            ama2Attributes.delete(name);
        }
    };

    const tableData = rebuildKrathseisTableFromRows();
    assert.equal(tableData.length, 1);
    handleAmaFocus('02');
    assert.equal(harness.elements.ama_krathshs_02.value, '123');
    assert.equal(ama2Attributes.get('data-copied-from'), 'ama_krathshs_01');
});

test('three independent extra dropdowns clear hidden values and reload without cascade', async () => {
    for (const id of ['epikoyrikh_xoris_efka', 'astheneia_xoris_efka', 'idiothta_sto_ergo_39']) {
        const harness = createHarness();
        const extra = createTom('01', { kodikos: '01' });
        const hidden = { value: '01' };
        const trash = { hidden: false };
        harness.elements[id] = {
            id,
            value: '01',
            dataset: { targetInput: `${id}_stathera` },
            tomselect: extra.tom
        };
        harness.elements[`${id}_stathera`] = hidden;
        harness.scope.querySelector = (selector) =>
            selector === `[data-tom-target="${id}"]` ? trash : null;

        await clearEditKrathseisTom(harness.scope, id);
        assert.equal(hidden.value, '');
        assert.equal(trash.hidden, true);
        assert.equal(extra.calls.load, 1);
        assert.equal(extra.calls.open, 0);
    }
});

test('rehydration initialization binds one delegated owner and no duplicate select listener', () => {
    const harness = createHarness();
    let scopeListeners = 0;
    let selectListeners = 0;
    harness.scope.dataset = {};
    harness.scope.addEventListener = () => {
        scopeListeners += 1;
    };
    harness.scope.querySelectorAll = (selector) => {
        if (selector === '.ts-single-reset-btn') return [];
        if (selector === 'select[data-external-reset="true"]') return [harness.select];
        return [];
    };
    harness.scope.contains = () => true;
    harness.select.dataset.externalReset = 'true';
    harness.select.addEventListener = () => {
        selectListeners += 1;
    };
    global.document.getElementById = (id) =>
        id === 'editKrathseisTomDropdownScope'
            ? harness.scope
            : harness.elements[id] || null;

    initializeEditKrathseisTomTrash();
    initializeEditKrathseisTomTrash();

    assert.equal(scopeListeners, 1);
    assert.equal(selectListeners, 1);
    assert.match(scriptSource, /button\.dataset\.clearing === 'true'/);
});
