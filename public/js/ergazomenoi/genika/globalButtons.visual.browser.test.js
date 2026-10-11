'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ejs = require('ejs');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../../../..');
const source = fs.readFileSync(path.join(__dirname, 'putFieldValues.js'), 'utf8');
const helpers = source.slice(0, source.indexOf("document.addEventListener('DOMContentLoaded'"));
const successStart = source.indexOf('const showSuccessSwal = async () => {');
const successEnd = source.indexOf('\n                    };', successStart) + 23;
const successFunction = source.slice(successStart, successEnd);
const origin = 'http://127.0.0.1:5001';

async function capture(page, name, width) {
    if (!process.env.PAYROLL_VISUAL_ARTIFACT_DIR) return;
    fs.mkdirSync(process.env.PAYROLL_VISUAL_ARTIFACT_DIR, { recursive: true });
    await page.screenshot({ path: path.join(process.env.PAYROLL_VISUAL_ARTIFACT_DIR, `${name}-${width}.png`), animations: 'disabled' });
}

async function fixture(width, work) {
    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage({ viewport: { width, height: 1000 } });
        const requests = [], errors = [];
        page.on('pageerror', error => errors.push(error.message));
        const employeeFooter = await ejs.renderFile(path.join(root,
            'views/ergazomenoi/ergazomenoi/partials/edit/cardFooters/cardFooter_Edit.ejs'));
        const companyFooter = await ejs.renderFile(path.join(root,
            'views/companies/genikastoixeia/partials/edit/cardFooter.ejs'));
        // Real shared styles and real form partials; every network request is
        // intercepted, including unwanted writes and external resources.
        await page.route('**/*', route => {
            requests.push({ url: route.request().url(), method: route.request().method() });
            if (route.request().url() !== `${origin}/__visual_buttons__`)
                return route.abort();
            return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html lang="el">
                <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
                <body><div id="visual-workspace" style="padding:12px; height:100vh; overflow:auto">
                <h1>Στοιχεία εργαζομένου</h1><form>${employeeFooter}</form>
                <h2>Στοιχεία εταιρείας</h2>${companyFooter}
                <h2>Ενέργειες πίνακα</h2><div class="table-responsive"><table class="table"><tbody><tr><td>Δοκιμή</td><td>
                    <button class="btn btn-sm btn-success" id="table-save">Αποθήκευση</button>
                    <button class="btn btn-sm btn-danger" id="table-delete">Διαγραφή</button>
                    <button class="btn btn-sm" disabled id="disabled">Έλεγχος / Διόρθωση</button>
                </td></tr></tbody></table></div>
                <div id="policyPreviewGroupsContainer"><button class="btn btn-warning" id="policy">Έλεγχος Ιστορικού</button></div>
                <div id="variants" class="d-flex flex-wrap gap-2 mt-3">
                    ${['primary', 'success', 'danger', 'warning', 'info', 'secondary', 'brown', 'orange', 'green', 'light', 'dark', 'refresh-custom', 'message-custom']
                        .map(variant => `<button class="btn btn-${variant} rounded-4" id="variant-${variant}">Ενέργεια</button>`).join('')}
                    <button id="plain">Έλεγχος Ιστορικού</button>
                    <input type="submit" value="Αποθήκευση" id="input-submit">
                    <a class="btn btn-success disabled" aria-disabled="true" id="disabled-link">Επιστροφή</a>
                </div>
                <div class="card rounded-4 mt-3" id="unrelated-card">Κάρτα</div>
                <a href="#" id="plain-link">Σύνδεσμος κειμένου</a>
                <button class="nav-link active" role="tab" id="tab">Στοιχεία</button>
                <button hidden id="hidden">Κρυφό</button>
                <div class="pdf-modal-footer mt-3"><button class="btn btn-secondary" id="cancelPdfUpload">Ακύρωση</button>
                    <a class="btn btn-info" href="#" id="pdf-link">Λήψη & Αποστολή</a></div>
                </div></body></html>` });
        });
        await page.goto(`${origin}/__visual_buttons__`);
        for (const file of ['public/css/bootstrap.min.css', 'node_modules/sweetalert2/dist/sweetalert2.css', 'public/css/main.css'])
            await page.addStyleTag({ path: path.join(root, file) });
        if (process.env.PAYROLL_VISUAL_ICON_CSS && process.env.PAYROLL_VISUAL_ICON_FONT) {
            const font = fs.readFileSync(process.env.PAYROLL_VISUAL_ICON_FONT).toString('base64');
            const css = fs.readFileSync(process.env.PAYROLL_VISUAL_ICON_CSS, 'utf8')
                .replace(/url\("[^"]+"\)/g, `url("data:font/woff2;base64,${font}")`);
            await page.addStyleTag({ content: css });
            await page.evaluate(() => document.fonts.ready);
        } else {
            // Offline CI checks the same icon box using inline vector glyphs.
            await page.locator('.bi').evaluateAll(icons => icons.forEach(icon => {
                icon.innerHTML = '<svg width="1em" height="1em" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 1 1 8l7 7v-4h7V5H8z"/></svg>';
            }));
        }
        await page.addScriptTag({ path: path.join(root, 'node_modules/sweetalert2/dist/sweetalert2.all.js') });
        await page.addScriptTag({ content: helpers + `
            const originalFire = Swal.fire.bind(Swal);
            Swal.fire = options => originalFire({ ...withEmployeeMaintenanceButtonStyles(options),
                showClass: { popup: '' }, hideClass: { popup: '' } });
            const data = { historyUpdated: true };
            const successfulPdfs = [];
            const e3XmlHtml = '', e3RestPendingHtml = '', e7RestPendingHtml = '', e5RestPendingHtml = '',
                e6nRestPendingHtml = '', e6nXmlPendingHtml = '', wtoRestPendingHtml = '', wtoXmlHtml = '';
            const hasE3Xml = false, hasWtoXml = false, hasMAXml = false, isE6NRestSubmit = false, isE6NXmlSubmit = false;
            ${successFunction}
            window.showSaveSuccess = showSuccessSwal;
        ` });
        await work(page);
        assert.deepEqual(errors, []);
        assert.deepEqual(requests, [{ url: `${origin}/__visual_buttons__`, method: 'GET' }]);
    } finally { await browser.close(); }
}

async function geometry(element) {
    return element.evaluate(e => {
        const s = getComputedStyle(e), r = e.getBoundingClientRect();
        return { display: s.display, align: s.alignItems, justify: s.justifyContent, whiteSpace: s.whiteSpace,
            radius: parseFloat(s.borderTopLeftRadius), background: s.backgroundColor, color: s.color,
            border: s.borderTopColor, padding: s.padding, fontSize: s.fontSize, lineHeight: s.lineHeight,
            height: r.height, width: r.width, left: r.left, right: r.right, scrollWidth: e.scrollWidth, clientWidth: e.clientWidth };
    });
}

for (const width of [1440, 390]) {
    test(`global buttons: forms, table, links, variants and legacy overrides at ${width}px`, async () => {
        await fixture(width, async page => {
            const selectors = ['form .submitButton', 'form a.btn', '.clearButton', '#table-save', '#table-delete', '#policy',
                '#plain', '#input-submit', '#cancelPdfUpload', '#pdf-link',
                ...['primary', 'success', 'danger', 'warning', 'info', 'secondary', 'brown', 'orange', 'green', 'light', 'dark', 'refresh-custom', 'message-custom'].map(v => `#variant-${v}`)];
            for (const selector of selectors) {
                const element = page.locator(selector).first();
                await element.scrollIntoViewIfNeeded();
                await page.mouse.move(0, 0);
                await page.waitForTimeout(180);
                const before = await geometry(element);
                assert.ok(['flex', 'inline-flex'].includes(before.display), selector);
                assert.equal(before.align, 'center', selector);
                assert.equal(before.justify, 'center', selector);
                assert.equal(before.whiteSpace, 'nowrap', selector);
                assert.equal(before.radius, 6, selector);
                assert.equal(before.color, before.border, selector);
                assert.notEqual(before.background, before.color, selector);
                assert.ok(parseFloat(before.fontSize) >= 14, selector);
                assert.ok(before.left >= 0 && before.right <= width, `${selector}: viewport overflow ${JSON.stringify(before)}`);
                assert.ok(before.scrollWidth <= before.clientWidth + 1, `${selector}: clipped label`);
                await element.hover(); await page.waitForTimeout(180);
                const hover = await geometry(element);
                assert.equal(hover.background, before.color, selector);
                assert.equal(hover.color, 'rgb(255, 255, 255)', selector);
                assert.equal(hover.height, before.height, selector);
                assert.equal(hover.width, before.width, selector);
                await page.keyboard.press('Tab'); await element.focus();
                assert.equal(await element.evaluate(e => getComputedStyle(e).outlineStyle), 'solid', selector);
                await page.mouse.down();
                assert.equal((await geometry(element)).height, before.height, selector);
                await page.mouse.move(0, 0); await page.mouse.up();
            }
            const button = await geometry(page.locator('form .submitButton'));
            const anchor = await geometry(page.locator('form a.btn'));
            for (const prop of ['height', 'padding', 'fontSize', 'lineHeight', 'radius']) assert.equal(button[prop], anchor[prop], prop);
            for (const selector of ['form .submitButton', 'form a.btn']) {
                const offsets = await page.locator(selector).evaluate(e => {
                    const icon = e.querySelector('i').getBoundingClientRect(), box = e.getBoundingClientRect();
                    const text = [...e.childNodes].find(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim());
                    const range = document.createRange(); range.selectNodeContents(text);
                    const label = range.getBoundingClientRect();
                    return { icon: Math.abs((icon.top + icon.bottom - box.top - box.bottom) / 2),
                        label: Math.abs((label.top + label.bottom - box.top - box.bottom) / 2) };
                });
                assert.ok(offsets.icon <= 1 && offsets.label <= 2, `${selector}: ${JSON.stringify(offsets)}`);
            }
            for (const selector of ['#disabled', '#disabled-link']) {
                const element = page.locator(selector);
                const before = await geometry(element);
                // aria-disabled links can intentionally block pointer events.
                const box = await element.boundingBox();
                await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
                await page.waitForTimeout(180);
                assert.equal((await geometry(element)).background, before.background);
                assert.equal(before.background, 'rgb(233, 236, 239)');
            }
            assert.equal(await page.locator('#hidden').isVisible(), false);
            assert.equal(await page.locator('.scroll-to-top').isVisible(), false);
            assert.notEqual(await page.locator('#unrelated-card').evaluate(e => getComputedStyle(e).borderRadius), '6px');
            assert.notEqual(await page.locator('#plain-link').evaluate(e => getComputedStyle(e).display), 'inline-flex');
            await page.locator('form').scrollIntoViewIfNeeded();
            await page.mouse.move(0, 0);
            await page.evaluate(() => document.activeElement.blur());
            await capture(page, 'global-buttons', width);
            await page.locator('form .submitButton').hover(); await page.waitForTimeout(180);
            await capture(page, 'global-button-hover', width);
        });
    });

    test(`actual successful Save HTML sizes to content and owns the 2000ms delay at ${width}px`, async () => {
        await fixture(width, async page => {
            await page.clock.install();
            await page.clock.pauseAt(new Date());
            await page.evaluate(() => {
                window.redirects = 0;
                void window.showSaveSuccess().then(() => { window.redirects++; });
            });
            await page.clock.runFor(250);
            const popup = page.locator('.swal2-popup');
            assert.equal(await page.locator('.swal2-title').innerText(), 'Επιτυχής καταχώριση!');
            assert.equal(await page.locator('.swal2-html-container').innerText(),
                'Η αποθήκευση ολοκληρώθηκε. Ενημερώθηκαν τα στοιχεία του εργαζομένου και το Ιστορικό.');
            const sizes = await popup.evaluate(e => {
                const s = getComputedStyle(e), box = e.getBoundingClientRect();
                const content = e.querySelector('.swal2-html-container').getBoundingClientRect();
                return { height: box.height, bottomGap: box.bottom - content.bottom, minHeight: s.minHeight,
                    whiteSpace: getComputedStyle(e.querySelector('.swal2-html-container')).whiteSpace,
                    left: box.left, right: box.right };
            });
            assert.equal(sizes.minHeight, '0px'); assert.equal(sizes.whiteSpace, 'normal');
            assert.ok(sizes.bottomGap <= 40, JSON.stringify(sizes));
            assert.ok(sizes.height < 430, JSON.stringify(sizes));
            assert.ok(sizes.left >= 0 && sizes.right <= width);
            assert.equal(await page.locator('.swal2-actions').isVisible(), false);
            await capture(page, 'actual-save-success', width);
            await page.keyboard.press('Escape');
            await page.clock.runFor(1749);
            assert.equal(await page.evaluate(() => window.redirects), 0);
            assert.equal(await popup.isVisible(), true);
            await page.clock.runFor(1);
            assert.equal(await page.evaluate(() => window.redirects), 1);
            await page.clock.runFor(2500);
            assert.equal(await page.evaluate(() => window.redirects), 1);

            for (const response of [{ status: 200, ok: true }, { status: 302, ok: false }]) {
                await page.evaluate(({ response, origin }) => {
                    window.redirects = 0;
                    void showEmployeeSaveRedirectNotice(response, '/ergazomenoi/ergazomenoi', Swal, origin)
                        .then(() => { window.redirects++; });
                }, { response, origin });
                await page.clock.runFor(1999);
                assert.equal(await page.evaluate(() => window.redirects), 0);
                await page.clock.runFor(1);
                assert.equal(await page.evaluate(() => window.redirects), 1);
            }
            for (const destination of ['/login', 'https://other.test/ergazomenoi/ergazomenoi']) {
                await page.evaluate(({ destination, origin }) =>
                    showEmployeeSaveRedirectNotice({ status: 200, ok: true }, destination, Swal, origin), { destination, origin });
                assert.equal(await page.locator('.swal2-popup').isVisible(), false);
            }

            for (const options of [{ icon: 'error', title: 'Η αποθήκευση σταμάτησε', text: 'Δεν αποθηκεύτηκε καμία αλλαγή.' },
                { icon: 'question', title: 'Επιβεβαίωση', text: 'Θέλετε να συνεχίσετε;', showCancelButton: true },
                { icon: 'success', title: 'Επιτυχής καταχώριση!', showConfirmButton: true, timer: undefined }]) {
                await page.evaluate(options => {
                    void Swal.fire(options.icon === 'success' ? employeeSaveSuccessOptions(options) : options);
                }, options);
                await page.clock.runFor(5000);
                assert.equal(await page.locator('.swal2-popup').isVisible(), true);
                assert.equal(await page.evaluate(() => Swal.getTimerLeft()), undefined);
                await page.evaluate(() => Swal.close());
            }
        });
    });
}
