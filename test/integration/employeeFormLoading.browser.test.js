'use strict';
// Real form templates, dropdowns, chains and schedule startup; no server, DB or saves.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ejs = require('ejs');
const { chromium } = require('playwright');
const { dataFor } = require('../fixtures/responsiveForms');
const { viewport, settleLayout } = require('../helpers/responsiveFormsBrowser');
const root = path.resolve(__dirname, '../..');
const vendor = process.env.PAYROLL_PERIOD_EMPLOYEES_TOM_VENDOR_DIR;
const origin = 'https://payroll.test';
const scripts = new Set(['common/initTomDropdown', 'geoDropdownChain', 'efkaDropdownChain',
    'symbaseisDropdownChain3', 'profTrainingDropdownChain', 'common/sectionsVisible',
    'ergazomenoi/genika/selectRepo', 'ergazomenoi/genika/getDaysFromDate',
    'ergazomenoi/genika/dailyRestValidation', 'ergazomenoi/genika/date_sync_add',
    'ergazomenoi/genika/date_sync_edit', 'ergazomenoi/genika/employeeAddPresentation']);
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }
async function fixture(browser, form, { failure = '', blocked = null, optionalBlocked = null, deadlineProbe = false, holiday = false } = {}) {
    const page = await browser.newPage();
    await page.addInitScript(() => {
        window.__employeeReadyEvents = 0;
        document.addEventListener('employeeform:ready', () => window.__employeeReadyEvents++);
    });
    const errors = [], requests = [], values = new Map();
    if (deadlineProbe) await page.addInitScript(() => {
        const original = AbortSignal.timeout.bind(AbortSignal);
        window.__initializationDeadline = new AbortController();
        AbortSignal.timeout = ms => ms === 20000 ? window.__initializationDeadline.signal : original(ms);
    });
    let attempt = 0;
    page.on('pageerror', error => errors.push(error.message));
    const file = `views/ergazomenoi/ergazomenoi/${form}.ejs`;
    const data = dataFor(file);
    data.ergazomenoiData = { ...data.ergazomenoiData, energos: true,
        hmeromhnia_allaghs_orarioy_apo: '2026-10-01', hmeromhnia_allaghs_orarioy_eos: '2026-10-02',
        hmeromhnia_isxyos_oron_ergasias_apo: '2026-10-01',
        hmeres_ergasias_ebdomadas: 5, ores_ergasias_ebdomadas: 40, mo_oron_hmerhsias_ergasias: 8,
        fylo: true, doy: '001' };
    data.rec = data.ergazomenoiData;
    if (holiday) data.companyData = { ...data.companyData, apasxolhsh_kata_tis_argies: false };
    let html = await ejs.renderFile(path.join(root, file), data);
    html = html.replace(/(<input\b(?=[^>]*\bid="doy_stathera")[^>]*\bvalue=")[^"]*/g, (_, prefix) => prefix + '001');
    html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, tag => {
        if (tag.includes('const pending = new Set()')) return tag;
        const name = /src="\/static\/js\/([^"]+)\.js"/.exec(tag)?.[1];
        return scripts.has(name) ? tag : '';
    });
    const sidebar = '<aside id="sidebarMenu" style="width:240px;position:fixed;inset:0 auto 0 0">Συνθετικό μενού</aside>';
    html = `<!doctype html><html><head><meta charset="utf-8"><meta name="csrf-token" content="synthetic"><link rel="stylesheet" href="/static/css/bootstrap.min.css"><link rel="stylesheet" href="/static/css/main.css"><link rel="stylesheet" href="/vendor/tom-select.css"><script src="/vendor/tom-select.complete.js"></script></head><body data-mode="${form}" data-context="ergazomenoi">${sidebar}<main class="payroll-form-layout" style="margin-left:240px">${html}</main>${optionalBlocked ? '<script>fetch("/api/optional-metadata").catch(() => {});</script>' : ''}<script src="/static/js/common/formLayout.js"></script></body></html>`;
    await page.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.origin !== origin) return route.abort();
        if (url.pathname === '/fixture') { attempt++; return route.fulfill({ contentType: 'text/html', body: html }); }
        if (url.pathname.startsWith('/static/')) {
            if (failure === 'script' && attempt === 1 && url.pathname.endsWith('/date_sync_edit.js')) return route.fulfill({ status: 503, body: '' });
            const target = path.join(root, 'public', url.pathname.slice('/static/'.length));
            if (!fs.existsSync(target)) return route.abort();
            return route.fulfill({ path: target });
        }
        if (url.pathname.startsWith('/vendor/')) return route.fulfill({ path: path.join(vendor, path.basename(url.pathname)) });
        requests.push({ url: url.pathname + url.search, attempt });
        if (url.pathname === '/api/optional-metadata') { await optionalBlocked.promise; return route.fulfill({ status: 503, json: {} }); }
        if (url.pathname.includes('/dropdown/')) {
            const value = url.searchParams.get('value');
            if (value) values.set(url.pathname, value);
            if (blocked && value && attempt === 1) await blocked.promise;
            if (failure === 'catalog' && value && attempt === 1) return route.fulfill({ status: 503, json: {} });
            return route.fulfill({ json: { items: value ? [{ value, label: 'Συνθετική επιλογή ' + value }] : [], hasMore: false } });
        }
        if (url.pathname === '/api/dateDifference') return route.fulfill({ json: { differenceInDays: 2 } });
        if (url.pathname === '/api/getProdhlomenaOraria') {
            if (blocked && attempt === 1) await blocked.promise;
            return route.fulfill(failure === 'schedule' && attempt === 1 ? { status: 503, json: {} } : { json: [] });
        }
        if (url.pathname === '/api/checkArgies') return route.fulfill({ json: holiday ? [{ date: '2026-10-01', description: 'Συνθετική αργία' }] : [] });
        return route.abort();
    });
    await page.goto(origin + '/fixture', { waitUntil: 'domcontentloaded' });
    return { page, errors, requests, values };
}

test('employee form waits for real initial data, then reveals all controls across widths', { skip: !vendor, timeout: 60000 }, async t => {
    const browser = await chromium.launch({ headless: true }); t.after(() => browser.close());
    for (const form of ['add', 'edit']) {
        const blocked = deferred();
        const { page, errors, requests } = await fixture(browser, form, { blocked });
        {
            await page.waitForFunction(() => document.querySelector('[data-employee-form-state]')?.dataset.employeeFormState === 'loading');
            assert.equal(await page.locator('.tadded-container').evaluate(e => getComputedStyle(e).visibility), 'hidden');
            assert.equal(await page.locator('.tadded-container').evaluate(e => e.inert), true);
            for (const selector of ['.card-header', '.card-body', '.card-footer']) {
                assert.equal(await page.locator(selector).first().evaluate(e => getComputedStyle(e).visibility), 'hidden');
            }
            assert.match(await page.locator('[data-employee-form-loading-message]').textContent(), /Φόρτωση στοιχείων εργαζομένου/);
            blocked.resolve();
        }
        await page.waitForFunction(() => document.querySelector('[data-employee-form-state]')?.dataset.employeeFormState === 'ready', { timeout: 10000 });
        assert.equal(await page.evaluate(() => window.__employeeReadyEvents), 1);
        for (const width of [1280, 1920]) for (const open of [true, false]) {
            await viewport(page, width, width === 1280 ? 720 : 1080, open); await settleLayout(page);
            assert.equal(await page.locator('.tadded-container').evaluate(e => getComputedStyle(e).visibility), 'visible');
            assert.equal(await page.locator('.tadded-container').evaluate(e => e.inert), false);
            assert.equal(await page.locator('[data-employee-form-loading-panel]').isHidden(), true);
            await page.locator('#eponymo_patera').fill('ΣΥΝΘΕΤΙΚΟΣ');
            assert.equal(await page.locator('#eponymo_patera').inputValue(), 'ΣΥΝΘΕΤΙΚΟΣ');
            assert.equal(await page.locator('select.tom-dropdown[data-api]').evaluateAll(nodes => nodes.every(e => Boolean(e.tomselect))), true);
        }
        if (form === 'edit') {
            assert.equal(await page.locator('#dynamicFields .input-date').count(), 2);
            await page.evaluate(() => { document.querySelectorAll('.sections > section').forEach(section => { section.style.display = section.dataset.section === 'Ωράριο Εργασίας' ? 'block' : 'none'; }); });
            await page.locator('#apo_ora_01_01').fill('08:00');
            await page.locator('#eos_ora_01_01').fill('16:00');
            assert.equal(await page.locator('#eos_ora_01_01').inputValue(), '16:00');
            assert.equal(requests.filter(r => r.url === '/api/getProdhlomenaOraria').length, 1);
            assert.equal(await page.evaluate(() => [window.__geoHydrating, window.__efkaHydrating, window.__symbaseisHydrating, window.__profTrainingHydrating].every(v => v === false)), true);
        }
        assert.deepEqual(errors, []);
        await page.close();
    }
});

for (const failure of ['catalog', 'schedule', 'script']) test(`critical ${failure} failure stays closed and reload retries once`, { skip: !vendor, timeout: 30000 }, async t => {
    const browser = await chromium.launch({ headless: true }); t.after(() => browser.close());
    const { page, requests } = await fixture(browser, 'edit', { failure });
    await page.waitForFunction(() => document.querySelector('[data-employee-form-state]')?.dataset.employeeFormState === 'failed');
    assert.equal(await page.locator('.tadded-container').evaluate(e => e.inert), true);
    assert.match(await page.locator('[data-employee-form-loading-message]').textContent(), /Δεν αποθηκεύτηκε καμία αλλαγή/);
    assert.match(await page.locator('[data-employee-form-loading-message]').textContent(), /1\.[\s\S]*2\./);
    await page.locator('[data-employee-form-retry]').click();
    await page.waitForFunction(() => document.querySelector('[data-employee-form-state]')?.dataset.employeeFormState === 'ready', { timeout: 10000 });
    const selected = requests.filter(r => r.attempt === 2 && r.url.includes('value='));
    assert.ok(selected.length);
    assert.equal(new Set(selected.map(r => r.url)).size, selected.length);
    assert.equal(requests.filter(r => r.attempt === 2 && r.url === '/api/getProdhlomenaOraria').length, 1);
});


test('optional requests never delay readiness; stalled critical work has a failure deadline', { skip: !vendor, timeout: 30000 }, async t => {
    const browser = await chromium.launch({ headless: true }); t.after(() => browser.close());
    const optionalBlocked = deferred();
    const optional = await fixture(browser, 'add', { optionalBlocked });
    await optional.page.waitForFunction(() => document.querySelector('[data-employee-form-state]')?.dataset.employeeFormState === 'ready');
    assert.equal(optional.requests.filter(r => r.url === '/api/optional-metadata').length, 1);
    optionalBlocked.resolve();
    await optional.page.close();
    const blocked = deferred();
    const stalled = await fixture(browser, 'edit', { blocked, deadlineProbe: true });
    await stalled.page.evaluate(() => window.__initializationDeadline.abort());
    assert.equal(await stalled.page.locator('[data-employee-form-state]').getAttribute('data-employee-form-state'), 'failed');
    assert.equal(await stalled.page.locator('[data-employee-form-retry]').isVisible(), true);
    blocked.resolve();
    await stalled.page.close();
});


test('holiday category initialization completes before the ready signal', { skip: !vendor, timeout: 15000 }, async t => {
    const browser = await chromium.launch({ headless: true }); t.after(() => browser.close());
    const { page, errors } = await fixture(browser, 'edit', { holiday: true });
    await page.waitForFunction(() => document.querySelector('[data-employee-form-state]')?.dataset.employeeFormState === 'ready');
    assert.equal(await page.locator('#kathgoria_ergasias_stathera_01').inputValue(), 'ΜΕ');
    assert.equal(await page.locator('#kathgoria_ergasias_01').evaluate(e => e.tomselect.getValue()), 'ΜΕ');
    assert.equal(await page.evaluate(() => window.__employeeReadyEvents), 1);
    assert.deepEqual(errors, []);
});
