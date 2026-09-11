'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname,
    'elegxosApasxolhseonPeriodoy.js'), 'utf8');
const load = source.slice(source.indexOf('async function loadResults()'),
    source.indexOf('function pairNo(', source.indexOf('async function loadResults()')));
const prepare = source.slice(source.indexOf('function prepareWeeklyHrStage1LazyLoad('),
    source.indexOf('async function loadPreparedWeeklyHrStage1('));
const delegatedClick = source.slice(source.indexOf("document.addEventListener('click', (event) => {",
    source.indexOf('async function loadPreparedWeeklyHrStage1(')),
source.indexOf('async function loadResults()'));

assert.match(load, /prepareWeeklyHrStage1LazyLoad\(rows/);
assert.doesNotMatch(load, /await renderWeeklyHrStage1\(rows/);
assert.match(prepare, /weekly-hr-stage1-lazy-placeholder/);
assert.match(delegatedClick,
    /data-workflow-stage=\\?"STAGE1\\?"[\s\S]*loadPreparedWeeklyHrStage1\(\)/);

console.log('lazy Stage 1 initial-load performance contract: PASS');
