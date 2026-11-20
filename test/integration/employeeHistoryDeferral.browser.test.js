'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module');
// Reuse the offline harness executing the entire production Save function.
// Every URL is fulfilled locally by Playwright; no dev server is started.
const filename = path.join(__dirname, '../../public/js/ergazomenoi/genika/putFieldValues.historyGuidance.browser.test.js');
const m = new Module(filename, module); m.filename = filename; m.paths = Module._nodeModulePaths(path.dirname(filename));
const source = fs.readFileSync(filename, 'utf8');
m._compile(source.slice(0, source.indexOf('for (const [label, options]')) + '\nmodule.exports={withPage,save};', filename);
const { withPage, save } = m.exports;
const preview = { success: true, preflight: true, status: 'MISSING_REQUIRED_HISTORY_FIELDS', decision: 'DEFER_HISTORY',
    historyConfirmation: 'synthetic-server-confirmation', missingFields: [
        { field: 'krathsh_01', label: 'ΚΠΚ <img src=x onerror="window.xss=1">', group: 'Ασφάλιση', reason: 'Δεν έχει καταγραφεί.' },
        { field: 'ores_ergasias_ebdomadas', label: 'Ώρες εβδομάδας', group: 'Όροι απασχόλησης', reason: 'Δεν έχουν καταγραφεί.' }] };
const committed = { success: true, employeeUpdated: true, historyUpdated: false, historyDeferred: true,
    historyAccessMode: 'READ_ONLY', historyStatus: 'PENDING_EMPLOYEE_RECONCILIATION', externalActionsAllowed: true,
    idempotencyKey: 'synthetic-server-action-identity', message: 'Ο εργαζόμενος αποθηκεύτηκε. Το Ιστορικό παραμένει σε εκκρεμότητα.',
    data: { _id: 'synthetic-employee', kodikos: '0031' }, contractPdf: { skipped: true }, pdfResults: [] };

test('Correction 3 Chromium: Return is read only, safe missing-field Swal fits available width/height', { timeout: 60000 }, async () => {
    await withPage({ payload: preview }, async ({ page, requests }) => {
        await save(page); await page.waitForFunction(() => Swal.getTitle()?.textContent === 'Λείπουν στοιχεία του Ιστορικού');
        assert.equal(requests.length, 1); assert.equal(requests[0].body.historyPreflight, true);
        assert.equal(await page.locator('.swal2-confirm').textContent(), 'Συνέχεια');
        assert.equal(await page.locator('.swal2-cancel').textContent(), 'Επιστροφή για διόρθωση');
        assert.equal(await page.locator('.swal2-html-container img').count(), 0);
        assert.equal(await page.evaluate(() => window.xss), undefined);
        for (const [width,height] of [[1920,1080], [1280,720], [800,600], [480,640]]) {
            await page.setViewportSize({ width,height });
            const geometry = await page.locator('.swal2-popup.employee-history-deferral-popup').evaluate(popup => {
                const bounds = element => {
                    const r = element.getBoundingClientRect();
                    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom,
                        width: r.width, height: r.height };
                };
                const actions = popup.querySelector('.swal2-actions');
                return { popup: bounds(popup), actions: bounds(actions),
                    buttons: [...actions.querySelectorAll('button')].filter(button =>
                        getComputedStyle(button).display !== 'none').map(bounds),
                    content: bounds(popup.querySelector('.swal2-html-container')) };
            });
            const inside = rect => rect.left >= -1 && rect.top >= -1 &&
                rect.right <= width + 1 && rect.bottom <= height + 1;
            assert.ok(inside(geometry.popup) && inside(geometry.actions) &&
                geometry.buttons.every(inside),
                `Responsive Swal ${width}x${height}: ${JSON.stringify(geometry)}`);
        }
        await page.locator('.swal2-cancel').click(); await page.waitForFunction(() => window.saveFinished);
        assert.equal(requests.length, 1); assert.equal(await page.locator('#email').inputValue(), 'entered@example.test');
    });
});
test('Correction 3 Chromium: Continue reaches existing success continuation while unrelated READ_ONLY remains stopped', { timeout: 60000 }, async () => {
    await withPage({ replies: [{ status: 200, payload: preview }, { status: 200, payload: committed }] }, async ({ page, requests }) => {
        await save(page); await page.waitForFunction(() => Swal.getTitle()?.textContent === 'Λείπουν στοιχεία του Ιστορικού');
        await page.locator('.swal2-confirm').click();
        await page.locator('#employeeDeferredHistorySaveStatus').waitFor();
        assert.equal(requests.length, 2); assert.equal(requests[1].body.historyDecision, 'DEFER_HISTORY');
        assert.deepEqual(requests[1].body.filesToUpdate, requests[0].body.filesToUpdate);
        assert.equal(await page.locator('#employeeLegacyHistorySaveStatus').count(), 0);
        assert.equal(await page.evaluate(() => window.employeeHistoryExternalActionKey), committed.idempotencyKey);
        await page.waitForFunction(() => window.guidedCounts.successContinuation > 0 || window.saveFinished);
    });
});
