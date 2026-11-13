'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ejs = require('ejs');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const ExcelJS = require('exceljs');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../..');

// Use production functions along the requested Search -> stored payload -> lazy
// Stage 1 -> weekly button -> popover path. Only unrelated panels/I/O are inert.
function storedReviewBrowserSource() {
    const source = fs.readFileSync(path.join(root,
        'public/js/ergazomenoi/programmata/elegxosApasxolhseonPeriodoy.js'), 'utf8');
    const fn = name => {
        const value = source.match(new RegExp('(?:async )?function ' + name + '\\([\\s\\S]*?\\n}'))?.[0];
        assert.ok(value, name); return value;
    };
    const between = (a, b) => {
        const from = source.indexOf(a), to = source.indexOf(b, from + a.length);
        assert.ok(from >= 0 && to > from, a); return source.slice(from, to);
    };
    const globals = `
        const csrfToken = 'synthetic', WEEKLY_HR_STAGE1_PAGE_SIZE = 100;
        let currentCanonicalLifecyclePayloads = [], currentReviewDeviations = [], currentReviewReadWarnings = [],
            currentEmploymentReviewLifecyclePresentation = {}, currentApprovalHistoryFilters = {},
            currentEmploymentPeriodControl = { scope: { period_start: '2026-09-01', period_end: '2026-09-30' } },
            weeklyHrLeaveCategories = [], weeklyHrStage1LazyLoad = null, weeklyHrStage1Page = 1,
            currentReviewLoadGeneration = 0, currentReviewLifecycleProjectionReady = false,
            currentWeeklyHrStage2BulkPreview = null;
        const weeklyHrStage1Scopes = new Map(), weeklyHrStage1RowsById = new Map(),
            weeklyHrStage1Payloads = new Map(), weeklyHrStage1Selected = new Set(),
            weeklyHrStage1DaySelected = new Set(), weeklyHrStage1DayDrafts = new Map();
        const stage1DisplayFilters = { status: 'ALL', employeeQuery: '', leave: false, sickness: false, absence: false };
        const noop = () => {};
        for (const name of ${JSON.stringify(['resetWeeklyHrStage3BulkState', 'renderEmploymentPeriodControl',
            'renderPolicyPreviewGroups', 'ensureReviewTableStructure', 'beginBoundaryInfoSearchResult',
            'renderCurrentReviewRows', 'renderPreCalculationDataIssues',
            'renderWeeklyHrStage2LifecycleFallback', 'resetWeeklyHrStage1TooltipInteraction',
            'pruneHiddenWeeklyHrStage1Selections', 'cleanupWeeklyHrStage1BulkDropdownPortal',
            'initializeWeeklyHrStage1BulkDropdownPortal', 'updateWeeklyDeviationStickyMetrics',
            'hideWeeklyHrStage1Tooltip', 'requestEmploymentReviewCurrentStageAutoOpen', 'cancelEmploymentReviewCurrentStageAutoOpen'])}) window[name] = noop;
        const loadEmploymentPeriodControl = async () => currentEmploymentPeriodControl;
        const hasAuthoritativeEmploymentCalculation = () => false;
        const autoOpenBoundaryInfoForSearchResult = async () => {};
        // Keep the production state derivation active; unrelated stage panels
        // are absent from this focused guidance harness.
        function updateEmploymentReviewWorkflowPresentation() {
            currentEmploymentReviewLifecyclePresentation = derivePeriodLifecyclePresentation(
                currentCanonicalLifecyclePayloads, currentEmploymentPeriodControl,
                currentWeeklyHrStage2BulkPreview);
            return currentEmploymentReviewLifecyclePresentation;
        }
        const renderWeeklyHrStage1BulkToolbar = () => '';
        const weeklyHrOrphanRows = () => [], weeklyHrZeroLengthRows = () => [], weeklyHrSuspiciousShortRows = () => [];
        window.AppLoader = { begin: noop, end: noop };
    `;
    const funcs = ['escapeHtml', 'stage1DateKey', 'formatStage1DateKey', 'currentReviewOwnershipPeriod',
        'naturalWeekScopeForRow', 'weeklyHrStage1Key', 'canonicalLifecyclePayloadKey',
        'compareLifecyclePendingItems', 'derivePeriodLifecyclePresentation',
        'isWeeklyHrStage1RelevantRow', 'buildWeeklyHrStage1Scopes', 'loadWeeklyHrLeaveCategories',
        'isHrSelectableLeaveCategoryOption', 'isWeeklyHrStage1Selectable', 'weeklyHrStage1BusinessStatus',
        'weeklyHrHasOnlyOrphanBlockers', 'weeklyHrStage1IndexWarning', 'employmentReviewGuidanceAttributes',
        'employmentReviewGuidanceInfo', 'employmentReviewGuidanceButton', 'employmentReviewInlineGuidance',
        'renderWeeklyHrStage1Presentation', 'renderWeeklyHrStage1', 'prepareWeeklyHrStage1LazyLoad',
        'loadPreparedWeeklyHrStage1', 'fetchWeeklyHrStage1Bulk', 'renderWeeklyHrStage1Error', 'calculateWeeklyHrStage1TooltipPosition', 'renderEmploymentReviewReadWarnings', 'loadResults'].map(fn).join('\n');
    const search = source.indexOf("document.getElementById('searchBtn')?.addEventListener('click'");
    const lazyClick = source.indexOf("document.addEventListener('click', (event) => {\n    const attentionAction");
    return globals + '\n' +
        between('const employmentPeriodModeLabels', 'const employmentSubmissionTimelinessLabels') + '\n' +
        between('const employmentReviewSwalCommonClasses', 'function userCanReviewEdit') + '\n' +
        between('function stage1ClassificationForRow', 'async function loadWeeklyHrLeaveCategories') + '\n' +
        between('function stage1NaturalWeekDates', 'function renderWeeklyHrStage1Error') + '\n' +
        between('let employmentReviewGuidancePopover =', 'let employmentReviewGuidanceTargets =') + '\n' + funcs + '\n' +
        source.slice(search, source.indexOf('\n});', search) + 4) + '\n' +
        source.slice(lazyClick, source.indexOf("    if (event.target.closest('.weekly-hr-stage1-page-prev'))", lazyClick)) + '\n});\n' +
        'initializeEmploymentReviewGuidancePopover();';
}

test('Chromium: nonblocking Search keeps weekly history guidance, separate daily issues and unmatched warnings', async t => {
    const { mock } = require('node:test');
    require('../fixtures/forbidRealSettlementMongo').forbidRealSettlementMongo(mock);
    t.after(() => mock.restoreAll());
    const response = await require('../helpers/employmentReviewStoredHistoryGuidanceHarness').storedHistorySearchResponse();
    const before = JSON.stringify(response), browser = await chromium.launch({ headless: true });
    t.after(() => browser.close());
    for (const variant of ['documented-overlap', 'mixed-daily', 'unmatched-warning', 'date-only', 'empty-diagnostics', 'unrelated-pending-dates', 'independent-warning', 'partial-stage1-lifecycle']) {
        const payload = structuredClone(response);
        if (variant === 'mixed-daily') {
            for (const entry of [...payload.stage1Payloads, ...payload.canonicalLifecycleProjections]) {
                const stage = entry.lifecycle_projection.stages.stage1;
                stage.business_status = 'BLOCKED';
                stage.blockers.push('ZERO_LENGTH_CARD_INTERVAL_REQUIRES_HR_DECISION');
                stage.diagnostics.push({ code: 'ZERO_LENGTH_CARD_INTERVAL_REQUIRES_HR_DECISION',
                    dates: ['2026-09-09'], evidence: { card_intervals: [{ start: '09:00', end: '09:00' }] } });
            }
        } else if (variant === 'partial-stage1-lifecycle') {
            const stages = payload.stage1Payloads[0].lifecycle_projection.stages;
            stages.stage2 = { ...stages.stage2, business_status: 'BLOCKED', pending_count: 1,
                blockers: ['OPEN_WEEK_PENDING_COMPLETION'],
                pending_reasons: ['OPEN_WEEK_PENDING_COMPLETION'] };
        } else if (variant === 'unmatched-warning') {
            payload.read_warnings.push({ code: 'EMPLOYEE_HISTORY_COVERAGE_REQUIRED', employee_kodikos: '9999',
                message: 'Συνθετική μη αντιστοιχισμένη προειδοποίηση. 1. Ελέγξτε το Ιστορικό. 2. Επαναλάβετε την Αναζήτηση. Δεν αποθηκεύτηκε αλλαγή. Αναφορά: ΙΣΤ-ΚΑΛΥΨΗ-01.' });
        } else if (variant === 'independent-warning') {
            payload.historical_reconstruction_required = true;
        } else if (variant === 'date-only') {
            for (const entry of [...payload.stage1Payloads, ...payload.canonicalLifecycleProjections])
                entry.lifecycle_projection.stages.stage1.diagnostics.forEach(item => { item.evidence = {}; });
        } else if (variant !== 'documented-overlap') {
            // Historical response shape only: remove presentation evidence,
            // retaining the real synthetic block, saved values and write guard.
            payload.read_warnings.forEach(warning => { delete warning.diagnostics; });
            for (const entry of [...payload.stage1Payloads, ...payload.canonicalLifecycleProjections]) {
                Object.values(entry.lifecycle_projection.stages).forEach(stage => { stage.diagnostics = []; });
                if (entry.workflow) entry.workflow.blocking_details = [];
                if (variant === 'unrelated-pending-dates') entry.lifecycle_projection.stages.stage1.pending_dates = ['2026-09-08'];
            }
        }
        const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
        page.setDefaultTimeout(5000);
        const errors = [], requests = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('**/*', route => {
            const req = route.request(), url = new URL(req.url());
            assert.equal(url.origin, 'http://synthetic.invalid');
            assert.ok(req.method() === 'GET' || url.pathname.endsWith('/stage1/bulk-review'), 'Only reads are allowed');
            requests.push(url.pathname);
            if (url.pathname.endsWith('/stage1/bulk-review')) return route.fulfill({ json: { success: true, payloads: payload.stage1Payloads } });
            if (url.pathname === '/api/prodhlomena-oraria/review')
                return route.fulfill({ json: payload });
            if (url.pathname === '/api/dropdown/ergazomenoi/kathgoria_adeias') return route.fulfill({ json: [] });
            assert.equal(url.pathname, '/');
            return route.fulfill({ contentType: 'text/html', body: '<!doctype html><body></body>' });
        });
        await page.goto('http://synthetic.invalid/');
        await page.setContent(`<!doctype html><style>body{margin:0}main{margin-left:var(--sidebar,0px);padding:12px;min-width:0}</style>
            <main><div class="p-2 mb-3"><input id="ypokatasthma_stathera_advanced" value="0000">
            <input id="apo_hmeromhnia" value="2026-09-01"><input id="eos_hmeromhnia" value="2026-09-30">
            <input id="kodikos" value="0015"><span class="employment-review-search-actions"><button id="searchBtn">Αναζήτηση</button></span></div>
            <div class="review-card-body"><div class="employment-review-scroll-container"><div class="accordion" id="employmentReviewStagesAccordion"><div class="accordion-item" data-workflow-stage="STAGE1"><h2 class="accordion-header"><button class="accordion-button collapsed"
                data-bs-toggle="collapse" data-bs-target="#employmentReviewStage1Collapse">Στάδιο 1</button></h2>
            <div id="employmentReviewStage1Collapse" class="accordion-collapse collapse"><div class="accordion-body"><div id="weeklyHrStage1Container"></div></div></div></div></div></div></div></main>`);
        for (const name of ['bootstrap.min.css', 'main.css'])
            await page.addStyleTag({ path: path.join(root, 'public/css', name) });
        await page.addScriptTag({ path: path.join(root, 'public/js/bootstrap.bundle.min.js') });
        await page.addScriptTag({ path: require.resolve('sweetalert2/dist/sweetalert2.all.js') });
        for (const name of ['employmentReviewGuidance', 'employmentReviewGuidanceUi'])
            await page.addScriptTag({ path: path.join(root, 'public/js/ergazomenoi/programmata', name + '.js') });
        await page.addScriptTag({ content: storedReviewBrowserSource() });
        await page.click('#searchBtn');
        await page.locator('.weekly-hr-stage1-lazy-placeholder').waitFor({ state: 'attached' });
        if (variant === 'independent-warning') {
            assert.match(await page.locator('.swal2-popup').innerText(), /Απαιτείται ανακατασκευή εκπρόθεσμης περιόδου/);
            await page.getByRole('button', { name: 'Κλείσιμο', exact: true }).click();
            await page.locator('.swal2-popup').waitFor({ state: 'hidden' });
        }
        assert.equal(await page.locator('.swal2-popup:visible').count(), 0, 'Read warnings must not open a popup');
        await page.waitForFunction(() => currentEmploymentReviewLifecyclePresentation.stages?.STAGE1);
        const searchState = await page.evaluate(() => ({
            canonical: currentCanonicalLifecyclePayloads,
            lifecycle: currentEmploymentReviewLifecyclePresentation,
            ready: currentReviewLifecycleProjectionReady
        }));
        assert.equal(searchState.ready, true);
        assert.deepEqual(searchState.canonical, payload.canonicalLifecycleProjections);
        await page.getByRole('button', { name: 'Στάδιο 1', exact: true }).click();
        const status = page.locator('.weekly-hr-stage1-status');
        await status.waitFor();
        assert.deepEqual(await page.evaluate(() => ({
            canonical: currentCanonicalLifecyclePayloads,
            lifecycle: currentEmploymentReviewLifecyclePresentation,
            ready: currentReviewLifecycleProjectionReady
        })), searchState, variant + ': opening Stage 1 preserves Search states and counters');
        assert.match(await status.innerText(), variant === 'mixed-daily' ? /Μπλοκαρισμένο|Απαιτείται επίλυση/ : /Ανοιχτό/);
        const button = status.getByRole('button', { name: 'Οδηγίες', exact: true });
        assert.equal(await button.count(), 1, variant + ': exactly one weekly explanation');
        assert.equal(await page.locator('.weekly-hr-stage1-select').isDisabled(), variant === 'mixed-daily');
        const dailyButtons = page.locator('.weekly-hr-stage1-matrix-day-cell [data-review-guidance-open]');
        assert.equal(await dailyButtons.count(), variant === 'mixed-daily' ? 1 : 0,
            'Shared history coverage must not be repeated on seven days');
        await button.click();
        assert.deepEqual(errors, [], 'The production guidance dependencies must be loaded');
        const popover = page.locator('#employmentReviewGuidancePopover');
        await popover.waitFor({ state: 'visible' });
        const text = await popover.innerText();
        assert.match(text, /εβδομαδιαία επιβεβαίωση/);
        assert.match(text, /Δεν απαιτείται νέα απόδειξη άδειας ή ασθένειας/);
        assert.match(text, /δεν απαιτείται επαναχαρακτηρισμός/);
        assert.match(text, /Ιστορική προειδοποίηση/);
        assert.match(text, /δεν αποθήκευσε αλλαγές/);
        assert.equal(await popover.locator('ol li').count(), 2);
        assert.doesNotMatch(text, /Τεχνικό πρόβλημα|EMPLOYEE_HISTORY_COVERAGE_REQUIRED/);
        assert.doesNotMatch(text, /μηδενικό διάστημα κάρτας/);
        await page.keyboard.press('Escape');
        assert.equal(await button.evaluate(node => node === document.activeElement), true);
        if (variant === 'mixed-daily') {
            await dailyButtons.click();
            const dailyText = await popover.innerText();
            assert.match(dailyText, /μηδενικό διάστημα κάρτας/);
            assert.match(dailyText, /Γιατί σταματά η ενέργεια/);
            assert.match(dailyText, /09:00–09:00/);
            assert.match(dailyText, /09\/09\/2026/);
            assert.doesNotMatch(dailyText, /ιστορικοί όροι|ΙΣΤ-ΚΑΛΥΨΗ|Περισσότερες από μία ιστορικές|07\/09\/2026, 08\/09\/2026/);
            await page.keyboard.press('Escape');
        }
        const warnings = page.locator('#employmentReviewReadWarnings');
        assert.equal(await warnings.count(), 1, 'All warnings remain explicitly available, including mapped warnings');
        assert.equal(await warnings.locator('summary:visible, .alert-warning').count(), 0);
        await warnings.locator('[data-review-guidance-open]').click();
        await popover.waitFor({ state: 'visible' });
        for (const summary of await popover.locator('summary').all()) await summary.click();
        const displayedWarnings = (await popover.locator('pre').allTextContents()).map(value => JSON.parse(value));
        assert.deepEqual(displayedWarnings, payload.read_warnings, 'Every diagnostic is preserved behind explicit instructions');
        if (variant === 'unmatched-warning') {
            assert.match(await popover.innerText(), /9999/);
            assert.match(await popover.innerText(), /Συνθετική μη αντιστοιχισμένη προειδοποίηση/);
        }
        assert.equal(await page.locator('.swal2-popup:visible').count(), 0);
        await page.keyboard.press('Escape');
        for (const [width, height] of [[1920,1080],[1680,1050],[1600,900],[1440,900],[1280,1024],[1280,800],[1280,720],[640,480]]) {
            await page.setViewportSize({ width, height });
            for (const sidebar of [0, 260]) {
                await page.evaluate(value => document.body.style.setProperty('--sidebar', value + 'px'), sidebar);
                await button.scrollIntoViewIfNeeded();
                await button.click();
                const geometry = await popover.evaluate(node => {
                    const r = node.getBoundingClientRect(), close = node.querySelector('[data-review-guidance-close]').getBoundingClientRect();
                    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, closeBottom: close.bottom,
                        overflow: node.querySelector('.review-guidance-detail').scrollWidth > node.querySelector('.review-guidance-detail').clientWidth + 1 };
                });
                assert.ok(geometry.left >= 9 && geometry.right <= width - 9 && geometry.top >= 9 && geometry.bottom <= height - 9,
                    JSON.stringify({ width, height, sidebar, geometry }));
                assert.equal(geometry.overflow, false);
                assert.ok(geometry.closeBottom <= height - 9);
                assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
                    JSON.stringify({ width, height, sidebar, variant }));
                await page.keyboard.press('Escape');
            }
        }
        assert.equal(requests.filter(url => url === '/api/prodhlomena-oraria/review').length, 1);
        assert.equal(requests.filter(url => url.includes('bulk-review')).length, 1, 'Normal Stage 1 bulk read is used');
        assert.deepEqual(await page.evaluate(() => currentReviewReadWarnings), payload.read_warnings, 'Backend warning contract is preserved');
        const hydratedDetails = payload.stage1Payloads.map(detail => ({ ...detail,
            lifecycle_projection: payload.canonicalLifecycleProjections.find(entry =>
                entry.scope.employee_id === detail.scope.employee_id &&
                entry.scope.week_start === detail.scope.week_start).lifecycle_projection }));
        assert.deepEqual(await page.evaluate(() => [...weeklyHrStage1Payloads.values()]), hydratedDetails,
            'Search supplies lifecycle; detail rows, write_enabled, diagnostics and saved values stay intact');
        if (variant === 'partial-stage1-lifecycle') assert.notDeepEqual(
            hydratedDetails[0].lifecycle_projection, payload.stage1Payloads[0].lifecycle_projection,
            'The conflicting detail projection must not replace Search authority');
        if (variant === 'documented-overlap') {
            await page.evaluate(() => { stage1DisplayFilters.employeeQuery = 'no-matching-employee'; renderWeeklyHrStage1Presentation(); });
            await page.locator('#employmentReviewReadWarnings [data-review-guidance-open]').click();
            for (const summary of await popover.locator('summary').all()) await summary.click();
            assert.match(await popover.innerText(), /0015/);
            await page.keyboard.press('Escape');
            await page.evaluate(() => { stage1DisplayFilters.employeeQuery = ''; renderWeeklyHrStage1Presentation(); });
            assert.equal(await page.locator('#employmentReviewReadWarnings [data-review-guidance-open]').count(), 1);
            assert.equal(await page.locator('.weekly-hr-stage1-status [data-review-guidance-open]').count(), 1);
        }
        assert.deepEqual(errors, []);
        await page.close();
    }
    assert.equal(JSON.stringify(response), before);
});

test('Chromium: real download link skips the layout loader; history guidance fits content widths', async () => {
    const layout = fs.readFileSync(path.join(root, 'views/layouts/main.ejs'), 'utf8');
    const marker = layout.indexOf('// Links: μόνο same-tab navigations');
    const scriptStart = layout.lastIndexOf('<script', marker);
    const loader = layout.slice(layout.indexOf('\n', scriptStart) + 1, layout.indexOf('</script>', marker));
    const partial = fs.readFileSync(path.join(root,
        'views/ergazomenoi/ergazomenoi/partials/edit/cardBodies/section7/istoriko.ejs'), 'utf8');
    const anchor = partial.match(/<a id="employeeHistoryExportXlsxBtn"[\s\S]*?<\/a>/)[0];
    const link = ejs.render(anchor, { ergazomenoiData: { _id: 'synthetic-employee' } });
    const workbook = new (require('exceljs').Workbook)();
    workbook.addWorksheet('Synthetic').addRow(['Synthetic only']);
    const xlsx = await workbook.xlsx.writeBuffer();
    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage();
        await page.route('**/*', route => {
            assert.equal(new URL(route.request().url()).origin, 'http://synthetic.invalid');
            return route.fulfill(route.request().url().endsWith('.xlsx')
                ? { status: 200, headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'Content-Disposition': 'attachment; filename="synthetic.xlsx"' }, body: Buffer.from(xlsx) }
                : { status: 200, contentType: 'text/html', body: '<!doctype html><body></body>' });
        });
        await page.goto('http://synthetic.invalid');
        await page.setContent('<!doctype html><style>body{margin:0}main{margin-left:var(--sidebar,0px);padding:12px;min-width:0}</style><main>' + link + '<div id="guidance"></div></main>');
        await page.addStyleTag({ content: fs.readFileSync(path.join(root, 'public/css/main.css'), 'utf8') });
        await page.evaluate(() => { window.loaderStarts = 0; window.AppLoader = { begin() { window.loaderStarts++; } }; });
        await page.addScriptTag({ content: loader });
        for (const name of ['employmentReviewGuidance', 'employmentReviewGuidanceUi'])
            await page.addScriptTag({ path: path.join(root, 'public/js/ergazomenoi/programmata', name + '.js') });
        await page.evaluate(() => {
            const payload = { scope: { week_start: '2026-08-31', week_end: '2026-09-06' }, lifecycle_projection: { stages: {
                stage1: { business_status: 'BLOCKED', blockers: ['EMPLOYEE_HISTORY_COVERAGE_REQUIRED'], diagnostics: [{
                    code: 'EMPLOYEE_HISTORY_COVERAGE_REQUIRED', dates: ['2026-09-02'], evidence: {
                        coverage_reason: 'OVERLAPPING_WORK_TERMS', matching_profile_count: 2 } }] }
            } } };
            document.querySelector('#guidance').innerHTML = EmploymentReviewGuidanceUi.detailHtml(EmploymentReviewGuidanceUi.targets([payload])[0]);
        });
        const download = page.waitForEvent('download');
        await page.locator('#employeeHistoryExportXlsxBtn').click();
        assert.equal((await download).suggestedFilename(), 'synthetic.xlsx');
        assert.equal(await page.evaluate(() => window.loaderStarts), 0);
        for (const [width, height] of [[1920,1080],[1680,1050],[1600,900],[1440,900],[1280,1024],[1280,800],[1280,720],[640,480]]) {
            await page.setViewportSize({ width, height });
            for (const sidebar of [0, 260]) {
                await page.evaluate(value => document.body.style.setProperty('--sidebar', value + 'px'), sidebar);
                const result = await page.locator('#guidance').evaluate(el => ({ width: el.clientWidth, scroll: el.scrollWidth, text: el.innerText }));
                assert.ok(result.scroll <= result.width + 1, JSON.stringify({ width, height, sidebar, result }));
                assert.match(result.text, /Περισσότερες από μία ιστορικές εγγραφές/);
                assert.match(result.text, /ΙΣΤ-ΚΑΛΥΨΗ-01/);
                assert.doesNotMatch(result.text, /Τεχνικό πρόβλημα/);
            }
        }
        // Control: an ordinary same-tab link still starts the existing loader.
        await page.evaluate(() => { const a = document.createElement('a'); a.href = '/ordinary'; a.textContent = 'ordinary';
            a.addEventListener('click', event => event.preventDefault()); document.body.append(a); a.click(); });
        assert.equal(await page.evaluate(() => window.loaderStarts), 1);
    } finally { await browser.close(); }
});

test('Chromium: unknown work and overtime show accessible zeros while calculations and exports stay unavailable', async () => {
    const source = fs.readFileSync(path.join(root,
        'public/js/ergazomenoi/programmata/elegxosApasxolhseonPeriodoy.js'), 'utf8');
    const names = ['num', 'hours', 'effectiveWorkHoursValue', 'stage4WorkMinutes',
        'formatStage4HoursMinutes', 'renderStage4DecimalHours', 'renderStage4HoursValue',
        'renderHoursCell', 'createEmptyTotals', 'addRowToTotals',
        'sumYperergasia', 'sumNomimiYperoria', 'sumParanomiYperoria', 'sumUiYperoria'];
    const code = names.map(name => {
        const match = source.match(new RegExp('function ' + name + '\\([\\s\\S]*?\\n}'));
        assert.ok(match, name); return match[0];
    }).join('\n');
    const { reviewTotalsRow } = require('../fixtures/employmentReviewTotalsFixture');
    const unknown = reviewTotalsRow({ ores_ergasias_apologistika: null,
        ores_pragmatikhs_ergasias_apologistika: null,
        ores_yperergasias_apologistika: null, ores_nominhs_yperorias_apologistika: null,
        ores_paranomhs_yperorias_apologistika: null,
        compensation_breakdown_apologistika: { history_terms_unavailable: true } });
    const zero = reviewTotalsRow({ ores_ergasias_apologistika: 0, ores_pragmatikhs_ergasias_apologistika: 0 });
    const valid = reviewTotalsRow({ _id: 'synthetic-valid', hmeromhnia: '2026-09-29',
        ores_ergasias_apologistika: 7.5, ores_pragmatikhs_ergasias_apologistika: 7.5 });
    const before = structuredClone(unknown);
    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage();
        const errors = []; page.on('pageerror', error => errors.push(error.message));
        await page.setContent('<body></body>');
        await page.addScriptTag({ path: path.join(root,
            'public/js/ergazomenoi/programmata/employmentReviewNumbers.js') });
        await page.addScriptTag({ content: code });
        const result = await page.evaluate(({ unknown, zero, valid }) => {
            const snapshot = JSON.stringify(unknown), totals = createEmptyTotals();
            addRowToTotals(totals, unknown); addRowToTotals(totals, valid);
            document.body.innerHTML = `<div id="work">${renderHoursCell(unknown)}</div>
                <div id="overwork">${renderStage4DecimalHours(sumYperergasia(unknown))}</div>
                <div id="overtime">${renderStage4DecimalHours(sumUiYperoria(unknown))}</div>
                <div id="zero">${renderHoursCell(zero)}</div>
                <div id="valid">${renderHoursCell(valid)}</div>`;
            return { work: effectiveWorkHoursValue(unknown), minutes: stage4WorkMinutes(unknown),
                overwork: sumYperergasia(unknown), overtime: sumUiYperoria(unknown), totals,
                mixedSum: EmploymentReviewNumbers.sum([7.5, effectiveWorkHoursValue(unknown)]),
                unchanged: JSON.stringify(unknown) === snapshot,
                zeroWork: effectiveWorkHoursValue(zero), validWork: effectiveWorkHoursValue(valid),
                cardHours: unknown.cards_ores_ergasias };
        }, { unknown, zero, valid });
        for (const key of ['work', 'minutes', 'overwork', 'overtime', 'mixedSum']) assert.equal(result[key], null, key);
        assert.equal(result.cardHours, 8, 'Known card hours never substitute unknown work');
        assert.equal(result.unchanged, true);
        for (const key of ['ores_ergasias_apologistika', 'yperergasia', 'nomimiYperoria', 'paranomiYperoria', 'uiYperoria'])
            assert.equal(result.totals[key], null, key);
        for (const id of ['work', 'overwork', 'overtime']) {
            assert.equal((await page.locator('#' + id).innerText()).trim(), '0.00');
            const note = page.locator('#' + id + ' .stage4-hours-unavailable');
            assert.equal(await note.getAttribute('role'), 'note');
            assert.match(await note.getAttribute('title'), /δεν είναι τεκμηριωμένη/);
            assert.match(await note.ariaSnapshot(), /note.*δεν είναι τεκμηριωμένη/);
            await note.focus();
            assert.equal(await note.evaluate(node => node === document.activeElement), true);
        }
        assert.equal(result.zeroWork, 0);
        assert.equal((await page.locator('#zero').innerText()).trim(), '0.00');
        assert.equal(await page.locator('#zero .stage4-hours-unavailable').count(), 0);
        assert.equal(result.validWork, 7.5);
        assert.equal(await page.locator('#valid .stage4-hours-clock').innerText(), '07:30');
        assert.equal(await page.locator('#valid .stage4-hours-decimal').innerText(), '7.50');
        assert.equal(await page.locator('#valid .stage4-hours-unavailable').count(), 0);
        assert.deepEqual(errors, []);
    } finally { await browser.close(); }

    const service = require('../../server/services/ergazomenoi/apasxoliseisEmploymentReviewReportService');
    const report = service.buildEmploymentReviewReportProjection({ rows: [unknown, valid] });
    const fields = ['ores_ergasias_apologistika', 'ores_pragmatikhs_ergasias_apologistika',
        'ores_yperergasias_apologistika', 'ores_nominhs_yperorias_apologistika', 'ores_paranomhs_yperorias_apologistika'];
    for (const field of fields) {
        assert.equal(report.daily[0].values[field], null, field);
        assert.equal(report.employees[0].totals[field], null, field);
        assert.equal(report.summary.totals[field], null, field);
    }
    const reportBefore = structuredClone(report), workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await service.buildEmploymentReviewWorkbook(report).xlsx.writeBuffer());
    const totals = workbook.getWorksheet('ΣΥΝΟΛΑ ΑΝΑ ΕΡΓΑΖΟΜΕΝΟ');
    for (const field of fields) {
        const label = service.TOTAL_NUMBER_FIELDS.find(([key]) => key === field)[1];
        const column = totals.getRow(1).values.indexOf(label);
        assert.ok(column > 0, label);
        assert.equal(totals.getRow(2).getCell(column).value, 'Μη διαθέσιμο', label);
        assert.equal(totals.getRow(3).getCell(column).value, 'Μη διαθέσιμο', label);
    }
    for (const dossier of [false, true]) {
        const doc = service.buildEmploymentReviewPdf(report, { dossier }), chunks = [];
        doc.on('data', chunk => chunks.push(chunk));
        const done = new Promise((resolve, reject) => { doc.on('end', resolve); doc.on('error', reject); });
        doc.end(); await done;
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'payroll-pr381-unknown-export-'));
        const filename = path.join(dir, 'report.pdf'); fs.writeFileSync(filename, Buffer.concat(chunks));
        const text = execFileSync('pdftotext', ['-layout', filename, '-'], { encoding: 'utf8' });
        assert.match(text, /Μη\s+διαθέσιμο/);
        assert.match(text, /7[.,]50/);
    }
    assert.deepEqual(report, reportBefore, 'Export formatting preserves unknown report values');
    assert.deepEqual(unknown, before, 'Rendering, aggregation and exports preserve source data');
});
