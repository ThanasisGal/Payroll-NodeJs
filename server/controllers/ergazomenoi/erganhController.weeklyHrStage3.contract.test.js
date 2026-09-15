'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const controller = fs.readFileSync(path.join(__dirname, 'erganhController.js'), 'utf8');
const routes = fs.readFileSync(path.join(__dirname, '../../routes/usersRoute.js'), 'utf8');

assert.match(controller, /static resolveWeeklyHrStage3Day/);
const section = controller.slice(controller.indexOf('static resolveWeeklyHrStage3Day'),
    controller.indexOf('static previewProdhlomenaOrariaOrphanResolution'));
assert.match(section, /loadWeeklyHrStage3DecisionContext/);
assert.match(section, /assertActiveEmploymentReviewStage3DayWritable/);
assert.match(section, /runWithStaleStage3ResolutionWriteFence/);
assert.match(section, /runWithPeriodWriteFence/);
assert.match(section, /expected_input_fingerprint/);
assert.match(section, /expected_stage3_version/);
assert.match(section, /STAGE3_FIELDS_NOT_ALLOWED/);
assert.match(routes, /weekly-hr-workflow\/stage3\/resolve-day'[\s\S]*requireCriticalEmploymentDecisionRole[\s\S]*resolveWeeklyHrStage3Day/);
assert.match(controller, /static previewWeeklyHrStage3Bulk/);
const previewSection = controller.slice(controller.indexOf('static previewWeeklyHrStage3Bulk'),
    controller.indexOf('static applyWeeklyHrStage3Bulk'));
assert.match(previewSection, /buildWeeklyHrStage3BulkPreview/);
assert.match(previewSection, /loadWeeklyHrStage3DecisionContext/);
assert.match(previewSection, /assertActiveEmploymentReviewStage3DayWritable/);
assert.match(controller, /persistedStage2State:\s*state\?\.stage2 \|\| null/);
assert.match(controller, /resolved_dates:\s*stage3FingerprintResolvedDates\(stage3\)/);
assert.doesNotMatch(previewSection, /runWithPeriodWriteFence|runWithStaleStage3ResolutionWriteFence|executeWeeklyHrStage3Day|writeCanonicalDailyClassification/);
assert.match(routes, /weekly-hr-workflow\/stage3\/bulk-preview'[\s\S]*checkAuth[\s\S]*requireEmploymentReviewAccess[\s\S]*requireCriticalEmploymentDecisionRole[\s\S]*previewWeeklyHrStage3Bulk/);
assert.match(controller, /static applyWeeklyHrStage3Bulk/);
const bulkApplySection = controller.slice(controller.indexOf('static applyWeeklyHrStage3Bulk'),
    controller.indexOf('static resolveWeeklyHrStage3Day'));
assert.match(bulkApplySection, /normalizeStage3BulkApplyCommand/);
assert.match(bulkApplySection, /inspectStage3BulkIdempotency/);
assert.match(bulkApplySection, /if \(prior\) return res\.json\(\{ success: true, \.\.\.prior \}\)/);
assert.match(bulkApplySection, /applyWeeklyHrStage3Bulk/);
assert.match(bulkApplySection, /runWithStaleStage3ResolutionWriteFence/);
assert.match(bulkApplySection, /runWithPeriodWriteFence/);
assert.match(bulkApplySection, /executeWeeklyHrStage3Day/);
assert.match(bulkApplySection, /transactionRunner:\s*\(work\)\s*=>\s*work\(envelope\)/);
assert.match(bulkApplySection, /applied_count:\s*0/);
assert.match(routes, /weekly-hr-workflow\/stage3\/bulk-apply'[\s\S]*checkAuth[\s\S]*requireEmploymentReviewAccess[\s\S]*requireCriticalEmploymentDecisionRole[\s\S]*applyWeeklyHrStage3Bulk/);
console.log('erganhController weekly HR Stage-3 command contract tests passed');
