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
const { readOnlyHistoryDisplayVmRequire } =
    require('../../../../test/fixtures/employeeHistoryControllerVmRequirements');
// Reuse repository doubles and the actual controller through persistence. No
// pre-existing tests are registered or run by compiling only helper declarations.
const controllerFile = 'server/controllers/ergazomenoi/ergazomenoiController.employmentProfile.test.js';
const controllerTests = read(controllerFile)
    .replace('correctionCatalogLoader: async () => ({})',
        'correctionCatalogLoader: async () => db.correctionCatalogs || ({})')
    .replace("SaveState: require('../../utils/ergazomenoi/employeeSaveState'), buildEmployeeDraftSchedules:",
        "HistoryDeferral: require('../../services/ergazomenoi/employeeHistoryDeferralService'),\n        SaveState: require('../../utils/ergazomenoi/employeeSaveState'), buildEmployeeDraftSchedules:");
const helperModule = new Module(path.join(root, controllerFile), module);
helperModule.filename = path.join(root, controllerFile);
helperModule.paths = Module._nodeModulePaths(path.dirname(helperModule.filename));
helperModule._compile(controllerTests.slice(0, controllerTests.indexOf("test('Maintenance submitted-field")) +
    controllerTests.slice(controllerTests.indexOf('function memory('), controllerTests.indexOf("for (const mode of ['add', 'edit'])")) +
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
    'ergazomenoi/genika/employeeAddPresentation', 'ergazomenoi/genika/logos_peratoshs', 'ergazomenoi/genika/employmentProfileUi']);
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
    db.correctionCatalogs = require('../../../../test/fixtures/employee0002HistoryProposalFixture').catalogs;
    db.deps.userModel = { findById: () => query({ team: 'TEST', situation: 'A', privileges: admin ? 'A' : 'U' }) };
    db.deps.scheduleModel = { find: () => query([]) };
    const context = { require: readOnlyHistoryDisplayVmRequire(), SaveState, Date, console, mongoose,
        ...require('../../../../server/services/ergazomenoi/employeeHistoryEditorStateService'),
        ...require('../../../../server/services/ergazomenoi/employeeMaintenanceHistoryPlannerService'),
        ...require('../../../../server/utils/date/mondaySundayWeek'),
        ...require('../../../../server/utils/ergazomenoi/employmentProfileMaintenance'),
        ...require('../../../../server/utils/ergazomenoi/employmentHistoryCanonicalStatus'),
        ...Authorization,
        sortHistoryForPresentation: require('../../../../server/utils/ergazomenoi/employmentHistoryPresentation').sortHistoryForPresentation,
        selectMaintenanceMode: W.selectMaintenanceMode,
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
            const posts = [], responses = [], errors = [], gets = [];
            const __c3PreflightReplies = [];
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
                    await state.post({ body, params: { ergazomenoiId: state.id }, session: state.session,
                        sessionID: 'synthetic-correction3-' + width }, response);
                    __c3PreflightReplies.push({
                        httpStatus: response.code,
                        success: response.body?.success,
                        preflight: response.body?.preflight,
                        status: response.body?.status,
                        reason: response.body?.reason
                    });
                    responses.push({ httpStatus: response.code, ...Object.fromEntries(
                        ['success', 'preflight', 'status', 'reason', 'historyDeferred']
                            .map(field => [field, response.body?.[field] ?? null])) });
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
                // CORRECTION3_UNSAFE_HISTORY_PREFLIGHT_ASSERTIONS_20261120
                // This fixture deliberately contains two conflicting physical History
                // records. That is STRUCTURAL UNSAFETY, not a missing profile field.
                // The server MUST refuse to offer "Continue" and MUST write nothing.
                await page.locator('.swal2-title')
                    .filter({ hasText: 'Η αποθήκευση χρειάζεται έλεγχο' })
                    .waitFor({ state: 'visible', timeout: 5000 });
                assert.equal((await page.locator('.swal2-title').innerText()).trim(),
                    'Η αποθήκευση χρειάζεται έλεγχο');
                assert.equal(__c3PreflightReplies.length, 1,
                    'unsafe History must have precisely one read-only preflight');
                assert.deepEqual(__c3PreflightReplies[0], {
                    httpStatus: 200, success: false, preflight: true,
                    status: 'UNSAFE_HISTORY_CHANGE',
                    reason: 'EMPLOYEE_HISTORY_MANUAL_REVIEW_REQUIRED'
                });
                assert.equal(posts.length, 1);
                assert.equal(posts[0].historyPreflight, true);
                assert.equal(posts[0].historyDecision, undefined,
                    'structurally unsafe preflight cannot be confirmed');
                assert.equal(await page.locator('.swal2-actions button:visible').count(), 1,
                    'structurally unsafe History permits only Return, never Continue');
                assert.equal((await page.locator('.swal2-confirm').innerText()).trim(),
                    'Επιστροφή για διόρθωση');
                assert.equal(await page.locator('.swal2-deny:visible').count(), 0);
                assert.equal(await page.locator('.swal2-cancel:visible').count(), 0);
                assert.deepEqual(state.db.state(), before,
                    'Employee, every physical History record and audits must remain identical');
                assert.equal(state.db.writes(), 0,
                    'preflight must perform zero repository writes');
                assert.equal(await page.locator('#email').inputValue(), 'saved@example.invalid',
                    'Return must preserve the submitted form input');
                assert.deepEqual(errors, []);
                await page.locator('.swal2-confirm').click();
                assert.equal(await page.locator('#email').inputValue(), 'saved@example.invalid');
                await page.close();
                continue; // Normal/CLEAN case below still executes independently.
            } else {
                // CORRECTION3_NORMAL_PREFLIGHT_BRANCH_ASSERTIONS_20261120
                // This is the non-ambiguous branch. It cannot assume the old
                // direct-success flow: every final Save now has a read-only
                // preflight and may require an explicit deferred confirmation.
                let normalSignal = false;
                try {
                    await page.waitForFunction(() => {
                        const title = Swal.getTitle()?.textContent?.trim();
                        return ['Επιτυχής καταχώριση!',
                            'Λείπουν στοιχεία του Ιστορικού',
                            'Η αποθήκευση χρειάζεται έλεγχο',
                            'Αποτυχία αποθήκευσης',
                            'Η αποθήκευση ολοκληρώθηκε'].includes(title);
                    }, null, { timeout: 4500 });
                    normalSignal = true;
                } catch (_) { /* Report the precise observation instead of a blind timeout. */ }
                const actualTitle = await page.evaluate(() => Swal.getTitle()?.textContent?.trim() || null);
                const normalObservation = {
                    width, normalFixture: true, title: actualTitle,
                    preflightReplies: __c3PreflightReplies,
                    postIntents: posts.map(post => ({ preflight: post.historyPreflight === true,
                        historyDecision: post.historyDecision || null,
                        hasConfirmation: typeof post.historyConfirmation === 'string' && post.historyConfirmation.length > 0 })),
                    pageErrors: errors,
                    employee: { changed: state.db.state().employee.email !== before.employee.email,
                        pending: Boolean(state.db.state().employee.employee_pending_history),
                        active: state.db.state().employee.energos },
                    physicalHistoryUnchanged: JSON.stringify(state.db.state().history) === JSON.stringify(before.history),
                    repositoryWrites: state.db.writes(),
                    url: page.url()
                };
                console.log('CORRECTION3_NORMAL_SAVE_OBSERVATION', JSON.stringify(normalObservation));
                assert.ok(normalSignal,
                    'NORMAL_SAVE_HAS_NO_EXPECTED_RESULT: '+ JSON.stringify(normalObservation));
                const first = __c3PreflightReplies[0];
                assert.ok(first?.preflight === true && first?.httpStatus === 200,
                    'NORMAL_SAVE_PREFLIGHT_CONTRACT: '+JSON.stringify(normalObservation));
                if (actualTitle === 'Λείπουν στοιχεία του Ιστορικού') {
                    assert.equal(first.status, 'MISSING_REQUIRED_HISTORY_FIELDS',
                        JSON.stringify(normalObservation));
                    assert.equal(await page.locator('.swal2-actions button:visible').count(), 2);
                    assert.equal((await page.locator('.swal2-confirm').innerText()).trim(), 'Συνέχεια');
                    assert.equal((await page.locator('.swal2-cancel').innerText()).trim(),
                        'Επιστροφή για διόρθωση');
                    assert.equal(state.db.writes(), 0, 'preflight cannot write before confirmation');
                    assert.deepEqual(state.db.state().history, before.history);
                    await page.locator('.swal2-confirm').click();
                    await page.waitForFunction(() => Swal.getTitle()?.textContent === 'Επιτυχής καταχώριση!',
                        null, { timeout: 5000 }).catch(() => {});
                    const afterTitle = await page.evaluate(() => Swal.getTitle()?.textContent?.trim() || null);
                    assert.equal(afterTitle, 'Επιτυχής καταχώριση!',
                        'DEFERRED_CONFIRMATION_NOT_COMMITTED: '+JSON.stringify({
                            before: normalObservation,
                            after: __c3PreflightReplies,
                            employeePending: Boolean(state.db.state().employee.employee_pending_history),
                            historyUnchanged: JSON.stringify(state.db.state().history) === JSON.stringify(before.history) }));
                    assert.equal(posts.length, 2, 'deferred Save needs exactly preflight+approved request');
                    assert.equal(posts[1].historyDecision, 'DEFER_HISTORY');
                    assert.ok(posts[1].historyConfirmation, 'bound confirmation required');
                    assert.ok(state.db.state().employee.employee_pending_history,
                        'pending evidence must be committed along with Employee');
                    assert.deepEqual(state.db.state().history, before.history);
                } else if (actualTitle === 'Επιτυχής καταχώριση!') {
                    assert.equal(first.status, 'READY_FOR_COMBINED_SAVE',
                        'Unexpected success decision: '+JSON.stringify(normalObservation));
                    assert.equal(posts.length, 2, 'safe Save must complete its bound confirmation request');
                    assert.ok(posts[1].historyConfirmation, 'safe Save requires bound confirmation');
                } else {
                    // For a genuinely unsafe *normal* fixture, preserve FAIL.
                    // Never turn unexpected UNSAFE / rejection into fake PASS.
                    assert.fail('NORMAL_SAVE_NOT_SUCCESS: '+JSON.stringify(normalObservation));
                }
                assert.equal(state.db.state().employee.email, 'saved@example.invalid',
                    'a confirmed normal Employee Save must actually persist the edited field');
                assert.deepEqual(state.db.state().history, before.history,
                    'this synthetic Employee-only edit must not rewrite physical History');
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
