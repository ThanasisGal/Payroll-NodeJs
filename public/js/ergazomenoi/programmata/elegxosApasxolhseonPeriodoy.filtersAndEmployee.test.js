'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../../../..');
const view = fs.readFileSync(path.join(root,
    'views/ergazomenoi/programmata/elegxosApasxolhseonPeriodoy.ejs'), 'utf8');
const source = fs.readFileSync(path.join(__dirname, 'elegxosApasxolhseonPeriodoy.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'public/css/main.css'), 'utf8');
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
['searchBtn', 'exportExcelBtn', 'exportPdfBtn', 'exportAuditDossierPdfBtn'].forEach((id) =>
    assert.match(view, new RegExp(`id="${id}"`)));
assert.match(view, /employment-review-search-actions[\s\S]*employmentReviewEmployeePagination/);
assert.doesNotMatch(view, /<\/div>\s*<\/div>\s*<div id="employmentReviewWorkflowSummary"[\s\S]*<nav id="employmentReviewEmployeePagination"/);
const exportParams = source.slice(source.indexOf('function buildReviewExportParams'),
    source.indexOf('async function exportExcel'));
assert.match(exportParams, /kodikos:\s*document\.getElementById\('kodikos'\)/);
removed.forEach((id) => assert.doesNotMatch(exportParams, new RegExp(id)));

const exportLoading = source.slice(source.indexOf('async function runEmploymentReviewExport'),
    source.indexOf('async function exportExcel'));
assert.match(exportLoading, /button\.disabled = true/);
assert.match(exportLoading, /spinner-border/);
assert.match(exportLoading, /window\.AppLoader\?\.begin\(/);
assert.match(exportLoading, /finally\s*\{[\s\S]*window\.AppLoader\?\.end\(\)/);
assert.match(exportLoading, /button\.disabled = false/);
const excelExport = source.slice(source.indexOf('async function exportExcel'),
    source.indexOf('let currentPdfBlobUrl'));
assert.match(excelExport, /runEmploymentReviewExport\('exportExcelBtn'/);
assert.match(excelExport, /fetch\([\s\S]*\/api\/prodhlomena-oraria\/review\/export-excel/);
assert.match(excelExport, /await response\.blob\(\)/);
assert.match(excelExport, /response\.headers\.get\('Content-Disposition'\)/);
assert.match(excelExport, /anchor\.setAttribute\('data-no-loader', 'true'\)/);
assert.match(source, /runEmploymentReviewExport\('exportPdfBtn'/);
assert.match(source, /runEmploymentReviewExport\('exportAuditDossierPdfBtn'/);
assert.match(source, /trailing_partial_weeks/);
assert.match(source, /showPartialWeekToastOnce/);
assert.match(source, /position:\s*'top-end'/);
assert.match(source, /showCloseButton:\s*true/);
assert.match(source, /showConfirmButton:\s*false/);
assert.match(source, /timer:\s*partialWeekToastDuration\(message\)/);
assert.match(source, /timerProgressBar:\s*true/);
assert.match(source, /bootstrap\.Toast\.getOrCreateInstance/);
assert.match(source, /autohide:\s*true/);
assert.match(source, /delay:\s*options\.timer/);
assert.match(source, /employment-review-partial-week-toast-progress/);
assert.match(source, /data-bs-dismiss="toast"/);
assert.match(source, /partialWeekToastMessagesForCurrentLoad\.has\(message\)/);
assert.match(source, /messages\.forEach\(\(message\)/);
assert.match(source, /partialWeekToastStack\(\)\.appendChild\(slot\)/);
assert.match(source, /if \(length <= 120\) return 4000/);
assert.match(source, /if \(length <= 260\) return 7000/);
assert.match(source, /return 10000/);
assert.doesNotMatch(source, /const partialWeekInfo/);
assert.match(source, /Σελίδα \$\{page\}\/\$\{totalPages\}/);
assert.match(source, /employmentReviewEmployeePageSize = 50/);
assert.equal(Math.ceil(26 / 50), 1);
assert.equal(Math.ceil(51 / 50), 2);
assert.match(source, /BLOCKED:\s*'ΑΠΑΙΤΕΙ ΕΝΕΡΓΕΙΑ'/);
assert.doesNotMatch(source, /ΜΠΛΟΚΑΡΙΣΜΕΝΟ|Μπλοκαρισμένο|Μπλοκαρισμένες/);
assert.match(styles, /\.employment-review-pagination-label\.disabled\s*\{[\s\S]*display:\s*inline-flex;[\s\S]*align-items:\s*center;[\s\S]*align-self:\s*stretch;/);
assert.match(styles, /\.employment-review-partial-week-toast-stack\s*\{[\s\S]*top:\s*0\.75rem;[\s\S]*right:\s*0\.75rem;[\s\S]*flex-direction:\s*column;/);
assert.match(styles, /\.employment-review-partial-week-toast-slot:hover[\s\S]*animation-play-state:\s*paused/);
assert.doesNotMatch(source, /ΜΗ ΕΓΚΥΡΟ \/ STALE/);

console.log('employment review compact filters and employee selection: PASS');
