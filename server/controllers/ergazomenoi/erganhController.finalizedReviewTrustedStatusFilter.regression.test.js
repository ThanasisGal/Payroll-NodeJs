'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const controller = fs.readFileSync(path.join(__dirname, 'erganhController.js'), 'utf8');
const trustedStatusFilter = "status: mongoose.trusted({ $in: ['ACTIVE', 'CLOSED'] })";

const reportPath = controller.slice(
    controller.indexOf('async function getReviewRowsForExport'),
    controller.indexOf('async function buildEmploymentReviewReportForRequest')
);
const loadResultsPath = controller.slice(
    controller.indexOf('static getProdhlomenaOrariaForReview'),
    controller.indexOf('static getProdhlomenaOrariaOrphanQualityCheck')
);
const excelPath = controller.slice(
    controller.indexOf('static exportProdhlomenaOrariaReviewExcel'),
    controller.indexOf('static exportProdhlomenaOrariaReviewPdf')
);
const pdfPath = controller.slice(
    controller.indexOf('static exportProdhlomenaOrariaReviewPdf'),
    controller.indexOf('static calcApasxolhseisPeriodoy')
);

assert.strictEqual(require('mongoose/package.json').version, '9.8.0');
assert.ok(loadResultsPath.includes(trustedStatusFilter));
assert.ok(reportPath.includes(trustedStatusFilter));
assert.ok(excelPath.includes('sendEmploymentReviewWorkbook(req, res)'));
assert.ok(pdfPath.includes('sendEmploymentReviewPdf(req, res)'));
assert.strictEqual((controller.match(/status: mongoose\.trusted\(\{ \$in: \['ACTIVE', 'CLOSED'\] \}\)/g) || []).length, 2);

const previousSanitizeFilter = mongoose.get('sanitizeFilter');
mongoose.set('sanitizeFilter', true);

const modelName = 'FinalizedReviewTrustedStatusFilterRegression';
const model = mongoose.models[modelName] || mongoose.model(
    modelName,
    new mongoose.Schema({ status: String })
);

function assertTrustedStatusQuery(flow) {
    const untrustedFilter = { status: { $in: ['ACTIVE', 'CLOSED'] } };
    mongoose.sanitizeFilter(untrustedFilter);
    assert.throws(
        () => model.findOne(untrustedFilter).cast(),
        (error) => error?.name === 'CastError' && error?.path === 'status',
        `${flow}: the untrusted control must reproduce the status CastError`
    );

    const trustedFilter = {
        status: mongoose.trusted({ $in: ['ACTIVE', 'CLOSED'] })
    };
    mongoose.sanitizeFilter(trustedFilter);
    const query = model.findOne(trustedFilter);
    assert.doesNotThrow(() => query.cast());
    const castedStatus = query.getFilter().status;
    assert.deepStrictEqual(castedStatus.$in, ['ACTIVE', 'CLOSED']);
    assert.strictEqual(
        Object.prototype.hasOwnProperty.call(castedStatus, '$eq'),
        false
    );
    const trustedSymbols = Object.getOwnPropertySymbols(castedStatus);
    assert.ok(
        trustedSymbols.some((symbol) => String(symbol).includes('mongoose#trustedSymbol'))
    );
}

try {
    assertTrustedStatusQuery('finalized load-results');
    assertTrustedStatusQuery('finalized Excel report');
    assertTrustedStatusQuery('finalized PDF report');
} finally {
    mongoose.set('sanitizeFilter', previousSanitizeFilter);
}

console.log('finalized review trusted status filter regression tests: PASS');
