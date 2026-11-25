'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { chromium } = require('playwright');
const { startApprovedProposalMongo, seedApprovedProposal } = require('../fixtures/employeeHistoryApprovedProposalMongo');
const { startArchiveHttp } = require('../fixtures/employeeHistoryArchiveHttpHarness');
const binary = process.env.PAYROLL_APPROVED_PROPOSAL_TEST_MONGOD;
test('Chromium: πραγματικό Swal, CSRF, αρχειοθέτηση, πίνακας και διαφορετικά πλάτη', { skip: !binary, timeout: 180000 }, async t => {
    const db = await startApprovedProposalMongo(binary); t.after(db.close);
    const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] }); t.after(() => browser.close());
    const f = await seedApprovedProposal(db), h = await startArchiveHttp(f, db); t.after(h.close);
    const context = await browser.newContext(), page = await context.newPage(), parent = await context.newPage();
    const errors = [], external = [];
    page.on('pageerror', error => errors.push(error.message)); parent.on('pageerror', error => errors.push(error.message));
    await context.route('**/*', async route => {
        const url = route.request().url();
        if (url === 'https://cdn.webpayrollsolutions.com/assets/own/vendor/sweetalert2-11.26.25.min.js')
            return route.fulfill({ contentType: 'application/javascript', body: await fs.readFile(require.resolve('sweetalert2/dist/sweetalert2.all.min.js')) });
        if (new URL(url).origin === h.origin) return route.continue();
        external.push(url); return route.abort();
    });
    const target = String(f.history[0]._id), url = `${h.origin}/api/ergazomenoi/${f.employee._id}/history-proposal-editor?selection=UPDATE:${target}`;
    await parent.goto(`${h.origin}/parent`);
    await page.goto(url);
    const button = page.locator('#archiveHistoryRow'), before = await f.snapshot();
    await t.test('Κουμπί μόνο για αποθηκευμένη εγγραφή, «Όχι» χωρίς αίτημα και χωρίς μεταβολή', async () => {
        assert.equal(await button.textContent(), 'Διαγραφή εγγραφής Ιστορικού');
        await button.click(); await page.locator('.swal2-popup').waitFor();
        assert.equal(await page.locator('.swal2-title').textContent(), 'Διαγραφή εγγραφής Ιστορικού');
        assert.match(await page.locator('.swal2-html-container').textContent(), /Τα εξαρτώμενα αρχεία και οι ήδη καταχωρισμένες κινήσεις δεν θα τροποποιηθούν/);
        await page.getByRole('button', { name: 'Όχι', exact: true }).click();
        await page.locator('.swal2-popup').waitFor({ state: 'hidden' });
        assert.equal(h.requests.length, 0); assert.equal(await f.snapshot(), before);
    });
    const artifactRoot = process.env.PAYROLL_APPROVED_PROPOSAL_TEST_ARTIFACT_DIR || require('node:os').tmpdir();
    await fs.mkdir(artifactRoot, { recursive: true });
    const artifacts = await fs.mkdtemp(require('node:path').join(artifactRoot, 'payroll-archive-browser-'));
    await t.test('Διάταξη, ορατότητα ενεργειών και icons σε πραγματικό Chromium', async t => {
        t.after(() => page.evaluate(() => window.Swal.close()));
        for (const [width, height] of [[1920,1080],[1280,720],[900,700],[480,700],[900,450]]) for (const sidebar of [false,true]) {
            await page.setViewportSize({ width, height });
            await page.locator('.proposal-page').evaluate((node, sidebar) => {
                node.style.width = sidebar ? 'calc(100% - 160px)' : ''; node.style.marginLeft = sidebar ? '160px' : '';
            }, sidebar);
            await button.click(); await page.locator('.swal2-popup').waitFor();
            await page.locator('.swal2-popup').evaluate(node => Promise.all(node.getAnimations({ subtree: true }).map(animation => animation.finished)));
            const geometry = await page.locator('.swal2-popup').evaluate(node => {
                const popup = node.getBoundingClientRect(), actions = node.querySelector('.swal2-actions').getBoundingClientRect();
                const icon = node.querySelector('.swal2-icon').getBoundingClientRect();
                return { popup: { x: popup.x, y: popup.y, right: popup.right, bottom: popup.bottom },
                    actions: { y: actions.y, bottom: actions.bottom }, icon: { width: icon.width, height: icon.height },
                    horizontalOverflow: document.documentElement.scrollWidth > innerWidth };
            });
            assert.ok(geometry.popup.x >= 0 && geometry.popup.right <= width + 1);
            assert.ok(geometry.actions.y >= 0 && geometry.actions.bottom <= height);
            assert.ok(geometry.icon.width > 30 && Math.abs(geometry.icon.width - geometry.icon.height) <= 1, JSON.stringify(geometry));
            assert.equal(geometry.horizontalOverflow, false);
            await page.screenshot({ path: `${artifacts}/${width}x${height}${sidebar ? '-sidebar' : ''}.png` });
            await page.getByRole('button', { name: 'Όχι', exact: true }).click();
            await page.locator('.swal2-popup').waitFor({ state: 'hidden' });
        }
        console.log('Εικόνες Chromium:', artifacts);
    });
    await t.test('Απουσία CSRF απορρίπτεται χωρίς μεταβολή', async () => {
        const payload = JSON.parse(await button.getAttribute('data-archive'));
        const response = await context.request.post(`${h.origin}/api/ergazomenoi/${f.employee._id}/history-proposal-archive`, { data: { ...payload, confirmed: true } });
        assert.equal(response.status(), 403); assert.equal(await f.snapshot(), before);
    });
    await t.test('Επιτυχής αρχειοθέτηση, άμεση αφαίρεση στον πίνακα και διατήρηση μη αποθηκευμένων στοιχείων', async () => {
        await page.setViewportSize({ width: 1280, height: 720 });
        await button.click(); await page.getByRole('button', { name: 'Ναι', exact: true }).click();
        await page.getByText('Η εγγραφή Ιστορικού διαγράφηκε', { exact: true }).waitFor();
        assert.equal(await page.locator('.swal2-success').count(), 1);
        await parent.waitForFunction(target => !document.querySelector(`tr[data-id="${target}"]`), target);
        assert.equal(await parent.locator('#syntheticUnsaved').inputValue(), 'unsaved');
        await page.getByRole('button', { name: 'Κλείσιμο', exact: true }).click();
        await page.waitForURL(`${h.origin}/api/ergazomenoi/${f.employee._id}/history-proposal-editor`);
        assert.equal(await page.locator(`#proposalSelection option[value="UPDATE:${target}"]`).count(), 0);
        await page.reload();
        assert.equal(await page.locator(`#proposalSelection option[value="UPDATE:${target}"]`).count(), 0);
        assert.equal((await context.request.get(url)).status(), 404);
        await parent.reload(); assert.equal(await parent.locator(`tr[data-id="${target}"]`).count(), 0);
        assert.equal(await db.historyModel.countDocuments({ _id: f.history[0]._id }), 1);
        assert.deepEqual(errors, []); assert.deepEqual(external, []);
    });
    await t.test('Customer χωρίς κουμπί· INSERT χωρίς κουμπί', async () => {
        const other = await seedApprovedProposal(db, { insert: true }), otherHttp = await startArchiveHttp(other, db);
        try {
            await context.route(otherHttp.origin + '/**', route => route.continue());
            await db.userModel.collection.updateOne({ _id: other.actor }, { $set: { privileges: 'C' } });
            await page.goto(`${otherHttp.origin}/api/ergazomenoi/${other.employee._id}/history-proposal-editor?selection=UPDATE:${other.history[0]._id}`);
            assert.equal(await button.count(), 0);
            await db.userModel.collection.updateOne({ _id: other.actor }, { $set: { privileges: 'HR' } });
            const result = await require('../../server/services/ergazomenoi/employeeHistoryProposalXlsxService')
                .buildEmployeeHistoryProposalWorkbook(await otherHttp.state(), other.catalogs);
            const insert = result.caseSelection.cases.find(item => item.operation === 'INSERT'); assert.ok(insert);
            await page.goto(`${otherHttp.origin}/api/ergazomenoi/${other.employee._id}/history-proposal-editor?selection=${encodeURIComponent('INSERT:' + insert.id)}`);
            assert.equal(await button.count(), 0);
        } finally { await otherHttp.close(); }
    });
});
