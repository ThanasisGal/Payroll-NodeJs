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
assert.match(controller, /stage2BulkStateCache\.batch/);
assert.match(controller, /continuation_token: batch\.continuation_token/);
assert.match(controller, /stage2BulkRequestScope/);
const targetedLoader = controller.match(
    /async function loadWeeklyHrStage2BatchPreparedContexts[\s\S]*?\n}\n\nasync function loadWeeklyHrStage2BulkPreparedContexts/)?.[0] || '';
assert.match(targetedLoader, /batchScopes\.length > 100/);
assert.match(targetedLoader, /loadWeeklyHrStage2TargetedReadGroups/);
assert.match(targetedLoader, /decisionByRequestId/);
assert.match(targetedLoader, /executionByDecisionId/);
assert.doesNotMatch(targetedLoader, /getReviewRowsForExport/);
assert.doesNotMatch(targetedLoader, /\.findOne\(/);
const bulkController = controller.match(
    /static completeWeeklyHrWorkflowStage2Bulk[\s\S]*?\n    };/)?.[0] || '';
assert.match(bulkController, /loadWeeklyHrStage2BatchPreparedContexts/);
assert.doesNotMatch(bulkController, /loadWeeklyHrStage2BulkPreparedContexts|getReviewRowsForExport/);
console.log('weekly HR Stage-2 bulk controller contract tests passed');
