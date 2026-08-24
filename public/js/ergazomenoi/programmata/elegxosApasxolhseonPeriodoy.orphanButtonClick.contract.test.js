'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, 'elegxosApasxolhseonPeriodoy.js'), 'utf8');
const orphanRenderer = source.slice(source.indexOf('function renderWeeklyHrOrphanItem'),
    source.indexOf('function weeklyHrStage1Counts'));
const clickHandler = source.slice(source.indexOf("document.addEventListener('click'"),
    source.indexOf("document.addEventListener('change'"));

assert.match(orphanRenderer, /class="[^"]*weekly-hr-open-orphan[^"]*"[^>]*data-row-id="\$\{escapeHtml\(row\._id\)\}"/);

const orphanBranch = clickHandler.slice(clickHandler.indexOf("const orphanButton = event.target.closest('.weekly-hr-open-orphan')"),
    clickHandler.indexOf("const dayButton = event.target.closest('.weekly-hr-open-day')"));
assert.match(orphanBranch, /orphanButton\.dataset\.rowId/);
assert.match(orphanBranch, /currentReviewRows\.find/);
assert.match(orphanBranch, /weeklyHrStage1RowsById\.get\(orphanButton\.dataset\.rowId\)/);
assert.match(orphanBranch, /if \(row\) showDetailsModal\(row\); return;/);

assert.match(clickHandler, /const dayButton = event\.target\.closest\('\.weekly-hr-open-day'\)/);
assert.match(clickHandler, /weeklyHrStage1RowsById\.get\(dayButton\.dataset\.rowId\)/);
assert.match(clickHandler, /if \(row\) showDetailsModal\(row\); return;/);

console.log('Employment Review orphan button click contract: PASS');
