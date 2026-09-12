'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const controller = fs.readFileSync(path.join(__dirname, 'erganhController.js'), 'utf8');
const routes = fs.readFileSync(path.join(__dirname, '../../routes/usersRoute.js'), 'utf8');
assert.match(routes, /weekly-hr-workflow\/stage2\/bulk-preview/);
assert.match(routes, /weekly-hr-workflow\/stage2\/bulk-complete'[\s\S]*requireCriticalEmploymentDecisionRole[\s\S]*completeWeeklyHrWorkflowStage2Bulk/);
assert.match(controller, /loadWeeklyHrStage2BulkPreparedContexts/);
assert.match(controller, /stage2BulkPreview/);
assert.match(controller, /publicWeeklyHrStage2BulkPreview/);
assert.match(controller, /prepareWeeklyHrStage2PairRecords/);
assert.match(controller, /getReviewRowsForExport\(req, \{ includeLifecycle: true/);
assert.match(controller, /__workflowStates/);
assert.match(controller, /__workflowAudits/);
assert.match(controller, /new Map/);
assert.doesNotMatch(controller.match(/static completeWeeklyHrWorkflowStage2Bulk[\s\S]*?\n    };/)?.[0] || '',
    /loadWeeklyHrStage2CompletionContext/);
assert.match(controller, /writeCanonicalDailyClassification/);
assert.match(controller, /runWithPeriodWriteFence/);
assert.match(controller, /expected_scope_fingerprint/);
console.log('weekly HR Stage-2 bulk controller contract tests passed');
