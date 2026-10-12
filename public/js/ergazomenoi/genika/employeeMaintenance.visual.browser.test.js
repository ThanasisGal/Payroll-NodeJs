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
            await verifyChoice(page, 'employeeHistoryReconstructionApprovalAccepted');
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

// Render the actual production templates, including every optional ERGANI choice.
// No save or submission handler is invoked by these presentation-only checks.
for (const width of [1440, 390]) for (const implementation of ['putFieldValues', 'getFieldValues'])
    test(`choice geometry and label interaction: ${implementation} at ${width}px`, async () => {
        const vm = require('node:vm');
        const production = fs.readFileSync(path.join(__dirname, `${implementation}.js`), 'utf8');
        const section = production.slice(production.indexOf('// ✅ ΕΡΓΑΝΗ FILES SELECTION'));
        const template = section.match(/html: `([\s\S]*?)`,\s*focusConfirm:/)[1];
        const optional = {};
        for (const name of ['metabolesHtml', 'lhxeisHtml', 'noUpdatesHtml']) {
            const match = section.match(new RegExp('const ' + name + ' = [\\s\\S]*?\\? `([\\s\\S]*?)`'));
            optional[name] = match ? match[1] : '';
        }
        const browser = await chromium.launch({ headless: true });
        try {
            const page = await browser.newPage({ viewport: { width, height: 1000 } });
            await page.route('**/*', route => route.abort());
            await page.setContent('<!doctype html><html lang="el"><meta charset="utf-8"><body></body></html>');
            for (const file of ['public/css/bootstrap.min.css', 'public/css/main.css', 'node_modules/sweetalert2/dist/sweetalert2.css'])
                await page.addStyleTag({ path: path.join(root, file) });
            await page.addScriptTag({ path: path.join(root, 'node_modules/sweetalert2/dist/sweetalert2.all.js') });
            await page.addScriptTag({ content: helpers });
            for (const disabled of implementation === 'getFieldValues' ? [false, true] : [false]) {
                const html = vm.runInNewContext('`' + template + '`', { ...optional, skipScheduleValidation: disabled });
                await page.evaluate(({ html, implementation }) => {
                    const options = { icon: 'info', title: 'ΕΝΗΜΕΡΩΣΗ ΕΡΓΑΝΗ ΙΙ', html, didOpen() {} };
                    void Swal.fire(implementation === 'putFieldValues' ? withEmployeeMaintenanceButtonStyles(options) : options);
                }, { html, implementation });
                await page.waitForTimeout(350);
                const inputs = page.locator('.swal2-html-container input');
                assert.ok(await inputs.count() >= 6);
                for (const input of await inputs.all()) {
                    const id = await input.getAttribute('id');
                    await verifyChoice(page, id);
                }
                if (disabled) {
                    assert.equal(await page.locator('#storage_temporary').isDisabled(), true);
                    assert.equal(await page.locator('#storage_permanent').isDisabled(), true);
                }
                if (process.env.PAYROLL_VISUAL_ARTIFACT_DIR) {
                    fs.mkdirSync(process.env.PAYROLL_VISUAL_ARTIFACT_DIR, { recursive: true });
                    await page.locator('#storage_temporary').scrollIntoViewIfNeeded();
                    await page.screenshot({ path: path.join(process.env.PAYROLL_VISUAL_ARTIFACT_DIR,
                        `alignment-${implementation}-${disabled ? 'disabled-' : ''}${width}.png`) });
                }
                await page.evaluate(() => Swal.close());
            }
        } finally { await browser.close(); }
    });

async function verifyChoice(page, id) {
    const input = page.locator(`#${id}`);
    const label = page.locator(`label[for="${id}"]`);
    assert.equal(await label.count(), 1, `${id}: associated label`);
    await input.scrollIntoViewIfNeeded();
    const geometry = await input.evaluate(input => {
        const label = input.labels[0], i = input.getBoundingClientRect(), l = label.getBoundingClientRect();
        const style = getComputedStyle(input), ls = getComputedStyle(label);
        const walker = document.createTreeWalker(label, NodeFilter.SHOW_TEXT);
        const textNodes = [];
        while (walker.nextNode()) if (walker.currentNode.textContent.trim()) textNodes.push(walker.currentNode);
        const range = document.createRange(), first = textNodes[0], last = textNodes.at(-1);
        range.setStart(first, first.textContent.search(/\S/));
        range.setEnd(last, last.textContent.trimEnd().length);
        const text = range.getBoundingClientRect();
        return { textDelta: Math.abs(i.y + i.height / 2 - text.y - text.height / 2),
            delta: Math.abs(i.y + i.height / 2 - l.y - l.height / 2),
            gap: l.x - i.right, width: i.width, height: i.height,
            marginTop: style.marginTop, marginBottom: style.marginBottom,
            alignSelf: style.alignSelf, labelDisplay: ls.display, labelAlign: ls.alignItems,
            labelMarginTop: ls.marginTop, labelMarginBottom: ls.marginBottom, lineHeight: ls.lineHeight, whiteSpace: ls.whiteSpace,
            right: l.right, viewport: innerWidth };
    });
    assert.ok(geometry.textDelta <= 1, `${id}: text center ${JSON.stringify(geometry)}`);
    assert.ok(geometry.delta <= 1, `${id}: ${JSON.stringify(geometry)}`);
    // Chromium rectangle coordinates can differ by a fraction of a CSS pixel.
    assert.ok(Math.abs(geometry.gap - 12) <= 0.05, `${id}: original gap ${geometry.gap}px`);
    assert.equal(geometry.width, 20); assert.equal(geometry.height, 20);
    assert.equal(geometry.marginTop, '0px'); assert.equal(geometry.marginBottom, '0px');
    assert.equal(geometry.labelMarginTop, '0px'); assert.equal(geometry.labelMarginBottom, '0px');
    assert.equal(geometry.whiteSpace, 'normal');
    assert.equal(geometry.alignSelf, 'center'); assert.equal(geometry.labelAlign, 'center');
    assert.equal(geometry.labelDisplay, 'flex'); // inline-flex is blockified as a flex item
    assert.ok(geometry.right <= geometry.viewport, `${id}: label overflow ${JSON.stringify(geometry)}`);
    const checked = await input.isChecked(), disabled = await input.isDisabled();
    await label.click({ force: disabled });
    assert.equal(await input.isChecked(), disabled ? checked : await input.getAttribute('type') === 'radio' ? true : !checked);
    assert.equal(await input.isDisabled(), disabled);
    console.log(JSON.stringify({ id, viewport: geometry.viewport, centerDeltaPx: geometry.delta, disabled }));
}
