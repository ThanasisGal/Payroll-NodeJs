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
    num: (value) => Number(value || 0),
    effectiveWorkHoursValue: (row) => Number(row.ores_ergasias_apologistika || 0)
};
vm.createContext(sandbox);
vm.runInContext(`${source.slice(start, end)}
this.emptyTotals = createEmptyTotals;
this.add = addRowToTotals;
this.uiOvertime = sumUiYperoria;`, sandbox);

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
