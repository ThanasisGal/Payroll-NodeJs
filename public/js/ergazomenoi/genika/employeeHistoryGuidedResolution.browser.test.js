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

async function open(page, resolution, originalPayload = {}) {
    await page.evaluate(({ resolution, originalPayload, endpoint }) => {
        window.previousModalPopup = Swal.getPopup();
        window.modalResult = null;
        window.employeeHistoryGuidedResolution.handleInitialResponse({
            response: new Response(JSON.stringify({ resolutionRequired: true, resolution }), { status: 409 }),
            originalPayload, retryRequest: payload => fetch(endpoint, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
            }), swal: Swal, documentRef: document, windowRef: window
        }).then(result => { window.modalResult = { cancelled: result.cancelled, status: result.response?.status }; });
    }, { resolution, originalPayload, endpoint });
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
            await open(page, safePreview(), { correction });
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
