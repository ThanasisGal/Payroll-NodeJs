'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { isEmploymentProfileError, profileError } = require('./employmentProfileMaintenance');

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
