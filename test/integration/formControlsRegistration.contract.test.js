'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {createRequire} = require('node:module');
const filename = path.join(__dirname, 'formControls.browser.test.js');
const source = fs.readFileSync(filename, 'utf8');
const browserRequire = createRequire(filename);
const independent = [
    'Presentation initialization preserves every original control, form owner, value, disabled state and FormData',
    'Dynamic Tom catalogs: 0/1/2/20/70 entries, real scrolling, search, selection and clear',
    'Employee Add Tom dropdowns settle above/below at scrollport edges in every supported viewport',
    'Employee document dialogs keep their full actions inside every viewport without uploading',
    'Actual employee information hover panel fits the form and remains reachable',
    'Actual controls retain readable sizes, focus/error/disabled states and native interactions'
];

function registrations(shard) {
    const names = [], env = {...process.env};
    delete env.PAYROLL_FORM_CONTROLS_SHARD;
    delete env.PAYROLL_FORM_FILTER;
    if (shard !== undefined) env.PAYROLL_FORM_CONTROLS_SHARD = shard;
    // Evaluate the real module initialization; record test registration without
    // invoking browser bodies. The normal CI command still runs those bodies.
    vm.runInNewContext(source, {
        require: id => id === 'node:test' ? {test: name => names.push(name)} : browserRequire(id),
        process: {env}, console, __dirname, __filename: filename
    }, {filename});
    return names;
}

test('No explicit shard registers zero functional shards and all six independent tests', () => {
    assert.deepEqual(registrations(), independent);
});

for (let shard = 0; shard < 8; shard++) {
    test(`Explicit shard ${shard} registers exactly that shard and preserves independent tests`, () => {
        const names = registrations(String(shard));
        assert.deepEqual(names.filter(name => name.startsWith('Functional controls shard ')), [`Functional controls shard ${shard}`]);
        assert.deepEqual(names.filter(name => !name.startsWith('Functional controls shard ')), independent);
    });
}

test('Invalid explicit shards fail clearly during registration', () => {
    for (const shard of ['', '-1', '8', '1.5', '00', ' 0', '7 ', 'NaN', 'invalid']) {
        assert.throws(() => registrations(shard), /Invalid PAYROLL_FORM_CONTROLS_SHARD: .*; expected 0\.\.7/);
    }
});

test('CI checks registration before long tests and employee-mongodb cannot inherit a shard', () => {
    const workflow = fs.readFileSync(path.resolve(__dirname, '../../.github/workflows/ci-validation.yml'), 'utf8');
    const employee = workflow.slice(workflow.indexOf('\n  employee-mongodb:'), workflow.indexOf('\n  form-controls:'));
    const matrix = workflow.slice(workflow.indexOf('\n  form-controls:'), workflow.indexOf('\n  employment-review-browser:'));
    for (const job of [employee, matrix]) {
        const preflight = job.indexOf('node --test test/integration/formControlsRegistration.contract.test.js');
        assert.ok(preflight > 0 && preflight < job.indexOf('- name: Install Chromium and system dependencies'));
    }
    assert.match(employee, /env -u PAYROLL_FORM_CONTROLS_SHARD node --test test\/integration\/formControls\.browser\.test\.js/);
    assert.doesNotMatch(employee, /--test-name-pattern/);
    assert.match(matrix, /PAYROLL_FORM_CONTROLS_SHARD: \$\{\{ matrix\.shard \}\}/);
    assert.ok(matrix.includes('--test-name-pattern="^Functional controls shard ${PAYROLL_FORM_CONTROLS_SHARD}$"'));
});
