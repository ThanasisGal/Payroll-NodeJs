'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, 'elegxosApasxolhseonPeriodoy.js'), 'utf8');
const loader = source.slice(
    source.indexOf('async function loadEmploymentPeriodControl('),
    source.indexOf('async function transitionEmploymentPeriod(')
);
const initialLoad = source.slice(
    source.indexOf('async function loadResults()'),
    source.indexOf('function pairNo(')
);

assert.match(loader, /\{ skipLoader = false \} = \{\}/);
assert.match(loader, /headers: \{ Accept: 'application\/json', 'CSRF-Token': csrfToken \},\s*skipLoader/);
assert.match(initialLoad, /periodControl\.readiness_deferred === true/);
assert.match(initialLoad, /loadEmploymentPeriodControl\(advancedBranch, \{ skipLoader: true \}\)/);

const explicitCalls = [...source.matchAll(/loadEmploymentPeriodControl\([^\n]+/g)]
    .map((match) => match[0])
    .filter((call) => !call.startsWith('loadEmploymentPeriodControl(ypokatasthma'));
assert.equal(explicitCalls.filter((call) => call.includes('skipLoader: true')).length, 1);
assert.ok(explicitCalls.some((call) => !call.includes('skipLoader: true')));

console.log('deferred period-control loader isolation tests passed');
