'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const dailyRestValidation = require('./dailyRestValidation');
const { twoDaySchedule } = require('../../../../test/fixtures/employeeDailyRestFixtures');

const source = fs.readFileSync(path.join(__dirname, 'putFieldValues.js'), 'utf8');

function productionSaveValidator({ formData, swalCalls, renderedViolations }) {
    const start = source.indexOf('function showWorkScheduleSection()');
    const end = source.indexOf('\n    async function handleFormSubmit(', start);
    assert.ok(start >= 0 && end > start);

    const classNames = new Set();
    const scheduleTab = {
        textContent: 'Ωράριο Εργασίας',
        classList: {
            contains(name) {
                return classNames.has(name);
            }
        },
        clickCalls: 0,
        click() {
            this.clickCalls++;
            classNames.add('active');
        }
    };
    const warning = {
        scrollCalls: [],
        scrollIntoView(options) {
            this.scrollCalls.push(options);
        }
    };
    const elements = new Map([['daily-rest-violation-warning', warning]]);
    for (let index = 1; index <= 3; index++) {
        const suffix = String(index).padStart(2, '0');
        elements.set(`day_label_${suffix}`, { textContent: `Ημέρα ${index}` });
    }
    const scheduleInputs = Object.entries(formData).map(([name, value]) => ({
        name,
        value,
        focusCalls: 0,
        focus() {
            this.focusCalls++;
        }
    }));
    const document = {
        querySelectorAll(selector) {
            return selector === '.menu_Links li' ? [scheduleTab] : [];
        },
        getElementById(id) {
            return elements.get(id) || null;
        }
    };
    const window = {
        EmployeeDailyRestValidation: dailyRestValidation,
        renderEmployeeDailyRestViolations(violations) {
            renderedViolations.push(violations);
        }
    };
    const Swal = {
        async fire(options) {
            swalCalls.push(options);
            return { isConfirmed: true };
        }
    };
    const context = vm.createContext({ document, window, Swal });
    vm.runInContext(
        `${source.slice(start, end)}\nthis.validateSave = blockSaveForDailyRestViolation;`,
        context
    );
    return {
        validateSave: context.validateSave,
        scheduleInputs,
        scheduleTab,
        warning
    };
}

test('ten-hour rest blocks Save before persistence/upload and preserves schedule state', async () => {
    const formData = twoDaySchedule(
        [{ start: '14:00', end: '22:00' }],
        [{ start: '08:00', end: '16:00' }]
    );
    const before = JSON.parse(JSON.stringify(formData));
    const swalCalls = [];
    const renderedViolations = [];
    const harness = productionSaveValidator({ formData, swalCalls, renderedViolations });

    assert.equal(await harness.validateSave(formData), true);
    assert.deepEqual(formData, before);
    assert.equal(renderedViolations.length, 1);
    assert.equal(renderedViolations[0][0].restMinutes, 600);
    assert.equal(harness.scheduleTab.clickCalls, 1);
    assert.equal(harness.warning.scrollCalls.length, 1);
    assert.equal(harness.warning.scrollCalls[0].behavior, 'smooth');
    assert.equal(harness.warning.scrollCalls[0].block, 'nearest');
    assert.equal(swalCalls.length, 1);
    assert.equal(swalCalls[0].returnFocus, false);
    assert.equal(swalCalls[0].title, 'Δεν είναι δυνατή η αποθήκευση');
    assert.match(swalCalls[0].text, /11 ωρών/);
    assert.equal(
        harness.scheduleInputs.reduce((sum, input) => sum + input.focusCalls, 0),
        0
    );
});

test('exactly eleven hours allows the normal Save path without a warning message', async () => {
    const formData = twoDaySchedule(
        [{ start: '14:00', end: '22:00' }],
        [{ start: '09:00', end: '17:00' }]
    );
    const swalCalls = [];
    const renderedViolations = [];
    const harness = productionSaveValidator({ formData, swalCalls, renderedViolations });

    assert.equal(await harness.validateSave(formData), false);
    assert.equal(swalCalls.length, 0);
    assert.equal(renderedViolations.length, 0);
    assert.equal(harness.scheduleTab.clickCalls, 0);
});

test('actual submit handler invokes daily-rest gate before every side-effect phase', () => {
    const gate = source.indexOf('if (await blockSaveForDailyRestViolation(formData)) return;');
    const fileReadCompletion = source.indexOf('await Promise.all(filePromises);');
    const pdfPreparation = source.indexOf('window.pdfUploadModule', gate);
    const persistence = source.indexOf("fetch('/api/ergazomenoi/update/", gate);

    assert.ok(gate > source.indexOf("console.log('📦 Συλλεγμένα δεδομένα φόρμας:'"));
    assert.ok(gate < fileReadCompletion);
    assert.ok(gate < pdfPreparation);
    assert.ok(gate < persistence);

    const helper = source.slice(
        source.indexOf('async function blockSaveForDailyRestViolation('),
        source.indexOf('\n    async function handleFormSubmit(')
    );
    assert.doesNotMatch(helper, /fetch\s*\(|upload|location\.|\.focus\s*\(/i);
});

test('shared core is loaded before live and Save validation on Add/Edit pages', () => {
    for (const page of ['add.ejs', 'edit.ejs']) {
        const pageSource = fs.readFileSync(
            path.join(__dirname, '../../../../views/ergazomenoi/ergazomenoi', page),
            'utf8'
        );
        const core = pageSource.indexOf("script('ergazomenoi/genika/dailyRestValidation')");
        const live = pageSource.indexOf(
            `script('ergazomenoi/genika/date_sync_${page.startsWith('add') ? 'add' : 'edit'}')`
        );
        assert.ok(core >= 0 && core < live, page);
        if (page === 'edit.ejs') {
            const save = pageSource.lastIndexOf("script('ergazomenoi/genika/putFieldValues')");
            assert.ok(core < save);
        }
    }
});
