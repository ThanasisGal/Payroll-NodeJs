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
assert.match(section, /assertActiveEmploymentReviewPeriodReadable/);
assert.match(section, /runWithStaleStage3ResolutionWriteFence/);
assert.match(section, /runWithPeriodWriteFence/);
assert.match(section, /expected_input_fingerprint/);
assert.match(section, /expected_stage3_version/);
assert.match(section, /STAGE3_FIELDS_NOT_ALLOWED/);
assert.match(routes, /weekly-hr-workflow\/stage3\/resolve-day'[\s\S]*requireCriticalEmploymentDecisionRole[\s\S]*resolveWeeklyHrStage3Day/);
console.log('erganhController weekly HR Stage-3 command contract tests passed');
