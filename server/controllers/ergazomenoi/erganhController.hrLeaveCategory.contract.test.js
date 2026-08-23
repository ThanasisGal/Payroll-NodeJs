'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, 'erganhController.js'), 'utf8');
const handler = source.slice(source.indexOf('static updateProdhlomenaOrariaReviewRecord'),
    source.indexOf('static unlockProdhlomenaOrariaReviewRecord'));

assert.match(source, /assertHrSelectableLeaveCategory/);
assert.match(handler, /assertHrSelectableLeaveCategory\(cleanUpdates\.kathgoria_adeias_apologistika\)/);

console.log('daily HR leave category server guard contract passed');
