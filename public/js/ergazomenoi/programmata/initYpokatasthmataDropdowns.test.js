const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const sourcePath = path.join(__dirname, 'initYpokatasthmataDropdowns.js');
const viewPath = path.join(
    __dirname,
    '../../../../views/ergazomenoi/programmata/elegxosApasxolhseonPeriodoy.ejs'
);
const source = fs.readFileSync(sourcePath, 'utf8').replace(
    "import { initTomDropdown } from '../../dropdown-item.js';",
    ''
);
const view = fs.readFileSync(viewPath, 'utf8');
const callbacks = {};
const elements = new Map();
let domReady;
let initCount = 0;
let fetchCount = 0;

function tom(input) {
    const handlers = {};
    return {
        input,
        options: {},
        value: '',
        on(event, callback) {
            (handlers[event] ||= []).push(callback);
        },
        addOption(item) {
            this.options[item.value] = item;
        },
        getValue() {
            return this.value;
        },
        setValue(value, silent) {
            this.value = value;
            if (!silent) (this.input.handlers.change || []).forEach((callback) => callback());
        },
        clear(silent) {
            this.value = '';
            if (!silent) (handlers.clear || []).forEach((callback) => callback());
        }
    };
}

for (const [id, hiddenId] of [
    ['ypokatasthmata', 'ypokatasthmata_stathera'],
    ['ypokatasthma', 'ypokatasthma_stathera_advanced']
]) {
    elements.set(id, {
        id,
        dataset: {
            api: '/api/dropdown/erganh/ypokatasthmata?company=company',
            targetInput: hiddenId
        },
        tomselect: null,
        handlers: {},
        addEventListener(event, callback) {
            (this.handlers[event] ||= []).push(callback);
        }
    });
    elements.set(hiddenId, { id: hiddenId, value: '' });
}

const sandbox = {
    document: {
        getElementById: (id) => elements.get(id) || null,
        addEventListener(event, callback) {
            if (event === 'DOMContentLoaded') domReady = callback;
        }
    },
    window: { __tomInstances: {} },
    fetch: async () => {
        fetchCount++;
        return {
            async json() {
                return { items: [{ value: '0000', label: '0000 - ΕΔΡΑ' }] };
            }
        };
    },
    initTomDropdown({ selector }) {
        initCount++;
        const input = elements.get(selector.slice(1));
        const instance = tom(input);
        input.tomselect = instance;
        sandbox.window.__tomInstances[selector] = instance;
        return instance;
    },
    console
};

vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: sourcePath });

(async () => {
    assert.strictEqual(typeof domReady, 'function');
    await domReady();
    assert.strictEqual(initCount, 2, 'simple and advanced controls initialize once');
    assert.strictEqual(
        JSON.stringify(sandbox.window.EmploymentReviewBranches.diagnostics()),
        JSON.stringify({
            simple: '',
            advanced: '',
            simpleInitialized: true,
            advancedInitialized: true
        })
    );

    const simple = elements.get('ypokatasthmata').tomselect;
    const advanced = elements.get('ypokatasthma').tomselect;
    simple.addOption({ value: '0000', label: '0000 - ΕΔΡΑ' });
    simple.setValue('0000', false);
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.strictEqual(advanced.getValue(), '0000');
    assert.strictEqual(elements.get('ypokatasthma_stathera_advanced').value, '0000');
    assert.strictEqual(advanced.options['0000'].label, '0000 - ΕΔΡΑ');

    advanced.addOption({ value: '0001', label: '0001 - ΥΠΟΚΑΤΑΣΤΗΜΑ' });
    advanced.setValue('0001', false);
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.strictEqual(simple.getValue(), '0001');
    assert.strictEqual(elements.get('ypokatasthmata_stathera').value, '0001');

    advanced.clear(false);
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.strictEqual(simple.getValue(), '');
    assert.strictEqual(elements.get('ypokatasthmata_stathera').value, '');
    assert.ok(fetchCount <= 2, 'guarded sync must not loop or duplicate initialization');

    assert.ok(view.includes('id="ypokatasthma_stathera_advanced"'));
    assert.ok(view.includes('id="ypokatasthma"'));
    assert.ok(view.includes('/api/dropdown/erganh/ypokatasthmata?company='));
    assert.ok(view.includes('data-preload-all="true"'));
    assert.ok(view.includes('data-pad-length="4"'));
    assert.ok(!/<select[^>]+id="ypokatasthma"[^>]+multiple/s.test(view));
    assert.ok(source.includes("branch.toUpperCase() === 'ALL'"));
    console.log('PASS employment review branch TomDropdown initialization and sync');
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
