'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const guided = require('./employeeHistoryGuidedResolution');

const fingerprint = 'a'.repeat(64);
async function confirmSteps(options) {
    options.didOpen?.();
    const next = allElements(options.html).find(node => node.tagName === 'button' && node.textContent === 'Συνέχεια');
    for (let count = 0; next && !next.hidden && count < 40; count++) {
        assert.equal(next.disabled, false, 'Every required answer must be complete before continuing');
        next.dispatch('click');
    }
    const approval = allElements(options.html).find(node => node.className?.includes('employee-history-final-approval'));
    const checkbox = approval?.children.find(node => node.type === 'checkbox');
    if (checkbox) { checkbox.checked = true; checkbox.dispatch('change'); }
    return options.preConfirm();
}


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

for (const status of [200, 409]) {
    test(`readResolutionFromResponse accepts a valid resolution envelope from HTTP ${status}`, async () => {
        for (const data of [resolutionData(), guidedResolutionData(), factResolutionData(), correctionResolutionData()]) {
            const response = responseWith(data, status);
            assert.deepEqual(await guided.readResolutionFromResponse(response),
                guided.normalizeResolutionResponse(data));
            assert.ok(await guided.readResolutionFromResponse(response));
            assert.deepEqual(await response.clone().json(), data);
        }
    });
}

test('readResolutionFromResponse does not interpret ordinary HTTP 200 success as a resolution', async () => {
    assert.equal(await guided.readResolutionFromResponse(responseWith({ success: true }, 200)), null);
    assert.equal(await guided.readResolutionFromResponse(responseWith({
        ...resolutionData(), resolutionRequired: false
    }, 200)), null);
});

test('readResolutionFromResponse rejects malformed or unsafe HTTP 200 resolution envelopes', async () => {
    for (const overrides of [{ version: 2 }, { fingerprint: 'invalid' }, { kind: 'UNKNOWN' }, { options: [] }]) {
        assert.equal(await guided.readResolutionFromResponse(responseWith(resolutionData(overrides), 200)), null);
    }
    const unsafe = guidedResolutionData();
    unsafe.resolution.options[0].id = '$set';
    assert.equal(await guided.readResolutionFromResponse(responseWith(unsafe, 200)), null);
    assert.equal(await guided.readResolutionFromResponse({ status: 200,
        clone() { return { json: async () => { throw new SyntaxError('invalid JSON'); } }; }
    }), null);
});

test('readResolutionFromResponse leaves HTTP 409 stale errors without a resolution to error handling', async () => {
    assert.equal(await guided.readResolutionFromResponse(responseWith({ success: false,
        reason: 'EMPLOYEE_HISTORY_EDITOR_STALE'
    }, 409)), null);
});

function fakeDocument() {
    return {
        createElement(tagName) {
            return {
                tagName,
                textContent: '',
                className: '',
                children: [],
                listeners: {},
                appendChild(child) { this.children.push(child); child.parentElement = this; },
                replaceChildren(...children) { this.children = []; for (const child of children) this.appendChild(child); },
                addEventListener(name, listener) { this.listeners[name] = listener; },
                dispatch(name) { this.listeners[name]?.({ target: this }); },
                dispatchEvent(event) { this.dispatch(event.type); }
            };
        }
    };
}

function fakeClassList(initial = []) {
    const values = new Set(initial);
    return {
        add(...items) { for (const item of items) values.add(item); },
        contains(item) { return values.has(item); },
        values() { return [...values]; }
    };
}

function fakeStyle() {
    const values = {};
    return {
        values,
        setProperty(property, value, priority = '') {
            values[property] = { value, priority };
        }
    };
}

function guidedResolutionData(overrides = {}) {
    return {
        resolutionRequired: true,
        resolution: {
            version: 1,
            kind: 'GUIDED_BUSINESS_CHOICE',
            title: 'Χρειάζεται επιβεβαίωση του ιστορικού',
            explanation: 'Υπάρχουν περισσότερες από μία ασφαλείς ερμηνείες.',
            options: [{
                id: 'KEEP_FIRST_PROFILE',
                label: 'Ίσχυε το πρώτο προφίλ',
                description: 'Το πρώτο προφίλ ίσχυε σε όλη την περίοδο.'
            }, {
                id: 'CHANGE_OTHER_DATE',
                label: 'Η αλλαγή έγινε σε άλλη ημερομηνία',
                description: 'Δηλώστε την πραγματική ημερομηνία.',
                inputs: [{ id: 'effectiveDate', type: 'date',
                    label: 'Ημερομηνία έναρξης', required: true,
                    min: '2026-06-25', max: '2026-07-02' }]
            }],
            fingerprint,
            ...overrides
        }
    };
}

function factResolutionData({ pay = false, overrides = {} } = {}) {
    const questions = [{
        id: 'departureOutcome', type: 'SINGLE_CHOICE',
        label: 'Τι συνέβη πραγματικά με την αποχώρηση;', required: true,
        options: [
            { id: 'DEPARTED_ON_FIRST_RECORDED_DATE', label: 'Αποχώρησε στις 19/08/2026' },
            { id: 'DEPARTED_ON_SECOND_RECORDED_DATE', label: 'Αποχώρησε στις 20/08/2026' },
            { id: 'DEPARTED_ON_OTHER_DATE', label: 'Αποχώρησε σε άλλη ημερομηνία' },
            { id: 'NO_DEPARTURE', label: 'Δεν πραγματοποιήθηκε αποχώρηση' }
        ]
    }, {
        id: 'departureDate', type: 'DATE', label: 'Ημερομηνία αποχώρησης',
        required: true, min: '2026-04-29', max: '2026-10-06',
        condition: { questionId: 'departureOutcome', equals: 'DEPARTED_ON_OTHER_DATE' }
    }];
    if (pay) questions.push({
        id: 'payEffectiveOutcome', type: 'SINGLE_CHOICE',
        label: 'Από πότε ίσχυαν πραγματικά οι αποδοχές 1.006,06;', required: true,
        options: [
            { id: 'PAY_APPLIED_FROM_HIRE', label: 'Ίσχυαν από την πρόσληψη' },
            { id: 'PAY_APPLIED_FROM_OTHER_DATE', label: 'Ίσχυαν από μεταγενέστερη ημερομηνία' }
        ]
    }, {
        id: 'payEffectiveDate', type: 'DATE', label: 'Ημερομηνία έναρξης αποδοχών',
        required: true, min: '2026-05-02', max: '2026-10-06',
        condition: { questionId: 'payEffectiveOutcome', equals: 'PAY_APPLIED_FROM_OTHER_DATE' }
    });
    return {
        resolutionRequired: true,
        resolution: {
            version: 1,
            kind: 'BUSINESS_FACT_COLLECTION',
            title: 'Χρειάζονται πραγματικά στοιχεία για το ιστορικό',
            explanation: 'Επιβεβαιώστε τι συνέβη πραγματικά.',
            questions,
            fingerprint,
            ...overrides
        }
    };
}

function correctionResolutionData(overrides = {}) {
    return {
        resolutionRequired: true,
        resolution: {
            version: 1,
            kind: 'USER_CONFIRMED_HISTORY_CORRECTION',
            title: 'Χρειάζεται διόρθωση του ιστορικού',
            explanation: 'Επιλέξτε τι ίσχυε πραγματικά.',
            conflicts: [{
                conflictId: 'INITIAL_PROFILE_START', kind: 'BOUNDARY', required: true,
                period: { from: '2026-04-24', to: '2026-05-24',
                    label: '24/04/2026 – 24/05/2026' },
                issue: 'Η πρώτη πλήρης εκδοχή αρχίζει αργότερα από την πρόσληψη.',
                decisionRequired: 'Από πότε ίσχυαν οι πρώτοι πλήρεις όροι;',
                intents: [
                    { id: 'FROM_HIRE', label: 'Από την πρόσληψη',
                        description: 'Ίσχυαν από 24/04/2026.' },
                    { id: 'OTHER_DATE', label: 'Από άλλη ημερομηνία',
                        description: 'Δηλώστε την πραγματική ημερομηνία.',
                        effectiveDateControl: { type: 'DATE', required: true,
                            label: 'Ημερομηνία έναρξης', min: '2026-04-24',
                            max: '2026-05-24' } }
                ]
            }, {
                conflictId: 'FIELD_KPK', kind: 'FIELD', required: true,
                period: { from: '2026-04-24', to: '2026-05-24',
                    label: '24/04/2026 – 24/05/2026' },
                field: { id: 'KPK', label: 'Ασφαλιστική κατηγορία / ΚΠΚ',
                    inputType: 'CATALOG_CHOICE' },
                issue: 'Η ιστορική τιμή 0111 διαφέρει από τη μεταγενέστερη 0115.',
                decisionRequired: 'Τι ίσχυε πραγματικά;',
                historicalValues: [{ value: '0111', label: '0111 — ΣΥΝΤΑΞΗ' }],
                laterValue: { value: '0115',
                    label: '0115 — ΣΥΝΤΑΞΗ, ΒΑΡΕΑ, ΙΚΑ-ΤΕΑΜ' },
                intents: [
                    { id: 'CONFIRM_EXISTING', label: 'Το 0111 ήταν σωστό',
                        description: 'Η ιστορική τιμή παραμένει.' },
                    { id: 'CORRECT_EXISTING_HISTORICAL_FACT',
                        label: 'Το 0111 ήταν λανθασμένο',
                        description: 'Διορθώνεται μόνο το ΚΠΚ.',
                        valueControl: { id: 'KPK', label: 'ΚΠΚ',
                            type: 'CATALOG_CHOICE', required: true,
                            allowedValues: [
                                { value: '0111', label: '0111 — ΣΥΝΤΑΞΗ' },
                                { value: '0115', label: '0115 — ΒΑΡΕΑ' }
                            ] } },
                    { id: 'REAL_HISTORICAL_CHANGE',
                        label: 'Έγινε πραγματική αλλαγή',
                        description: 'Οι δύο τιμές ίσχυαν σε διαφορετικές περιόδους.',
                        valueControl: { id: 'KPK', label: 'Νέος ΚΠΚ',
                            type: 'CATALOG_CHOICE', required: true,
                            allowedValues: [
                                { value: '0111', label: '0111 — ΣΥΝΤΑΞΗ' },
                                { value: '0115', label: '0115 — ΒΑΡΕΑ' }
                            ] },
                        effectiveDateControl: { type: 'DATE', required: true,
                            label: 'Ημερομηνία πραγματικής αλλαγής',
                            min: '2026-04-24', max: '2026-05-24' } },
                    { id: 'ENTER_DIFFERENT_VALUE', label: 'Άλλος έγκυρος ΚΠΚ',
                        description: 'Επιλέξτε από τον επίσημο κατάλογο.',
                        valueControl: { id: 'KPK', label: 'ΚΠΚ',
                            type: 'CATALOG_CHOICE', required: true,
                            allowedValues: [{ value: '0109', label: '0109 — ΜΙΚΤΑ' }] } }
                ]
            }],
            responsibilityText: 'Επιβεβαιώνω ότι οι παραπάνω επιλογές αποτυπώνουν τα πραγματικά ιστορικά στοιχεία του εργαζομένου.',
            fingerprint,
            ...overrides
        }
    };
}

function minimalProfileCorrectionResolutionData() {
    return correctionResolutionData({ conflicts: [{
        conflictId: 'INITIAL_PROFILE_TERMS', kind: 'PROFILE', required: true,
        period: { from: '2026-04-23', to: '2026-05-24',
            label: '23/04/2026 – 24/05/2026' },
        issue: 'Λείπουν αναγκαίοι όροι από την αρχική ιστορική περίοδο.',
        decisionRequired: 'Τι ίσχυε πραγματικά στην αρχική περίοδο;',
        intents: [{
            id: 'ENTER_DIFFERENT_VALUE', label: 'Ίσχυαν διαφορετικοί όροι',
            description: 'Συμπληρώστε μόνο τα τέσσερα αναγκαία πεδία.',
            valueControl: {
                type: 'PROFILE_FIELDS', required: true,
                baselineValues: [{ value: 'PROFILE_CANDIDATE_1',
                    label: 'Υφιστάμενη εκδοχή 1' }],
                fields: [
                    { id: 'KPK', label: 'Ασφαλιστική κατηγορία / ΚΠΚ',
                        inputType: 'CATALOG_CHOICE',
                        catalogValues: [{ value: '0109', label: '0109 — ΜΙΚΤΑ' }] },
                    { id: 'WORK_DAYS', label: 'Ημέρες εργασίας ανά εβδομάδα',
                        inputType: 'INTEGER', min: 1, max: 7 },
                    { id: 'WEEKLY_HOURS', label: 'Ώρες εργασίας ανά εβδομάδα',
                        inputType: 'DECIMAL', min: 0.01, max: 168 },
                    { id: 'DAILY_HOURS', label: 'Μέσος όρος ημερήσιας εργασίας',
                        inputType: 'DECIMAL', min: 0.01, max: 24 }
                ]
            }
        }]
    }] });
}

function allElements(root) {
    return [root, ...(root?.children || []).flatMap(allElements)];
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
    const wording = allElements(receivedOptions.html).map(node => node.textContent).join(' ');
    assert.match(wording, /Εξήγηση από διακομιστή/);
    assert.match(wording, /Περιγραφή από διακομιστή/);
});

test('ρητή επιβεβαίωση κάνει ακριβώς μία επανάληψη με αποτύπωμα και χωρίς historyId', async () => {
    let retries = 0;
    let retryPayload;
    let buttonsDisabled = 0;
    const retryResponse = { status: 200, ok: true };
    const swal = {
        close() {},
        disableButtons() { buttonsDisabled += 1; },
        fire: async options => ({ isConfirmed: true, value: await confirmSteps(options) })
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
        fire: async options => ({ isConfirmed: true, value: await confirmSteps(options) })
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

test('το παράθυρο πολλαπλής επιλογής αποδίδει όλες τις επιλογές χωρίς προεπιλογή', () => {
    const resolution = guided.normalizeResolutionResponse(guidedResolutionData());
    const validity = [];
    const content = guided.buildSafeContent(fakeDocument(), resolution,
        value => validity.push(value));
    assert.equal(content.controls.length, 2);
    assert.ok(content.controls.every(control => control.radio.checked === false));
    assert.equal(content.selected(), null);
    assert.equal(validity.at(-1), false);
});

test('επιλογή χωρίς πεδίο ενεργοποιεί τη συνέχεια και δεν στέλνει answers', () => {
    const resolution = guided.normalizeResolutionResponse(guidedResolutionData());
    let valid = null;
    const content = guided.buildSafeContent(fakeDocument(), resolution,
        value => { valid = value; });
    content.controls[0].radio.checked = true;
    content.controls[0].radio.dispatch('change');
    assert.equal(valid, true);
    const selection = content.selected();
    assert.deepEqual(selection, { choiceId: 'KEEP_FIRST_PROFILE' });
    const payload = guided.buildRetryPayload({ formData: { safe: true } }, resolution, selection);
    assert.deepEqual(payload.resolution, {
        choiceId: 'KEEP_FIRST_PROFILE', fingerprint
    });
});

test('επιλογή ημερομηνίας απαιτεί έγκυρη τιμή και διατηρεί τα min/max του διακομιστή', () => {
    const resolution = guided.normalizeResolutionResponse(guidedResolutionData());
    let valid = null;
    const content = guided.buildSafeContent(fakeDocument(), resolution,
        value => { valid = value; });
    const control = content.controls[1];
    assert.equal(control.dateInput.min, '2026-06-25');
    assert.equal(control.dateInput.max, '2026-07-02');
    control.radio.checked = true;
    control.radio.dispatch('change');
    assert.equal(valid, false);
    assert.equal(content.selected(), null);
    control.dateInput.value = '2026-07-03';
    control.dateInput.dispatch('input');
    assert.equal(valid, false);
    control.dateInput.value = '2026-06-28';
    control.dateInput.dispatch('change');
    assert.equal(valid, true);
    const selection = content.selected();
    assert.deepEqual(selection, {
        choiceId: 'CHANGE_OTHER_DATE', answers: { effectiveDate: '2026-06-28' }
    });
    assert.deepEqual(guided.buildRetryPayload({}, resolution, selection).resolution, {
        choiceId: 'CHANGE_OTHER_DATE', fingerprint,
        answers: { effectiveDate: '2026-06-28' }
    });
});

test('ακύρωση πολλαπλής επιλογής κάνει μηδενικές επαναλήψεις και αρχικά απενεργοποιεί τη συνέχεια', async () => {
    let retries = 0;
    const confirmButton = { disabled: false };
    const swal = {
        close() {},
        getConfirmButton: () => confirmButton,
        fire: async options => {
            options.didOpen();
            return { isConfirmed: false };
        }
    };
    const result = await guided.handleInitialResponse({
        response: responseWith(guidedResolutionData()), originalPayload: {},
        retryRequest: async () => { retries += 1; }, swal, documentRef: fakeDocument()
    });
    assert.equal(result.cancelled, true);
    assert.equal(retries, 0);
    assert.equal(confirmButton.disabled, true);
});

test('ρητή επιχειρησιακή επιλογή κάνει ακριβώς μία επανάληψη με ασφαλές payload', async () => {
    let retries = 0;
    let retryPayload;
    const confirmButton = { disabled: false };
    const retryResponse = { status: 200 };
    const swal = {
        close() {}, disableButtons() {}, getConfirmButton: () => confirmButton,
        fire: async options => {
            options.didOpen();
            assert.equal(confirmButton.disabled, true);
            const radio = allElements(options.html).find(node => node.type === 'radio');
            radio.checked = true;
            radio.dispatch('change');
            return { isConfirmed: true, value: await confirmSteps(options) };
        }
    };
    const result = await guided.handleInitialResponse({
        response: responseWith(guidedResolutionData()), originalPayload: { formData: { safe: true } },
        retryRequest: async payload => { retries += 1; retryPayload = payload; return retryResponse; },
        swal, documentRef: fakeDocument()
    });
    assert.equal(result.response, retryResponse);
    assert.equal(retries, 1);
    assert.equal(confirmButton.disabled, true);
    assert.deepEqual(Object.keys(retryPayload.resolution).sort(), ['choiceId', 'fingerprint']);
    assert.equal(JSON.stringify(retryPayload.resolution).includes('historyId'), false);
});

test('παρωχημένη απάντηση επιχειρησιακής επιλογής επιστρέφεται χωρίς δεύτερη επανάληψη', async () => {
    let retries = 0;
    const stale = responseWith({ success: false,
        code: 'EMPLOYEE_HISTORY_MULTIPLE_SAFE_STALE' }, 409);
    const swal = {
        close() {}, disableButtons() {}, getConfirmButton: () => ({ disabled: false }),
        fire: async options => {
            options.didOpen();
            const radio = allElements(options.html).find(node => node.type === 'radio');
            radio.checked = true;
            radio.dispatch('change');
            return { isConfirmed: true, value: await confirmSteps(options) };
        }
    };
    const result = await guided.handleInitialResponse({
        response: responseWith(guidedResolutionData()), originalPayload: {},
        retryRequest: async () => { retries += 1; return stale; },
        swal, documentRef: fakeDocument()
    });
    assert.equal(retries, 1);
    assert.equal(result.response, stale);
});

test('μη έγκυρο συμβόλαιο ή πρόσθετο answer αποτυγχάνει κλειστά', () => {
    assert.equal(guided.normalizeResolutionResponse(guidedResolutionData({
        options: [{ id: 'ONE', label: 'Μία', description: 'Περιγραφή', historyId: 'x' },
            { id: 'TWO', label: 'Δύο', description: 'Περιγραφή' }]
    })), null);
    const resolution = guided.normalizeResolutionResponse(guidedResolutionData());
    assert.throws(() => guided.buildRetryPayload({}, resolution, {
        choiceId: 'CHANGE_OTHER_DATE',
        answers: { effectiveDate: '2026-06-28', historyId: 'forged' }
    }), /Valid guided resolution selection/);
});

test('η συλλογή πραγματικών στοιχείων αποδίδεται χωρίς προεπιλογή και αρχικά είναι ανενεργή', () => {
    const resolution = guided.normalizeResolutionResponse(factResolutionData());
    const validity = [];
    const content = guided.buildSafeContent(fakeDocument(), resolution,
        value => validity.push(value));
    const departure = content.controls[0];
    const date = content.controls[1];
    assert.equal(resolution.kind, 'BUSINESS_FACT_COLLECTION');
    assert.ok(departure.radios.every(radio => radio.checked === false));
    assert.equal(date.wrapper.hidden, true);
    assert.equal(date.dateInput.disabled, true);
    assert.equal(content.selected(), null);
    assert.equal(validity.at(-1), false);
});

test('γνωστή αποχώρηση και NO_DEPARTURE ολοκληρώνουν το απλό ερωτηματολόγιο', () => {
    for (const index of [0, 3]) {
        const resolution = guided.normalizeResolutionResponse(factResolutionData());
        let valid = null;
        const content = guided.buildSafeContent(fakeDocument(), resolution,
            value => { valid = value; });
        content.controls[0].radios[index].checked = true;
        content.controls[0].radios[index].dispatch('change');
        assert.equal(valid, true);
        const answer = index === 0
            ? 'DEPARTED_ON_FIRST_RECORDED_DATE' : 'NO_DEPARTURE';
        assert.deepEqual(content.selected(), { answers: { departureOutcome: answer } });
        assert.deepEqual(guided.buildRetryPayload({}, resolution,
            content.selected()).resolution, {
            fingerprint, answers: { departureOutcome: answer }
        });
    }
});

test('η επιλογή άλλης αποχώρησης εμφανίζει υποχρεωτική ημερομηνία με όρια', () => {
    const resolution = guided.normalizeResolutionResponse(factResolutionData());
    let valid = null;
    const content = guided.buildSafeContent(fakeDocument(), resolution,
        value => { valid = value; });
    content.controls[0].radios[2].checked = true;
    content.controls[0].radios[2].dispatch('change');
    const date = content.controls[1];
    assert.equal(date.wrapper.hidden, false);
    assert.equal(date.dateInput.disabled, false);
    assert.equal(date.dateInput.min, '2026-04-29');
    assert.equal(date.dateInput.max, '2026-10-06');
    assert.equal(valid, false);
    date.dateInput.value = '2026-08-15';
    date.dateInput.dispatch('change');
    assert.equal(valid, true);
    assert.deepEqual(content.selected(), { answers: {
        departureOutcome: 'DEPARTED_ON_OTHER_DATE', departureDate: '2026-08-15'
    } });
});

test('η ροή D2 απαιτεί ανεξάρτητα και το γεγονός ισχύος αποδοχών', () => {
    const resolution = guided.normalizeResolutionResponse(factResolutionData({ pay: true }));
    let valid = null;
    const content = guided.buildSafeContent(fakeDocument(), resolution,
        value => { valid = value; });
    content.controls[0].radios[0].checked = true;
    content.controls[0].radios[0].dispatch('change');
    assert.equal(valid, false);
    content.controls[2].radios[1].checked = true;
    content.controls[2].radios[1].dispatch('change');
    assert.equal(content.controls[3].wrapper.hidden, false);
    assert.equal(valid, false);
    content.controls[3].dateInput.value = '2026-07-01';
    content.controls[3].dateInput.dispatch('input');
    assert.equal(valid, true);
    assert.deepEqual(content.selected(), { answers: {
        departureOutcome: 'DEPARTED_ON_FIRST_RECORDED_DATE',
        payEffectiveOutcome: 'PAY_APPLIED_FROM_OTHER_DATE',
        payEffectiveDate: '2026-07-01'
    } });
});

test('ακύρωση συλλογής γεγονότων κάνει μηδενικές επαναλήψεις και απενεργοποιεί τη συνέχεια', async () => {
    let retries = 0;
    const confirmButton = { disabled: false };
    const swal = {
        close() {},
        getConfirmButton: () => confirmButton,
        fire: async options => {
            options.didOpen();
            return { isConfirmed: false };
        }
    };
    const result = await guided.handleInitialResponse({
        response: responseWith(factResolutionData()), originalPayload: {},
        retryRequest: async () => { retries += 1; }, swal, documentRef: fakeDocument()
    });
    assert.equal(result.cancelled, true);
    assert.equal(retries, 0);
    assert.equal(confirmButton.disabled, true);
});

test('επιβεβαίωση γεγονότων κάνει μία επανάληψη με μόνο fingerprint και επιτρεπτές απαντήσεις', async () => {
    let retries = 0;
    let retryPayload;
    const swal = {
        close() {}, getConfirmButton: () => ({ disabled: false }), disableButtons() {},
        fire: async options => {
            options.didOpen();
            const radio = allElements(options.html).find(node => node.type === 'radio');
            radio.checked = true;
            radio.dispatch('change');
            return { isConfirmed: true, value: await confirmSteps(options) };
        }
    };
    await guided.handleInitialResponse({
        response: responseWith(factResolutionData()),
        originalPayload: { formData: { safe: true } },
        retryRequest: async payload => { retries += 1; retryPayload = payload;
            return { status: 200 }; }, swal, documentRef: fakeDocument()
    });
    assert.equal(retries, 1);
    assert.deepEqual(retryPayload.resolution, {
        fingerprint,
        answers: { departureOutcome: 'DEPARTED_ON_FIRST_RECORDED_DATE' }
    });
    for (const forbidden of ['historyId', '_id', 'aa_eggrafhs', 'patch']) {
        assert.equal(JSON.stringify(retryPayload.resolution).includes(forbidden), false);
    }
});

test('πρόσθετες απαντήσεις και μη έγκυρο συμβόλαιο γεγονότων αποτυγχάνουν κλειστά', () => {
    const resolution = guided.normalizeResolutionResponse(factResolutionData());
    assert.throws(() => guided.buildRetryPayload({}, resolution, { answers: {
        departureOutcome: 'NO_DEPARTURE', historyId: 'forged'
    } }));
    assert.equal(guided.normalizeResolutionResponse(factResolutionData({ overrides: {
        questions: factResolutionData().resolution.questions.map((question, index) => index
            ? question : { ...question, options: question.options.slice(1) })
    } })), null);
});

test('παρωχημένη απάντηση συλλογής γεγονότων επιστρέφεται χωρίς δεύτερη επανάληψη', async () => {
    const stale = responseWith({ success: false,
        code: 'EMPLOYEE_HISTORY_BUSINESS_FACT_STALE' }, 409);
    let retries = 0;
    const swal = {
        close() {}, getConfirmButton: () => ({ disabled: false }), disableButtons() {},
        fire: async options => {
            options.didOpen();
            const radio = allElements(options.html).find(node => node.type === 'radio');
            radio.checked = true;
            radio.dispatch('change');
            return { isConfirmed: true, value: await confirmSteps(options) };
        }
    };
    const result = await guided.handleInitialResponse({
        response: responseWith(factResolutionData()), originalPayload: {},
        retryRequest: async () => { retries += 1; return stale; },
        swal, documentRef: fakeDocument()
    });
    assert.equal(retries, 1);
    assert.equal(result.response, stale);
});

test('το φύλλο διόρθωσης εμφανίζει περίοδο, ετικέτα και τιμές ΚΠΚ χωρίς εσωτερικές ταυτότητες', () => {
    const resolution = guided.normalizeResolutionResponse(correctionResolutionData());
    assert.equal(resolution.kind, 'USER_CONFIRMED_HISTORY_CORRECTION');
    const content = guided.buildSafeContent(fakeDocument(), resolution);
    const text = allElements(content.element).map(item => item.textContent).join(' ');
    assert.match(text, /24\/04\/2026 – 24\/05\/2026/);
    assert.match(text, /Ασφαλιστική κατηγορία \/ ΚΠΚ/);
    assert.match(text, /0111 — ΣΥΝΤΑΞΗ/);
    assert.match(text, /0115 — ΣΥΝΤΑΞΗ, ΒΑΡΕΑ/);
    for (const forbidden of ['historyId', '_id', 'aa_eggrafhs', 'survivorId', 'patch']) {
        assert.equal(JSON.stringify(resolution).includes(forbidden), false);
    }
});

test('οι κλάσεις πλάτους και εσωτερικής κύλισης εφαρμόζονται μόνο στο παράθυρο διόρθωσης', async () => {
    let correctionOptions;
    await guided.handleInitialResponse({
        response: responseWith(correctionResolutionData()), originalPayload: {},
        retryRequest: async () => {}, documentRef: fakeDocument(),
        swal: { close() {}, fire: async options => {
            correctionOptions = options;
            return { isConfirmed: false };
        } }
    });
    assert.match(correctionOptions.customClass.popup,
        /employee-history-correction-popup/);
    assert.match(correctionOptions.customClass.htmlContainer,
        /employee-history-correction-html/);
    assert.equal(correctionOptions.customClass.actions,
        'employee-history-correction-actions');

    let ordinaryOptions;
    await guided.handleInitialResponse({
        response: responseWith(resolutionData()), originalPayload: {},
        retryRequest: async () => {}, documentRef: fakeDocument(),
        swal: { close() {}, fire: async options => {
            ordinaryOptions = options;
            return { isConfirmed: false };
        } }
    });
    assert.equal(ordinaryOptions.customClass.popup, 'custom-swal-popup');
    assert.equal(ordinaryOptions.customClass.htmlContainer, 'custom-html-container');
    assert.equal(ordinaryOptions.customClass.actions, undefined);
});

function employeeCardFixture(headerBottom = 90, footerTop = 700, width = 900) {
    const header = { getBoundingClientRect: () => ({ top: headerBottom - 35,
        bottom: headerBottom, width, height: 35 }) };
    const headerGroup = { querySelector: () => header };
    const body = { classList: fakeClassList(['card-body']),
        getBoundingClientRect: () => ({ top: headerBottom + 70, bottom: footerTop,
            width, height: footerTop - headerBottom - 70 }) };
    const footer = { classList: fakeClassList(['card-footer']),
        getBoundingClientRect: () => ({ top: footerTop, bottom: footerTop + 65,
            width, height: 65 }) };
    const card = { children: [headerGroup, body, footer],
        getBoundingClientRect: () => ({ top: headerBottom - 35,
            bottom: footerTop + 65, width, height: footerTop - headerBottom + 100 }) };
    const button = { getBoundingClientRect: () => ({ width: 120, height: 32 }),
        closest: selector => selector === '.card' ? card : null };
    return { card, header, footer, body, button };
}

test('τα όρια προέρχονται από την πράσινη κεφαλίδα και το υποσέλιδο της ενεργής κάρτας', () => {
    const fixture = employeeCardFixture();
    const hiddenButton = { getBoundingClientRect: () => ({ width: 0, height: 0 }) };
    const documentRef = { querySelectorAll: selector => selector.includes('.submitButton')
        ? [hiddenButton, fixture.button] : [fixture.card] };
    const windowRef = { innerHeight: 900, innerWidth: 1200,
        getComputedStyle: () => ({ display: 'block', visibility: 'visible' }) };
    const cardBounds = guided.findActiveEmployeeCardBounds(documentRef, windowRef);
    assert.equal(cardBounds.header, fixture.header);
    assert.equal(cardBounds.footer, fixture.footer);
    const popup = { style: fakeStyle() };
    const bounds = guided.applyCorrectionModalGeometry(popup, cardBounds, windowRef);
    assert.equal(bounds.top, 98);
    assert.equal(bounds.bottom, 692);
    assert.equal(bounds.height, 594);
    assert.ok(bounds.top < fixture.body.getBoundingClientRect().top);
    assert.ok(bounds.bottom < fixture.footer.getBoundingClientRect().top);
    assert.equal(popup.style.values.top.value, '98px');
    assert.equal(popup.style.values.height.value, 'auto');
    assert.equal(popup.style.values['max-width'].value, '884px');
    const smaller = employeeCardFixture(70, 480, 720);
    const smallBounds = guided.applyCorrectionModalGeometry(popup, smaller,
        { ...windowRef, innerHeight: 520, innerWidth: 800 });
    assert.equal(smallBounds.top, 78);
    assert.equal(smallBounds.bottom, 472);
    assert.equal(smallBounds.viewportFallback, false);
    const fallback = guided.applyCorrectionModalGeometry(popup, null,
        { innerHeight: 600, innerWidth: 800 });
    assert.equal(fallback.top, 8);
    assert.equal(fallback.bottom, 592);
    assert.equal(fallback.viewportFallback, true);
    const tooSmall = guided.deriveCorrectionModalBounds({ headerRect: { bottom: 410 },
        footerRect: { top: 500 }, viewportHeight: 600, viewportWidth: 800 });
    assert.equal(tooSmall.top, 8);
    assert.equal(tooSmall.bottom, 592);
    assert.equal(tooSmall.viewportFallback, true);
});

test('μόνο το περιεχόμενο κυλά και οι ημερομηνίες έχουν επαρκές ύψος στο ειδικό CSS', () => {
    const css = fs.readFileSync(path.resolve(__dirname, '../../../css/main.css'), 'utf8');
    const popupRule = css.match(/\.swal2-popup\.employee-history-correction-popup\s*\{([^}]+)\}/)?.[1] || '';
    const htmlRule = css.match(/\.employee-history-correction-popup\s*>\s*\.employee-history-correction-html\s*\{([^}]+)\}/)?.[1] || '';
    const dateRule = css.match(/\.employee-history-correction-popup input\[type="date"\]\s*\{([^}]+)\}/)?.[1] || '';
    assert.match(popupRule, /width:\s*min\(48rem,\s*calc\(100vw - 2rem\)\)/);
    assert.match(popupRule, /flex-direction:\s*column/);
    assert.match(popupRule, /overflow:\s*hidden/);
    assert.match(htmlRule, /flex:\s*1 1 auto/);
    assert.match(htmlRule, /min-height:\s*0/);
    assert.match(htmlRule, /overflow-y:\s*auto/);
    assert.match(css, /\.employee-history-correction-actions\s*\{[^}]*flex:\s*0 0 auto/s);
    assert.match(dateRule, /min-height:\s*40px/);
    assert.match(dateRule, /padding:\s*8px 12px/);
    assert.match(dateRule, /line-height:\s*22px/);
    assert.doesNotMatch(css, /employee-history-correction-dropdown/);
});

test('οι εγγενείς λίστες διατηρούν ακριβώς τις τιμές και ενημερώνουν την εγκυρότητα', () => {
    const validity = [];
    const content = guided.buildSafeContent(fakeDocument(),
        guided.normalizeResolutionResponse(correctionResolutionData()), value => validity.push(value));
    const correction = content.controls[1].intentControls.find(item =>
        item.intent.id === 'CORRECT_EXISTING_HISTORICAL_FACT');
    const nativeSelect = correction.valueState.element;
    assert.equal(nativeSelect.tagName.toUpperCase(), 'SELECT');
    assert.equal(nativeSelect.className, 'form-select');
    assert.deepEqual(nativeSelect.children.map(option => ({ value: option.value, label: option.textContent })), [
        { value: '', label: 'Επιλέξτε…' },
        { value: '0111', label: '0111 — ΣΥΝΤΑΞΗ' },
        { value: '0115', label: '0115 — ΒΑΡΕΑ' }
    ]);
    const fromHire = content.controls[0].intentControls.find(item => item.intent.id === 'FROM_HIRE');
    fromHire.radio.checked = true;
    fromHire.radio.dispatch('change');
    correction.radio.checked = true;
    correction.radio.dispatch('change');
    assert.equal(correction.dateState, null);
    nativeSelect.value = '0115';
    nativeSelect.dispatch('change');
    assert.equal(validity.at(-1), false);
    content.responsibilityCheckbox.checked = true;
    content.responsibilityCheckbox.dispatch('change');
    assert.equal(validity.at(-1), true);
    assert.equal(content.selected().decisions[1].value, '0115');
});

test('οι λίστες βάσης και καταλόγου PROFILE_FIELDS παραμένουν εγγενείς', () => {
    const data = minimalProfileCorrectionResolutionData();
    data.resolution.conflicts[0].intents[0].valueControl.baselineValues.push({
        value: 'PROFILE_CANDIDATE_2', label: 'Οι καταχωρημένοι όροι της εγγραφής 26/05/2026' });
    const content = guided.buildSafeContent(fakeDocument(), guided.normalizeResolutionResponse(data));
    const intent = content.controls[0].intentControls[0];
    for (const select of [intent.valueState.element, intent.valueState.fieldElements[0].input]) {
        assert.equal(select.tagName.toUpperCase(), 'SELECT');
        assert.equal(select.className, 'form-select');
    }
    assert.ok(intent.valueState.fieldElements.slice(1).every(item =>
        item.input.tagName.toUpperCase() === 'INPUT'));
});

test('το παράθυρο επανυπολογίζει τα όρια και αφαιρεί ακροατές χωρίς Tom Select σε επαναλαμβανόμενο άνοιγμα', async () => {
    let fixture = employeeCardFixture();
    const documentRef = fakeDocument();
    documentRef.querySelectorAll = selector => selector.includes('.submitButton')
        ? [fixture.button] : [fixture.card];
    const popup = { style: fakeStyle() };
    const listeners = new Map();
    const viewportListeners = new Map();
    let tomSelectCreations = 0;
    const windowRef = {
        innerHeight: 900, innerWidth: 1200,
        TomSelect: function () { tomSelectCreations += 1; },
        getComputedStyle: () => ({ display: 'block', visibility: 'visible' }),
        addEventListener(name, listener) { listeners.set(name, listener); },
        removeEventListener(name) { listeners.delete(name); },
        visualViewport: { height: 900, width: 1200, offsetTop: 0,
            addEventListener(name, listener) { viewportListeners.set(name, listener); },
            removeEventListener(name) { viewportListeners.delete(name); } }
    };
    for (let opening = 0; opening < 2; opening += 1) {
        fixture = employeeCardFixture();
        const result = await guided.handleInitialResponse({
            response: responseWith(correctionResolutionData()), originalPayload: {},
            retryRequest: async () => {}, documentRef, windowRef,
            swal: { close() {}, getConfirmButton: () => ({ disabled: false }), getPopup: () => popup,
                fire: async options => {
                    options.didOpen();
                    options.didOpen();
                    assert.equal(listeners.size, 1);
                    assert.equal(popup.style.values.top.value, '98px');
                    fixture = employeeCardFixture(120, 620, 760);
                    listeners.get('resize')();
                    assert.equal(popup.style.values.top.value, '128px');
                    assert.equal(popup.style.values.height.value, 'auto');
                    fixture = employeeCardFixture(110, 610, 740);
                    viewportListeners.get('resize')();
                    assert.equal(popup.style.values.top.value, '118px');
                    assert.equal(allElements(options.html).some(item =>
                        /ts-wrapper|ts-dropdown/.test(item.className)), false);
                    options.willClose();
                    return { isConfirmed: false };
                } }
        });
        assert.equal(result.cancelled, true);
        assert.equal(listeners.size, 0);
        assert.equal(viewportListeners.size, 0);
    }
    assert.equal(tomSelectCreations, 0);
});

test('δεν υπάρχει προεπιλογή, η ευθύνη αρχίζει ψευδής και η εφαρμογή μένει ανενεργή', () => {
    const resolution = guided.normalizeResolutionResponse(correctionResolutionData());
    const validity = [];
    const content = guided.buildSafeContent(fakeDocument(), resolution,
        value => validity.push(value));
    assert.equal(content.responsibilityCheckbox.checked, false);
    assert.equal(content.selected(), null);
    assert.ok(content.controls.every(control => control.intentControls.every(item =>
        item.radio.checked === false)));
    assert.equal(validity.at(-1), false);
});

test('H1: η διεπαφή αποδίδει ακριβώς τέσσερα επεξεργάσιμα πεδία και απαιτεί και τα τέσσερα', () => {
    const resolution = guided.normalizeResolutionResponse(
        minimalProfileCorrectionResolutionData());
    const content = guided.buildSafeContent(fakeDocument(), resolution);
    const intent = content.controls[0].intentControls[0];
    assert.deepEqual(intent.valueState.fieldElements.map(item => item.field.id),
        ['KPK', 'WORK_DAYS', 'WEEKLY_HOURS', 'DAILY_HOURS']);
    assert.equal(intent.valueState.fieldElements.length, 4);
    for (const absent of ['SPECIALTY', 'CONTRACT_TYPE', 'CONTRACT_CATEGORY',
        'LEGAL_PAY', 'ACTUAL_PAY', 'CONTRACT_PAY']) {
        assert.equal(intent.valueState.fieldElements.some(item => item.field.id === absent), false);
    }

    intent.radio.checked = true;
    intent.radio.dispatch('change');
    intent.valueState.element.value = 'PROFILE_CANDIDATE_1';
    intent.valueState.element.dispatch('change');
    const values = ['0109', '5', '40', '8'];
    for (let index = 0; index < 3; index += 1) {
        intent.valueState.fieldElements[index].input.value = values[index];
        intent.valueState.fieldElements[index].input.dispatch('change');
    }
    content.responsibilityCheckbox.checked = true;
    content.responsibilityCheckbox.dispatch('change');
    assert.equal(content.selected(), null);
    intent.valueState.fieldElements[3].input.value = values[3];
    intent.valueState.fieldElements[3].input.dispatch('change');
    assert.deepEqual(content.selected(), { responsibilityAccepted: true, decisions: [{
        conflictId: 'INITIAL_PROFILE_TERMS', intent: 'ENTER_DIFFERENT_VALUE',
        value: 'PROFILE_CANDIDATE_1', values: {
            KPK: '0109', WORK_DAYS: 5, WEEKLY_HOURS: 40, DAILY_HOURS: 8
        }
    }] });
});

test('CORRECT_EXISTING ενεργοποιείται μόνο με πλήρεις αποφάσεις και ρητή επιβεβαίωση', () => {
    const resolution = guided.normalizeResolutionResponse(correctionResolutionData());
    const validity = [];
    const content = guided.buildSafeContent(fakeDocument(), resolution,
        value => validity.push(value));
    const fromHire = content.controls[0].intentControls.find(item =>
        item.intent.id === 'FROM_HIRE');
    fromHire.radio.checked = true;
    fromHire.radio.dispatch('change');
    const correction = content.controls[1].intentControls.find(item =>
        item.intent.id === 'CORRECT_EXISTING_HISTORICAL_FACT');
    correction.radio.checked = true;
    correction.radio.dispatch('change');
    correction.valueState.element.value = '0115';
    correction.valueState.element.dispatch('change');
    assert.equal(content.selected(), null);
    content.responsibilityCheckbox.checked = true;
    content.responsibilityCheckbox.dispatch('change');
    assert.deepEqual(content.selected(), { responsibilityAccepted: true, decisions: [
        { conflictId: 'INITIAL_PROFILE_START', intent: 'FROM_HIRE' },
        { conflictId: 'FIELD_KPK', intent: 'CORRECT_EXISTING_HISTORICAL_FACT', value: '0115' }
    ] });
    assert.equal(validity.at(-1), true);
});

test('REAL_CHANGE εμφανίζει και απαιτεί ημερομηνία μόνο για τη συγκεκριμένη επιλογή', () => {
    const resolution = guided.normalizeResolutionResponse(correctionResolutionData());
    const content = guided.buildSafeContent(fakeDocument(), resolution);
    const fromHire = content.controls[0].intentControls.find(item =>
        item.intent.id === 'FROM_HIRE');
    fromHire.radio.checked = true; fromHire.radio.dispatch('change');
    const realChange = content.controls[1].intentControls.find(item =>
        item.intent.id === 'REAL_HISTORICAL_CHANGE');
    realChange.radio.checked = true; realChange.radio.dispatch('change');
    assert.equal(realChange.dateState.wrapper.hidden, false);
    assert.equal(realChange.dateState.element.disabled, false);
    realChange.valueState.element.value = '0115';
    realChange.valueState.element.dispatch('change');
    content.responsibilityCheckbox.checked = true;
    content.responsibilityCheckbox.dispatch('change');
    assert.equal(content.selected(), null);
    realChange.dateState.element.value = '2026-05-13';
    realChange.dateState.element.dispatch('change');
    assert.deepEqual(content.selected().decisions[1], {
        conflictId: 'FIELD_KPK', intent: 'REAL_HISTORICAL_CHANGE',
        value: '0115', effectiveDate: '2026-05-13'
    });
});

test('Ακύρωση δεν κάνει επανάληψη και Εφαρμογή κάνει ακριβώς μία με το αυστηρό συμβόλαιο', async () => {
    let retries = 0;
    const cancelled = await guided.handleInitialResponse({
        response: responseWith(correctionResolutionData()), originalPayload: {},
        retryRequest: async () => { retries += 1; },
        swal: { close() {}, getConfirmButton: () => ({ disabled: false }), fire: async options => {
            options.didOpen(); return { isConfirmed: false };
        } }, documentRef: fakeDocument()
    });
    assert.equal(cancelled.cancelled, true);
    assert.equal(retries, 0);

    let retryPayload;
    const applied = await guided.handleInitialResponse({
        response: responseWith(correctionResolutionData()),
        originalPayload: { safe: 'original' },
        retryRequest: async payload => { retries += 1; retryPayload = payload;
            return { status: 200 }; },
        swal: { close() {}, getConfirmButton: () => ({ disabled: false }),
            disableButtons() {}, fire: async options => {
                options.didOpen();
                const elements = allElements(options.html);
                for (const value of ['FROM_HIRE', 'CORRECT_EXISTING_HISTORICAL_FACT']) {
                    const radio = elements.find(item => item.type === 'radio' && item.value === value);
                    radio.checked = true; radio.dispatch('change');
                }
                const select = elements.find(item => item.tagName === 'select' &&
                    item.disabled === false);
                select.value = '0115'; select.dispatch('change');
                const checkbox = elements.find(item => item.type === 'checkbox');
                checkbox.checked = true; checkbox.dispatch('change');
                return { isConfirmed: true, value: await confirmSteps(options) };
            } }, documentRef: fakeDocument()
    });
    assert.equal(applied.cancelled, false);
    assert.equal(retries, 1);
    assert.deepEqual(retryPayload.resolution, {
        fingerprint, responsibilityAccepted: true, decisions: [
            { conflictId: 'INITIAL_PROFILE_START', intent: 'FROM_HIRE' },
            { conflictId: 'FIELD_KPK', intent: 'CORRECT_EXISTING_HISTORICAL_FACT', value: '0115' }
        ]
    });
});

test('παρωχημένη απάντηση διόρθωσης επιστρέφεται αυτούσια και κακόβουλο φύλλο απορρίπτεται', async () => {
    const malicious = correctionResolutionData();
    malicious.resolution.conflicts[0].historyId = 'forged';
    assert.equal(guided.normalizeResolutionResponse(malicious), null);

    const stale = responseWith({ success: false,
        code: 'EMPLOYEE_HISTORY_USER_CORRECTION_STALE' }, 409);
    const selection = { responsibilityAccepted: true, decisions: [
        { conflictId: 'INITIAL_PROFILE_START', intent: 'FROM_HIRE' },
        { conflictId: 'FIELD_KPK', intent: 'CONFIRM_EXISTING' }
    ] };
    const resolution = guided.normalizeResolutionResponse(correctionResolutionData());
    const payload = guided.buildRetryPayload({}, resolution, selection);
    assert.equal(payload.resolution.responsibilityAccepted, true);
    assert.equal(stale.status, 409);
});

test('η εγκυρότητα χρησιμοποιεί μόνο το πραγματικό στοιχείο επιβεβαίωσης και ανέχεται την απουσία του', async () => {
    const source = fs.readFileSync(path.join(__dirname, 'employeeHistoryGuidedResolution.js'), 'utf8');
    assert.doesNotMatch(source, /enableConfirmButton|disableConfirmButton/);
    for (const getConfirmButton of [undefined, () => null]) {
        let retries = 0;
        const result = await guided.handleInitialResponse({
            response: responseWith(correctionResolutionData()), originalPayload: {},
            retryRequest: async () => { retries += 1; }, documentRef: fakeDocument(),
            swal: { close() {}, getConfirmButton, fire: async options => {
                options.didOpen();
                assert.equal(await options.preConfirm(), false);
                return { isConfirmed: false };
            } }
        });
        assert.equal(result.cancelled, true);
        assert.equal(retries, 0);
    }
});

for (const status of [200, 409]) test(`HTTP ${status} success:true cannot also open a guided resolution`, async () => {
    for (const envelope of [resolutionData(), guidedResolutionData(), factResolutionData(), correctionResolutionData()]) {
        assert.equal(await guided.readResolutionFromResponse(responseWith({ ...envelope, success: true }, status)), null);
    }
});


function safeStepData(phase = 'CHOICE') {
    const row = { date: '01/01/2026', event: 'Αλλαγή όρων', period: '01/01/2026 – 31/01/2026', details: ['Ώρες εβδομάδας: 40'] };
    return { resolutionRequired: true, resolution: { version: 1, kind: guided.SAFE_CORRECTION_KIND,
        phase, title: 'Έλεγχος / Διόρθωση Ιστορικού', explanation: 'Η εγγραφή χρειάζεται διόρθωση.',
        attention: 'Δεν έχει αποθηκευτεί καμία αλλαγή.', recommendation: null,
        changes: phase === 'PREVIEW' ? ['Η επιλεγμένη εγγραφή θα αποσυρθεί από το ενεργό Ιστορικό.'] : [],
        unchanged: ['Τα παλιά αποθηκευμένα στοιχεία διατηρούνται.'],
        preview: { before: [row], after: phase === 'PREVIEW' ? [] : [row] },
        choices: phase === 'CHOICE' ? [{ id: 'REMOVE_ROW', label: 'Η εγγραφή μπήκε κατά λάθος' }] : [],
        fields: [], fingerprint } };
}
const stepButton = (options, text) => allElements(options.html).find(node => node.tagName === 'button' && node.textContent === text);
const isShown = node => { for (let item = node; item; item = item.parentElement) if (item.hidden) return false; return true; };
const stepText = options => options.html.children[0].textContent;

test('0002: introduction, full preview, Back and confirmation preserve the exact two-request sequence', async () => {
    const sent = [];
    let opening = 0;
    const payload = { employeeId: 'synthetic', updates: [], correction: { intent: 'REVIEW',
        targetHistoryId: 'b'.repeat(24), facts: {}, confirmation: null } };
    const result = await guided.handleInitialResponse({ response: responseWith(safeStepData()),
        originalPayload: payload, entryLabel: 'Εγγραφή 0002', documentRef: fakeDocument(),
        retryRequest: async body => { sent.push(body); return sent.length === 1
            ? responseWith(safeStepData('PREVIEW'), 200) : { status: 200 }; },
        swal: { close() {}, getConfirmButton: () => ({}), async fire(options) {
            options.didOpen(); opening++;
            const next = stepButton(options, 'Συνέχεια'), back = stepButton(options, 'Πίσω');
            assert.equal(await options.preConfirm(), false, 'Cannot submit from introduction');
            assert.match(allElements(options.html).map(node => node.textContent).join(' '), /Εγγραφή 0002/);
            if (opening === 1) {
                assert.equal(stepText(options), 'Βήμα 1 από 2');
                const radio = allElements(options.html).find(node => node.type === 'radio');
                assert.equal(isShown(radio), false);
                next.dispatch('click'); assert.equal(isShown(radio), true);
                assert.equal(next.hidden, true);
                assert.equal(await options.preConfirm(), false);
                radio.checked = true; radio.dispatch('change');
            } else {
                assert.equal(sent.length, 1); assert.equal(sent[0].correction.confirmation, null);
                assert.equal(stepText(options), 'Βήμα 1 από 3');
                next.dispatch('click');
                assert.equal(stepText(options), 'Βήμα 2 από 3');
                const checkbox = allElements(options.html).find(node => node.type === 'checkbox');
                assert.equal(isShown(checkbox), false);
                const before = allElements(options.html).find(node => node.textContent === 'ΠΡΙΝ');
                const after = allElements(options.html).find(node => node.textContent === 'ΜΕΤΑ');
                assert.equal(isShown(before), true); assert.equal(isShown(after), true);
                next.dispatch('click'); assert.equal(isShown(checkbox), true);
                checkbox.checked = true; checkbox.dispatch('change');
                back.dispatch('click'); assert.equal(checkbox.checked, false);
                assert.equal(isShown(before), true);
                next.dispatch('click'); assert.equal(await options.preConfirm(), false);
                checkbox.checked = true; checkbox.dispatch('change');
            }
            return { isConfirmed: true, value: await options.preConfirm() };
        } } });
    assert.equal(sent.length, 2);
    assert.equal(sent[0].correction.intent, 'REMOVE_ROW');
    assert.deepEqual(sent[0].correction.facts, {});
    assert.deepEqual(sent[1].correction.confirmation, { fingerprint, confirmed: true });
    assert.equal(payload.correction.intent, 'REVIEW');
    assert.match(result.successMessage, /αποσύρθηκε/);
});

test('one period at a time; Back preserves answers and requires renewed final acceptance', async () => {
    let sent = 0;
    await guided.handleInitialResponse({ response: responseWith(correctionResolutionData()), originalPayload: {},
        documentRef: fakeDocument(), retryRequest: async () => { sent++; return { status: 200 }; },
        swal: { close() {}, getConfirmButton: () => ({}), async fire(options) {
            options.didOpen();
            const next = stepButton(options, 'Συνέχεια'), back = stepButton(options, 'Πίσω');
            const elements = allElements(options.html);
            const first = elements.find(node => node.type === 'radio' && node.value === 'FROM_HIRE');
            const second = elements.find(node => node.type === 'radio' && node.value === 'CONFIRM_EXISTING');
            next.dispatch('click');
            assert.equal(isShown(first), true); assert.equal(isShown(second), false);
            assert.equal(next.disabled, true);
            first.checked = true; first.dispatch('change'); next.dispatch('click');
            assert.equal(isShown(first), false); assert.equal(isShown(second), true);
            second.checked = true; second.dispatch('change');
            back.dispatch('click'); assert.equal(first.checked, true);
            next.dispatch('click'); assert.equal(second.checked, true);
            next.dispatch('click'); // Full answer review.
            assert.equal(isShown(first), false); assert.equal(isShown(second), false);
            next.dispatch('click');
            const checkbox = elements.find(node => node.type === 'checkbox');
            checkbox.checked = true; checkbox.dispatch('change');
            back.dispatch('click'); next.dispatch('click');
            assert.equal(checkbox.checked, false);
            assert.equal(await options.preConfirm(), false); assert.equal(sent, 0);
            checkbox.checked = true; checkbox.dispatch('change');
            return { isConfirmed: true, value: await options.preConfirm() };
        } } });
    assert.equal(sent, 1);
});

test('conditional periods are skipped without supplying or submitting invented answers', async () => {
    const data = correctionResolutionData();
    data.resolution.conflicts[1].condition = { conflictId: 'INITIAL_PROFILE_START', intent: 'OTHER_DATE' };
    let submitted;
    await guided.handleInitialResponse({ response: responseWith(data), originalPayload: {}, documentRef: fakeDocument(),
        retryRequest: async payload => { submitted = payload; return { status: 200 }; },
        swal: { close() {}, async fire(options) {
            options.didOpen(); const next = stepButton(options, 'Συνέχεια'); next.dispatch('click');
            const radio = allElements(options.html).find(node => node.type === 'radio' && node.value === 'FROM_HIRE');
            radio.checked = true; radio.dispatch('change');
            assert.equal(stepText(options), 'Βήμα 2 από 4');
            next.dispatch('click'); next.dispatch('click');
            const checkbox = allElements(options.html).find(node => node.type === 'checkbox');
            checkbox.checked = true; checkbox.dispatch('change');
            return { isConfirmed: true, value: await options.preConfirm() };
        } } });
    assert.deepEqual(submitted.resolution.decisions, [{ conflictId: 'INITIAL_PROFILE_START', intent: 'FROM_HIRE' }]);
});

for (const phase of ['CHOICE', 'PREVIEW', 'BLOCKED']) test(`stepwise ${phase}: Cancel and forged confirmation send no request`, async () => {
    let sent = 0;
    const result = await guided.handleInitialResponse({ response: responseWith(safeStepData(phase)),
        originalPayload: {}, documentRef: fakeDocument(), retryRequest: async () => { sent++; },
        swal: { close() {}, async fire(options) {
            options.didOpen(); assert.equal(await options.preConfirm(), false);
            assert.equal(options.showCancelButton, true);
            if (phase === 'BLOCKED') {
                assert.equal(options.showConfirmButton, false);
                stepButton(options, 'Συνέχεια').dispatch('click');
                assert.match(options.html.children[1].textContent, /Ζήτησε από διαχειριστή/);
                assert.equal(await options.preConfirm(), false);
            }
            return { isConfirmed: false };
        } } });
    assert.equal(result.cancelled, true); assert.equal(sent, 0);
});

test('two business questions stay separate and review shows only public answers and dates', async () => {
    let submitted;
    await guided.handleInitialResponse({ response: responseWith(factResolutionData({ pay: true })),
        originalPayload: {}, documentRef: fakeDocument(), retryRequest: async body => { submitted = body; return { status: 200 }; },
        swal: { close() {}, async fire(options) {
            options.didOpen(); const next = stepButton(options, 'Συνέχεια'); next.dispatch('click');
            const elements = allElements(options.html);
            const departure = elements.find(node => node.type === 'radio' && node.value === 'DEPARTED_ON_OTHER_DATE');
            const pay = elements.find(node => node.type === 'radio' && node.value === 'PAY_APPLIED_FROM_HIRE');
            assert.equal(isShown(departure), true); assert.equal(isShown(pay), false);
            departure.checked = true; departure.dispatch('change');
            assert.equal(next.disabled, true);
            const date = elements.find(node => node.type === 'date'); date.value = '2026-08-21'; date.dispatch('change');
            assert.equal(next.disabled, false); next.dispatch('click');
            assert.equal(isShown(departure), false); assert.equal(isShown(pay), true);
            pay.checked = true; pay.dispatch('change'); next.dispatch('click');
            const visible = allElements(options.html).filter(isShown).map(node => node.textContent).join(' ');
            assert.match(visible, /21\/08\/2026/); assert.match(visible, /Ίσχυαν από την πρόσληψη/);
            assert.doesNotMatch(visible, /fingerprint|DEPARTED_ON|PAY_APPLIED|_id/);
            next.dispatch('click');
            assert.equal(await options.preConfirm(), false);
            const approval = elements.find(node => node.className?.includes('employee-history-final-approval'));
            const checkbox = approval.children.find(node => node.type === 'checkbox');
            checkbox.checked = true; checkbox.dispatch('change');
            return { isConfirmed: true, value: await options.preConfirm() };
        } } });
    assert.deepEqual(submitted.resolution.answers, { departureOutcome: 'DEPARTED_ON_OTHER_DATE',
        departureDate: '2026-08-21', payEffectiveOutcome: 'PAY_APPLIED_FROM_HIRE' });
});

test('withdrawal period answers request a full preview without sending final confirmation', async () => {
    const worksheet = correctionResolutionData({ conflicts: [{ conflictId: 'WITHDRAWAL_BOUNDARY_0',
        kind: 'BOUNDARY', required: true, period: { from: '2026-01-01', to: null, label: 'Περίοδος από 01/01/2026' },
        issue: 'Χρειάζεται επιβεβαίωση της λήξης.', decisionRequired: 'Πότε έληξαν πραγματικά αυτοί οι όροι;',
        intents: [{ id: 'OTHER_DATE', label: 'Δηλώνω την πραγματική ημερομηνία', description: 'Ακολούθησε την προεπισκόπηση.',
            effectiveDateControl: { type: 'DATE', required: true, label: 'Πραγματική λήξη όρων', min: '2026-01-01', max: '9999-12-31' } }] }] });
    const sent = [];
    let opening = 0;
    await guided.handleInitialResponse({ response: responseWith(worksheet), documentRef: fakeDocument(),
        originalPayload: { correction: { intent: 'REMOVE_ROW', targetHistoryId: 'b'.repeat(24), facts: {}, confirmation: null } },
        retryRequest: async body => { sent.push(body); return responseWith(safeStepData('PREVIEW'), 200); },
        swal: { close() {}, async fire(options) {
            options.didOpen(); opening++;
            if (opening === 2) {
                assert.equal(sent.length, 1); assert.equal(sent[0].correction.confirmation, null);
                assert.equal(options.confirmButtonText, 'Επιβεβαίωση διόρθωσης');
                return { isConfirmed: false };
            }
            assert.equal(options.confirmButtonText, 'Έλεγχος αλλαγών');
            const elements = allElements(options.html);
            const radio = elements.find(node => node.type === 'radio'); radio.checked = true; radio.dispatch('change');
            const date = elements.find(node => node.type === 'date'); date.value = '2026-02-28'; date.dispatch('change');
            const checkbox = elements.find(node => node.type === 'checkbox'); checkbox.checked = true; checkbox.dispatch('change');
            return { isConfirmed: true, value: await confirmSteps(options) };
        } } });
    assert.equal(opening, 2); assert.equal(sent.length, 1);
    assert.deepEqual(sent[0].correction.facts, { periodCorrections: [{ conflictId: 'WITHDRAWAL_BOUNDARY_0',
        intent: 'OTHER_DATE', effectiveDate: '2026-02-28' }] });
});

test('before/after keeps explicit edit intent through Enter, change, F8 and undo',()=>{
    const documentRef=fakeDocument();let changes=0;
    const item=guided.buildBeforeAfterField(documentRef,{id:'PAY',label:'Αποδοχές',inputType:'DECIMAL',min:0,nullable:true},1200,()=>changes++);
    assert.equal(item.state.action,'KEEP');assert.deepEqual(item.value(),{value:1200});
    const key=key=>{let prevented=false;item.wrapper.listeners.keydown({key,preventDefault(){prevented=true;},stopPropagation(){}});assert.ok(prevented);};
    key('Enter');assert.equal(item.state.action,'KEEP');assert.deepEqual(item.value(),{value:1200});
    item.input.value='1350';item.input.dispatch('input');assert.equal(item.state.action,'CHANGE');assert.deepEqual(item.value(),{value:1350});
    key('F8');assert.equal(item.state.action,'CLEAR');assert.deepEqual(item.value(),{value:null});
    item.undo.dispatch('click');assert.equal(item.state.action,'CHANGE');assert.deepEqual(item.value(),{value:1350});
    item.clear.dispatch('click');assert.equal(item.state.action,'CLEAR');assert.deepEqual(item.value(),{value:null});
    assert.ok(changes>=5);
});

test('before/after refuses required clearing and cannot keep an unrecorded fact',()=>{
    const item=guided.buildBeforeAfterField(fakeDocument(),{id:'DAYS',label:'Ημέρες εργασίας',inputType:'INTEGER',min:1,max:7},undefined);
    assert.equal(item.state.action,'CHANGE');assert.equal(item.value(),null);
    item.clear.dispatch('click');assert.equal(item.state.action,'CHANGE');assert.equal(item.value(),null);
    assert.ok(allElements(item.wrapper).some(node=>node.textContent.includes('είναι υποχρεωτικό')));
    item.input.value='5';item.input.dispatch('input');assert.deepEqual(item.value(),{value:5});
    item.wrapper.listeners.keydown({key:'F8',preventDefault(){},stopPropagation(){}});
    assert.equal(item.state.action,'CHANGE');assert.deepEqual(item.value(),{value:5});
    const requiredEmpty=guided.buildBeforeAfterField(fakeDocument(),{id:'REQUIRED',label:'Ώρες',inputType:'DECIMAL'},null);
    assert.equal(requiredEmpty.value(),null);
});
