'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const dailyRestValidation = require('./dailyRestValidation');
const {
    fixtures: dailyRestFixtures
} = require('../../../../test/fixtures/employeeDailyRestFixtures');

const files = ['date_sync_add.js', 'date_sync_edit.js'];
const partials = [
    path.join(
        __dirname,
        '../../../../views/ergazomenoi/ergazomenoi/partials/add/cardBodies/section8/orarioErgasias.ejs'
    ),
    path.join(
        __dirname,
        '../../../../views/ergazomenoi/ergazomenoi/partials/edit/cardBodies/section8/orarioErgasias.ejs'
    )
];

class FakeElement {
    constructor({ value = '', textContent = '', hidden = false } = {}) {
        this.value = value;
        this._textContent = textContent;
        this.hidden = hidden;
        this.dataset = {};
        this.children = [];
        this.className = '';
        this.attributes = {};
        this.replaceChildrenCalls = 0;
        this.focusCalls = 0;
    }

    get textContent() {
        return this._textContent || this.children.map((child) => child.textContent).join('');
    }

    set textContent(value) {
        this._textContent = String(value);
        this.children = [];
    }

    append(...children) {
        this.children.push(...children);
    }

    replaceChildren(...children) {
        this._textContent = '';
        this.children = children;
        this.replaceChildrenCalls++;
    }

    setAttribute(name, value) {
        this.attributes[name] = value;
    }

    focus() {
        this.focusCalls++;
    }
}

function extractProductionFunctions(source, document) {
    const helperStart = source.indexOf('function renderDailyRestViolations(');
    const calculationStart = source.indexOf('function calculateWeeklyTotalHours()', helperStart);
    const timeStart = source.indexOf('function timeToMinutes(', calculationStart);
    const timeEnd = source.indexOf('\n});', timeStart);

    assert.ok(helperStart >= 0, 'inline daily-rest renderer must exist');
    assert.ok(calculationStart > helperStart, 'weekly calculation must follow the renderer');
    assert.ok(timeStart > calculationStart && timeEnd > timeStart, 'time helper must be extractable');

    const helper = source.slice(helperStart, calculationStart);
    const calculation = source.slice(calculationStart, timeStart);
    const timeHelper = source.slice(timeStart, timeEnd);
    const window = { EmployeeDailyRestValidation: dailyRestValidation };
    const context = vm.createContext({ document, window });
    vm.runInContext(
        `${helper}\n${calculation}\n${timeHelper}\n` +
            'this.renderDailyRestViolations = renderDailyRestViolations;' +
            'this.calculateWeeklyTotalHours = calculateWeeklyTotalHours;',
        context
    );
    return {
        helper,
        calculation,
        render: context.renderDailyRestViolations,
        calculate: context.calculateWeeklyTotalHours
    };
}

function scheduleHarness(source, days = 3) {
    const elements = new Map();
    const add = (id, options) => {
        const element = new FakeElement(options);
        elements.set(id, element);
        return element;
    };

    const warning = add('daily-rest-violation-warning', { hidden: true });
    add('differenceInDays', { value: String(days) });
    add('mo_oron_hmerhsias_ergasias', { value: '8' });
    add('ores_ergasias_ebdomadas', { value: '40' });
    add('total_hours_day');

    for (let day = 1; day <= days; day++) {
        const suffix = String(day).padStart(2, '0');
        add(`kathgoria_ergasias_stathera_${suffix}`, { value: 'ΕΡΓ' });
        add(`hmeromhnia_${suffix}`, { value: `2026-09-${String(day).padStart(2, '0')}` });
        add(`day_label_${suffix}`, { textContent: `Ημέρα ${day}` });
        add(`total_hours_day_${suffix}`);
        for (let interval = 1; interval <= 3; interval++) {
            const intervalSuffix = String(interval).padStart(2, '0');
            add(`apo_ora_${intervalSuffix}_${suffix}`);
            add(`eos_ora_${intervalSuffix}_${suffix}`);
        }
    }

    const document = {
        getElementById(id) {
            return elements.get(id) || null;
        },
        createElement() {
            return new FakeElement();
        }
    };
    const production = extractProductionFunctions(source, document);
    return { ...production, elements, warning };
}

function setHours(elements, day, start, end) {
    const suffix = String(day).padStart(2, '0');
    elements.get(`apo_ora_01_${suffix}`).value = start;
    elements.get(`eos_ora_01_${suffix}`).value = end;
}

function inputValues(elements) {
    return [...elements.entries()]
        .filter(([id]) => /^(apo_ora|eos_ora|kathgoria_ergasias_stathera)_/.test(id))
        .map(([id, element]) => [id, element.value]);
}

for (const file of files) {
    test(`${file}: inline warning is stable, live, non-modal and does not touch inputs`, () => {
        const source = fs.readFileSync(path.join(__dirname, file), 'utf8');
        const { calculation, helper, calculate, elements, warning } = scheduleHarness(source);
        setHours(elements, 1, '14:00', '22:00');
        setHours(elements, 2, '08:00', '16:00');
        const originalInputs = inputValues(elements);

        assert.equal(calculate(), true);
        assert.equal(warning.hidden, false);
        assert.match(warning.textContent, /Ημέρα 1 → Ημέρα 2: 10,00 ώρες ανάπαυσης/);
        assert.equal(warning.replaceChildrenCalls, 1);
        const originalChildren = warning.children;

        assert.equal(calculate(), true);
        assert.equal(warning.replaceChildrenCalls, 1);
        assert.equal(warning.children, originalChildren);

        elements.get('kathgoria_ergasias_stathera_03').value = 'ΑΝ';
        assert.equal(calculate(), true);
        assert.equal(warning.replaceChildrenCalls, 1);
        assert.equal(warning.children, originalChildren);
        assert.equal(warning.hidden, false);

        setHours(elements, 1, '14:00', '23:00');
        assert.equal(calculate(), true);
        assert.equal(warning.replaceChildrenCalls, 2);
        assert.match(warning.textContent, /9,00 ώρες ανάπαυσης/);

        setHours(elements, 1, '14:00', '21:00');
        assert.equal(calculate(), true);
        assert.equal(warning.hidden, true);
        assert.equal(warning.textContent, '');

        setHours(elements, 1, '14:00', '22:00');
        assert.equal(calculate(), true);
        assert.equal(warning.hidden, false);
        assert.match(warning.textContent, /10,00 ώρες ανάπαυσης/);

        assert.deepEqual(inputValues(elements), originalInputs.map(([id, value]) => {
            if (id === 'eos_ora_01_01') return [id, '22:00'];
            if (id === 'kathgoria_ergasias_stathera_03') return [id, 'ΑΝ'];
            return [id, value];
        }));
        assert.equal([...elements.values()].reduce((sum, element) => sum + element.focusCalls, 0), 0);
        assert.doesNotMatch(helper, /Swal\.fire|\.focus\s*\(/);
        assert.doesNotMatch(source, /restViolationAlertOpen|showRestViolationAlert/);
        assert.match(
            calculation,
            /EmployeeDailyRestValidation\.collectDailyRestViolations\(scheduleDays\)/
        );
        assert.doesNotMatch(calculation, /restHours\s*<\s*11|restMinutes\s*=/);
        assert.match(calculation, /renderDailyRestViolations\(restViolations\);/);
    });

    test(`${file}: exact eleven hours is valid and less than eleven is shown`, () => {
        const source = fs.readFileSync(path.join(__dirname, file), 'utf8');
        const { calculate, elements, warning } = scheduleHarness(source, 2);
        setHours(elements, 1, '14:00', '21:00');
        setHours(elements, 2, '08:00', '16:00');

        calculate();
        assert.equal(warning.hidden, true);

        elements.get('eos_ora_01_01').value = '21:01';
        calculate();
        assert.equal(warning.hidden, false);
        assert.match(warning.textContent, /10,98 ώρες ανάπαυσης/);
    });

    test(`${file}: multiple violations share one panel`, () => {
        const source = fs.readFileSync(path.join(__dirname, file), 'utf8');
        const { calculate, elements, warning } = scheduleHarness(source, 3);
        setHours(elements, 1, '14:00', '22:00');
        setHours(elements, 2, '08:00', '16:00');
        setHours(elements, 3, '01:00', '09:00');

        calculate();
        assert.equal(warning.hidden, false);
        assert.equal(warning.children.length, 4);
        assert.equal(warning.children[2].children.length, 2);
        assert.match(warning.textContent, /Ημέρα 1 → Ημέρα 2: 10,00 ώρες ανάπαυσης/);
        assert.match(warning.textContent, /Ημέρα 2 → Ημέρα 3: 9,00 ώρες ανάπαυσης/);
    });

    test(`${file}: daily-rest arithmetic exists only in the shared pure core`, () => {
        const source = fs.readFileSync(path.join(__dirname, file), 'utf8');
        const { calculation } = scheduleHarness(source, 2);
        assert.doesNotMatch(calculation, /restHours\s*<\s*11|restMinutes\s*=/);
        assert.match(
            calculation,
            /EmployeeDailyRestValidation\.collectDailyRestViolations\(scheduleDays\)/
        );
    });
}

test('add/edit schedule partials contain one stable inline warning before dynamic fields', () => {
    for (const partial of partials) {
        const source = fs.readFileSync(partial, 'utf8');
        assert.equal((source.match(/id="daily-rest-violation-warning"/g) || []).length, 1);
        assert.match(
            source,
            /id="daily-rest-violation-warning"[\s\S]*?class="employee-daily-rest-warning"[\s\S]*?hidden[\s\S]*?<div id="dynamicFields"><\/div>/
        );
    }
});

test('daily-rest styling is dedicated and does not modify global alert or SweetAlert sizing', () => {
    const css = fs.readFileSync(path.join(__dirname, '../../../css/main.css'), 'utf8');
    const start = css.indexOf('.employee-daily-rest-warning {');
    const end = css.indexOf('/* Ordinary dialogs', start);
    assert.ok(start >= 0 && end > start);
    const rules = css.slice(start, end);
    assert.match(rules, /width:\s*100%/);
    assert.match(rules, /max-width:\s*100%/);
    assert.match(rules, /border-left:/);
    assert.doesNotMatch(rules, /\.swal2-popup|\.alert\s*\{/);
});

test('browser daily-rest core matches every shared parity fixture', () => {
    for (const fixture of dailyRestFixtures) {
        const days = dailyRestValidation.scheduleDaysFromFormData(fixture.formData);
        const actual = dailyRestValidation
            .collectDailyRestViolations(days)
            .map((violation) => violation.restMinutes);
        assert.deepEqual(actual, fixture.expectedRestMinutes, fixture.name);
    }
});
