'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');
const policy = require('../../../../server/services/ergazomenoi/employeeHistoryCorrectionPolicyService');
const { fixture, scope, historyId } = require('../../../../test/fixtures/employeeProfileTransactionStore');

const root = path.resolve(__dirname, '../../../..');
const endpoint = 'https://payroll.test/ergazomenoi/ergazomenoi/istoriko/update';
const fingerprint = 'a'.repeat(64);
const correction = { intent: 'REMOVE_ROW', targetHistoryId: historyId('employee', 1),
    facts: {}, confirmation: null };

function userCorrection() {
    return { version: 1, kind: 'USER_CONFIRMED_HISTORY_CORRECTION',
        title: 'Χρειάζεται διόρθωση του ιστορικού', explanation: 'Επιλέξτε τι ίσχυε πραγματικά.',
        responsibilityText: 'Επιβεβαιώνω ότι οι επιλογές αποτυπώνουν τα πραγματικά ιστορικά στοιχεία.',
        fingerprint, conflicts: ['FIRST', 'SECOND'].map(conflictId => ({
            conflictId, kind: 'BOUNDARY', required: true,
            period: { from: '2026-01-01', to: '2026-02-28', label: 'Ιστορική περίοδος' },
            issue: 'Χρειάζεται η πραγματική ημερομηνία έναρξης.',
            decisionRequired: 'Από πότε ίσχυαν οι όροι;',
            intents: [{ id: 'OTHER_DATE', label: 'Από άλλη ημερομηνία',
                description: 'Δηλώστε την πραγματική ημερομηνία.',
                effectiveDateControl: { type: 'DATE', required: true,
                    label: 'Ημερομηνία έναρξης', min: '2026-01-01', max: '2026-02-28' } }]
        })) };
}

function safePreview() {
    const f = fixture();
    return policy.planHistoryCorrection({ scope, currentEmployee: f.employee,
        historyRows: f.history, request: correction, accessMode: 'ADMIN_FULL',
        catalogs: {}, insertId: historyId('employee', 9) }).public;
}

async function withPage(work) {
    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
        const requests = [];
        await page.route('https://payroll.test/**', async route => {
            if (route.request().method() === 'POST') {
                assert.equal(route.request().url(), endpoint);
                requests.push(route.request().postDataJSON());
                await route.fulfill({ contentType: 'application/json', body: '{"success":true}' });
            } else await route.fulfill({ contentType: 'text/html',
                body: '<!doctype html><html lang="el"><body></body></html>' });
        });
        await page.goto('https://payroll.test/');
        await page.addStyleTag({ path: path.join(root, 'node_modules/sweetalert2/dist/sweetalert2.css') });
        await page.addStyleTag({ path: path.join(root, 'public/css/main.css') });
        await page.addScriptTag({ path: path.join(root, 'node_modules/sweetalert2/dist/sweetalert2.all.js') });
        assert.equal(await page.evaluate(() => Swal.version), '11.26.25');
        await page.addScriptTag({ path: path.join(__dirname, 'employeeHistoryGuidedResolution.js') });
        assert.deepEqual(await page.evaluate(() => ({
            getter: typeof Swal.getConfirmButton,
            enable: typeof Swal.enableConfirmButton,
            disable: typeof Swal.disableConfirmButton
        })), { getter: 'function', enable: 'undefined', disable: 'undefined' });
        await work(page, requests);
    } finally {
        await browser.close();
    }
}

async function open(page, resolution, originalPayload = {}, status = 200) {
    await page.evaluate(({ resolution, originalPayload, endpoint, status }) => {
        window.previousModalPopup = Swal.getPopup();
        window.modalResult = null;
        window.employeeHistoryGuidedResolution.handleInitialResponse({
            response: new Response(JSON.stringify({ resolutionRequired: true, resolution }), { status }),
            originalPayload, retryRequest: payload => fetch(endpoint, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
            }), swal: Swal, documentRef: document, windowRef: window
        }).then(result => { window.modalResult = { cancelled: result.cancelled, status: result.response?.status }; });
    }, { resolution, originalPayload, endpoint, status });
    // Cancel resolves before its closing animation finishes. Visibility alone can
    // therefore match the previous popup instead of the one being opened.
    await page.waitForFunction(() => {
        const popup = Swal.getPopup();
        return popup && popup !== window.previousModalPopup && Swal.isVisible() &&
            popup.classList.contains('swal2-show');
    });
    await page.evaluate(async () => {
        const popup = Swal.getPopup();
        await Promise.all(popup.getAnimations().map(animation => animation.finished));
        await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
        if (Swal.getPopup() !== popup) throw new Error('Popup changed while opening');
    });
}

async function state(page, disabled, requests, count = 0) {
    const buttons = await page.evaluate(() => ({
        exists: Swal.getConfirmButton() instanceof HTMLButtonElement,
        disabled: Swal.getConfirmButton().disabled,
        cancelDisabled: Swal.getCancelButton().disabled
    }));
    assert.deepEqual(buttons, { exists: true, disabled, cancelDisabled: false });
    assert.equal(requests.length, count);
}

test('real SweetAlert requires all decisions and responsibility; invalidation disables only Confirm', async () => {
    await withPage(async (page, requests) => {
        await open(page, userCorrection(), { safe: 'original' });
        await state(page, true, requests);
        await page.locator('input[name="employee-history-correction-FIRST"]').check();
        await page.locator('input[type="date"]').first().fill('2026-01-15');
        await state(page, true, requests);
        await page.locator('input[name="employee-history-correction-SECOND"]').check();
        await page.locator('input[type="date"]').last().fill('2026-02-15');
        await state(page, true, requests);
        await page.locator('.swal2-html-container input[type="checkbox"]').check();
        await state(page, false, requests);
        await page.locator('input[type="date"]').last().fill('');
        await state(page, true, requests);
        await page.locator('input[type="date"]').last().fill('2026-02-15');
        await state(page, false, requests);
        await page.locator('.swal2-confirm').click();
        await page.waitForFunction(() => window.modalResult !== null);
        assert.equal(requests.length, 1);
        assert.deepEqual(requests[0], { safe: 'original', resolution: { fingerprint,
            responsibilityAccepted: true, decisions: [
                { conflictId: 'FIRST', intent: 'OTHER_DATE', effectiveDate: '2026-01-15' },
                { conflictId: 'SECOND', intent: 'OTHER_DATE', effectiveDate: '2026-02-15' }
            ] } });
    });
});

test('real SweetAlert Cancel stays available before and after acceptance and sends no request', async () => {
    await withPage(async (page, requests) => {
        for (let opening = 0; opening < 10; opening += 1) {
            const accepted = opening % 2 === 1;
            await open(page, safePreview(), { correction }, accepted ? 409 : 200);
            await state(page, true, requests);
            if (accepted) {
                await page.locator('.swal2-html-container input[type="checkbox"]').check();
                await state(page, false, requests);
            }
            await page.locator('.swal2-cancel').click();
            await page.waitForFunction(() => window.modalResult?.cancelled === true);
            assert.equal(requests.length, 0);
        }
    });
});

test('real SweetAlert preview retains preConfirm guard and sends exactly one confirmed correction', async () => {
    await withPage(async (page, requests) => {
        const preview = safePreview();
        const payload = { employeeId: 'synthetic', updates: [], expectedStateToken: 'b'.repeat(64), correction };
        await open(page, preview, payload);
        await state(page, true, requests);
        // Deliberately bypass the DOM state to prove the independent preConfirm guard remains effective.
        await page.evaluate(() => { Swal.getConfirmButton().disabled = false; });
        await page.locator('.swal2-confirm').click();
        await page.waitForFunction(() => Swal.getValidationMessage()?.textContent.includes('Δεν αποθηκεύτηκε'));
        assert.equal(requests.length, 0);
        await page.locator('.swal2-html-container input[type="checkbox"]').check();
        await state(page, false, requests);
        await page.locator('.swal2-html-container input[type="checkbox"]').uncheck();
        await state(page, true, requests);
        await page.locator('.swal2-html-container input[type="checkbox"]').check();
        await state(page, false, requests);
        await page.locator('.swal2-confirm').click();
        await page.waitForFunction(() => window.modalResult?.status === 200);
        assert.equal(requests.length, 1);
        assert.deepEqual(requests[0], { ...payload, correction: { ...correction,
            confirmation: { fingerprint: preview.fingerprint, confirmed: true } } });
    });
});

function plannerProfileResolution(factory) {
    const fixtures = require('../../../../server/services/ergazomenoi/fixtures/userConfirmedEmployeeHistoryCorrectionFixtures');
    const analysis = require('../../../../server/services/ergazomenoi/employeeHistoryResolutionAnalysisService');
    const planner = require('../../../../server/services/ergazomenoi/employeeHistoryUserConfirmedCorrectionPlannerService');
    const plan = planner.planEmployeeHistoryUserConfirmedCorrection(fixtures[factory]());
    return analysis.buildUserConfirmedCorrectionPublicResolution({
        analysis: analysis.buildUserConfirmedCorrectionAnalysis({ userCorrectionPlan: plan,
            sourceStateFingerprint: fingerprint }), fingerprint });
}

test('real SweetAlert single profile source is fixed for both intents while business facts remain explicit', async () => {
    await withPage(async (page, requests) => {
        await open(page, plannerProfileResolution('h1MissingInitialProfileFixture'));
        await state(page, true, requests);
        assert.equal(await page.locator('.swal2-html-container input[type="radio"]:checked').count(), 0);
        await page.locator('input[name="employee-history-correction-INITIAL_PROFILE_START"][value="FROM_KNOWN_HISTORY_DATE"]').check();
        const terms = page.locator('section').filter({ has: page.locator('input[name="employee-history-correction-INITIAL_PROFILE_TERMS"]') });
        for (const intent of ['CONFIRM_EXISTING', 'ENTER_DIFFERENT_VALUE']) {
            await terms.locator(`input[type="radio"][value="${intent}"]`).check();
            assert.equal(await terms.locator('input[type="hidden"]:enabled').inputValue(), 'PROFILE_CANDIDATE_1');
            const visible = await terms.innerText();
            assert.match(visible, /Στοιχεία αναφοράς/);
            assert.match(visible, /Οι όροι που είναι καταχωρημένοι στην εγγραφή της 25\/05\/2026/);
            assert.match(visible, /Η ημερομηνία δείχνει από ποια εγγραφή προέρχονται τα στοιχεία/);
            assert.match(visible, /Δεν αλλάζει την ημερομηνία έναρξης που επιλέξατε προηγουμένως/);
            assert.doesNotMatch(visible, /PROFILE_CANDIDATE|h1-later-profile|aa_eggrafhs/);
            await state(page, true, requests);
        }
        // A fixed baseline cannot supply the four historical facts requested by
        // ENTER_DIFFERENT_VALUE; all four must still be entered by the user.
        await page.locator('.swal2-html-container input[type="checkbox"]').check();
        await state(page, true, requests);
        await terms.locator('select:enabled').selectOption('0109');
        const numbers = terms.locator('input[type="number"]:enabled');
        await numbers.nth(0).fill('5');
        await numbers.nth(1).fill('40');
        await state(page, true, requests);
        await numbers.nth(2).fill('8');
        await state(page, false, requests);
        await page.locator('.swal2-html-container input[type="checkbox"]').uncheck();
        await state(page, true, requests);
        await page.locator('.swal2-cancel').click();
        await page.waitForFunction(() => window.modalResult?.cancelled === true);
        assert.equal(requests.length, 0);
    });
});

test('real SweetAlert multiple profile sources require an explicit source with clear Greek labels', async () => {
    await withPage(async (page, requests) => {
        await open(page, plannerProfileResolution('h3IntermediateOverlapFixture'));
        await page.locator('input[name="employee-history-correction-INTERMEDIATE_PERIOD_MEANING"][value="CONFIRM_REAL_PERIOD"]').check();
        await page.locator('input[name="employee-history-correction-INTERMEDIATE_PROFILE_TERMS"][value="CONFIRM_EXISTING"]').check();
        const terms = page.locator('section').filter({ has: page.locator('input[name="employee-history-correction-INTERMEDIATE_PROFILE_TERMS"]') });
        const select = terms.locator('select:enabled');
        assert.equal(await select.inputValue(), '');
        assert.deepEqual(await select.locator('option').allTextContents(), ['Επιλέξτε…',
            'Οι καταχωρημένοι όροι της εγγραφής 17/05/2026',
            'Οι καταχωρημένοι όροι της εγγραφής 25/05/2026']);
        const visible = await terms.innerText();
        assert.match(visible, /Η ημερομηνία δείχνει από ποια εγγραφή προέρχονται τα στοιχεία/);
        assert.match(visible, /Δεν αλλάζει την ημερομηνία έναρξης που επιλέξατε προηγουμένως/);
        assert.doesNotMatch(visible, /PROFILE_CANDIDATE|h3-earlier-profile|h3-later-profile/);
        await state(page, true, requests);
        await select.selectOption('PROFILE_CANDIDATE_2');
        await state(page, true, requests);
        await page.locator('.swal2-cancel').click();
        await page.waitForFunction(() => window.modalResult?.cancelled === true);
        assert.equal(requests.length, 0);
    });
});
