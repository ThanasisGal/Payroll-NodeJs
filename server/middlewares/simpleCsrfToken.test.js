'use strict';
const { test } = require('node:test'), assert = require('node:assert/strict');
const { createSimpleCsrfToken, COOKIE, isCsrfError } = require('./simpleCsrfToken');
test('Πραγματική αποτυχία CSRF διακρίνεται από γενικά μη έγκυρα δεδομένα ή δικαιώματα', () => {
    assert.equal(isCsrfError(Object.assign(Error('rejected'), { code: 'EBADCSRFTOKEN' })), true);
    assert.equal(isCsrfError(Error('Invalid or missing CSRF token')), true);
    for (const message of ['invalid employment profile', 'invalid approval', 'Forbidden', 'Access denied']) assert.equal(isCsrfError(Error(message)), false);
});
test('Επαναχρησιμοποίηση cookie χωρίς εγγραφή Set-Cookie και αυστηρή σύγκριση του διακριτικού', () => {
    const csrf = createSimpleCsrfToken(), req = { cookies: { [COOKIE]: 'synthetic-token' }, headers: { 'x-csrf-token': 'synthetic-token' } };
    const res = { locals: {}, cookie() { assert.fail('Δεν επιτρέπεται αναγέννηση υπάρχοντος cookie'); } };
    csrf.exposeToken(req, res, () => {}); assert.equal(res.locals.csrfToken, 'synthetic-token'); assert.equal(csrf.validateToken(req), true);
    assert.equal(csrf.validateToken({ ...req, headers: { 'x-csrf-token': 'old-token' } }), false);
    assert.equal(csrf.validateToken({ ...req, cookies: {} }), false);
    assert.equal(csrf.validateToken({ ...req, headers: { 'x-csrf-token': ['synthetic-token'] } }), false);
});
