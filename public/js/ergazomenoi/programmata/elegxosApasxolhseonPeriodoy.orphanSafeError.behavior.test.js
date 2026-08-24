'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, 'elegxosApasxolhseonPeriodoy.js'), 'utf8');
const start = source.indexOf('function employmentReviewSaveErrorMessage');
const end = source.indexOf('\n\n', start);
assert(start >= 0 && end > start);
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(source.slice(start, end), sandbox);

assert.strictEqual(sandbox.employmentReviewSaveErrorMessage({
    code: 'EMPLOYMENT_REVIEW_STALE_WRITE',
    message: 'Η εγγραφή άλλαξε από άλλη ενέργεια.'
}), 'Η εγγραφή άλλαξε από άλλη ενέργεια.');
assert.strictEqual(sandbox.employmentReviewSaveErrorMessage({
    error: 'MongoServerError: duplicate key', stack: 'secret stack'
}), 'Η ενημέρωση δεν ολοκληρώθηκε. Παρακαλώ δοκιμάστε ξανά.');
assert.strictEqual(sandbox.employmentReviewSaveErrorMessage(null),
    'Η ενημέρωση δεν ολοκληρώθηκε. Παρακαλώ δοκιμάστε ξανά.');
assert(source.includes('text: employmentReviewSaveErrorMessage(payload)'));
assert(source.includes('text: employmentReviewSaveErrorMessage(null)'));

console.log('orphan safe error frontend behavioral test: PASS');
