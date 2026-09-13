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
    escapeHtml: (value) => String(value), formatStage1DateKey: (value) => {
        const [year, month, day] = String(value).slice(0, 10).split('-');
        return year && month && day ? `${day}/${month}/${year}` : String(value);
    },
    stage2LifecycleClassificationLabel: (value) => ({ 'ΕΡΓ': 'Εργασία', 'ΑΝ': 'Ρεπό',
        'ΜΕ': 'Μη εργασία' }[String(value)] || String(value || '')),
    getStage2LifecycleReasonLabel: (value, showUnknown = true) => showUnknown
        ? String(value) : 'Η περίπτωση χρειάζεται έλεγχο πριν γίνει οποιαδήποτε αλλαγή.' };
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
assert.match(container.innerHTML, /Έτοιμες για μαζική ενημέρωση/);
assert.match(container.innerHTML, /Αυτόματες τακτοποιήσεις/);
assert.match(container.innerHTML, /Μεταφορές ρεπό/);
assert.match(container.innerHTML, /Ήδη τακτοποιημένες/);
assert.match(container.innerHTML, /Περιπτώσεις που χρειάζονται έλεγχο/);
assert.equal((container.innerHTML.match(/class="weekly-hr-stage2-exception"/g) || []).length, 50);
assert.match(container.innerHTML, /<td>0<\/td>/);
assert.match(container.innerHTML, /04\/05\/2026–10\/05\/2026/);
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
assert.match(container.innerHTML,
    /btn btn-sm employment-review-action-btn employment-review-action-secondary nowrap weekly-hr-stage2-exception-review/);
assert.match(container.innerHTML, /Ενέργεια/);
assert.match(container.innerHTML, />Έλεγχος<\/button>/);
assert.doesNotMatch(container.innerHTML, /MANUAL_REVIEW/);
assert.doesNotMatch(container.innerHTML, /<article/);

sandbox.currentWeeklyHrStage2BulkPreview = { total_scopes: 85, safe_bulk_count: 0,
    safe_pair_count: 0, safe_automatic_count: 0, already_resolved_count: 66,
    manual_exception_count: 0, technical_conflict_count: 19, exceptions: [] };
sandbox.render(container);
assert.match(container.innerHTML, /Περιπτώσεις που χρειάζονται έλεγχο: <strong>0<\/strong>/);
assert.doesNotMatch(container.innerHTML, /<details/);
assert.doesNotMatch(container.innerHTML, /weekly-hr-stage2-exception-review/);

permission = false;
sandbox.userCanRecordCanonicalDecision = () => false;
sandbox.currentWeeklyHrStage2BulkPreview = { total_scopes: 2, safe_bulk_count: 2,
    safe_pair_count: 1, safe_automatic_count: 1, already_resolved_count: 0,
    manual_exception_count: 0, exceptions: [] };
sandbox.render(container);
assert.match(container.innerHTML.match(/weekly-hr-stage2-bulk-complete[^>]*>/)?.[0] || '',
    /disabled/);
assert.match(container.innerHTML, /Δεν έχετε δικαίωμα αλλαγής/);
assert.doesNotMatch(container.innerHTML.replace(/<[^>]*>/g, ' '),
    /source|target|\bHR\b|Stage ?2|bulk|scope|fingerprint|canonical|runtime|index|payload|stale|failed/i);
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
    assert.equal(modalOptions.showDenyButton, false);
    assert.equal(modalOptions.cancelButtonText, 'Κλείσιμο');
    assert.match(modalOptions.html,
        /Η περίπτωση χρειάζεται έλεγχο πριν γίνει οποιαδήποτε αλλαγή/);
    assert.doesNotMatch(modalOptions.html, /MANUAL_REVIEW/);
    assert.doesNotMatch(modalOptions.html,
        /source|target|scope|fingerprint|canonical|payload|runtime|index/i);
    sandbox.userCanRecordRepoTransferDecision = () => true;
    sandbox.currentCanonicalLifecyclePayloads = [{ scope: { employee_id: 'employee-1',
        week_start: '2026-05-04', week_end: '2026-05-10' }, lifecycle_projection: { stages: {
            stage2: { pending_items: [{ source: { date: '2026-05-05' },
                target: { date: '2026-05-08' },
                canonical_source: { current_category: 'ΑΝ',
                    proposed_values: { kathgoria_ergasias_apologistika: 'ΕΡΓ' } },
                canonical_target: { current_category: 'ΕΡΓ',
                    proposed_values: { kathgoria_ergasias_apologistika: 'ΑΝ' } },
                decision_command: { proposal_id: 'proposal-1',
                    expected_source_id: 'row-1', expected_target_id: 'row-2',
                    expected_proposal_version: 'v2', expected_choice_code: 'ONLY_PAIR' } }] }
        } } }];
    await sandbox.reviewException({ employee_id: 'employee-1', employee_kodikos: '0001',
        week_start: '2026-05-04', week_end: '2026-05-10', code: 'MANUAL_REVIEW' });
    assert.equal(modalOptions.showConfirmButton, true);
    assert.equal(modalOptions.confirmButtonText, 'Εφαρμογή μεταφοράς');
    assert.equal(modalOptions.showDenyButton, true);
    assert.equal(modalOptions.denyButtonText, 'Η μεταφορά δεν ισχύει');
    assert.equal(modalOptions.cancelButtonText, 'Ακύρωση');
    assert.match(modalOptions.html, /Διαθέσιμες επιλογές/);
    assert.match(modalOptions.html, /05\/05\/2026/);
    assert.match(modalOptions.html, /Ρεπό → Εργασία/);
    assert.match(modalOptions.html, /08\/05\/2026/);
    assert.match(modalOptions.html, /Εργασία → Ρεπό/);
    assert.doesNotMatch(modalOptions.html,
        /Δεν υπάρχει διαθέσιμη ασφαλής αυτόματη απόφαση/);
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
assert.match(completionSource, /Μαζική ενημέρωση μεταφοράς ρεπό/);
assert.match(completionSource, /Επεξεργασία \$\{processed\.toLocaleString\('el-GR'\)} από/);
assert.match(completionSource, /Ολοκληρώθηκαν:/);
assert.match(completionSource, /Ήταν ήδη τακτοποιημένες:/);
assert.match(completionSource, /Χρειάζονται νέο έλεγχο:/);
assert.match(completionSource, /Δεν ολοκληρώθηκαν:/);
assert.doesNotMatch(completionSource, /Μαζική ενημέρωση Stage 2|Εφαρμόστηκαν:|Παρωχημένες:|Αποτυχίες:/);
assert.match(completionSource, /processed_in_batch \|\| 0\) <= 0/);
assert.match(completionSource, /continuationToken === previousContinuationToken/);
assert.match(completionSource, /maxBatchIterations/);
assert.equal((completionSource.match(/stage2\/bulk-complete/g) || []).length, 1);
assert.match(source, /weekly-hr-stage2-exception-review/);
assert.match(source, /reviewWeeklyHrStage2Exception/);
const reasonStart = source.indexOf('function getStage2LifecycleReasonLabel');
const reasonEnd = source.indexOf('const STAGE3_NON_WORK_DEFAULT_REASON', reasonStart);
const reasonSandbox = { policyPreviewReasonLabels: {}, atomicRepoTransferDiagnosticLabels: {},
    formatPolicyPreviewUnknownCode: (value) => value };
vm.runInNewContext(`${source.slice(reasonStart, reasonEnd)}\n` +
    'this.reasonLabel = getStage2LifecycleReasonLabel;', reasonSandbox);
assert.equal(reasonSandbox.reasonLabel('UNKNOWN_INTERNAL_REASON', false),
    'Η περίπτωση χρειάζεται έλεγχο πριν γίνει οποιαδήποτε αλλαγή.');
assert.doesNotMatch(reasonSandbox.reasonLabel('UNKNOWN_INTERNAL_REASON', false),
    /UNKNOWN_INTERNAL_REASON/);
console.log('weekly HR Stage-2 compact bulk UI tests passed');
