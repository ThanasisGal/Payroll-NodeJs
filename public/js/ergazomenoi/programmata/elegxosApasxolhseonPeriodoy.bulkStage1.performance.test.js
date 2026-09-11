'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname,
    'elegxosApasxolhseonPeriodoy.js'), 'utf8');
const render = source.slice(source.indexOf('async function renderWeeklyHrStage1('),
    source.indexOf('function prepareWeeklyHrStage1LazyLoad('));
assert.match(source, /async function fetchWeeklyHrStage1Bulk\(/);
assert.match(source, /stage1\/bulk-review/);
assert.match(render, /await fetchWeeklyHrStage1Bulk\(/);
assert.doesNotMatch(render, /Promise\.all\([^)]*fetchWeeklyHrStage1/);
console.log('bulk Stage 1 HTTP contract: PASS');
