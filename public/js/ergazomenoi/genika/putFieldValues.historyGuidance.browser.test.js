'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { chromium } = require('playwright');
const ejs = require('ejs');
const F = require('../../../../server/services/ergazomenoi/fixtures/automaticEmployeeHistoryReconstructionFixtures');
const { planEmployeeHistoryAutomaticReconstruction: automaticPlan } = require('../../../../server/services/ergazomenoi/employeeHistoryAutomaticReconstructionPlannerService');
const { buildEmployeeHistoryReconstructionPreview: automaticPreview } = require('../../../../server/services/ergazomenoi/employeeHistoryReconstructionPreviewService');
const maintenance = require('../../../../server/utils/ergazomenoi/employmentProfileMaintenance');
const policy = require('../../../../server/services/ergazomenoi/employeeHistoryCorrectionPolicyService');
const { fixture, scope, historyId } = require('../../../../test/fixtures/employeeProfileTransactionStore');

const root = path.resolve(__dirname, '../../../..');
const { origin, asset, assertChoiceAligned } = require('../../../../test/fixtures/employeeMaintenanceBrowserAssets');
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
const reason = 'EMPLOYEE_HISTORY_MANUAL_REVIEW_REQUIRED';
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

async function withPage({ automatic = false, payload = action(), status = 200, disabled = false,
    missing = false, accessMode = 'ADMIN_FULL', duplicate = false, replies = null, departure = '2026-09-20',
    saveHandler = null, fieldValues = {}, reconstructionFixture = null, viewport } = {}, work) {
    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage(viewport ? { viewport } : {});
        page.setDefaultTimeout(10000);
        const requests = [], errors = [], pageErrors = [];
        page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
        page.on('pageerror', err => pageErrors.push(err.message));
        const requiredNames = [...source.matchAll(/addError\(\s*'([^']+)'/g)].map(match => match[1]);
        const values = Object.fromEntries(requiredNames.map(name => [name, '1']));
        Object.assign(values, { hmeromhnia_apoxorhshs: departure,
            email: 'entered@example.test', hmeromhnia_proslhpshs: '2026-04-01' }, fieldValues);
        for (let day = 1; day <= 7; day++) values[`kathgoria_ergasias_${String(day).padStart(2, '0')}`] = 'ΜΕ';
        const fields = Object.entries(values).map(([name, value]) =>
            `<input name="${name}" id="${name}" value="${value}">`).join('');
        const row = id => `<tr class="istoriko-row" data-id="${id}" data-state="clean"
            data-can-manage-row="true"><td><button data-action="review"
            ${disabled ? 'disabled aria-disabled="true"' : ''}>Έλεγχος / Διόρθωση</button></td></tr>`;
        const input = reconstructionFixture || F.caseA();
        const reconstructionPartial = automatic ? await ejs.renderFile(path.join(root,
            'views/ergazomenoi/ergazomenoi/partials/edit/cardBodies/section7/istoriko.ejs'), {
            ergazomenoiData: input.currentEmployee, istorikoData: input.completeHistoryRows,
            employeeHistoryAccessMode: accessMode, employeeHistoryStateToken: 'synthetic', problematicHistoryIds: []
        }) : '';
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
            ${reconstructionPartial}</body></html>`;
        await page.route(`${origin}/**`, async route => {
            if (route.request().url().startsWith(`${origin}/static/`)) return route.continue();
            const request = route.request();
            if (request.method() !== 'POST') return route.fulfill({ contentType: 'text/html', body: html });
            requests.push({ url: request.url(), body: request.postDataJSON() });
            if (request.url() === `${origin}/api/ergazomenoi/update/synthetic-employee`) {
                const reply = saveHandler ? await saveHandler(request.postDataJSON())
                    : replies?.[requests.filter(item => item.url.includes('/api/ergazomenoi/update/')).length - 1] || { status, payload };
                return route.fulfill({ status: reply.status, contentType: 'application/json', body: JSON.stringify(reply.payload) });
            }
            assert.equal(request.url(), `${origin}/ergazomenoi/ergazomenoi/istoriko/update`);
            return route.fulfill({ status: 200, contentType: 'application/json',
                body: JSON.stringify({ success: false, resolutionRequired: true, resolution: preview }) });
        });
        await page.goto(`${origin}/`);
        // Manual correction uses the same bounded flex/scroll layout as the real form.
        // Vendor CSS alone leaves its content and actions outside the viewport.
        for (const file of ['public/css/bootstrap.min.css', 'public/css/main.css']) await page.addStyleTag(asset(root, file));
        if (automatic) {
            for (const file of ['public/js/bootstrap.bundle.min.js', 'public/js/ergazomenoi/genika/employeeHistoryReconstructionPreview.js']) await page.addScriptTag(asset(root, file));
        }
        await page.addStyleTag(asset(root, 'node_modules/sweetalert2/dist/sweetalert2.css'));
        await page.addScriptTag(asset(root, 'node_modules/sweetalert2/dist/sweetalert2.all.js'));
        assert.equal(await page.evaluate(() => Swal.version), '11.26.25');
        for (const file of ['public/js/common/csrfFetchPatch.js', 'public/js/common/sectionsVisible.js',
            'public/js/ergazomenoi/genika/employeeHistoryGuidedResolution.js',
            'public/js/ergazomenoi/genika/employeeHistoryFieldLabels.js',
            'public/js/ergazomenoi/genika/istorikoTable.js']) {
            await page.addScriptTag(asset(root, file));
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
                return finish(results, () => {
                    window.redirectAt = performance.now(); window.guidedCounts.redirect++;
                });
            };
            const runFormSubmissionOnce = createSingleFlight();
            const originalFire = Swal.fire.bind(Swal);
            Swal.fire = options => {
                window.swalCalls.push(options);
                if (options.icon === 'success' && options.timer) window.successShownAt = performance.now();
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

async function expectNoFalseSuccess(page, errors) {
    assert.deepEqual(errors, []);
    const calls = await page.evaluate(() => window.swalCalls.map(call => ({ title: call.title, icon: call.icon })));
    assert.ok(calls.every(call => call.title !== 'Αποτυχία αποθήκευσης' && call.icon !== 'success'));
    assert.equal(page.url(), `${origin}/`);
    assert.equal(await page.locator('#email').inputValue(), 'entered@example.test');
}
for (const [label, options] of [
    ['normal manual-only ambiguity', {}], ['forged exact row is ignored', { payload: action(target) }],
    ['missing row', { missing: true }], ['disabled review', { disabled: true }],
    ['normal user', { accessMode: 'NONE' }], ['duplicate physical rows', { duplicate: true }]
]) test(`${label}: switches tab and explains once, without automatic row actions`, async () => {
    await withPage(options, async ({ page, requests, errors }) => {
        await save(page);
        await page.waitForFunction(() => Swal.getTitle()?.textContent === 'Χρειάζεται έλεγχος του Ιστορικού');
        assert.equal(await page.locator('.menu_Links li.active').textContent(), 'Ιστορικό Προσλήψεων/Αλλαγών');
        assert.equal(await page.locator('.swal2-confirm').textContent(), 'Κλείσιμο');
        assert.match(await page.locator('.swal2-html-container').innerText(), /Δεν αποθηκεύτηκε καμία αλλαγή/);
        assert.equal(requests.length, 1);
        await page.locator('.swal2-confirm').click();
        await page.waitForFunction(() => window.saveFinished);
        await expectNoFalseSuccess(page, errors);
    });
});
test('unexpected HTTP failure still executes the genuine-error catch', async () => {
    await withPage({ payload: { success: false, reason: 'CONFLICT_STALE', message: 'Στοιχεία άλλαξαν.' }, status: 409 },
        async ({ page, requests, errors }) => {
            await save(page);
            await page.waitForFunction(() => Swal.getTitle()?.textContent === 'Αποτυχία αποθήκευσης');
            assert.ok(errors.some(text => text.includes('JSON response indicates failure')));
            assert.ok(errors.some(text => text.includes('Form submission error')));
            assert.equal(requests.length, 1);
        });
});
test('only a complete allowlisted HTTP 200 manual-tab envelope is handled', async () => {
    const context = vm.createContext({}); vm.runInContext(helpers, context);
    const valid = action();
    for (const [status, payload] of [
        [409, valid], [500, valid], [200, { ...valid, success: true }],
        [200, { ...valid, actionRequired: 'true' }], [200, { ...valid, reason: 'CONFLICT_STALE' }],
        [200, { ...valid, nextAction: null }], [200, { ...valid, nextAction: { type: 'REDIRECT' } }],
        [200, { ...valid, nextAction: { type: 'OPEN_EMPLOYEE_HISTORY_REVIEW' } }]
    ]) assert.equal(await context.handleEmployeeSaveHistoryAction({ status, ok: status === 200 }, payload,
        { swal: { fire() { assert.fail('invalid envelope opened a modal'); } }, documentRef: null }), false);
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
    const next = page.locator('.swal2-html-container').getByRole('button', { name: 'Συνέχεια', exact: true });
    assert.equal(await page.locator('.swal2-confirm').isEnabled(), false);
    await next.click();
    await page.locator('input[name="employee-history-correction-INITIAL_PROFILE_START"][value="FROM_KNOWN_HISTORY_DATE"]').check();
    await next.click();
    const existingTerms = page.locator('input[name="employee-history-correction-INITIAL_PROFILE_TERMS"][value="CONFIRM_EXISTING"]');
    // Check actual reachability inside the content scrollport, keeping actions on screen.
    for (const width of [1280, 1366, 1600, 1920]) {
        await page.setViewportSize({ width, height: 720 });
        await existingTerms.scrollIntoViewIfNeeded();
        const geometry = await existingTerms.evaluate(input => {
            const content = input.closest('.swal2-html-container');
            const popup = content.closest('.swal2-popup');
            const bounds = element => {
                const { top, bottom, left, right } = element.getBoundingClientRect();
                return { top, bottom, left, right };
            };
            return { input: bounds(input), content: bounds(content), popup: bounds(popup),
                actions: bounds(popup.querySelector('.swal2-actions')),
                overflow: getComputedStyle(content).overflowY,
                client: content.clientHeight, scroll: content.scrollHeight, scrollTop: content.scrollTop };
        });
        assert.equal(geometry.overflow, 'auto');
        if (geometry.scroll > geometry.client) assert.ok(geometry.scrollTop > 0, JSON.stringify(geometry));
        assert.ok(geometry.input.top >= geometry.content.top - 1 &&
            geometry.input.bottom <= geometry.content.bottom + 1, JSON.stringify(geometry));
        assert.ok(geometry.popup.left >= 0 && geometry.popup.right <= width + 1 &&
            geometry.popup.top >= 0 && geometry.popup.bottom <= 721, JSON.stringify(geometry));
        assert.ok(geometry.actions.top >= 0 && geometry.actions.bottom <= 721, JSON.stringify(geometry));
    }
    await existingTerms.check();
    const terms = page.locator('section').filter({ has: page.locator('input[name="employee-history-correction-INITIAL_PROFILE_TERMS"]') });
    assert.equal(await terms.locator('select').count(), 0);
    assert.equal(await terms.locator('input[type="hidden"]:enabled').inputValue(), 'PROFILE_CANDIDATE_1');
    assert.match(await terms.innerText(), /Καταχωρημένοι όροι εργασίας/);
    assert.match(await terms.innerText(), /εγγραφή της 25\/05\/2026/);
    assert.match(await terms.innerText(), /Οι ημερομηνίες ισχύος επιβεβαιώνονται χωριστά/);
    assert.doesNotMatch(await page.locator('.swal2-html-container').innerText(), /PROFILE_CANDIDATE_1/);
    assert.equal(await page.locator('.swal2-confirm').isEnabled(), false);
    assert.equal(await page.locator('.swal2-cancel').isEnabled(), true);
    await next.click();
    await page.locator('input[name="employee-history-correction-FIELD_KPK"][value="CORRECT_EXISTING_HISTORICAL_FACT"]').check();
    const section = page.locator('section').filter({ has: page.locator('input[name="employee-history-correction-FIELD_KPK"]') });
    await section.locator('select:enabled').selectOption('0115');
    assert.equal(await page.locator('.swal2-confirm').isEnabled(), false);
    for (let step = 0; await next.isVisible() && step < 10; step++) {
        assert.equal(await next.isEnabled(), true);
        await next.click();
    }
    assert.equal(await next.isVisible(), false);
    await page.locator('.swal2-html-container input[type="checkbox"]:visible').check();
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

function automaticEnvelope() {
    const input = F.caseA();
    return { success: false, actionRequired: true, reason: 'EMPLOYEE_HISTORY_AUTOMATIC_RECONSTRUCTION_REQUIRED',
        previewToken: 'a'.repeat(43), reconstructionPreview: automaticPreview({ plan: automaticPlan(input), completeHistoryRows: input.completeHistoryRows }),
        nextAction: { type: 'APPROVE_HISTORY_RECONSTRUCTION_AND_CONTINUE_SAVE' } };
}
function departureAutomaticEnvelope() {
    return { ...automaticEnvelope(), operation: 'FIRST_DEPARTURE',
        reason: 'EMPLOYEE_HISTORY_AUTOMATIC_RECONSTRUCTION_REQUIRED_FOR_DEPARTURE',
        nextAction: { type: 'APPROVE_HISTORY_RECONSTRUCTION_AND_CONTINUE_DEPARTURE' } };
}
async function expectDepartureAutomatic(page) {
    await page.locator('#employeeHistoryReconstructionPreviewModal.show').waitFor();
    await page.waitForTimeout(350);
    assert.equal(await page.locator('#employeeHistoryReconstructionPreviewTitle').textContent(),
        'Το Ιστορικό Χρειάζεται Τακτοποίηση πριν την Αποχώρηση');
    assert.equal(await page.locator('#employeeHistoryReconstructionPreviewModal .modal-body > p').textContent(),
        'Για να ολοκληρωθεί η αποχώρηση, η εφαρμογή προτείνει πρώτα τις παρακάτω αλλαγές στο Ιστορικό.');
    assert.equal(await page.locator('#employeeHistoryReconstructionApplyBtn').textContent(), 'Τακτοποίηση & Συνέχεια Αποχώρησης');
    assert.equal(await page.locator('#employeeHistoryReconstructionApplyBtn').isDisabled(), true);
    assert.equal(await page.locator('#employeeHistoryReconstructionApprovalAccepted').isChecked(), false);
}

for (const exit of ['cancel', 'escape']) test(`first departure preview ${exit} preserves every form field and date without reload`, async () => {
    await withPage({ automatic: true, payload: departureAutomaticEnvelope() }, async ({ page, requests, errors }) => {
        await page.locator('#email').fill('unsaved@example.test');
        const values = await page.locator('input[name]').evaluateAll(fields => fields.map(field => [field.name, field.value]));
        await save(page); await expectDepartureAutomatic(page);
        if (exit === 'escape') await page.keyboard.press('Escape');
        else await page.locator('#employeeHistoryReconstructionPreviewModal .modal-footer [data-bs-dismiss]').click();
        await page.waitForFunction(() => window.saveFinished);
        assert.deepEqual(await page.locator('input[name]').evaluateAll(fields => fields.map(field => [field.name, field.value])), values);
        assert.equal(requests.length, 1);
        assert.equal(await page.locator('#hmeromhnia_apoxorhshs').inputValue(), '2026-09-20');
        assert.equal(await page.evaluate(() => window.guidedCounts.redirect), 0);
        assert.deepEqual(errors, []);
    });
});

test('first departure: Save once, explicit approval, retained original payload, one automatic success continuation', async () => {
    await withPage({ automatic: true, replies: [{ status: 200, payload: departureAutomaticEnvelope() },
        { status: 200, payload: { success: true, automaticReconstructionApplied: true } }] }, async ({ page, requests, errors }) => {
        await save(page); await expectDepartureAutomatic(page);
        await page.locator('label[for="employeeHistoryReconstructionApprovalAccepted"]').click();
        await page.evaluate(() => { const button = document.getElementById('employeeHistoryReconstructionApplyBtn'); button.click(); button.click(); });
        await page.waitForFunction(() => window.saveFinished);
        assert.equal(requests.length, 2);
        assert.deepEqual(requests[1].body, { ...requests[0].body,
            reconstruction: { previewToken: 'a'.repeat(43), approvalAccepted: true } });
        assert.equal(requests[1].body.formData.hmeromhnia_apoxorhshs, '2026-09-20');
        assert.doesNotMatch(JSON.stringify(requests.map(request => request.body)), /rowDiffs|proposedRows|sourceHistoryIds|historyPatches/);
        assert.deepEqual(await page.evaluate(() => window.guidedCounts),
            { retryRequest: 0, preConfirm: 0, successContinuation: 1, redirect: 1 });
        assert.equal(await page.evaluate(() => window.swalCalls.filter(call => call.icon === 'success').length), 1);
        assert.deepEqual(errors, []);
    });
});

test('first departure stale approval preserves the complete form and does not reload, retry or open row correction', async () => {
    const message = 'Τα στοιχεία άλλαξαν μετά την προεπισκόπηση. Δεν αποθηκεύτηκε καμία αλλαγή.\n1. Ελέγξτε τη φόρμα.\n2. Ζητήστε νέα πρόταση.';
    await withPage({ automatic: true, replies: [{ status: 200, payload: departureAutomaticEnvelope() },
        { status: 409, payload: { success: false, reason: 'EMPLOYEE_HISTORY_AUTOMATIC_RECONSTRUCTION_STALE', message } }] }, async ({ page, requests, errors }) => {
        await page.locator('#email').fill('unsaved@example.test');
        const values = await page.locator('input[name]').evaluateAll(fields => fields.map(field => [field.name, field.value]));
        await save(page); await expectDepartureAutomatic(page);
        await page.locator('label[for="employeeHistoryReconstructionApprovalAccepted"]').click();
        await page.locator('#employeeHistoryReconstructionApplyBtn').click();
        await page.waitForFunction(() => Swal.getTitle()?.textContent === 'Τα στοιχεία άλλαξαν');
        assert.deepEqual(await page.locator('input[name]').evaluateAll(fields => fields.map(field => [field.name, field.value])), values);
        assert.equal(requests.length, 2);
        assert.equal(await page.evaluate(() => window.guidedCounts.redirect), 0);
        assert.deepEqual(errors.filter(text => !text.includes('Failed to load resource')), []);
    });
});

test('blocked first departure opens only History, retains unsaved form and leaves both manual tools available', async () => {
    const D = require('../../../../server/services/ergazomenoi/employeeDepartureAutomaticReconstructionContract');
    let payload;
    D.sendDepartureReconstructionAction({ status() { return this; }, json(body) { payload = body; } }, D.manualReview('BLOCKED'));
    await withPage({ automatic: true, payload }, async ({ page, requests, errors }) => {
        await page.locator('#email').fill('unsaved@example.test');
        await save(page);
        await page.waitForFunction(() => Swal.getTitle()?.textContent === 'Χρειάζεται έλεγχος του Ιστορικού');
        assert.equal(await page.locator('.menu_Links li.active').textContent(), 'Ιστορικό Προσλήψεων/Αλλαγών');
        assert.match(await page.locator('.swal2-html-container').textContent(), /Η αποχώρηση δεν μπορεί να ολοκληρωθεί αυτόματα/);
        await page.locator('.swal2-confirm').click();
        await page.waitForFunction(() => window.saveFinished);
        assert.equal(await page.locator('#email').inputValue(), 'unsaved@example.test');
        assert.equal(await page.locator('#hmeromhnia_apoxorhshs').inputValue(), '2026-09-20');
        assert.equal(await page.locator('#employeeHistoryReconstructionPreviewBtn').isEnabled(), true);
        assert.equal(await page.locator(`tr[data-id="${target}"] [data-action="review"]`).isEnabled(), true);
        assert.equal(requests.length, 1);
        assert.equal(await page.evaluate(() => window.guidedCounts.redirect), 0);
        assert.deepEqual(errors, []);
    });
});
async function expectAutomatic(page) {
    await page.locator('#employeeHistoryReconstructionPreviewModal.show').waitFor();
    await page.waitForTimeout(350);
    assert.equal(await page.locator('#employeeHistoryReconstructionPreviewTitle').textContent(), 'Το Ιστορικό Χρειάζεται Τακτοποίηση');
    assert.equal(await page.locator('#employeeHistoryReconstructionApprovalAccepted').isChecked(), false);
    assert.equal(await page.locator('#employeeHistoryReconstructionApplyBtn').isDisabled(), true);
    assert.match(await page.locator('#employeeHistoryReconstructionApplyBtn').textContent(), /Εφαρμογή & Συνέχεια Αποθήκευσης/);
}
test('Phase 3B: cancel retains original full form; native label and keyboard work; second Save reopens unchecked', async () => {
    await withPage({ automatic: true, departure: '', replies: [{ status: 200, payload: automaticEnvelope() }, { status: 200, payload: automaticEnvelope() }] }, async ({ page, requests, errors }) => {
        await page.locator('#email').fill('unsaved@example.test');
        await save(page); await expectAutomatic(page);
        const apply = page.locator('#employeeHistoryReconstructionApplyBtn');
        const grey = await apply.evaluate(e => getComputedStyle(e).backgroundColor);
        await page.locator('label[for="employeeHistoryReconstructionApprovalAccepted"]').click();
        assert.equal(await apply.isEnabled(), true);
        await page.waitForFunction(() => getComputedStyle(document.getElementById('employeeHistoryReconstructionApplyBtn')).backgroundColor === 'rgb(223, 239, 230)');
        const green = await apply.evaluate(e => getComputedStyle(e).backgroundColor);
        assert.notEqual(grey, green); assert.equal(green, 'rgb(223, 239, 230)');
        await page.locator('#employeeHistoryReconstructionApprovalAccepted').focus(); await page.keyboard.press('Space');
        assert.equal(await apply.isDisabled(), true);
        await page.evaluate(() => document.getElementById('save').click());
        assert.equal(requests.length, 1);
        await page.locator('#employeeHistoryReconstructionPreviewModal .modal-footer [data-bs-dismiss]').click();
        await page.waitForFunction(() => window.saveFinished);
        assert.equal(await page.locator('#email').inputValue(), 'unsaved@example.test');
        assert.equal(requests.length, 1); assert.equal(await page.evaluate(() => window.guidedCounts.redirect), 0);
        await save(page); await expectAutomatic(page);
        assert.equal(requests.length, 2); assert.deepEqual(errors, []);
    });
});
test('Phase 3B: one approval sends only retained Save intent and token; double click continues success once', async () => {
    await withPage({ automatic: true, departure: '', replies: [{ status: 200, payload: automaticEnvelope() },
        { status: 200, payload: { success: true, automaticReconstructionApplied: true } }] }, async ({ page, requests, errors }) => {
        await save(page); await expectAutomatic(page);
        await page.locator('label[for="employeeHistoryReconstructionApprovalAccepted"]').click();
        await page.evaluate(() => { const button = document.getElementById('employeeHistoryReconstructionApplyBtn'); button.click(); button.click(); document.getElementById('save').click(); });
        await page.waitForFunction(() => window.saveFinished);
        assert.equal(requests.length, 2);
        assert.deepEqual(requests[1].body, { ...requests[0].body, reconstruction: { previewToken: 'a'.repeat(43), approvalAccepted: true } });
        assert.deepEqual(await page.evaluate(() => window.guidedCounts), { retryRequest: 0, preConfirm: 0, successContinuation: 1, redirect: 1 });
        assert.equal(await page.evaluate(() => window.swalCalls.filter(call => call.icon === 'success').length), 1);
        assert.deepEqual(errors, []);
    });
});
test('Phase 3B: stale continuation retains form without reload or second Save and shows required Greek text', async () => {
    const message = 'Το Ιστορικό άλλαξε μετά την προεπισκόπηση. Δεν αποθηκεύτηκε καμία αλλαγή. Ελέγξτε ξανά τη νέα πρόταση.';
    await withPage({ automatic: true, departure: '', replies: [{ status: 200, payload: automaticEnvelope() },
        { status: 409, payload: { success: false, reason: 'EMPLOYEE_HISTORY_AUTOMATIC_RECONSTRUCTION_STALE', message } }] }, async ({ page, requests, errors }) => {
        await page.locator('#email').fill('unsaved@example.test');
        await save(page); await expectAutomatic(page);
        await page.locator('label[for="employeeHistoryReconstructionApprovalAccepted"]').click();
        await page.locator('#employeeHistoryReconstructionApplyBtn').click();
        await page.waitForFunction(() => Swal.getTitle()?.textContent === 'Τα στοιχεία άλλαξαν');
        assert.equal(await page.locator('.swal2-html-container').textContent(), message);
        assert.equal(await page.locator('#email').inputValue(), 'unsaved@example.test');
        assert.equal(requests.length, 2); assert.equal(await page.evaluate(() => window.guidedCounts.redirect), 0);
        assert.deepEqual(errors.filter(text => !text.includes('Failed to load resource')), []);
    });
});


test('Phase 3B successful Save uses exact approved 0006-shaped preview counts and consumes feedback after reload', async () => {
    const envelope = automaticEnvelope();
    envelope.reconstructionPreview.summary.changes = 25;
    envelope.reconstructionPreview.changes = envelope.reconstructionPreview.changes.slice(0, 19).map((item, index) =>
        ({ ...item, row: ['0001', '0002'][index % 2] }));
    envelope.reconstructionPreview.defaultGroups = [{ row: '0003', count: 6, changes: [] }];
    await withPage({ automatic: true, departure: '', replies: [{ status: 200, payload: envelope },
        { status: 200, payload: { success: true, automaticReconstructionApplied: true } }] }, async ({ page }) => {
        await save(page); await expectAutomatic(page);
        await page.locator('#employeeHistoryReconstructionApprovalAccepted').check();
        await page.locator('#employeeHistoryReconstructionApplyBtn').click();
        await page.waitForFunction(() => window.saveFinished);
        const key = 'employeeHistoryReconstructionSuccess:synthetic-employee';
        const stored = await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)), key);
        assert.deepEqual(Object.keys(stored).sort(), ['changedFields', 'changedRows', 'timestamp']);
        assert.equal(stored.changedRows, 3); assert.equal(stored.changedFields, 25);
        await page.reload();
        for (const file of ['public/js/bootstrap.bundle.min.js', 'public/js/ergazomenoi/genika/employeeHistoryReconstructionPreview.js'])
            await page.addScriptTag(asset(root, file));
        await page.evaluate(() => document.dispatchEvent(new Event('DOMContentLoaded')));
        assert.match(await page.locator('#employeeHistoryReconstructionSuccess').innerText(), /Ενημερώθηκαν 3 εγγραφές και 25 πεδία/);
        assert.equal(await page.evaluate(key => sessionStorage.getItem(key), key), null);
    });
});
for (const final of [{ status: 409, payload: { success: false } }, { status: 500, payload: { success: false } },
    { status: 200, payload: { success: true, automaticReconstructionApplied: false } }]) {
    test(`Phase 3B ${final.status}/${final.payload.automaticReconstructionApplied} does not store misleading feedback`, async () => {
        await withPage({ automatic: true, departure: '', replies: [{ status: 200, payload: automaticEnvelope() }, final] }, async ({ page }) => {
            await save(page); await expectAutomatic(page);
            await page.locator('#employeeHistoryReconstructionApprovalAccepted').check();
            await page.locator('#employeeHistoryReconstructionApplyBtn').click();
            await page.waitForFunction(() => window.saveFinished);
            assert.equal(await page.evaluate(() => sessionStorage.length), 0);
        });
    });
}
test('ordinary Save never records reconstruction feedback', async () => {
    await withPage({ automatic: true, departure: '', payload: { success: true } }, async ({ page }) => {
        await save(page);
        await page.waitForFunction(() => window.saveFinished);
        assert.equal(await page.evaluate(() => sessionStorage.length), 0);
        const timing = await page.evaluate(() => ({ delay: window.redirectAt - window.successShownAt,
            calls: window.swalCalls.filter(call => call.icon === 'success'), redirects: window.guidedCounts.redirect }));
        assert.equal(timing.calls.length, 1);
        assert.equal(timing.calls[0].timer, 2000);
        assert.equal(timing.calls[0].allowEscapeKey, false);
        assert.ok(timing.delay >= 2000, `actual Save redirected after ${timing.delay}ms`);
        assert.equal(timing.redirects, 1);
    });
});

for (const width of [1440, 390]) for (const [role, accessMode] of [['C', 'NONE'], ['S', 'SUPERVISOR_PROBLEM_SCOPE']])
test(`real legacy 40 -> 39 ${role} at ${width}px: one browser Save preserves problematic History and explains Employee-only success`, async () => {
    const { legacyWeeklyHours } = require('../../../../server/services/ergazomenoi/fixtures/maintenanceWeeklyHoursLegacyFixture');
    const { store } = require('../../../../test/fixtures/employeeProfileTransactionStore');
    const { writeEmployeeMaintenance } = require('../../../../server/services/ergazomenoi/employeeEmploymentProfileWriter');
    const { canonicalizeEmployeeHistory } = require('../../../../server/services/ergazomenoi/employeeHistoryCanonicalizationService');
    const input = legacyWeeklyHours(), db = store([input]), before = db.state();
    // This fixture is repairable legacy History, not a clean normal update:
    // its second row needs a contract-end correction before canonical use.
    const canonical = canonicalizeEmployeeHistory({ scope: input.scope,
        currentEmployee: input.employee, historyRows: input.history });
    assert.equal(canonical.status, 'AUTO_REPAIRABLE');
    assert.equal(canonical.cleanupRequired, true);
    assert.deepEqual(canonical.rowsToUpdate, [{ historyId: input.history[1]._id,
        patch: { hmeromhnia_lhxhs_symbashs: input.employee.hmeromhnia_lhxhs_symbashs } }]);
    const query = value => ({ select() { return this; }, session() { return this; }, lean: async () => value });
    const saveHandler = async body => {
        const changes = { ores_ergasias_ebdomadas: Number(body.formData.ores_ergasias_ebdomadas) };
        try {
            const result = await writeEmployeeMaintenance({ ...db.deps, scope: input.scope,
                employeeId: input.employee._id, actorUserId: 'synthetic-actor', input: {},
                userModel: { findById: () => query({ team: 'TEST', situation: 'A', privileges: role }) },
                privilegeModel: { findOne: () => query({ privileges: { update: true } }) },
                correctionCatalogLoader: async () => ({}), reconstruction: body.reconstruction,
                maintenance: { employeeChanges: changes, historyChanges: changes,
                    submittedEmployeeFields: Object.keys(changes), submittedProfileFields: [], submittedFormValues: changes } });
            return { status: 200, payload: { success: true, automaticReconstructionApplied: result.automaticReconstructionApplied,
                employeeUpdated: result.employeeUpdated, historyUpdated: result.historyUpdated,
                ambiguousHistoryPreserved: result.ambiguousHistoryPreserved } };
        } catch (error) {
            let reply;
            const res = { status(status) { reply = { status }; return this; },
                json(payload) { reply.payload = payload; } };
            const { sendReconstructionSaveError } = require('../../../../server/services/ergazomenoi/employeeHistoryAutomaticReconstructionSaveContract');
            if (!sendReconstructionSaveError(res, error))
                maintenance.profileError(res, error, { employeeSaveActionRequired: true });
            return reply;
        }
    };
    await withPage({ automatic: true, departure: '', accessMode, disabled: true,
        fieldValues: { ores_ergasias_ebdomadas: '39' }, saveHandler, viewport: { width, height: 1000 },
        reconstructionFixture: { scope: input.scope, currentEmployee: input.employee, completeHistoryRows: input.history } },
    async ({ page, requests, errors }) => {
        await page.locator('#save').click();
        await page.locator('#storage_temporary').waitFor();
        await assertChoiceAligned(page, 'storage_temporary');
        await assertChoiceAligned(page, 'storage_permanent');
        if (process.env.PAYROLL_VISUAL_ARTIFACT_DIR) {
            fs.mkdirSync(process.env.PAYROLL_VISUAL_ARTIFACT_DIR, { recursive: true });
            await page.waitForTimeout(300);
            await page.screenshot({ path: path.join(process.env.PAYROLL_VISUAL_ARTIFACT_DIR, `ergani-choice-alignment-${role}-${width}.png`), animations: 'disabled' });
        }
        await page.locator('.swal2-confirm').filter({ hasText: 'Ενημέρωση' }).click();
        await page.locator('.swal2-title').filter({ hasText: 'Η αποθήκευση ολοκληρώθηκε' }).waitFor();
        assert.equal(await page.locator('.swal2-html-container').innerText(), [
            'Τα στοιχεία του εργαζομένου αποθηκεύτηκαν επιτυχώς. Το εργασιακό ιστορικό δεν ενημερώθηκε λόγω ασυμφωνίας στις ιστορικές εγγραφές. Απαιτείται έλεγχος από διαχειριστή.',
            '1. Επιλέξτε «Συνέχεια» για τις ενέργειες που έχετε ήδη επιλέξει ή «Κλείσιμο» για επιστροφή στη λίστα χωρίς υποβολή.',
            '2. Ζητήστε έλεγχο του Ιστορικού από διαχειριστή.'
        ].join('\n'));
        assert.equal(await page.locator('.swal2-confirm').innerText(), 'Κλείσιμο');
        assert.equal(await page.locator('#employeeHistoryReconstructionPreviewModal.show').count(), 0);
        assert.equal(requests.length, 1);
        assert.equal(requests[0].body.formData.ores_ergasias_ebdomadas, '39');
        assert.equal(requests[0].body.reconstruction, undefined);
        assert.equal(db.state().employees[0].ores_ergasias_ebdomadas, 39);
        assert.deepEqual(db.state().history, before.history);
        assert.deepEqual(db.state().audits, before.audits);
        assert.equal(db.events.some(event => event.kind === 'history' &&
            ['write', 'fence'].includes(event.type)), false);
        assert.equal(db.events.filter(event => event.type === 'commit').length, 1);
        assert.deepEqual(await page.evaluate(() => window.guidedCounts),
            { retryRequest: 0, preConfirm: 0, successContinuation: 0, redirect: 0 });
        assert.equal(await page.evaluate(() => window.swalCalls.filter(call => call.icon === 'info' && call.title === 'Η αποθήκευση ολοκληρώθηκε').length), 1);
        assert.equal(await page.evaluate(() => window.swalCalls.some(call => call.icon === 'success' || call.icon === 'error')), false);
        if (process.env.PAYROLL_VISUAL_ARTIFACT_DIR) {
            await page.screenshot({ path: path.join(process.env.PAYROLL_VISUAL_ARTIFACT_DIR,
                `real-40-to-39-history-preserved-${role}-${width}.png`), animations: 'disabled' });
        }
        await Promise.all([
            page.waitForURL(`${origin}/ergazomenoi/ergazomenoi`),
            page.locator('.swal2-confirm').click()
        ]);
        assert.equal(requests.length, 1);
        assert.deepEqual(errors, []);
    });
});
