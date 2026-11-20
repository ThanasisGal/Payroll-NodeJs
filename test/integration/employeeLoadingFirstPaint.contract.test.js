'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const partials = 'views/ergazomenoi/ergazomenoi/partials/';
const load = read(partials + 'employeeFormLoading.ejs');

test('Add and Edit title exists on first server-rendered frame', () => {
    const add = read(partials + 'add/cardHeaders/cardHeader_Add_Section1.ejs');
    const edit = read(partials + 'edit/cardHeaders/cardHeader_Edit_Section1.ejs');
    assert.match(add, /class="[^"]*sectionTitle[^\"]*">Εισαγωγή Νέων Εργαζομένων \(Σταθερά Στοιχεία\)<\/label>/);
    assert.match(edit, /class="[^"]*sectionTitle[^\"]*">Συντήρηση Στοιχείων Εργαζομένων \(Σταθερά Στοιχεία\)<\/label>/);
});

test('Edit gender label matches the persisted checked state before scripts run', () => {
    const ejs = read(partials + 'edit/cardBodies/section1/accordion/prosopikaStoixeia.ejs');
    assert.match(ejs, /<label for="fylo" id="label-fylo"[^>]*>[\s\S]*?<%= safe\('fylo'\) \? 'ΓΥΝΑΙΚΑ' : 'ΑΝΔΡΑΣ' %>/);
    const toggle = read('public/js/common/toggleLabelErgazomenon.js');
    assert.match(toggle, /case 'fylo':[\s\S]{0,140}isChecked \? 'ΓΥΝΑΙΚΑ' : 'ΑΝΔΡΑΣ'/);
});

test('Body stays present, Footer is not gated by a one-time visibility sample', () => {
    assert.match(load, /--payroll-card-space: max\(18rem,/);
    assert.doesNotMatch(load, /data-employee-body-visible=/);
    assert.doesNotMatch(load, /employeeBodyVisible/);
    assert.match(load, /page\.querySelector\('\.tadded-container'\)\.inert = false/);
    assert.match(load, /if \(!ready\(\)\) \{ event\.preventDefault\(\); event\.stopImmediatePropagation\(\); \}/);
    assert.match(load, /page\.dataset\.employeeFormState = 'failed'/);
});

test('native pre-initialization selects use a neutral placeholder, no fake values', () => {
    assert.match(load, /content: "Φόρτωση επιλογών…"/);
    assert.match(load, /select\.tom-dropdown\[data-api\]:not\(\.ts-hidden-accessible\)/);
    assert.match(load, /data-employee-form-state="loading"/);
    assert.match(load, /pointer-events: none;/);
});
