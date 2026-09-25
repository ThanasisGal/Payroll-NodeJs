'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname,
    'elegxosApasxolhseonPeriodoy.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '../../../../public/css/main.css'), 'utf8');

const helpersSource = source.slice(source.indexOf('function stage1ClassificationForRow'),
    source.indexOf('async function loadWeeklyHrLeaveCategories'));
const matrixSource = source.slice(source.indexOf('function stage1NaturalWeekDates'),
    source.indexOf('function renderWeeklyHrStage1Error'));

const drafts = new Map([
    ['d04', { classification: 'ABSENCE', kathgoria_adeias_apologistika: '' }],
    ['d05', { classification: 'SICKNESS', kathgoria_adeias_apologistika: 'ΑΔΑΣ' }],
    ['d06', { classification: 'SICKNESS', kathgoria_adeias_apologistika: 'ΑΔΑΣ' }],
    ['d07', { classification: 'LEAVE', kathgoria_adeias_apologistika: 'ΑΔΚΑΝ' }],
    ['d08', { classification: 'LEAVE', kathgoria_adeias_apologistika: 'ΑΔΚΑΝ' }],
    ['d09', { classification: 'LEAVE', kathgoria_adeias_apologistika: 'ΑΔΚΑΝ' }]
]);
const selectedDays = new Set(['d04', 'd05']);
const sandbox = {
    weeklyHrStage1DayDrafts: drafts,
    weeklyHrStage1DaySelected: selectedDays,
    weeklyHrLeaveCategories: [{ value: 'ΑΔΚΑΝ', label: 'ΑΔΚΑΝ - Κανονική άδεια' }],
    weeklyHrStage1Selected: new Set(['week']),
    weeklyHrStage1RowsById: new Map(),
    weeklyHrStage1Payloads: new Map(),
    weeklyHrStage1EditorRowId: 'd05',
    stage1DisplayFilters: { employeeQuery: '', status: 'ALL', leave: false,
        sickness: false, absence: false },
    weeklyHrStage1Key: () => 'week',
    weeklyHrStage1BusinessStatus: (payload) =>
        payload.lifecycle_projection.stages.stage1.business_status,
    weeklyHrHasOnlyOrphanBlockers: () => false,
    weeklyHrBlockedExplanation: () => '',
    isWeeklyHrStage1Selectable: () => true,
    weeklyHrStage1IndexWarning: () => '',
    weeklyHrOrphanRows: () => [],
    renderWeeklyHrOrphanItem: () => '',
    stage1DateKey: (value) => String(value || '').slice(0, 10),
    formatStage1DateKey: (value) => {
        const [year, month, day] = String(value).split('-');
        return `${day}/${month}/${year}`;
    },
    escapeHtml: String,
    formatAtomicRepoTransferHours: (value) => String(value)
};
vm.runInNewContext(`${helpersSource}\n${matrixSource}\nthis.helpers = {
    renderWeeklyHrStage1Card, renderStage1MatrixDayCell, stage1NaturalWeekDates,
    renderWeeklyHrStage1DayEditorPanel, weeklyHrStage1PendingRowIds,
    navigateWeeklyHrStage1DayEditor, stage1ContextPeriodPresentation,
    isWeeklyHrStage1DayPending, selectVisiblePendingWeeklyHrStage1Days
};`, sandbox);

const dates = sandbox.helpers.stage1NaturalWeekDates('2026-08-03');
assert.deepEqual(Array.from(dates), [
    '2026-08-03', '2026-08-04', '2026-08-05', '2026-08-06',
    '2026-08-07', '2026-08-08', '2026-08-09'
]);
const rows = dates.map((date, index) => ({
    _id: `d0${index + 3}`,
    hmeromhnia: date,
    ...(index === 0 ? { kathgoria_ergasias_apologistika: 'ΕΡΓ' } : {})
}));
const payload = {
    scope: { employee_kodikos: '0001', week_start: dates[0], week_end: dates[6],
        period_start: dates[0], period_end: dates[6] },
    employee_name: 'ΟΙΚΟΝΟΜΟΥ ΑΙΚ.',
    stage1_status: 'OPEN', write_enabled: true,
    workflow: { next_required_hr_stage: 'LEAVE_CLASSIFICATION',
        possible_leave_days: dates.slice(1), unclassified_stage2_candidates: [] },
    lifecycle_projection: { stages: { stage1: { business_status: 'OPEN' } } },
    period_slice: { actionable_dates: dates, context_only_dates: [] },
    stage1_daily_presentation: dates.map((date, index) => ({
        date, current_apologistiko_classification: index === 0 ? 'ΕΡΓ' : 'POSSIBLE_LEAVE'
    })),
    rows
};
sandbox.weeklyHrStage1Payloads.set('week', payload);
rows.forEach((row) => sandbox.weeklyHrStage1RowsById.set(row._id, row));
const html = sandbox.helpers.renderWeeklyHrStage1Card(payload);
assert.equal((html.match(/weekly-hr-stage1-matrix-day-cell/g) || []).length, 7);
dates.forEach((date) => assert.match(html,
    new RegExp(sandbox.formatStage1DateKey(date).slice(0, 5).replace('/', '\\/'))));
assert.equal((html.match(/<strong>ΑΠΟΥΣΙΑ<\/strong>/g) || []).length, 1);
assert.equal((html.match(/<strong>ΑΣΘΕΝΕΙΑ<\/strong>/g) || []).length, 2);
assert.equal((html.match(/<strong>ΑΔΕΙΑ<\/strong>/g) || []).length, 3);
assert.equal((html.match(/<span>ΑΔΚΑΝ<\/span>/g) || []).length, 3);
assert.doesNotMatch(html, /weekly-hr-stage1-day-classification/);
assert.doesNotMatch(html, /weekly-hr-stage1-leave-category/);
assert.match(html, /weekly-hr-stage1-open-editor/);
assert.match(html, /weekly-hr-stage1-select[^>]*checked/);
assert.equal((html.match(/weekly-hr-stage1-day-select/g) || []).length, 6);

const drawer = sandbox.helpers.renderWeeklyHrStage1DayEditorPanel('d07');
assert.match(drawer, /Χαρακτηρισμός ημέρας/);
assert.match(drawer, /0001 · ΟΙΚΟΝΟΜΟΥ ΑΙΚ\./);
assert.match(drawer, /03\/08\/2026–09\/08\/2026/);
assert.match(drawer, /07\/08\/2026/);
assert.match(drawer, /value="LEAVE" selected/);
assert.match(drawer, /value="ΑΔΚΑΝ" selected/);
assert.match(drawer, /Προηγούμενη εκκρεμότητα/);
assert.match(drawer, /Επόμενη εκκρεμότητα/);
assert.match(drawer, /data-bs-dismiss="offcanvas"/);
assert.equal(drafts.get('d07').classification, 'LEAVE',
    'Το άνοιγμα ή κλείσιμο του πλαισίου δεν διαγράφει το πρόχειρο');
const sicknessDrawer = sandbox.helpers.renderWeeklyHrStage1DayEditorPanel('d05');
assert.match(sicknessDrawer, /value="SICKNESS" selected/);
assert.match(sicknessDrawer, /value="ΑΔΑΣ" selected/);
assert.match(sicknessDrawer, /disabled aria-disabled="true"/);
assert.deepEqual(Array.from(sandbox.helpers.weeklyHrStage1PendingRowIds()),
    ['d04', 'd05', 'd06', 'd07', 'd08', 'd09']);
const panel = { innerHTML: '' };
sandbox.document = { getElementById: () => panel };
sandbox.helpers.navigateWeeklyHrStage1DayEditor('next');
assert.match(panel.innerHTML, /06\/08\/2026/);

drafts.delete('d09');
rows[6].adeia_apologistika = true;
rows[6].kathgoria_adeias_apologistika = 'ΑΔΚΑΝ';
const contextPayload = { ...payload,
    scope: { ...payload.scope, period_end: dates[5] },
    period_slice: { actionable_dates: dates.slice(0, 6), context_only_dates: [dates[6]] } };
const contextCell = sandbox.helpers.renderStage1MatrixDayCell(
    contextPayload, dates[6], dates.slice(1));
assert.match(contextCell, /Αύγουστος/);
assert.match(contextCell, /επόμενη περίοδο/);
assert.match(contextCell, /<strong>ΑΔΕΙΑ<\/strong>/);
assert.doesNotMatch(contextCell, /weekly-hr-stage1-day-classification/);
assert.doesNotMatch(contextCell, /Πληροφοριακά|Πλαίσιο/);
assert.equal((contextCell.match(/data-bs-toggle="tooltip"/g) || []).length, 1);
assert.equal((contextCell.match(/data-stage1-tooltip=/g) || []).length, 1);
assert.doesNotMatch(contextCell, /data-bs-title=|\stitle=/);
const previousContext = sandbox.helpers.stage1ContextPeriodPresentation(payload, '2026-07-31');
assert.equal(previousContext.label, 'Ιούλιος');
assert.match(previousContext.title, /προηγούμενη περίοδο/);
const currentContext = sandbox.helpers.stage1ContextPeriodPresentation(payload, '2026-08-03');
assert.equal(currentContext.direction, 'current');
assert.equal(currentContext.title, '');

const draftSetterSource = source.match(/function setStage1DayDraft\([\s\S]*?\n}/)?.[0] || '';
const setterSandbox = {
    weeklyHrStage1RowsById: new Map(rows.map((row) => [row._id, row])),
    weeklyHrStage1Payloads: new Map([['week', contextPayload]]),
    weeklyHrStage1DayDrafts: new Map(),
    stage1DateKey: sandbox.stage1DateKey,
    stage1RelevantDates: (item) => item.workflow.possible_leave_days,
    stage1ClassificationForRow: (row) => row.adeia_apologistika === true ? 'LEAVE'
        : row.astheneia_apologistika === true ? 'SICKNESS'
            : row.apousia_apologistika === true ? 'ABSENCE' : 'UNCLASSIFIED'
};
vm.runInNewContext(`${draftSetterSource}\nthis.setDraft = setStage1DayDraft;`, setterSandbox);
setterSandbox.setDraft('d09', 'ABSENCE');
assert.equal(setterSandbox.weeklyHrStage1DayDrafts.size, 0,
    'Η ημερομηνία μόνο πλαισίου πρέπει να παραμένει μη εγγράψιμη');
setterSandbox.setDraft('d08', 'LEAVE', 'ΑΔΚΑΝ');
assert.deepEqual(JSON.parse(JSON.stringify(setterSandbox.weeklyHrStage1DayDrafts.get('d08'))), {
    classification: 'LEAVE', kathgoria_adeias_apologistika: 'ΑΔΚΑΝ'
});
setterSandbox.setDraft('d08', 'UNCLASSIFIED');
assert.equal(setterSandbox.weeklyHrStage1DayDrafts.has('d08'), false,
    'Ο καθαρισμός στην αρχική κατάσταση πρέπει να αφαιρεί πλήρως το πρόχειρο');

assert.match(source, /filtered\.slice\(start, start \+ WEEKLY_HR_STAGE1_PAGE_SIZE\)/);
assert.match(source, /weeklyHrStage1DayDrafts\.get\(rowId\)/);
assert.match(source, /weeklyHrStage1Selected\.has\(key\)/);
assert.match(css, /\.weekly-hr-stage1-table\s*\{[\s\S]*?table-layout:\s*fixed/);
assert.match(css, /\.weekly-hr-stage1-table-shell\s*\{[\s\S]*?overflow-x:\s*hidden/);
assert.doesNotMatch(css.match(/\.weekly-hr-stage1-table\s*\{[^}]*\}/)?.[0] || '',
    /min-width/);
assert.doesNotMatch(css, /weekly-hr-stage1-table[^\n]*nth-child[\s\S]*?left:/);
assert.match(source, /bootstrap\.Tooltip\.getOrCreateInstance/);
assert.match(source, /bootstrap\.Tooltip\.getInstance\(element\)\?\.dispose\(\)/);
assert.match(source, /\.tooltip\.weekly-hr-stage1-tooltip/);
assert.match(css, /\.weekly-hr-stage1-tooltip\s*\{[\s\S]*?--bs-tooltip-bg:\s*#fff4bf/);
assert.match(css, /\.employment-review-attention-summary\s*\{[\s\S]*?display:\s*none !important/);
assert.match(drawer, /weekly-hr-stage1-editor-prev/);
assert.match(drawer, /weekly-hr-stage1-editor-next/);
assert.doesNotMatch(drawer, /btn-primary|btn-secondary|btn-outline-secondary/);
assert.match(css, /\.weekly-hr-stage1-editor-next:hover[\s\S]*?background:\s*var\(--bs-primary-bg-subtle/);
assert.match(css, /\.weekly-hr-stage1-editor-prev:hover[\s\S]*?background:\s*var\(--bs-secondary-bg-subtle/);
assert.match(source, /function initializeWeeklyHrStage1BulkDropdownPortal/);
assert.match(source, /document\.body\.appendChild\(menu\)/);
assert.match(source, /strategy: 'fixed'/);
assert.match(source, /hidden\.bs\.dropdown[\s\S]*?cleanupWeeklyHrStage1BulkDropdownPortal/);
assert.match(css, /\.weekly-hr-stage1-bulk-action-menu-portal\s*\{[\s\S]*?z-index:\s*1090/);

const pendingDates = ['2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13',
    '2026-08-14', '2026-08-15', '2026-08-16'];
const pendingRows = pendingDates.map((date, index) => ({ _id: `p${index + 10}`, hmeromhnia: date }));
pendingRows[3].adeia_apologistika = true;
pendingRows[3].kathgoria_adeias_apologistika = 'ΑΔΚΑΝ';
pendingRows[4].astheneia_apologistika = true;
pendingRows[5].apousia_apologistika = true;
const pendingPayload = {
    ...payload,
    rows: pendingRows,
    workflow: { ...payload.workflow, possible_leave_days: pendingDates },
    period_slice: { actionable_dates: pendingDates.slice(0, 6),
        context_only_dates: [pendingDates[6]] },
    stage1_daily_presentation: pendingDates.map((date) => ({
        date, current_apologistiko_classification: 'POSSIBLE_LEAVE'
    }))
};
drafts.set('p10', { classification: 'ABSENCE', kathgoria_adeias_apologistika: '' });
drafts.set('p11', { classification: 'LEAVE', kathgoria_adeias_apologistika: 'ΑΔΚΑΝ' });
assert.deepEqual(pendingDates.filter((date) =>
    sandbox.helpers.isWeeklyHrStage1DayPending(pendingPayload, date)), ['2026-08-12']);
sandbox.weeklyHrStage1DaySelected.add('old-arbitrary-selection');
sandbox.visibleWeeklyHrStage1Payloads = () => [pendingPayload];
sandbox.rerenderWeeklyHrStage1Rows = () => {};
sandbox.helpers.selectVisiblePendingWeeklyHrStage1Days();
assert.deepEqual(Array.from(sandbox.weeklyHrStage1DaySelected), ['p12'],
    'Η επιλογή εκκρεμών πρέπει να αντικαθιστά πλήρως την παλιά επιλογή');
const manualSelection = new Set();
manualSelection.add('p10');
assert.equal(manualSelection.has('p10'), true,
    'Η χειροκίνητη επανεπιλογή χαρακτηρισμένης ημέρας παραμένει επιτρεπτή');

const clickHandlerSource = source.slice(source.indexOf("document.addEventListener('click'"),
    source.indexOf("document.addEventListener('change'"));
assert.match(clickHandlerSource,
    /weekly-hr-select-all-days'[\s\S]*?selectVisiblePendingWeeklyHrStage1Days\(\)/);

const classifySource = source.match(
    /async function classifySelectedStage1Days\([\s\S]*?\n}/)?.[0] || '';
const bulkSelected = new Set();
const bulkDraftCalls = [];
const bulkSandbox = {
    weeklyHrStage1DaySelected: bulkSelected,
    setStage1DayDraft: (rowId, classification, category) =>
        bulkDraftCalls.push({ rowId, classification, category }),
    stage1LeaveCategoryOptions: () => '<option value="ΑΔΚΑΝ">ΑΔΚΑΝ</option>',
    employmentReviewSwal: async () => ({ isConfirmed: true, value: 'ΑΔΚΑΝ' }),
    document: { getElementById: () => ({ value: 'ΑΔΚΑΝ' }) },
    rerenderWeeklyHrStage1Rows: () => {}
};
vm.runInNewContext(`${classifySource}\nthis.classify = classifySelectedStage1Days;`, bulkSandbox);

(async () => {
    for (const classification of ['ABSENCE', 'SICKNESS', 'UNCLASSIFIED', 'LEAVE']) {
        bulkDraftCalls.length = 0;
        bulkSelected.add('d10');
        bulkSelected.add('d11');
        await bulkSandbox.classify(classification);
        assert.equal(bulkSelected.size, 0, `${classification}: η επιλογή πρέπει να καθαρίζεται`);
        assert.deepEqual(bulkDraftCalls.map((item) => item.classification),
            [classification, classification]);
        if (classification === 'LEAVE') {
            assert.deepEqual(bulkDraftCalls.map((item) => item.category),
                ['ΑΔΚΑΝ', 'ΑΔΚΑΝ']);
        }
    }
    console.log('Stage 1 weekly matrix UI contracts: PASS');
})().catch((error) => { console.error(error); process.exitCode = 1; });
