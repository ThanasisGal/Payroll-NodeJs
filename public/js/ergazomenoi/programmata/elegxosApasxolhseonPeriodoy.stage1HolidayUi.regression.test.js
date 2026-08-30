'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(
    path.join(__dirname, 'elegxosApasxolhseonPeriodoy.js'), 'utf8'
);

function functionSource(name) {
    const match = source.match(new RegExp(`function ${name}\\([^]*?\\n}`));
    assert.ok(match, `Missing frontend function: ${name}`);
    return match[0];
}

const classificationSource = functionSource('stage1ClassificationForRow');
assert.doesNotMatch(classificationSource,
    /row\.argia\s*===\s*true[^\n]*return\s+['"]HOLIDAY['"]/);

const editorSource = functionSource('renderStage1DayEditor');
assert.match(editorSource,
    /stage1DailyPresentationForDate\(payload, date\)[\s\S]*?holiday_classification_eligible\s*===\s*true/);
assert.match(editorSource,
    /holidayEligible\s*\?[\s\S]*?['"]HOLIDAY['"][\s\S]*?:\s*\['UNCLASSIFIED', 'LEAVE', 'SICKNESS', 'ABSENCE'\]/);
assert.match(editorSource,
    /if \(holidayEligible && draft\.classification === 'UNCLASSIFIED'\)[\s\S]*?draft\.classification = 'HOLIDAY'/);
assert.match(editorSource,
    /holidayEligible \? `<button[^`]*weekly-hr-save-holiday-day[^`]*>Αποθήκευση<\/button>` : ''/);

const drafts = new Map();
const editorSandbox = {
    weeklyHrLeaveCategories: [],
    weeklyHrStage1DayDrafts: drafts,
    weeklyHrStage1DaySelected: new Set(),
    weeklyHrStage1DaySaving: false,
    escapeHtml: String,
    formatStage1DateKey: String,
    stage1DateKey: (value) => String(value || '').slice(0, 10)
};
const editorHelpers = [
    'stage1ClassificationForRow',
    'stage1ClassificationLabel',
    'stage1RowForDate',
    'stage1DailyPresentationForDate',
    'isHrSelectableLeaveCategoryOption',
    'stage1LeaveCategoryOptions',
    'formatStage1LeaveCategoryLabel',
    'renderStage1DayEditor'
].map(functionSource).join('\n');
vm.runInNewContext(`${editorHelpers}\nthis.render = renderStage1DayEditor;`, editorSandbox);

function payloadFor(row, eligible) {
    const date = String(row.hmeromhnia).slice(0, 10);
    return {
        rows: [row],
        workflow: { unclassified_stage2_candidates: [] },
        stage1_daily_presentation: [{
            date,
            holiday_classification_eligible: eligible
        }]
    };
}

const eligibleRow = { _id: 'eligible', hmeromhnia: '2026-08-15' };
const eligibleHtml = editorSandbox.render(payloadFor(eligibleRow, true), '2026-08-15');
assert.equal(drafts.get('eligible').classification, 'HOLIDAY');
assert.match(eligibleHtml, /<option value="HOLIDAY" selected>Αργία<\/option>/);
assert.match(eligibleHtml, /weekly-hr-save-holiday-day[^>]*>Αποθήκευση<\/button>/);

const rawHolidayRow = { _id: 'raw-holiday', hmeromhnia: '2026-08-16', argia: true };
const ineligibleHtml = editorSandbox.render(payloadFor(rawHolidayRow, false), '2026-08-16');
assert.equal(drafts.has('raw-holiday'), false);
assert.doesNotMatch(ineligibleHtml, /value="HOLIDAY"/);
assert.doesNotMatch(ineligibleHtml, /weekly-hr-save-holiday-day/);

const presentationSource = functionSource('renderStage1DayFacts');
assert.match(presentationSource,
    /stage1CurrentClassificationLabel\(item\.current_apologistiko_classification\)/);
assert.doesNotMatch(editorSource, /current_apologistiko_classification/);

const saveSource = source.match(
    /async function saveStage1DailyClassificationDrafts\([^]*?\n}/
)?.[0] || '';
assert.ok(saveSource, 'Missing Stage 1 daily classification save function');
assert.match(saveSource, /saveStage1DailyClassificationDrafts\(requestedRowIds = null\)/);
assert.match(saveSource,
    /const requestedSet = requestedRowIds[\s\S]*?new Set\(\[\.\.\.requestedRowIds\]\.map\(String\)\)/);
assert.match(saveSource,
    /const draftsToSave = \[\.\.\.weeklyHrStage1DayDrafts\][\s\S]*?requestedSet\.has\(String\(rowId\)\)/);
assert.match(saveSource,
    /const changes = draftsToSave\.map\(\(\[row_id, draft\]\) => \(\{ row_id, \.\.\.draft \}\)\)/);
assert.match(saveSource,
    /draftsToSave\.some\(\(\[rowId\]\)[\s\S]*?affectedKeys\.add\(key\)/);
assert.match(saveSource,
    /if \(requestedSet && Number\(result\.failed_count \|\| 0\) > 0\)[\s\S]*?throw new Error/);
assert.match(saveSource,
    /Promise\.all\(\[\.\.\.affectedKeys\]\.map\(\(key\) => refreshWeeklyHrStage1Scope/);

const clickPath = source.slice(
    source.indexOf("const holidaySaveButton = event.target.closest('.weekly-hr-save-holiday-day')"),
    source.indexOf("if (event.target.closest('.weekly-hr-select-all'))")
);
assert.match(clickPath,
    /saveStage1DailyClassificationDrafts\(\[holidaySaveButton\.dataset\.rowId\]\)/);
assert.doesNotMatch(clickPath, /fetch\(|XMLHttpRequest|axios/);

console.log('Stage 1 holiday UI regression tests: PASS');
