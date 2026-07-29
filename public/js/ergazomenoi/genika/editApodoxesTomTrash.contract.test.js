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
    const start = source.indexOf(`function ${name}(`);
    assert.notEqual(start, -1, `Missing function ${name}`);
    const bodyStart = source.indexOf('{', start);
    let depth = 0;
    for (let index = bodyStart; index < source.length; index += 1) {
        if (source[index] === '{') depth += 1;
        if (source[index] === '}') depth -= 1;
        if (depth === 0) return source.slice(start, index + 1);
    }
    throw new Error(`Unterminated function ${name}`);
}

function createDynamicHarness({ tomValue = '', selectValue = '', hiddenValue = '' } = {}) {
    const calls = {
        calculateTotal: 0,
        applyNomima: 0,
        clear: 0,
        clearOptions: 0,
        enable: 0,
        open: 0
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
    const tom = {
        value: tomValue,
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
        },
        refreshItems() {},
        refreshState() {},
        close() {},
        open() {
            calls.open += 1;
        },
        control_input: { blur() {} },
        wrapper: { classList: { remove() {} } }
    };
    const select = { value: selectValue, tomselect: tom };
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
        }
    };
    vm.createContext(sandbox);
    vm.runInContext(
        [
            extractFunction(dynamicSource, 'syncHiddenTarget'),
            extractFunction(dynamicSource, 'syncStoixeioRowTrash'),
            extractFunction(dynamicSource, 'clearSingleStoixeioRow')
        ].join('\n'),
        sandbox
    );
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
        select
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

test('dynamic trash clears value, hidden and amounts while keeping row reusable', () => {
    const harness = createDynamicHarness({ tomValue: '0001', hiddenValue: '0001' });
    harness.sandbox.syncStoixeioRowTrash('01');
    harness.sandbox.clearSingleStoixeioRow('01');

    assert.equal(harness.tom.getValue(), '');
    assert.equal(harness.hidden.value, '');
    assert.equal(harness.savedHidden.value, '');
    assert.equal(harness.firstAmount.value, '');
    assert.equal(harness.secondAmount.value, '');
    assert.equal(harness.calls.enable, 1);
    assert.equal(harness.calls.clear, 1);
    assert.equal(harness.calls.clearOptions, 1);
    assert.equal(harness.calls.calculateTotal, 1);
    assert.equal(harness.calls.applyNomima, 1);
    assert.equal(harness.calls.open, 0);
    assert.equal(harness.trash.hidden, true);
    assert.equal(harness.row.hidden, false);

    harness.tom.value = '0003';
    harness.hidden.value = '0003';
    harness.savedHidden.value = '0003';
    harness.firstAmount.value = '18.00';
    harness.secondAmount.value = '15.00';
    assert.equal(harness.sandbox.syncStoixeioRowTrash('01'), true);
    assert.equal(harness.trash.hidden, false);
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
