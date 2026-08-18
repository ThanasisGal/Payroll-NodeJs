'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../../../..');
const view = fs.readFileSync(path.join(root,
    'views/ergazomenoi/programmata/elegxosApasxolhseonPeriodoy.ejs'), 'utf8');
const source = fs.readFileSync(path.join(__dirname, 'elegxosApasxolhseonPeriodoy.js'), 'utf8');
const removed = ['only_apologistiko', 'only_nyxta', 'only_argia',
    'only_yperergasia', 'scenarioRequiresReviewOnly'];
removed.forEach((id) => {
    assert.doesNotMatch(view, new RegExp(`id="${id}"`));
    assert.doesNotMatch(source, new RegExp(`getElementById\\('${id}'\\)`));
});
assert.doesNotMatch(view, /Μόνο Απολογιστικό|Μόνο Νύχτα|Μόνο Αργία|Μόνο Υπερεργασία|Μόνο προς έλεγχο/);
assert.match(view, /id="reviewFiltersEnterScope"[\s\S]*id="reviewEmployee"[\s\S]*employment-review-search-actions/);
assert.match(view, /id="kodikos"[\s\S]*data-target-input="kodikos"/);
assert.match(view, /id="ypokatasthma"[\s\S]*data-skip-autoload="true"[\s\S]*id="reviewEmployee"[\s\S]*data-skip-autoload="true"/);
['searchBtn', 'exportExcelBtn', 'exportPdfBtn'].forEach((id) =>
    assert.match(view, new RegExp(`id="${id}"`)));
const exportParams = source.slice(source.indexOf('function buildReviewExportParams'),
    source.indexOf('async function exportExcel'));
assert.match(exportParams, /kodikos:\s*document\.getElementById\('kodikos'\)/);
removed.forEach((id) => assert.doesNotMatch(exportParams, new RegExp(id)));

console.log('employment review compact filters and employee selection: PASS');
