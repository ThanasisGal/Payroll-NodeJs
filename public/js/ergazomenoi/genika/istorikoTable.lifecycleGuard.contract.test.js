'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, 'istorikoTable.js'), 'utf8');
const historyView = fs.readFileSync(path.join(__dirname,
    '../../../../views/ergazomenoi/ergazomenoi/partials/edit/cardBodies/section7/istoriko.ejs'), 'utf8');
const maintenanceView = fs.readFileSync(path.join(__dirname,
    '../../../../views/ergazomenoi/ergazomenoi/partials/edit/cardBodies/section1/accordion/stoixeiaProslhpshs.ejs'), 'utf8');
assert.match(source, /field === 'hmeromhnia_proslhpshs'/);
assert.match(source, /readonly disabled aria-disabled="true"/);
assert.match(source, /Καταχωρήστε πρώτα την Αποχώρηση και έπειτα χρησιμοποιήστε την Επαναπρόσληψη/);
assert.match(source, /dataset\.currentRelationshipOpen/);
assert.match(source, /hireCell\.dataset\.iso = currentHireDate/);
assert.match(historyView, /data-current-relationship-open/);
assert.match(historyView, /Αποχώρηση και μετά χρησιμοποιήστε την Επαναπρόσληψη/);
assert.match(maintenanceView, /currentRelationshipOpen \? 'readonly aria-readonly="true"/);
assert.match(maintenanceView, /Καταχωρήστε πρώτα την Αποχώρηση και στη συνέχεια χρησιμοποιήστε την Επαναπρόσληψη/);
console.log('PASS history lifecycle UI guard contract');
