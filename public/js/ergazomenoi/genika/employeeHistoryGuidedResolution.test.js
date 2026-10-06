'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const guided = require('./employeeHistoryGuidedResolution');

const fingerprint = 'a'.repeat(64);

function responseWith(data, status = 409) {
    return {
        status,
        clone() {
            return { json: async () => structuredClone(data) };
        }
    };
}

function resolutionData(overrides = {}) {
    return {
        resolutionRequired: true,
        resolution: {
            version: 1,
            kind: 'UNIQUE_SAFE_REPAIR',
            title: 'Τίτλος από διακομιστή',
            explanation: 'Εξήγηση από διακομιστή',
            options: [{
                id: 'APPLY_UNIQUE_SAFE_PLAN',
                label: 'Τακτοποίηση ιστορικού',
                description: 'Περιγραφή από διακομιστή'
            }],
            fingerprint,
            ...overrides
        }
    };
}

function fakeDocument() {
    return {
        createElement(tagName) {
            return {
                tagName,
                textContent: '',
                className: '',
                children: [],
                appendChild(child) { this.children.push(child); }
            };
        }
    };
}

test('εμφανίζει ασφαλές παράθυρο χωρίς αυτόματη επιβεβαίωση και με textContent', async () => {
    let receivedOptions;
    let retries = 0;
    const swal = {
        close() {},
        fire: async options => {
            receivedOptions = options;
            return { isConfirmed: false };
        }
    };
    const result = await guided.handleInitialResponse({
        response: responseWith(resolutionData()),
        originalPayload: { onoma: 'Synthetic' },
        retryRequest: async () => { retries += 1; },
        swal,
        documentRef: fakeDocument()
    });
    assert.equal(result.handled, true);
    assert.equal(result.cancelled, true);
    assert.equal(retries, 0);
    assert.equal(receivedOptions.focusCancel, true);
    assert.equal(receivedOptions.showCancelButton, true);
    assert.equal(receivedOptions.allowOutsideClick, false);
    assert.equal(receivedOptions.titleText, 'Τίτλος από διακομιστή');
    assert.equal(receivedOptions.html.children[0].textContent, 'Εξήγηση από διακομιστή');
    assert.equal(receivedOptions.html.children[1].textContent, 'Περιγραφή από διακομιστή');
});

test('ρητή επιβεβαίωση κάνει ακριβώς μία επανάληψη με αποτύπωμα και χωρίς historyId', async () => {
    let retries = 0;
    let retryPayload;
    let buttonsDisabled = 0;
    const retryResponse = { status: 200, ok: true };
    const swal = {
        close() {},
        disableButtons() { buttonsDisabled += 1; },
        fire: async options => ({ isConfirmed: true, value: await options.preConfirm() })
    };
    const result = await guided.handleInitialResponse({
        response: responseWith(resolutionData()),
        originalPayload: { onoma: 'Synthetic', nested: { safe: true } },
        retryRequest: async payload => {
            retries += 1;
            retryPayload = payload;
            return retryResponse;
        },
        swal,
        documentRef: fakeDocument()
    });
    assert.equal(result.response, retryResponse);
    assert.equal(retries, 1);
    assert.equal(buttonsDisabled, 1);
    assert.deepEqual(retryPayload.resolution, {
        choiceId: 'APPLY_UNIQUE_SAFE_PLAN', fingerprint
    });
    assert.equal(JSON.stringify(retryPayload).includes('historyId'), false);
});

test('παλαιωμένη απάντηση της επανάληψης επιστρέφεται αυτούσια για τον κανονικό χειρισμό σφάλματος', async () => {
    const stale = responseWith({ success: false,
        code: 'EMPLOYEE_HISTORY_UNIQUE_SAFE_REPAIR_STALE' }, 409);
    const swal = {
        close() {},
        disableButtons() {},
        fire: async options => ({ isConfirmed: true, value: await options.preConfirm() })
    };
    const result = await guided.handleInitialResponse({
        response: responseWith(resolutionData()), originalPayload: {},
        retryRequest: async () => stale, swal, documentRef: fakeDocument()
    });
    assert.equal(result.handled, true);
    assert.equal(result.response, stale);
});

test('συνηθισμένη ή μη δομημένη απάντηση δεν αλλάζει και δεν ανοίγει παράθυρο', async () => {
    let dialogs = 0;
    const ordinary = responseWith({ success: false, message: 'ordinary' }, 400);
    const result = await guided.handleInitialResponse({
        response: ordinary, originalPayload: {}, retryRequest: async () => {},
        swal: { fire: async () => { dialogs += 1; } }, documentRef: fakeDocument()
    });
    assert.equal(result.handled, false);
    assert.equal(result.response, ordinary);
    assert.equal(dialogs, 0);
});

test('η ενσωμάτωση παρεμβάλλεται πριν από κάθε επιτυχή ή εξωτερική μεταγενέστερη ενέργεια', () => {
    const source = fs.readFileSync(path.join(__dirname, 'putFieldValues.js'), 'utf8');
    const gate = source.indexOf('employeeHistoryGuidedResolution.handleInitialResponse');
    const redirects = source.indexOf('if (response.redirected && response.url)', gate);
    const responseJson = source.indexOf("if (ct.includes('application/json'))", gate);
    const externalSubmission = source.indexOf('runE6NBeforeRedirectIfNeeded', gate);
    assert.ok(gate > source.indexOf("fetch('/api/ergazomenoi/update/'"));
    assert.ok(redirects > gate);
    assert.ok(responseJson > gate);
    assert.ok(externalSubmission > gate);
    assert.match(source, /if \(guidedResolutionResult\.cancelled\) return;/);
    assert.match(source, /guidedResolutionHandled = true;/);
});

test('το πρότυπο φορτώνει τη μονάδα πριν από την υπάρχουσα αποθήκευση', () => {
    const page = fs.readFileSync(path.resolve(__dirname,
        '../../../../views/ergazomenoi/ergazomenoi/edit.ejs'), 'utf8');
    const activeStart = page.indexOf("script('ergazomenoi/genika/erganiRestSubmissionUi')");
    const moduleIndex = page.indexOf("script('ergazomenoi/genika/employeeHistoryGuidedResolution')",
        activeStart);
    const saveIndex = page.indexOf("script('ergazomenoi/genika/putFieldValues')", activeStart);
    assert.ok(moduleIndex > activeStart);
    assert.ok(saveIndex > moduleIndex);
});
