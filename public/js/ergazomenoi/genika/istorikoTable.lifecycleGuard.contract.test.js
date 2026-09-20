'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, 'istorikoTable.js'), 'utf8');
assert.match(source, /field === 'hmeromhnia_proslhpshs'/);
assert.match(source, /readonly disabled aria-disabled="true"/);
assert.match(source, /ελεγχόμενης διόρθωσης lifecycle\/επαναπρόσληψης/);
console.log('PASS history lifecycle UI guard contract');
