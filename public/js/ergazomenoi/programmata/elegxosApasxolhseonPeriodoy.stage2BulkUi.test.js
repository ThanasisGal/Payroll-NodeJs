'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const source = fs.readFileSync(path.join(__dirname, 'elegxosApasxolhseonPeriodoy.js'), 'utf8');
const viewSource = fs.readFileSync(path.join(__dirname,
    '../../../../views/ergazomenoi/programmata/elegxosApasxolhseonPeriodoy.ejs'), 'utf8');
const cssSource = fs.readFileSync(path.join(__dirname, '../../../../public/css/main.css'), 'utf8');
const start = source.indexOf('function stage2BulkChangeUnavailableReason');
const end = source.indexOf('async function completeWeeklyHrStage2BulkFromUi');
assert.ok(start >= 0 && end > start);
const renderSource = source.slice(start, end);
let permission = true; let periodAllowsChanges = true; let modalOptions = null;
let modalAction = 'cancel'; let completionCalls = 0;
let fetchResult = { ok: true, body: { success: true, page: 1, page_count: 1,
    details: [{ employee: '0001 — ΔΟΚΙΜΗ ΧΡΗΣΤΗΣ', week_start: '2026-05-04',
        week_end: '2026-05-10', date: '2026-05-06', before: 'Πιθανή άδεια',
        after: 'Ρεπό', safety_reason: 'Μονοσήμαντη αλλαγή.' },
    { employee: '0001 — ΔΟΚΙΜΗ ΧΡΗΣΤΗΣ', week_start: '2026-05-04',
        week_end: '2026-05-10', date: '2026-05-08', before: 'Εργασία',
        after: 'Ρεπό', safety_reason:
            'Η αλλαγή προκύπτει μονοσήμαντα από τον ολοκληρωμένο εβδομαδιαίο έλεγχο.' }] } };
const fetchCalls = [];
function fakeElement(id) {
    return { id, innerHTML: '', textContent: '', value: '', disabled: false, onclick: null,
        listeners: {}, classList: { add() {}, remove() {}, toggle() {} },
        setCustomValidity() {}, reportValidity() {}, focus() {},
        addEventListener(type, listener, options) {
            this.listeners[type] = { listener, once: options?.once === true };
        },
        dispatch(type) {
            const registered = this.listeners[type];
            if (!registered) return;
            if (registered.once) delete this.listeners[type];
            registered.listener();
        } };
}
const elements = Object.fromEntries([
    'weeklyHrStage2BulkPreviewModal', 'weeklyHrStage2PreviewReason',
    'weeklyHrStage2PreviewPrevious', 'weeklyHrStage2PreviewNext',
    'weeklyHrStage2PreviewApply', 'weeklyHrStage2BulkPreviewBody',
    'weeklyHrStage2PreviewCaseCount', 'weeklyHrStage2PreviewEmployeeCount',
    'weeklyHrStage2PreviewWeekCount', 'weeklyHrStage2PreviewDayCount',
    'weeklyHrStage2PreviewPageLabel'
].map((id) => [id, fakeElement(id)]));
const modalInstance = { show() {
    queueMicrotask(() => {
        if (modalAction === 'apply') {
            elements.weeklyHrStage2PreviewReason.value = 'Ελεγμένη προεπισκόπηση';
            elements.weeklyHrStage2PreviewApply.onclick();
        } else if (modalAction === 'paginate') {
            Promise.resolve(elements.weeklyHrStage2PreviewNext.onclick()).then(() =>
                elements.weeklyHrStage2BulkPreviewModal.dispatch('hidden.bs.modal'));
        } else elements.weeklyHrStage2BulkPreviewModal.dispatch('hidden.bs.modal');
    });
}, hide() { elements.weeklyHrStage2BulkPreviewModal.dispatch('hidden.bs.modal'); } };
const sandbox = { currentWeeklyHrStage2BulkPreview: null,
    currentCanonicalLifecyclePayloads: [],
    weeklyHrStage2BulkSubmitting: false, userCanRecordCanonicalDecision: () => true,
    userCanRecordRepoTransferDecision: () => false,
    canRecordEmploymentDecisionForCurrentPeriod: () => periodAllowsChanges,
    document: { getElementById: (id) => ['canReviewEdit', 'canRecordRepoTransferDecision'].includes(id)
        ? { value: permission ? '1' : '0' } : elements[id] || null },
    bootstrap: { Modal: { getOrCreateInstance: () => modalInstance } },
    employmentReviewSwal: async (options) => { modalOptions = options;
        return { isConfirmed: false, isDenied: false }; },
    completeWeeklyHrStage2BulkFromUi: async () => { completionCalls++; },
    submitRepoTransferDecision: async () => false, loadResults: async () => {},
    getActiveEmploymentReviewScope: () => ({ apo_hmeromhnia: '2026-05-01',
        eos_hmeromhnia: '2026-05-31', ypokatasthma: '0001' }),
    URLSearchParams, csrfToken: 'token', Swal: { close: () => {} }, queueMicrotask,
    fetch: async (url, options = {}) => { fetchCalls.push({ url, options }); return {
        ok: fetchResult.ok, json: async () => fetchResult.body }; },
    escapeHtml: (value) => String(value), formatStage1DateKey: (value) => {
        const [year, month, day] = String(value).slice(0, 10).split('-');
        return year && month && day ? `${day}/${month}/${year}` : String(value);
    },
    stage2LifecycleClassificationLabel: (value) => ({ 'ΕΡΓ': 'Εργασία', 'ΑΝ': 'Ρεπό',
        'ΜΕ': 'Μη εργασία' }[String(value)] || String(value || '')),
    getStage2LifecycleReasonLabel: (value, showUnknown = true) => showUnknown
        ? String(value) : 'Η περίπτωση χρειάζεται έλεγχο πριν γίνει οποιαδήποτε αλλαγή.' };
vm.runInNewContext(`${renderSource}\nthis.render = renderWeeklyHrStage2BulkSummary;\n` +
    'this.reviewException = reviewWeeklyHrStage2Exception;\n' +
    'this.previewBulk = previewWeeklyHrStage2BulkFromUi;', sandbox);
const container = { innerHTML: '' };
sandbox.currentWeeklyHrStage2BulkPreview = { total_scopes: 10000, safe_bulk_count: 9500,
    already_resolved_count: 0, manual_exception_count: 500, exception_page: 1,
    exception_page_count: 10, exceptions: Array.from({ length: 50 }, (_, index) => ({
        employee_kodikos: String(index), week_start: '2026-05-04', week_end: '2026-05-10',
        code: 'MANUAL_REVIEW' })) };
assert.equal(sandbox.render(container), true);
assert.match(container.innerHTML, /Προεπισκόπηση 9500 ενημερώσεων/);
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
assert.match(container.innerHTML, /Προεπισκόπηση μαζικής ενημέρωσης/);
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
sandbox.userCanRecordCanonicalDecision = () => periodAllowsChanges;
sandbox.render(container);
assert.match(container.innerHTML, /Η κατάσταση της περιόδου δεν επιτρέπει αλλαγές/);
assert.doesNotMatch(container.innerHTML, /checkbox|Τακτοποίηση επιλεγμένων/);

(async () => {
    sandbox.currentWeeklyHrStage2BulkPreview = { safe_bulk_count: 19,
        safe_employee_count: 4, safe_week_count: 19, safe_day_change_count: 25,
        preview_fingerprint: 'a'.repeat(64) };
    await sandbox.previewBulk();
    assert.equal(fetchCalls.length, 1);
    assert.match(fetchCalls[0].url, /stage2\/bulk-preview/);
    assert.doesNotMatch(fetchCalls[0].url, /bulk-complete/);
    assert.equal(fetchCalls[0].options.method || 'GET', 'GET');
    assert.equal(completionCalls, 0);
    assert.match(elements.weeklyHrStage2BulkPreviewBody.innerHTML,
        /weekly-hr-stage2-preview-case/);
    assert.match(elements.weeklyHrStage2BulkPreviewBody.innerHTML,
        /0001 — ΔΟΚΙΜΗ ΧΡΗΣΤΗΣ/);
    assert.match(elements.weeklyHrStage2BulkPreviewBody.innerHTML,
        /Εβδομάδα <span>04\/05\/2026–10\/05\/2026<\/span>/);
    assert.match(elements.weeklyHrStage2BulkPreviewBody.innerHTML,
        /06\/05\/2026/);
    assert.match(elements.weeklyHrStage2BulkPreviewBody.innerHTML,
        /Πιθανή άδεια[\s\S]*→[\s\S]*Ρεπό/);
    assert.equal((elements.weeklyHrStage2BulkPreviewBody.innerHTML.match(
        /weekly-hr-stage2-preview-case"/g) || []).length, 1);
    assert.doesNotMatch(elements.weeklyHrStage2BulkPreviewBody.innerHTML,
        /Η αλλαγή προκύπτει μονοσήμαντα από τον ολοκληρωμένο εβδομαδιαίο έλεγχο/);
    assert.equal(elements.weeklyHrStage2PreviewApply.textContent,
        'Εφαρμογή 19 ενημερώσεων');
    assert.equal(elements.weeklyHrStage2PreviewCaseCount.textContent, 19);
    assert.equal(elements.weeklyHrStage2PreviewEmployeeCount.textContent, 4);
    assert.equal(elements.weeklyHrStage2PreviewWeekCount.textContent, 19);
    assert.equal(elements.weeklyHrStage2PreviewDayCount.textContent, 25);
    assert.doesNotMatch(elements.weeklyHrStage2BulkPreviewBody.innerHTML,
        /<table|Γιατί είναι ασφαλές/);

    modalAction = 'apply';
    await sandbox.previewBulk();
    assert.equal(completionCalls, 1);

    fetchResult.body.page_count = 2;
    modalAction = 'paginate';
    const callsBeforePagination = fetchCalls.length;
    await sandbox.previewBulk();
    const paginationCalls = fetchCalls.slice(callsBeforePagination);
    assert.equal(paginationCalls.length, 2);
    assert.ok(paginationCalls.every((call) => (call.options.method || 'GET') === 'GET'));
    assert.ok(paginationCalls.every((call) => !call.url.includes('bulk-complete')));
    assert.match(paginationCalls[1].url, /page=2/);
    modalAction = 'cancel';
    fetchResult.body.page_count = 1;

    fetchResult = { ok: false, body: { success: false, code: 'STAGE2_INPUT_CHANGED' } };
    await sandbox.previewBulk();
    assert.equal(modalOptions.title, 'Απαιτείται νέα Αναζήτηση');
    assert.match(modalOptions.text, /Τα στοιχεία έχουν αλλάξει/);

    fetchResult = { ok: false,
        body: { success: false, code: 'STAGE2_BULK_PREVIEW_FAILED' } };
    await sandbox.previewBulk();
    assert.equal(modalOptions.title, 'Η προεπισκόπηση δεν φορτώθηκε');
    assert.equal(modalOptions.text,
        'Δεν ήταν δυνατή η φόρτωση της προεπισκόπησης. Δοκιμάστε ξανά.');
    assert.doesNotMatch(modalOptions.text, /STAGE2_BULK_PREVIEW_FAILED/);

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
const previewStart = source.indexOf('async function previewWeeklyHrStage2BulkFromUi');
const previewSource = source.slice(previewStart, completionStart);
assert.match(viewSource, /Προεπισκόπηση μαζικής ενημέρωσης ρεπό/);
assert.match(renderSource, /Εφαρμογή \$\{preview\.safe_bulk_count \|\| 0\} ενημερώσεων/);
assert.match(previewSource, /loadWeeklyHrStage2BulkDetailPage/);
assert.doesNotMatch(previewSource, /stage2\/bulk-complete/);
assert.match(viewSource, /modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable/);
assert.match(viewSource, /id="weeklyHrStage2BulkPreviewModal"/);
assert.match(viewSource, /aria-labelledby="weeklyHrStage2BulkPreviewModalLabel"/);
assert.match(viewSource, /Προεπισκόπηση μαζικής ενημέρωσης ρεπό/);
assert.match(viewSource, /Δεν έχει γίνει ακόμη καμία αλλαγή/);
assert.match(viewSource, /Εργαζόμενοι/);
assert.match(viewSource, /Ημερήσιες αλλαγές/);
assert.match(viewSource, /‹ Προηγούμενη/);
assert.match(viewSource, /Επόμενη ›/);
assert.match(viewSource, /data-bs-dismiss="modal">Ακύρωση/);
assert.match(viewSource, /Πριν από κάθε αλλαγή, το σύστημα θα ελέγξει ξανά/);
assert.match(viewSource, /weekly-hr-stage2-preview-footer[\s\S]*weekly-hr-stage2-preview-safety[\s\S]*weekly-hr-stage2-preview-controls/);
assert.match(viewSource, /weekly-hr-stage2-preview-controls[\s\S]*weekly-hr-stage2-preview-pagination[\s\S]*weekly-hr-stage2-preview-reason[\s\S]*weekly-hr-stage2-preview-actions/);
assert.doesNotMatch(previewSource, /employmentReviewSwal\(\{ icon: 'info'/);
assert.match(cssSource, /max-width: min\(1200px, 94vw\)/);
assert.match(cssSource, /\.employment-review-stage2-bulk-preview-modal \.modal-body \{[\s\S]*overflow-y: auto/);
assert.match(cssSource, /\.weekly-hr-stage2-preview-date \{[\s\S]*white-space: nowrap/);
assert.match(cssSource, /font-size: 0\.95rem/);
assert.match(cssSource, /\.weekly-hr-stage2-preview-footer \{[\s\S]*flex-direction: column/);
assert.match(cssSource, /\.weekly-hr-stage2-preview-safety \{[\s\S]*width: 100%/);
assert.match(cssSource, /\.weekly-hr-stage2-preview-controls \{[\s\S]*grid-template-columns: auto minmax\(16rem, 1fr\) auto/);
assert.match(source, /details\.slice\(0, 50\)/);
assert.match(completionSource, /while \(hasMore\)/);
assert.match(completionSource, /continuation_token: continuationToken/);
assert.match(completionSource, /processed_in_batch/);
assert.match(completionSource, /Μαζική ενημέρωση μεταφοράς ρεπό/);
assert.match(completionSource, /Επεξεργασία \$\{globalProcessed\.toLocaleString/);
assert.match(completionSource, /application\/x-ndjson/);
assert.match(completionSource, /response\.body\.getReader\(\)/);
assert.match(completionSource, /Ολοκληρώθηκαν:/);
assert.match(completionSource, /Ήταν ήδη τακτοποιημένες:/);
assert.match(completionSource, /Χρειάζονται νέο έλεγχο:/);
assert.match(completionSource, /Δεν ολοκληρώθηκαν:/);
assert.match(completionSource, /currentWeeklyHrStage2BulkLastResultDetails = resultDetails/);
assert.match(completionSource, /Αιτίες παραλείψεων/);
assert.match(completionSource, /Η κατάσταση της περιόδου άλλαξε πριν ολοκληρωθεί η ενημέρωση/);
assert.doesNotMatch(completionSource, /Μαζική ενημέρωση Stage 2|Εφαρμόστηκαν:|Παρωχημένες:|Αποτυχίες:/);
assert.match(completionSource, /processed_in_batch \|\| 0\) <= 0/);
assert.match(completionSource, /continuationToken === previousContinuationToken/);
assert.match(completionSource, /maxBatchIterations/);
assert.equal((completionSource.match(/stage2\/bulk-complete/g) || []).length, 1);
assert.match(completionSource, /await getPolicyPreviewCsrfToken\(\)/);
assert.doesNotMatch(completionSource, /\bensureCsrfToken\s*\(/);
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

async function testStage2BulkCompletionCsrfFlow() {
    const completionFetchCalls = [];
    const completionAlerts = [];
    let csrfCalls = 0;
    let reloadCalls = 0;
    const progressUpdates = [];
    const completionSandbox = {
        currentWeeklyHrStage2BulkPreview: { safe_bulk_count: 19,
            preview_fingerprint: 'b'.repeat(64) },
        weeklyHrStage2BulkSubmitting: false,
        weeklyHrStage2BulkRequestId: 'stage2-bulk-test-request',
        currentWeeklyHrStage2BulkLastResultDetails: [],
        currentEmploymentReviewLifecyclePresentation: {},
        getActiveEmploymentReviewScope: () => ({ apo_hmeromhnia: '2026-05-01',
            eos_hmeromhnia: '2026-05-31', ypokatasthma: '0000' }),
        getPolicyPreviewCsrfToken: async () => { csrfCalls++; return 'valid-csrf-token'; },
        renderWeeklyHrStage2LifecycleFallback: () => {},
        employmentReviewSwal: async (options) => { completionAlerts.push(options); return {}; },
        Swal: { showLoading() {}, update(value) { progressUpdates.push(value); }, close() {} },
        loadResults: async () => { reloadCalls++; return true; },
        escapeHtml: (value) => String(value),
        fetch: async (url, options) => {
            completionFetchCalls.push({ url, options });
            return { ok: true, json: async () => ({ success: true, applied: 19,
                already_completed: 0, stale: 0, failed: 0, skipped_manual: 0,
                processed_in_batch: 19, has_more: false, continuation_token: null }) };
        },
        Date, Math, JSON, Number, String, Error, TextDecoder, Uint8Array
    };
    vm.runInNewContext(`${completionSource}\nthis.completeBulk = completeWeeklyHrStage2BulkFromUi;`,
        completionSandbox);
    const reason = 'Ελεγμένη δοκιμή μαζικής ενημέρωσης';
    await completionSandbox.completeBulk(reason);
    assert.equal(csrfCalls, 1);
    assert.match(completionAlerts[0].html, /Επεξεργασία 0 από 19 περιπτώσεις/);
    assert.equal(completionFetchCalls.length, 1);
    const request = completionFetchCalls[0];
    assert.match(request.url, /stage2\/bulk-complete$/);
    assert.equal(request.options.method, 'POST');
    assert.equal(request.options.headers['CSRF-Token'], 'valid-csrf-token');
    assert.equal(request.options.headers['x-csrf-token'], 'valid-csrf-token');
    const body = JSON.parse(request.options.body);
    assert.equal(body.bulk_request_id, 'stage2-bulk-test-request');
    assert.equal(body.reason_or_notes, reason);
    assert.equal(body.expected_preview_fingerprint, 'b'.repeat(64));
    assert.equal(reloadCalls, 1);
    assert.equal(completionSandbox.weeklyHrStage2BulkSubmitting, false);

    const ndjsonResponse = (events) => {
        const chunks = [Buffer.from(events.map((event) => JSON.stringify(event)).join('\n') + '\n')];
        return { ok: true, headers: { get: () => 'application/x-ndjson; charset=utf-8' },
            body: { getReader: () => ({ read: async () => chunks.length
                ? { value: new Uint8Array(chunks.shift()), done: false }
                : { value: undefined, done: true } }) } };
    };
    completionFetchCalls.length = 0;
    progressUpdates.length = 0;
    completionSandbox.weeklyHrStage2BulkSubmitting = false;
    completionSandbox.currentWeeklyHrStage2BulkPreview.safe_bulk_count = 19;
    completionSandbox.fetch = async (url, options) => {
        completionFetchCalls.push({ url, options });
        return ndjsonResponse([
            ...Array.from({ length: 19 }, (_, index) => ({ type: 'progress',
                processed_in_batch: index + 1, total_in_batch: 19 })),
            { type: 'result', success: true, applied: 19, already_completed: 0,
                stale: 0, failed: 0, skipped_manual: 0, processed_in_batch: 19,
                has_more: false, continuation_token: null }
        ]);
    };
    await completionSandbox.completeBulk(reason);
    assert.equal(completionFetchCalls.length, 1);
    assert.equal(completionFetchCalls[0].options.headers.Accept,
        'application/x-ndjson, application/json');
    assert.deepEqual(progressUpdates.map((item) => Number(item.html.match(/Επεξεργασία (\d+)/)[1])),
        Array.from({ length: 19 }, (_, index) => index + 1));

    completionFetchCalls.length = 0;
    progressUpdates.length = 0;
    completionSandbox.weeklyHrStage2BulkSubmitting = false;
    completionSandbox.currentWeeklyHrStage2BulkPreview.safe_bulk_count = 250;
    let streamedBatch = 0;
    completionSandbox.fetch = async (url, options) => {
        completionFetchCalls.push({ url, options });
        const counts = [100, 100, 50]; const count = counts[streamedBatch];
        const hasMore = streamedBatch < 2; streamedBatch++;
        return ndjsonResponse([
            ...Array.from({ length: count }, (_, index) => ({ type: 'progress',
                processed_in_batch: index + 1, total_in_batch: count })),
            { type: 'result', success: true, applied: count, already_completed: 0,
                stale: 0, failed: 0, skipped_manual: 0, processed_in_batch: count,
                has_more: hasMore,
                continuation_token: hasMore ? `continuation-${streamedBatch}` : null }
        ]);
    };
    await completionSandbox.completeBulk(reason);
    assert.equal(completionFetchCalls.length, 3);
    assert.deepEqual(progressUpdates.map((item) => Number(item.html.match(/Επεξεργασία (\d+)/)[1])),
        Array.from({ length: 250 }, (_, index) => index + 1));
    completionSandbox.currentWeeklyHrStage2BulkPreview.safe_bulk_count = 19;

    completionFetchCalls.length = 0;
    completionAlerts.length = 0;
    completionSandbox.weeklyHrStage2BulkSubmitting = false;
    completionSandbox.fetch = async (url, options) => {
        completionFetchCalls.push({ url, options });
        return { ok: true, json: async () => ({ success: true, applied: 0,
            already_completed: 0, stale: 19, failed: 0, skipped_manual: 0,
            processed_in_batch: 19, has_more: false, continuation_token: null,
            result_details: Array.from({ length: 19 }, () => ({ status: 'STALE',
                code: 'PERIOD_CONTROL_STATE_CONFLICT', scope: {} })) }) };
    };
    await completionSandbox.completeBulk(reason);
    const staleResult = completionAlerts.find((item) => /Ολοκληρώθηκαν:/.test(item.html || ''));
    assert.match(staleResult.html, /Παραλείφθηκαν επειδή άλλαξαν στοιχεία: 19/);
    assert.match(staleResult.html,
        /Η κατάσταση της περιόδου άλλαξε πριν ολοκληρωθεί η ενημέρωση: 19/);
    assert.doesNotMatch(staleResult.html, /PERIOD_CONTROL_STATE_CONFLICT/);
    assert.equal(completionSandbox.currentWeeklyHrStage2BulkLastResultDetails.length, 19);

    completionFetchCalls.length = 0;
    completionAlerts.length = 0;
    completionSandbox.weeklyHrStage2BulkSubmitting = false;
    completionSandbox.fetch = async (url, options) => {
        completionFetchCalls.push({ url, options });
        return { ok: true, json: async () => ({ success: true, applied: 0,
            already_completed: 0, stale: 19, failed: 0, skipped_manual: 0,
            processed_in_batch: 19, has_more: false, continuation_token: null,
            result_details: [
                ...Array.from({ length: 12 }, () => ({ status: 'STALE',
                    code: 'STAGE2_INPUT_CHANGED', scope: {} })),
                ...Array.from({ length: 7 }, () => ({ status: 'STALE',
                    code: 'DAILY_REVIEW_INPUT_CHANGED', scope: {} }))
            ] }) };
    };
    await completionSandbox.completeBulk(reason);
    const mixedResult = completionAlerts.find((item) => /Ολοκληρώθηκαν:/.test(item.html || ''));
    assert.match(mixedResult.html,
        /Τα στοιχεία της εβδομάδας άλλαξαν μετά την προεπισκόπηση: 12/);
    assert.match(mixedResult.html,
        /Μία ημερήσια εγγραφή άλλαξε πριν αποθηκευτεί η ενημέρωση: 7/);
    assert.doesNotMatch(mixedResult.html,
        /STAGE2_INPUT_CHANGED|DAILY_REVIEW_INPUT_CHANGED/);

    completionFetchCalls.length = 0;
    completionAlerts.length = 0;
    completionSandbox.weeklyHrStage2BulkSubmitting = false;
    completionSandbox.fetch = async (url, options) => {
        completionFetchCalls.push({ url, options });
        return { ok: true, json: async () => ({ success: true, applied: 19,
            already_completed: 0, stale: 0, failed: 0, skipped_manual: 0,
            processed_in_batch: 19, has_more: false, continuation_token: null }) };
    };
    completionSandbox.loadResults = async () => { reloadCalls++; return false; };
    await completionSandbox.completeBulk(reason);
    assert.equal(completionFetchCalls.length, 1);
    assert.match(completionAlerts.at(-1).text,
        /Η ενημέρωση ολοκληρώθηκε, αλλά η προβολή δεν ανανεώθηκε/);
    assert.doesNotMatch(completionAlerts.at(-1).text, /Η μαζική ενημέρωση απέτυχε/);
    assert.equal(completionSandbox.weeklyHrStage2BulkSubmitting, false);

    completionFetchCalls.length = 0;
    completionAlerts.length = 0;
    completionSandbox.weeklyHrStage2BulkSubmitting = false;
    completionSandbox.getPolicyPreviewCsrfToken = async () => {
        csrfCalls++; throw new Error('TOKEN_UNAVAILABLE');
    };
    await completionSandbox.completeBulk(reason);
    assert.equal(completionFetchCalls.length, 0);
    assert.equal(completionSandbox.weeklyHrStage2BulkSubmitting, false);
    assert.match(completionAlerts.at(-1).title, /Η μαζική ενημέρωση απέτυχε/);
    assert.equal(completionAlerts.at(-1).text,
        'Δεν ήταν δυνατή η ολοκλήρωση της μαζικής ενημέρωσης. Δοκιμάστε ξανά.');
    assert.doesNotMatch(completionAlerts.at(-1).text, /TOKEN_UNAVAILABLE/);

    completionFetchCalls.length = 0;
    completionAlerts.length = 0;
    completionSandbox.weeklyHrStage2BulkSubmitting = false;
    completionSandbox.getPolicyPreviewCsrfToken = async () => 'valid-csrf-token';
    completionSandbox.fetch = async (url, options) => {
        completionFetchCalls.push({ url, options });
        return { ok: false, json: async () => ({ success: false,
            code: 'WEEKLY_HR_STAGE2_BULK_COMPLETION_FAILED' }) };
    };
    await completionSandbox.completeBulk(reason);
    assert.equal(completionFetchCalls.length, 1);
    assert.equal(completionSandbox.weeklyHrStage2BulkSubmitting, false);
    assert.match(completionAlerts.at(-1).title, /Η μαζική ενημέρωση απέτυχε/);
}

testStage2BulkCompletionCsrfFlow()
    .then(() => console.log('weekly HR Stage-2 compact bulk UI tests passed'))
    .catch((error) => { console.error(error); process.exitCode = 1; });
