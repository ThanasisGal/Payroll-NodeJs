'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { isEmploymentProfileError, profileError, historyEditorChanges } = require('./employmentProfileMaintenance');

for (const flag of [false, true]) test(`generic history input strips hire flag ${flag} and preserves other submitted fields`, () => {
    const mapped = { afora_proslhpsh: flag, poso_symbashs_01: 1200, symbash: 'contract' };
    const data = { afora_proslhpsh: flag, poso_symbashs_01: 1200 };
    assert.deepEqual(historyEditorChanges(mapped, data), { poso_symbashs_01: 1200 });
    assert.equal(mapped.afora_proslhpsh, flag);
    assert.equal(data.afora_proslhpsh, flag);
});

test('internal generic hire-flag rejection has an actionable unchanged-state response', () => {
    const code = 'EMPLOYEE_HISTORY_HIRE_FLAG_SERVER_OWNED';
    assert.equal(isEmploymentProfileError({ code }), true);
    const res = { status(value) { this.code = value; return this; }, json(value) { this.body = value; } };
    profileError(res, { code, statusCode: 409 });
    assert.equal(res.code, 409);
    assert.equal(res.body.reason, code);
    assert.match(res.body.message, /1\..*2\..*3\./);
    assert.match(res.body.message, /Δεν αποθηκεύτηκε καμία αλλαγή\./);
    assert.match(res.body.message, new RegExp(`Κωδικός αναφοράς: ${code}$`));
});

test('closed relationship conflict explains why new work terms cannot be saved', () => {
    const code = 'EMPLOYEE_PROFILE_NEW_VERSION_REQUIRES_OPEN_RELATIONSHIP';
    assert.equal(isEmploymentProfileError({ code }), true);
    const res = { status(value) { this.code = value; return this; }, json(value) { this.body = value; } };
    profileError(res, { code, statusCode: 409 });
    assert.equal(res.code, 409);
    assert.equal(res.body.success, false);
    assert.equal(res.body.reason, code);
    assert.equal(res.body.message, res.body.errorMessage);
    assert.match(res.body.message, /εργασιακή σχέση έχει ήδη κλείσει/);
    assert.match(res.body.message, /Δεν μπορεί να προστεθεί νέα μεταβολή σε αυτή τη σχέση/);
    assert.match(res.body.message, /1\. Ελέγξτε το Ιστορικό.*2\. Επιλέξτε τη σωστή εργασιακή σχέση/);
    assert.match(res.body.message, /διορθώστε τα στοιχεία της σχέσης/);
    assert.match(res.body.message, /Δεν αποθηκεύτηκε καμία αλλαγή\./);
    assert.match(res.body.message, new RegExp(`Κωδικός αναφοράς: ${code}$`));
    assert.doesNotMatch(res.body.message,
        /lifecycle|canonical|planner|transaction|schema|Mongo|V1|Η αποθήκευση εργαζομένου και ιστορικού απέτυχε/i);
});

test('employment-cycle failures are handled as visible profile conflicts', () => {
    assert.equal(isEmploymentProfileError({ code: 'EMPLOYMENT_CYCLE_OVERLAP' }), true);
    let statusCode = null;
    let payload = null;
    const res = {
        status(value) { statusCode = value; return this; },
        json(value) { payload = value; return value; }
    };
    profileError(res, { code: 'EMPLOYMENT_CYCLE_OVERLAP', statusCode: 409 });
    assert.equal(statusCode, 409);
    assert.match(payload.errorMessage, /επικαλυπτόμενες εργασιακές σχέσεις/);
});

const departureCorrectionCodes = [
    'EMPLOYEE_DEPARTURE_CANCELLATION_REQUIRES_CONTROLLED_FLOW',
    'EMPLOYEE_DEPARTURE_DATE_CORRECTION_BLOCKED',
    'EMPLOYEE_DEPARTURE_DATE_CORRECTION_INVALID_BOUNDARY',
    'EMPLOYEE_DEPARTURE_DATE_CORRECTION_STALE',
    'EMPLOYEE_DEPARTURE_DEFERRED_AMBIGUITY_INVALID_BOUNDARY',
    'EMPLOYEE_HISTORY_INVALID_DEPARTURE_NOT_APPLICABLE',
    'EMPLOYEE_HISTORY_INVALID_DEPARTURE_TARGET_MISMATCH',
    'EMPLOYEE_HISTORY_INVALID_DEPARTURE_COMPETING_DEPARTURE',
    'EMPLOYEE_HISTORY_INVALID_DEPARTURE_CURRENT_CHANGE_REQUIRED',
    'EMPLOYEE_HISTORY_INVALID_DEPARTURE_REMAINING_AMBIGUITY',
    'EMPLOYEE_HISTORY_INVALID_DEPARTURE_CORRECTION_BLOCKED_OTHER',
    'EMPLOYEE_HISTORY_INVALID_DEPARTURE_CORRECTION_INVALID_REQUEST',
    'EMPLOYEE_HISTORY_INVALID_DEPARTURE_CORRECTION_INVALID_BOUNDARY'
];

test('PR C lifecycle failures have actionable fail-closed user messages', () => {
    for (const code of departureCorrectionCodes) {
        assert.equal(isEmploymentProfileError({ code }), true, code);
        let statusCode = null;
        let payload = null;
        const res = {
            status(value) { statusCode = value; return this; },
            json(value) { payload = value; return value; }
        };
        profileError(res, { code, statusCode: 409 });
        assert.equal(statusCode, 409, code);
        assert.match(payload.errorMessage, /1\./, code);
        assert.match(payload.errorMessage, /2\./, code);
        assert.match(payload.errorMessage, /3\./, code);
        assert.match(payload.errorMessage, /Δεν αποθηκεύτηκε καμία αλλαγή\./, code);
        assert.match(payload.errorMessage, new RegExp(`Κωδικός αναφοράς: ${code}$`), code);
    }
});

test('unique-safe conflict serializes only the public allowlist and actionable message', () => {
    let statusCode = null;
    let payload = null;
    const res = {
        status(value) { statusCode = value; return this; },
        json(value) { payload = value; return value; }
    };
    profileError(res, {
        code: 'EMPLOYEE_HISTORY_UNIQUE_SAFE_REPAIR_REQUIRED',
        statusCode: 409,
        resolutionRequired: true,
        resolution: {
            version: 1,
            kind: 'UNIQUE_SAFE_REPAIR',
            title: 'Βρέθηκε ασυνέπεια στο ιστορικό',
            explanation: 'Ασφαλής εξήγηση',
            options: [{ id: 'APPLY_UNIQUE_SAFE_PLAN', label: 'Τακτοποίηση ιστορικού',
                description: 'Ασφαλής περιγραφή', historyId: 'must-not-leak' }],
            fingerprint: 'a'.repeat(64),
            historyId: 'must-not-leak',
            diagnostics: { _id: 'must-not-leak' }
        }
    });
    assert.equal(statusCode, 409);
    assert.equal(payload.resolutionRequired, true);
    assert.deepEqual(Object.keys(payload.resolution).sort(),
        ['explanation', 'fingerprint', 'kind', 'options', 'title', 'version']);
    assert.equal(JSON.stringify(payload).includes('must-not-leak'), false);
    assert.match(payload.message, /1\./);
    assert.match(payload.message, /2\./);
    assert.match(payload.message, /Δεν αποθηκεύτηκε καμία αλλαγή\./);
});

test('malformed repair metadata is never reflected to the browser', () => {
    let payload;
    const res = { status() { return this; }, json(value) { payload = value; return value; } };
    profileError(res, { code: 'EMPLOYEE_HISTORY_UNIQUE_SAFE_REPAIR_REQUIRED',
        statusCode: 409, resolutionRequired: true,
        resolution: { kind: 'UNIQUE_SAFE_REPAIR', historyId: 'forged' } });
    assert.equal(payload.resolutionRequired, undefined);
    assert.equal(payload.resolution, undefined);
});

test('guided business conflict serializes only safe choices and date presentation bounds', () => {
    let payload;
    const res = { status() { return this; }, json(value) { payload = value; return value; } };
    profileError(res, {
        code: 'EMPLOYEE_HISTORY_MULTIPLE_SAFE_RESOLUTION_REQUIRED',
        statusCode: 409,
        resolutionRequired: true,
        resolution: {
            version: 1,
            kind: 'GUIDED_BUSINESS_CHOICE',
            title: 'Χρειάζεται επιβεβαίωση του ιστορικού',
            explanation: 'Επιλέξτε τι συνέβη πραγματικά.',
            options: [{ id: 'KEEP_PROFILE', label: 'Διατήρηση προφίλ',
                description: 'Το προφίλ ίσχυε σε όλη την περίοδο.' },
            { id: 'CHANGE_OTHER_DATE', label: 'Άλλη ημερομηνία',
                description: 'Δηλώστε την πραγματική ημερομηνία.', inputs: [{
                    id: 'effectiveDate', type: 'date', label: 'Ημερομηνία έναρξης',
                    required: true, min: '2026-06-25', max: '2026-07-02'
                }] }],
            fingerprint: 'b'.repeat(64),
            internalPlans: { historyId: 'must-not-leak' }
        }
    });
    assert.equal(payload.resolutionRequired, true);
    assert.equal(payload.resolution.kind, 'GUIDED_BUSINESS_CHOICE');
    assert.equal(JSON.stringify(payload).includes('must-not-leak'), false);
    assert.deepEqual(payload.resolution.options[1].inputs[0], {
        id: 'effectiveDate', type: 'date', label: 'Ημερομηνία έναρξης',
        required: true, min: '2026-06-25', max: '2026-07-02'
    });
    assert.match(payload.message, /1\./);
    assert.match(payload.message, /Δεν αποθηκεύτηκε καμία αλλαγή\./);
});

test('unsafe guided option schema fails closed and is not reflected', () => {
    let payload;
    const res = { status() { return this; }, json(value) { payload = value; return value; } };
    profileError(res, {
        code: 'EMPLOYEE_HISTORY_MULTIPLE_SAFE_RESOLUTION_REQUIRED',
        statusCode: 409,
        resolutionRequired: true,
        resolution: { version: 1, kind: 'GUIDED_BUSINESS_CHOICE',
            options: [{ id: 'ONE', label: 'Μία', description: 'Περιγραφή', historyId: 'x' },
                { id: 'TWO', label: 'Δύο', description: 'Περιγραφή' }],
            fingerprint: 'c'.repeat(64) }
    });
    assert.equal(payload.resolutionRequired, undefined);
    assert.equal(payload.resolution, undefined);
});

test('business-fact conflict serializes only controlled questions and actionable text', () => {
    let payload;
    const res = { status() { return this; }, json(value) { payload = value; return value; } };
    profileError(res, {
        code: 'EMPLOYEE_HISTORY_BUSINESS_FACT_REQUIRED', statusCode: 409,
        resolutionRequired: true,
        resolution: {
            version: 1, kind: 'BUSINESS_FACT_COLLECTION',
            title: 'Χρειάζονται πραγματικά στοιχεία για το ιστορικό',
            explanation: 'Επιβεβαιώστε τι συνέβη πραγματικά.',
            questions: [{
                id: 'departureOutcome', type: 'SINGLE_CHOICE',
                label: 'Τι συνέβη πραγματικά με την αποχώρηση;', required: true,
                options: [
                    { id: 'DEPARTED_ON_FIRST_RECORDED_DATE', label: 'Πρώτη ημερομηνία' },
                    { id: 'DEPARTED_ON_SECOND_RECORDED_DATE', label: 'Δεύτερη ημερομηνία' },
                    { id: 'DEPARTED_ON_OTHER_DATE', label: 'Άλλη ημερομηνία' },
                    { id: 'NO_DEPARTURE', label: 'Δεν πραγματοποιήθηκε αποχώρηση' }
                ]
            }, {
                id: 'departureDate', type: 'DATE', label: 'Ημερομηνία αποχώρησης',
                required: true, min: '2026-04-29', max: '2026-10-06',
                condition: { questionId: 'departureOutcome',
                    equals: 'DEPARTED_ON_OTHER_DATE' }
            }],
            fingerprint: 'd'.repeat(64),
            internalResolutionRules: { historyId: 'must-not-leak' }
        }
    });
    assert.equal(payload.resolutionRequired, true);
    assert.equal(payload.resolution.kind, 'BUSINESS_FACT_COLLECTION');
    assert.equal(JSON.stringify(payload).includes('must-not-leak'), false);
    assert.deepEqual(Object.keys(payload.resolution).sort(),
        ['explanation', 'fingerprint', 'kind', 'questions', 'title', 'version']);
    assert.match(payload.message, /1\./);
    assert.match(payload.message, /2\./);
    assert.match(payload.message, /3\./);
    assert.match(payload.message, /Δεν αποθηκεύτηκε καμία αλλαγή\./);
});

test('business-fact failures have numbered fail-closed messages and support references', () => {
    for (const code of [
        'EMPLOYEE_HISTORY_BUSINESS_FACT_STALE',
        'EMPLOYEE_HISTORY_BUSINESS_FACT_INVALID_BOUNDARY',
        'EMPLOYEE_HISTORY_BUSINESS_FACT_SIMULATION_FAILED',
        'EMPLOYEE_HISTORY_BUSINESS_FACT_FINAL_VERIFICATION_FAILED'
    ]) {
        let payload;
        const res = { status() { return this; }, json(value) { payload = value; return value; } };
        profileError(res, { code, statusCode: 409 });
        assert.match(payload.message, /1\./, code);
        assert.match(payload.message, /2\./, code);
        assert.match(payload.message, /3\./, code);
        assert.match(payload.message, /Δεν αποθηκεύτηκε καμία αλλαγή\./, code);
        assert.match(payload.message, new RegExp(`Κωδικός αναφοράς: ${code}$`), code);
    }
});

test('η απαίτηση επιβεβαιωμένης διόρθωσης εκθέτει μόνο ασφαλές επιχειρησιακό φύλλο', () => {
    let payload;
    const res = { status() { return this; }, json(value) { payload = value; return value; } };
    profileError(res, {
        code: 'EMPLOYEE_HISTORY_USER_CORRECTION_REQUIRED', statusCode: 409,
        resolutionRequired: true,
        resolution: {
            version: 1, kind: 'USER_CONFIRMED_HISTORY_CORRECTION',
            title: 'Χρειάζεται διόρθωση του ιστορικού',
            explanation: 'Επιλέξτε τι ίσχυε πραγματικά.',
            conflicts: [{ conflictId: 'FIELD_KPK', kind: 'FIELD', required: true,
                period: { from: '2026-04-24', to: '2026-05-24',
                    label: '24/04/2026 – 24/05/2026' },
                field: { id: 'KPK', label: 'Ασφαλιστική κατηγορία / ΚΠΚ',
                    inputType: 'CATALOG_CHOICE' },
                issue: 'Η ιστορική τιμή 0111 διαφέρει από τη μεταγενέστερη 0115.',
                decisionRequired: 'Τι ίσχυε πραγματικά;',
                historicalValues: [{ value: '0111', label: '0111 — ΣΥΝΤΑΞΗ' }],
                laterValue: { value: '0115', label: '0115 — ΒΑΡΕΑ' },
                intents: [{ id: 'CONFIRM_EXISTING', label: 'Το 0111 ήταν σωστό',
                    description: 'Η ιστορική τιμή παραμένει.' }]
            }],
            responsibilityText: 'Επιβεβαιώνω ότι οι παραπάνω επιλογές αποτυπώνουν τα πραγματικά ιστορικά στοιχεία του εργαζομένου.',
            fingerprint: '7'.repeat(64),
            internalRules: { historyId: 'must-not-leak' }
        }
    });
    assert.equal(payload.resolutionRequired, true);
    assert.equal(payload.resolution.kind, 'USER_CONFIRMED_HISTORY_CORRECTION');
    assert.equal(JSON.stringify(payload).includes('must-not-leak'), false);
    assert.equal(JSON.stringify(payload).includes('historyId'), false);
    assert.match(payload.resolution.responsibilityText, /Επιβεβαιώνω/);
    assert.match(payload.message, /1\./);
    assert.match(payload.message, /2\./);
    assert.match(payload.message, /3\./);
    assert.match(payload.message, /Δεν αποθηκεύτηκε καμία αλλαγή\./);
});

test('όλα τα σφάλματα διόρθωσης εξηγούν ενέργεια, αιτία, βήματα και μη αποθήκευση', () => {
    for (const code of [
        'EMPLOYEE_HISTORY_USER_CORRECTION_RESPONSIBILITY_REQUIRED',
        'EMPLOYEE_HISTORY_USER_CORRECTION_INVALID_REQUEST',
        'EMPLOYEE_HISTORY_USER_CORRECTION_INCOMPLETE',
        'EMPLOYEE_HISTORY_USER_CORRECTION_STALE',
        'EMPLOYEE_HISTORY_USER_CORRECTION_CATALOG_UNAVAILABLE',
        'EMPLOYEE_HISTORY_USER_CORRECTION_INVALID_VALUE',
        'EMPLOYEE_HISTORY_USER_CORRECTION_SIMULATION_FAILED',
        'EMPLOYEE_HISTORY_USER_CORRECTION_INVALID_BOUNDARY',
        'EMPLOYEE_HISTORY_USER_CORRECTION_FINAL_VERIFICATION_FAILED'
    ]) {
        let payload;
        const res = { status() { return this; }, json(value) { payload = value; return value; } };
        profileError(res, { code, statusCode: 409 });
        assert.match(payload.message, /1\./, code);
        assert.match(payload.message, /2\./, code);
        assert.match(payload.message, /3\./, code);
        assert.match(payload.message, /Δεν αποθηκεύτηκε καμία αλλαγή\./, code);
        assert.match(payload.message, new RegExp(`Κωδικός αναφοράς: ${code}$`), code);
        assert.doesNotMatch(payload.message, /Mongo|aa_eggrafhs|stack/i, code);
    }
});

test('κακόβουλο φύλλο διόρθωσης απορρίπτεται και δεν ανακλά τεχνικές ταυτότητες', () => {
    let payload;
    const res = { status() { return this; }, json(value) { payload = value; return value; } };
    profileError(res, { code: 'EMPLOYEE_HISTORY_USER_CORRECTION_REQUIRED', statusCode: 409,
        resolutionRequired: true, resolution: {
            version: 1, kind: 'USER_CONFIRMED_HISTORY_CORRECTION',
            conflicts: [{ conflictId: 'BAD', historyId: 'forged' }],
            responsibilityText: 'Επιβεβαιώνω', fingerprint: '6'.repeat(64)
        } });
    assert.equal(payload.resolutionRequired, undefined);
    assert.equal(payload.resolution, undefined);
    assert.equal(JSON.stringify(payload).includes('forged'), false);
});
