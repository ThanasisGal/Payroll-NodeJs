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
const excelExport = source.slice(source.indexOf('async function exportExcel'),
    source.indexOf('let currentPdfBlobUrl'));
assert.match(excelExport, /window\.showLoader/);
assert.match(excelExport, /fetch\([\s\S]*review\/export-excel/);
assert.match(excelExport, /response\.ok/);
assert.match(excelExport, /response\.blob\(\)/);
assert.match(excelExport, /URL\.createObjectURL/);
assert.match(excelExport, /URL\.revokeObjectURL/);
assert.match(excelExport, /window\.hideLoader/);
assert.match(excelExport, /employmentReviewSwal/);
assert.doesNotMatch(excelExport, /window\.location\.href/);

const pdfExport = source.slice(source.indexOf('function exportPdf'),
    source.indexOf('function exportAuditDossierPdf'));
const pdfFunctionsStart = source.indexOf('function openPdfPreview');
const pdfFunctionsEnd = source.indexOf('function initReviewMoveByEnter');
const pdfFunctions = source.slice(pdfFunctionsStart, pdfFunctionsEnd);
assert.match(pdfFunctions, /function exportPdf\(\)[\s\S]*openPdfPreview\([\s\S]*review\/export-pdf/);
assert.match(pdfFunctions,
    /function exportAuditDossierPdf\(\)[\s\S]*openPdfPreview\([\s\S]*review\/export-audit-dossier-pdf/);
assert.doesNotMatch(pdfFunctions, /fetch\(|response\.blob\(|URL\.createObjectURL/);
const previewHelper = source.slice(pdfFunctionsStart, source.indexOf('function exportPdf'));
assert.match(previewHelper, /currentPdfPreviewId = window\.crypto\.randomUUID\(\)/);
assert.match(previewHelper, /previewParams\.set\('preview_id', currentPdfPreviewId\)/);
assert.match(previewHelper, /currentPdfPreviewUrl = `\$\{previewUrl\.split\('\?'\)\[0\]\}\?\$\{previewParams\.toString\(\)\}`/);
assert.match(previewHelper, /window\.showLoader/);
assert.match(previewHelper, /previousIframe\.cloneNode\(false\)/);
assert.match(previewHelper, /previousIframe\.replaceWith\(iframe\)/);
assert.match(previewHelper, /iframe\.addEventListener\('load',[\s\S]*window\.hideLoader/);
assert.match(previewHelper, /iframe\.src = currentPdfPreviewUrl/);
assert.doesNotMatch(previewHelper, /fetch\(|createObjectURL|_csrf/);
assert.doesNotMatch(pdfExport, /Date\.now\(\)/);
const pdfDownload = source.slice(source.indexOf("document.getElementById('reviewPdfDownloadBtn')"),
    source.indexOf("document.addEventListener('DOMContentLoaded'", source.indexOf(
        "document.getElementById('reviewPdfDownloadBtn')")));
assert.match(pdfDownload, /addEventListener\('click', async/);
assert.match(pdfDownload,
    /review\/cached-pdf\/\$\{encodeURIComponent\(currentPdfPreviewId\)\}/);
assert.doesNotMatch(pdfDownload, /review\/export-pdf|review\/export-audit-dossier-pdf/);
assert.match(pdfDownload, /headers\?\.get\?\.\('Content-Disposition'\)/);
assert.match(pdfDownload, /filename\\\*=UTF-8''/);
assert.match(pdfDownload, /response\.blob\(\)/);
assert.match(pdfDownload, /URL\.createObjectURL\(blob\)/);
assert.match(pdfDownload, /a\.download = fileName/);
assert.match(pdfDownload, /URL\.revokeObjectURL\(downloadUrl\)/);
assert.match(pdfDownload,
    /Η προσωρινή έκδοση του PDF έχει λήξει\. Δημιουργήστε ξανά την προεπισκόπηση\./);
assert.doesNotMatch(pdfDownload, /Date\.now\(\)/);
assert.doesNotMatch(pdfFunctions, /Date\.now\(\)|fakelos_elegxou_apasxolhshs_/);

console.log('employment review compact filters and employee selection: PASS');
