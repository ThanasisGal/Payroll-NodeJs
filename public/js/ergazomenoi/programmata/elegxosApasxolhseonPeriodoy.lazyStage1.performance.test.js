'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname,
    'elegxosApasxolhseonPeriodoy.js'), 'utf8');
const loadStart = source.indexOf('async function loadResults(');
const loadEnd = source.indexOf('function pairNo(', loadStart);
assert.notEqual(loadStart, -1, 'loadResults start boundary must exist');
assert.notEqual(loadEnd, -1, 'loadResults end boundary must exist');
assert.ok(loadEnd > loadStart, 'loadResults end boundary must follow its start boundary');
const load = source.slice(loadStart, loadEnd);

const prepareStart = source.indexOf('function prepareWeeklyHrStage1LazyLoad(');
const prepareEnd = source.indexOf('async function loadPreparedWeeklyHrStage1(', prepareStart);
assert.notEqual(prepareStart, -1, 'Stage1 lazy preparation start boundary must exist');
assert.notEqual(prepareEnd, -1, 'Stage1 lazy preparation end boundary must exist');
assert.ok(prepareEnd > prepareStart,
    'Stage1 lazy preparation end boundary must follow its start boundary');
const prepare = source.slice(prepareStart, prepareEnd);

const delegatedClickStart = source.indexOf("document.addEventListener('click', (event) => {",
    prepareEnd);
const delegatedClickEnd = loadStart;
assert.notEqual(delegatedClickStart, -1, 'delegated click start boundary must exist');
assert.notEqual(delegatedClickEnd, -1, 'delegated click end boundary must exist');
assert.ok(delegatedClickEnd > delegatedClickStart,
    'delegated click end boundary must follow its start boundary');
const delegatedClick = source.slice(delegatedClickStart, delegatedClickEnd);

assert.match(load, /prepareWeeklyHrStage1LazyLoad\(rows/);
assert.doesNotMatch(load, /await renderWeeklyHrStage1\(rows/);
assert.match(prepare, /weekly-hr-stage1-lazy-placeholder/);
assert.match(delegatedClick,
    /data-workflow-stage=\\?"STAGE1\\?"[\s\S]*loadPreparedWeeklyHrStage1\(\)/);

console.log('lazy Stage 1 initial-load performance contract: PASS');
