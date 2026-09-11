'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const sourcePath = path.join(__dirname, 'elegxosApasxolhseonPeriodoy.js');
const cssPath = path.join(__dirname, '../../../css/main.css');
const viewPath = path.join(__dirname,
    '../../../../views/ergazomenoi/programmata/elegxosApasxolhseonPeriodoy.ejs');
const source = fs.readFileSync(sourcePath, 'utf8');
const css = fs.readFileSync(cssPath, 'utf8');
const view = fs.readFileSync(viewPath, 'utf8');

function extractFunction(name) {
    const start = source.indexOf(`function ${name}(`);
    assert.notStrictEqual(start, -1, `Boundary UI helper is missing: ${name}`);
    const bodyStart = source.indexOf('{', start);
    let depth = 0;
    let quote = '';
    let escaped = false;
    for (let index = bodyStart; index < source.length; index += 1) {
        const character = source[index];
        if (quote) {
            if (escaped) escaped = false;
            else if (character === '\\') escaped = true;
            else if (character === quote) quote = '';
            continue;
        }
        if (character === '\'' || character === '"' || character === '`') {
            quote = character;
        } else if (character === '{') {
            depth += 1;
        } else if (character === '}' && --depth === 0) {
            return source.slice(start, index + 1);
        }
    }
    assert.fail(`Boundary UI helper is incomplete: ${name}`);
}

const helperNames = [
    'stage1DateKey',
    'formatStage1DateKey',
    'isFullCalendarMonthRange',
    'enumerateStage1DateKeys',
    'fullMonthBoundaryRanges',
    'compactStage1DateRange',
    'compactBoundaryCoverageDateRange',
    'boundaryCoverageStatusLabel'
];
const helpers = vm.runInNewContext(`(() => {
    ${helperNames.map(extractFunction).join('\n')}
    return { ${helperNames.join(', ')} };
})()`);

assert.strictEqual(helpers.isFullCalendarMonthRange('2026-01-01', '2026-01-31'), true);
assert.strictEqual(helpers.isFullCalendarMonthRange('2026-01-02', '2026-01-31'), false);
assert.strictEqual(helpers.isFullCalendarMonthRange('2026-01-01', '2026-01-30'), false);

assert.deepStrictEqual(
    JSON.parse(JSON.stringify(helpers.fullMonthBoundaryRanges('2026-01-01', '2026-01-31'))),
    {
        previous: ['2025-12-29', '2025-12-30', '2025-12-31'],
        next: ['2026-02-01']
    }
);
assert.strictEqual(helpers.fullMonthBoundaryRanges('2026-01-02', '2026-01-31'), null);
assert.strictEqual(
    helpers.compactStage1DateRange(['2025-12-29', '2025-12-31']),
    '29/12/2025–31/12/2025'
);
assert.strictEqual(
    helpers.compactBoundaryCoverageDateRange(['2025-12-29', '2025-12-31']),
    '29–31/12/2025'
);
assert.strictEqual(helpers.boundaryCoverageStatusLabel('CARD_DATA_FOUND'),
    'Εντοπίστηκαν δεδομένα Ψηφιακών Καρτών');
assert.strictEqual(helpers.boundaryCoverageStatusLabel('NO_CARD_DATA_FOUND'),
    'Δεν εντοπίστηκαν δεδομένα Ψηφιακών Καρτών');
assert.strictEqual(helpers.boundaryCoverageStatusLabel('NOT_REQUIRED'), 'Δεν απαιτείται');

assert.match(source, /let currentEmploymentReviewBoundaryContextPreflight = null;/);
assert.match(source, /async function loadResults\(\)[\s\S]*?currentEmploymentReviewBoundaryContextPreflight = null;/);
assert.match(source,
    /currentEmploymentReviewBoundaryContextPreflight = payload\.finalized === true[\s\S]*?payload\.boundaryContextPreflight \|\| null;/);

const boundarySectionStart = source.indexOf('function showEmploymentReviewBoundaryContextDialog()');
const boundarySectionEnd = source.indexOf('function naturalWeekScopeForRow(', boundarySectionStart);
assert.ok(boundarySectionStart >= 0 && boundarySectionEnd > boundarySectionStart,
    'Boundary dialog and summary section must be present');
const boundarySection = source.slice(boundarySectionStart, boundarySectionEnd);
assert.match(boundarySection, /function showEmploymentReviewBoundaryContextDialog\(\)/);
assert.match(boundarySection, /width: '56rem'/);
assert.match(boundarySection, /function renderEmploymentReviewBoundaryContextSummary\([^)]*\)/);
assert.match(boundarySection, /currentEmploymentReviewBoundaryContextPreflight\?\.\[sideKey\]/);
assert.match(boundarySection,
    /document\.getElementById\('employmentReviewBoundaryContextButton'\)/);
assert.match(boundarySection,
    /button\.onclick = \(\) => \{ showEmploymentReviewBoundaryContextDialog\(\); \};/);
assert.doesNotMatch(boundarySection, /\bfetch\s*\(/);
assert.doesNotMatch(boundarySection, /CardPairResolver|resolveCardPair|preHire|postDeparture/);

assert.match(source,
    /updateEmploymentReviewWorkflowPresentation[\s\S]*?renderEmploymentReviewBoundaryContextSummary\(\);/);
assert.match(source,
    /didClose: \(\) => requestAnimationFrame\(\(\) => refreshEmploymentReviewStickyLayout\(\)\)/);
assert.match(source,
    /function refreshEmploymentReviewStickyLayout\(\)[\s\S]*?const preservedScrollTop = scrollContainer\.scrollTop;[\s\S]*?updateWeeklyDeviationStickyMetrics\(\);[\s\S]*?scrollContainer\.scrollTop = preservedScrollTop;/);

assert.match(view, /<button type="button" id="employmentReviewBoundaryContextButton"/);
assert.match(view, /Πληροφορίες οριακών εβδομάδων/);
assert.doesNotMatch(view, /<button[^>]*id="employmentReviewBoundaryContextButton"[^>]*type="submit"/);

assert.match(css, /\.employment-review-boundary-context-button\s*\{/);
assert.match(css, /\.employment-review-boundary-sides\s*\{[\s\S]*?display: grid;/);
assert.match(css, /\.employment-review-boundary-dialog details summary\s*\{/);
assert.match(css, /\.employment-review-boundary-dialog\s*\{[\s\S]*?overflow: visible;/);
assert.match(css, /\.employment-review-boundary-table th,[\s\S]*?white-space: nowrap;/);
assert.match(css, /\.employment-review-boundary-table \.employment-review-boundary-week[\s\S]*?white-space: nowrap;/);
assert.match(css,
    /\.swal2-popup\.employment-review-boundary-popup\s*\{[\s\S]*?max-height: calc\(100vh - 2rem\);[\s\S]*?overflow: hidden;/);

const buttonClasses = new Set(['d-none']);
const button = { classList: { add(value) { buttonClasses.add(value); },
    remove(value) { buttonClasses.delete(value); } }, onclick: null };
let selectedEmployee = '';
let openedDialog = null;
let swalOpenCount = 0;
const uiSandbox = {
    // Match the actual /period-control/current HTTP response, which has no scope field.
    currentEmploymentPeriodControl: { success: true, final_submission_summary: {
        branch: '0000', period_start: '2026-04-01', period_end: '2026-04-30' } },
    currentEmploymentReviewLifecyclePresentation: { deferred_weeks: [] },
    currentReviewRows: [], currentReviewLifecycleProjectionReady: true,
    weeklyHrStage1Payloads: new Map(),
    document: { getElementById: id => id === 'kodikos' ? { value: selectedEmployee } : button },
    escapeHtml: String, employmentReviewSwal: options => { swalOpenCount++; openedDialog = options; }
};
const dateScopeSource = source.slice(source.indexOf('function stage1DateKey('),
    source.indexOf('function weeklyHrStage1Key('));
const groupSource = source.slice(source.indexOf('function groupDeferredWeeksForDisplay('),
    source.indexOf('function stage2LifecycleClassificationLabel('));
const filterSource = source.slice(source.indexOf('function filterPeriodOwnedReviewRows('),
    source.indexOf('function renderCurrentReviewRows('));
const generalFilter = source.slice(source.indexOf('function filterGeneralReviewRows('),
    source.indexOf('function renderReviewNoPendingEmployees('));
vm.runInNewContext(`${dateScopeSource}\n${groupSource}\n${filterSource}\n${generalFilter}
    this.presentation = { getVisibleReviewRows, renderEmploymentReviewBoundaryContextSummary,
        beginBoundaryInfoSearchResult, autoOpenBoundaryInfoForSearchResult, renderDeferredWeekGroups };`, uiSandbox);
for (const [weekStart, expected] of [
    ['2026-04-27', ['2026-04-27', '2026-04-28', '2026-04-29', '2026-04-30']],
    ['2026-03-30', ['2026-04-01', '2026-04-02', '2026-04-03', '2026-04-04', '2026-04-05']],
    ['2026-04-06', ['2026-04-06', '2026-04-07', '2026-04-08', '2026-04-09', '2026-04-10', '2026-04-11', '2026-04-12']]
]) {
    const contextRows = Array.from({ length: 7 }, (_, index) => {
        const date = new Date(`${weekStart}T00:00:00Z`);
        date.setUTCDate(date.getUTCDate() + index);
        return { hmeromhnia: date.toISOString().slice(0, 10), kodikos: '0001' };
    });
    uiSandbox.currentReviewRows = contextRows;
    const before = JSON.stringify(contextRows);
    for (const employee of ['', '0001']) {
        selectedEmployee = employee;
        assert.deepStrictEqual(Array.from(uiSandbox.presentation.getVisibleReviewRows(), row => row.hmeromhnia), expected);
    }
    assert.strictEqual(contextRows.length, 7);
    assert.strictEqual(JSON.stringify(contextRows), before);
}
// Full April: three employees remain visible despite zero HR pending issues.
uiSandbox.currentEmploymentReviewLifecyclePresentation.total_pending_count = 0;
uiSandbox.currentEmploymentReviewLifecyclePresentation.requires_hr_action = false;
uiSandbox.currentReviewRows = ['0001', '0002', '0003'].flatMap(kodikos =>
    Array.from({ length: 30 }, (_, index) => ({ kodikos,
        hmeromhnia: `2026-04-${String(index + 1).padStart(2, '0')}` })));
selectedEmployee = '';
const fullAprilRows = uiSandbox.presentation.getVisibleReviewRows();
assert.strictEqual(fullAprilRows.length, 90);
assert.strictEqual(new Set(fullAprilRows.map(row => row.kodikos)).size, 3);
assert.strictEqual(uiSandbox.currentEmploymentReviewLifecyclePresentation.total_pending_count, 0);
assert.strictEqual(uiSandbox.currentEmploymentReviewLifecyclePresentation.requires_hr_action, false);

const deferredEntry = { team: 'T', company_kod: '0004', ypokatasthma: '0000',
    employee_id: 'E', employee_kodikos: '0001', deferred_week_id: 'unchanged-E',
    week_start: '2026-04-27', week_end: '2026-05-03',
    period_start: '2026-04-01', period_end: '2026-04-30',
    next_period_context_dates: ['2026-05-01', '2026-05-02', '2026-05-03'],
    previous_period_context_dates: [], possible_leave_dates: ['2026-04-30'],
    display_message: 'ΑΝΑΜΟΝΗ ΠΛΗΡΟΥΣ ΕΒΔΟΜΑΔΙΑΙΟΥ ΕΛΕΓΧΟΥ' };
uiSandbox.currentEmploymentReviewLifecyclePresentation.deferred_weeks = [deferredEntry];
uiSandbox.weeklyHrStage1Payloads.set('previous', { scope: {
    week_start: '2026-03-30', week_end: '2026-04-05', employee_id: 'E', employee_kodikos: '0001'
}, employment_date_scope: { context_only_dates: ['2026-03-30', '2026-03-31'] } });
uiSandbox.presentation.beginBoundaryInfoSearchResult();
uiSandbox.presentation.renderEmploymentReviewBoundaryContextSummary('2026-04-27', '2026-05-03');
assert.strictEqual(buttonClasses.has('d-none'), false);
uiSandbox.presentation.autoOpenBoundaryInfoForSearchResult();
assert.strictEqual(swalOpenCount, 1);
for (let render = 0; render < 3; render++) {
    uiSandbox.presentation.renderEmploymentReviewBoundaryContextSummary();
    uiSandbox.presentation.autoOpenBoundaryInfoForSearchResult();
}
assert.strictEqual(swalOpenCount, 1);
button.onclick();
assert.strictEqual(swalOpenCount, 2);
assert.strictEqual(openedDialog.title, 'Πληροφορίες οριακών εβδομάδων');
assert.match(openedDialog.html, /Προς επόμενο μήνα/);
assert.match(openedDialog.html, /27\/04\/2026–03\/05\/2026/);
assert.match(openedDialog.html, /Ο έλεγχος γίνεται στον επόμενο μήνα/);
assert.match(openedDialog.html, /Οι ημέρες άλλου μήνα εμφανίζονται μόνο για τον εβδομαδιαίο έλεγχο/);
assert.doesNotMatch(openedDialog.html, /Με δεδομένα καρτών|χωρίς δεδομένα καρτών|Πιθανές άδειες σε αναμονή/);
assert.match(openedDialog.html, /<th class="text-center">Κωδικός<\/th>/);
assert.doesNotMatch(openedDialog.html, /<th>Εργαζόμενος<\/th>|<th[^>]*>Ενέργεια<\/th>/);
const actionTable = uiSandbox.presentation.renderDeferredWeekGroups([{
    handoff_from_previous_period: true, week_start: '2025-12-29', week_end: '2026-01-04',
    employee_entries: [{ deferred_week_id: 'week-1', employee_kodikos: '0031',
        resolution_status: 'REQUIRED', source_candidates: [{ prodhlomena_oraria_id: 's' }],
        target_candidates: [{ prodhlomena_oraria_id: 't' }] }]
}]);
assert.match(actionTable, /<th class="text-center">Ενέργεια<\/th>/);
assert.match(actionTable, /data-deferred-repo-resolve="week-1"/);
uiSandbox.presentation.beginBoundaryInfoSearchResult();
uiSandbox.presentation.renderEmploymentReviewBoundaryContextSummary();
uiSandbox.presentation.autoOpenBoundaryInfoForSearchResult();
assert.strictEqual(swalOpenCount, 3, 'A new successful search opens once even with identical filters');
uiSandbox.currentEmploymentReviewLifecyclePresentation.deferred_weeks = [];
uiSandbox.weeklyHrStage1Payloads.clear();
uiSandbox.presentation.beginBoundaryInfoSearchResult();
uiSandbox.presentation.renderEmploymentReviewBoundaryContextSummary();
uiSandbox.presentation.autoOpenBoundaryInfoForSearchResult();
assert.strictEqual(swalOpenCount, 3, 'No boundary information must not open a dialog');
assert.strictEqual(buttonClasses.has('d-none'), true);
assert.strictEqual(button.onclick, null);
assert.strictEqual(deferredEntry.deferred_week_id, 'unchanged-E');
assert.doesNotMatch(view, /id="employmentReviewDeferredWeeks"/);
assert.doesNotMatch(source, /deferredContainer\.innerHTML/);

console.log('Boundary UI regression tests: PASS');
