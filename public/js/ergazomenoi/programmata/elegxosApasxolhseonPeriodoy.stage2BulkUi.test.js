'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const source = fs.readFileSync(path.join(__dirname, 'elegxosApasxolhseonPeriodoy.js'), 'utf8');
const start = source.indexOf('function renderWeeklyHrStage2BulkSummary');
const end = source.indexOf('async function completeWeeklyHrStage2BulkFromUi');
assert.ok(start >= 0 && end > start);
const renderSource = source.slice(start, end);
const sandbox = { currentWeeklyHrStage2BulkPreview: null,
    weeklyHrStage2BulkSubmitting: false, userCanRecordCanonicalDecision: () => true,
    escapeHtml: (value) => String(value), formatStage1DateKey: (value) => String(value),
    getStage2LifecycleReasonLabel: (value) => String(value) };
vm.runInNewContext(`${renderSource}\nthis.render = renderWeeklyHrStage2BulkSummary;`, sandbox);
const container = { innerHTML: '' };
sandbox.currentWeeklyHrStage2BulkPreview = { total_scopes: 10000, safe_bulk_count: 9500,
    already_resolved_count: 0, manual_exception_count: 500, exception_page: 1,
    exception_page_count: 10, exceptions: Array.from({ length: 50 }, (_, index) => ({
        employee_kodikos: String(index), week_start: '2026-05-04', week_end: '2026-05-10',
        code: 'MANUAL_REVIEW' })) };
assert.equal(sandbox.render(container), true);
assert.match(container.innerHTML, /Μαζική ενημέρωση 9500 περιπτώσεων/);
assert.equal((container.innerHTML.match(/weekly-hr-stage2-exception/g) || []).length, 50);
assert.doesNotMatch(container.innerHTML, /employment-review-stage2-proposal/);
assert.doesNotMatch(container.innerHTML, /Προτάσεις Μεταφοράς Ρεπό|Ροή έγκρισης HR/);
sandbox.currentWeeklyHrStage2BulkPreview = { safe_bulk_count: 0,
    already_resolved_count: 500, manual_exception_count: 0, exceptions: [] };
sandbox.render(container);
assert.match(container.innerHTML, /Δεν υπάρχουν εκκρεμείς μεταφορές ρεπό/);
assert.doesNotMatch(container.innerHTML, /<article/);
assert.match(source, /stage2\/bulk-preview/);
assert.match(source, /stage2\/bulk-complete/);
console.log('weekly HR Stage-2 compact bulk UI tests passed');
