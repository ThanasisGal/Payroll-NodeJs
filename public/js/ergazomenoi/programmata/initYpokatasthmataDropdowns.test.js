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
    assert.strictEqual(initCount, 1, 'the unified branch control initializes once');
    assert.strictEqual(
        JSON.stringify(sandbox.window.EmploymentReviewBranches.diagnostics()),
        JSON.stringify({
            branch: '',
            initialized: true
        })
    );

    const branch = elements.get('ypokatasthma').tomselect;
    branch.addOption({ value: '0001', label: '0001 - ΥΠΟΚΑΤΑΣΤΗΜΑ' });
    branch.setValue('0001', false);
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.strictEqual(branch.getValue(), '0001');
    assert.strictEqual(elements.get('ypokatasthma_stathera_advanced').value, '0001');

    branch.clear(false);
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.strictEqual(branch.getValue(), '');
    assert.strictEqual(elements.get('ypokatasthma_stathera_advanced').value, '');
    assert.strictEqual(fetchCount, 0, 'no duplicate-control synchronization request is needed');

    assert.ok(view.includes('id="ypokatasthma_stathera_advanced"'));
    assert.ok(view.includes('id="ypokatasthma"'));
    assert.ok(view.includes('/api/dropdown/erganh/ypokatasthmata?company='));
    assert.ok(view.includes('data-preload-all="true"'));
    assert.ok(view.includes('data-pad-length="4"'));
    assert.ok(!/<select[^>]+id="ypokatasthma"[^>]+multiple/s.test(view));
    assert.ok(source.includes("branch.toUpperCase() === 'ALL'"));
    console.log('PASS unified employment review branch TomDropdown initialization');
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
