'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const source = fs.readFileSync(path.join(__dirname, 'elegxosApasxolhseonPeriodoy.js'), 'utf8');
const view = fs.readFileSync(path.join(__dirname,
    '../../../../views/ergazomenoi/programmata/elegxosApasxolhseonPeriodoy.ejs'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '../../../../public/css/main.css'), 'utf8');

assert.match(view, /id="weeklyHrStage1Container"/);
assert.match(source, /weekly-hr-stage1-table/);
assert.match(source, /<tr class="weekly-hr-stage1-card"/);
assert.match(source, /Πιθανές άδειες/);
assert.match(source, /weekly-hr-stage1-day-classification/);
assert.match(source, /UNCLASSIFIED.*LEAVE.*SICKNESS.*ABSENCE/s);
assert.doesNotMatch(source.match(/function renderStage1DayEditor[\s\S]*?\n}/)?.[0] || '',
    /<option value="REPO"/);
assert.match(source, /weekly-hr-select-all-days/);
assert.match(source, /weekly-hr-clear-all-days/);
assert.match(source, /Επιλεγμένες → Άδεια/);
assert.match(source, /Επιλεγμένες → Ασθένεια/);
assert.match(source, /Επιλεγμένες → Απουσία/);
assert.doesNotMatch(source, /Επιλεγμένες → ΡΕΠΟ/);
assert.match(source, /Καθαρισμός χαρακτηρισμού/);
assert.match(source, /Αποθήκευση Χαρακτηρισμών/);
assert.match(source, /\/api\/dropdown\/ergazomenoi\/kathgoria_adeias/);
assert.match(source, /Κάθε επιλεγμένη Άδεια πρέπει να έχει πραγματική κατηγορία άδειας/);
assert.match(source, /isHrSelectableLeaveCategoryOption/);
assert.match(source, /value !== 'POSSIBLE_LEAVE'/);
assert.doesNotMatch(source, /<option value="POSSIBLE_LEAVE" selected>ΠΙΘΑΝΗ ΑΔΕΙΑ<\/option>/);
assert.match(source, /bulk-classify-days/);
assert.match(source, /function updateAuthoritativeReviewDailyRow/);
assert.match(source, /if \(item\.record\) updateAuthoritativeReviewDailyRow\(item\.record\)/);
assert.match(source, /data-review-cell="apologistiko"/);
assert.match(source, /await Promise\.all\(\[\.\.\.affectedKeys\]/);
assert.match(source, /showDetailsModal\(row\)/);
assert.match(source, /weekly-hr-bulk-complete/);
assert.match(source, /Μαζική Ολοκλήρωση Ελέγχου Αδειών \/ Ασθενειών \/ Απουσιών/);
assert.doesNotMatch(source, /weekly-hr-complete[^\s]*[\s\S]*data-row-id/);
const dailySaveFunction = source.match(/async function saveStage1DailyClassificationDrafts\([\s\S]*?\n}/)?.[0] || '';
assert.doesNotMatch(dailySaveFunction, /loadResults\(|location\.reload/);

const scopeHelpers = source.slice(source.indexOf('function stage1DateKey'),
    source.indexOf('async function fetchWeeklyHrStage1'));
const scopeSandbox = {};
vm.runInNewContext(`${scopeHelpers}\nthis.helpers = { buildWeeklyHrStage1Scopes, formatStage1DateKey };`, scopeSandbox);
const juneRows = Array.from({ length: 30 }, (_, index) => ({
    _id: `row-${index + 1}`, employee_id: 'employee-x', kodikos: '0004',
    ypokatasthma: '0000', hmeromhnia: `2026-06-${String(index + 1).padStart(2, '0')}`,
    kathgoria_adeias_apologistika: [2, 11, 26].includes(index + 1) ? 'POSSIBLE_LEAVE' : ''
}));
function weekKeys(start, end) {
    return [...scopeSandbox.helpers.buildWeeklyHrStage1Scopes(juneRows, start, end).values()]
        .map((scope) => `${scope.week_start}/${scope.week_end}`).sort();
}
const juneWeeks = ['2026-06-01/2026-06-07', '2026-06-08/2026-06-14',
    '2026-06-15/2026-06-21', '2026-06-22/2026-06-28', '2026-06-29/2026-07-05'];
assert.deepEqual(weekKeys('2026-06-01', '2026-06-30'), juneWeeks);
const crossMonthScope = [...scopeSandbox.helpers.buildWeeklyHrStage1Scopes(
    juneRows, '2026-06-01', '2026-06-30').values()]
    .find((scope) => scope.week_start === '2026-06-29');
assert.deepEqual(JSON.parse(JSON.stringify(crossMonthScope)), {
    ypokatasthma: '0000', employee_id: 'employee-x', employee_kodikos: '0004',
    week_start: '2026-06-29', week_end: '2026-07-05',
    period_start: '2026-06-01', period_end: '2026-06-30'
});
assert.equal(scopeSandbox.helpers.formatStage1DateKey('2026-06-02'), '02/06/2026');
const comparatorStart = source.indexOf('function compareWeeklyHrStage1Payloads');
const comparatorEnd = source.indexOf('function stage1RowForDate', comparatorStart);
const comparatorSandbox = {};
vm.runInNewContext(`${source.slice(comparatorStart, comparatorEnd)}\n` +
    'this.compare = compareWeeklyHrStage1Payloads;', comparatorSandbox);
const mixedStage1 = [
    { scope: { week_start: '2026-06-08', week_end: '2026-06-14', employee_kodikos: '0002' } },
    { scope: { week_start: '2026-06-15', week_end: '2026-06-21', employee_kodikos: '0001' } },
    { scope: { week_start: '2026-06-01', week_end: '2026-06-07', employee_kodikos: '0002' } },
    { scope: { week_start: '2026-06-08', week_end: '2026-06-14', employee_kodikos: '0001' } },
    { scope: { week_start: '2026-06-01', week_end: '2026-06-07', employee_kodikos: '0001' } }
].sort(comparatorSandbox.compare);
assert.deepEqual(mixedStage1.map((item) => [item.scope.employee_kodikos,
    item.scope.week_start, item.scope.week_end]), [
    ['0001', '2026-06-01', '2026-06-07'],
    ['0001', '2026-06-08', '2026-06-14'],
    ['0001', '2026-06-15', '2026-06-21'],
    ['0002', '2026-06-01', '2026-06-07'],
    ['0002', '2026-06-08', '2026-06-14']
]);

const factsStart = source.indexOf('function stage1DailyPresentationForDate');
const factsEnd = source.indexOf('function stage1LeaveCategoryOptions');
const factsSandbox = { escapeHtml: String,
    formatStage1DateKey: scopeSandbox.helpers.formatStage1DateKey,
    formatAtomicRepoTransferHours: (value) => Number(value).toFixed(2).replace('.', ',') };
vm.runInNewContext(`${source.slice(factsStart, factsEnd)}\nthis.helpers = {
    renderStage1DayFacts, stage1IntervalsText, stage1CurrentClassificationLabel
};`, factsSandbox);
const juneCrossPayload = { stage1_daily_presentation: [{ date: '2026-06-29',
    employment_label: 'Πλήρης', declared_intervals: [{ start: '11:00', end: '19:00' }],
    declared_hours: 8, actual_work_hours: 0, card_intervals: [], card_hours: 0,
    current_apologistiko_classification: 'POSSIBLE_LEAVE' }, { date: '2026-06-30',
    employment_label: 'Πλήρης', declared_intervals: [], declared_hours: 0,
    actual_work_hours: 8.62,
    card_intervals: [{ start: '14:07', end: '23:14' }], card_hours: 9.116666,
    current_apologistiko_classification: 'ΕΡΓ' }] };
const pendingFacts = factsSandbox.helpers.renderStage1DayFacts(juneCrossPayload, '2026-06-29');
assert.match(pendingFacts, /Καθεστώς:<\/strong> Πλήρης/);
assert.match(pendingFacts, /Προδηλωμένο:<\/strong> 11:00–19:00\s*\/ 8,00 ώρες/);
assert.match(pendingFacts, /Πραγματική εργασία:<\/strong>\s*0,00 ώρες/);
assert.match(pendingFacts, /Κάρτες:<\/strong> Δεν υπάρχουν/);
assert.match(pendingFacts, /Ώρες βάσει καρτών:<\/strong>\s*0,00 ώρες/);
assert.match(pendingFacts, /ΠΙΘΑΝΗ ΑΔΕΙΑ/);
const informationalFacts = factsSandbox.helpers.renderStage1DayFacts(
    juneCrossPayload, '2026-06-30', { informational: true });
assert.match(informationalFacts, /30\/06\/2026/);
assert.match(informationalFacts, /Πληροφοριακά/);
assert.match(informationalFacts, /Κάρτες:<\/strong> 14:07–23:14/);
assert.match(informationalFacts, /Πραγματική εργασία:<\/strong>\s*8,62 ώρες/);
const previewStart = source.indexOf('function stage1ClassificationForRow');
const previewEnd = source.indexOf('function renderStage1ReviewDay');
const previewSandbox = { weeklyHrStage1DayDrafts: new Map(), escapeHtml: String,
    stage1DateKey: (value) => String(value || '').slice(0, 10),
    formatStage1DateKey: scopeSandbox.helpers.formatStage1DateKey,
    formatAtomicRepoTransferHours: (value) => Number(value).toFixed(2).replace('.', ',') };
vm.runInNewContext(`${source.slice(previewStart, previewEnd)}\nthis.helpers = {
    renderStage1NoClassificationPreview
};`, previewSandbox);
const previewPayload = (preview, row = {}) => ({ rows: [{ _id: 'preview-row',
    hmeromhnia: '2026-06-02', kathgoria_adeias_apologistika: 'POSSIBLE_LEAVE', ...row }],
    lifecycle_projection: { stage1_no_classification_preview_items: [preview] } });
assert.match(previewSandbox.helpers.renderStage1NoClassificationPreview(previewPayload({
    date: '2026-06-02', safe: true, classification: 'NON_WORK' }), '2026-06-02'),
    /Αν δεν επιλεγεί χαρακτηρισμός:[\s\S]*Θα επιλυθεί ως ΜΗ ΕΡΓΑΣΙΑ\./);
assert.match(previewSandbox.helpers.renderStage1NoClassificationPreview(previewPayload({
    date: '2026-06-02', safe: true, classification: 'REST_REPO',
    source_date: '2026-06-05' }), '2026-06-02'),
    /Θα επιλυθεί ως ΑΝΑΠΑΥΣΗ \/ ΡΕΠΟ\.[\s\S]*Μεταφορά ρεπό από 05\/06\/2026\./);
assert.match(previewSandbox.helpers.renderStage1NoClassificationPreview(previewPayload({
    date: '2026-06-02', safe: false, requires_further_review: true }), '2026-06-02'),
    /Δεν υπάρχει ασφαλής αυτόματη επίλυση\.[\s\S]*περαιτέρω έλεγχο/);
const immutablePreviewPayload = previewPayload({ date: '2026-06-02', safe: true,
    classification: 'NON_WORK' });
const immutablePreviewBefore = JSON.stringify(immutablePreviewPayload);
previewSandbox.helpers.renderStage1NoClassificationPreview(
    immutablePreviewPayload, '2026-06-02');
assert.equal(JSON.stringify(immutablePreviewPayload), immutablePreviewBefore);
assert.equal(previewSandbox.helpers.renderStage1NoClassificationPreview(previewPayload({
    date: '2026-06-02', safe: true, classification: 'REST_REPO' }, {
        adeia_apologistika: true, kathgoria_adeias_apologistika: 'ΑΔΚΑΝ'
    }), '2026-06-02'), '');
assert.match(source, /displayDates = Array\.isArray\(filteredDates\) \? filteredDates :[\s\S]*?payload\.period_slice\?\.actionable_dates/);
assert.match(source, /renderStage1ReviewDay\(payload, date, relevantDates\)/);
assert.match(source, /pending \? renderStage1DayEditor\(payload, date\) : ''/);
assert.doesNotMatch(source.match(/function renderStage1DayFacts[\s\S]*?\n}/)?.[0] || '',
    /context_only_dates/);

const editorStart = source.indexOf('function stage1ClassificationForRow');
const editorEnd = source.indexOf('async function loadWeeklyHrLeaveCategories');
const sandbox = { weeklyHrLeaveCategories: [{ value: 'ΑΔΚΑΝ', label: 'Κανονική άδεια' }],
    weeklyHrStage1DayDrafts: new Map(), weeklyHrStage1DaySelected: new Set(),
    escapeHtml: String, formatStage1DateKey: scopeSandbox.helpers.formatStage1DateKey,
    stage1DateKey: (value) => String(value).slice(0, 10) };
vm.runInNewContext(`${source.slice(editorStart, editorEnd)}\nthis.helpers = { stage1ClassificationForRow, renderStage1DayEditor };`, sandbox);
const payload = { workflow: { unclassified_stage2_candidates: [
    { date: '2026-06-02', label: 'Προς εξέταση ως ΑΝΑΠΑΥΣΗ / ΡΕΠΟ' }
] }, rows: [
    { _id: 'u', hmeromhnia: '2026-06-02', kathgoria_adeias_apologistika: 'POSSIBLE_LEAVE' },
    { _id: 'l', hmeromhnia: '2026-06-04', adeia_apologistika: true, kathgoria_adeias_apologistika: 'ΑΔΚΑΝ' },
    { _id: 's', hmeromhnia: '2026-06-05', astheneia_apologistika: true },
    { _id: 'a', hmeromhnia: '2026-06-06', apousia_apologistika: true }
] };
assert.equal(sandbox.helpers.stage1ClassificationForRow(payload.rows[0]), 'UNCLASSIFIED');
assert.equal(sandbox.helpers.stage1ClassificationForRow(payload.rows[1]), 'LEAVE');
assert.equal(sandbox.helpers.stage1ClassificationForRow(payload.rows[2]), 'SICKNESS');
assert.equal(sandbox.helpers.stage1ClassificationForRow(payload.rows[3]), 'ABSENCE');
const editors = payload.rows.map((row) => sandbox.helpers.renderStage1DayEditor(payload,
    String(row.hmeromhnia).slice(0, 10))).join('');
assert.equal((editors.match(/weekly-hr-stage1-day d-inline-flex/g) || []).length, 4);
assert.match(editors, />—<\/option>/);
assert.match(editors, />Άδεια<\/option>/);
assert.match(editors, /value="ΑΔΚΑΝ" selected>Κανονική άδεια/);
assert.match(editors, />Ασθένεια<\/option>/);
assert.match(editors, />Απουσία<\/option>/);
assert.doesNotMatch(editors, />ΡΕΠΟ<\/option>/);
assert.match(editors, /Προς εξέταση ως ΑΝΑΠΑΥΣΗ \/ ΡΕΠΟ/);
const nonWorkEditor = sandbox.helpers.renderStage1DayEditor({ ...payload,
    workflow: { unclassified_stage2_candidates: [{ date: '2026-06-02',
        label: 'Προς εξέταση ως ΜΗ ΕΡΓΑΣΙΑ' }] } }, '2026-06-02');
assert.match(nonWorkEditor, /Προς εξέταση ως ΜΗ ΕΡΓΑΣΙΑ/);
assert.doesNotMatch(source, /Οι αχαρακτήριστες ημέρες θα εξεταστούν στο επόμενο στάδιο ως πιθανό ΡΕΠΟ/);
const sicknessEditor = sandbox.helpers.renderStage1DayEditor(payload, '2026-06-05');
assert.match(sicknessEditor, /weekly-hr-stage1-leave-category/);
assert.match(sicknessEditor, /disabled aria-disabled="true"/);
assert.match(sicknessEditor, /value="ΑΔΑΣ" selected/);
assert.match(source, /function formatStage1LeaveCategoryLabel/);
const labelHelper = vm.runInNewContext(`(() => { ${source.match(/function formatStage1LeaveCategoryLabel[\s\S]*?\n}/)?.[0]} return formatStage1LeaveCategoryLabel; })()`);
assert.equal(labelHelper('ΑΔΑΠΕΜ..... - Περιγραφή'), 'ΑΔΑΠΕΜ. - Περιγραφή');
assert.equal(labelHelper('ΑΔΚΑΝ - Κανονική άδεια'), 'ΑΔΚΑΝ - Κανονική άδεια');
assert.match(editors, /value="ΑΔΚΑΝ" selected>Κνονική άδεια|value="ΑΔΚΑΝ" selected>Κανονική άδεια/);
assert.match(css, /weekly-hr-stage1-leave-category[\s\S]*width:\s*30rem/);

const eligibilityStart = source.indexOf('function isWeeklyHrStage1Eligible');
const eligibilityEnd = source.indexOf('const workflowStageNames');
const eligibilitySandbox = { weeklyHrStage1DayDrafts: new Map() };
vm.runInNewContext(`${source.slice(eligibilityStart, eligibilityEnd)}\nthis.helpers = {
    isWeeklyHrStage1Eligible, weeklyHrStage1BusinessStatus };`, eligibilitySandbox);
const completedDerived = { stage1_status: 'OPEN', write_enabled: true, rows: [{ _id: 'r1' }],
    workflow: { next_required_hr_stage: 'REPO_RESOLUTION' },
    lifecycle_projection: { stages: { stage1: { business_status: 'COMPLETED' } } } };
assert.equal(eligibilitySandbox.helpers.weeklyHrStage1BusinessStatus(completedDerived),
    'COMPLETED');
assert.equal(eligibilitySandbox.helpers.isWeeklyHrStage1Eligible(completedDerived), false);
const activeDerived = { ...completedDerived,
    lifecycle_projection: { stages: { stage1: { business_status: 'OPEN' } } } };
assert.equal(eligibilitySandbox.helpers.isWeeklyHrStage1Eligible(activeDerived), true);
eligibilitySandbox.weeklyHrStage1DayDrafts.set('r1', { classification: 'LEAVE' });
assert.equal(eligibilitySandbox.helpers.isWeeklyHrStage1Eligible(activeDerived), false);
assert.match(source, /Αποθηκεύστε πρώτα τους χαρακτηρισμούς και μετά ολοκληρώστε το Στάδιο 1/);

// 0014-shaped integration: three OPEN scopes are eligible and selected, while
// the already completed week remains ineligible. Positive daily classification
// is deliberately not part of completion eligibility.
const toolbarStart = source.indexOf('function isWeeklyHrStage1Eligible');
const toolbarEnd = source.indexOf('function updateWeeklyHrStage1BulkToolbar');
const weeklyPayloads = new Map();
const weeklySelected = new Set();
const toolbarSandbox = {
    weeklyHrStage1Payloads: weeklyPayloads,
    weeklyHrStage1Selected: weeklySelected,
    weeklyHrStage1DayDrafts: new Map(),
    weeklyHrStage1DaySelected: new Set(),
    weeklyHrStage1BulkSubmitting: false,
    weeklyHrStage1DaySaving: false,
    stage1DisplayFilters: { open: true, stale: true, completed: true, blocked: true,
        leave: false, sickness: false, absence: false },
    stage1PayloadsForDisplay: () => [...weeklyPayloads.values()],
    visibleWeeklyHrPayloads: () => [...weeklyPayloads.values()]
};
vm.runInNewContext(`${source.slice(toolbarStart, toolbarEnd)}\nthis.helpers = {
    isWeeklyHrStage1Eligible, weeklyHrStage1Counts, renderWeeklyHrStage1BulkToolbar
};`, toolbarSandbox);
const openPayload = (id) => ({ stage1_status: 'OPEN', write_enabled: true,
    rows: [{ _id: id, kathgoria_adeias_apologistika: 'POSSIBLE_LEAVE' }],
    workflow: { next_required_hr_stage: 'LEAVE_CLASSIFICATION' },
    lifecycle_projection: { stages: { stage1: { business_status: 'OPEN' } } } });
for (const [key, item] of [['w1', openPayload('03')], ['w2', openPayload('09')],
    ['w4', openPayload('22')], ['w3', completedDerived]]) weeklyPayloads.set(key, item);
for (const key of ['w1', 'w2', 'w4']) weeklySelected.add(key);
const enabledToolbar = toolbarSandbox.helpers.renderWeeklyHrStage1BulkToolbar();
assert.equal(toolbarSandbox.helpers.weeklyHrStage1Counts().selected, 3);
const enabledButton = enabledToolbar.match(
    /<button[^>]*weekly-hr-bulk-complete[\s\S]*?<\/button>/)?.[0] || '';
assert.match(enabledButton, /Μαζική Ολοκλήρωση/);
assert.doesNotMatch(enabledButton, /disabled/);
assert.equal(toolbarSandbox.helpers.isWeeklyHrStage1Eligible(completedDerived), false);
weeklySelected.clear();
assert.match(toolbarSandbox.helpers.renderWeeklyHrStage1BulkToolbar()
    .match(/<button[^>]*weekly-hr-bulk-complete[\s\S]*?<\/button>/)?.[0] || '', /disabled/);
const blockedPayload = { ...openPayload('blocked'),
    workflow: { next_required_hr_stage: 'BLOCKED' } };
assert.equal(toolbarSandbox.helpers.isWeeklyHrStage1Eligible(blockedPayload), false);
weeklyPayloads.clear();
const hiddenCompletedPayload = { ...completedDerived, scope: { employee_kodikos: '0001' } };
const visibleActivePayload = { ...openPayload('visible'), scope: { employee_kodikos: '0002' } };
weeklyPayloads.set('hidden-completed', hiddenCompletedPayload);
weeklyPayloads.set('visible-active', visibleActivePayload);
toolbarSandbox.visibleWeeklyHrPayloads = () => [visibleActivePayload];
assert.equal(JSON.stringify(toolbarSandbox.helpers.weeklyHrStage1Counts()), JSON.stringify({
    total: 2, open: 1, stale: 0, completed: 1, blocked: 0, selected: 0
}));
assert.doesNotMatch(source.match(/function isWeeklyHrStage1Eligible[\s\S]*?\n}/)?.[0] || '',
    /classificationForRow|LEAVE|SICKNESS|ABSENCE/);
assert.match(source, /id="stage1FilterOpen"[^>]*checked/);
assert.match(source, /id="stage1FilterStale"[^>]*checked/);
assert.match(source, /id="stage1FilterCompleted"[^>]*checked/);
assert.match(source, /id="stage1FilterBlocked"[^>]*checked/);
assert.match(source, /id="stage1FilterLeave"/);
assert.match(source, /id="stage1FilterSickness"/);
assert.match(source, /id="stage1FilterAbsence"/);

const filterHelpersStart = source.indexOf('function stage1ClassificationForRow');
const filterHelpersEnd = source.indexOf('function stage1RelevantDates', filterHelpersStart);
const businessStatusFunction = source.match(
    /function weeklyHrStage1BusinessStatus\([\s\S]*?\n}/)?.[0] || '';
const filterSandbox = {};
vm.runInNewContext(`${source.match(/function stage1DateKey[\s\S]*?\n}/)?.[0]}\n` +
    `${businessStatusFunction}\n${source.slice(filterHelpersStart, filterHelpersEnd)}\n` +
    'this.helpers = { stage1ApplyDisplayFilters, stage1FilteredDatesForPayload, ' +
    'stage1PayloadsForDisplay };',
filterSandbox);
const filterPayload = (status, id, rows = []) => ({
    scope: { employee_kodikos: id, week_start: `2026-06-${id}`, week_end: `2026-06-${id}` },
    stage1_status: status,
    lifecycle_projection: { stages: { stage1: { business_status: status } } },
    rows
});
const classifiedRows = [
    { _id: 'leave', hmeromhnia: '2026-06-01', adeia_apologistika: true,
        kathgoria_adeias_apologistika: 'ΑΔΚΑΝ' },
    { _id: 'possible', hmeromhnia: '2026-06-02', adeia_apologistika: false,
        kathgoria_adeias_apologistika: 'POSSIBLE_LEAVE' },
    { _id: 'sickness', hmeromhnia: '2026-06-03', astheneia_apologistika: true },
    { _id: 'absence', hmeromhnia: '2026-06-04', apousia_apologistika: true },
    { _id: 'none', hmeromhnia: '2026-06-05' }
];
const statusPayloads = [
    filterPayload('OPEN', '01', classifiedRows),
    filterPayload('STALE', '08'),
    filterPayload('COMPLETED', '15', [classifiedRows[0], classifiedRows[2]]),
    filterPayload('BLOCKED', '22', [classifiedRows[0], classifiedRows[3]])
];
const applyFilters = (filters) => filterSandbox.helpers.stage1ApplyDisplayFilters(
    statusPayloads, filters);
const defaultFilters = { open: true, stale: true, completed: true, blocked: true,
    leave: false, sickness: false, absence: false };
assert.equal(applyFilters(defaultFilters).length, 4);
assert.deepEqual(applyFilters({ ...defaultFilters, stale: false, completed: false,
    blocked: false }).map(({ payload }) => payload.stage1_status), ['OPEN']);
assert.deepEqual(applyFilters({ ...defaultFilters, stale: false, completed: false })
    .map(({ payload }) => payload.stage1_status), ['OPEN', 'BLOCKED']);
assert.equal(applyFilters({ ...defaultFilters, open: false, stale: false,
    completed: false, blocked: false }).length, 0);
const leaveResults = applyFilters({ ...defaultFilters, open: false, stale: false,
    completed: false, blocked: false, leave: true });
assert.deepEqual(leaveResults.map(({ payload }) => payload.stage1_status),
    ['OPEN', 'COMPLETED', 'BLOCKED']);
assert.deepEqual(Array.from(leaveResults[0].dates), ['2026-06-01']);
assert.equal(filterSandbox.helpers.stage1ApplyDisplayFilters([
    filterPayload('OPEN', '29', [classifiedRows[1]])
], { ...defaultFilters, leave: true }).length, 0);
const leaveSickness = applyFilters({ ...defaultFilters, leave: true, sickness: true });
assert.deepEqual(Array.from(leaveSickness[0].dates), ['2026-06-01', '2026-06-03']);
assert.deepEqual(applyFilters({ ...defaultFilters, sickness: true })
    .map(({ payload }) => payload.stage1_status), ['OPEN', 'COMPLETED']);
const absence = applyFilters({ ...defaultFilters, absence: true });
assert.deepEqual(Array.from(absence[0].dates), ['2026-06-04']);
assert.equal(absence.some(({ payload }) => payload.stage1_status === 'COMPLETED'), false);
assert.deepEqual(absence.map(({ payload }) => payload.stage1_status), ['OPEN', 'BLOCKED']);

const completedLeavePayload = (kodikos, date) => filterPayload('COMPLETED', kodikos, [{
    _id: `${kodikos}-leave`, hmeromhnia: date, employee_id: `employee-${kodikos}`,
    kodikos, adeia_apologistika: true,
    kathgoria_adeias_apologistika: 'ΑΔΚΑΝ'
}]);
const employee0031 = completedLeavePayload('0031', '2026-06-01');
employee0031.scope.week_start = '2026-06-01';
employee0031.scope.week_end = '2026-06-07';
const employee0015 = completedLeavePayload('0015', '2026-06-30');
const allEmployeesPayloads = new Map([
    ['0031|2026-06-01', employee0031], ['0015|2026-06-30', employee0015]
]);
filterSandbox.weeklyHrStage1Payloads = allEmployeesPayloads;
filterSandbox.visibleWeeklyHrPayloads = () => [employee0015];
filterSandbox.stage1DisplayFilters = { ...defaultFilters, leave: true };
const allCompletedLeaveResults = filterSandbox.helpers.stage1ApplyDisplayFilters(
    filterSandbox.helpers.stage1PayloadsForDisplay(), filterSandbox.stage1DisplayFilters);
assert.deepEqual(Array.from(allCompletedLeaveResults,
    ({ payload }) => payload.scope.employee_kodikos),
    ['0031', '0015']);
assert.deepEqual(Array.from(allCompletedLeaveResults[0].dates), ['2026-06-01']);
filterSandbox.stage1DisplayFilters = defaultFilters;
assert.deepEqual(Array.from(filterSandbox.helpers.stage1PayloadsForDisplay(),
    (payload) => payload.scope.employee_kodikos), ['0031', '0015']);

const manyEmployeePayloads = [
    completedLeavePayload('0001', '2026-06-01'),
    completedLeavePayload('0002', '2026-06-02'),
    filterPayload('OPEN', '0003'),
    filterPayload('BLOCKED', '0004'),
    completedLeavePayload('0010', '2026-06-10'),
    completedLeavePayload('0030', '2026-06-30'),
    employee0031
];
manyEmployeePayloads[1].rows[0].adeia_apologistika = false;
manyEmployeePayloads[1].rows[0].kathgoria_adeias_apologistika = 'POSSIBLE_LEAVE';
const statusCodes = (filters) => Array.from(
    filterSandbox.helpers.stage1ApplyDisplayFilters(manyEmployeePayloads, filters),
    ({ payload }) => payload.scope.employee_kodikos
);
assert.deepEqual(statusCodes({ ...defaultFilters, open: false, stale: false,
    blocked: false }), ['0001', '0002', '0010', '0030', '0031']);
assert.deepEqual(statusCodes({ ...defaultFilters, stale: false, completed: false,
    blocked: false }), ['0003']);
assert.deepEqual(statusCodes({ ...defaultFilters, open: false, stale: false,
    completed: false }), ['0004']);
assert.deepEqual(statusCodes(defaultFilters),
    ['0001', '0002', '0003', '0004', '0010', '0030', '0031']);
assert.deepEqual(statusCodes({ ...defaultFilters, open: false, stale: false,
    completed: false, blocked: false }), []);
assert.deepEqual(statusCodes({ ...defaultFilters, leave: true }),
    ['0001', '0010', '0030', '0031']);

const countsSandbox = {
    weeklyHrStage1Payloads: new Map(statusPayloads.map((payload, index) =>
        [String(index), payload])),
    weeklyHrStage1Selected: new Set(),
    isWeeklyHrStage1Eligible: () => false,
    stage1PayloadsForDisplay: () => statusPayloads
};
vm.runInNewContext(`${businessStatusFunction}\n` +
    `${source.match(/function weeklyHrStage1Counts\([\s\S]*?\n}/)?.[0]}\n` +
    'this.counts = weeklyHrStage1Counts;', countsSandbox);
const countsBefore = JSON.stringify(countsSandbox.counts());
applyFilters({ ...defaultFilters, leave: true });
assert.equal(JSON.stringify(countsSandbox.counts()), countsBefore);

const toolbarSource = source.slice(source.indexOf('function renderWeeklyHrStage1BulkToolbar'),
    source.indexOf('function updateWeeklyHrStage1BulkToolbar'));
for (const legacyControl of ['weekly-hr-select-all', 'weekly-hr-clear-all',
    'weekly-hr-bulk-complete', 'weekly-hr-select-all-days', 'weekly-hr-clear-all-days',
    'weekly-hr-classify-selected', 'weekly-hr-save-day-classifications']) {
    assert.match(toolbarSource, new RegExp(legacyControl));
}
const legacyBulkControls = toolbarSource.match(
    /<div class="[^"]*weekly-hr-legacy-bulk-controls[^"]*">[\s\S]*?<\/div>/)?.[0] || '';
assert.match(legacyBulkControls, /class="d-flex/);
assert.doesNotMatch(legacyBulkControls, /\bd-none\b/);
assert.match(legacyBulkControls, /Επιλογή όλων/);
assert.match(legacyBulkControls, /Αποεπιλογή όλων/);
assert.match(legacyBulkControls,
    /Μαζική Ολοκλήρωση Ελέγχου Αδειών \/ Ασθενειών \/ Απουσιών/);
assert.match(toolbarSource, /d-none border-top[\s\S]*weekly-hr-day-bulk-toolbar/);
assert.match(source, /renderWeeklyHrStage1Card\(payload, filteredDates = null\)/);
assert.match(source, /renderStage1ReviewDay\(payload, date, relevantDates\)/);
assert.match(source, /function stage1PayloadsForDisplay\(\) \{\s*return \[\.\.\.weeklyHrStage1Payloads\.values\(\)\];\s*}/);
assert.match(source.match(/function weeklyHrStage1Counts[\s\S]*?\n}/)?.[0] || '',
    /stage1PayloadsForDisplay\(\)/);
assert.match(source.match(/function renderWeeklyHrStage1Presentation[\s\S]*?\n}/)?.[0] || '',
    /stage1PayloadsForDisplay\(\)/);
assert.match(source.match(/function updateEmploymentReviewWorkflowPresentation[\s\S]*?\n}/)?.[0] || '',
    /visibleWeeklyHrPayloads\(\)/);
assert.match(source, /weekly-hr-select-all-days'[\s\S]*?visibleWeeklyHrPayloads\(\)/);
assert.match(css, /\.weekly-hr-stage1-bulk-toolbar\s*\{[\s\S]*?position:\s*sticky/);
assert.match(css, /\.weekly-hr-stage1-bulk-toolbar \.weekly-hr-bulk-complete\s*\{[\s\S]*?height:\s*auto/);

const resultRendererSource = source.match(
    /function renderWeeklyHrStage1BulkResult\([\s\S]*?\n}/)?.[0] || '';
const resultRenderer = vm.runInNewContext(`(() => { ${resultRendererSource}
    return renderWeeklyHrStage1BulkResult; })()`, {
    escapeHtml: String,
    formatStage1DateKey: scopeSandbox.helpers.formatStage1DateKey
});
const failedBulk = resultRenderer({ requested_count: 3, completed_count: 0,
    already_completed_count: 0, failed_count: 3, blocked_count: 0,
    results: [{ scope: { week_start: '2026-06-01', week_end: '2026-06-07' },
        status: 'FAILED', code: 'PERIOD_CONTROL_HISTORICAL_RECONSTRUCTION_REQUIRED',
        message: 'Απαιτείται ρητή ανακατασκευή ή επανεκτίμηση της εκπρόθεσμης περιόδου.' }] });
assert.match(failedBulk.html, /Εβδομάδα/);
assert.match(failedBulk.html, /Αποτέλεσμα/);
assert.match(failedBulk.html, /Αιτία/);
assert.match(failedBulk.html, /01\/06\/2026–07\/06\/2026/);
assert.match(failedBulk.html, /Απαιτείται ρητή ανακατασκευή ή επανεκτίμηση/);
assert.match(source, /Απαιτείται τελική εξέταση πιθανής άδειας\./);
assert.match(source, /Δεν υπάρχουν υπόλοιπες πιθανές άδειες\./);

const expectedDefaultReason =
    'Ολοκλήρωση ελέγχου Σταδίου 1. – Δεν προέκυψαν επιπλέον χαρακτηρισμοί άδειας, ασθένειας ή απουσίας.';
const bulkFunctionSource = source.slice(
    source.indexOf('async function completeWeeklyHrStage1BulkFromUi'),
    source.indexOf("document.addEventListener('click'")
);
const submittedReasons = [];
let editedReason = null;
const bulkSandbox = {
    weeklyHrStage1BulkSubmitting: false,
    weeklyHrStage1Selected: new Set(['week-1']),
    weeklyHrStage1Payloads: new Map([['week-1', {}]]),
    weeklyHrStage1Scopes: new Map([['week-1', { ypokatasthma: '0000',
        employee_id: 'employee-14', week_start: '2026-06-01', week_end: '2026-06-07' }]]),
    isWeeklyHrStage1Eligible: () => true,
    updateWeeklyHrStage1BulkToolbar: () => {},
    employmentReviewSwal: async (options) => options.input === 'textarea'
        ? { isConfirmed: true, value: editedReason ?? options.inputValue }
        : { isConfirmed: true },
    fetch: async (_url, options) => { submittedReasons.push(
        JSON.parse(options.body).reason_or_notes);
        return { ok: true, json: async () => ({ success: true, requested_count: 1,
            completed_count: 1, already_completed_count: 0, failed_count: 0,
            blocked_count: 0, results: [] }) }; },
    csrfToken: 'csrf', crypto: { randomUUID: () => 'request-id' },
    refreshWeeklyHrStage1Scope: async () => {}, weeklyHrStage1Key: () => 'week-1',
    renderWeeklyHrStage1BulkResult: () => ({ needsReview: 0, text: 'ok', html: '' }),
    console
};
vm.runInNewContext(`${bulkFunctionSource}\nthis.runBulk = completeWeeklyHrStage1BulkFromUi;`, bulkSandbox);
(async () => {
    await bulkSandbox.runBulk();
    editedReason = 'Νέα αιτιολογία HR';
    await bulkSandbox.runBulk();
    assert.deepEqual(submittedReasons, [expectedDefaultReason, 'Νέα αιτιολογία HR']);
})().catch((error) => { console.error(error); process.exitCode = 1; });
assert.match(bulkFunctionSource, new RegExp(`inputValue: '${expectedDefaultReason}'`));
assert.match(bulkFunctionSource,
    /customClass:\s*\{ confirmButton: 'weekly-hr-stage1-bulk-confirm' \}/);
assert.match(css,
    /\.employment-review-swal-popup \.swal2-confirm\.weekly-hr-stage1-bulk-confirm\s*\{[\s\S]*?white-space:\s*nowrap/);
assert.doesNotMatch(css, /\.swal2-confirm\s*\{[^}]*white-space:\s*nowrap/);
console.log('weekly HR Stage 1 compact/bulk classification UI tests passed');
