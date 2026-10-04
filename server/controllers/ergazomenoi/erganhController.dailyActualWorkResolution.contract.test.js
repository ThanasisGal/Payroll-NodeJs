'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, 'erganhController.js'), 'utf8');
const handler = source.slice(
    source.indexOf('static updateProdhlomenaOrariaReviewRecord'),
    source.indexOf('static unlockProdhlomenaOrariaReviewRecord')
);
const previewHandler = source.slice(
    source.indexOf('static previewHrDailyActualWorkResolution'),
    source.indexOf('static updateProdhlomenaOrariaReviewRecord')
);
const periodHelper = source.slice(
    source.indexOf('async function assertActiveEmploymentReviewCardEvidenceResolutionPeriod'),
    source.indexOf('function assertActiveEmploymentReviewOrphanResolutionPeriod')
);

assert.match(handler, /daily_actual_work_resolution: dailyResolutionCommand/);
assert.match(handler, /removeClientRawCardUpdates\(cleanUpdates\)/);
assert.match(handler, /cleanUpdates = \{\}/);
assert.match(handler, /persistHrDailyActualWorkResolutionWrite/);
assert.match(handler, /assertHrDailyActualWorkPreviewFingerprint/);
assert.match(handler, /reviseApproved: dailyResolutionCommand\.revise_approved === true/);
assert.match(handler, /HR_DAILY_LEAVE_CATEGORY_INVALID/);
assert.match(handler, /buildHrSelectableLeaveCategoryQuery\(\)/);
assert.match(handler, /assertActiveEmploymentReviewCardEvidenceResolutionPeriod/);
assert.match(handler, /PERIOD_CONTROL_DAILY_ACTUAL_WORK_RESOLUTION_NOT_ALLOWED/);
assert.match(handler, /HISTORICAL_RECONSTRUCTION_STALE/);
assert.match(handler, /PERIOD_CONTROL_STALE_WRITE/);
assert.match(periodHelper, /'NORMAL', 'HISTORICAL_RECONSTRUCTED'/);
assert.doesNotMatch(periodHelper, /'FINALIZED'/);
assert.doesNotMatch(periodHelper, /'HISTORICAL_RECONSTRUCTION_REQUIRED'/);
assert.doesNotMatch(handler, /unlockProdhlomenaOrariaReviewRecord\(/);
assert.match(previewHandler, /previewHrDailyActualWorkResolution/);
assert.match(previewHandler, /assertActiveEmploymentReviewCardEvidenceResolutionPeriod/);
assert.match(previewHandler, /loadHrDailyActualWorkResolutionContext/);
assert.doesNotMatch(previewHandler, /updateOne|auditModel|\.create\(/);

const routeSource = fs.readFileSync(path.join(__dirname, '..', '..', 'routes',
    'usersRoute.js'), 'utf8');
assert.match(routeSource,
    /review\/:id\/daily-actual-work-resolution\/preview[\s\S]*previewHrDailyActualWorkResolution/);

for (const field of [
    'hr_daily_actual_work_resolution',
    'ektakth_oroadeia_apologistika',
    'ektakta_diastimata_oroadeias_apologistika',
    'ores_ektakths_oroadeias_apologistika'
]) assert.match(source, new RegExp(field));

console.log('daily actual-work resolution controller contract passed');
