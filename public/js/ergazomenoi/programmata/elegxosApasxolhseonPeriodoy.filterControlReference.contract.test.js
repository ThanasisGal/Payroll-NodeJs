'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(
    path.join(__dirname, 'elegxosApasxolhseonPeriodoy.js'),
    'utf8'
);

const obsoleteCall = /\bensureScenarioReviewFilterControl\s*\(/g;
const obsoleteDefinition = /function\s+ensureScenarioReviewFilterControl\s*\(/;
const calls = source.match(obsoleteCall) || [];

assert.ok(
    calls.length === 0 || obsoleteDefinition.test(source),
    'ensureScenarioReviewFilterControl must not be called without a definition'
);
assert.doesNotMatch(source, /\bscenarioRequiresReviewOnly\b/);
assert.doesNotMatch(source, /\breviewFilterDefinitions\b/);
assert.match(source, /function\s+filterGeneralReviewRows\s*\(/);
assert.match(source, /function\s+getVisibleReviewRows\s*\([\s\S]*?return\s+filterGeneralReviewRows\s*\(/);
assert.match(source, /function\s+renderCurrentReviewRows\s*\([\s\S]*?renderReviewRows\(getVisibleReviewRows\(\)/);

console.log('employment review filter-control reference contract: PASS');
