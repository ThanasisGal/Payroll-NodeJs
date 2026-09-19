'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, 'elegxosApasxolhseonPeriodoy.js'), 'utf8');
const orphanRenderer = source.slice(source.indexOf('function renderWeeklyHrOrphanItem'),
    source.indexOf('function weeklyHrStage1Counts'));
const clickHandler = source.slice(source.indexOf("document.addEventListener('click'"),
    source.indexOf("document.addEventListener('change'"));

assert.match(orphanRenderer, /class="[^"]*weekly-hr-open-orphan[^"]*"[^>]*data-row-id="\$\{escapeHtml\(row\._id\)\}"/);

const orphanBranch = clickHandler.slice(clickHandler.indexOf("const orphanButton = event.target.closest('.weekly-hr-open-orphan')"),
    clickHandler.indexOf("const dayButton = event.target.closest('.weekly-hr-open-day')"));
assert.match(orphanBranch, /orphanButton\.dataset\.rowId/);
assert.match(orphanBranch, /currentReviewRows\.find/);
assert.match(orphanBranch, /weeklyHrStage1RowsById\.get\(orphanButton\.dataset\.rowId\)/);
assert.match(orphanBranch, /if \(row\) showDetailsModal\(row, \{ orphanResolution: true \}\); return;/);

assert.match(clickHandler, /const dayButton = event\.target\.closest\('\.weekly-hr-open-day'\)/);
assert.match(clickHandler, /weeklyHrStage1RowsById\.get\(dayButton\.dataset\.rowId\)/);
assert.match(clickHandler, /if \(row\) showDetailsModal\(row\); return;/);

console.log('Employment Review orphan button click contract: PASS');

const expectedReason = 'Η προτεινόμενη από την εφαρμογή επίλυση του ορφανού χτυπήματος ελέγχθηκε και εγκρίθηκε από τον HR.';
const row = { _id: 'orphan-row', orphan_card_resolution_preview: { orphanVisible: true } };
const opened = [];
vm.runInNewContext(`(() => { ${orphanBranch} })()`, {
    event: { target: { closest: () => ({ dataset: { rowId: row._id } }) } },
    currentReviewRows: [], weeklyHrStage1RowsById: new Map([[row._id, row]]),
    showDetailsModal: (...args) => opened.push(args)
});
assert.equal(opened.length, 1);
assert.equal(opened[0][0], row);
assert.equal(opened[0][1].orphanResolution, true);
// Only the orphan button supplies an opening context; all other callers stay unchanged.
assert.equal((source.match(/showDetailsModal\(row, \{ orphanResolution: true \}\)/g) || []).length, 1);
assert.equal(source.split(expectedReason).length - 1, 1);

const container = { innerHTML: '' };
const sandbox = {
    isCurrentPeriodReviewDate: () => true,
    formatDate: () => '', hasAdeiaSuggestion: () => false,
    renderReadOnlyTimeRows: () => '', renderEditableApologistikaRows: () => '',
    renderOrphanCardResolutionSection: () => '', renderScenarioDetailsSection: () => '',
    renderApologistikaFields: () => '', userCanReviewEdit: () => true,
    escapeHtml: (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;'),
    document: { getElementById: (id) => id === 'detailsContainer' ? container : null },
    bootstrap: { Modal: class { show() {} } },
    setTimeout: () => {}, initModalMoveByEnter: () => {},
    initializeOrphanResolutionPreview: () => {}
};
const modalSource = source.slice(source.indexOf('function showDetailsModal'),
    source.indexOf('function buildReviewExportParams'));
vm.runInNewContext(`${modalSource}\nthis.open = showDetailsModal;`, sandbox);
function reasonField() {
    const match = container.innerHTML.match(/<textarea id="edit_reason"([^>]*)>([\s\S]*?)<\/textarea>/);
    assert.ok(match);
    assert.match(match[1], /\bemployment-review-reason-textarea\b/);
    return { value: match[2], readonly: /\breadonly\b/.test(match[1]) };
}
sandbox.open(...opened[0]);
assert.deepEqual(reasonField(), { value: expectedReason, readonly: false });
sandbox.open(row);
assert.deepEqual(reasonField(), { value: '', readonly: false });
sandbox.open(row, { orphanResolution: false });
assert.deepEqual(reasonField(), { value: '', readonly: false });
const reusableRow = { ...row, orphan_card_resolution_preview: {
    automaticReusableApplied: true, reusableDecisionReason: 'Υφιστάμενη έγκριση HR.'
} };
for (const context of [undefined, { orphanResolution: true }]) {
    sandbox.open(reusableRow, context);
    assert.deepEqual(reasonField(), { value: 'Υφιστάμενη έγκριση HR.', readonly: true });
    assert.doesNotMatch(container.innerHTML, new RegExp(expectedReason));
}
sandbox.open({ ...row, orphan_card_resolution_preview: {
    automaticReusableApplied: false, reusableDecisionReason: 'Δεν εφαρμόστηκε.'
} }, { orphanResolution: true });
assert.deepEqual(reasonField(), { value: expectedReason, readonly: false });
console.log('Employment Review orphan reason prefill regression: PASS');
