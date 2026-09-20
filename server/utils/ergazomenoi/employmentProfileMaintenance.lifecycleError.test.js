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
