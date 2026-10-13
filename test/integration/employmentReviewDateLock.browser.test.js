'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');
const { chromium } = require('playwright');
const { createGuidanceFixture } = require('../helpers/employmentReviewGuidanceApp');
const { requireCriticalEmploymentDecisionRole } = require('../../server/services/ergazomenoi/apasxoliseisCriticalActionAuthorizationService');
const period = require('../../server/services/ergazomenoi/apasxoliseisEmploymentPeriodScopeService');
const cycles = require('../../server/services/ergazomenoi/employeeEmploymentCycleContextLoaderService');
const { finalizedEmployeeFilter } = require('../../server/utils/ergazomenoi/finalizedEmployeeFilter');
const { buildEmploymentReviewUpdateErrorResponse, removeClientRawCardUpdates } = require('../../server/services/ergazomenoi/apasxoliseisOrphanResolutionPersistenceService');
const { reviewErrorResponse } = require('../../server/services/ergazomenoi/apasxoliseisReviewErrorPresentationService');
const { saveStage1DailyClassificationsBulk } = require('../../server/services/ergazomenoi/apasxoliseisStage1DailyClassificationBulkService');
const { dateKeyUtc } = require('../../server/utils/date/mondaySundayWeek');
const uri = process.env.PAYROLL_GUIDANCE_TEST_MONGO_URI;
const vendorDir = process.env.PAYROLL_PERIOD_EMPLOYEES_TOM_VENDOR_DIR;

test('employment dates stay blank and locked in Chromium and reject forged writes without changing data', {
    skip: !uri || !vendorDir, timeout: 180000
}, async t => {
    const data = await createGuidanceFixture(uri, vendorDir, { employmentScenarios: true });
    t.after(() => mongoose.disconnect());
    // Compile only the two command bodies; writes to valid dates are covered by the existing workflow suite.
    const source = fs.readFileSync(require.resolve('../../server/controllers/ergazomenoi/erganhController'), 'utf8');
    const section = (start, end) => source.slice(source.indexOf(start), source.indexOf(end));
    const deps = { mongoose, ...period, ...cycles, finalizedEmployeeFilter,
        ErgazomenoiModel: data.E, IstorikoProslhpseonAllagonModel: data.H,
        ProdhlomenaOrariaModel: data.D, REVIEW_SELECT_FIELDS: '',
        orphanResolutionBoundaryTestOverrides: null, canReviewEdit: () => true,
        buildEmploymentReviewUpdateErrorResponse, removeClientRawCardUpdates, saveStage1DailyClassificationsBulk,
        reviewErrorResponse, dateKeyUtc,
        activeEmploymentReviewPeriodScope: async () => ({ ypokatasthma: '0000',
            period_start: '2026-09-01', period_end: '2026-09-30' }),
        console: { error() {} } };
    const api = Function(...Object.keys(deps), `
        ${section('async function applyEmploymentDepartureScopeToFilters(', 'const REVIEW_SELECT_FIELDS =')}
        class Commands {
            ${section('    static updateProdhlomenaOrariaReviewRecord =', '    static unlockProdhlomenaOrariaReviewRecord =')}
            ${section('    static saveWeeklyHrStage1DailyClassificationsBulk =', '    static previewWeeklyHrStage3Bulk =')}
        }
        return { patch: Commands.updateProdhlomenaOrariaReviewRecord,
            bulk: Commands.saveWeeklyHrStage1DailyClassificationsBulk,
            assertDate: assertReviewRowEmploymentDate };
    `)(...Object.values(deps));
    data.app.patch('/api/prodhlomena-oraria/review/:id', requireCriticalEmploymentDecisionRole, api.patch);
    data.app.post('/api/prodhlomena-oraria/review/weekly-hr-workflow/stage1/bulk-classify-days', requireCriticalEmploymentDecisionRole, api.bulk);
    const snapshot = async () => JSON.stringify({ workflow: await data.snapshot(),
        employees: await data.E.find({ company_kod: String(data.company) }).sort({ _id: 1 }).lean(),
        history: await data.H.find({ company_kod: String(data.company) }).sort({ _id: 1 }).lean() });
    const before = await snapshot();
    const server = data.app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    t.after(() => new Promise(resolve => server.close(resolve)));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const browser = await chromium.launch({ headless: true });
    t.after(() => browser.close());
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.setDefaultTimeout(15000);
    await page.goto(origin + '/review');
    await page.waitForFunction(() => Boolean(document.getElementById('ypokatasthma').tomselect));
    await page.locator('#ypokatasthma + .ts-wrapper .ts-control').click();
    await page.locator('#ypokatasthma + .ts-wrapper .option[data-value="0000"]').click();
    await page.waitForFunction(() => Boolean(document.getElementById('reviewEmployee').tomselect));
    async function search(code) {
        const reset = page.locator('#reviewEmployee + .ts-wrapper .ts-single-reset-btn');
        if (await reset.isVisible()) await reset.click();
        await page.locator('#reviewEmployee + .ts-wrapper .ts-control').click();
        await page.locator('#reviewEmployee + .ts-wrapper .dropdown-input').fill(code);
        await page.locator(`#reviewEmployee + .ts-wrapper .option[data-value="${code}"]`).click();
        const response = page.waitForResponse(r => new URL(r.url()).pathname === '/api/prodhlomena-oraria/review');
        await page.locator('#searchBtn').click();
        const result = await response;
        assert.equal(result.status(), 200, await result.text());
        await page.waitForFunction(() => !document.body.classList.contains('loader-active'));
        await page.evaluate(() => loadPreparedWeeklyHrStage1());
        await page.waitForFunction(() => !document.querySelector('#employmentReviewStage1Collapse.collapsing'));
        const toggle = page.locator('[data-bs-target="#employmentReviewStage1Collapse"]');
        if (!await page.locator('#employmentReviewStage1Collapse').evaluate(node => node.classList.contains('show'))) await toggle.click();
        await page.waitForFunction(value => [...weeklyHrStage1Payloads.values()].some(p => p.scope.employee_kodikos === value), code);
        await page.locator('#employmentReviewStage1Collapse.show').waitFor();
    }
    async function blankDays(code, week, excluded, active) {
        // Check actual DOM cells in the natural-week matrix, keeping date headers visible.
        const result = await page.evaluate(({ code, week, excluded, active }) => {
            const payload = [...weeklyHrStage1Payloads.values()].find(p => p.scope.employee_kodikos === code && p.scope.week_start === week);
            const key = weeklyHrStage1Key(payload.scope);
            const row = [...document.querySelectorAll('[data-stage1-key]')].find(node => node.dataset.stage1Key === key && node.tagName === 'TR');
            if (!row) throw new Error('Matrix row missing');
            const dates = stage1NaturalWeekDates(week);
            const cells = [...row.querySelectorAll('.weekly-hr-stage1-matrix-day-cell')];
            return { excluded: excluded.map(date => {
                const cell = cells[dates.indexOf(date)];
                return { text: cell.textContent, children: cell.children.length, color: getComputedStyle(cell).backgroundColor,
                    tooltip: cell.hasAttribute('data-stage1-tooltip'), actions: cell.querySelectorAll('button,input,[tabindex]').length };
            }), active: active.map(date => Boolean(cells[dates.indexOf(date)].querySelector('.weekly-hr-stage1-open-editor'))),
                pending: stage1RelevantDates(payload), selected: [] };
        }, { code, week, excluded, active });
        for (const cell of result.excluded) assert.deepEqual(cell, { text: '', children: 0, color: 'rgb(233, 236, 239)', tooltip: false, actions: 0 });
        assert.ok(result.active.every(Boolean), 'active employment days remain editable');
        assert.ok(excluded.every(date => !result.pending.includes(date)));
        await page.evaluate(() => selectVisiblePendingWeeklyHrStage1Days());
        const selected = await page.evaluate(() => [...weeklyHrStage1DaySelected].map(id => stage1DateKey(weeklyHrStage1RowsById.get(id).hmeromhnia)));
        assert.ok(excluded.every(date => !selected.includes(date)));
    }
    await search('0032');
    await blankDays('0032', '2026-08-31', ['2026-08-31','2026-09-01'], ['2026-09-02']);
    const excludedRow = await data.D.findOne({ company_kod: String(data.company), kodikos: '0032',
        hmeromhnia: new Date('2026-09-29') }).lean();
    await page.evaluate(row => {
        const payload = [...weeklyHrStage1Payloads.values()].find(p => p.scope.week_start === '2026-09-28');
        payload.rows.push(row);
        payload.confirmed_leave_dates = [...(payload.confirmed_leave_dates || []), '2026-09-29'];
        payload.workflow.possible_leave_days = [...(payload.workflow.possible_leave_days || []), '2026-09-29'];
        weeklyHrStage1RowsById.set(String(row._id), row);
        setStage1DayDraft(String(row._id), 'ABSENCE');
        openWeeklyHrStage1DayEditor(String(row._id));
        if (weeklyHrStage1DayDrafts.has(String(row._id)) || document.querySelector('#weeklyHrStage1DayEditor.show')) {
            throw new Error('Excluded date opened or received a draft');
        }
        renderWeeklyHrStage1Presentation();
    }, JSON.parse(JSON.stringify(excludedRow)));
    for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        await blankDays('0032', '2026-09-28', ['2026-09-29','2026-09-30','2026-10-01','2026-10-02','2026-10-03','2026-10-04'], ['2026-09-28']);
        const artifactDir = process.env.PAYROLL_VISUAL_ARTIFACT_DIR;
        if (artifactDir) {
            fs.mkdirSync(artifactDir, { recursive: true });
            const lastWeek = page.locator('tr.weekly-hr-stage1-card').last();
            await lastWeek.scrollIntoViewIfNeeded();
            await lastWeek.evaluate(node => {
                const scroller = node.closest('.weekly-hr-stage1-table-shell');
                scroller.scrollLeft = scroller.scrollWidth;
            });
            await page.screenshot({ path: path.join(artifactDir, `employment-date-lock-${width}.png`), fullPage: true, animations: 'disabled' });
        }
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    }
    await page.evaluate(() => { stage1DisplayFilters.leave = true; renderWeeklyHrStage1Presentation(); });
    await blankDays('0032', '2026-09-28', ['2026-09-29','2026-09-30'], ['2026-09-28']);
    await search('0032');
    await blankDays('0032', '2026-09-28', ['2026-09-29','2026-09-30'], ['2026-09-28']);
    await search('0033');
    await blankDays('0033', '2026-09-14', ['2026-09-16','2026-09-17'], ['2026-09-14','2026-09-18']);
    const stage3 = await page.evaluate(() => {
        const payload = [...weeklyHrStage1Payloads.values()].find(p => p.scope.week_start === '2026-09-14');
        const html = renderStage3WeekRow({ payload }, '2026-09-16', new Map(), {});
        const body = document.createElement('tbody'); body.innerHTML = html;
        return { cells: [...body.querySelectorAll('td')].map(cell => cell.textContent),
            empty: body.querySelectorAll('.employment-review-outside-employment:empty').length };
    });
    assert.deepEqual(stage3.cells, ['16/09/2026', 'Τετάρτη', '', '', '', '']);
    assert.equal(stage3.empty, 4);
    for (const [code, dates] of [['0032',['2026-09-01','2026-09-29','2026-09-30']], ['0033',['2026-09-16','2026-09-17']]]) {
        for (const date of dates) {
            const row = await data.D.findOne({ company_kod: String(data.company), kodikos: code, hmeromhnia: new Date(date) }).lean();
            await assert.rejects(api.assertDate({ req: { session: data.session }, row }), { code: 'EMPLOYMENT_REVIEW_DATE_OUTSIDE_EMPLOYMENT' });
            const response = await page.request.patch(origin + '/api/prodhlomena-oraria/review/' + row._id, {
                data: { reason: 'Συνθετική απόπειρα εκτός σχέσης', updates: { apousia_apologistika: true } }
            });
            assert.equal(response.status(), 409, await response.text());
            const failure = await response.json();
            assert.equal(failure.code, 'EMPLOYMENT_REVIEW_DATE_OUTSIDE_EMPLOYMENT');
            assert.match(failure.message, /1\..*2\..*Δεν αποθηκεύτηκε/);
            const bulk = await page.request.post(origin + '/api/prodhlomena-oraria/review/weekly-hr-workflow/stage1/bulk-classify-days', {
                data: { ypokatasthma: '0000', period_start: '2026-09-01', period_end: '2026-09-30',
                    reason: 'Συνθετική μαζική απόπειρα', changes: [{ row_id: String(row._id), classification: 'ABSENCE' }] }
            });
            assert.equal(bulk.status(), 200, await bulk.text());
            const outcome = await bulk.json();
            assert.equal(outcome.saved_count, 0);
            assert.equal(outcome.results[0].code, failure.code);
        }
    }
    for (const [code, date] of [['0032','2026-09-28'], ['0033','2026-09-14'], ['0033','2026-09-18']]) {
        const row = await data.D.findOne({ company_kod: String(data.company), kodikos: code, hmeromhnia: new Date(date) }).lean();
        await api.assertDate({ req: { session: data.session }, row });
    }
    assert.equal(mongoose.get('sanitizeFilter'), true);
    assert.equal(await snapshot(), before, 'view, filters, selection and rejected requests leave all synthetic records unchanged');
    assert.deepEqual(errors, []);
});
