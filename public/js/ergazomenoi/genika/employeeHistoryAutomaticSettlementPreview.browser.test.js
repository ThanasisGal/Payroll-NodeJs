'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const ejs = require('ejs');
const { chromium } = require('playwright');
const { buildEmployeeHistorySettlementPreview: project } = require('../../../../server/services/ergazomenoi/employeeHistorySettlementPreviewService');
const { planEmployeeHistoryAutomaticSettlement: settle } = require('../../../../server/services/ergazomenoi/employeeHistoryAutomaticReconstructionPlannerService');
const F = require('../../../../server/services/ergazomenoi/fixtures/automaticEmployeeHistoryReconstructionFixtures');
const M = require('../../../../server/services/ergazomenoi/fixtures/multipleSafeEmployeeHistoryResolutionFixtures');
const B = require('../../../../server/services/ergazomenoi/fixtures/businessFactEmployeeHistoryResolutionFixtures');
const root = path.resolve(__dirname, '../../../..');
const modal = '#employeeSettlementPreviewModal';
const body = '#employeeSettlementPreviewBody';
const trigger = '#employeeHistoryReconstructionPreviewBtn';
const approve = '#employeeSettlementPreviewApprove';
const screenshots = '/tmp/payroll-phase3a-visual';
let browser;
before(async () => { browser = await chromium.launch({ headless: true }); fs.mkdirSync(screenshots, { recursive: true }); });
after(async () => { await browser?.close(); });
function fixture(kind) {
    const input = kind === 'decision' ? M.samePeriodMateriallyDifferentProfilesFixture() : F.real0006BoundaryStructure();
    input.completeHistoryRows.forEach(row => Object.assign(row, { evelikth_proselefsh: 0, symbatikes_ores_ergasias: 40 }));
    input.protectedReferenceSummary ||= Object.fromEntries(input.completeHistoryRows.map(row => [String(row._id), [{
        collection: 'Apasxoliseis_Period_Frozen_Snapshots', documentId: 'synthetic-frozen' }]]));
    if (kind === 'clean') input.completeHistoryRows = settle(input).proposedRows;
    if (kind === 'unknown') input.protectedReferenceSummary = {};
    return { input, preview: project(input) };
}
async function withPage({ kind = 'automatic', width = 1280, height = 800, sidebar = false, delay = 0, payload, status = 200 } = {}, work) {
    const { input, preview } = fixture(kind);
    const page = await browser.newPage({ viewport: { width, height } });
    const requests = [], errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
        await page.route('**/*', async route => {
            const request = route.request();
            if (request.url().includes('/history-reconstruction-preview')) {
                requests.push({ url: request.url(), method: request.method() });
                if (delay) await new Promise(resolve => setTimeout(resolve, delay));
                return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(payload || { success: true, settlementPreview: preview }) }).catch(() => {});
            }
            assert.equal(request.method(), 'GET');
            const partial = await ejs.renderFile(path.join(root, 'views/ergazomenoi/ergazomenoi/partials/edit/cardBodies/section7/istoriko.ejs'), {
                ergazomenoiData: input.currentEmployee, istorikoData: input.completeHistoryRows,
                employeeHistoryAccessMode: 'ADMIN_FULL', employeeHistoryStateToken: 'synthetic', problematicHistoryIds: [] });
            return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html lang="el"><meta charset="utf-8"><body><aside id="syntheticSidebar"></aside><main>${partial}<button type="button" id="independentAction">Ανεξάρτητη λειτουργία</button></main></body></html>` });
        });
        await page.goto('https://payroll.test/');
        for (const file of ['public/css/bootstrap.min.css', 'public/css/main.css']) await page.addStyleTag({ path: path.join(root, file) });
        await page.addStyleTag({ content: `main { margin-left:${sidebar ? 280 : 0}px; min-width:0; } #syntheticSidebar { width:${sidebar ? 280 : 0}px; position:fixed; inset:0 auto 0 0; background:#edf0f3; }` });
        for (const file of ['public/js/bootstrap.bundle.min.js', 'public/js/ergazomenoi/genika/employeeHistoryAutomaticSettlementPreview.js',
            'public/js/ergazomenoi/genika/employeeHistoryReconstructionPreview.js']) await page.addScriptTag({ path: path.join(root, file) });
        await page.evaluate(() => {
            window.guidedCalls = 0;
            window.employeeHistoryGuidedResolution = {};
            document.getElementById('employeeHistoryCorrectionStartBtn').addEventListener('click', () => { window.guidedCalls += 1; });
            document.getElementById('independentAction').addEventListener('click', () => { window.independentContinued = true; });
            document.dispatchEvent(new Event('DOMContentLoaded'));
        });
        await work({ page, requests, preview });
        assert.deepEqual(errors, []);
        assert.equal(await page.evaluate(() => window.guidedCalls), 0);
        assert.ok(requests.every(request => request.method === 'GET' && request.url.endsWith('?presentation=settlement')));
    } finally { await page.close(); }
}
async function open(page) {
    await page.click(trigger);
    await page.locator(`${body} .employee-settlement-message`).waitFor();
    await page.waitForTimeout(350);
}
async function close(page) {
    await page.locator(`${modal} .modal-footer [data-bs-dismiss="modal"]`).click();
    await page.waitForTimeout(350);
    assert.equal(await page.locator('.modal-backdrop').count(), 0);
    assert.equal(await page.locator(trigger).evaluate(node => node === document.activeElement), true);
}
for (const width of [1280, 1366, 1600, 1920]) for (const sidebar of [false, true])
test(`Chromium ${width}px sidebar=${sidebar}: automatic proposal, report and ephemeral approval`, async () => {
    await withPage({ width, sidebar }, async ({ page, requests }) => {
        await open(page);
        assert.equal(await page.locator(`${body} input`).count(), 0, 'approved assumptions never prompt');
        assert.equal(await page.locator(approve).textContent(), 'Έγκριση & Τακτοποίηση');
        const geometry = await page.locator(modal).evaluate(element => {
            const content = element.querySelector('.modal-content').getBoundingClientRect();
            const footer = element.querySelector('.modal-footer').getBoundingClientRect();
            return { fits: content.left >= 0 && content.right <= innerWidth && content.top >= 0 && content.bottom <= innerHeight,
                footerFits: footer.bottom <= innerHeight, overflow: element.scrollWidth > element.clientWidth,
                font: parseFloat(getComputedStyle(element.querySelector('.modal-body')).fontSize) };
        });
        assert.equal(geometry.fits, true, JSON.stringify(geometry));
        assert.equal(geometry.footerFits, true);
        assert.equal(geometry.overflow, false);
        assert.ok(geometry.font >= 15.2);
        await page.screenshot({ path: `${screenshots}/automatic-${width}-sidebar-${sidebar}.png` });
        await page.click('#employeeSettlementPreviewDetails');
        assert.equal(await page.locator('#employeeSettlementPreviewTitle').textContent(), 'Προβολή διορθώσεων');
        assert.match(await page.locator('#employeeSettlementPreviewReport').innerText(), /Εγκεκριμένες υποθέσεις.*23\/04\/2026/s);
        await page.click('#employeeSettlementPreviewBack');
        await page.click(approve);
        assert.match(await page.locator(body).innerText(), /εγκρίθηκε μόνο για προεπισκόπηση.*Δεν αποθηκεύτηκε/s);
        assert.equal(await page.locator(approve).isDisabled(), true);
        assert.equal(requests.length, 1);
        await close(page);
        await open(page);
        assert.equal(await page.locator(approve).isEnabled(), true, 'approval is discarded when closed');
        await close(page);
    });
});
test('clean History has exact success message and no approval', async () => {
    await withPage({ kind: 'clean' }, async ({ page }) => {
        await open(page);
        assert.match(await page.locator(body).innerText(), /Το Ιστορικό ελέγχθηκε και είναι σωστό/);
        assert.equal(await page.locator(approve).isVisible(), false);
        await close(page);
    });
});
test('business decisions use unselected radios and report choices without applying them', async () => {
    await withPage({ kind: 'decision', width: 1366, sidebar: true }, async ({ page, requests }) => {
        await open(page);
        assert.equal(await page.locator(`${body} input[type=radio]`).count(), 3);
        assert.equal(await page.locator(`${body} input:checked`).count(), 0);
        assert.equal(await page.locator(approve).isDisabled(), true);
        await page.click('#employeeSettlementPreviewDetails');
        assert.match(await page.locator('#employeeSettlementPreviewReport').innerText(), /Δεν έχουν συμπληρωθεί οι απαιτούμενες επιλογές/);
        await page.click('#employeeSettlementPreviewBack');
        await page.locator(`${body} input[type=radio]`).first().check();
        assert.equal(await page.locator(approve).isEnabled(), true);
        await page.screenshot({ path: `${screenshots}/decision-1366-sidebar-true.png` });
        await page.click(approve);
        assert.match(await page.locator('#employeeSettlementPreviewReport').innerText(), /2 ημέρες \/ 14 ώρες.*επανέλεγχο.*Δεν αποθηκεύτηκε/s);
        assert.equal(requests.length, 1);
        await close(page);
    });
});
for (const failure of [false, true]) test(`unknown/error ${failure} preserves independent actions and hides approval`, async () => {
    await withPage({ kind: 'unknown', ...(failure ? { status: 500, payload: { stack: 'SECRET_INTERNAL' } } : {}) }, async ({ page }) => {
        await open(page);
        assert.match(await page.locator(body).innerText(), /1\..*διαχειριστή.*2\..*ΙΣΤ-ΑΥΤ-3Α/s);
        assert.doesNotMatch(await page.locator(body).innerText(), /SECRET_INTERNAL/);
        assert.equal(await page.locator(approve).isVisible(), false);
        await close(page);
        await page.click('#independentAction');
        assert.equal(await page.evaluate(() => window.independentContinued), true);
    });
});
test('closing an in-flight preview aborts and prevents stale content', async () => {
    await withPage({ delay: 700 }, async ({ page }) => {
        await page.click(trigger);
        await page.waitForTimeout(350);
        await close(page);
        await page.waitForTimeout(750);
        assert.equal(await page.locator(body).innerText(), '');
        assert.equal(await page.locator(trigger).isEnabled(), true);
    });
});
test('report escapes strings and stays scrollable at 390×640 with accessible footer', async () => {
    const preview = fixture('automatic').preview;
    preview.assumptions.push('<img src=x onerror="window.injected=true">');
    preview.actions.push(...Array.from({ length: 50 }, () => 'Προτεινόμενη αλλαγή για έλεγχο.'));
    await withPage({ width: 390, height: 640, payload: { success: true, settlementPreview: preview } }, async ({ page }) => {
        await open(page);
        await page.click('#employeeSettlementPreviewDetails');
        const geometry = await page.locator(modal).evaluate(element => {
            const body = element.querySelector('.modal-body'), footer = element.querySelector('.modal-footer').getBoundingClientRect();
            return { scrolls: body.scrollHeight > body.clientHeight, footerFits: footer.bottom <= innerHeight,
                fits: body.scrollWidth <= body.clientWidth };
        });
        assert.deepEqual(geometry, { scrolls: true, footerFits: true, fits: true });
        assert.equal(await page.locator(`${modal} img`).count(), 0);
        assert.equal(await page.evaluate(() => window.injected), undefined);
        await page.screenshot({ path: `${screenshots}/report-390x640.png` });
        await close(page);
    });
});

test('conditional factual dates appear only when needed, enforce bounds and leave hidden answers out of the report', async () => {
    const input = B.competingDepartureDatesFixture();
    input.completeHistoryRows.forEach(row => Object.assign(row, { evelikth_proselefsh: 0, symbatikes_ores_ergasias: 40 }));
    const preview = project(input);
    assert.equal(preview.state, 'decision');
    await withPage({ payload: { success: true, settlementPreview: preview } }, async ({ page, requests }) => {
        await open(page);
        const date = page.locator(`${body} input[type=date]`);
        assert.equal(await date.isVisible(), false);
        await page.locator(`${body} input[value=DEPARTED_ON_OTHER_DATE]`).check();
        assert.equal(await date.isVisible(), true);
        assert.equal(await page.locator(approve).isDisabled(), true);
        await date.fill('2026-01-01');
        assert.equal(await page.locator(approve).isDisabled(), true);
        await date.fill('2026-08-18');
        assert.equal(await page.locator(approve).isEnabled(), true);
        await page.locator(`${body} input[value=NO_DEPARTURE]`).check();
        assert.equal(await date.isVisible(), false);
        assert.equal(await date.isDisabled(), true);
        await page.click(approve);
        const report = await page.locator('#employeeSettlementPreviewReport').innerText();
        assert.match(report, /Δεν πραγματοποιήθηκε αποχώρηση/);
        assert.doesNotMatch(report, /2026-08-18/);
        assert.equal(requests.length, 1);
        await close(page);
    });
});

test('business option date inputs require a value and remain disabled for unselected alternatives', async () => {
    const input = M.correctionFromHireOrSpecialtyChangeFixture();
    input.completeHistoryRows.forEach(row => Object.assign(row, { evelikth_proselefsh: 0, symbatikes_ores_ergasias: 40 }));
    const preview = project(input);
    const option = preview.questions[0].options.find(option => option.inputs?.length);
    assert.ok(option);
    await withPage({ payload: { success: true, settlementPreview: preview } }, async ({ page }) => {
        await open(page);
        const date = page.locator(`${body} input[type=date]`);
        await page.locator(`${body} input[value="${option.id}"]`).check();
        assert.equal(await date.isVisible(), true);
        assert.equal(await page.locator(approve).isDisabled(), true);
        await date.fill(option.inputs[0].min);
        assert.equal(await page.locator(approve).isEnabled(), true);
        const other = preview.questions[0].options.find(item => !item.inputs?.length);
        await page.locator(`${body} input[value="${other.id}"]`).check();
        assert.equal(await date.isVisible(), false);
        assert.equal(await date.isDisabled(), true);
        await close(page);
    });
});
