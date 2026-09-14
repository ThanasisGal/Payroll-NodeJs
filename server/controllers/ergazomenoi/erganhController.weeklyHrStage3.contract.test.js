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
    controller.indexOf('static resolveWeeklyHrStage3Day'));
assert.match(previewSection, /buildWeeklyHrStage3BulkPreview/);
assert.match(previewSection, /loadWeeklyHrStage3DecisionContext/);
assert.match(previewSection, /assertActiveEmploymentReviewStage3DayWritable/);
assert.doesNotMatch(previewSection, /runWithPeriodWriteFence|runWithStaleStage3ResolutionWriteFence|executeWeeklyHrStage3Day|writeCanonicalDailyClassification/);
assert.match(routes, /weekly-hr-workflow\/stage3\/bulk-preview'[\s\S]*checkAuth[\s\S]*requireEmploymentReviewAccess[\s\S]*requireCriticalEmploymentDecisionRole[\s\S]*previewWeeklyHrStage3Bulk/);
assert.doesNotMatch(routes, /weekly-hr-workflow\/stage3\/bulk-(?:apply|complete|resolve)/);
console.log('erganhController weekly HR Stage-3 command contract tests passed');
