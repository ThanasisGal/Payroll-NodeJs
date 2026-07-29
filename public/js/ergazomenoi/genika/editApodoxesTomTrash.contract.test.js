const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../../../..');
const dynamicSource = fs.readFileSync(
    path.join(root, 'public/js/ergazomenoi/genika/editStoixeiaSymbaseon.js'),
    'utf8'
);
const chainSource = fs.readFileSync(path.join(root, 'public/js/symbaseisDropdownChain3.js'), 'utf8');
const dropdownSource = fs.readFileSync(path.join(root, 'public/js/dropdown-item.js'), 'utf8');
const viewSource = fs.readFileSync(
    path.join(
        root,
        'views/ergazomenoi/ergazomenoi/partials/edit/cardBodies/section2/apodoxes.ejs'
    ),
    'utf8'
);
const cssSource = fs.readFileSync(path.join(root, 'public/css/main.css'), 'utf8');

function extractFunction(source, name) {
    const functionStart = source.indexOf(`function ${name}(`);
    assert.notEqual(functionStart, -1, `Missing function ${name}`);
    const asyncStart = source.lastIndexOf('async ', functionStart);
    const start =
        asyncStart >= 0 && source.slice(asyncStart, functionStart) === 'async '
            ? asyncStart
            : functionStart;
    const bodyStart = source.indexOf('{', start);
    let depth = 0;
    for (let index = bodyStart; index < source.length; index += 1) {
        if (source[index] === '{') depth += 1;
        if (source[index] === '}') depth -= 1;
        if (depth === 0) return source.slice(start, index + 1);
    }
    throw new Error(`Unterminated function ${name}`);
}

function createDynamicHarness({
    tomValue = '',
    selectValue = '',
    hiddenValue = '',
    preloadAll = false
} = {}) {
    const calls = {
        calculateTotal: 0,
        applyNomima: 0,
        clear: 0,
        clearOptions: 0,
        enable: 0,
        open: 0,
        close: 0,
        loadCalls: 0,
        loadedQuery: [],
        refreshOptionsCalls: [],
        setTextboxValue: [],
        clearFilter: 0,
        handleStoixeioChange: 0
    };
    const trash = { hidden: true };
    const hidden = { value: hiddenValue };
    const savedHidden = { value: hiddenValue };
    const firstAmount = { value: '12.00' };
    const secondAmount = { value: '10.00' };
    const row = {
        hidden: false,
        classList: {
            remove(name) {
                if (name === 'd-none') row.hidden = false;
            }
        }
    };
    const eventListeners = new Map([['change', new Set([() => {}])]]);
    const tom = {
        value: tomValue,
        options: tomValue ? { [tomValue]: { value: tomValue } } : {},
        settings: { _preloadAll: preloadAll },
        nextPage: '/api/dropdown/symbaseis/stoixeio_symbashs?page=2',
        isOpen: false,
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
        clearOptions() {
            calls.clearOptions += 1;
            this.options = {};
        },
        setTextboxValue(value) {
            calls.setTextboxValue.push(value);
        },
        clearFilter() {
            calls.clearFilter += 1;
        },
        on(eventName, listener) {
            if (!eventListeners.has(eventName)) eventListeners.set(eventName, new Set());
            eventListeners.get(eventName).add(listener);
        },
        off(eventName, listener) {
            eventListeners.get(eventName)?.delete(listener);
        },
        load(query) {
            calls.loadCalls += 1;
            calls.loadedQuery.push(query);
            queueMicrotask(() => {
                this.options = {
                    '0002': { value: '0002', text: '0002 - Νέα επιλογή' },
                    '0003': { value: '0003', text: '0003 - Εναλλακτική επιλογή' }
                };
                for (const listener of [...(eventListeners.get('load') || [])]) listener();
            });
        },
        refreshOptions(triggerDropdown) {
            calls.refreshOptionsCalls.push(triggerDropdown);
        },
        refreshItems() {},
        refreshState() {},
        close() {
            calls.close += 1;
            this.isOpen = false;
        },
        open() {
            calls.open += 1;
            this.isOpen = true;
        },
        control_input: { blur() {} },
        wrapper: { classList: { remove() {} } }
    };
    const select = { value: selectValue, dataset: { preloadAll: String(preloadAll) }, tomselect: tom };
    const elements = {
        stoixeio_symbashs_01: select,
        stoixeio_symbashs_01_hidden: hidden,
        stoixeioSymbashsHidden_01: savedHidden,
        'clearSelectSymbaseon-01': trash,
        poso_symbashs_01: firstAmount,
        poso_symbashs_basei_oron_ergasias_01: secondAmount,
        row_01: row
    };
    const sandbox = {
        document: {
            getElementById(id) {
                return elements[id] || null;
            }
        },
        pad4(value) {
            return String(value).padStart(4, '0');
        },
        removeLockedTomStyle(instance) {
            instance.enable();
            instance.wrapper.classList.remove('ts-locked');
        },
        clearRowAmounts(idNum) {
            elements[`poso_symbashs_${idNum}`].value = '';
            elements[`poso_symbashs_basei_oron_ergasias_${idNum}`].value = '';
        },
        calculateTotal() {
            calls.calculateTotal += 1;
        },
        applyNomimaFromSymbashTotals() {
            calls.applyNomima += 1;
        },
        async handleStoixeioChange(idNum, value) {
            calls.handleStoixeioChange += 1;
            elements[`poso_symbashs_${idNum}`].value = value === '0002' ? '22.00' : '32.00';
            elements[`poso_symbashs_basei_oron_ergasias_${idNum}`].value =
                value === '0002' ? '20.00' : '30.00';
        }
    };
    vm.createContext(sandbox);
    vm.runInContext(
        [
            extractFunction(dynamicSource, 'syncHiddenTarget'),
            extractFunction(dynamicSource, 'syncStoixeioRowTrash'),
            extractFunction(dynamicSource, 'reloadStoixeioRowOptions'),
            extractFunction(dynamicSource, 'clearSingleStoixeioRow')
        ].join('\n'),
        sandbox
    );
    async function selectNewValue(value) {
        tom.value = value;
        select.value = value;
        sandbox.syncHiddenTarget('01', value);
        sandbox.syncStoixeioRowTrash('01');
        await sandbox.handleStoixeioChange('01', value);
    }

    return {
        sandbox,
        calls,
        trash,
        hidden,
        savedHidden,
        firstAmount,
        secondAmount,
        row,
        tom,
        select,
        eventListeners,
        selectNewValue,
        instanceCount: 1
    };
}

test('dynamic preselected, empty and newly selected rows synchronize external trash', () => {
    const preselected = createDynamicHarness({ tomValue: '0001' });
    assert.equal(preselected.sandbox.syncStoixeioRowTrash('01'), true);
    assert.equal(preselected.trash.hidden, false);

    preselected.tom.value = '';
    preselected.select.value = '';
    preselected.hidden.value = '';
    assert.equal(preselected.sandbox.syncStoixeioRowTrash('01'), false);
    assert.equal(preselected.trash.hidden, true);

    preselected.tom.value = '0002';
    assert.equal(preselected.sandbox.syncStoixeioRowTrash('01'), true);
    assert.equal(preselected.trash.hidden, false);
});

test('preselected dynamic trash reloads options once and stays enabled, closed and empty', async () => {
    const harness = createDynamicHarness({ tomValue: '0001', hiddenValue: '0001' });
    harness.sandbox.syncStoixeioRowTrash('01');
    await harness.sandbox.clearSingleStoixeioRow('01');

    assert.equal(harness.tom.getValue(), '');
    assert.equal(harness.hidden.value, '');
    assert.equal(harness.savedHidden.value, '');
    assert.equal(harness.firstAmount.value, '');
    assert.equal(harness.secondAmount.value, '');
    assert.ok(harness.calls.enable >= 2);
    assert.equal(harness.calls.clear, 1);
    assert.equal(harness.calls.clearOptions, 1);
    assert.equal(harness.calls.loadCalls, 1);
    assert.deepEqual(harness.calls.loadedQuery, ['']);
    assert.equal(harness.select.dataset.preloadAll, 'true');
    assert.equal(harness.tom.settings._preloadAll, true);
    assert.equal(harness.tom.nextPage, null);
    assert.deepEqual(harness.calls.setTextboxValue, ['']);
    assert.equal(harness.calls.clearFilter, 1);
    assert.deepEqual(harness.calls.refreshOptionsCalls, [false]);
    assert.equal(harness.calls.calculateTotal, 1);
    assert.equal(harness.calls.applyNomima, 1);
    assert.equal(harness.calls.open, 0);
    assert.equal(harness.tom.isOpen, false);
    assert.equal(harness.trash.hidden, true);
    assert.equal(harness.row.hidden, false);
    assert.deepEqual(Object.keys(harness.tom.options), ['0002', '0003']);
    assert.equal(harness.firstAmount.value, '');
    assert.equal(harness.secondAmount.value, '');
});

test('clear/reload permits a new selection and recalculates both amounts', async () => {
    const harness = createDynamicHarness({ tomValue: '0001', hiddenValue: '0001' });
    await harness.sandbox.clearSingleStoixeioRow('01');
    await harness.selectNewValue('0002');

    assert.equal(harness.hidden.value, '0002');
    assert.equal(harness.savedHidden.value, '0002');
    assert.equal(harness.firstAmount.value, '22.00');
    assert.equal(harness.secondAmount.value, '20.00');
    assert.equal(harness.calls.handleStoixeioChange, 1);
    assert.equal(harness.trash.hidden, false);
});

test('two clear/reselect cycles reuse one TomSelect and one change listener', async () => {
    const harness = createDynamicHarness({ tomValue: '0001', hiddenValue: '0001' });
    const originalTom = harness.select.tomselect;
    const originalChangeListeners = harness.eventListeners.get('change').size;

    await harness.sandbox.clearSingleStoixeioRow('01');
    await harness.selectNewValue('0002');
    await harness.sandbox.clearSingleStoixeioRow('01');
    await harness.selectNewValue('0003');

    assert.equal(harness.select.tomselect, originalTom);
    assert.equal(harness.instanceCount, 1);
    assert.equal(harness.eventListeners.get('change').size, originalChangeListeners);
    assert.equal(harness.calls.clear, 2);
    assert.equal(harness.calls.loadCalls, 2);
    assert.deepEqual(harness.calls.loadedQuery, ['', '']);
    assert.equal(harness.calls.handleStoixeioChange, 2);
});

test('saved and initially empty rows normalize to the same preload/search behavior after clear', async () => {
    const saved = createDynamicHarness({
        tomValue: '0001',
        hiddenValue: '0001',
        preloadAll: false
    });
    const empty = createDynamicHarness({ preloadAll: true });

    await saved.sandbox.clearSingleStoixeioRow('01');
    await empty.sandbox.clearSingleStoixeioRow('01');

    for (const harness of [saved, empty]) {
        assert.equal(harness.select.dataset.preloadAll, 'true');
        assert.equal(harness.tom.settings._preloadAll, true);
        assert.equal(harness.tom.nextPage, null);
        assert.equal(harness.calls.loadCalls, 1);
        assert.deepEqual(harness.calls.loadedQuery, ['']);
        assert.deepEqual(Object.keys(harness.tom.options), ['0002', '0003']);
        assert.equal(harness.calls.open, 0);
    }
});

test('all edit Apodoxes dropdowns own exactly one external trash contract', () => {
    for (const id of ['symbash', 'kathgoria_symbashs', 'eidikothta_symbashs']) {
        assert.equal((viewSource.match(new RegExp(`data-tom-target="${id}"`, 'g')) || []).length, 1);
    }
    assert.match(viewSource, /data-external-reset="true"/);
    assert.match(dynamicSource, /data-external-reset="true"/);
    assert.match(dropdownSource, /dataset\.externalReset === 'true'/);
    assert.match(dropdownSource, /querySelectorAll\('\.ts-single-reset-btn'\).*remove/);
    assert.match(dynamicSource, /container\.innerHTML = ''/);
    assert.match(dynamicSource, /container\.addEventListener\('click'/);
    assert.doesNotMatch(dynamicSource, /addEventListener\('click'[\s\S]*addEventListener\('click'/);
});

test('preselect, change and rehydration paths explicitly resynchronize dynamic trash', () => {
    assert.match(dynamicSource, /tomInst\.setValue\(kodikos, true\);\s*syncHiddenTarget\(idNum, kodikos\);\s*syncStoixeioRowTrash\(idNum\)/);
    assert.match(dynamicSource, /syncHiddenTarget\(idNum, value \|\| ''\);\s*syncStoixeioRowTrash\(idNum\)/);
    assert.match(dynamicSource, /syncStoixeioRowTrash\(idNum\);\s*}\s*\n\s*\/\//);
    assert.match(dynamicSource, /tom\.setValue\(kodikos, true\);\s*syncStoixeioRowTrash\(idNum\)/);
});

test('reload helper keeps the original endpoint filters and uses public load APIs', () => {
    assert.match(
        dynamicSource,
        /url: '\/api\/dropdown\/symbaseis\/stoixeio_symbashs'[\s\S]*symbash_stathera: symbashVal[\s\S]*kathgoria_symbashs_stathera: kathgoriaVal[\s\S]*eidikothta_symbashs_stathera: eidikothtaVal[\s\S]*padLength: '4'/
    );
    assert.match(dynamicSource, /selectEl\.dataset\.preloadAll = 'true'/);
    assert.match(dynamicSource, /tom\.settings\._preloadAll = true/);
    assert.match(dynamicSource, /tom\.nextPage = null/);
    assert.match(dynamicSource, /tom\.setTextboxValue\(''\)/);
    assert.match(dynamicSource, /tom\.clearFilter\(\)/);
    assert.match(dynamicSource, /tom\.on\('load', finish\)/);
    assert.match(dynamicSource, /tom\.load\(''\)/);
    assert.match(dynamicSource, /tom\.refreshOptions\(false\)/);
    assert.doesNotMatch(extractFunction(dynamicSource, 'reloadStoixeioRowOptions'), /tom\.open\(/);
});

test('basic trash delegates to the existing contract cascade callbacks', () => {
    assert.match(chainSource, /symNode\.__onClearChain = \(\) => \{\s*cascadeFromSym\(\)/);
    assert.match(chainSource, /katNode\.__onClearChain = \(\) => \{\s*cascadeFromKat\(\)/);
    assert.match(chainSource, /eidNode\.__onClearChain = \(\) => \{\s*cascadeFromEid\(\)/);
    assert.match(chainSource, /clearBasicSelectionThroughChain\(button\.dataset\.tomTarget\)/);
    assert.match(chainSource, /clearDownstreamOfSym\(\)/);
    assert.match(chainSource, /clearDownstreamOfKat\(\)/);
    assert.match(chainSource, /window\.clearStoixeiaSymbaseonContainer/);
});

test('trash markup, tooltip, aria and CSS remain scoped and CSP-safe', () => {
    const combinedMarkup = `${viewSource}\n${dynamicSource}`;
    assert.doesNotMatch(combinedMarkup, /\son(?:click|change)\s*=/i);
    assert.doesNotMatch(combinedMarkup, /bi bi-x-lg cdarkred/);
    assert.match(combinedMarkup, /bi bi-trash cdarkred/);
    assert.match(combinedMarkup, /Ακύρωση τρέχουσας επιλογής/);
    assert.match(combinedMarkup, /aria-label="Ακύρωση τρέχουσας επιλογής"/);
    assert.match(cssSource, /#editApodoxesTomDropdownScope \.edit-apodoxes-tom-trash/);
});
