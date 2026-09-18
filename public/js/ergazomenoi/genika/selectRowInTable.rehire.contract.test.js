'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../../../..');
const source = fs.readFileSync(path.join(__dirname, 'selectRowInTable.js'), 'utf8');
const mainView = fs.readFileSync(
    path.join(root, 'views/ergazomenoi/ergazomenoi/ergazomenoi.ejs'),
    'utf8'
);
const searchView = fs.readFileSync(
    path.join(root, 'views/ergazomenoi/ergazomenoi/search.ejs'),
    'utf8'
);

for (const view of [mainView, searchView]) {
    assert.match(view, /id="rehire-btn"/);
    assert.match(view, /> Επαναπρόσληψη\s*</);
    assert.match(
        view,
        /data-departure="<%= employmentDateKey\(element\.hmeromhnia_apoxorhshs\) %>"/
    );
}

assert.match(source, /document\.getElementById\('rehire-btn'\)/);
assert.match(source, /const closedRelationship = selectedRowId && Boolean\(selectedRowDeparture\)/);
assert.match(source, /const minRehireDate = nextDateKey\(selectedRowDeparture\)/);
assert.match(source, /icon: 'info'/);
assert.match(source, /input: 'date'/);
assert.match(source, /dateInput\.style\.width = '17rem'/);
assert.match(source, /confirmButtonText: 'Συνέχεια'/);
assert.match(source, /popup: 'custom-swal-popup'/);
assert.match(source, /htmlContainer: 'custom-html-container'/);
assert.match(source, /confirmButton: 'class-success custom-confirm-button custom-swal-button'/);
assert.match(source, /cancelButton: 'custom-cancel-button custom-swal-button'/);
assert.match(source, /Δεν θα αποθηκευτεί κάτι σε αυτό το βήμα/);
assert.match(
    source,
    /\?rehire=1&rehireDate=\$\{encodeURIComponent\(prompt\.value\)\}/
);
assert.doesNotMatch(source, /\/api\/ergazomenoi\/rehire\//);

console.log('PASS employee rehire list UI no-write contract');
