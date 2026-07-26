'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../../../..');
const view = fs.readFileSync(
    path.join(root, 'views/ergazomenoi/programmata/exagoghOrarionSeErganh.ejs'),
    'utf8'
);
const control = fs.readFileSync(path.join(__dirname, 'controlCheckbox.js'), 'utf8');
const copyView = fs.readFileSync(
    path.join(root, 'views/ergazomenoi/programmata/antigrafhProgrammatonErgasias.ejs'),
    'utf8'
);
const layout = fs.readFileSync(path.join(root, 'views/layouts/main.ejs'), 'utf8');

assert.ok(!/type="hidden"[^>]+(?:username|password)/i.test(view));
assert.ok(!/\busername\s*:|\bpassword\s*:/.test(control));
assert.ok(layout.includes("script('common/csrfFetchPatch')"));
assert.ok(view.includes('nonce="<%= nonce %>"'));
assert.ok(copyView.includes('!userPrivileges.admin && !userPrivileges.update && !userPrivileges.create'));
assert.ok(view.includes('!userPrivileges.admin && !userPrivileges.update'));
console.log('PASS programmata frontend credentials, CSRF, CSP, and UI privilege contract');
