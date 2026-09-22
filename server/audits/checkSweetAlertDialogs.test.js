'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { inventory } = require('./checkSweetAlertDialogs');

test('legacy dialog identity survives blank lines and comments before a call', () => {
    const file = 'public/js/common/amka_validation.js';
    const source = fs.readFileSync(path.resolve(__dirname, '../..', file), 'utf8');
    const baseline = inventory().filter(row => row.file === file);
    const shifted = inventory({ [file]: '\n\n// unrelated comment\n' + source })
        .filter(row => row.file === file);
    assert.ok(baseline.length > 0);
    assert.deepEqual(shifted.map(row => row.fingerprint), baseline.map(row => row.fingerprint));
    assert.deepEqual(shifted.map(row => row.line), baseline.map(row => row.line + 3));
});
