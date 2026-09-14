'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const source = fs.readFileSync(path.join(__dirname, 'elegxosApasxolhseonPeriodoy.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '../../../../public/css/main.css'), 'utf8');

const defaultReason = 'Μετά από έλεγχο του προδηλωμένου ωραρίου, των πραγματικών στοιχείων απασχόλησης και του καθεστώτος μερικής/εκ περιτροπής απασχόλησης, η ημέρα χαρακτηρίζεται ως ΜΗ ΕΡΓΑΣΙΑ. Δεν προέκυψε άδεια, ασθένεια ή απουσία.';
assert.ok(source.includes(defaultReason));
assert.match(source, /input:\s*'textarea'/);
assert.match(source, /inputValue:\s*selection === 'NON_WORK'\s*\? STAGE3_NON_WORK_DEFAULT_REASON/);
assert.match(source, /inputValidator:[\s\S]*String\(value \|\| ''\)\.trim\(\)/);
assert.match(source, /weekly-hr-stage3-classification/);
assert.match(source, /weekly-hr-stage3-leave-category/);
assert.match(source, /weekly-hr-stage3-resolve/);
assert.match(source, /Προεπισκόπηση απόφασης/);
assert.match(source, /Εφαρμογή χαρακτηρισμού/);
assert.match(source, /cancelButtonText:\s*'Επιστροφή'/);
assert.match(source, /Γιατί απαιτείται απόφαση:/);
assert.match(source, /ΠΡΟΣ ΑΠΟΦΑΣΗ/);
assert.doesNotMatch(source.slice(source.indexOf('function renderWeeklyHrStage3'),
    source.indexOf('function updateEmploymentReviewWorkflowPresentation')),
    />REMAINING_POSSIBLE_LEAVE_REVIEW_REQUIRED</);
assert.match(source, /allowed_classifications/);
assert.match(source, /final_classification:\s*selection/);
assert.match(source, /expected_input_fingerprint:\s*item\.input_fingerprint/);
assert.match(source, /expected_stage3_version:\s*Number\(item\.expected_stage3_version \|\| 0\)/);
const submitStage3 = source.slice(source.indexOf('async function submitWeeklyHrStage3Decision'),
    source.indexOf('function updateEmploymentReviewWorkflowPresentation'));
assert.match(submitStage3, /await loadResults\(\)/);
assert.match(submitStage3, /focusWeeklyHrStage1StaleAfterStage3Save\(\)/);
assert.doesNotMatch(submitStage3, /refreshWeeklyHrStage1Scope/);

const focusSource = source.match(
    /function focusWeeklyHrStage1StaleAfterStage3Save\(\) \{[\s\S]*?\n}/
)?.[0] || '';
const selected = new Set(['hidden-open', 'stale-week']);
const filters = { employeeQuery: 'προηγούμενη αναζήτηση', status: 'ALL',
    leave: true, sickness: true, absence: true };
let pruned = 0;
let rendered = 0;
let opened = 0;
const focusSandbox = {
    stage1PayloadsForDisplay: () => [
        { lifecycle_projection: { stages: { stage1: { business_status: 'COMPLETED' } } } },
        { lifecycle_projection: { stages: { stage1: { business_status: 'STALE' } } } }
    ],
    weeklyHrStage1BusinessStatus: (payload) =>
        payload.lifecycle_projection.stages.stage1.business_status,
    stage1DisplayFilters: filters,
    weeklyHrStage1Selected: selected,
    pruneHiddenWeeklyHrStage1Selections: () => { pruned += 1; },
    renderWeeklyHrStage1Presentation: () => { rendered += 1; },
    document: { querySelector: () => ({}) },
    bootstrap: { Collapse: { getOrCreateInstance: () => ({ show: () => { opened += 1; } }) } }
};
vm.runInNewContext(`${focusSource}\nthis.focus = focusWeeklyHrStage1StaleAfterStage3Save;`,
    focusSandbox);
assert.equal(focusSandbox.focus(), 1);
assert.deepEqual(filters, { employeeQuery: '', status: 'STALE',
    leave: false, sickness: false, absence: false });
assert.equal(selected.size, 0);
assert.equal(pruned, 1);
assert.equal(rendered, 1);
assert.equal(opened, 1);
assert.doesNotMatch(focusSource, /weeklyHrStage1Selected\.add|completeWeeklyHrStage1/);

const helperSource = source.slice(source.indexOf('function stage3DecisionClassificationLabel'),
    source.indexOf('function findStage3PendingItem'));
const sandbox = {
    currentCanonicalLifecyclePayloads: [],
    currentReviewRows: [],
    currentReviewOwnershipPeriod: () => ({ period_start: '2026-05-01', period_end: '2026-05-31' }),
    compareLifecyclePendingItems: (left, right) => left.date.localeCompare(right.date),
    stage1DateKey: (value) => String(value || '').slice(0, 10),
    formatStage1DateKey: (value) => String(value || '').slice(0, 10).split('-').reverse().join('/'),
    enumerateStage1DateKeys: (start, end) => {
        const dates = [];
        for (const date = new Date(`${start}T00:00:00.000Z`); date.toISOString().slice(0, 10) <= end;
            date.setUTCDate(date.getUTCDate() + 1)) dates.push(date.toISOString().slice(0, 10));
        return dates;
    },
    escapeHtml: (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;'),
    formatPolicyPreviewHours: (value) => Number(value).toFixed(2),
    stage3ClassificationOptions: (item) => (item.allowed_classifications || [])
        .map((value) => `<option value="${value}">${value}</option>`).join(''),
    stage1LeaveCategoryOptions: () => '<option value="REGULAR">Κανονική</option>',
    document: { getElementById: () => sandbox.container },
    container: { innerHTML: '' }
};
vm.runInNewContext(`${helperSource}\nthis.helpers = { groupStage3PendingItems, renderWeeklyHrStage3,
    buildStage3EmployeeNameLookup, stage3EmployeeDisplayName,
    stage3DeclaredPresentation, stage3DecisionExplanation, stage3PayloadForItem,
    stage3DailyPresentation, stage3ApologistikoClassification,
    stage3DecisionClassificationLabel, stage3DecisionExplanationHtml, stage3WeekKey };`, sandbox);

function weekRows(start, pendingDates = []) {
    return sandbox.enumerateStage1DateKeys(start,
        new Date(new Date(`${start}T00:00:00.000Z`).getTime() + 6 * 86400000)
            .toISOString().slice(0, 10)).map((date, index) => ({
        _id: `row-${date}`, hmeromhnia: date, apo_ora_01: index < 5 ? '08:00' : '',
        eos_ora_01: index < 5 ? '16:00' : '', kathgoria_ergasias_apologistika: index < 5 ? 'ΕΡΓ' : 'ΑΝ',
        kathgoria_adeias_apologistika: pendingDates.includes(date) ? 'POSSIBLE_LEAVE' : '',
        repo_apologistika: index >= 5, ores_pragmatikhs_ergasias_apologistika: index < 5 ? 8 : 0
    }));
}

function payload(employee, start, end, pendingDates) {
    const rows = weekRows(start, pendingDates);
    return { scope: { employee_id: employee, employee_kodikos: employee, week_start: start,
        week_end: end, period_start: '2026-05-01', period_end: '2026-05-31' },
        employee_name: `Εργαζόμενος ${employee}`, rows,
        employment_date_scope: { authoritative_date_set: rows.map((row) => row.hmeromhnia),
            context_only_dates: [] },
        stage1_daily_presentation: rows.map((row) => ({ date: row.hmeromhnia,
            actual_work_hours: row.ores_pragmatikhs_ergasias_apologistika,
            current_apologistiko_classification: row.kathgoria_ergasias_apologistika })) };
}

function pending(employee, start, end, date) {
    return { employee_id: employee, employee_kodikos: employee, ypokatasthma: '0000',
        week_start: start, week_end: end,
        period_start: '2026-05-01', period_end: '2026-05-31', row_id: `row-${date}`, date,
        declared_hours: 8, actual_work_hours: 0,
        allowed_classifications: ['LEAVE', 'SICKNESS', 'ABSENCE'],
        presentation_facts: { declared_work_present: true, declared_hours: 8,
            actual_work_hours: 0, actual_work_missing: true,
            weekly_rest_already_satisfied: true, current_period_writable: true,
            context_only: false, final_human_decision_required: true }, input_fingerprint: 'f',
        expected_stage3_version: 0 };
}

const mayItems = [pending('0012', '2026-05-11', '2026-05-17', '2026-05-14')];
sandbox.currentCanonicalLifecyclePayloads.push(payload('0012', '2026-05-11', '2026-05-17', ['2026-05-14']));
sandbox.helpers.renderWeeklyHrStage3({ stages: { STAGE3: { pending_items: mayItems } } });
assert.equal((sandbox.container.innerHTML.match(/data-stage3-week-date=/g) || []).length, 7,
    'το προαιρετικό πλαίσιο περιέχει ολόκληρη την εβδομάδα');
assert.match(sandbox.container.innerHTML, /stage3-full-week-context d-none/,
    'το πλήρες εβδομαδιαίο πλαίσιο είναι κλειστό από προεπιλογή');
assert.match(sandbox.container.innerHTML, /Εμφάνιση όλης της εβδομάδας/);
assert.match(sandbox.container.innerHTML, /data-stage3-week-date="2026-05-14"[\s\S]*ΠΡΟΣ ΑΠΟΦΑΣΗ/);
assert.equal((sandbox.container.innerHTML.match(/class="table-warning stage3-decision-item"/g) || []).length, 1,
    'από προεπιλογή υπάρχει μόνο μία γραμμή προς απόφαση');
assert.match(sandbox.container.innerHTML, /stage3-employee-name">Εργαζόμενος 0012/);
assert.match(sandbox.container.innerHTML, /stage3-employee-code">Κωδικός: 0012/);
assert.match(sandbox.container.innerHTML, /1 προς απόφαση/);
assert.match(sandbox.container.innerHTML, /08:00–16:00 \/ 8,00 ώρες/);
assert.match(sandbox.container.innerHTML, /Πραγματική εργασία \/ κάρτες/);
assert.match(sandbox.container.innerHTML, /Καθεστώς ημέρας/);
assert.equal((sandbox.container.innerHTML.match(/<th>/g) || []).length, 14,
    'διατηρούνται οι οκτώ στήλες αποφάσεων και οι έξι στήλες πλαισίου');
assert.match(sandbox.container.innerHTML, /stage3-decisions-table-wrapper/);
assert.match(sandbox.container.innerHTML, /stage3-col-reason/);
assert.match(sandbox.container.innerHTML, /stage3-decision-reason/);
assert.match(sandbox.container.innerHTML, /stage3-decision-classification/);
assert.match(sandbox.container.innerHTML, /stage3-decision-action/);
assert.match(css, /\.weekly-hr-stage3-decisions-table\s*\{[^}]*min-width:\s*82rem[^}]*table-layout:\s*fixed/s);
assert.match(css, /\.stage3-col-date\s*\{\s*width:\s*9%/);
assert.match(css, /\.stage3-col-day\s*\{\s*width:\s*6%/);
assert.match(css, /\.stage3-col-day-status\s*\{\s*width:\s*9%/);
assert.match(css, /\.stage3-col-declared\s*\{\s*width:\s*11%/);
assert.match(css, /\.stage3-col-actual\s*\{\s*width:\s*11%/);
assert.match(css, /\.stage3-col-reason\s*\{\s*width:\s*23%/);
assert.match(css, /\.stage3-col-classification\s*\{\s*width:\s*17%/);
assert.match(css, /\.stage3-col-action\s*\{\s*width:\s*14%/);
assert.match(css,
    /\.stage3-decision-classification \.form-select,[^}]*\.stage3-decision-action \.weekly-hr-stage3-resolve\s*\{[^}]*width:\s*100%[^}]*min-width:\s*0/s);
assert.match(sandbox.container.innerHTML, /Υπήρχε προδηλωμένη εργασία 8,00 ωρών/);
assert.match(sandbox.container.innerHTML, /Δεν προέκυψε πραγματική εργασία από κάρτες/);
assert.match(sandbox.container.innerHTML, /Η εβδομαδιαία ανάπαυση έχει ήδη καλυφθεί/);
assert.match(sandbox.container.innerHTML,
    /Χρειάζεται τελικός χαρακτηρισμός από το HR: Άδεια, Ασθένεια, Απουσία/);
assert.doesNotMatch(sandbox.container.innerHTML, /stage3-boundary-week-guidance/,
    'μια κανονική εβδομάδα δεν εμφανίζει περιττή επεξήγηση άλλης περιόδου');
assert.deepEqual(Array.from(sandbox.helpers.stage3DecisionExplanation({
    declared_hours: 8, actual_work_hours: 0,
    allowed_classifications: ['LEAVE', 'SICKNESS', 'ABSENCE'],
    presentation_facts: { declared_work_present: true, declared_hours: 8,
        actual_work_missing: true }
}).map((line) => line.text)), [
    'Υπήρχε προδηλωμένη εργασία 8,00 ωρών.',
    'Δεν προέκυψε πραγματική εργασία από κάρτες ή άλλα διαθέσιμα στοιχεία.',
    'Δεν προέκυψε ασφαλής αυτόματη τελική ταξινόμηση για τη συγκεκριμένη ημέρα.',
    'Χρειάζεται τελικός χαρακτηρισμός από το HR: Άδεια, Ασθένεια, Απουσία.'
]);

const loadedEmployeeRow = { kodikos: '0007', eponymo: 'ΣΠΥΡΙΔΩΝΟΣ', onoma: 'ΑΡΕΤΗ' };
const employeeNamePayload = payload('0007', '2026-05-18', '2026-05-24', ['2026-05-19']);
employeeNamePayload.employee_name = '';
sandbox.currentCanonicalLifecyclePayloads.push(employeeNamePayload);
sandbox.currentReviewRows.push(loadedEmployeeRow);
sandbox.helpers.renderWeeklyHrStage3({ stages: { STAGE3: { pending_items: [
    pending('0007', '2026-05-18', '2026-05-24', '2026-05-19')
] } } });
assert.match(sandbox.container.innerHTML, /stage3-employee-name">ΣΠΥΡΙΔΩΝΟΣ ΑΡΕΤΗ/);
assert.match(sandbox.container.innerHTML, /stage3-employee-code">Κωδικός: 0007/);
assert.equal(typeof sandbox.fetch, 'undefined', 'η επίλυση ονόματος δεν χρειάζεται HTTP αίτημα');
const escapedNames = sandbox.helpers.buildStage3EmployeeNameLookup([
    { kodikos: '0099', eponymo: '<script>', onoma: 'ΔΟΚΙΜΗ' }
]);
assert.equal(sandbox.escapeHtml(sandbox.helpers.stage3EmployeeDisplayName({ employee_name: '',
    scope: { employee_kodikos: '0099' } }, escapedNames)), '&lt;script&gt; ΔΟΚΙΜΗ');
sandbox.currentCanonicalLifecyclePayloads.pop();
sandbox.currentReviewRows.pop();

assert.equal(sandbox.helpers.stage3DeclaredPresentation({ repo: true }), 'ΡΕΠΟ');
assert.equal(sandbox.helpers.stage3DeclaredPresentation({}), 'Δεν υπάρχει προδηλωμένο ωράριο');
assert.notEqual(sandbox.helpers.stage3WeekKey({ employee_id: 'E', week_start: '2026-05-11',
    week_end: '2026-05-17' }), sandbox.helpers.stage3WeekKey({ employee_id: 'E',
    week_start: '2026-05-11', week_end: '2026-05-18' }));

const sameWeek = [...mayItems, pending('0012', '2026-05-11', '2026-05-17', '2026-05-15')];
assert.equal(sandbox.helpers.groupStage3PendingItems(sameWeek, sandbox.currentCanonicalLifecyclePayloads).length, 1);
const otherWeek = pending('0012', '2026-05-18', '2026-05-24', '2026-05-19');
assert.equal(sandbox.helpers.groupStage3PendingItems([...sameWeek, otherWeek], []).length, 2);

const crossMonth = pending('0013', '2026-04-27', '2026-05-03', '2026-05-01');
const crossMonthPayload = payload('0013', '2026-04-27', '2026-05-03', ['2026-05-01']);
crossMonthPayload.employee_name = '<img src=x onerror=alert(1)>';
crossMonthPayload.scope.employee_kodikos = '<script>alert(2)</script>';
crossMonthPayload.employment_date_scope = {
    authoritative_date_set: ['2026-05-01', '2026-05-02', '2026-05-03'],
    context_only_dates: ['2026-04-27', '2026-04-28', '2026-04-29', '2026-04-30']
};
sandbox.currentCanonicalLifecyclePayloads.push(crossMonthPayload);
sandbox.helpers.renderWeeklyHrStage3({ stages: { STAGE3: { pending_items: [crossMonth] } } });
assert.equal((sandbox.container.innerHTML.match(/data-stage3-week-date=/g) || []).length, 7);
assert.equal((sandbox.container.innerHTML.match(/Άλλη περίοδος — μόνο πλαίσιο/g) || []).length, 4);
assert.equal((sandbox.container.innerHTML.match(/Τρέχουσα περίοδος — επιτρέπεται απόφαση/g) || []).length, 3);
assert.equal((sandbox.container.innerHTML.match(/stage3-boundary-week-guidance/g) || []).length, 1,
    'η επεξήγηση εμφανίζεται μία φορά ανά επηρεαζόμενη εβδομάδα');
assert.match(sandbox.container.innerHTML,
    /Η εβδομάδα περιλαμβάνει ημέρες από άλλη περίοδο\./);
assert.match(sandbox.container.innerHTML,
    /Οι ημέρες αυτές εμφανίζονται μόνο για πλαίσιο και δεν αλλάζουν από εδώ\./);
assert.equal((sandbox.container.innerHTML.match(/weekly-hr-stage3-classification/g) || []).length, 1,
    'οι ημέρες πλαισίου δεν αποκτούν χειριστήριο απόφασης');
assert.doesNotMatch(sandbox.container.innerHTML,
    /context_only|authoritative_date_set|boundary ownership|period scope|source period|lifecycle scope/);
assert.doesNotMatch(sandbox.container.innerHTML, /<img|<script/);
assert.match(sandbox.container.innerHTML, /&lt;img src=x onerror=alert\(1\)&gt;/);
assert.match(source, /Απόκρυψη όλης της εβδομάδας/);

sandbox.currentCanonicalLifecyclePayloads.length = 0;
sandbox.helpers.renderWeeklyHrStage3({ stages: { STAGE3: { pending_items: mayItems } } });
assert.match(sandbox.container.innerHTML, /Δεν είναι διαθέσιμο το πλήρες εβδομαδιαίο πλαίσιο\./);
assert.doesNotMatch(sandbox.container.innerHTML, /stage3-week-context-toggle/);
assert.doesNotMatch(sandbox.container.innerHTML, /weekly-hr-stage3-table/);

const renderSection = source.slice(source.indexOf('function renderWeeklyHrStage3'),
    source.indexOf('function findStage3PendingItem'));
assert.doesNotMatch(renderSection, /fetch\(|axios|XMLHttpRequest/,
    'η παρουσίαση δεν προσθέτει HTTP N+1');
assert.match(source, /final_classification:\s*selection/);
assert.match(source, /body:\s*JSON\.stringify\(\{ ypokatasthma: item\.ypokatasthma/);
assert.match(source, /renderWeeklyHrStage2LifecycleFallback\(lifecycle\);[\s\S]*renderWeeklyHrStage3\(lifecycle\)/);
assert.match(source, /renderStage4|STAGE4/);
assert.match(source, /pending_count: entries\.reduce/);

function extractFunction(name) {
    const start = source.indexOf(`function ${name}(`);
    const asyncStart = source.indexOf(`async function ${name}(`);
    const functionStart = asyncStart >= 0 && (start < 0 || asyncStart < start) ? asyncStart : start;
    assert.notEqual(functionStart, -1, `Δεν βρέθηκε η ${name}`);
    let parentheses = 0;
    let parametersStarted = false;
    let bodyStart = -1;
    for (let index = functionStart; index < source.length; index += 1) {
        if (source[index] === '(') { parentheses += 1; parametersStarted = true; }
        else if (source[index] === ')') parentheses -= 1;
        else if (source[index] === '{' && parametersStarted && parentheses === 0) {
            bodyStart = index; break;
        }
    }
    assert.notEqual(bodyStart, -1, `Δεν βρέθηκε το σώμα της ${name}`);
    let depth = 0;
    for (let index = bodyStart; index < source.length; index += 1) {
        if (source[index] === '{') depth += 1;
        if (source[index] === '}' && --depth === 0) return source.slice(functionStart, index + 1);
    }
    assert.fail(`Δεν ολοκληρώθηκε η ${name}`);
}

async function verifyStage3PreviewContract() {
    const previewCalls = [];
    let submitCalls = 0;
    const previewItem = pending('0007', '2026-04-27', '2026-05-03', '2026-05-02');
    const previewRow = {
        querySelector(selector) {
            if (selector === '.weekly-hr-stage3-classification') return { value: 'LEAVE' };
            if (selector === '.weekly-hr-stage3-leave-category') return {
                value: 'KANONIKH', selectedOptions: [{ textContent: 'Κανονική άδεια <δοκιμή>' }]
            };
            return null;
        }
    };
    const previewSandbox = {
        findStage3PendingItem: () => previewItem,
        document: { querySelector: () => previewRow }, CSS: { escape: String },
        stage3DecisionPreviewHtml: (_item, decision) => {
            assert.equal(decision.selection, 'LEAVE');
            assert.equal(decision.leaveCategoryLabel, 'Κανονική άδεια <δοκιμή>');
            return '<div>preview</div>';
        },
        employmentReviewSwal: async (options) => { previewCalls.push(options); return { isConfirmed: false }; },
        submitWeeklyHrStage3Decision: async () => { submitCalls += 1; }
    };
    vm.runInNewContext(`${extractFunction('previewWeeklyHrStage3Decision')};
        this.preview = previewWeeklyHrStage3Decision;`, previewSandbox);
    await previewSandbox.preview(previewItem.row_id);
    assert.equal(submitCalls, 0, 'επιστροφή από την προεπισκόπηση δεν υποβάλλει απόφαση');
    assert.equal(previewCalls.length, 1);
    assert.equal(previewCalls[0].confirmButtonText, 'Εφαρμογή χαρακτηρισμού');
    assert.equal(previewCalls[0].cancelButtonText, 'Επιστροφή');
    assert.equal(previewCalls[0].input, 'textarea');
    assert.equal(previewCalls[0].inputAttributes.rows, '3');
    assert.equal(previewCalls[0].customClass.popup,
        'employment-review-stage3-preview-popup');
    assert.match(css,
        /\.swal2-popup\.employment-review-stage3-preview-popup\s*\{[^}]*max-height:\s*calc\(100dvh - 2rem\)[^}]*overflow:\s*hidden/s);
    assert.match(css,
        /\.employment-review-stage3-preview-popup \.swal2-html-container\s*\{[^}]*max-height:\s*calc\(100dvh - 18rem\)\s*!important[^}]*overflow-y:\s*auto\s*!important/s);
    assert.match(css,
        /\.employment-review-stage3-preview-popup \.swal2-textarea\s*\{[^}]*min-height:\s*3\.75rem[^}]*height:\s*4\.25rem[^}]*resize:\s*vertical/s);
    assert.match(css,
        /\.employment-review-stage3-preview-popup \.swal2-actions\s*\{[^}]*margin:\s*0\.45rem auto 0/s);
    assert.equal(typeof previewSandbox.fetch, 'undefined', 'η προεπισκόπηση δεν χρειάζεται fetch');

    previewSandbox.employmentReviewSwal = async () => ({ isConfirmed: true,
        value: '<img src=x onerror=alert(1)>' });
    await previewSandbox.preview(previewItem.row_id);
    assert.equal(submitCalls, 1, 'μόνο η ρητή επιβεβαίωση καλεί την υπάρχουσα υποβολή');

    const previewPayload = payload('0007', '2026-04-27', '2026-05-03', ['2026-05-02']);
    previewPayload.employee_name = '<b>ΠΑΠΑΔΟΠΟΥΛΟΣ ΝΙΚΟΣ</b>';
    sandbox.currentCanonicalLifecyclePayloads.push(previewPayload);
    Object.assign(sandbox, sandbox.helpers);
    vm.runInNewContext(`${extractFunction('stage3DecisionPreviewHtml')};
        this.previewHtml = stage3DecisionPreviewHtml;`, sandbox);
    const previewHtml = sandbox.previewHtml(previewItem, {
        selection: 'LEAVE', leaveCategoryLabel: 'Κανονική <άδεια>'
    });
    assert.match(previewHtml, /Κωδικός: 0007/);
    assert.match(previewHtml, /02\/05\/2026/);
    assert.match(previewHtml, /Τι διαπιστώθηκε/);
    assert.match(previewHtml, /Πριν[\s\S]*Χωρίς οριστικό χαρακτηρισμό[\s\S]*→[\s\S]*Μετά[\s\S]*Άδεια/);
    assert.match(previewHtml, /Κατηγορία άδειας:[\s\S]*Κανονική &lt;άδεια&gt;/);
    assert.doesNotMatch(previewHtml, /<b>ΠΑΠΑΔΟΠΟΥΛΟΣ|<άδεια>/);

    let request = null;
    let fetchCount = 0;
    const submitButton = { disabled: false };
    const submitSandbox = {
        findStage3PendingItem: () => previewItem,
        document: { querySelector: () => ({ querySelector: () => submitButton }) },
        CSS: { escape: String }, csrfToken: 'csrf', crypto: { randomUUID: () => 'uuid' },
        fetch: async (url, options) => { fetchCount += 1; request = { url, options };
            return { ok: true, json: async () => ({ success: true }) }; },
        loadResults: async () => {}, focusWeeklyHrStage1StaleAfterStage3Save: () => 0,
        employmentReviewSwal: async () => {}
    };
    vm.runInNewContext(`${extractFunction('submitWeeklyHrStage3Decision')};
        this.submit = submitWeeklyHrStage3Decision;`, submitSandbox);
    await submitSandbox.submit(previewItem.row_id, { selection: 'LEAVE',
        leaveCategory: 'KANONIKH', reasonOrNotes: '<σημείωση>' });
    assert.equal(fetchCount, 1, 'η επιβεβαίωση εκτελεί ακριβώς μία υπάρχουσα υποβολή');
    assert.equal(request.url,
        '/api/prodhlomena-oraria/review/weekly-hr-workflow/stage3/resolve-day');
    assert.equal(request.options.method, 'POST');
    const body = JSON.parse(request.options.body);
    assert.deepEqual(Object.keys(body), ['ypokatasthma', 'employee_id', 'week_start', 'week_end',
        'period_start', 'period_end', 'row_id', 'decision_date', 'expected_input_fingerprint',
        'expected_stage3_version', 'final_classification', 'leave_category', 'reason_or_notes',
        'request_id']);
    assert.equal(body.final_classification, 'LEAVE');
    assert.equal(body.leave_category, 'KANONIKH');
    assert.equal(body.reason_or_notes, '<σημείωση>');
    assert.equal(body.expected_input_fingerprint, 'f');
    assert.equal(body.expected_stage3_version, 0);
    assert.equal(body.request_id, 'stage3-ui:uuid');
}

async function verifyStage3LeaveCategoriesWithoutStage1() {
    let categoryFetches = 0;
    const categorySandbox = {
        weeklyHrLeaveCategories: [], csrfToken: 'csrf',
        escapeHtml: (value) => String(value ?? '').replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;'),
        fetch: async (url, options) => {
            categoryFetches += 1;
            assert.equal(url, '/api/dropdown/ergazomenoi/kathgoria_adeias');
            assert.equal(options.headers['CSRF-Token'], 'csrf');
            return { json: async () => [
                { value: 'ΑΔΚΑΝ', label: 'ΑΔΚΑΝ - Κανονική άδεια' },
                { value: 'ΑΔΑΣ', label: 'ΑΔΑΣ - Ασθένεια' },
                { value: 'POSSIBLE_LEAVE', label: 'ΠΙΘΑΝΗ ΑΔΕΙΑ' }
            ] };
        }
    };
    vm.runInNewContext(`${extractFunction('isHrSelectableLeaveCategoryOption')};
        ${extractFunction('formatStage1LeaveCategoryLabel')};
        ${extractFunction('stage1LeaveCategoryOptions')};
        ${extractFunction('loadWeeklyHrLeaveCategories')};
        ${extractFunction('updateStage3LeaveCategoryVisibility')};
        this.loadCategories = loadWeeklyHrLeaveCategories;
        this.categoryOptions = stage1LeaveCategoryOptions;
        this.updateVisibility = updateStage3LeaveCategoryVisibility;`, categorySandbox);

    assert.equal((categorySandbox.categoryOptions('').match(/<option/g) || []).length, 1,
        'πριν φορτωθεί η κοινή πηγή υπάρχει μόνο το placeholder');
    await categorySandbox.loadCategories();
    const options = categorySandbox.categoryOptions('');
    assert.match(options, /value="ΑΔΚΑΝ"/);
    assert.match(options, /value="ΑΔΑΣ"/);
    assert.doesNotMatch(options, /POSSIBLE_LEAVE|ΠΙΘΑΝΗ ΑΔΕΙΑ/);
    assert.equal((options.match(/<option/g) || []).length, 3);
    await categorySandbox.loadCategories();
    assert.equal(categoryFetches, 1, 'η κοινή λίστα επαναχρησιμοποιείται χωρίς δεύτερο αίτημα');

    const makeRow = (selectedValue) => {
        const classes = new Set(['d-none']);
        const category = { value: selectedValue, classList: {
            toggle(name, force) { if (force) classes.add(name); else classes.delete(name); },
            contains(name) { return classes.has(name); }
        } };
        const row = { querySelector: () => category };
        const classification = { value: 'LEAVE', closest: () => row };
        return { category, classification };
    };
    const first = makeRow('ΑΔΚΑΝ');
    const second = makeRow('ΑΔΑΣ');
    categorySandbox.updateVisibility(first.classification);
    categorySandbox.updateVisibility(second.classification);
    assert.equal(first.category.classList.contains('d-none'), false);
    assert.equal(second.category.classList.contains('d-none'), false);
    assert.equal(first.category.value, 'ΑΔΚΑΝ');
    assert.equal(second.category.value, 'ΑΔΑΣ');
    first.classification.value = 'ABSENCE';
    categorySandbox.updateVisibility(first.classification);
    assert.equal(first.category.classList.contains('d-none'), true);
    assert.equal(first.category.value, 'ΑΔΚΑΝ',
        'διατηρείται η υπάρχουσα συμπεριφορά χωρίς κοινή κατάσταση επιλογής');
    first.classification.value = 'LEAVE';
    categorySandbox.updateVisibility(first.classification);
    assert.equal(first.category.classList.contains('d-none'), false);
    assert.match(categorySandbox.categoryOptions(first.category.value),
        /value="ΑΔΚΑΝ" selected/);

    const loadResultsStart = source.indexOf('async function loadResults(');
    const loadResultsSource = source.slice(loadResultsStart,
        source.indexOf('function pairNo(', loadResultsStart));
    const categoryLoadAt = loadResultsSource.indexOf('await loadWeeklyHrLeaveCategories()');
    assert.ok(categoryLoadAt >= 0);
    assert.ok(categoryLoadAt < loadResultsSource.lastIndexOf(
        'updateEmploymentReviewWorkflowPresentation();'),
    'η κοινή λίστα φορτώνεται πριν αποδοθεί το Stage 3, χωρίς να ανοιχτεί το Stage 1');
    assert.doesNotMatch(extractFunction('updateStage3LeaveCategoryVisibility'),
        /fetch|submit|POST|loadPreparedWeeklyHrStage1/);
}

Promise.all([verifyStage3PreviewContract(), verifyStage3LeaveCategoriesWithoutStage1()]).then(() => {
    console.log('Stage-3 weekly decision context and actionable UI contracts passed');
});
