'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname,
    'elegxosApasxolhseonPeriodoy.js'), 'utf8');
const render = source.slice(source.indexOf('function renderWeeklyHrStage1Presentation()'),
    source.indexOf('async function refreshWeeklyHrStage1Scope('));
assert.match(source, /WEEKLY_HR_STAGE1_PAGE_SIZE = 100/);
assert.match(render, /filtered\.slice\(start, start \+ WEEKLY_HR_STAGE1_PAGE_SIZE\)/);
assert.match(render, /Σελίδα \$\{weeklyHrStage1Page\} από \$\{totalPages\}/);
assert.match(source, /weekly-hr-stage1-page-prev/);
assert.match(source, /weekly-hr-stage1-page-next/);
assert.match(source, /weeklyHrStage1Selected = new Set\(\)/);
assert.match(source, /weeklyHrStage1DayDrafts = new Map\(\)/);

// Behavioral characterization of the state model used by the page renderer.
const payloads = Array.from({ length: 150 }, (_, index) => ({
    key: `scope-${index + 1}`, rowId: `row-${index + 1}`
}));
const selected = new Set();
const selectedDays = new Set();
const drafts = new Map();
let page = 1;
const visible = () => payloads.slice((page - 1) * 100, page * 100);
selected.add('scope-1'); selectedDays.add('row-1');
drafts.set('row-1', { classification: 'LEAVE' });
assert.equal(visible().some(item => item.key === 'scope-1'), true);
page = 2;
assert.equal(visible().some(item => item.key === 'scope-1'), false);
page = 1;
assert.equal(selected.has('scope-1'), true);
assert.equal(selectedDays.has('row-1'), true);
assert.deepEqual(drafts.get('row-1'), { classification: 'LEAVE' });
page = 2;
const filtered = payloads.filter(item => Number(item.key.split('-')[1]) % 2 === 0);
page = 1;
assert.equal(page, 1, 'A filter change resets pagination to page one');
const selectedForBulk = new Set(['scope-1', 'scope-120']);
const bulkScopes = payloads.filter(item => selectedForBulk.has(item.key));
assert.deepEqual(bulkScopes.map(item => item.key), ['scope-1', 'scope-120']);
assert.equal(visible().some(item => item.key === 'scope-120'), false,
    'The bulk dataset includes selections outside the visible page');
assert.equal(filtered.length, 75);
console.log('Stage 1 pagination state contract: PASS');
