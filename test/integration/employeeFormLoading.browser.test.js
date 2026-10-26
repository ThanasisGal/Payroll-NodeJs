'use strict';
// Real form templates, dropdowns, chains and schedule startup; no server, DB or saves.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ejs = require('ejs');
const { chromium } = require('playwright');
const { execFileSync, spawn } = require('node:child_process');
const os = require('node:os');
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

// A separate headed browser is necessary: normal Playwright pages emulate
// focus/visibility. Never attach these tests to a user's running Chromium.
async function realVisibilityBrowser(t) {
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'payroll-readiness-chromium-'));
    const child = spawn(chromium.executablePath(), ['--no-sandbox', '--disable-dev-shm-usage',
        '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0',
        '--remote-debugging-address=127.0.0.1', '--user-data-dir=' + profile, 'about:blank'],
    { stdio: ['ignore', 'ignore', 'pipe'] });
    t.after(() => { child.kill('SIGTERM'); });
    const endpoint = await new Promise((resolve, reject) => {
        let stderr = '';
        const timer = setTimeout(() => reject(new Error('Isolated Chromium did not start')), 10000);
        const finish = (error, value) => { clearTimeout(timer); error ? reject(error) : resolve(value); };
        child.stderr.on('data', chunk => {
            stderr += chunk;
            const match = /DevTools listening on (ws:\/\/\S+)/.exec(stderr);
            if (match) finish(null, match[1]);
        });
        child.once('error', error => finish(error));
        child.once('exit', code => finish(new Error('Isolated Chromium exited: ' + code)));
    });
    const browser = await chromium.connectOverCDP(endpoint, { noDefaults: true });
    t.after(() => browser.close());
    return browser;
}

test('real hidden tab readiness for Add and Maintenance, including either pending render frame',
    { skip: !vendor || process.env.PAYROLL_READINESS_REAL_VISIBILITY !== '1', timeout: 90000 }, async t => {
        const browser = await realVisibilityBrowser(t);
        const context = browser.contexts()[0];
        const otherTab = await context.newPage();
        for (const form of ['add', 'edit']) for (const heldFrame of [0, 1, 2]) {
            const blocked = deferred();
            const factory = { async newPage() {
                const page = await context.newPage();
                // Gate only the selected render callback so the tab switch can
                // happen deterministically during that exact wait. Visibility
                // and visibilitychange remain native Chromium behavior.
                await page.addInitScript(heldFrame => {
                    let renderWaits = 0;
                    const requestFrame = window.requestAnimationFrame.bind(window);
                    window.requestAnimationFrame = callback => {
                        if (new Error().stack.includes('waitForRender') && ++renderWaits === heldFrame) {
                            return requestFrame(() => { window.__heldReadinessFrame = heldFrame; });
                        }
                        return requestFrame(callback);
                    };
                }, heldFrame);
                return page;
            } };
            const { page, errors } = await fixture(factory, form,
                { blocked, appSession: true, deadlineProbe: true, days: 7 });
            await page.bringToFront();
            assert.equal(await page.evaluate(() => document.visibilityState), 'visible');
            assert.equal(await page.evaluate(() => window.EmployeeFormReadiness.FORM_READY), false);
            if (heldFrame) {
                blocked.resolve();
                await page.waitForFunction(stage => window.__heldReadinessFrame === stage, heldFrame);
                assert.equal(await page.evaluate(() => window.EmployeeFormReadiness.diagnostics().phase), 'render');
                assert.equal(await page.evaluate(() => window.EmployeeFormReadiness.FORM_READY), false);
            }
            await otherTab.bringToFront();
            assert.equal(await page.evaluate(() => document.visibilityState), 'hidden');
            if (!heldFrame) {
                assert.equal(await page.evaluate(() => window.EmployeeFormReadiness.FORM_READY), false);
                assert.equal(await page.locator('.tadded-container').evaluate(node => node.inert), true);
                blocked.resolve();
            }
            await page.waitForFunction(() => window.EmployeeFormReadiness.FORM_READY,
                null, { polling: 50, timeout: 10000 });
            assert.equal(await page.evaluate(() => document.visibilityState), 'hidden');
            assert.equal(await page.evaluate(() => window.__employeeReadyEvents), 1);
            await page.bringToFront();
            assert.equal(await page.evaluate(() => document.visibilityState), 'visible');
            assert.equal(await page.locator('.tadded-container').evaluate(node => node.inert), false);
            assert.equal(await page.evaluate(() => window.__employeeReadyEvents), 1);
            await page.evaluate(() => window.__initializationDeadline.abort());
            assert.equal(await page.evaluate(() => window.EmployeeFormReadiness.FORM_READY), true);
            assert.deepEqual(errors, []);
            console.log('REAL_TAB_READINESS', JSON.stringify({ form, heldFrame, readyEvents: 1,
                chromium: browser.version(), visibility: 'visible -> hidden -> visible' }));
            await page.close();
        }
    });

async function fixture(browser, form, { failure = '', blocked = null, optionalBlocked = null, deadlineProbe = false, holiday = false, slow = false, days = 2, appSession = false, baseline = false, earlySession = false, storedSchedule = false, chainProbe = false } = {}) {
    const sources = new Map();
    if (appSession || process.env.PAYROLL_TOM_SOURCE_DIR) for (const name of [...(process.env.PAYROLL_TOM_LAYOUT_PROFILE ? ['common/formLayout'] : []), 'ergazomenoi/genika/selectRepo', 'app', 'dropdownManager', 'dropdown-item', 'geoDropdownChain', 'efkaDropdownChain', 'symbaseisDropdownChain3', 'profTrainingDropdownChain']) {
        const file = 'public/js/' + name + '.js';
        sources.set('/static/js/' + name + '.js', process.env.PAYROLL_TOM_SOURCE_DIR
            ? fs.readFileSync(path.join(process.env.PAYROLL_TOM_SOURCE_DIR, file), 'utf8') : baseline
            ? execFileSync('git', ['show', 'e956f2e99fb1de66bc5c00990d157b0c243729b4:' + file], { cwd: root, encoding: 'utf8' })
            : fs.readFileSync(path.join(root, file), 'utf8'));
    }
    const page = await browser.newPage();
    let httpRequests = 0, httpGetRequests = 0;
    page.on('request', request => { httpRequests++; if (request.method() === 'GET') httpGetRequests++; });
    const profileSession = process.env.PAYROLL_TOM_LAYOUT_PROFILE && appSession ? await page.context().newCDPSession(page) : null;
    const detailedProfile = profileSession && storedSchedule && process.env.PAYROLL_TOM_LAYOUT_TRACE;
    if (profileSession) await profileSession.send('Performance.enable');
    if (detailedProfile) {
        await profileSession.send('Profiler.enable');
        await profileSession.send('Profiler.setSamplingInterval', { interval: 1000 });
        await profileSession.send('Profiler.start');
        await profileSession.send('Tracing.start', { categories: 'devtools.timeline,disabled-by-default-devtools.timeline.stack,blink.user_timing', transferMode: 'ReturnAsStream' });
    }
    const finishProfile = async scenario => {
        if (!profileSession) return {};
        const raw = Object.fromEntries((await profileSession.send('Performance.getMetrics')).metrics.map(item => [item.name, item.value]));
        const metrics = { layoutMs: raw.LayoutDuration * 1000, recalcStyleMs: raw.RecalcStyleDuration * 1000,
            layoutCount: raw.LayoutCount, recalcStyleCount: raw.RecalcStyleCount, scriptMs: raw.ScriptDuration * 1000, taskMs: raw.TaskDuration * 1000 };
        if (detailedProfile) {
            const label = process.env.PAYROLL_TOM_SOURCE_DIR ? 'before' : 'after';
            const profile = await profileSession.send('Profiler.stop');
            fs.writeFileSync(`/tmp/payroll-performance-03-${label}-${scenario}-cpu.json`, JSON.stringify(profile.profile));
            const completed = new Promise(resolve => profileSession.once('Tracing.tracingComplete', resolve));
            await profileSession.send('Tracing.end');
            const { stream } = await completed;
            let trace = '';
            for (;;) { const part = await profileSession.send('IO.read', { handle: stream }); trace += part.data; if (part.eof) break; }
            await profileSession.send('IO.close', { handle: stream });
            fs.writeFileSync(`/tmp/payroll-performance-03-${label}-${scenario}-trace.json`, trace);
        }
        return metrics;
    };
    if (slow) {
        const session = await page.context().newCDPSession(page);
        await session.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    }
    await page.addInitScript(trackChains => {
        if (trackChains) {
            window.__chainCalls = {};
            Object.defineProperty(HTMLSelectElement.prototype, '__onItemAddChain', {
                configurable: true,
                get() { return this.__measuredChain; },
                set(callback) {
                    const id = this.id;
                    this.__measuredChain = function(...args) {
                        window.__chainCalls[id] = (window.__chainCalls[id] || 0) + 1;
                        return callback.apply(this, args);
                    };
                }
            });
        }
        window.__longTasks = [];
        new PerformanceObserver(list => { window.__longTasks.push(...list.getEntries().map(entry => ({ startTime: entry.startTime, duration: entry.duration }))); }).observe({ type: 'longtask', buffered: true });
        window.__employeeReadyEvents = 0;
        document.addEventListener('employeeform:ready', () => window.__employeeReadyEvents++);
    }, chainProbe);
    const errors = [], consoleErrors = [], requests = [], values = new Map();
    if (deadlineProbe) await page.addInitScript(() => {
        const original = AbortSignal.timeout.bind(AbortSignal);
        window.__initializationDeadline = new AbortController();
        AbortSignal.timeout = ms => ms === 20000 ? window.__initializationDeadline.signal : original(ms);
    });
    let attempt = 0;
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
        if (message.type() === 'error' && !message.text().startsWith('Failed to load resource:')) consoleErrors.push(message.text());
    });
    const file = `views/ergazomenoi/ergazomenoi/${form}.ejs`;
    const data = dataFor(file);
    data.ergazomenoiData = { ...data.ergazomenoiData, energos: true,
        hmeromhnia_allaghs_orarioy_apo: '2026-10-01', hmeromhnia_allaghs_orarioy_eos: '2026-10-' + String(days).padStart(2, '0'),
        hmeromhnia_isxyos_oron_ergasias_apo: '2026-10-01',
        hmeres_ergasias_ebdomadas: 5, ores_ergasias_ebdomadas: 40, mo_oron_hmerhsias_ergasias: 8,
        fylo: true, doy: '001' };
    if (slow || chainProbe) for (const id of chainIds) { data.ergazomenoiData[id] = '001'; data.ergazomenoiData[id + '_stathera'] = '001'; }
    data.rec = data.ergazomenoiData;
    if (holiday) data.companyData = { ...data.companyData, apasxolhsh_kata_tis_argies: false };
    let html = await ejs.renderFile(path.join(root, file), data);
    html = html.replace(/(<input\b(?=[^>]*\bid="doy_stathera")[^>]*\bvalue=")[^"]*/g, (_, prefix) => prefix + '001');
    html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, tag => {
        if (tag.includes('const pending = new Set()')) return tag;
        const name = /src="\/static\/js\/([^"]+)\.js"/.exec(tag)?.[1];
        return scripts.has(name) ? tag : '';
    });
    if (appSession) html += '<input id="probeDefault" type="hidden" value="007"><input id="probeBranch" type="hidden" value="0001"><select id="performance-filter-probe" class="tom-dropdown" data-api="/api/dropdown/performance-probe" data-preselect="probeDefault" data-extra-filter="probeBranch" data-xrhsh-related="true" data-team-related="true" data-company-related="true"></select>';
    const instrumentation = `<script>
        window.__tomMetrics = { creates: 0, destroys: 0, byId: {}, methodCalls: {}, methodMs: {} };
        window.TomSelect = new Proxy(window.TomSelect, { construct(target, args) {
            const instance = Reflect.construct(target, args);
            const metrics = window.__tomMetrics;
            for (const name of ['refreshOptions', 'setActiveOption', 'scrollToOption']) {
                const original = instance[name];
                instance[name] = function(...args) {
                    metrics.methodCalls[name] = (metrics.methodCalls[name] || 0) + 1;
                    const started = performance.now();
                    try { return original.apply(this, args); }
                    finally { metrics.methodMs[name] = (metrics.methodMs[name] || 0) + performance.now() - started; }
                };
            }
            metrics.creates++;
            metrics.byId[instance.input.id] = (metrics.byId[instance.input.id] || 0) + 1;
            const destroy = instance.destroy;
            instance.destroy = function(...args) { metrics.destroys++; return destroy.apply(this, args); };
            return instance;
        }});
    </script>`;
    const sidebar = '<aside id="sidebarMenu" style="width:240px;position:fixed;inset:0 auto 0 0">Συνθετικό μενού</aside>';
    html = `<!doctype html><html><head><meta charset="utf-8"><meta name="csrf-token" content="synthetic"><meta name="user-id" content="SYNTHETIC_USER"><link rel="stylesheet" href="/static/css/bootstrap.min.css"><link rel="stylesheet" href="/static/css/main.css"><link rel="stylesheet" href="/vendor/tom-select.css"><script src="/vendor/tom-select.complete.js"></script>${instrumentation}${appSession ? '<script type="module" src="/static/js/app.js"></script>' : ''}</head><body data-mode="${form}" data-context="ergazomenoi">${loaderMarkup}<script>${loaderScript}</script>${sidebar}<main class="payroll-form-layout" style="margin-left:240px">${html}</main>${optionalBlocked ? '<script>fetch("/api/optional-metadata").catch(() => {});</script>' : ''}<script src="/static/js/common/formLayout.js"></script></body></html>`;
    await page.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.origin !== origin) return route.abort();
        if (url.pathname === '/fixture') { attempt++; return route.fulfill({ contentType: 'text/html', body: html }); }
        if (url.pathname.startsWith('/static/')) {
            if (failure === 'script' && attempt === 1 && url.pathname.endsWith('/date_sync_edit.js')) return route.fulfill({ status: 503, body: '' });
            if (earlySession && url.pathname.endsWith('/common/initTomDropdown.js')) await new Promise(resolve => setTimeout(resolve, 300));
            const target = path.join(root, 'public', url.pathname.slice('/static/'.length));
            if (!fs.existsSync(target)) return route.abort();
            if (sources.has(url.pathname)) return route.fulfill({ contentType: 'text/javascript', body: sources.get(url.pathname) });
            return route.fulfill({ path: target });
        }
        if (url.pathname.startsWith('/vendor/')) return route.fulfill({ path: path.join(vendor, path.basename(url.pathname)) });
        requests.push({ url: url.pathname + url.search, attempt });
        if (slow) await new Promise(resolve => setTimeout(resolve, 250));
        if (url.pathname === '/api/optional-metadata') { await optionalBlocked.promise; return route.fulfill({ status: 503, json: {} }); }
        if (url.pathname === '/api/session-data') return route.fulfill({ json: { sessionEtos: '2026', sessionTeam: 'SYNTHETIC_TEAM', sessionCompanyInUse: 'SYNTHETIC_COMPANY' } });
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
            return route.fulfill(failure === 'schedule' && attempt === 1 ? { status: 503, json: {} } : { json: storedSchedule ? Array.from({ length: days }, (_, i) => ({ hmeromhnia: '2026-10-' + String(i + 1).padStart(2, '0'), kathgoria_ergasias: 'ΕΡΓ', apo_ora_01: '08:00', eos_ora_01: '16:00' })) : [] });
        }
        if (url.pathname === '/api/checkArgies') return route.fulfill({ json: holiday ? [{ date: '2026-10-01', description: 'Συνθετική αργία' }] : [] });
        return route.abort();
    });
    await page.goto(origin + '/fixture', { waitUntil: 'domcontentloaded' });
    return { page, errors, consoleErrors, requests, values, finishProfile, get httpGetRequests() { return httpGetRequests; }, get httpRequests() { return httpRequests; }, setBlocked(value) { blocked = value; } };
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
            assert.equal(await page.locator('[data-employee-form-loading-panel]').isHidden(), true);
            assert.equal(await page.locator('[data-employee-form-loading-panel]').evaluate(e => e.getBoundingClientRect().height), 0);
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


test('performance: one Tom Select per employee field with session, defaults and live chain filters', { skip: !vendor, timeout: 120000 }, async t => {
    const browser = await chromium.launch({ headless: true }); t.after(() => browser.close());
    const baseline = process.env.PAYROLL_TOM_BASELINE === '1';
    for (const scenario of ['add', 'edit', ...(process.env.PAYROLL_TOM_PERFORMANCE_02 ? ['edit-stored'] : [])]) {
        const form = scenario === 'add' ? 'add' : 'edit';
        const storedSchedule = scenario === 'edit-stored';
        const run = await fixture(browser, form, { slow: true, days: 31, appSession: true, baseline, storedSchedule });
        const { page, requests, errors } = run;
        await page.waitForFunction(() => window.EmployeeFormReadiness.FORM_READY, null, { timeout: 25000 });
        // Include late session initialization in both measurements.
        await page.waitForFunction(() => window.getSessionContext?.().team === 'SYNTHETIC_TEAM');
        await page.waitForTimeout(500);
        const metrics = await page.evaluate(() => ({ ...window.__tomMetrics,
            readyMs: window.EmployeeFormReadiness.diagnostics().readyMs,
            readyEvents: window.__employeeReadyEvents,
            active: document.querySelectorAll('.ts-wrapper').length,
            longTasks: window.__longTasks.filter(task => task.startTime <= window.EmployeeFormReadiness.diagnostics().readyMs).length,
            longTaskMs: window.__longTasks.filter(task => task.startTime <= window.EmployeeFormReadiness.diagnostics().readyMs).reduce((sum, task) => sum + task.duration, 0) }));
        const layoutMetrics = await run.finishProfile(scenario);
        const counts = new Map();
        for (const request of requests.filter(r => r.url.includes('/dropdown/'))) counts.set(request.url, (counts.get(request.url) || 0) + 1);
        const duplicates = [...counts].filter(([, count]) => count > 1);
        console.log('TOM_PERFORMANCE', JSON.stringify({ baseline, form, scenario, source: process.env.PAYROLL_TOM_SOURCE_DIR ? 'performance01' : 'current', duplicateRequests: duplicates.reduce((sum, [, count]) => sum + count - 1, 0), duplicateUrls: duplicates, categoryRequests: requests.filter(r => r.url.includes('/kathgoria_ergasias?')).length, cpuRate: 4, apiDelayMs: 250,
            days: 31, ...metrics, ...layoutMetrics, byId: undefined, httpGetRequests: run.httpGetRequests, httpRequests: run.httpRequests, apiRequests: requests.length, errors, consoleErrors: run.consoleErrors }));
        assert.equal(metrics.readyEvents, 1);
        assert.deepEqual(errors, []);
        assert.deepEqual(run.consoleErrors, []);
        for (const width of [1280, 1920]) for (const open of [true, false]) {
            await viewport(page, width, width === 1280 ? 720 : 1080, open);
            await settleLayout(page);
            assert.equal(await page.locator('.tadded-container').evaluate(el => el.inert), false);
            assert.equal(await page.locator('#doy').evaluate(el => el.tomselect.wrapper.getBoundingClientRect().width > 0), true);
            await page.screenshot({ path: `/tmp/payroll-performance-${process.env.PAYROLL_TOM_LAYOUT_PROFILE ? '03' : process.env.PAYROLL_TOM_PERFORMANCE_02 ? '02' : '01'}-${process.env.PAYROLL_TOM_SOURCE_DIR || baseline ? 'before' : 'after'}-${scenario}-${width}-${open}.png` });
        }
        if (!baseline) {
            if (process.env.PAYROLL_TOM_PERFORMANCE_02 && !process.env.PAYROLL_TOM_SOURCE_DIR) {
                assert.deepEqual(duplicates, []);
                if (storedSchedule) assert.equal(requests.filter(r => r.url.includes('/kathgoria_ergasias?')).length, 1);
            }
            if (storedSchedule) {
                for (let day = 1; day <= 31; day++) assert.equal(await page.locator('#kathgoria_ergasias_' + String(day).padStart(2, '0')).evaluate(el => el.tomselect.getValue()), 'ΕΡΓ');
            }
            assert.equal(metrics.destroys, 0);
            assert.equal(metrics.creates, metrics.active);
            assert.ok(Object.values(metrics.byId).every(count => count === 1));
            assert.equal(await page.locator('#doy').evaluate(el => el.tomselect.getValue()), '001');
            for (const id of chainIds) assert.equal(await page.locator('#' + id).evaluate(el => el.tomselect.getValue()), '001', id);
            const probe = requests.find(r => r.url.includes('/performance-probe?') && r.url.includes('value=007'));
            assert.ok(probe, 'session-aware preselection');
            const params = new URL(probe.url, origin).searchParams;
            assert.equal(params.get('team'), 'SYNTHETIC_TEAM');
            assert.equal(params.get('company'), 'SYNTHETIC_COMPANY');
            assert.equal(params.get('xrhsh'), '2026');
            await page.evaluate(async () => {
                const { initDropdowns, updateFilter } = await import('/static/js/dropdownManager.js');
                const before = document.querySelector('#performance-filter-probe').tomselect;
                initDropdowns(); initDropdowns();
                window.__sameProbe = before === document.querySelector('#performance-filter-probe').tomselect;
                Object.assign(window.getSessionContext(), { company: 'NEXT_COMPANY', team: 'NEXT_TEAM', xrhsh: '2027' });
                document.querySelector('#probeBranch').value = '0002';
                updateFilter('company', 'NEXT_COMPANY');
                await new Promise(resolve => setTimeout(resolve, 200));
                await new Promise(resolve => before.settings.load.call(before, 'session-probe', resolve));
            });
            assert.equal(await page.evaluate(() => window.__sameProbe), true);
            const updated = requests.find(r => r.url.includes('search=session-probe'));
            assert.ok(updated);
            const next = new URL(updated.url, origin).searchParams;
            for (const [key, value] of Object.entries({ company: 'NEXT_COMPANY', team: 'NEXT_TEAM', xrhsh: '2027', probeBranch: '0002' })) assert.equal(next.get(key), value, key);
            // Exercise the real chain callbacks and their mutable parameter objects.
            await page.evaluate(async () => {
                for (const id of ['perifereia', 'kad_efka', 'symbash']) {
                    const node = document.getElementById(id);
                    node.__onItemAddChain('002', node.tomselect);
                }
                await new Promise(resolve => setTimeout(resolve, 200));
                for (const id of ['nomos', 'eidikothta_efka', 'kathgoria_symbashs']) {
                    const ts = document.getElementById(id).tomselect;
                    await new Promise(resolve => ts.settings.load.call(ts, 'chain-probe', resolve));
                }
            });
            for (const [endpoint, key] of [['/ergazomenoi/nomos', 'perifereia'], ['/ergazomenoi/eidikothta_efka', 'kad'], ['/symbaseis/kathgoria_symbashs', 'symbash_stathera']]) {
                const request = requests.find(r => r.url.includes(endpoint) && r.url.includes('search=chain-probe'));
                assert.ok(request, endpoint);
                assert.equal(new URL(request.url, origin).searchParams.get(key), '002', key);
            }
            await page.evaluate(async () => {
                const ts = document.getElementById('ypokatasthma').tomselect;
                await new Promise(resolve => ts.settings.load.call(ts, 'branch-probe', resolve));
            });
            const branch = requests.find(r => r.url.includes('search=branch-probe'));
            assert.ok(branch);
            assert.equal(new URL(branch.url, origin).searchParams.get('company'), 'TEST');
            assert.equal(new URL(branch.url, origin).searchParams.get('team'), 'TEST');
            assert.equal(await page.evaluate(() => window.__tomMetrics.destroys), 0);
        }
        assert.deepEqual(errors, []);
        await page.close();
    }
});


test('early session waits for the employee DOM initializer without replacing its controls', { skip: !vendor, timeout: 15000 }, async t => {
    const browser = await chromium.launch({ headless: true }); t.after(() => browser.close());
    for (const form of ['add', 'edit']) {
        const { page, errors, consoleErrors } = await fixture(browser, form, { appSession: true, earlySession: true });
        await page.waitForFunction(() => window.EmployeeFormReadiness.FORM_READY);
        const state = await page.evaluate(() => ({ creates: window.__tomMetrics.creates,
            active: document.querySelectorAll('.ts-wrapper').length, destroys: window.__tomMetrics.destroys,
            readyEvents: window.__employeeReadyEvents,
            decorated: document.getElementById('asfalistikh_klash').tomselect.wrapper.classList.contains('dd-wide') }));
        assert.equal(state.destroys, 0);
        assert.equal(state.creates, state.active);
        assert.equal(state.readyEvents, 1);
        assert.equal(state.decorated, true);
        assert.deepEqual(errors, []);
        assert.deepEqual(consoleErrors, []);
        await page.close();
    }
});

test('out-of-order dropdown responses cannot overwrite a later user search', { skip: !vendor, timeout: 15000 }, async t => {
    const browser = await chromium.launch({ headless: true }); t.after(() => browser.close());
    const { page, errors } = await fixture(browser, 'edit', { appSession: true });
    await page.waitForFunction(() => window.EmployeeFormReadiness.FORM_READY);
    const result = await page.evaluate(async () => {
        const select = document.createElement('select'); select.id = 'stale-response-probe'; document.body.appendChild(select);
        const ts = window.initTomDropdown({ selector: '#stale-response-probe', url: '/api/dropdown/stale-response-probe' });
        const requests = [], callbacks = [];
        const original = window.fetch;
        window.fetch = (url, options) => String(url).includes('/stale-response-probe')
            ? new Promise(resolve => requests.push({ options, resolve })) : original(url, options);
        try {
            const old = ts.settings.load.call(ts, 'old-search', items => { callbacks.push('old'); if (items) ts.addOption(items); });
            while (requests.length < 1) await new Promise(resolve => setTimeout(resolve, 0));
            ts._lastLoadTime = 0;
            const fresh = ts.settings.load.call(ts, 'new-search', items => { callbacks.push('new'); if (items) ts.addOption(items); });
            while (requests.length < 2) await new Promise(resolve => setTimeout(resolve, 0));
            requests[1].resolve(new Response(JSON.stringify({ items: [{ value: 'new', label: 'Νέα επιλογή' }] })));
            await fresh;
            // Deliberately emulate a transport that ignores cancellation.
            requests[0].resolve(new Response(JSON.stringify({ items: [{ value: 'old', label: 'Παρωχημένη επιλογή' }] })));
            await old;
            return { oldAborted: requests[0].options.signal.aborted, hasOld: Boolean(ts.options.old), hasNew: Boolean(ts.options.new), callbacks };
        } finally { window.fetch = original; }
    });
    assert.equal(result.oldAborted, true);
    assert.equal(result.hasOld, false);
    assert.equal(result.hasNew, true);
    assert.deepEqual(result.callbacks, ['new', 'old']);
    assert.deepEqual(errors, []);
});


test('employee layout exposes the authenticated user even when controller locals contain only the title', async () => {
    const data = dataFor('views/ergazomenoi/ergazomenoi/edit.ejs');
    const html = await ejs.renderFile(path.join(root, 'views/layouts/main.ejs'), {
        ...data, locals: { title: 'Συνθετικός τίτλος', description: 'Συνθετική περιγραφή' }, body: '<p>Συνθετική φόρμα</p>'
    });
    assert.match(html, /<meta name="user-id" content="synthetic"/);
});


test('initial preselection calls each single chain once and later user selections still run', { skip: !vendor, timeout: 15000 }, async t => {
    const browser = await chromium.launch({ headless: true }); t.after(() => browser.close());
    const { page, errors } = await fixture(browser, 'edit', { appSession: true, chainProbe: true });
    await page.waitForFunction(() => window.EmployeeFormReadiness.FORM_READY);
    await page.waitForTimeout(100);
    for (const id of ['perifereia', 'kad_efka', 'symbash']) {
        assert.equal(await page.evaluate(id => window.__chainCalls[id], id), 1, id);
    }
    for (let expected = 2; expected <= 3; expected++) {
        await page.evaluate(() => {
            const ts = document.getElementById('perifereia').tomselect;
            ts.clear(); ts.addOption({ value: '002', label: 'Νέα περιφέρεια' }); ts.addItem('002');
        });
        await page.waitForFunction(count => window.__chainCalls.perifereia === count, expected);
    }
    assert.equal(await page.evaluate(() => window.__tomMetrics.destroys), 0);
    assert.deepEqual(errors, []);
});

test('employee dropdown keeps keyboard navigation, scroll, focus and tooltips across widths', { skip: !vendor, timeout: 60000 }, async t => {
    const browser = await chromium.launch({ headless: true }); t.after(() => browser.close());
    const items = Array.from({ length: 80 }, (_, i) => ({ value: String(i + 1).padStart(6, '0'), label: 'Συνθετικό έγγραφο ' + String(i + 1).padStart(3, '0') }));
    for (const form of ['add', 'edit']) {
        const { page, errors } = await fixture(browser, form);
        await page.waitForFunction(() => window.EmployeeFormReadiness.FORM_READY);
        await page.route('**/api/dropdown/nomimoiEkprosopoi/taytothta*', route => route.fulfill({ json: { items, hasMore: false } }));
        for (const width of [1280, 1920]) for (const open of [true, false]) {
            await viewport(page, width, width === 1280 ? 720 : 1080, open); await settleLayout(page);
            await page.locator('#typos_taytothtas').evaluate(el => {
                const ts = el.tomselect; ts.clear(); ts.clearOptions(); ts._lastLoadTime = 0; ts.enable();
                ts.wrapper.scrollIntoView({ block: 'center' }); ts.focus_node.focus(); ts.open();
            });
            await page.waitForFunction(() => document.getElementById('typos_taytothtas').tomselect.selectable().length === 80);
            await page.keyboard.press('Alt+ArrowUp');
            assert.equal(await page.locator('#typos_taytothtas').evaluate(el => el.tomselect.isOpen), false);
            assert.equal(await page.locator('#typos_taytothtas').evaluate(el => document.activeElement === el.tomselect.focus_node), true);
            await page.keyboard.press('F4');
            await page.waitForFunction(() => document.getElementById('typos_taytothtas').tomselect.isOpen);
            await page.locator('#typos_taytothtas').evaluate(el => el.tomselect.setActiveOption(el.tomselect.selectable()[60]));
            await page.keyboard.press('ArrowDown');
            // Η υφιστάμενη ομαλή κύλιση ολοκληρώνεται πριν μετρηθεί η ενεργή επιλογή.
            await page.waitForFunction(() => {
                const ts = document.getElementById('typos_taytothtas').tomselect;
                const item = ts.activeOption?.getBoundingClientRect(), content = ts.dropdown_content.getBoundingClientRect();
                return item && item.top >= content.top - 1 && item.bottom <= content.bottom + 1;
            }, null, { timeout: 3000 });
            const state = await page.locator('#typos_taytothtas').evaluate(el => {
                const ts = el.tomselect, item = ts.activeOption.getBoundingClientRect(), content = ts.dropdown_content.getBoundingClientRect(), menu = ts.dropdown.getBoundingClientRect();
                return { active: ts.activeOption.dataset.value, scrollTop: ts.dropdown_content.scrollTop, item: item.toJSON(), content: content.toJSON(), scrollHeight: ts.dropdown_content.scrollHeight, clientHeight: ts.dropdown_content.clientHeight,
                    contained: item.top >= content.top - 1 && item.bottom <= content.bottom + 1,
                    bounded: menu.left >= -1 && menu.right <= innerWidth + 1 && menu.top >= -1 && menu.bottom <= innerHeight + 1,
                    focused: document.activeElement === ts.control_input };
            });
            assert.equal(state.active, '000062'); assert.ok(state.scrollTop > 0); assert.ok(state.contained, JSON.stringify(state));
            assert.ok(state.bounded, JSON.stringify(state)); assert.equal(state.focused, true);
            await page.keyboard.press('Enter');
            await page.waitForFunction(() => document.getElementById('typos_taytothtas').tomselect.getValue() === '000062');
            assert.equal(await page.locator('#typos_taytothtas').evaluate(el => el.tomselect.isOpen), false);
            assert.equal(await page.locator('#typos_taytothtas').evaluate(el => el.tomselect.control.querySelector('.item').title), items[61].label);
        }
        assert.deepEqual(errors, []); await page.close();
    }
});

test('empty multiple dropdown avoids overflow geometry reads while retaining selection labels', { skip: !vendor, timeout: 15000 }, async t => {
    const browser = await chromium.launch({ headless: true }); t.after(() => browser.close());
    const { page, errors } = await fixture(browser, 'edit');
    await page.waitForFunction(() => window.EmployeeFormReadiness.FORM_READY);
    await page.evaluate(() => {
        window.__emptyGeometryReads = 0;
        const Base = window.TomSelect;
        window.TomSelect = new Proxy(Base, { construct(target, args) {
            const settings = args[1], initialize = settings.onInitialize;
            return Reflect.construct(target, [args[0], { ...settings, onInitialize() {
                const getter = Object.getOwnPropertyDescriptor(Element.prototype, 'clientWidth').get;
                Object.defineProperty(this.control, 'clientWidth', { get() { window.__emptyGeometryReads++; return getter.call(this); } });
                initialize.call(this);
            } }]);
        } });
        const select = document.createElement('select'); select.id = 'layout-empty-multi'; select.multiple = true;
        document.querySelector('.card-body').append(select);
        window.initTomDropdown({ selector: '#layout-empty-multi', url: '/api/dropdown/layout-empty' });
    });
    await page.waitForTimeout(120);
    assert.equal(await page.evaluate(() => window.__emptyGeometryReads), 0);
    await page.evaluate(() => {
        const ts = document.getElementById('layout-empty-multi').tomselect;
        ts.addOption({ value: 'one', label: 'Πλήρης ονομασία δοκιμαστικής επιλογής' }); ts.addItem('one');
    });
    await page.waitForTimeout(150);
    assert.ok(await page.evaluate(() => window.__emptyGeometryReads > 0));
    assert.equal(await page.locator('#layout-empty-multi').evaluate(el => el.tomselect.control.querySelector('.item').title), 'Πλήρης ονομασία δοκιμαστικής επιλογής');
    assert.deepEqual(errors, []);
});
