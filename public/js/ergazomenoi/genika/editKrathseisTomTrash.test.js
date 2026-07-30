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
    syncAllEditKrathseisTrash,
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
        setAttribute(name, value) {
            if (name === 'data-has-value') this.dataset.hasValue = value;
        },
        matches(selector) {
            return selector === 'select[data-external-reset="true"]';
        },
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
        },
        contains(element) {
            return element === select;
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
    assert.equal(harness.select.dataset.hasValue, 'false');
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
            tomselect: extra.tom,
            setAttribute(name, value) {
                if (name === 'data-has-value') this.dataset.hasValue = value;
            }
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

function createInitializationHarness({ initialValue = '' } = {}) {
    const harness = createHarness();
    harness.tom.value = initialValue;
    harness.select.value = initialValue;
    harness.trash.hidden = true;

    const scopeListeners = new Map();
    const selectListeners = new Map();
    const observed = [];
    let observerInstances = 0;
    harness.scope.dataset = {};
    harness.scope.addEventListener = (name, listener) => {
        scopeListeners.set(name, listener);
    };
    harness.scope.querySelectorAll = (selector) => {
        if (selector === '.ts-single-reset-btn') return [];
        if (selector === 'select[data-external-reset="true"]') return [harness.select];
        return [];
    };
    harness.scope.contains = (element) => element === harness.select;
    harness.select.dataset.externalReset = 'true';
    harness.select.addEventListener = (name, listener) => {
        selectListeners.set(name, listener);
    };
    global.document.getElementById = (id) =>
        id === 'editKrathseisTomDropdownScope'
            ? harness.scope
            : harness.elements[id] || null;
    global.MutationObserver = class {
        constructor(callback) {
            this.callback = callback;
            observerInstances += 1;
        }
        observe(target, options) {
            observed.push({ target, options, callback: this.callback });
        }
    };

    return {
        ...harness,
        scopeListeners,
        selectListeners,
        observed,
        get observerInstances() {
            return observerInstances;
        }
    };
}

test('silent async preselect event reveals trash without a native change', () => {
    const harness = createInitializationHarness();
    let nativeChanges = 0;
    harness.select.addEventListener = (name, listener) => {
        harness.selectListeners.set(name, listener);
        if (name === 'change') nativeChanges += 1;
    };

    initializeEditKrathseisTomTrash();
    assert.equal(harness.trash.hidden, true);

    harness.tom.value = '0011';
    harness.select.value = '0011';
    harness.select.dataset.hasValue = 'true';
    harness.scopeListeners.get('tomdropdown:preselect-complete')({
        target: harness.select,
        detail: { value: '0011' }
    });

    assert.equal(harness.trash.hidden, false);
    assert.equal(nativeChanges, 1, 'only the listener binding occurred; no change was dispatched');
});

test('preselect completed before owner initialization is covered by immediate scan', () => {
    const harness = createInitializationHarness({ initialValue: '0011' });
    harness.select.dataset.hasValue = 'true';
    initializeEditKrathseisTomTrash();
    assert.equal(harness.trash.hidden, false);
});

test('scoped data-has-value observer covers late silent hydration', () => {
    const harness = createInitializationHarness();
    initializeEditKrathseisTomTrash();
    assert.equal(harness.observed.length, 1);
    assert.deepEqual(harness.observed[0].options, {
        attributes: true,
        attributeFilter: ['data-has-value']
    });

    harness.tom.value = '0011';
    harness.select.value = '0011';
    harness.select.dataset.hasValue = 'true';
    harness.observed[0].callback([
        { type: 'attributes', target: harness.select, attributeName: 'data-has-value' }
    ]);
    assert.equal(harness.trash.hidden, false);
});

test('initialization binds one event owner, one change listener and one observer', () => {
    const harness = createInitializationHarness();

    initializeEditKrathseisTomTrash();
    initializeEditKrathseisTomTrash();

    assert.deepEqual([...harness.scopeListeners.keys()].sort(), [
        'click',
        'tomdropdown:preselect-complete'
    ]);
    assert.deepEqual([...harness.selectListeners.keys()], ['change']);
    assert.equal(harness.observerInstances, 1);
    assert.equal(harness.observed.length, 1);
    assert.match(scriptSource, /button\.dataset\.clearing === 'true'/);
    assert.doesNotMatch(scriptSource, /\[100,\s*300,\s*700\]/);
});

test('four hydrated main rows show four trash controls while empty controls stay hidden', () => {
    const harness = createHarness();
    const selects = [];
    const trashById = new Map();

    for (let index = 1; index <= 10; index += 1) {
        const isMain = index <= 7;
        const id = isMain
            ? `select_krathsh_${String(index).padStart(2, '0')}`
            : ['epikoyrikh_xoris_efka', 'astheneia_xoris_efka', 'idiothta_sto_ergo_39'][
                  index - 8
              ];
        const value = isMain && index <= 4 ? `00${index}` : '';
        const select = {
            id,
            value,
            dataset: { externalReset: 'true', hasValue: value ? 'true' : 'false' },
            tomselect: { getValue: () => value }
        };
        selects.push(select);
        trashById.set(id, { hidden: true });
        harness.elements[id] = select;
    }

    harness.scope.querySelectorAll = () => selects;
    harness.scope.querySelector = (selector) => {
        const id = selector.match(/data-tom-target="([^"]+)"/)?.[1];
        return trashById.get(id) || null;
    };
    syncAllEditKrathseisTrash(harness.scope);

    assert.equal(
        [...trashById.values()].filter((button) => !button.hidden).length,
        4
    );
    assert.ok(selects.slice(4).every((select) => trashById.get(select.id).hidden));
});

test('shared hydration contract dispatches data-only bubbling completion without change', () => {
    const dropdownSource = fs.readFileSync(path.join(root, 'public/js/dropdown-item.js'), 'utf8');
    const singlePreselectSource = dropdownSource.slice(
        dropdownSource.indexOf('// ── SINGLE'),
        dropdownSource.indexOf(`console.error('❌ Preselect fetch failed:'`)
    );
    assert.match(
        dropdownSource,
        /new CustomEvent\('tomdropdown:preselect-complete',\s*\{\s*bubbles: true,\s*detail: \{ value \}/s
    );
    assert.match(
        dropdownSource,
        /ts\.setValue\(id, true\);\s*selectedCache\[id\] = normalized;\s*el\.setAttribute\('data-has-value', 'true'\);\s*dispatchTomDropdownPreselectComplete\(el, id\)/s
    );
    assert.doesNotMatch(singlePreselectSource, /new Event\(['"]change/);
});
