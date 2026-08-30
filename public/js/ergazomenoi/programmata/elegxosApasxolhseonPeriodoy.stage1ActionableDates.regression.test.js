'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, 'elegxosApasxolhseonPeriodoy.js'), 'utf8');
const functionSource = source.match(/function stage1RelevantDates\(payload\) \{[\s\S]*?\n}/)?.[0];
assert.ok(functionSource, 'stage1RelevantDates must exist');

const stage1RelevantDates = vm.runInNewContext(
    `(() => { ${functionSource}; return stage1RelevantDates; })()`
);
const result = (payload) => JSON.parse(JSON.stringify(stage1RelevantDates(payload)));

const relevantPayload = {
    workflow: { possible_leave_days: ['2026-01-04', '2026-01-02'] },
    confirmed_leave_dates: ['2026-01-03'],
    confirmed_sickness_dates: [],
    confirmed_absence_dates: [],
    period_slice: { actionable_dates: ['2026-01-03', '2026-01-04'] }
};

assert.deepEqual(result(relevantPayload), ['2026-01-03', '2026-01-04']);

assert.deepEqual(result({
    workflow: { possible_leave_days: ['2026-01-02'] },
    confirmed_leave_dates: [],
    confirmed_sickness_dates: [],
    confirmed_absence_dates: [],
    period_slice: { actionable_dates: ['2026-01-03', '2026-01-04'] }
}), []);

const duplicateSources = {
    workflow: { possible_leave_days: ['2026-01-04', '2026-01-02', '2026-01-03'] },
    confirmed_leave_dates: ['2026-01-03'],
    confirmed_sickness_dates: ['2026-01-02'],
    confirmed_absence_dates: ['2026-01-04', '2026-01-02']
};
const uniqueSortedDates = ['2026-01-02', '2026-01-03', '2026-01-04'];

assert.deepEqual(result(duplicateSources), uniqueSortedDates);
assert.deepEqual(result({ ...duplicateSources,
    period_slice: { actionable_dates: [] }
}), uniqueSortedDates);

console.log('Stage 1 actionable dates regression tests: PASS');
