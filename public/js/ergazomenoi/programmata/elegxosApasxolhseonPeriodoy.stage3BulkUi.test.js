'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, 'elegxosApasxolhseonPeriodoy.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '../../../../public/css/main.css'), 'utf8');
const helpers = source.slice(source.indexOf('function isWeeklyHrStage3BulkEligible'),
    source.indexOf('function focusWeeklyHrStage1StaleAfterStage3Save'));
const requests = source.slice(source.indexOf('function weeklyHrStage3BulkPreviewCommand'),
    source.indexOf('function employmentReviewWaitingReason'));

function item(overrides = {}) {
    return { employee_id: 'employee-1', employee_kodikos: '0007', employee_name: 'ΑΡΕΤΗ',
        ypokatasthma: '0000', period_start: '2026-06-01', period_end: '2026-06-30',
        week_start: '2026-06-01', week_end: '2026-06-07', row_id: 'row-1',
        date: '2026-06-03', input_fingerprint: 'a'.repeat(64), expected_stage3_version: 2,
        allowed_classifications: ['LEAVE', 'SICKNESS', 'ABSENCE'],
        presentation_facts: { context_only: false }, ...overrides };
}

function sandboxFor(items = [item()]) {
    const alerts = [];
    const fetchCalls = [];
    let loads = 0;
    const sandbox = {
        weeklyHrStage3BulkSelected: new Set(items.map((entry) => entry.row_id)),
        weeklyHrStage3BulkClassification: 'LEAVE', weeklyHrStage3BulkLeaveCategory: 'ΑΔΚΑΝ',
        weeklyHrStage3FrozenApplyCommand: null, weeklyHrStage3BulkRetryPending: false,
        weeklyHrStage3BulkSubmitting: false,
        currentEmploymentReviewLifecyclePresentation: { stages: { STAGE3: { pending_items: items } } },
        currentCanonicalLifecyclePayloads: [],
        currentReviewRows: [{ employee_kodikos: '0007', employee_name: 'ΣΠΥΡΙΔΩΝΟΣ ΑΡΕΤΗ' }],
        weeklyHrLeaveCategories: [{ value: 'ΑΔΚΑΝ', label: 'ΑΔΚΑΝ - Κανονική άδεια' }],
        document: { getElementById: () => null, createElement: () => ({ innerHTML: '',
            firstElementChild: null }) },
        stage1LeaveCategoryOptions: () => '<option value="ΑΔΚΑΝ">ΑΔΚΑΝ - Κανονική άδεια</option>',
        stage3DecisionClassificationLabel: (value) => ({ LEAVE: 'Άδεια', SICKNESS: 'Ασθένεια',
            ABSENCE: 'Απουσία', NON_WORK: 'Μη εργασία' })[value] || '',
        findStage3PendingItem: (rowId) => items.find((entry) => entry.row_id === rowId),
        stage3PayloadForItem: () => null,
        buildStage3EmployeeNameLookup: (rows) => new Map(rows.map((row) =>
            [row.employee_kodikos, row.employee_name])),
        escapeHtml: (value) => String(value ?? ''),
        formatStage1DateKey: (value) => String(value || '').split('-').reverse().join('/'),
        csrfToken: 'csrf-test',
        crypto: { randomUUID: () => '00000000-0000-4000-8000-000000000001' },
        employmentReviewSwal: async (options) => { alerts.push(options); return { isConfirmed: false }; },
        fetch: async () => { throw new Error('Δεν ορίστηκε προσομοίωση fetch.'); },
        loadResults: async () => { loads += 1; },
        globalThis: null, Object, Array, Set, Map, String, Number, Boolean, Math, Date, JSON,
        Error, Promise
    };
    sandbox.globalThis = sandbox;
    vm.runInNewContext(`${helpers}\n${requests}\nthis.bulk = {
        eligible: isWeeklyHrStage3BulkEligible,
        selectedItems: weeklyHrStage3BulkSelectedItems,
        allowed: weeklyHrStage3BulkAllowedClassifications,
        previewCommand: weeklyHrStage3BulkPreviewCommand,
        preview: previewWeeklyHrStage3Bulk,
        previewHtml: weeklyHrStage3BulkPreviewHtml,
        reset: resetWeeklyHrStage3BulkState
    };`, sandbox);
    return { sandbox, alerts, fetchCalls, loads: () => loads };
}

{
    const { sandbox } = sandboxFor();
    const html = sandbox.bulk.previewHtml({ selected_count: 3,
        employee_count: 1, classification: 'ABSENCE',
        will_apply_count: 2, auto_satisfied_count: 1,
        items: [
            { ...item(), decision_date: '2026-05-26', outcome: 'APPLY' },
            { ...item(), decision_date: '2026-05-27', outcome: 'APPLY' },
            { ...item(), decision_date: '2026-05-28', outcome: 'AUTO_SATISFIED',
                automatic_classification: 'REST_REPO' }
        ] });
    assert.match(html, /3 επιλεγμένες εγγραφές/);
    assert.match(html, /2 θα χαρακτηριστούν ΑΠΟΥΣΙΑ/);
    assert.match(html, /1 θα επιλυθούν αυτόματα/);
    assert.match(html, /28\/05\/2026: <strong>Αυτόματη επίλυση ως ΑΝΑΠΑΥΣΗ \/ ΡΕΠΟ/);
    assert.match(html, /Δεν θα λάβει τον επιλεγμένο χαρακτηρισμό ΑΠΟΥΣΙΑ/);
}

{
    const fullTime = item();
    const partTime = item({ row_id: 'row-2', employee_id: 'employee-2',
        allowed_classifications: ['LEAVE', 'SICKNESS', 'ABSENCE', 'NON_WORK'] });
    const { sandbox } = sandboxFor([fullTime, partTime]);
    assert.deepEqual(Array.from(sandbox.bulk.allowed()), ['LEAVE', 'SICKNESS', 'ABSENCE']);
    assert.equal(sandbox.bulk.eligible(item({ presentation_facts: { context_only: true } })), false);
    assert.equal(sandbox.bulk.eligible(item({ row_id: '' })), false);
    const command = sandbox.bulk.previewCommand();
    assert.equal(command.items.length, 2);
    assert.deepEqual(Array.from(command.items, (entry) => entry.row_id), ['row-1', 'row-2']);
    assert.equal(command.items[0].expected_input_fingerprint, 'a'.repeat(64));
    assert.equal(command.items[0].expected_stage3_version, 2);
    assert.equal(command.final_classification, 'LEAVE');
    assert.equal(command.leave_category, 'ΑΔΚΑΝ');
}

async function validApplyAndSingleRefresh() {
    const context = sandboxFor();
    let modal = 0;
    context.sandbox.employmentReviewSwal = async (options) => {
        context.alerts.push(options); modal += 1;
        return modal === 1 ? { isConfirmed: true, value: 'Κοινή αιτιολογία' } : { isConfirmed: false };
    };
    context.sandbox.fetch = async (url, options) => {
        context.fetchCalls.push({ url, body: JSON.parse(options.body) });
        if (url.endsWith('bulk-preview')) return { ok: true, json: async () => ({ success: true,
            can_apply: true, selected_count: 1, employee_count: 1, classification: 'LEAVE',
            leave_category: { value: 'ΑΔΚΑΝ', label: 'ΑΔΚΑΝ - Κανονική άδεια' },
            preview_fingerprint: 'b'.repeat(64), items: [{ ...item(), decision_date: '2026-06-03' }],
            invalid_items: [] }) };
        return { ok: true, json: async () => ({ success: true, applied_count: 1,
            employee_count: 1, idempotent: false }) };
    };
    await context.sandbox.bulk.preview();
    assert.equal(context.fetchCalls.length, 2);
    assert.match(context.fetchCalls[0].url, /stage3\/bulk-preview$/);
    assert.match(context.fetchCalls[1].url, /stage3\/bulk-apply$/);
    assert.equal(context.fetchCalls[1].body.bulk_request_id,
        'stage3-bulk-ui:00000000-0000-4000-8000-000000000001');
    assert.equal(context.fetchCalls[1].body.expected_preview_fingerprint, 'b'.repeat(64));
    assert.equal(context.fetchCalls[1].body.reason_or_notes, 'Κοινή αιτιολογία');
    assert.equal(context.loads(), 1);
    assert.equal(context.sandbox.weeklyHrStage3BulkSelected.size, 0);
    assert.equal(context.fetchCalls.filter((call) => /resolve-day/.test(call.url)).length, 0);
}

async function invalidPreviewNeverApplies() {
    const context = sandboxFor();
    context.sandbox.fetch = async (url, options) => {
        context.fetchCalls.push({ url, body: JSON.parse(options.body) });
        return { ok: true, json: async () => ({ success: true, can_apply: false,
            selected_count: 1, preview_fingerprint: '', items: [], invalid_items: [{ row_id: 'row-1',
                employee_kodikos: '0007', decision_date: '2026-06-03',
                message: 'Κάντε νέα Αναζήτηση και δοκιμάστε ξανά.' }] }) };
    };
    await context.sandbox.bulk.preview();
    assert.equal(context.fetchCalls.length, 1);
    assert.equal(context.alerts[0].title, 'Χρειάζεται ανανέωση πριν συνεχίσετε.');
    assert.match(context.alerts[0].html, /ΣΠΥΡΙΔΩΝΟΣ ΑΡΕΤΗ — Κωδικός: 0007/);
    assert.match(context.alerts[0].html, /Κάντε νέα Αναζήτηση και δοκιμάστε ξανά/);
    assert.doesNotMatch(context.alerts[0].html, /Τα στοιχεία της ημέρας άλλαξαν/);
    assert.equal(context.sandbox.weeklyHrStage3BulkSelected.size, 1);
}

async function uncertainNetworkRetriesFrozenCommand() {
    const context = sandboxFor();
    let modal = 0;
    context.sandbox.employmentReviewSwal = async (options) => {
        context.alerts.push(options); modal += 1;
        if (modal === 1) return { isConfirmed: true, value: 'Αμετάβλητη αιτιολογία' };
        if (options.confirmButtonText === 'Επανάληψη ελέγχου εφαρμογής') return { isConfirmed: true };
        return { isConfirmed: false };
    };
    let applies = 0;
    context.sandbox.fetch = async (url, options) => {
        const body = JSON.parse(options.body); context.fetchCalls.push({ url, body });
        if (url.endsWith('bulk-preview')) return { ok: true, json: async () => ({ success: true,
            can_apply: true, selected_count: 1, employee_count: 1, classification: 'LEAVE',
            leave_category: { value: 'ΑΔΚΑΝ', label: 'Κανονική άδεια' },
            preview_fingerprint: 'c'.repeat(64), items: [{ ...item(), decision_date: '2026-06-03' }] }) };
        applies += 1;
        if (applies === 1) throw new Error('Διακοπή δικτύου');
        return { ok: true, json: async () => ({ success: true, applied_count: 1,
            idempotent: true }) };
    };
    await context.sandbox.bulk.preview();
    const applyBodies = context.fetchCalls.filter((call) => call.url.endsWith('bulk-apply'))
        .map((call) => call.body);
    assert.equal(applyBodies.length, 2);
    assert.deepEqual(applyBodies[1], applyBodies[0]);
    assert.equal(context.loads(), 1);
    assert.ok(context.alerts.some((alert) => /ήδη ολοκληρωθεί/.test(alert.title || '')));
}

Promise.all([validApplyAndSingleRefresh(), invalidPreviewNeverApplies(),
    uncertainNetworkRetriesFrozenCommand()]).then(() => {
    assert.match(source, /weekly-hr-stage3-bulk-select/);
    assert.match(source, /Επιλογή όλων των ορατών/);
    assert.match(source, /btn btn-brown rounded-4 buttons-content weekly-hr-stage3-select-visible/);
    assert.match(source, /bi bi-check2-all/);
    assert.match(source, /btn btn-brown rounded-4 buttons-content weekly-hr-stage3-clear-selection/);
    assert.match(source, /bi bi-eraser/);
    const toolbarSource = source.slice(source.indexOf('function renderWeeklyHrStage3BulkToolbar'),
        source.indexOf('function updateWeeklyHrStage3BulkToolbar'));
    assert.doesNotMatch(toolbarSource, /btn-outline-secondary/);
    assert.match(source, /weeklyHrStage3BulkAllowedClassifications/);
    assert.match(source, /stage3\/bulk-preview/);
    assert.match(source, /stage3\/bulk-apply/);
    assert.equal((requests.match(/stage3\/bulk-apply/g) || []).length, 1);
    assert.doesNotMatch(requests, /resolve-day/);
    assert.match(css, /\.stage3-col-select\s*\{\s*width:\s*2\.25rem/);
    assert.match(css, /employment-review-stage3-bulk-preview-popup[\s\S]*max-height:\s*calc\(100dvh - 2rem\)/);
    console.log('employment review Stage 3 bulk UI tests passed');
}).catch((error) => { console.error(error); process.exitCode = 1; });
