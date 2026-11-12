'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname,
    'elegxosApasxolhseonPeriodoy.js'), 'utf8');
const start = source.indexOf('function createEmptyTotals');
const end = source.indexOf('function buildDeviationsByKodikos', start);
const sandbox = {
    EmploymentReviewNumbers: require('./employmentReviewNumbers'),
    num: (value) => Number(value || 0),
    hours: (value) => Number(value || 0).toFixed(2)
};
vm.createContext(sandbox);
const effectiveHoursSource = source.slice(source.indexOf('function effectiveWorkHoursValue'),
    source.indexOf('function ensureReviewTableStructure'));
vm.runInContext(`${effectiveHoursSource}\n${source.slice(start, end)}
this.emptyTotals = createEmptyTotals;
this.add = addRowToTotals;
this.uiOvertime = sumUiYperoria;
this.effectiveHours = effectiveWorkHoursValue;
this.renderHours = renderHoursCell;`, sandbox);

const row = {
    ores_nominhs_yperorias_apologistika: 5,
    ores_nominhs_yperorias_nyxtas_apologistika: 3,
    ores_nominhs_yperorias_argion_apologistika: 2,
    ores_nominhs_yperorias_argion_nyxtas_apologistika: 3.19,
    ores_paranomhs_yperorias_apologistika: 0,
    ores_paranomhs_yperorias_nyxtas_apologistika: 0,
    ores_paranomhs_yperorias_argion_apologistika: 4.98,
    ores_paranomhs_yperorias_argion_nyxtas_apologistika: 0
};

assert.equal(sandbox.uiOvertime(row), 18.17);
const totals = sandbox.emptyTotals();
sandbox.add(totals, row);
assert.equal(totals.nomimiYperoria, 13.19);
assert.equal(totals.paranomiYperoria, 4.98);
assert.equal(totals.uiYperoria, 18.17);

const fullDayLeave = { adeia_apologistika: true,
    kathgoria_adeias_apologistika: 'ΑΔΚΑΝ', ores_ergasias: 2,
    ores_ergasias_apologistika: 2,
    ores_pragmatikhs_ergasias_apologistika: 0 };
assert.equal(sandbox.effectiveHours(fullDayLeave), 2);
assert.match(sandbox.renderHours(fullDayLeave), /2\.00/);
const leaveTotals = sandbox.emptyTotals();
leaveTotals.ores_ergasias_apologistika = 34;
sandbox.add(leaveTotals, fullDayLeave);
assert.equal(leaveTotals.ores_ergasias_apologistika, 36);
assert.equal(sandbox.effectiveHours({ ...fullDayLeave,
    ores_pragmatikhs_ergasias_apologistika: 0 }), 2);

const { reviewTotalsFixture } = require('../../../../test/fixtures/employmentReviewTotalsFixture');
const mixedRows = reviewTotalsFixture().rows;
const before = structuredClone(mixedRows), mixedTotals = sandbox.emptyTotals();
mixedRows.forEach(row => sandbox.add(mixedTotals, row));
assert.equal(mixedTotals.ores_ergasias_apologistika, 23.5);
assert.equal(mixedTotals.ores_apoysias_apologistika, 0.5);
assert.equal(mixedTotals.uiYperoria, null);
assert.equal(sandbox.effectiveHours({ cards_ores_ergasias: 8 }), null,
    'a missing calculated value cannot be replaced with raw attendance hours');
const incomplete = { ...mixedRows[0], ores_nyxtas_apologistika: null };
sandbox.add(mixedTotals, incomplete);
assert.equal(mixedTotals.ores_nyxtas_apologistika, null);
assert.equal(mixedTotals.ores_ergasias_apologistika, 31.5);
assert.equal(sandbox.uiOvertime({ ...row, ores_nominhs_yperorias_argion_nyxtas_apologistika: null }), null);
assert.deepEqual(mixedRows, before);

const employeeTotalsRenderer = source.slice(
    source.indexOf('function appendEmployeeTotalsRow'),
    source.indexOf('function buildDeviationsByKodikos')
);
const grandTotalsRenderer = source.slice(
    source.indexOf('function appendGrandTotalsRow'),
    source.indexOf('function buildScenarioReviewParams')
);
const dailyRenderer = source.slice(
    source.indexOf('function renderReviewRows'),
    source.indexOf('function updateAuthoritativeReviewDailyRow')
);
assert.match(employeeTotalsRenderer, /hours\(totals\.uiYperoria\)/);
assert.match(grandTotalsRenderer, /hours\(totals\.uiYperoria\)/);
assert.match(dailyRenderer, /const yperoriaTotal = sumUiYperoria\(row\)/);

console.log('UI overtime aggregate presentation tests passed');
