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
                listeners: {},
                appendChild(child) { this.children.push(child); },
                addEventListener(name, listener) { this.listeners[name] = listener; },
                dispatch(name) { this.listeners[name]?.({ target: this }); }
            };
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
    let disabled = 0;
    const swal = {
        close() {},
        disableConfirmButton() { disabled += 1; },
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
    assert.equal(disabled, 1);
});

test('ρητή επιχειρησιακή επιλογή κάνει ακριβώς μία επανάληψη με ασφαλές payload', async () => {
    let retries = 0;
    let retryPayload;
    let enabled = 0;
    const retryResponse = { status: 200 };
    const swal = {
        close() {}, disableButtons() {}, disableConfirmButton() {},
        enableConfirmButton() { enabled += 1; },
        fire: async options => {
            options.didOpen();
            const radio = options.html.children[1].children[0].children[0];
            radio.checked = true;
            radio.dispatch('change');
            return { isConfirmed: true, value: await options.preConfirm() };
        }
    };
    const result = await guided.handleInitialResponse({
        response: responseWith(guidedResolutionData()), originalPayload: { formData: { safe: true } },
        retryRequest: async payload => { retries += 1; retryPayload = payload; return retryResponse; },
        swal, documentRef: fakeDocument()
    });
    assert.equal(result.response, retryResponse);
    assert.equal(retries, 1);
    assert.ok(enabled >= 1);
    assert.deepEqual(Object.keys(retryPayload.resolution).sort(), ['choiceId', 'fingerprint']);
    assert.equal(JSON.stringify(retryPayload.resolution).includes('historyId'), false);
});

test('παρωχημένη απάντηση επιχειρησιακής επιλογής επιστρέφεται χωρίς δεύτερη επανάληψη', async () => {
    let retries = 0;
    const stale = responseWith({ success: false,
        code: 'EMPLOYEE_HISTORY_MULTIPLE_SAFE_STALE' }, 409);
    const swal = {
        close() {}, disableButtons() {}, disableConfirmButton() {}, enableConfirmButton() {},
        fire: async options => {
            options.didOpen();
            const radio = options.html.children[1].children[0].children[0];
            radio.checked = true;
            radio.dispatch('change');
            return { isConfirmed: true, value: await options.preConfirm() };
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
    let disabled = 0;
    const swal = {
        close() {},
        disableConfirmButton() { disabled += 1; },
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
    assert.ok(disabled >= 1);
});

test('επιβεβαίωση γεγονότων κάνει μία επανάληψη με μόνο fingerprint και επιτρεπτές απαντήσεις', async () => {
    let retries = 0;
    let retryPayload;
    const swal = {
        close() {}, disableConfirmButton() {}, enableConfirmButton() {}, disableButtons() {},
        fire: async options => {
            options.didOpen();
            const departure = options.html.children[1].children[0];
            const radio = departure.children[1].children[0];
            radio.checked = true;
            radio.dispatch('change');
            return { isConfirmed: true, value: await options.preConfirm() };
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
        close() {}, disableConfirmButton() {}, enableConfirmButton() {}, disableButtons() {},
        fire: async options => {
            options.didOpen();
            const radio = options.html.children[1].children[0].children[1].children[0];
            radio.checked = true;
            radio.dispatch('change');
            return { isConfirmed: true, value: await options.preConfirm() };
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
