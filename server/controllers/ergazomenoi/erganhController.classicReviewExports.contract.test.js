const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const controller = fs.readFileSync(path.join(__dirname, 'erganhController.js'), 'utf8');

function methodBody(name, nextName) {
    const start = controller.indexOf(`static ${name}`);
    const end = controller.indexOf(`static ${nextName}`, start);
    assert.notEqual(start, -1, `${name} must exist`);
    assert.notEqual(end, -1, `${nextName} must follow ${name}`);
    return controller.slice(start, end);
}

const excel = methodBody('exportProdhlomenaOrariaReviewExcel', 'exportProdhlomenaOrariaReviewPdf');
const pdf = methodBody('exportProdhlomenaOrariaReviewPdf', 'calcApasxolhseisPeriodoy');
const dossier = methodBody(
    'exportProdhlomenaOrariaReviewAuditDossierPdf',
    'completeWeeklyHrWorkflowStage1'
);

test('classic Excel remains the rich A:AK renderer and cannot early-return to the simplified workbook', () => {
    assert.doesNotMatch(excel, /sendEmploymentReviewWorkbook\s*\(/);
    assert.match(excel, /getReviewRowsForExport\(req\)/);
    assert.match(excel, /orientation: 'landscape'/);
    assert.match(excel, /fitToWidth: 1/);
    assert.match(excel, /ySplit: 1, xSplit: 3/);
    assert.match(excel, /LAST_EXCEL_COLUMN = 'AK'/);
    assert.match(excel, /LAST_EXCEL_COLUMN_NUMBER = 37/);
    assert.match(excel, /numericColumnColors/);
    assert.match(excel, /employeeTotals/);
    assert.match(excel, /branchTotals/);
    assert.match(excel, /grandTotals/);
});

test('classic PDF remains the rich A4 landscape 12-column renderer', () => {
    assert.doesNotMatch(pdf, /sendEmploymentReviewPdf\s*\(/);
    assert.match(pdf, /getReviewRowsForExport\(req\)/);
    assert.match(pdf, /makeReviewPdfDocument\(\)/);
    assert.match(pdf, /const baseCols = \[[\s\S]*?\];/);
    const baseCols = pdf.match(/const baseCols = \[([\s\S]*?)\];/)?.[1] || '';
    assert.equal((baseCols.match(/^\s*\[/gm) || []).length, 12);
    assert.match(pdf, /numericPdfColors/);
    assert.match(pdf, /displayPdfFills/);
    assert.match(pdf, /drawEmployeePolicyTable/);
    assert.match(pdf, /drawEmployeeTotalsSummaryPage/);
    assert.match(pdf, /newPageIfNeeded/);
    assert.match(pdf, /drawTotals\('Γενικά σύνολα'/);
});

test('classic and authoritative scopes remain deliberately separate', () => {
    assert.match(controller, /getReviewRowsForExport\(req, \{ findingsOnly = true \} = \{\}\)/);
    assert.match(controller, /buildEmploymentReviewReportForRequest\(req\)[\s\S]*?getReviewRowsForExport\(req, \{ findingsOnly: false \}\)/);
    assert.match(excel, /getReviewRowsForExport\(req\)/);
    assert.match(pdf, /getReviewRowsForExport\(req\)/);
    assert.match(dossier, /sendEmploymentReviewPdf\(req, res, \{ dossier: true \}\)/);
});
