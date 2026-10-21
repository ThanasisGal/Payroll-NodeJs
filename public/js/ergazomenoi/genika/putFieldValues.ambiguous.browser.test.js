'use strict';
// Only two browser checks. Production GET, EJS, loader, Save function and
// transactional writer run with synthetic repositories; no application/DB starts.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const vm = require('node:vm');
const ejs = require('ejs');
const { chromium } = require('playwright');
const mongoose = require('mongoose');
const root = path.resolve(__dirname, '../../../..');
const vendor = process.env.PAYROLL_SWEETALERT_VENDOR_DIR;
const tomVendor = process.env.PAYROLL_PERIOD_EMPLOYEES_TOM_VENDOR_DIR || '/tmp/payroll-three-tabs-vendor';
const origin = 'https://payroll.test';
const read = file => fs.readFileSync(path.join(root, file), 'utf8').replaceAll('\r', '');
const { dataFor } = require('../../../../test/fixtures/responsiveForms');
const Models = require('../../../../server/models/ergazomenoi');
const W = require('../../../../server/services/ergazomenoi/employeeEmploymentProfileWriter');
const SaveState = require('../../../../server/utils/ergazomenoi/employeeSaveState');
const Authorization = require('../../../../server/services/ergazomenoi/employeeHistoryAuthorizationService');
const { fixture } = require('../../../../test/fixtures/employeeProfileTransactionStore');
// Reuse repository doubles and the actual controller through persistence. No
// pre-existing tests are registered or run by compiling only helper declarations.
const controllerFile = 'server/controllers/ergazomenoi/ergazomenoiController.employmentProfile.test.js';
const controllerTests = read(controllerFile);
const helperModule = new Module(path.join(root, controllerFile), module);
helperModule.filename = path.join(root, controllerFile);
helperModule.paths = Module._nodeModulePaths(path.dirname(helperModule.filename));
helperModule._compile(controllerTests.slice(0, controllerTests.indexOf("test('Maintenance submitted-field")) +
    controllerTests.slice(controllerTests.indexOf('function memory('), controllerTests.indexOf("test('clean EFKA")) +
    '\nmodule.exports = { memory, handler };', helperModule.filename);
const { memory, handler } = helperModule.exports;
const controllerSource = read('server/controllers/ergazomenoi/ergazomenoiController.js');
const editSource = controllerSource.slice(controllerSource.indexOf('    static editErgazomenoiForm = '),
    controllerSource.indexOf('    static getIstorikoData = ')).replace('    static editErgazomenoiForm = ', '').trim().replace(/;$/, '');
const saveSource = read('public/js/ergazomenoi/genika/putFieldValues.js');
const helpers = saveSource.slice(0, saveSource.indexOf("document.addEventListener('DOMContentLoaded'"));
const saveStart = saveSource.indexOf('    async function handleFormSubmit(event)');
const onceStart = saveSource.indexOf('    function handleFormSubmitOnce(', saveStart);
const saveFunction = saveSource.slice(saveStart, onceStart);
const onceFunction = saveSource.slice(onceStart, saveSource.indexOf('\n    }', onceStart) + 6);
const scripts = new Set(['common/initTomDropdown', 'geoDropdownChain', 'efkaDropdownChain',
    'symbaseisDropdownChain3', 'profTrainingDropdownChain', 'common/sectionsVisible',
    'ergazomenoi/genika/selectRepo', 'ergazomenoi/genika/getDaysFromDate',
    'ergazomenoi/genika/dailyRestValidation', 'ergazomenoi/genika/date_sync_edit',
    'ergazomenoi/genika/employeeAddPresentation', 'ergazomenoi/genika/employmentProfileUi']);
const query = value => ({ sort() { return this; }, select() { return this; }, session() { return this; },
    mongooseOptions() { return this; }, lean() { return this; }, exec: async () => value,
    then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); } });
function setup(ambiguous, admin) {
    const input = fixture('507f1f77bcf86cd799439199', { team: 'TEST', company_kod: '507f1f77bcf86cd799439198', kodikos: '0001' });
    Object.assign(input.employee, { oristikh_enhmerosh: true, eponymo: 'ΔΟΚΙΜΑΣΤΙΚΟΣ', onoma: 'ΕΡΓΑΖΟΜΕΝΟΣ',
        email: 'before@example.invalid', doy: '001', thesh_eythynhs: '1', hmeromhnia_allaghs_symbashs: '2026-03-01',
        hmeromhnia_allaghs_orarioy_apo: '2026-03-01', hmeromhnia_allaghs_orarioy_eos: '2026-03-02' });
    input.employee = JSON.parse(JSON.stringify(new Models.ErgazomenoiModel(input.employee).toObject()));
    Object.assign(input.history[2], { hmeromhnia_allaghs_symbashs: '2026-03-01',
        hmeromhnia_allaghs_orarioy_apo: '2026-03-01', hmeromhnia_allaghs_orarioy_eos: '2026-03-02' });
    if (ambiguous) input.history.push({ ...input.history[2], _id: '507f1f77bcf86cd799439299',
        aa_eggrafhs: '0004', pragmatikosMisthos: 1900 });
    const db = memory(input);
    db.deps.userModel = { findById: () => query({ team: 'TEST', situation: 'A', privileges: admin ? 'A' : 'U' }) };
    db.deps.scheduleModel = { find: () => query([]) };
    const context = { SaveState, Date, console, mongoose,
        ...require('../../../../server/services/ergazomenoi/employeeHistoryEditorStateService'),
        ...require('../../../../server/services/ergazomenoi/employeeMaintenanceHistoryPlannerService'),
        ...require('../../../../server/utils/date/mondaySundayWeek'),
        ...require('../../../../server/utils/ergazomenoi/employmentProfileMaintenance'),
        ...require('../../../../server/utils/ergazomenoi/employmentHistoryCanonicalStatus'),
        ...Authorization, selectMaintenanceMode: W.selectMaintenanceMode,
        getEmployeeHistoryAccess: async () => ({ mode: admin ? 'ADMIN_FULL' : 'NONE' }),
        CompaniesModel: { findById: () => query({ apasxolhsh_kata_tis_argies: true }) },
        ErgazomenoiModel: { findOne: () => query(db.state().employee) },
        IstorikoProslhpseonAllagonModel: { find: () => query(db.state().history) },
        PerifereiesModel: { find: () => query([]) }, GenikesParametroiModel: { find: () => query([]) },
        ProdhlomenaOrariaModel: { find: () => query([]) }, ProgrammataDypaModel: { findOne: () => query(null) },
        enrichIstorikoRowsForDetails: async rows => rows,
        getEmploymentProfileUiContext: async () => ({ types: [], categories: [] }) };
    const edit = vm.runInNewContext(`(${editSource})`, context);
    const post = handler('edit', db);
    return { db, edit, post, id: input.employee._id, session: { userId: 'synthetic-actor',
        userTeam: 'TEST', companyInUse: input.employee.company_kod, yearInUse: 2026 } };
}
async function renderGet(state, search) {
    const response = { code: 200, status(code) { this.code = code; return this; }, render(view, locals) { this.view = view; this.locals = locals; } };
    await state.edit({ params: { id: state.id }, query: Object.fromEntries(search), session: state.session }, response,
        error => { throw error; });
    let html = await ejs.renderFile(path.join(root, 'views', response.view + '.ejs'),
        { ...dataFor('views/ergazomenoi/ergazomenoi/edit.ejs'), ...response.locals });
    html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, tag => {
        if (tag.includes('const pending = new Set()')) return tag;
        const name = /src="\/static\/js\/([^"]+)\.js"/.exec(tag)?.[1];
        return scripts.has(name) ? tag : '';
    });
    return { code: response.code, html: `<!doctype html><html lang="el"><head><meta charset="utf-8"><meta name="csrf-token" content="synthetic">
        <link rel="stylesheet" href="/static/css/bootstrap.min.css"><link rel="stylesheet" href="/static/css/main.css">
        <link rel="stylesheet" href="/vendor/tom-select.css"><script src="/vendor/tom-select.complete.js"></script></head>
        <body data-mode="edit" data-context="ergazomenoi"><main class="payroll-form-layout">${html}</main><script src="/static/js/common/formLayout.js"></script></body></html>` };
}
for (const width of [1280, 1920]) test(`full ambiguous Maintenance continuation, save and approved Swal at ${width}px`, { timeout: 60000 }, async () => {
    assert.ok(vendor, 'Provide isolated SweetAlert2 11.26.25 through PAYROLL_SWEETALERT_VENDOR_DIR');
    const browser = await chromium.launch({ headless: true });
    try {
        for (const ambiguous of [true, false]) {
            const state = setup(ambiguous, width === 1920), before = structuredClone(state.db.state());
            const page = await browser.newPage({ viewport: { width, height: 900 } });
            page.setDefaultTimeout(10000);
            const posts = [], errors = [], gets = [];
            page.on('pageerror', error => errors.push(error.message));
            await page.addInitScript(() => { window.readyCount = 0;
                document.addEventListener('employeeform:ready', () => window.readyCount++); });
            await page.route('**/*', async route => {
                const request = route.request(), url = new URL(request.url());
                if (url.origin !== origin) return route.abort();
                if (url.pathname.startsWith('/static/')) return route.fulfill({ path: path.join(root, 'public', url.pathname.slice(8)) });
                if (url.pathname.startsWith('/vendor/')) return route.fulfill({ path: path.join(tomVendor, path.basename(url.pathname)) });
                if (request.method() === 'POST' && url.pathname.startsWith('/api/ergazomenoi/update/')) {
                    const body = request.postDataJSON(); posts.push(body);
                    const response = { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
                    await state.post({ body, params: { ergazomenoiId: state.id }, session: state.session }, response);
                    if (state.db.departureError) {
                        const intent = require('../../../../server/utils/ergazomenoi/employeeMaintenanceIntent')
                            .normalizeEmployeeMaintenanceIntent(state.db.compositeRequest, before.employee);
                        console.log('Synthetic normalized changes:', JSON.stringify({ input: intent.input,
                            employee: intent.maintenance.employeeChanges, history: intent.maintenance.historyChanges }));
                    }
                    return route.fulfill({ status: response.code, json: response.body });
                }
                if (url.pathname.startsWith('/ergazomenoi/ergazomenoi/edit/')) {
                    gets.push(url.pathname + url.search);
                    const result = await renderGet(state, url.searchParams);
                    return route.fulfill({ status: result.code, contentType: 'text/html', body: result.html });
                }
                if (url.pathname === '/ergazomenoi/ergazomenoi') return route.fulfill({ contentType: 'text/html', body: '<p>Συνθετικός κατάλογος</p>' });
                if (url.pathname.includes('/dropdown/')) {
                    const value = url.searchParams.get('value');
                    return route.fulfill({ json: { items: value ? [{ value, label: 'Συνθετική επιλογή' }] : [], hasMore: false } });
                }
                if (url.pathname === '/api/dateDifference') return route.fulfill({ json: { differenceInDays: 2 } });
                if (url.pathname === '/api/getProdhlomenaOraria' || url.pathname === '/api/checkArgies') return route.fulfill({ json: [] });
                return route.abort();
            });
            await page.goto(`${origin}/ergazomenoi/ergazomenoi/edit/${state.id}`);
            assert.equal(gets.length, 1);
            if (ambiguous) assert.equal(await page.locator('#istorikoId').inputValue(), '');
            await page.waitForFunction(() => document.querySelector('[data-employee-form-state]')?.dataset.employeeFormState === 'ready');
            assert.equal(await page.evaluate(() => window.readyCount), 1);
            assert.equal(await page.locator('#ergazomenoiId').inputValue(), state.id);
            assert.equal(await page.locator('.tadded-container').evaluate(e => e.inert), false);
            assert.ok(await page.locator('.sections > section').count() >= 8);
            await page.addStyleTag({ path: path.join(vendor, 'sweetalert2.css') });
            await page.addScriptTag({ path: path.join(vendor, 'sweetalert2.all.js') });
            assert.equal(await page.evaluate(() => Swal.version), '11.26.25');
            await page.addScriptTag({ content: helpers + `
                const isEmpty = value => !String(value ?? '').trim();
                const isRehireDraftMode = false;
                let message = '';
                async function blockSaveForDailyRestViolation() { return false; }
                window.pdfUploadModule = { getFileAsBase64: async () => null, hasPendingUpload: () => false };
                window.employeeSaveBaseline = () => ({ expectedEmployeeStateToken: ${JSON.stringify(SaveState.employeeStateToken(before.employee))} });
                const runFormSubmissionOnce = createSingleFlight();
                ${saveFunction}
                ${onceFunction}
                document.querySelectorAll('.submitButton').forEach(button => button.addEventListener('click', handleFormSubmitOnce));
            ` });
            await page.locator('#energos').uncheck();
            await page.locator('#email').fill('saved@example.invalid');
            await page.locator('.submitButton:not([data-save-mode="temporary"])').first().click();
            for (let step = 0; step < 4; step++) {
                await page.locator('.swal2-confirm:visible').waitFor();
                const title = await page.locator('.swal2-title').textContent();
                if (title === 'ΠΡΟΣΟΧΗ !!!') {
                    await page.locator('.swal2-confirm').click();
                    await page.waitForFunction(previous => Swal.getTitle()?.textContent !== previous, title);
                } else if (title === 'Ελλιπές Εβδομαδιαίο Ωράριο') {
                    await page.locator('.swal2-confirm').filter({ hasText: 'Συνέχεια' }).click();
                    await page.waitForFunction(previous => Swal.getTitle()?.textContent !== previous, title);
                } else break;
            }
            await page.locator('.swal2-confirm').filter({ hasText: 'Ενημέρωση' }).click();
            if (ambiguous) {
                await page.waitForFunction(() => ['Η αποθήκευση ολοκληρώθηκε', 'Αποτυχία αποθήκευσης'].includes(Swal.getTitle()?.textContent));
                assert.equal(await page.locator('.swal2-title').textContent(), 'Η αποθήκευση ολοκληρώθηκε', JSON.stringify({ responseError: state.db.departureError?.code, field: state.db.departureError?.field, detail: state.db.departureError?.message }));
                await page.waitForFunction(() => { const popup = Swal.getPopup(); return popup && getComputedStyle(popup).opacity === '1' && popup.getAnimations().every(animation => animation.playState === 'finished'); });
                assert.equal(state.db.state().employee.email, 'saved@example.invalid');
                assert.deepEqual(state.db.state().history, before.history);
                assert.equal(posts.length, 1);
                assert.equal(await page.locator('.swal2-html-container').textContent(), 'Τα στοιχεία του εργαζομένου αποθηκεύτηκαν επιτυχώς. Το εργασιακό ιστορικό δεν ενημερώθηκε λόγω ασυμφωνίας στις ιστορικές εγγραφές. Απαιτείται έλεγχος από διαχειριστή.');
                assert.equal(await page.locator('.swal2-actions button:visible').count(), 1);
                assert.equal(await page.locator('.swal2-confirm').textContent(), 'Κλείσιμο');
                assert.match(await page.locator('.swal2-confirm').getAttribute('class'), /class-info custom-confirm-button custom-swal-button/);
                assert.equal(await page.locator('.swal2-popup').evaluate(e => e.classList.contains('employee-maintenance-swal')), true);
                const button = await page.locator('.swal2-confirm').boundingBox(), popup = await page.locator('.swal2-popup').boundingBox();
                assert.ok(Math.abs(button.x + button.width / 2 - popup.x - popup.width / 2) < 2);
                await page.screenshot({ path: `/tmp/payroll-ambiguous-swal-11.26.25/verified-${width}.png` });
                await page.locator('.swal2-confirm').click();
            } else {
                await page.waitForFunction(() => Swal.getTitle()?.textContent === 'Επιτυχής καταχώριση!');
                assert.equal(state.db.state().employee.email, 'saved@example.invalid');
                assert.deepEqual(state.db.state().history, before.history);
            }
            assert.equal(state.db.state().employee.energos, false);
            await page.goto(origin + '/ergazomenoi/ergazomenoi/edit/' + state.id);
            await page.waitForFunction(() => document.querySelector('[data-employee-form-state]')?.dataset.employeeFormState === 'ready');
            assert.equal(await page.locator('#energos').isChecked(), false);
            assert.equal(await page.locator('#energos').isEnabled(), true);
            assert.deepEqual(errors, []);
            await page.close();
        }
    } finally { await browser.close(); }
});
