'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const script = fs.readFileSync(__dirname + '/putFieldValues.js', 'utf8').replaceAll('\r', '');
const view = fs.readFileSync(__dirname + '/../../../../views/ergazomenoi/ergazomenoi/edit.ejs', 'utf8')
    .replaceAll('\r', '');

test('Employee Maintenance form carries the selected history revision and clears it for rehire', () => {
    assert.match(view, /name="historyExpectedRevision"[^>]+value="<%= originalEmploymentHistoryRevision %>"/);
    assert.match(script, /setRehireField\('historyExpectedRevision', ''\)/);
    assert.match(script, /querySelectorAll\('\.card-body'\)/);
});

test('Employee Maintenance displays the stable actionable server message', () => {
    assert.match(script, /message = data\?\.message \|\| data\?\.errorMessage \|\| ''/);
    assert.match(script, /text: String\(message \|\| err\)/);
});
