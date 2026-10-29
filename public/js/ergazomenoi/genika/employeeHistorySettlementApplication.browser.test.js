'use strict';
const { test, before, after, mock } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');
const { startSettlementHarness } = require('../../../../test/fixtures/employeeHistorySettlementHttpHarness');
const { forbidRealSettlementMongo } = require('../../../../test/fixtures/forbidRealSettlementMongo');
const { settlementDecisionFixture } = require('../../../../test/fixtures/employeeHistorySettlementDecisionFixture');
const { departureFactsFixture } = require('../../../../test/fixtures/employeeHistorySpecialDecisionFixture');
const modal = '#employeeSettlementPreviewModal', body = '#employeeSettlementPreviewBody';
const trigger = '#employeeHistoryReconstructionPreviewBtn', approve = '#employeeSettlementPreviewApprove';
const screenshots = '/tmp/payroll-phase4a-chromium';
let browser;
before(async () => {
    forbidRealSettlementMongo(mock); fs.mkdirSync(screenshots, { recursive: true });
    browser = await chromium.launch({ headless: true });
});
after(async () => { await browser?.close(); mock.restoreAll(); });
async function withForm(options, work) {
    const h = await startSettlementHarness({ ...options, fullForm: true });
    const page = await browser.newPage({ viewport: { width: options.width || 1280, height: options.width === 1920 ? 1080 : 800 } });
    page.setDefaultTimeout(8000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => {
        assert.equal(new URL(route.request().url()).origin, h.origin, 'only the isolated loopback server is accessible');
        return route.continue();
    });
    try {
        await page.goto(h.origin);
        if (options.sidebar) await page.evaluate(() => document.body.classList.add('sidebar-open'));
        assert.equal(await page.locator('.employee-edit-page').count(), 1);
        assert.equal(await page.locator('.menu_Links li').count(), 8);
        try { await work({ page, ...h }); }
        catch (error) {
            console.log(JSON.stringify({ syntheticDiagnostic: await page.locator(body).textContent(), requests: h.requests, errors }));
            throw error;
        }
        assert.deepEqual(errors, []);
    } finally { await page.close(); await h.close(); }
}
async function open(page) {
    await page.locator('.menu_Links li[data-tab-caption="Ιστορικό"]').click();
    await page.locator(trigger).click();
    await page.locator(`${body} .employee-settlement-message`).waitFor();
    await page.waitForTimeout(350);
}
async function clean(page) {
    await page.locator(approve).click();
    await page.waitForFunction(() => document.querySelector('#employeeSettlementPreviewBody').textContent === 'Το Ιστορικό τακτοποιήθηκε επιτυχώς');
}
async function continueIndependent(page) {
    await page.locator('#employeeSettlementPreviewContinue').click();
    await page.waitForTimeout(350);
    await page.locator('.menu_Links li').first().click();
    assert.equal(await page.locator('.sel_1_section').evaluate(node => node.classList.contains('visible')), true);
    assert.equal(await page.locator('.modal-backdrop').count(), 0);
}
for (const width of [1280, 1366, 1600, 1920]) for (const sidebar of [false, true])
test(`real edit.ejs ${width}px sidebar=${sidebar}: shared routes, existing transaction, CLEAN and protected references`, async () => {
    await withForm({ width, sidebar }, async ({ page, db, requests }) => {
        const before = db.state();
        await open(page);
        assert.equal(requests.length, 0);
        await clean(page);
        assert.equal(db.state().audits.length, 1);
        assert.deepEqual(db.state().references, before.references);
        const geometry = await page.locator(modal).evaluate(node => {
            const box = node.querySelector('.modal-content').getBoundingClientRect();
            const footer = node.querySelector('.modal-footer').getBoundingClientRect();
            return { fits: box.left >= 0 && box.right <= innerWidth && box.top >= 0 && box.bottom <= innerHeight,
                footerFits: footer.bottom <= innerHeight, overflow: node.scrollWidth > node.clientWidth };
        });
        assert.deepEqual(geometry, { fits: true, footerFits: true, overflow: false });
        await page.screenshot({ path: `${screenshots}/clean-${width}-sidebar-${sidebar}.png` });
        await page.locator('#employeeSettlementPreviewDetails').click();
        assert.match(await page.locator('#employeeSettlementPreviewReport').innerText(), /Καταγεγραμμένες ενέργειες.*ιστορικές αναφορές/s);
        await continueIndependent(page);
        await open(page);
        assert.match(await page.locator(body).innerText(), /Το Ιστορικό ελέγχθηκε και είναι σωστό/);
        assert.equal(await page.locator(approve).isVisible(), false);
        assert.equal(requests.length, 1);
    });
});
test('real form business choice is revalidated by the server before one total approval and atomic application', async () => {
    await withForm({ fixture: settlementDecisionFixture(), sidebar: true }, async ({ page, db, requests }) => {
        const before = db.state(); await open(page);
        assert.equal(await page.locator(`${body} input[type=radio]`).count(), 3);
        assert.equal(await page.locator(`${body} input:checked`).count(), 0);
        await page.locator(`${body} input[value="KEEP_FOUR_DAY_PROFILE"]`).check();
        await page.locator(approve).click();
        await page.waitForFunction(() => document.querySelector('#employeeSettlementPreviewApprove').textContent === 'Έγκριση & Τακτοποίηση');
        assert.deepEqual(db.state(), before, 'resolving a choice only reads');
        await clean(page);
        assert.equal(db.state().audits.length, 1);
        assert.deepEqual(db.state().references, before.references);
        assert.equal(requests.length, 1);
        await continueIndependent(page);
    });
});
test('real form COMMIT_UNCERTAIN has no false success and retries the exact approval without a second audit', async () => {
    await withForm({}, async ({ page, db, requests }) => {
        await open(page); db.failAt('COMMIT_ACK_LOST'); await page.locator(approve).click();
        await page.waitForFunction(() => document.querySelector('#employeeSettlementPreviewApprove').textContent === 'Επανάληψη με την ίδια έγκριση');
        assert.match(await page.locator(body).innerText(), /Παραμένει άγνωστο αν αποθηκεύτηκαν αλλαγές/);
        assert.doesNotMatch(await page.locator(body).innerText(), /επιτυχώς|Δεν αποθηκεύτηκε/);
        await continueIndependent(page); await open(page); await clean(page);
        assert.equal(db.state().audits.length, 1);
        assert.deepEqual(requests[0], requests[1]);
        assert.equal(db.events.filter(event => event.type === 'commit').length, 1);
    });
});
for (const fault of ['STALE', 'AUDIT']) test(`real form ${fault} rejects without losing independent state`, async () => {
    await withForm({}, async ({ page, db }) => {
        await open(page);
        if (fault === 'STALE') db.changeEmployee({ parathrhseis: 'Συνθετική ταυτόχρονη αλλαγή' });
        else db.failAt(fault);
        const before = db.state(); await page.locator(approve).click();
        await page.waitForFunction(() => document.querySelector('#employeeSettlementPreviewApprove').hidden);
        assert.match(await page.locator(body).innerText(), /Δεν αποθηκεύτηκε καμία αλλαγή/);
        assert.deepEqual(db.state(), before);
        await continueIndependent(page);
    });
});
for (const special of [false, true]) test(`real form unknown special=${special} retains administrator guidance and independent work`, async () => {
    await withForm(special ? { fixture: departureFactsFixture() } : { enriched: false }, async ({ page, db, requests }) => {
        const before = db.state(); await open(page);
        assert.match(await page.locator(body).innerText(), /διαχειριστή/);
        assert.equal(await page.locator(approve).isVisible(), false);
        await continueIndependent(page);
        assert.deepEqual(db.state(), before); assert.equal(requests.length, 0);
    });
});
