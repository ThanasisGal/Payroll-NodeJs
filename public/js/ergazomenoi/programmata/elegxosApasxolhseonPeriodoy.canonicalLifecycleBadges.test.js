'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const frontend = fs.readFileSync(path.join(__dirname,
    'elegxosApasxolhseonPeriodoy.js'), 'utf8');
const controller = fs.readFileSync(path.join(__dirname,
    '../../../../server/controllers/ergazomenoi/erganhController.js'), 'utf8');

assert.match(controller,
    /canonicalLifecycleProjections[\s\S]*?__lifecycleByWeek[\s\S]*?lifecycle_projection: lifecycleProjection/);
assert.match(controller,
    /return res\.json\(\{[\s\S]*?canonicalLifecycleProjections[\s\S]*?boundaryContextPreflight/);

const loadStart = frontend.indexOf('async function loadResults()');
const loadEnd = frontend.indexOf('function pairNo(', loadStart);
const loadSource = frontend.slice(loadStart, loadEnd);
assert.ok(loadSource.indexOf('payload.canonicalLifecycleProjections') >= 0);
assert.ok(loadSource.indexOf('payload.canonicalLifecycleProjections') <
    loadSource.indexOf('await renderWeeklyHrStage1(rows'));

const updateStart = frontend.indexOf('function updateEmploymentReviewWorkflowPresentation()');
const updateEnd = frontend.indexOf('function renderWeeklyHrStage1BulkToolbar()', updateStart);
const updateSource = frontend.slice(updateStart, updateEnd);
assert.match(updateSource, /const allPayloads = \[\.\.\.currentCanonicalLifecyclePayloads\]/);
assert.doesNotMatch(updateSource, /previousLifecycle|weeklyHrStage1Payloads\.values/);

const refreshStart = frontend.indexOf('async function refreshWeeklyHrStage1Scope(scope)');
const refreshEnd = frontend.indexOf('async function renderWeeklyHrStage1(', refreshStart);
const refreshSource = frontend.slice(refreshStart, refreshEnd);
assert.match(refreshSource, /replaceCanonicalLifecyclePayload\(payload\)/);

const reconstructionStart = frontend.indexOf('async function runHistoricalReconstruction()');
const reconstructionEnd = frontend.indexOf('function currentCorrectiveBranch()',
    reconstructionStart);
assert.match(frontend.slice(reconstructionStart, reconstructionEnd), /await loadResults\(\)/);

console.log('canonical persisted lifecycle badge source contracts: PASS');
