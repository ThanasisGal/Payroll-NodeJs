'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const source = fs.readFileSync(path.join(__dirname, 'elegxosApasxolhseonPeriodoy.js'), 'utf8');
const start = source.indexOf('function stage2BulkChangeUnavailableReason');
const end = source.indexOf('async function completeWeeklyHrStage2BulkFromUi');
assert.ok(start >= 0 && end > start);
const renderSource = source.slice(start, end);
let permission = true; let periodAllowsChanges = true; let modalOptions = null;
const sandbox = { currentWeeklyHrStage2BulkPreview: null,
    currentCanonicalLifecyclePayloads: [],
    weeklyHrStage2BulkSubmitting: false, userCanRecordCanonicalDecision: () => true,
    userCanRecordRepoTransferDecision: () => false,
    canRecordEmploymentDecisionForCurrentPeriod: () => periodAllowsChanges,
    document: { getElementById: () => ({ value: permission ? '1' : '0' }) },
    employmentReviewSwal: async (options) => { modalOptions = options;
        return { isConfirmed: false, isDenied: false }; },
    submitRepoTransferDecision: async () => false, loadResults: async () => {},
    escapeHtml: (value) => String(value), formatStage1DateKey: (value) => String(value),
    getStage2LifecycleReasonLabel: (value) => String(value) };
vm.runInNewContext(`${renderSource}\nthis.render = renderWeeklyHrStage2BulkSummary;\n` +
    'this.reviewException = reviewWeeklyHrStage2Exception;', sandbox);
const container = { innerHTML: '' };
sandbox.currentWeeklyHrStage2BulkPreview = { total_scopes: 10000, safe_bulk_count: 9500,
    already_resolved_count: 0, manual_exception_count: 500, exception_page: 1,
    exception_page_count: 10, exceptions: Array.from({ length: 50 }, (_, index) => ({
        employee_kodikos: String(index), week_start: '2026-05-04', week_end: '2026-05-10',
        code: 'MANUAL_REVIEW' })) };
assert.equal(sandbox.render(container), true);
assert.match(container.innerHTML, /Μαζική ενημέρωση 9500 περιπτώσεων/);
assert.doesNotMatch(container.innerHTML.match(/weekly-hr-stage2-bulk-complete[^>]*>/)?.[0] || '',
    /disabled/);
assert.match(container.innerHTML, /Αυτόματες/);
assert.match(container.innerHTML, /Μεταφορές source\/target/);
assert.equal((container.innerHTML.match(/class="weekly-hr-stage2-exception"/g) || []).length, 50);
assert.match(container.innerHTML, /<td>0<\/td>/);
assert.match(container.innerHTML, /2026-05-04–2026-05-10/);
assert.match(container.innerHTML, /Προηγούμενη/);
assert.match(container.innerHTML, /Επόμενη/);
assert.doesNotMatch(container.innerHTML, /employment-review-stage2-proposal/);
assert.doesNotMatch(container.innerHTML, /Προτάσεις Μεταφοράς Ρεπό|Ροή έγκρισης HR/);
sandbox.currentWeeklyHrStage2BulkPreview = { total_scopes: 85, safe_bulk_count: 0,
    safe_pair_count: 0, safe_automatic_count: 0, already_resolved_count: 66,
    manual_exception_count: 19, exception_page: 1, exception_page_count: 1,
    exceptions: Array.from({ length: 19 }, (_, index) => ({ employee_id: `employee-${index}`,
        employee_kodikos: String(index + 1).padStart(4, '0'), week_start: '2026-05-04',
        week_end: '2026-05-10', code: 'MANUAL_REVIEW' })) };
sandbox.render(container);
assert.match(container.innerHTML, /Μαζική ενημέρωση ρεπό/);
assert.match(container.innerHTML.match(/weekly-hr-stage2-bulk-complete[^>]*>/)?.[0] || '',
    /disabled/);
assert.match(container.innerHTML,
    /Δεν υπάρχουν αυτή τη στιγμή περιπτώσεις που μπορούν να ενημερωθούν αυτόματα/);
assert.equal((container.innerHTML.match(/weekly-hr-stage2-exception-review/g) || []).length, 19);
assert.match(container.innerHTML, /Ενέργεια/);
assert.match(container.innerHTML, />Έλεγχος<\/button>/);
assert.doesNotMatch(container.innerHTML, /<article/);

permission = false;
sandbox.userCanRecordCanonicalDecision = () => false;
sandbox.currentWeeklyHrStage2BulkPreview = { total_scopes: 2, safe_bulk_count: 2,
    safe_pair_count: 1, safe_automatic_count: 1, already_resolved_count: 0,
    manual_exception_count: 0, exceptions: [] };
sandbox.render(container);
assert.match(container.innerHTML.match(/weekly-hr-stage2-bulk-complete[^>]*>/)?.[0] || '',
    /disabled/);
assert.match(container.innerHTML, /Δεν έχετε δικαίωμα αλλαγής/);
assert.doesNotMatch(container.innerHTML, /runtime|index|fingerprint|canonical|payload|scope/);
permission = true; periodAllowsChanges = false;
sandbox.render(container);
assert.match(container.innerHTML, /Η κατάσταση της περιόδου δεν επιτρέπει αλλαγές/);
assert.doesNotMatch(container.innerHTML, /checkbox|Τακτοποίηση επιλεγμένων/);

(async () => {
    await sandbox.reviewException({ employee_id: 'employee-1', employee_kodikos: '0001',
        week_start: '2026-05-04', week_end: '2026-05-10', code: 'MANUAL_REVIEW' });
    assert.match(modalOptions.title, /Έλεγχος περίπτωσης/);
    assert.match(modalOptions.html, /Εργαζόμενος/);
    assert.match(modalOptions.html, /Εβδομάδα/);
    assert.match(modalOptions.html, /Τι βρέθηκε/);
    assert.match(modalOptions.html, /Γιατί χρειάζεται έλεγχος/);
    assert.equal(modalOptions.showConfirmButton, false);
    assert.doesNotMatch(modalOptions.html,
        /source|target|scope|fingerprint|canonical|payload|runtime|index/i);
    sandbox.userCanRecordRepoTransferDecision = () => true;
    sandbox.currentCanonicalLifecyclePayloads = [{ scope: { employee_id: 'employee-1',
        week_start: '2026-05-04', week_end: '2026-05-10' }, lifecycle_projection: { stages: {
            stage2: { pending_items: [{ source: { date: '2026-05-05' },
                target: { date: '2026-05-08' }, decision_command: { proposal_id: 'proposal-1',
                    expected_source_id: 'row-1', expected_target_id: 'row-2',
                    expected_proposal_version: 'v2', expected_choice_code: 'ONLY_PAIR' } }] }
        } } }];
    await sandbox.reviewException({ employee_id: 'employee-1', employee_kodikos: '0001',
        week_start: '2026-05-04', week_end: '2026-05-10', code: 'MANUAL_REVIEW' });
    assert.equal(modalOptions.showConfirmButton, true);
    assert.equal(modalOptions.confirmButtonText, 'Αποδοχή πρότασης');
    assert.equal(modalOptions.showDenyButton, true);
    assert.equal(modalOptions.denyButtonText, 'Δεν ισχύει');
    assert.match(modalOptions.html, /Ασφαλείς επιλογές HR/);
    assert.doesNotMatch(modalOptions.html,
        /source|target|scope|fingerprint|canonical|payload|runtime|index/i);
})().catch((error) => { console.error(error); process.exitCode = 1; });
assert.match(source, /stage2\/bulk-preview/);
assert.match(source, /stage2\/bulk-complete/);
const loadResultsSource = source.match(/async function loadResults\([\s\S]*?\n}/)?.[0] || '';
assert.match(loadResultsSource, /payload\.stage2BulkPreview/);
assert.doesNotMatch(loadResultsSource, /await loadWeeklyHrStage2BulkPreview/);
const completionStart = source.indexOf('async function completeWeeklyHrStage2BulkFromUi');
const completionEnd = source.indexOf('function renderWeeklyHrStage2LifecycleFallback',
    completionStart);
const completionSource = source.slice(completionStart, completionEnd);
assert.match(completionSource, /while \(hasMore\)/);
assert.match(completionSource, /continuation_token: continuationToken/);
assert.match(completionSource, /processed_in_batch/);
assert.match(completionSource, /Swal\.update\(\{ html: `Επεξεργασία/);
assert.match(completionSource, /processed_in_batch \|\| 0\) <= 0/);
assert.match(completionSource, /continuationToken === previousContinuationToken/);
assert.match(completionSource, /maxBatchIterations/);
assert.equal((completionSource.match(/stage2\/bulk-complete/g) || []).length, 1);
assert.match(source, /weekly-hr-stage2-exception-review/);
assert.match(source, /reviewWeeklyHrStage2Exception/);
console.log('weekly HR Stage-2 compact bulk UI tests passed');
