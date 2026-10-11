'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ejs = require('ejs');
const { chromium } = require('playwright');
const F = require('../../../../server/services/ergazomenoi/fixtures/automaticEmployeeHistoryReconstructionFixtures');
const { planEmployeeHistoryAutomaticReconstruction } = require('../../../../server/services/ergazomenoi/employeeHistoryAutomaticReconstructionPlannerService');
const { buildEmployeeHistoryReconstructionPreview } = require('../../../../server/services/ergazomenoi/employeeHistoryReconstructionPreviewService');
const { profileError } = require('../../../../server/utils/ergazomenoi/employmentProfileMaintenance');
const root = path.resolve(__dirname, '../../../..');
const source = fs.readFileSync(path.join(__dirname, 'putFieldValues.js'), 'utf8');
const helpers = source.slice(0, source.indexOf("document.addEventListener('DOMContentLoaded'"));
function response(error) {
    let body;
    profileError({ status() { return this; }, json(value) { body = value; } }, error,
        { employeeSaveActionRequired: true });
    return body;
}
const manual = response({ code: 'EMPLOYEE_HISTORY_MANUAL_REVIEW_REQUIRED', statusCode: 409 });
const overlap = response({ code: 'CONFLICT_OVERLAP', statusCode: 409, overlapPeriods: {
    proposed: { from: '2026-07-20', until: '2026-10-04' },
    conflicting: [{ from: '2026-06-27', until: '2026-07-22' }] } });

for (const width of [1440, 390]) test(`visual Employee Maintenance and History at ${width}px, synthetic network only`, async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage({ viewport: { width, height: 1000 } });
        const errors = [], mutations = [];
        page.on('pageerror', error => errors.push(error.message));
        const fixture = F.caseA();
        const preview = buildEmployeeHistoryReconstructionPreview({
            plan: planEmployeeHistoryAutomaticReconstruction(fixture), completeHistoryRows: fixture.completeHistoryRows });
        const partial = await ejs.renderFile(path.join(root,
            'views/ergazomenoi/ergazomenoi/partials/edit/cardBodies/section7/istoriko.ejs'), {
            ergazomenoiData: fixture.currentEmployee, istorikoData: fixture.completeHistoryRows,
            employeeHistoryAccessMode: 'ADMIN_FULL', employeeHistoryStateToken: 'synthetic', problematicHistoryIds: [] });
        await page.route('https://payroll.test/**', route => {
            if (route.request().method() !== 'GET') mutations.push(route.request().url());
            return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html lang="el"><meta charset="utf-8">
                <body><div class="menu_Links"><ul><li>Στοιχεία εργαζομένου</li><li>Ιστορικό Προσλήψεων/Αλλαγών</li></ul></div>
                <div class="cardFooter01"><button class="submitButton">Αποθήκευση</button></div>${partial}</body></html>` });
        });
        await page.goto('https://payroll.test/');
        for (const file of ['public/css/bootstrap.min.css', 'node_modules/sweetalert2/dist/sweetalert2.css', 'public/css/main.css'])
            await page.addStyleTag({ path: path.join(root, file) });
        for (const file of ['public/js/bootstrap.bundle.min.js', 'node_modules/sweetalert2/dist/sweetalert2.all.js',
            'public/js/ergazomenoi/genika/employeeHistoryReconstructionPreview.js'])
            await page.addScriptTag({ path: path.join(root, file) });
        await page.addScriptTag({ content: helpers + `
            const originalFire = Swal.fire.bind(Swal);
            Swal.fire = options => originalFire(withEmployeeMaintenanceButtonStyles(withCompactOrdinarySwalClasses(options)));
            document.dispatchEvent(new Event('DOMContentLoaded'));
        ` });
        const capture = async name => {
            if (!process.env.PAYROLL_VISUAL_ARTIFACT_DIR) return;
            fs.mkdirSync(process.env.PAYROLL_VISUAL_ARTIFACT_DIR, { recursive: true });
            await page.waitForTimeout(250);
            await page.screenshot({ path: path.join(process.env.PAYROLL_VISUAL_ARTIFACT_DIR, `${name}-${width}.png`), fullPage: false });
        };
        const button = async selector => {
            const element = page.locator(selector).first();
            await element.scrollIntoViewIfNeeded();
            await page.mouse.move(0, 0);
            await page.waitForTimeout(250);
            const before = await element.evaluate(e => {
                const style = getComputedStyle(e), box = e.getBoundingClientRect();
                const range = document.createRange(); range.selectNodeContents(e);
                const probe = document.createElement('span');
                probe.style.backgroundColor = style.getPropertyValue('--maintenance-light');
                document.body.appendChild(probe);
                const expectedBackground = getComputedStyle(probe).backgroundColor;
                probe.remove();
                return { expectedBackground, borderColor: style.borderTopColor, whiteSpace: style.whiteSpace, background: style.backgroundColor,
                    color: style.color, lineHeight: parseFloat(style.lineHeight), labelHeight: range.getBoundingClientRect().height,
                    left: box.left, right: box.right, scrollWidth: e.scrollWidth, clientWidth: e.clientWidth };
            });
            assert.equal(before.whiteSpace, 'nowrap', selector);
            assert.equal(before.background, before.expectedBackground, `${selector}: default must be light`);
            assert.equal(before.color, before.borderColor, `${selector}: semantic border and text`);
            assert.ok(before.scrollWidth <= before.clientWidth + 1, `${selector}: clipped label`);
            assert.ok(before.labelHeight < before.lineHeight * 1.5, `${selector}: wrapped label`);
            assert.ok(before.left >= 0 && before.right <= width, `${selector}: viewport overflow`);
            await element.hover();
            await page.waitForTimeout(200);
            const after = await element.evaluate(e => ({ background: getComputedStyle(e).backgroundColor, color: getComputedStyle(e).color }));
            assert.notEqual(after.background, before.background, `${selector}: missing hover background`);
            assert.equal(after.color, 'rgb(255, 255, 255)', `${selector}: hover contrast`);
            await page.mouse.move(0, 0);
        };
        await button('.submitButton');
        await button('#employeeHistoryReconstructionPreviewBtn');
        for (const historyUpdated of [false, true]) {
            await page.evaluate(historyUpdated => {
                void Swal.fire({ icon: 'info', title: 'Η αποθήκευση ολοκληρώθηκε',
                    text: employeeMaintenanceSuccessMessage({ historyUpdated }), confirmButtonText: 'Κλείσιμο' });
            }, historyUpdated);
            await button('.swal2-confirm');
            const text = await page.locator('.swal2-html-container').innerText();
            assert.match(text, /Ενημερώθηκαν τα στοιχεία του εργαζομένου/);
            assert.equal(text.includes('και το Ιστορικό'), historyUpdated);
            await capture(historyUpdated ? 'employee-history-success' : 'employee-success');
            await page.locator('.swal2-confirm').click();
        }
        for (const operation of [null, 'FIRST_DEPARTURE']) {
            await page.evaluate(({ preview, operation }) => {
                window.previewResult = null;
                void window.employeeHistoryReconstructionPreview.approveForSave({ preview, token: 'a'.repeat(43), operation })
                    .then(value => { window.previewResult = value; });
            }, { preview, operation });
            await page.locator('#employeeHistoryReconstructionPreviewModal.show').waitFor();
            await page.waitForTimeout(350);
            const apply = page.locator('#employeeHistoryReconstructionApplyBtn');
            assert.equal(await apply.isDisabled(), true);
            await page.locator('#employeeHistoryReconstructionApprovalAccepted').check();
            await button('#employeeHistoryReconstructionApplyBtn');
            await button('#employeeHistoryReconstructionPreviewModal .modal-footer [data-bs-dismiss]');
            await capture(operation ? 'first-departure-preview' : 'reconstruction-preview');
            await page.locator('#employeeHistoryReconstructionPreviewModal .modal-footer [data-bs-dismiss]').click();
            await page.waitForFunction(() => window.previewResult === false);
            assert.equal(await page.locator('#employeeHistoryReconstructionApprovalAccepted').isChecked(), false);
            await capture('cancelled-preview');
        }
        await page.evaluate(manual => {
            void handleEmployeeSaveHistoryAction({ status: 200, ok: true }, manual, { swal: Swal, documentRef: document });
        }, manual);
        await page.locator('.swal2-popup').waitFor();
        await button('.swal2-confirm'); await capture('manual-fallback');
        assert.match(await page.locator('.swal2-html-container').innerText(), /1\.[\s\S]*2\./);
        await page.locator('.swal2-confirm').click();
        await page.evaluate(() => {
            void handleEmployeeSaveHistoryStale({ status: 409 }, { success: false,
                reason: 'EMPLOYEE_HISTORY_AUTOMATIC_RECONSTRUCTION_STALE',
                message: 'Τα στοιχεία άλλαξαν. Δεν αποθηκεύτηκε καμία αλλαγή.\n1. Κλείστε το μήνυμα.\n2. Πατήστε ξανά «Αποθήκευση» για νέο έλεγχο.' }, { swal: Swal });
        });
        await button('.swal2-confirm'); await capture('stale-preview');
        await page.locator('.swal2-confirm').click();
        await page.evaluate(overlap => {
            void Swal.fire({ icon: 'warning', title: 'Ελέγξτε τις ημερομηνίες', text: overlap.message, confirmButtonText: 'Κλείσιμο' });
        }, overlap);
        await button('.swal2-confirm'); await capture('overlap');
        assert.match(await page.locator('.swal2-html-container').innerText(), /20\/07\/2026–04\/10\/2026[\s\S]*27\/06\/2026–22\/07\/2026/);
        assert.deepEqual(mutations, []); assert.deepEqual(errors, []);
    } finally { await browser.close(); }
});
