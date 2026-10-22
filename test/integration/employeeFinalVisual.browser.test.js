'use strict';
// Presentation only: actual EJS/CSS, production schedule markup and local assets.
// No save handlers, server, database, calculations or external requests execute.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { chromium } = require('playwright');
const { loadForm, viewport, settleLayout } = require('../helpers/responsiveFormsBrowser');
const root = path.resolve(__dirname, '../..');
const vendor = process.env.PAYROLL_PERIOD_EMPLOYEES_TOM_VENDOR_DIR;
const diagnose = process.env.PAYROLL_EMPLOYEE_VISUAL_DIAGNOSE === '1';
function scheduleRows(form) {
    const source = fs.readFileSync(path.join(root, `public/js/ergazomenoi/genika/date_sync_${form}.js`), 'utf8');
    if (form === 'add') {
        const start = source.indexOf('                let divHtml = `');
        const end = source.indexOf("container.insertAdjacentHTML('beforeend', divHtml);", start);
        return vm.runInNewContext(source.slice(start, end) + '\ndivHtml;', { i1: '01', disabledAttr: '', document: { getElementById: () => null } });
    }
    const template = source.match(/const divHtml = `([\s\S]*?)`;\s*container\.insertAdjacentHTML/)[1];
    return vm.runInNewContext('`' + template + '`', {
        i1: '01', pKathgoria: 'ΕΡΓ', shouldDefaultMEAfterContractEnd: false,
        pApoOra01: '08:00', pEosOra01: '16:00', pDialApo01: '', pDialEos01: '',
        pApoOra02: '17:00', pEosOra02: '18:00', pDialApo02: '', pDialEos02: '',
        pApoOra03: '19:00', pEosOra03: '20:00', pDialApo03: '', pDialEos03: '',
        pRepo: false, pArgia: true, labelRepoText: 'ΟΧΙ', labelArgiaText: 'ΝΑΙ', pPerigrafh: 'Συνθετική αργία', disabledAttr: ''
    });
}
test('four employee visual corrections across all tabs, widths and sidebar states', { skip: !vendor, timeout: 120000 }, async t => {
    const browser = await chromium.launch({ headless: true, ignoreDefaultArgs: ['--hide-scrollbars'] }); t.after(() => browser.close());
    const measurements = [];
    for (const form of ['add', 'edit'].filter(form => !process.env.PAYROLL_EMPLOYEE_VISUAL_FORM || form === process.env.PAYROLL_EMPLOYEE_VISUAL_FORM)) {
        const page = await browser.newPage({ locale: 'el-GR' });
        const errors = []; page.on('pageerror', error => errors.push(error.message));
        await page.route('**/*', route => route.abort());
        await loadForm(page, `views/ergazomenoi/ergazomenoi/${form}.ejs`, { vendor });
        await page.locator('#dynamicFields').evaluate((element, html) => { element.innerHTML = html; }, scheduleRows(form));
        await page.evaluate(() => {
            document.querySelector('#hmeromhnia_01').value = '2026-10-01';
            document.querySelector('#day_label_01').textContent = 'Πε';
            const select = document.querySelector('#kathgoria_ergasias_01');
            select.add(new Option('Εργασία', 'ΕΡΓ', true, true)); new TomSelect(select, { create: false });
            document.querySelectorAll('.accordion-collapse').forEach(e => e.classList.add('show'));
        });
        const tabs = await page.locator('.sections > section').evaluateAll(nodes => nodes.map(node => node.dataset.section));
        for (const width of (process.env.PAYROLL_EMPLOYEE_VISUAL_WIDTHS || '1280,1366,1600,1920').split(',').map(Number)) for (const open of [true, false]) {
            await viewport(page, width, width === 1920 ? 1080 : 900, open);
            const result = { form, width, sidebar: open ? 'open' : 'closed', tabs: [] };
            for (const tab of tabs.filter(tab => !process.env.PAYROLL_EMPLOYEE_VISUAL_TAB || tab === process.env.PAYROLL_EMPLOYEE_VISUAL_TAB)) {
                await page.evaluate(tab => {
                    document.querySelectorAll('.sections > section').forEach(section => {
                        section.classList.toggle('visible', section.dataset.section === tab);
                        section.style.display = section.dataset.section === tab ? 'block' : 'none';
                    });
                }, tab);
                await settleLayout(page);
                const geometry = await page.evaluate(() => {
                    const section = document.querySelector('.sections > section.visible');
                    const visible = e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden';
                    const identify = e => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + '.' + [...e.classList].join('.');
                    const overflows = [section, ...section.querySelectorAll('*')].filter(e => visible(e) && e.clientWidth > 0 && e.scrollWidth > e.clientWidth + 1)
                        .filter(e => !e.closest('.ts-dropdown') && !e.matches('input,textarea,.ts-control,.ts-control .item'))
                        .map(e => ({ selector: identify(e), client: e.clientWidth, scroll: e.scrollWidth, overflow: getComputedStyle(e).overflowX }));
                    const body = section.querySelector('.card-body'), bounds = body.getBoundingClientRect();
                    const outside = [...body.querySelectorAll('input:not([type="hidden"]),select,textarea')].map(e => e.tomselect?.wrapper || e)
                        .filter(e => visible(e) && !e.matches('.ts-hidden-accessible') && !e.closest('.ts-dropdown') && !e.matches('.ts-control input'))
                        .filter(e => { const r=e.getBoundingClientRect(); return r.left < bounds.left - 1 || r.right > bounds.right + 1; }).map(identify);
                    const shells = [...document.querySelectorAll('main, [data-employee-form-state], .tadded-container, .tadded-container > .container-fluid, .sections, .menu_Links, .menu_Links ul')].filter(visible).map(e => ({ selector: identify(e), client: e.clientWidth, scroll: e.scrollWidth, overflow: getComputedStyle(e).overflowX }));
                    const cardChildren = [...section.querySelector('.card').children].map(e => ({ selector: identify(e), width: e.getBoundingClientRect().width, client: e.clientWidth, scroll: e.scrollWidth, font: getComputedStyle(e).fontSize, whiteSpace: getComputedStyle(e).whiteSpace, text: e.textContent.trim().slice(0,80), right: e.getBoundingClientRect().right }));
                    return { cardChildren, shells, tab: section.dataset.section, excess: body.scrollWidth - body.clientWidth, gutter: body.offsetWidth - body.clientWidth, overflowX: getComputedStyle(body).overflowX, overflows, outside };
                });
                result.tabs.push(geometry);
                if (!diagnose) {
                    if (geometry.shells.some(e => e.scroll > e.client + 1) || geometry.outside.length) {
                        console.log('VISUAL_FAILURE', JSON.stringify({ form, width, open, geometry }));
                        await page.screenshot({ path: path.join(root, `tmp/employee-visual-failure-${form}-${width}-${open}.png`) });
                    }
                    assert.deepEqual(geometry.overflows.filter(e => ['auto', 'scroll'].includes(e.overflow)), [], `${form}/${width}/${open}/${tab}`);
                    assert.deepEqual(geometry.shells.filter(e => e.scroll > e.client + 1), [], `${form}/${width}/${open}/${tab}: shell`);
                    assert.deepEqual(geometry.outside, [], `${form}/${width}/${open}/${tab}: clipped fields`);
                }
                if (form === 'edit') {
                    const labels = await page.locator('.sections > section.visible .submitButton:not([data-save-mode="temporary"])').allTextContents();
                    assert.ok(labels.length); assert.ok(labels.every(label => label.trim() === 'Αποθήκευση'), JSON.stringify(labels));
                } else {
                    const label = await page.locator('.sections > section.visible .submitButton:not([data-save-mode="temporary"])').first().textContent();
                    assert.equal(label.trim(), tab === 'Ωράριο Εργασίας' ? 'Αποθήκευση' : 'Οριστική Αποθήκευση');
                }
                if (tab === 'Ωράριο Εργασίας') {
                    assert.equal(await page.locator('#argia_01').isHidden(), true);
                    assert.equal(await page.locator('#label-argia_01').isHidden(), true);
                    assert.equal(await page.locator('#repo_01').isVisible(), true);
                    await page.locator('#repo_01').setChecked(true);
                    assert.equal(await page.locator('#repo_01').isChecked(), true);
                    await page.locator('#repo_01').setChecked(false);
                    assert.equal(await page.locator('#argia_01').evaluate(e => e.name), 'argia_01');
                    assert.equal(await page.locator('#argia_01').isChecked(), form === 'edit');
                }
                if (form === 'add' && tab === 'Σταθερά Στοιχεία') {
                    await page.evaluate(() => {
                        document.querySelector('#ypagogh_se_teka').textContent = 'Ο συγκεκριμένος ασφαλισμένος υπάγεται στο ΤΕΚΑ';
                        document.querySelector('#teka-result-row').classList.remove('d-none');
                    });
                    const spacing = await page.locator('#teka-result-row').evaluate(row => {
                        const collapse = row.closest('.accordion-collapse'), message = row.getBoundingClientRect();
                        const header = collapse.previousElementSibling.getBoundingClientRect();
                        const field = document.querySelector('#foreas_kyrias_asfalishs').tomselect.wrapper.getBoundingClientRect();
                        return { top: message.top - header.bottom, bottom: field.top - message.bottom, collapse: collapse.id };
                    });
                    assert.ok(spacing.top >= 4 && spacing.bottom >= 0, JSON.stringify(spacing));
                    assert.equal(spacing.collapse, 'panelsStayOpen-collapseFour');
                    await page.locator('#panelsStayOpen-collapseFour').evaluate(e => bootstrap.Collapse.getOrCreateInstance(e, { toggle: false }).hide());
                    await page.locator('#panelsStayOpen-collapseFour').waitFor({ state: 'hidden' });
                    assert.equal(await page.locator('#teka-result-row').isHidden(), true);
                    await page.locator('#panelsStayOpen-collapseFour').evaluate(e => bootstrap.Collapse.getOrCreateInstance(e, { toggle: false }).show());
                    await page.locator('#panelsStayOpen-collapseFour.show').waitFor();
                    await page.locator('#teka-result-row').evaluate(e => e.classList.add('d-none'));
                }
            }
            measurements.push(result);
            await page.screenshot({ path: path.join(root, `tmp/employee-visual-${form}-${width}-${open}.png`) });
            console.log('EMPLOYEE_VISUAL', JSON.stringify(result));
        }
        assert.deepEqual(errors, []); await page.close();
    }
    fs.writeFileSync(path.join(root, 'tmp/employee-final-visual-measurements.json'), JSON.stringify(measurements, null, 2));
});
