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
const initCalls = [];

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
            if (!silent) (handlers.change || []).forEach((callback) => callback(value));
        },
        clear(silent) {
            this.value = '';
            if (!silent) {
                (handlers.clear || []).forEach((callback) => callback());
                (handlers.change || []).forEach((callback) => callback(''));
            }
        },
        destroy() { this.input.tomselect = null; },
        enable() { this.input.disabled = false; }
    };
}
elements.set('reviewEmployee', {
    id: 'reviewEmployee', disabled: false, tomselect: null, handlers: {},
    dataset: { api: '/api/dropdown/kinhseis/apasxolhseis/ergazomenoi',
        targetInput: 'kodikos' },
    addEventListener(event, callback) { (this.handlers[event] ||= []).push(callback); },
    replaceChildren() {}
});
elements.set('kodikos', { id: 'kodikos', value: '' });

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
    initTomDropdown(options) {
        const { selector } = options;
        initCount++;
        initCalls.push(options);
        const input = elements.get(selector.slice(1));
        initCalls[initCalls.length - 1].disabledAtInitialization = input.disabled;
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
    assert.strictEqual(elements.get('reviewEmployee').disabled, true);
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
    assert.strictEqual(initCount, 2, 'the employee control initializes after branch selection');
    assert.strictEqual(elements.get('reviewEmployee').disabled, false);
    const employeeCall = initCalls[1];
    assert.strictEqual(employeeCall.disabledAtInitialization, false);
    assert.strictEqual(employeeCall.minChars, 1);
    assert.strictEqual(employeeCall.extraParams.ypokatasthma, '0001');
    assert.strictEqual(employeeCall.extraParams.energoi, 'true');
    const rendered = employeeCall.render.option({ value: '0001', kodikos: '0001',
        eponymo: 'ΚΑΡΑΣΤΕΡΙΟΥ', onoma: 'ΑΓΓΕΛΙΚΗ' }, String);
    assert.match(rendered, /0001 — ΚΑΡΑΣΤΕΡΙΟΥ ΑΓΓΕΛΙΚΗ/);
    elements.get('reviewEmployee').tomselect.setValue('0001', false);
    elements.get('kodikos').value = '0001';
    assert.strictEqual(elements.get('kodikos').value, '0001');

    elements.get('reviewEmployee').tomselect.setValue('0001', false);
    elements.get('kodikos').value = '0001';
    branch.addOption({ value: '0002', label: '0002 - ΝΕΟ ΥΠΟΚΑΤΑΣΤΗΜΑ' });
    branch.setValue('0002', false);
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.strictEqual(initCount, 3);
    assert.strictEqual(initCalls[2].extraParams.ypokatasthma, '0002');
    assert.strictEqual(initCalls[2].disabledAtInitialization, false);
    assert.strictEqual(elements.get('kodikos').value, '');
    assert.strictEqual(elements.get('reviewEmployee').disabled, false);

    branch.clear(false);
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.strictEqual(branch.getValue(), '');
    assert.strictEqual(elements.get('ypokatasthma_stathera_advanced').value, '');
    assert.strictEqual(elements.get('kodikos').value, '');
    assert.strictEqual(elements.get('reviewEmployee').disabled, true);
    assert.strictEqual(fetchCount, 0, 'no duplicate-control synchronization request is needed');

    assert.ok(view.includes('id="ypokatasthma_stathera_advanced"'));
    assert.ok(view.includes('id="ypokatasthma"'));
    assert.ok(view.includes('/api/dropdown/erganh/ypokatasthmata?company='));
    assert.ok(view.includes('data-preload-all="true"'));
    assert.ok(view.includes('data-pad-length="4"'));
    assert.ok(view.includes('id="reviewEmployee"'));
    assert.ok(view.includes('data-target-input="kodikos"'));
    const branchMarkup = view.slice(view.indexOf('id="ypokatasthma"'),
        view.indexOf('</select>', view.indexOf('id="ypokatasthma"')));
    const employeeMarkup = view.slice(view.indexOf('id="reviewEmployee"'),
        view.indexOf('</select>', view.indexOf('id="reviewEmployee"')));
    const employeeColumnStart = view.lastIndexOf('<div', view.indexOf('id="reviewEmployee"'));
    const employeeColumnMarkup = view.slice(employeeColumnStart,
        view.indexOf('</div>', view.indexOf('id="reviewEmployee"')));
    assert.match(branchMarkup, /data-skip-autoload="true"/);
    assert.match(employeeMarkup, /data-skip-autoload="true"/);
    assert.match(employeeColumnMarkup, /employment-review-advanced-branch/);
    assert.ok(!/<select[^>]+id="ypokatasthma"[^>]+multiple/s.test(view));
    assert.ok(source.includes("branch.toUpperCase() === 'ALL'"));
    const css = fs.readFileSync(path.join(__dirname, '../../../../public/css/main.css'), 'utf8');
    assert.match(css, /#reviewEmployee\s*\+\s*\.ts-wrapper\s*\{[^}]*width:\s*99\.75%/s);
    assert.doesNotMatch(css, /#reviewEmployee\s*\+\s*\.ts-wrapper\s+\.ts-single-reset-btn/);
    assert.strictEqual((css.match(/width:\s*99\.75%/g) || []).length, 1);
    console.log('PASS unified employment review branch TomDropdown initialization');
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
