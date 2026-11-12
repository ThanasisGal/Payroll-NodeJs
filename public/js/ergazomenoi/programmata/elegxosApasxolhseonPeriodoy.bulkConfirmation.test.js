'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, 'elegxosApasxolhseonPeriodoy.js'), 'utf8');
const start = source.indexOf('async function completeWeeklyHrStage1BulkFromUi()');
const functionSource = source.slice(start, source.indexOf("document.addEventListener('click'", start));

test('bulk completion owns the confirmation window until cancellation or response', async () => {
    const prompts = [], requests = [];
    const sandbox = {
        weeklyHrStage1BulkSubmitting: false, weeklyHrStage1DaySaving: false,
        weeklyHrStage1Selected: new Set(['one']), weeklyHrStage1Payloads: new Map([['one', {}]]),
        weeklyHrStage1Scopes: new Map([['one', { employee_id: 'employee', week_start: '2026-09-07', week_end: '2026-09-13' }]]),
        pruneHiddenWeeklyHrStage1Selections: () => new Set(['one']), weeklyHrStage1DraftCount: () => 0,
        updateWeeklyHrStage1BulkToolbar() {},
        employmentReviewSwal: options => options.input === 'textarea'
            ? new Promise(resolve => prompts.push(resolve)) : Promise.resolve({}),
        fetch: async (url, options) => { requests.push(JSON.parse(options.body)); return { ok: true,
            json: async () => ({ success: true, results: [] }) }; },
        csrfToken: 'synthetic', crypto: { randomUUID: () => 'synthetic-id' },
        loadResults: async () => true, renderWeeklyHrStage1BulkResult: () => ({ text: 'done' }), console
    };
    vm.runInNewContext(functionSource + '\nthis.runBulk = completeWeeklyHrStage1BulkFromUi;', sandbox);
    const first = sandbox.runBulk();
    const duplicate = sandbox.runBulk();
    assert.equal(prompts.length, 1, 'Two clicks must share one active confirmation');
    assert.equal(requests.length, 0);
    assert.equal(sandbox.weeklyHrStage1BulkSubmitting, true);
    prompts[0]({ isConfirmed: false });
    await Promise.all([first, duplicate]);
    assert.equal(sandbox.weeklyHrStage1BulkSubmitting, false, 'Cancel must release the action');
    const reopened = sandbox.runBulk();
    const repeated = sandbox.runBulk();
    assert.equal(prompts.length, 2);
    prompts[1]({ isConfirmed: true, value: 'Συνθετική επιβεβαίωση' });
    await Promise.all([reopened, repeated]);
    assert.equal(requests.length, 1);
    assert.equal(sandbox.weeklyHrStage1BulkSubmitting, false);
});
