'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateMaMutationDate } = require('./validateMaMutationDate');

test('WebMA accepts the explicit date from the edited form', () => {
    assert.equal(validateMaMutationDate('2026-09-22'), '2026-09-22');
    assert.equal(validateMaMutationDate(' 2026-09-22 '), '2026-09-22');
});

test('WebMA rejects missing, malformed and impossible dates before upload', () => {
    for (const value of ['', undefined, null, {}, '22/09/2026', '2026-02-30', '2026-13-01']) {
        assert.equal(validateMaMutationDate(value), '', String(value));
    }
});
