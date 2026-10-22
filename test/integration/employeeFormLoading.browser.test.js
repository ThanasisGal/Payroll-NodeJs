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
const sweetAlertVendor = process.env.PAYROLL_SWEETALERT_VENDOR_DIR || path.join(root, 'node_modules/sweetalert2/dist');
// Use the existing production loader markup and coordinator verbatim.
const layout = fs.readFileSync(path.join(root, 'views/layouts/main.ejs'), 'utf8').replaceAll('<%= nonce %>', 'synthetic');
const loaderMarkup = layout.slice(layout.indexOf('<div class="app-loader app-loader--simple"'), layout.indexOf("<%- include('../partials/header.ejs')"));
const loaderScript = [...layout.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)]
    .find(match => match[1].includes('const efkaRoot ='))[1];
const chainIds = ['perifereia', 'nomos', 'dhmos', 'polh', 'kad_efka', 'eidikothta_efka', 'kpk_efka', 'epa_efka',
    'symbash', 'kathgoria_symbashs', 'eidikothta_symbashs', 'thematiko_pedio', 'thematikh_enothta', 'foreas_katartishs'];
const scripts = new Set(['common/initTomDropdown', 'geoDropdownChain', 'efkaDropdownChain',
    'symbaseisDropdownChain3', 'profTrainingDropdownChain', 'common/sectionsVisible',
    'ergazomenoi/genika/selectRepo', 'ergazomenoi/genika/getDaysFromDate',
    'ergazomenoi/genika/dailyRestValidation', 'ergazomenoi/genika/date_sync_add',
    'ergazomenoi/genika/date_sync_edit', 'ergazomenoi/genika/employeeAddPresentation']);
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }
async function fixture(browser, form, { failure = '', blocked = null, optionalBlocked = null, deadlineProbe = false, holiday = false, slow = false, days = 2 } = {}) {
    const page = await browser.newPage();
    if (slow) {
        const session = await page.context().newCDPSession(page);
        await session.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    }
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
        hmeromhnia_allaghs_orarioy_apo: '2026-10-01', hmeromhnia_allaghs_orarioy_eos: '2026-10-' + String(days).padStart(2, '0'),
        hmeromhnia_isxyos_oron_ergasias_apo: '2026-10-01',
        hmeres_ergasias_ebdomadas: 5, ores_ergasias_ebdomadas: 40, mo_oron_hmerhsias_ergasias: 8,
        fylo: true, doy: '001' };
    if (slow) for (const id of chainIds) data.ergazomenoiData[id] = '001';
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
    html = `<!doctype html><html><head><meta charset="utf-8"><meta name="csrf-token" content="synthetic"><link rel="stylesheet" href="/static/css/bootstrap.min.css"><link rel="stylesheet" href="/static/css/main.css"><link rel="stylesheet" href="/vendor/tom-select.css"><script src="/vendor/tom-select.complete.js"></script></head><body data-mode="${form}" data-context="ergazomenoi">${loaderMarkup}<script>${loaderScript}</script>${sidebar}<main class="payroll-form-layout" style="margin-left:240px">${html}</main>${optionalBlocked ? '<script>fetch("/api/optional-metadata").catch(() => {});</script>' : ''}<script src="/static/js/common/formLayout.js"></script></body></html>`;
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
        if (slow) await new Promise(resolve => setTimeout(resolve, 250));
        if (url.pathname === '/api/optional-metadata') { await optionalBlocked.promise; return route.fulfill({ status: 503, json: {} }); }
        if (url.pathname.includes('/dropdown/')) {
            const value = url.searchParams.get('value');
            if (value) values.set(url.pathname, value);
            if (blocked && value) await blocked.promise;
            if (failure === 'catalog' && value && attempt === 1) return route.fulfill({ status: 503, json: {} });
            return route.fulfill({ json: { items: value ? [{ value, label: 'Συνθετική επιλογή ' + value }] : [], hasMore: false } });
        }
        if (url.pathname === '/api/dateDifference') return route.fulfill({ json: { differenceInDays: days } });
        if (url.pathname === '/api/getProdhlomenaOraria') {
            if (blocked) await blocked.promise;
            return route.fulfill(failure === 'schedule' && attempt === 1 ? { status: 503, json: {} } : { json: [] });
        }
        if (url.pathname === '/api/checkArgies') return route.fulfill({ json: holiday ? [{ date: '2026-10-01', description: 'Συνθετική αργία' }] : [] });
        return route.abort();
    });
    await page.goto(origin + '/fixture', { waitUntil: 'domcontentloaded' });
    return { page, errors, requests, values, setBlocked(value) { blocked = value; } };
}

test('employee form waits for real initial data, enables saving after early visibility across widths', { skip: !vendor, timeout: 60000 }, async t => {
    const browser = await chromium.launch({ headless: true }); t.after(() => browser.close());
    for (const form of ['add', 'edit']) {
        const blocked = deferred();
        const { page, errors, requests } = await fixture(browser, form, { blocked, deadlineProbe: true });
        {
            await page.waitForFunction(() => document.querySelector('[data-employee-form-state]')?.dataset.employeeFormState === 'loading');
            assert.equal(await page.locator('.tadded-container').evaluate(e => getComputedStyle(e).visibility), 'visible');
            assert.equal(await page.locator('.tadded-container').evaluate(e => e.inert), true);
            for (const selector of ['.card-header', '.card-body', '.card-footer']) {
                assert.equal(await page.locator(selector).first().evaluate(e => getComputedStyle(e).visibility), 'visible');
            }
            assert.match(await page.locator('[data-employee-form-loading-message]').textContent(), /Φόρτωση στοιχείων εργαζομένου/);
            await page.waitForFunction(() => document.querySelector('.app-loader--simple')?.classList.contains('is-visible'));
            assert.equal(await page.evaluate(() => window.EmployeeFormReadiness.FORM_VISIBLE), true);
            assert.equal(await page.evaluate(() => window.EmployeeFormReadiness.FORM_READY), false);
            assert.equal(await page.locator('.submitButton').evaluateAll(buttons => buttons.every(button => button.disabled)), true);
            blocked.resolve();
        }
        await page.waitForFunction(() => document.querySelector('[data-employee-form-state]')?.dataset.employeeFormState === 'ready', { timeout: 10000 });
        assert.equal(await page.evaluate(() => window.__employeeReadyEvents), 1);
        await page.evaluate(() => window.__initializationDeadline.abort());
        assert.equal(await page.evaluate(() => window.EmployeeFormReadiness.FORM_READY), true);
        console.log('SYNTHETIC_NORMAL_INITIALIZATION', JSON.stringify({ form, ...await page.evaluate(() => { const { visibleMs, readyMs } = window.EmployeeFormReadiness.diagnostics(); return { visibleMs, readyMs }; }) }));
        for (const width of [1280, 1920]) for (const open of [true, false]) {
            await viewport(page, width, width === 1280 ? 720 : 1080, open); await settleLayout(page);
            assert.equal(await page.locator('.tadded-container').evaluate(e => getComputedStyle(e).visibility), 'visible');
            assert.equal(await page.locator('.tadded-container').evaluate(e => e.inert), false);
            assert.equal(await page.locator('[data-employee-form-loading-panel]').isHidden(), true);
            await page.locator('#eponymo_patera').fill('ΣΥΝΘΕΤΙΚΟΣ');
            assert.equal(await page.locator('#eponymo_patera').inputValue(), 'ΣΥΝΘΕΤΙΚΟΣ');
            assert.equal(await page.locator('select.tom-dropdown[data-api]').evaluateAll(nodes => nodes.every(e => Boolean(e.tomselect))), true);
        }
        // Manual status is independent of hire edits; departure alone disables it.
        assert.equal(await page.locator('#energos').isEnabled(), true);
        for (const selected of [false, true]) {
            await page.locator('#energos').setChecked(selected);
            assert.equal(await page.locator('#energos').isChecked(), selected);
            assert.equal(await page.locator('#label-energos').textContent().then(v => v.trim()),
                selected ? 'ΕΝΕΡΓΟΣ' : 'ΑΝΕΝΕΡΓΟΣ');
        }
        await page.evaluate(() => {
            const departure = document.querySelector('#hmeromhnia_apoxorhshs');
            departure.value = '2026-10-20'; departure.dispatchEvent(new Event('change', { bubbles: true }));
        });
        assert.equal(await page.locator('#energos').isDisabled(), true);
        assert.equal(await page.locator('#energos').isChecked(), false);
        await page.evaluate(() => {
            const departure = document.querySelector('#hmeromhnia_apoxorhshs');
            departure.value = ''; departure.dispatchEvent(new Event('change', { bubbles: true }));
        });
        assert.equal(await page.locator('#energos').isEnabled(), true);
        assert.equal(await page.locator('#energos').isChecked(), false);
        assert.equal(await page.evaluate(() => window.__employeeReadyEvents), 1);
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

for (const failure of ['catalog', 'schedule', 'script']) test(`critical ${failure} failure keeps visible form locked and reload retries once`, { skip: !vendor, timeout: 30000 }, async t => {
    const browser = await chromium.launch({ headless: true }); t.after(() => browser.close());
    const { page, requests } = await fixture(browser, 'edit', { failure });
    await page.waitForFunction(() => document.querySelector('[data-employee-form-state]')?.dataset.employeeFormState === 'failed');
    assert.equal(await page.locator('.tadded-container').evaluate(e => e.inert), true);
    assert.equal(await page.locator('.tadded-container').evaluate(e => getComputedStyle(e).visibility), 'visible');
    assert.equal(await page.evaluate(() => window.EmployeeFormReadiness.FORM_READY), false);
    assert.match(await page.locator('[data-employee-form-loading-message]').textContent(), /Δεν αποθηκεύτηκε καμία αλλαγή/);
    assert.match(await page.locator('[data-employee-form-loading-message]').textContent(), /1\.[\s\S]*2\./);
    const diagnostic = await page.evaluate(() => window.EmployeeFormReadiness.diagnostics());
    if (failure === 'catalog') {
        assert.match(diagnostic.failedTask, /^selected-value:/);
        assert.equal(diagnostic.httpStatus, 503);
        assert.match(await page.locator('[data-employee-form-loading-message]').textContent(), /επιλεγμένες τιμές των καταλόγων/);
    }
    if (failure === 'schedule') {
        assert.equal(diagnostic.failedTask, 'schedule-stored');
        assert.equal(diagnostic.httpStatus, 503);
        assert.match(await page.locator('[data-employee-form-loading-message]').textContent(), /αποθηκευμένο ωράριο/);
    }
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
    const stalled = await fixture(browser, 'edit', { blocked });
    await stalled.page.waitForFunction(() => document.querySelector('[data-employee-form-state]')?.dataset.employeeFormState === 'failed', null, { timeout: 22000 });
    assert.equal(await stalled.page.locator('[data-employee-form-state]').getAttribute('data-employee-form-state'), 'failed');
    assert.equal(await stalled.page.locator('[data-employee-form-retry]').isVisible(), true);
    assert.equal(await stalled.page.locator('.tadded-container').evaluate(e => getComputedStyle(e).visibility), 'visible');
    assert.equal(await stalled.page.locator('.submitButton').evaluateAll(buttons => buttons.every(button => button.disabled)), true);
    const diagnostic = await stalled.page.evaluate(() => window.EmployeeFormReadiness.diagnostics());
    assert.equal(diagnostic.reason, 'deadline-exceeded');
    assert.ok(diagnostic.pending.some(item => item.task === 'selected-value:doy'));
    assert.ok(diagnostic.pending.some(item => item.task === 'initial-schedule'));
    assert.ok(diagnostic.pending.every(item => Number.isInteger(item.elapsedMs)));
    assert.equal(await stalled.page.evaluate(() => window.__employeeReadyEvents), 0);
    assert.match(await stalled.page.locator('[data-employee-form-loading-message]').textContent(), /20 δευτερολέπτων/);
    assert.ok(diagnostic.elapsedMs >= 19000 && diagnostic.elapsedMs < 25000);
    assert.ok(diagnostic.pending.some(item => item.task === 'schedule-stored'));
    console.log('SYNTHETIC_DEADLINE', JSON.stringify({ elapsedMs: diagnostic.elapsedMs, pending: diagnostic.pending }));
    blocked.resolve();
    await stalled.page.waitForFunction(() => document.querySelector('[data-employee-form-state]')?.dataset.employeeScheduleInitialized === 'true');
    assert.equal(await stalled.page.locator('[data-employee-form-state]').getAttribute('data-employee-form-state'), 'failed');
    assert.equal(await stalled.page.evaluate(() => window.__employeeReadyEvents), 0);
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


test('slow CPU and delayed synthetic HTTP complete the full month after early visibility with one ready signal', { skip: !vendor, timeout: 45000 }, async t => {
    const browser = await chromium.launch({ headless: true }); t.after(() => browser.close());
    const { page, errors, requests } = await fixture(browser, 'edit', { slow: true, days: 31 });
    await page.waitForFunction(() => document.querySelector('[data-employee-form-state]')?.dataset.employeeFormState !== 'loading', null, { timeout: 25000 });
    const diagnostic = await page.evaluate(() => window.EmployeeFormReadiness.diagnostics());
    assert.ok(diagnostic.visibleMs < diagnostic.readyMs, JSON.stringify(diagnostic));
    assert.equal(await page.locator('[data-employee-form-state]').getAttribute('data-employee-form-state'), 'ready', JSON.stringify(diagnostic));
    assert.equal(await page.evaluate(() => window.__employeeReadyEvents), 1);
    assert.equal(await page.locator('#dynamicFields .input-date').count(), 31);
    assert.equal(await page.locator('#doy').evaluate(element => element.tomselect.getValue()), '001');
    assert.equal(await page.locator('.tadded-container').evaluate(element => element.inert), false);
    assert.equal(requests.filter(request => request.url === '/api/getProdhlomenaOraria').length, 1);
    for (const id of chainIds) {
        assert.equal(await page.locator('#' + id).evaluate(element => element.tomselect.getValue()), '001', id);
    }
    const selected = requests.filter(request => request.url.includes('value='));
    assert.equal(new Set(selected.map(request => request.url)).size, selected.length);
    // A populated training chain has a pre-existing hydration-flag issue; it
    // does not block readiness. Record it without changing unrelated behavior.
    const hydration = await page.evaluate(() => ({ geo: window.__geoHydrating, efka: window.__efkaHydrating,
        contracts: window.__symbaseisHydrating, training: window.__profTrainingHydrating }));
    assert.equal(hydration.geo, false);
    assert.equal(hydration.efka, false);
    assert.equal(hydration.contracts, false);
    console.log('SYNTHETIC_SLOW_INITIALIZATION', JSON.stringify({ visibleMs: diagnostic.visibleMs, readyMs: diagnostic.readyMs, elapsedMs: diagnostic.elapsedMs, pending: diagnostic.pending, scheduleRows: diagnostic.scheduleRows, hydration }));
    assert.deepEqual(errors, []);
    await page.close();
});

test('diagnostics exclude exception content, URLs and selected values', { skip: !vendor, timeout: 15000 }, async t => {
    const browser = await chromium.launch({ headless: true }); t.after(() => browser.close());
    const blocked = deferred();
    const { page } = await fixture(browser, 'edit', { blocked });
    await page.evaluate(() => {
        const error = Object.assign(new Error('PRIVATE_NAME /api?token=SECRET'), { status: 503 });
        window.EmployeeFormReadiness.track('selected-value:doy', Promise.reject(error));
    });
    await page.waitForFunction(() => document.querySelector('[data-employee-form-state]')?.dataset.employeeFormState === 'failed');
    const diagnostic = await page.evaluate(() => window.EmployeeFormReadiness.diagnostics());
    assert.doesNotMatch(JSON.stringify(diagnostic), /PRIVATE_NAME|SECRET|token|"value"|synthetic/i);
    assert.equal(diagnostic.httpStatus, 503);
    blocked.resolve();
    await page.close();
});


test('synthetic saves require readiness and each next employee appears during hydration at CPU x4', { skip: !vendor, timeout: 60000 }, async t => {
    const browser = await chromium.launch({ headless: true }); t.after(() => browser.close());
    for (const form of ['add', 'edit']) {
        let blocked = deferred();
        const fixtureState = await fixture(browser, form, { blocked, slow: true });
        const { page, errors } = fixtureState;
        const saves = [], timings = [];
        await page.route('**/*', async route => {
            const request = route.request(), url = new URL(request.url());
            const isSave = request.method() === 'POST' && (url.pathname === '/ergazomenoi/ergazomenoi/add' || url.pathname.startsWith('/api/ergazomenoi/update/'));
            if (!isSave) return route.fallback();
            saves.push(request.postDataJSON());
            return route.fulfill({ json: { success: true, employeeStateToken: 'synthetic-next',
                message: 'Η συνθετική αποθήκευση ολοκληρώθηκε.', redirectUrl: '/fixture?employee=next' } });
        });
        await page.addScriptTag({ path: path.join(sweetAlertVendor, 'sweetalert2.all.js') });
        await page.addStyleTag({ path: path.join(sweetAlertVendor, 'sweetalert2.css') });
        await page.addScriptTag({ path: path.join(root, 'public/js/ergazomenoi/genika/employeeDraftSave.js') });
        await page.evaluate(async form => {
            await window.saveTemporaryEmployee({ mode: form, formData: { eponymo: 'ΣΥΝΘΕΤΙΚΟΣ' } });
        }, form);
        assert.equal(saves.length, 0);
        // Exercise the actual final-save entry functions while initialization is pending.
        for (const script of ['getFieldValues', 'putFieldValues']) {
            const source = fs.readFileSync(path.join(root, `public/js/ergazomenoi/genika/${script}.js`), 'utf8');
            const start = source.indexOf('    async function handleFormSubmit(event)');
            const end = script === 'getFieldValues' ? source.indexOf("    const buttons = document.querySelectorAll('.submitButton');", start)
                : source.indexOf('    function handleFormSubmitOnce(', start);
            await page.addScriptTag({ content: source.slice(start, end) + '\nwindow.__initializationSaveProbe = handleFormSubmit;' });
            await page.evaluate(() => window.__initializationSaveProbe({}));
        }
        assert.equal(saves.length, 0);
        await page.evaluate(() => {
            window.__unsafeClicks = 0;
            const button = document.querySelector('.submitButton');
            button.addEventListener('click', () => window.__unsafeClicks++);
            button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        });
        assert.equal(await page.evaluate(() => window.__unsafeClicks), 0);
        blocked.resolve();
        await page.waitForFunction(() => window.EmployeeFormReadiness.FORM_READY);
        timings.push(await page.evaluate(() => window.EmployeeFormReadiness.diagnostics()));
        assert.equal(await page.locator('.submitButton').first().isEnabled(), true);
        blocked = deferred(); fixtureState.setBlocked(blocked);
        await page.evaluate(form => { window.saveTemporaryEmployee({ mode: form, formData: { eponymo: 'ΣΥΝΘΕΤΙΚΟΣ' } }); }, form);
        await page.waitForURL('**/fixture?employee=next');
        assert.equal(saves.length, 1);
        await page.waitForFunction(() => window.EmployeeFormReadiness?.FORM_VISIBLE && !window.EmployeeFormReadiness.FORM_READY);
        await page.waitForFunction(() => document.querySelector('.app-loader--simple').classList.contains('is-visible'));
        assert.equal(await page.locator('.tadded-container').evaluate(e => getComputedStyle(e).visibility), 'visible');
        blocked.resolve();
        await page.waitForFunction(() => window.EmployeeFormReadiness.FORM_READY);
        timings.push(await page.evaluate(() => window.EmployeeFormReadiness.diagnostics()));
        assert.equal(await page.evaluate(() => window.__employeeReadyEvents), 1);
        assert.deepEqual(errors, []);
        console.log('SYNTHETIC_NEXT_EMPLOYEE_CPU4', JSON.stringify({ form, timings: timings.map(({ visibleMs, readyMs }) => ({ visibleMs, readyMs })) }));
        await page.close();
    }
});
