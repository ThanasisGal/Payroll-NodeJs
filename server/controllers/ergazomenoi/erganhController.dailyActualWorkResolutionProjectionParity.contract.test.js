'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PREVIEW_ROW_FIELDS, withHrDailyPreviewRowFields } = require(
    '../../services/ergazomenoi/apasxoliseisHrDailyActualWorkResolutionService');

const controllerSource = fs.readFileSync(path.join(__dirname, 'erganhController.js'), 'utf8');
const previewHandler = controllerSource.slice(
    controllerSource.indexOf('static previewHrDailyActualWorkResolution'),
    controllerSource.indexOf('static updateProdhlomenaOrariaReviewRecord')
);

const projectedFields = new Set(withHrDailyPreviewRowFields('').split(/\s+/).filter(Boolean));
const missingPersistedFields = PREVIEW_ROW_FIELDS
    .filter((field) => field !== '_id' && !projectedFields.has(field));

assert.deepEqual(missingPersistedFields, []);
assert.ok(projectedFields.has('egkekrimenh_oroadeia_apologistika'));
assert.match(controllerSource,
    /const REVIEW_SELECT_FIELDS = withHrDailyPreviewRowFields\(/);
assert.match(controllerSource,
    /ores_adeias_pistomenes_apologistika egkekrimenh_oroadeia_apologistika ektakth_oroadeia_apologistika/);
assert.match(previewHandler,
    /ProdhlomenaOrariaModel\.findOne\([\s\S]*?\.select\(REVIEW_SELECT_FIELDS\)\.lean\(\)/);

console.log('daily actual-work preview projection parity contract passed');
