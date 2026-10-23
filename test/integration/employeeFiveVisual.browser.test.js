'use strict';
// One offline Chromium cycle: real templates, styles and presentation handlers.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { chromium } = require('playwright');
const { loadForm, viewport, settleLayout } = require('../helpers/responsiveFormsBrowser');
const root = path.resolve(__dirname, '../..');
const vendor = process.env.PAYROLL_PERIOD_EMPLOYEES_TOM_VENDOR_DIR;
// Reuse existing fixture builders without registering their unrelated test cases.
function builders(file, marker, names) {
    const filename = path.join(root, file), m = new Module(filename, module);
    m.filename = filename; m.paths = Module._nodeModulePaths(path.dirname(filename));
    m._compile(fs.readFileSync(filename, 'utf8').split(marker)[0] + `\nmodule.exports={${names}};`, filename);
    return m.exports;
}
const { fixture, deferred } = builders('test/integration/employeeFormLoading.browser.test.js', "test('employee form waits", 'fixture,deferred');
const { scheduleRows } = builders('test/integration/employeeFinalVisual.browser.test.js', "test('four employee", 'scheduleRows');
const P = require('../../server/services/ergazomenoi/employeeHistoryCorrectionPolicyService');
const F = require('../fixtures/employeeProfileTransactionStore');

test('five employee presentation fixes: one synthetic Chromium cycle', { skip: !vendor, timeout: 120000 }, async t => {
    const browser = await chromium.launch({ headless: true }); t.after(() => browser.close());
    fs.mkdirSync(path.join(root, 'tmp/five-visual'), { recursive: true });
    for (const form of (process.env.PAYROLL_VISUAL_SKIP_STARTUP ? [] : ['add', 'edit'])) {
        const blocked = deferred();
        const { page, errors } = await fixture(browser, form, { blocked, deadlineProbe: true });
        await page.waitForFunction(() => window.AppLoader && document.querySelector('.app-loader--simple.is-visible'));
        assert.equal(await page.locator('[data-employee-form-loading-panel]').evaluate(e => e.getBoundingClientRect().height), 0);
        assert.equal(await page.evaluate(() => EmployeeFormReadiness.FORM_VISIBLE && !EmployeeFormReadiness.FORM_READY), true);
        assert.equal(await page.locator('.submitButton').evaluateAll(nodes => nodes.every(e => e.disabled)), true);
        blocked.resolve();
        await page.waitForFunction(() => EmployeeFormReadiness.FORM_READY);
        assert.equal(await page.evaluate(() => window.__employeeReadyEvents), 1);
        await page.evaluate(() => window.__initializationDeadline.abort());
        assert.equal(await page.evaluate(() => EmployeeFormReadiness.FORM_READY), true);
        assert.deepEqual(errors, []); await page.close();
    }
    // A failed task and the existing critical-task deadline must still reveal an error, never enable saving.
    for (const mode of (process.env.PAYROLL_VISUAL_SKIP_STARTUP ? [] : ['schedule', 'deadline'])) {
        const blocked = mode === 'deadline' ? deferred() : null;
        const f = await fixture(browser, 'edit', { failure: mode === 'schedule' ? mode : '', blocked, deadlineProbe: true });
        if (blocked) await f.page.evaluate(() => window.__initializationDeadline.abort());
        await f.page.waitForFunction(() => document.querySelector('[data-employee-form-state]').dataset.employeeFormState === 'failed');
        assert.equal(await f.page.locator('[data-employee-form-loading-panel]').isVisible(), true);
        assert.match(await f.page.locator('[data-employee-form-loading-message]').innerText(), /Δεν αποθηκεύτηκε καμία αλλαγή/);
        assert.equal(await f.page.locator('.submitButton').evaluateAll(nodes => nodes.every(e => e.disabled)), true);
        blocked?.resolve(); await f.page.close();
    }
    const layouts = {};
    for (const form of (process.env.PAYROLL_VISUAL_ONLY_EDIT ? ['edit'] : ['add', 'edit'])) {
        const page = await browser.newPage({ locale: 'el-GR' });
        await page.route('**/*', route => route.abort());
        await loadForm(page, `views/ergazomenoi/ergazomenoi/${form}.ejs`, { vendor });
        await page.locator('#dynamicFields').evaluate((e, html) => { e.innerHTML = html; }, scheduleRows(form));
        await page.evaluate(() => {
            document.querySelector('#hmeromhnia_01').value = '2026-10-01';
            document.querySelector('#day_label_01').textContent = 'Πε';
            const e = document.querySelector('#kathgoria_ergasias_01');
            e.add(new Option('Εργασία', 'ΕΡΓ', true, true)); new TomSelect(e, { create: false });
            document.querySelectorAll('.employee-ama-field input').forEach(e => { e.value = '123456789'; });
        });
        await page.addScriptTag({ path: path.join(process.env.PAYROLL_SWEETALERT_VENDOR_DIR || path.join(root, 'node_modules/sweetalert2/dist'), 'sweetalert2.all.js') });
        await page.addScriptTag({ path: path.join(root, 'public/js/ergazomenoi/genika/employeeAddPresentation.js') });
        await page.addScriptTag({ path: path.join(root, 'public/js/ergazomenoi/genika/clearableInputs.js') });
        await page.evaluate(() => document.dispatchEvent(new Event('DOMContentLoaded')));
        for (const width of [1280, 1366, 1600, 1920]) for (const open of [true]) {
            await viewport(page, width, width === 1280 ? 720 : 900, open);
            for (const tab of (process.env.PAYROLL_VISUAL_SWAL_ONLY ? [] : process.env.PAYROLL_VISUAL_TABS ? process.env.PAYROLL_VISUAL_TABS.split('|') : [...(process.env.PAYROLL_VISUAL_SKIP_AMA ? [] : ['Κρατήσεις']), 'Ωράριο Εργασίας', ...(form === 'edit' ? ['Ιστορικό Προσλήψεων/Αλλαγών'] : [])])) {
                await page.evaluate(tab => {
                    const sections = [...document.querySelectorAll('.sections > section')];
                    const index = sections.findIndex(e => e.dataset.section === tab);
                    document.querySelectorAll('.menu_Links li')[index].click();
                    sections.forEach(e => { e.style.display = e.dataset.section === tab ? 'block' : 'none'; });
                }, tab);
                await settleLayout(page);
                const shell = await page.evaluate(() => [...document.querySelectorAll('main,[data-employee-form-state],.tadded-container,.sections,.sections > section.visible')]
                    .filter(e => e.clientWidth && e.scrollWidth > e.clientWidth + 1).map(e => [e.className, e.clientWidth, e.scrollWidth]));
                assert.deepEqual(shell, [], `${form}/${width}/${open}/${tab}: shell overflow`);
                if (tab === 'Κρατήσεις') {
                    const ama = await page.locator('.employee-ama-field input').evaluateAll(nodes => nodes.map(e => {
                        const c = document.createElement('canvas').getContext('2d'), s = getComputedStyle(e); c.font = `${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;
                        return { value: e.value, available: e.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight), needed: c.measureText('123456789').width, max: e.maxLength };
                    }));
                    assert.ok(ama.every(e => e.value === '123456789' && e.available >= e.needed && e.max === -1), JSON.stringify({ form, width, open, ama }));
                    const input = page.locator('.employee-ama-field input').first();
                    await input.locator('..').locator('.clear-btn').click(); assert.equal(await input.inputValue(), '');
                    await input.fill('123456789');
                    await input.fill('123456789012'); assert.equal(await input.inputValue(), '123456789012'); await input.fill('123456789');
                }
                if (tab === 'Ωράριο Εργασίας') {
                    assert.equal(await page.locator('#argia_01').isHidden(), true);
                    await page.locator('#repo_01').setChecked(true); await page.locator('#repo_01').setChecked(false);
                    const geometry = await page.locator('.employee-schedule-day').evaluate(e => {
                        const base = e.getBoundingClientRect();
                        return { height: base.height, controls: [...e.querySelectorAll('input[type="time"],input[type="date"],.ts-wrapper,#repo_01')].map(e => {
                            const r = e.getBoundingClientRect(); return [r.x - base.x, r.y - base.y, r.width, r.height].map(n => Math.round(n));
                        }) };
                    });
                    const key = `${width}/${open}`;
                    if (form === 'add') layouts[key] = geometry;
                    else if (!(process.env.PAYROLL_VISUAL_RESUME_HISTORY && key === '1280/true')) assert.deepEqual(geometry, layouts[key], `schedule parity ${key}`);
                }
                if (tab === 'Ιστορικό Προσλήψεων/Αλλαγών') {
                    const heights = await page.locator('#cardBody7').evaluate(e => ({ h:e.clientHeight, scroll:e.scrollHeight, mainScroll:document.querySelector('main').scrollTop, card:e.parentElement.getAttribute('style') }));

                    assert.ok(heights.h > 150, JSON.stringify(heights));
                    const table = await page.locator('#istorikoTable').evaluate(e => ({
                        headers: [...e.querySelectorAll('thead tr:last-child th')].slice(1, 7).map(e => ({ width: e.clientWidth, wrap: getComputedStyle(e).overflowWrap })),
                        clipped: [...e.querySelectorAll('.istoriko-summary-date')].some(e => e.getBoundingClientRect().width > e.parentElement.clientWidth),
                        wrapper: getComputedStyle(e.parentElement).overflowX
                    }));
                    assert.ok(table.headers.every(e => e.width >= 160 && e.wrap === 'normal'), JSON.stringify(table));
                    assert.equal(table.clipped, false); assert.equal(table.wrapper, 'auto');
                }
                if (width === 1280 && open) await page.screenshot({ path: path.join(root, `tmp/five-visual/${form}-${tab}.png`) });
            }
        }
        if (form === 'edit' && !process.env.PAYROLL_VISUAL_SKIP_SWAL) {
            assert.equal(await page.evaluate(() => Swal.version), '11.26.25');
            await page.addScriptTag({ path: path.join(root, 'public/js/ergazomenoi/genika/employeeHistoryGuidedResolution.js') });
            await page.evaluate(() => { const sections = [...document.querySelectorAll('.sections > section')]; const index = sections.findIndex(e => e.dataset.section === 'Ιστορικό Προσλήψεων/Αλλαγών'); document.querySelectorAll('.menu_Links li')[index].click(); sections.forEach(e => { e.style.display = e.dataset.section === 'Ιστορικό Προσλήψεων/Αλλαγών' ? 'block' : 'none'; }); });
            const f = F.fixture();
            const plan = P.planHistoryCorrection({ scope: F.scope, currentEmployee: f.employee, historyRows: f.history,
                request: { intent: 'REVIEW', targetHistoryId: F.historyId('employee', 1), facts: {}, confirmation: null },
                accessMode: 'ADMIN_FULL', catalogs: {}, insertId: F.historyId('employee', 9) });
            for (const [width, height] of [[1280,900],[1366,900],[1600,900],[1920,900],[1280,720]]) {
                await page.setViewportSize({ width, height });
                await settleLayout(page);
                await page.evaluate(resolution => {
                    window.__writeAttempts = 0;
                    window.__dialog = employeeHistoryGuidedResolution.handleInitialResponse({
                        response: { status: 200, clone: () => ({ json: async () => ({ resolutionRequired: true, resolution }) }) },
                        originalPayload: {}, retryRequest: () => { window.__writeAttempts++; throw new Error('Forbidden'); }, swal: Swal, documentRef: document, windowRef: window
                    });
                }, plan.public);
                await page.locator('.swal2-popup').waitFor();
                await page.waitForFunction(() => { const e = document.querySelector('.swal2-popup'); return e && getComputedStyle(e).opacity === '1' && !e.getAnimations().some(a => a.playState === 'running'); });
                const dialog = await page.locator('.swal2-popup').evaluate(e => {
                    const r=e.getBoundingClientRect(), a=e.querySelector('.swal2-actions').getBoundingClientRect(), h=e.querySelector('.swal2-html-container');
                    return { width:r.width, top:r.top, bottom:r.bottom, actionsBottom:a.bottom, actionsTop:a.top, overflow:getComputedStyle(h).overflowY, excess:e.scrollWidth-e.clientWidth };
                });
                assert.ok(dialog.width <= Math.min(780,width-16) && dialog.top >= 0 && dialog.bottom <= height+1 && dialog.actionsBottom <= height && dialog.actionsTop >= 0 && dialog.excess <= 1, JSON.stringify(dialog));
                assert.equal(dialog.overflow, 'auto');
                assert.equal(await page.locator('.swal2-popup').evaluate(e => e.classList.contains('new-year-confirmation')), false);
                assert.equal(await page.locator('.swal2-container').evaluate(e => e.classList.contains('new-year-confirmation-container')), false);
                assert.equal(await page.locator('#sidebarMenu').isVisible(), true);
                assert.ok(await page.locator('.employee-history-safe-correction .small').evaluateAll(nodes => nodes.every(e => parseFloat(getComputedStyle(e).fontSize) >= 13.6)));
                await page.locator('.employee-history-correction-html').evaluate(e => { e.scrollTop = e.scrollHeight; });
                assert.equal(await page.locator('.swal2-cancel').evaluate(e => { const r=e.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }), true);
                await page.locator('.employee-history-correction-html').evaluate(e => { e.scrollTop = 0; });
                console.log('SWAL_GEOMETRY', width, dialog);
                await page.screenshot({ path:path.join(root, `tmp/five-visual/swal-${width}.png`) });
                await page.locator('.swal2-cancel').click();
                await page.evaluate(() => window.__dialog);
                assert.equal(await page.evaluate(() => window.__writeAttempts), 0);
            }
        }
        await page.close();
    }
    console.log('Selected presentation checks passed; all requests remained synthetic and no correction was confirmed.');
});
