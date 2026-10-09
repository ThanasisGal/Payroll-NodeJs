'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { chromium } = require('playwright');
const maintenance = require('../../../../server/utils/ergazomenoi/employmentProfileMaintenance');
const policy = require('../../../../server/services/ergazomenoi/employeeHistoryCorrectionPolicyService');
const { fixture, scope, historyId } = require('../../../../test/fixtures/employeeProfileTransactionStore');

const root = path.resolve(__dirname, '../../../..');
const source = fs.readFileSync(path.join(__dirname, 'putFieldValues.js'), 'utf8');
const helpers = source.slice(0, source.indexOf("document.addEventListener('DOMContentLoaded'"));
const saveStart = source.indexOf('    async function handleFormSubmit(event)');
const saveEnd = source.indexOf('    function handleFormSubmitOnce(', saveStart);
assert.ok(saveStart > 0 && saveEnd > saveStart);
// Execute the complete production Save function, including serialization, POST,
// JSON dispatch, downstream success branches and its genuine-error catch.
const saveFunction = source.slice(saveStart, saveEnd);
const saveOnceFunction = source.slice(saveEnd, source.indexOf('\n    }', saveEnd) + 6);
const target = historyId('employee', 1);
const otherTarget = historyId('employee', 2);
const reason = 'EMPLOYEE_DEPARTURE_PROFILE_CHANGE_REQUIRES_SEPARATE_SAVE';
let envelope;
maintenance.profileError({ status(code) { assert.equal(code, 200); return this; },
    json(body) { envelope = body; } }, { code: reason, statusCode: 409 },
{ employeeSaveActionRequired: true });

function action(targetHistoryId = null) {
    return { ...envelope, nextAction: { ...envelope.nextAction, targetHistoryId } };
}

const previewFixture = fixture();
const preview = policy.planHistoryCorrection({ scope, currentEmployee: previewFixture.employee,
    historyRows: previewFixture.history,
    request: { intent: 'REMOVE_ROW', targetHistoryId: target, facts: {}, confirmation: null },
    accessMode: 'ADMIN_FULL', catalogs: {}, insertId: historyId('employee', 9) }).public;
assert.ok(preview);

async function withPage({ payload = action(), status = 200, disabled = false,
    missing = false, accessMode = 'ADMIN_FULL', duplicate = false, replies = null, departure = '2026-09-20' } = {}, work) {
    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage();
        const requests = [], errors = [], pageErrors = [];
        page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
        page.on('pageerror', err => pageErrors.push(err.message));
        const requiredNames = [...source.matchAll(/addError\(\s*'([^']+)'/g)].map(match => match[1]);
        const values = Object.fromEntries(requiredNames.map(name => [name, '1']));
        Object.assign(values, { hmeromhnia_apoxorhshs: departure,
            email: 'entered@example.test', hmeromhnia_proslhpshs: '2026-04-01' });
        for (let day = 1; day <= 7; day++) values[`kathgoria_ergasias_${String(day).padStart(2, '0')}`] = 'ΜΕ';
        const fields = Object.entries(values).map(([name, value]) =>
            `<input name="${name}" id="${name}" value="${value}">`).join('');
        const row = id => `<tr class="istoriko-row" data-id="${id}" data-state="clean"
            data-can-manage-row="true"><td><button data-action="review"
            ${disabled ? 'disabled aria-disabled="true"' : ''}>Έλεγχος / Διόρθωση</button></td></tr>`;
        const html = `<!doctype html><html lang="el"><head><meta charset="utf-8"><meta name="csrf-token" content="synthetic"></head>
            <body data-mode="edit" data-context="ergazomenoi">
            <div class="menu_Links"><ul><li class="active">Σταθερά Στοιχεία</li>
            <li>Ιστορικό Προσλήψεων/Αλλαγών</li></ul></div>
            <input id="ergazomenoiId" value="synthetic-employee">
            <input id="istorikoEmployeeId" value="synthetic-employee">
            <button id="save">Αποθήκευση</button>
            <div class="sections"><section><div class="sectionTitle"></div><div class="card-body">${fields}</div></section>
            <section><div class="sectionTitle"></div><table id="istorikoTable"
            data-history-access-mode="${accessMode}" data-expected-state-token="${'b'.repeat(64)}">
            <tbody>${row(otherTarget)}${missing ? '' : row(target)}${duplicate ? row(target) : ''}</tbody></table></section></div>
            </body></html>`;
        await page.route('https://payroll.test/**', async route => {
            const request = route.request();
            if (request.method() !== 'POST') return route.fulfill({ contentType: 'text/html', body: html });
            requests.push({ url: request.url(), body: request.postDataJSON() });
            if (request.url() === 'https://payroll.test/api/ergazomenoi/update/synthetic-employee') {
                const reply = replies?.[requests.filter(item => item.url.includes('/api/ergazomenoi/update/')).length - 1] || { status, payload };
                return route.fulfill({ status: reply.status, contentType: 'application/json', body: JSON.stringify(reply.payload) });
            }
            assert.equal(request.url(), 'https://payroll.test/ergazomenoi/ergazomenoi/istoriko/update');
            return route.fulfill({ status: 200, contentType: 'application/json',
                body: JSON.stringify({ success: false, resolutionRequired: true, resolution: preview }) });
        });
        await page.goto('https://payroll.test/');
        await page.addStyleTag({ path: path.join(root, 'node_modules/sweetalert2/dist/sweetalert2.css') });
        await page.addScriptTag({ path: path.join(root, 'node_modules/sweetalert2/dist/sweetalert2.all.js') });
        assert.equal(await page.evaluate(() => Swal.version), '11.26.25');
        for (const file of ['public/js/common/csrfFetchPatch.js', 'public/js/common/sectionsVisible.js',
            'public/js/ergazomenoi/genika/employeeHistoryGuidedResolution.js',
            'public/js/ergazomenoi/genika/employeeHistoryFieldLabels.js',
            'public/js/ergazomenoi/genika/istorikoTable.js']) {
            await page.addScriptTag({ path: path.join(root, file) });
        }
        await page.addScriptTag({ content: helpers + `
            const isEmpty = value => !String(value ?? '').trim();
            const isRehireDraftMode = false;
            let message = '';
            async function blockSaveForDailyRestViolation() { return false; }
            window.validateEmploymentProfileBreak = () => true;
            window.serializeEmploymentProfileField = () => false;
            window.pdfUploadModule = { getFileAsBase64: async () => null, hasPendingUpload: () => false };
            window.swalCalls = [];
            window.guidedCounts = { retryRequest: 0, preConfirm: 0, successContinuation: 0, redirect: 0 };
            const guided = window.employeeHistoryGuidedResolution;
            window.employeeHistoryGuidedResolution = { ...guided, handleInitialResponse: options => {
                const retry = options.retryRequest;
                return guided.handleInitialResponse({ ...options, retryRequest: payload => {
                    window.guidedCounts.retryRequest++; return retry(payload);
                } });
            } };
            const finish = finishEmployeeUpdateAfterUploads;
            finishEmployeeUpdateAfterUploads = results => {
                window.guidedCounts.successContinuation++;
                return finish(results, () => { window.guidedCounts.redirect++; });
            };
            const runFormSubmissionOnce = createSingleFlight();
            const originalFire = Swal.fire.bind(Swal);
            Swal.fire = options => {
                window.swalCalls.push(options);
                if (options.titleText === 'Χρειάζεται διόρθωση του ιστορικού') {
                    const confirm = options.preConfirm;
                    options.preConfirm = async () => { window.guidedCounts.preConfirm++; return confirm(); };
                }
                return originalFire(options);
            };
            ${saveFunction}
            ${saveOnceFunction}
            document.getElementById('save').addEventListener('click', event => {
                window.saveFinished = false;
                handleFormSubmitOnce(event).then(result => { if (!result?.skipped) window.saveFinished = true; });
            });
            document.dispatchEvent(new Event('DOMContentLoaded'));
        ` });
        await work({ page, requests, errors, pageErrors });
        assert.deepEqual(pageErrors, []);
    } finally { await browser.close(); }
}

async function save(page) {
    await page.locator('#save').click();
    await page.locator('.swal2-confirm').filter({ hasText: 'Ενημέρωση' }).click();
}

async function expectGuidance(page) {
    await page.waitForFunction(() => Swal.getTitle()?.textContent === 'Χρειάζεται έλεγχος του Ιστορικού');
    assert.equal(await page.locator('.swal2-confirm').textContent(), 'Έλεγχος Ιστορικού');
    assert.equal(await page.locator('.swal2-cancel').textContent(), 'Παραμονή στη φόρμα');
    const options = await page.evaluate(() => window.swalCalls.at(-1));
    assert.equal(options.icon, 'warning');
    assert.equal(options.allowOutsideClick, false);
    assert.equal(options.timer, undefined);
    assert.equal(options.text, envelope.message);
}

async function expectNoFalseSuccess(page, errors) {
    assert.deepEqual(errors, []);
    const calls = await page.evaluate(() => window.swalCalls.map(call => ({ title: call.title, icon: call.icon })));
    assert.ok(calls.every(call => call.title !== 'Αποτυχία αποθήκευσης' && call.icon !== 'success'));
    assert.equal(page.url(), 'https://payroll.test/');
    assert.equal(await page.locator('#email').inputValue(), 'entered@example.test');
}

for (const exit of ['cancel', 'escape']) test(`real Save ${exit} preserves form and tab, without errors or further requests`, async () => {
    await withPage({}, async ({ page, requests, errors }) => {
        await save(page);
        await expectGuidance(page);
        if (exit === 'escape') await page.keyboard.press('Escape');
        else await page.locator('.swal2-cancel').click();
        await page.waitForFunction(() => window.saveFinished);
        assert.equal(await page.locator('.menu_Links li.active').textContent(), 'Σταθερά Στοιχεία');
        assert.equal(requests.length, 1);
        await expectNoFalseSuccess(page, errors);
    });
});

test('exact server target uses actual tab and review listener once, opening existing guided modal', async () => {
    await withPage({ payload: action(target) }, async ({ page, requests, errors }) => {
        await save(page);
        await expectGuidance(page);
        await page.locator('.swal2-confirm').click();
        await page.waitForFunction(() => window.saveFinished && window.swalCalls.length === 3);
        assert.equal(await page.locator('.menu_Links li.active').textContent(), 'Ιστορικό Προσλήψεων/Αλλαγών');
        assert.equal(await page.locator('.sections section.visible table').getAttribute('id'), 'istorikoTable');
        assert.equal(requests.length, 2);
        assert.deepEqual(requests[1].body, { employeeId: 'synthetic-employee', updates: [],
            expectedStateToken: 'b'.repeat(64), correction: {
                intent: 'REVIEW', targetHistoryId: target, facts: {}, confirmation: null } });
        assert.equal(await page.locator('.swal2-title').textContent(), preview.title);
        await page.locator('.swal2-cancel').click();
        assert.equal(requests.length, 2);
        await expectNoFalseSuccess(page, errors);
    });
});

for (const [label, options] of [
    ['no server target', {}],
    ['missing exact row', { payload: action(target), missing: true }],
    ['disabled review', { payload: action(target), disabled: true }],
    ['unauthorized review', { payload: action(target), accessMode: 'NONE' }],
    ['duplicate exact rows', { payload: action(target), duplicate: true }]
]) test(`${label} activates History and gives manual instruction without guessing or requests`, async () => {
    await withPage(options, async ({ page, requests, errors }) => {
        await save(page);
        await expectGuidance(page);
        await page.locator('.swal2-confirm').click();
        await page.waitForFunction(() => Swal.getTitle()?.textContent === 'Επιλέξτε την εγγραφή στο Ιστορικό');
        assert.match(await page.locator('.swal2-html-container').textContent(), /δεν μπορεί να επιλέξει με ασφάλεια/);
        assert.equal(await page.locator('.menu_Links li.active').textContent(), 'Ιστορικό Προσλήψεων/Αλλαγών');
        assert.equal(requests.length, 1);
        await page.locator('.swal2-confirm').click();
        await page.waitForFunction(() => window.saveFinished);
        await expectNoFalseSuccess(page, errors);
    });
});

test('unexpected HTTP failure still executes both console-error paths and generic failure Swal', async () => {
    await withPage({ payload: { success: false, reason: 'CONFLICT_STALE', message: 'Στοιχεία άλλαξαν.' }, status: 409 },
        async ({ page, requests, errors }) => {
            await save(page);
            await page.waitForFunction(() => Swal.getTitle()?.textContent === 'Αποτυχία αποθήκευσης');
            assert.ok(errors.some(text => text.includes('JSON response indicates failure')));
            assert.ok(errors.some(text => text.includes('Form submission error')));
            assert.equal(requests.length, 1);
            assert.equal(await page.locator('.menu_Links li.active').textContent(), 'Σταθερά Στοιχεία');
        });
});

test('only a complete allowlisted HTTP 200 envelope is handled', async () => {
    const context = vm.createContext({});
    vm.runInContext(helpers, context);
    const valid = action();
    for (const [status, payload] of [
        [409, valid], [500, valid], [200, { ...valid, success: true }],
        [200, { ...valid, actionRequired: 'true' }], [200, { ...valid, reason: 'CONFLICT_STALE' }],
        [200, { ...valid, message: '' }], [200, { ...valid, nextAction: null }],
        [200, { ...valid, nextAction: { type: 'REDIRECT', targetHistoryId: null } }],
        [200, action('"], tr:first-child')],
        [200, { ...valid, nextAction: { type: 'OPEN_EMPLOYEE_HISTORY_REVIEW' } }]
    ]) {
        assert.equal(await context.handleEmployeeSaveHistoryAction({ status, ok: status === 200 }, payload,
            { swal: { fire() { assert.fail('invalid envelope opened a modal'); } }, documentRef: null }), false);
    }
});

function initialUserCorrectionResponse() {
    const fixture = require('../../../../server/services/ergazomenoi/fixtures/userConfirmedEmployeeHistoryCorrectionFixtures').h2KpkBoundaryFixture();
    const analysis = require('../../../../server/services/ergazomenoi/employeeHistoryResolutionAnalysisService');
    const planner = require('../../../../server/services/ergazomenoi/employeeHistoryUserConfirmedCorrectionPlannerService')
        .planEmployeeHistoryUserConfirmedCorrection(fixture);
    const fingerprint = 'a'.repeat(64);
    const resolution = analysis.buildUserConfirmedCorrectionPublicResolution({
        analysis: analysis.buildUserConfirmedCorrectionAnalysis({ userCorrectionPlan: planner,
            sourceStateFingerprint: fingerprint }), fingerprint });
    return { success: false, reason: 'EMPLOYEE_HISTORY_USER_CORRECTION_REQUIRED', resolutionRequired: true, resolution };
}
async function completeUserCorrection(page) {
    await page.waitForFunction(() => Swal.getTitle()?.textContent === 'Χρειάζεται διόρθωση του ιστορικού');
    // The production single-flight wrapper must reject a second Save during the worksheet.
    await page.evaluate(() => document.getElementById('save').click());
    await page.locator('input[name="employee-history-correction-INITIAL_PROFILE_START"][value="FROM_KNOWN_HISTORY_DATE"]').check();
    await page.locator('input[name="employee-history-correction-INITIAL_PROFILE_TERMS"][value="CONFIRM_EXISTING"]').check();
    const terms = page.locator('section').filter({ has: page.locator('input[name="employee-history-correction-INITIAL_PROFILE_TERMS"]') });
    assert.equal(await terms.locator('select').count(), 0);
    assert.equal(await terms.locator('input[type="hidden"]:enabled').inputValue(), 'PROFILE_CANDIDATE_1');
    assert.match(await terms.innerText(), /Στοιχεία αναφοράς/);
    assert.match(await terms.innerText(), /εγγραφή της 25\/05\/2026/);
    assert.match(await terms.innerText(), /Δεν αλλάζει την ημερομηνία έναρξης που επιλέξατε προηγουμένως/);
    assert.doesNotMatch(await page.locator('.swal2-html-container').innerText(), /PROFILE_CANDIDATE_1/);
    assert.equal(await page.locator('.swal2-confirm').isEnabled(), false);
    assert.equal(await page.locator('.swal2-cancel').isEnabled(), true);
    await page.locator('input[name="employee-history-correction-FIELD_KPK"][value="CORRECT_EXISTING_HISTORICAL_FACT"]').check();
    const section = page.locator('section').filter({ has: page.locator('input[name="employee-history-correction-FIELD_KPK"]') });
    await section.locator('select:enabled').selectOption('0115');
    assert.equal(await page.locator('.swal2-confirm').isEnabled(), false);
    await page.locator('.swal2-html-container input[type="checkbox"]').check();
    assert.equal(await page.locator('.swal2-confirm').isEnabled(), true);
    await page.locator('.swal2-confirm').click();
}
function assertConfirmationRequests(requests) {
    assert.equal(requests.length, 2);
    assert.equal(requests[0].body.resolution, undefined);
    assert.deepEqual(requests[1].body.resolution, { fingerprint: 'a'.repeat(64), responsibilityAccepted: true,
        decisions: [
            { conflictId: 'INITIAL_PROFILE_START', intent: 'FROM_KNOWN_HISTORY_DATE' },
            { conflictId: 'INITIAL_PROFILE_TERMS', intent: 'CONFIRM_EXISTING', value: 'PROFILE_CANDIDATE_1' },
            { conflictId: 'FIELD_KPK', intent: 'CORRECT_EXISTING_HISTORICAL_FACT', value: '0115' }
        ] });
    assert.deepEqual({ ...requests[1].body, resolution: undefined }, { ...requests[0].body, resolution: undefined });
}
for (const status of [200, 409]) test(`normal Save guided HTTP ${status} confirms once and continues success once`, async () => {
    await withPage({ departure: '', replies: [ { status, payload: initialUserCorrectionResponse() },
        { status: 200, payload: { success: true, message: 'Η ενημέρωση ολοκληρώθηκε.' } } ] },
    async ({ page, requests, errors }) => {
        await save(page);
        await completeUserCorrection(page);
        await page.waitForFunction(() => window.saveFinished);
        assertConfirmationRequests(requests);
        assert.deepEqual(errors.filter(text => !text.includes('Failed to load resource')), []);
        assert.deepEqual(await page.evaluate(() => window.guidedCounts),
            { retryRequest: 1, preConfirm: 1, successContinuation: 1, redirect: 1 });
        assert.equal(await page.evaluate(() => window.swalCalls.filter(call => call.icon === 'success').length), 1);
        assert.equal(await page.evaluate(() => window.swalCalls.some(call => call.title === 'Αποτυχία αποθήκευσης')), false);
        assert.deepEqual(errors.filter(text => !text.includes('Failed to load resource')), []);
        if (status === 200) assert.deepEqual(errors, []);
    });
});

test('normal Save genuine stale has dedicated UX, no generic errors, retry, success or redirect', async () => {
    await withPage({ departure: '', replies: [ { status: 200, payload: initialUserCorrectionResponse() },
        { status: 409, payload: { success: false, reason: 'EMPLOYEE_HISTORY_USER_CORRECTION_STALE' } } ] },
    async ({ page, requests, errors }) => {
        await save(page);
        await completeUserCorrection(page);
        await page.waitForFunction(() => Swal.getTitle()?.textContent === 'Τα στοιχεία άλλαξαν');
        const options = await page.evaluate(() => window.swalCalls.at(-1));
        assert.equal(options.timer, undefined);
        assert.equal(options.confirmButtonText, 'Κλείσιμο');
        assert.match(options.text, /Για λόγους ασφάλειας δεν αποθηκεύτηκε καμία αλλαγή/);
        assert.match(options.text, /ανοίξτε ξανά τον έλεγχο του Ιστορικού/);
        assertConfirmationRequests(requests);
        await page.locator('.swal2-confirm').click();
        await page.waitForFunction(() => window.saveFinished);
        assertConfirmationRequests(requests);
        assert.deepEqual(await page.evaluate(() => window.guidedCounts),
            { retryRequest: 1, preConfirm: 1, successContinuation: 0, redirect: 0 });
        await expectNoFalseSuccess(page, errors.filter(text => !text.includes('Failed to load resource')));
    });
});

test('normal Save genuine boundary failure has dedicated UX and no application console errors', async () => {
    const code = 'EMPLOYEE_HISTORY_USER_CORRECTION_INVALID_BOUNDARY';
    await withPage({ departure: '', replies: [ { status: 200, payload: initialUserCorrectionResponse() },
        { status: 409, payload: { success: false, reason: code } } ] },
    async ({ page, requests, errors }) => {
        await save(page);
        await completeUserCorrection(page);
        await page.waitForFunction(() => Swal.getTitle()?.textContent === 'Η διόρθωση δεν εφαρμόστηκε');
        const options = await page.evaluate(() => window.swalCalls.at(-1));
        assert.equal(options.timer, undefined);
        assert.equal(options.confirmButtonText, 'Κλείσιμο');
        assert.match(options.text, /τελικό σχέδιο αλλαγών δεν συμφώνησε με όσα επιβεβαιώθηκαν/);
        assert.match(options.text, /Δεν αποθηκεύτηκε καμία αλλαγή/);
        assert.match(options.text, /1\. Κλείστε το παράθυρο\.\n2\. Ελέγξτε ξανά το Ιστορικό/);
        assert.equal(options.footer, `Κωδικός αναφοράς: ${code}`);
        assertConfirmationRequests(requests);
        await page.locator('.swal2-confirm').click();
        await page.waitForFunction(() => window.saveFinished);
        assertConfirmationRequests(requests);
        assert.deepEqual(await page.evaluate(() => window.guidedCounts),
            { retryRequest: 1, preConfirm: 1, successContinuation: 0, redirect: 0 });
        await expectNoFalseSuccess(page, errors.filter(text => !text.includes('Failed to load resource')));
    });
});
