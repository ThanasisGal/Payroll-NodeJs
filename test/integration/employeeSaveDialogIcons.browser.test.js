'use strict';

// Presentation only: real Employee dialog functions + the edit-page wrapper.
// Every URL is intercepted; no application, database or save endpoint starts.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ejs = require('ejs');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const layout = read('views/layouts/main.ejs');
const edit = read('views/ergazomenoi/ergazomenoi/edit.ejs');
const app = read('app.js');
const ui = read('public/js/ergazomenoi/genika/putFieldValues.js');
const helpers = ui.slice(0, ui.indexOf("document.addEventListener('DOMContentLoaded'"));
const cssStart = app.indexOf('app.locals.css = ');
const cssEnd = app.indexOf('\n};', cssStart) + 3;
const css = vm.runInNewContext(app.slice(cssStart, cssEnd).replace('app.locals.css = ', ''),
    { node_env: 'development', cssVersion: 'isolated-icon-check' });
const cssLink = ejs.render(layout.match(/<link rel="stylesheet" href="<%= css\('main'\) %>" \/>/)[0], { css });
const mainClass = layout.match(/<main class="([^"]+)"/)[1];
const pageClass = edit.match(/^<div class="([^"]+)"/)[1];
assert.ok(edit.includes("script('ergazomenoi/genika/employeeAddPresentation')"));
const titles = ['Είδος ιστορικής ενέργειας', 'Ημερομηνία ισχύος της πραγματικής μεταβολής', 'Προεπισκόπηση αποθήκευσης'];

test('Employee edit wrapper: choice/date/preview icons fit inside the real popup', { timeout: 60000 }, async () => {
    const browser = await chromium.launch({ headless: true });
    const records = [], controls = [], errors = [];
    const artifactDir = process.env.PAYROLL_SAVE_ICON_ARTIFACT_DIR;
    if (artifactDir) fs.mkdirSync(artifactDir, { recursive: true });
    try {
        for (const viewport of [{ width: 1280, height: 720 }, { width: 640, height: 480 }]) {
            const page = await browser.newPage({ viewport });
            page.setDefaultTimeout(7000);
            page.on('pageerror', error => errors.push(error.message));
            const requests = [];
            await page.route('**/*', route => {
                const request = route.request(), url = new URL(request.url());
                requests.push({ method: request.method(), pathname: url.pathname });
                if (request.method() !== 'GET') return route.abort();
                const assets = {
                    '/static/css/bootstrap.min.css': ['public/css/bootstrap.min.css', 'text/css'],
                    '/static/css/main.css': ['public/css/main.css', 'text/css'],
                    '/static/css/navTabs.css': ['public/css/navTabs.css', 'text/css'],
                    '/vendor/swal.js': ['node_modules/sweetalert2/dist/sweetalert2.all.js', 'text/javascript']
                };
                if (assets[url.pathname]) {
                    const [file, contentType] = assets[url.pathname];
                    return route.fulfill({ contentType, body: fs.readFileSync(path.join(root, file)) });
                }
                if (url.pathname !== '/ergazomenoi/ergazomenoi/edit/620000000000000000000001') return route.abort();
                return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html lang="el"><head>
                    <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
                    <link rel="stylesheet" href="/static/css/bootstrap.min.css">${cssLink}
                    <link rel="stylesheet" href="/static/css/navTabs.css"></head><body data-mode="edit" data-context="ergazomenoi">
                    <div class="container-fluid container-scroll"><div class="row">
                    <aside id="sidebar" class="col-md-3 col-lg-2"></aside>
                    <main class="${mainClass}" style="height:calc(100dvh - 4rem)">
                    <div class="${pageClass}"><div id="employeeApprovedHistoryAtomicBaseline" hidden
                    data-atomic-days="5" data-atomic-week="5HMERH" data-atomic-contract="5"
                    data-atomic-hours="40" data-atomic-daily="8"></div></div></main></div></div>
                    <script src="/vendor/swal.js"></script></body></html>` });
            });
            await page.goto('https://payroll.test/ergazomenoi/ergazomenoi/edit/620000000000000000000001');
            await page.addScriptTag({ content: helpers });
            await page.addScriptTag({ path: path.join(root, 'public/js/ergazomenoi/genika/employeeHistoryFieldLabels.js') });
            await page.addScriptTag({ path: path.join(root, 'public/js/ergazomenoi/genika/employeeApprovedHistoryAtomicSaveUi.js') });
            // Missing from the previous icon test: this removes the Maintenance
            // class, adds new-year-confirmation and moves the dialog into main.
            await page.addScriptTag({ path: path.join(root, 'public/js/ergazomenoi/genika/employeeAddPresentation.js') });
            await page.evaluate(() => document.dispatchEvent(new Event('DOMContentLoaded')));
            for (const sidebar of [true, false]) {
                await page.evaluate(open => document.getElementById('sidebar').classList.toggle('d-none', !open), sidebar);
                await page.evaluate(() => {
                    window.contextRequests = [];
                    window.iconFlow = (async () => {
                        const swal = createEmployeeSaveFeedback(window.Swal, window).dialogs;
                        const formData = { hmeres_ergasias_ebdomadas: 5, typos_ebdomadas: '5HMERH',
                            apasxolhsh_basei_symbashs: '5', ores_ergasias_ebdomadas: 30, mo_oron_hmerhsias_ergasias: 6 };
                        let change;
                        const result = await window.employeeApprovedHistoryAtomicSaveUi.tryHandle({ formData,
                            baselineNode: document.getElementById('employeeApprovedHistoryAtomicBaseline'),
                            employeeId: '620000000000000000000001', csrfToken: 'synthetic', swal,
                            onChange: value => { change = value; }, reload() { throw Error('RELOAD_FORBIDDEN'); },
                            fetcher: async (url, options) => {
                                window.contextRequests.push({ url, method: options.method });
                                if (!url.endsWith('-context')) throw Error('SAVE_FORBIDDEN');
                                return new Response(JSON.stringify({ success: true, contextOnly: true,
                                    approvedHistoryRequired: true, currentContract: '5', currentTerms: {
                                        hmeres_ergasias_ebdomadas: 5, typos_ebdomadas: '5HMERH',
                                        ores_ergasias_ebdomadas: 40, mo_oron_hmerhsias_ergasias: 8 }
                                }), { headers: { 'Content-Type': 'application/json' } });
                            } });
                        if (result.handled || !change) throw Error('DIALOG_FLOW_CHANGED');
                        return continueEmployeeSaveWithHistoryDecision({ swal, documentRef: document,
                            originalPayload: { historyPreflight: true, formData, change },
                            retryRequest() { throw Error('SAVE_FORBIDDEN'); },
                            response: new Response(JSON.stringify({ success: true, preflight: true,
                                status: 'READY_FOR_COMBINED_SAVE', decision: 'COMBINED_SAVE',
                                historyConfirmation: 'synthetic-not-used' }), { headers: { 'Content-Type': 'application/json' } })
                        });
                    })().then(result => { window.iconFlowResult = result; });
                });
                for (const [index, title] of titles.entries()) {
                    await page.waitForFunction(title => Swal.getTitle()?.textContent === title, title);
                    await page.locator('.swal2-popup').evaluate(async popup => {
                        await Promise.all(popup.getAnimations({ subtree: true })
                            .filter(a => a.effect.getComputedTiming().iterations !== Infinity)
                            .map(a => a.finished.catch(() => {})));
                    });
                    const record = await page.locator('.swal2-popup').evaluate(popup => {
                        const rect = element => { const r = element.getBoundingClientRect();
                            return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom }; };
                        const icon = popup.querySelector('.swal2-icon'), glyph = icon.querySelector('.swal2-icon-content');
                        const style = getComputedStyle(icon);
                        const fields = ['width', 'height', 'font-size', 'margin', 'position', 'top', 'transform', 'scale'];
                        const matched = [];
                        const visit = rules => { for (const rule of rules) {
                            if (rule.selectorText?.includes('swal2') && icon.matches(rule.selectorText)) {
                                const declarations = Object.fromEntries(fields.map(key => [key, rule.style.getPropertyValue(key)]).filter(([,v]) => v));
                                if (Object.keys(declarations).length) matched.push({ selector: rule.selectorText, declarations });
                            }
                            if (rule.cssRules) visit(rule.cssRules);
                        } };
                        for (const sheet of document.styleSheets) visit(sheet.cssRules);
                        return { popupClasses: popup.className, containerClasses: popup.parentElement.className,
                            previousSelectorMatches: icon.matches('.swal2-popup.employee-maintenance-swal.employee-history-deferral-popup > .swal2-icon:is(.swal2-info, .swal2-question)'),
                            popup: rect(popup), icon: rect(icon), glyph: rect(glyph), title: rect(popup.querySelector('.swal2-title')),
                            actions: rect(popup.querySelector('.swal2-actions')),
                            computed: Object.fromEntries(fields.map(key => [key, style.getPropertyValue(key)])),
                            matched, stylesheets: [...document.styleSheets].map(sheet => sheet.href).filter(Boolean) };
                    });
                    records.push({ viewport, sidebar, dialog: title, ...record });
                    if (artifactDir && sidebar) await page.screenshot({ path: path.join(artifactDir, `icon-${viewport.width}-${index}.png`) });
                    if (index === 0) {
                        await page.locator('.swal2-radio input[value="NEW_CHANGE"]').check();
                        await page.locator('.swal2-confirm').click();
                    } else if (index === 1) {
                        await page.locator('.swal2-input').fill('2026-12-01');
                        await page.locator('.swal2-confirm').click();
                    } else await page.locator('.swal2-cancel').click();
                }
                await page.evaluate(() => window.iconFlow);
                assert.equal(await page.evaluate(() => window.iconFlowResult.cancelled), true);
                assert.equal(await page.evaluate(() => window.contextRequests.length), 1);
            }
            // An ordinary icon on the same edit page keeps its existing scale.
            await page.evaluate(() => { Swal.fire({ icon: 'info', title: 'Συνθετικός έλεγχος άλλου Swal' }); });
            controls.push(await page.locator('.swal2-icon').evaluate(icon => ({
                scale: getComputedStyle(icon).scale, popupClasses: icon.parentElement.className
            })));
            assert.ok(requests.every(request => request.method === 'GET'));
            assert.ok(requests.some(request => request.pathname === '/static/css/main.css'));
            await page.close();
        }
        assert.deepEqual(errors, []);
        for (const record of records) {
            const { icon, popup, glyph, title, viewport, actions } = record;
            assert.ok(icon.width <= 41 && icon.height <= 41, JSON.stringify(record));
            assert.ok(icon.y >= popup.y + 10, JSON.stringify(record));
            assert.ok(icon.bottom + 4 <= title.y, JSON.stringify(record));
            assert.ok(glyph.y >= icon.y && glyph.bottom <= icon.bottom, JSON.stringify(record));
            assert.ok(icon.y >= 0 && icon.bottom <= viewport.height + 1, JSON.stringify(record));
            assert.ok(icon.x >= popup.x && icon.right <= popup.right, JSON.stringify(record));
            assert.ok(actions.y >= popup.y && actions.bottom <= popup.bottom + 1, JSON.stringify(record));
            assert.equal(record.computed.scale, '1');
            assert.equal(record.previousSelectorMatches, false);
            assert.ok(record.popupClasses.includes('new-year-confirmation'));
            assert.ok(record.stylesheets.some(url => url.includes('/static/css/main.css?')));
        }
        for (const control of controls) {
            assert.equal(control.scale, '1.44');
            assert.ok(!control.popupClasses.includes('employee-history-deferral-popup'));
        }
    } finally {
        if (artifactDir) fs.writeFileSync(path.join(artifactDir, 'geometry.json'), JSON.stringify({ records, controls, errors }, null, 2) + '\n');
        await browser.close();
    }
});
