'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const ejs = require('ejs');
const { chromium } = require('playwright');
const W = require('../../../../server/services/ergazomenoi/employeeEmploymentProfileWriter');
const { profileError } = require('../../../../server/utils/ergazomenoi/employmentProfileMaintenance');
const { fixture, store, scope } = require('../../../../test/fixtures/employeeProfileTransactionStore');
const { token, userModel } = require('../../../../test/fixtures/employeeHistorySupervisor');
const root = path.resolve(__dirname, '../../../..');
const view = path.join(root, 'views/ergazomenoi/ergazomenoi/partials/edit/cardBodies/section7/istoriko.ejs');

test('Chromium: import form adapts to content width with sidebar open/closed and preview can be cancelled without writes', async () => {
    const f = fixture();
    f.history.forEach(row => { row.hmeromhnia_proslhpshs = '2017-05-24'; });
    f.employee.hmeromhnia_proslhpshs = '2017-05-24';
    const db = store([f]), before = db.state(), requests = [];
    const html = await ejs.renderFile(view, { ergazomenoiData: f.employee, istorikoData: f.history,
        employeeHistoryAccessMode: 'ADMIN_FULL', employeeHistoryStateToken: token(db) });
    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage();
        await page.route('https://payroll.test/**', async route => {
            if (route.request().method() === 'GET') return route.fulfill({ contentType: 'text/html',
                body: `<!doctype html><html lang="el"><head><meta charset="utf-8"></head><body><main id="content">${html}</main></body></html>` });
            const payload = route.request().postDataJSON(); requests.push(payload);
            let body;
            try {
                body = await W.writeEmployeeEmploymentHistoryOperations({ ...db.deps, scope, employeeId: 'employee',
                    operations: payload.updates, expectedStateToken: payload.expectedStateToken,
                    actorUserId: 'synthetic-admin', userModel: userModel({ privileges: 'A', team: 'THA', situation: 'A' }),
                    correction: payload.correction });
            } catch (error) {
                const res = { status() { return this; }, json(value) { body = value; } };
                profileError(res, error, { resolutionStatusCode: 200 });
                assert.ok(body);
            }
            return route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
        });
        await page.goto('https://payroll.test/');
        await page.addStyleTag({ path: path.join(root, 'public/css/bootstrap.min.css') });
        await page.addStyleTag({ path: path.join(root, 'public/css/main.css') });
        await page.addStyleTag({ path: path.join(root, 'node_modules/sweetalert2/dist/sweetalert2.css') });
        await page.addScriptTag({ path: path.join(root, 'node_modules/sweetalert2/dist/sweetalert2.all.js') });
        await page.addScriptTag({ path: path.join(__dirname, 'employeeHistoryGuidedResolution.js') });
        await page.addScriptTag({ path: path.join(__dirname, 'istorikoTable.js') });
        await page.evaluate(() => document.dispatchEvent(new Event('DOMContentLoaded')));
        await page.locator('.employee-import-declaration summary').click();
        for (const [width, height] of [[1920,1080],[1680,1050],[1600,900],[1440,900],[1280,1024],[1280,800],[1280,720],[640,480]]) {
            await page.setViewportSize({ width, height });
            for (const sidebar of [0,280]) {
                await page.locator('#content').evaluate((node, margin) => {
                    node.style.marginLeft = `${margin}px`; node.style.width = `calc(100% - ${margin}px)`;
                }, sidebar);
                const layout = await page.locator('.employee-import-declaration').evaluate(node => {
                    const box = node.getBoundingClientRect();
                    return [...node.querySelectorAll('input,button,label')].map(control => {
                        const rect = control.getBoundingClientRect();
                        return { left: rect.left - box.left, right: rect.right - box.right,
                            font: parseFloat(getComputedStyle(control).fontSize) };
                    });
                });
                assert.ok(layout.every(item => item.left >= -1 && item.right <= 1 && item.font >= 13.6), JSON.stringify({ width, sidebar, layout }));
            }
        }
        await page.setViewportSize({ width: 1280, height: 720 });
        await page.locator('#content').evaluate(node => { node.style.marginLeft = '0'; node.style.width = '100%'; });
        await page.locator('#employeeImportTrackingStart').fill('2026-01-01');
        assert.equal(await page.locator('#employeeImportSource, #employeeImportEvidence').count(), 0);
        await page.locator('#employeeImportPreviewBtn').click();
        await page.getByText('Επιβεβαιώστε ως διαχειριστής την πραγματική έναρξη παρακολούθησης.', { exact: false }).first().waitFor();
        await page.evaluate(async () => Promise.all(Swal.getPopup().getAnimations().map(animation => animation.finished)));
        await page.screenshot({ path: '/tmp/payroll-import-preview-chromium.png' });
        assert.equal(requests.length, 1); assert.equal(requests[0].correction.intent, 'VERIFY_IMPORT');
        assert.deepEqual(Object.keys(requests[0].correction.facts), ['trackingStartDate']);
        assert.equal(requests[0].correction.confirmation, null);
        assert.deepEqual(db.state(), before);
        await page.getByRole('button', { name: 'Ακύρωση', exact: true }).click();
        assert.deepEqual(db.state(), before); assert.equal(requests.length, 1);
    } finally { await browser.close(); }
});
