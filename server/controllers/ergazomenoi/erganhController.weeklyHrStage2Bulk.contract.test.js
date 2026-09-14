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
assert.match(controller, /stage2BulkStateCache\.detailPageSeeds/);
assert.match(controller, /buildWeeklyHrStage2BulkDetails/);
assert.match(controller, /loadWeeklyHrStage2BatchPreparedContexts/);
assert.match(controller, /continuation_token: batch\.continuation_token/);
assert.match(controller, /stage2BulkRequestScope/);
assert.match(controller, /buildWeeklyHrStage2BulkContextScope/);
const mainSearchBulkContexts = controller.match(
    /loadWritablePresentation: async \(\) => \{[\s\S]*?return \{ preview:/)?.[0] || '';
assert.match(mainSearchBulkContexts, /buildWeeklyHrStage2BulkContextScope/);
assert.doesNotMatch(mainSearchBulkContexts, /scope: lifecycle\.scope/);
assert.match(mainSearchBulkContexts, /assertActiveEmploymentReviewPeriodReadable/);
assert.match(controller, /loadWeeklyHrStage2BulkSearchPresentation/);
const targetedLoader = controller.match(
    /async function loadWeeklyHrStage2BatchPreparedContexts[\s\S]*?\n}\n\nasync function loadWeeklyHrStage2BulkPreparedContexts/)?.[0] || '';
assert.match(targetedLoader, /batchScopes\.length > 100/);
assert.match(targetedLoader, /loadWeeklyHrStage2TargetedReadGroups/);
assert.match(targetedLoader, /cachedSeeds/);
assert.match(targetedLoader, /seed\.row_ids/);
assert.match(targetedLoader, /deriveEmploymentOwnedDateScope/);
assert.match(targetedLoader, /phaseRows:/);
assert.match(targetedLoader, /companyPolicyRules:/);
assert.match(targetedLoader, /buildPreparedPhaseHistoryMaps/);
assert.match(targetedLoader, /buildReviewPhaseContextByKodikos/);
assert.match(targetedLoader, /prepareWeeklyHrStage2LifecycleRow/);
assert.match(targetedLoader, /weeklyHrStage2LifecycleProfileFromRow/);
assert.match(targetedLoader, /decisionByRequestId/);
assert.match(targetedLoader, /executionByDecisionId/);
assert.doesNotMatch(targetedLoader, /getReviewRowsForExport/);
assert.doesNotMatch(targetedLoader, /\.findOne\(/);
assert.doesNotMatch(targetedLoader, /cachedContexts|cached\.rows|cached\.lifecycle/);
const pairPreparation = controller.match(
    /async function prepareWeeklyHrStage2PairRecords[\s\S]*?\n}\n\nasync function loadWeeklyHrStage2BatchPreparedContexts/)?.[0] || '';
assert.match(pairPreparation, /buildWeeklyRepoTransferPreparedLookups\(\{ decisions, executions }\)/);
assert.match(pairPreparation, /preparedLookups/);
assert.equal((pairPreparation.match(/buildWeeklyRepoTransferPreparedLookups/g) || []).length, 1);
const bulkController = controller.match(
    /static completeWeeklyHrWorkflowStage2Bulk[\s\S]*?\n    };/)?.[0] || '';
assert.match(bulkController, /loadWeeklyHrStage2BatchPreparedContexts/);
assert.doesNotMatch(bulkController, /loadWeeklyHrStage2BulkPreparedContexts|getReviewRowsForExport/);
assert.match(controller, /application\/x-ndjson/);
assert.match(controller, /X-Accel-Buffering/);
assert.match(controller, /type: 'progress'/);
assert.match(controller, /type: 'result'/);
assert.match(controller, /type: 'error'/);
assert.match(controller, /createWeeklyHrStage2BulkResponseStream/);

const Controller = require('./erganhController');
const { createWeeklyHrStage2BulkResponseStream } =
    Controller.__weeklyHrStage2BulkStreamTestHooks;
function responseHarness() {
    const output = { statusCode: null, headers: {}, writes: [], ended: false };
    return { output, response: { status(value) { output.statusCode = value; return this; },
        setHeader(name, value) { output.headers[name] = value; },
        flushHeaders() {}, flush() {}, write(value) { output.writes.push(value); },
        end() { output.ended = true; } } };
}
const before = responseHarness();
const beforeStream = createWeeklyHrStage2BulkResponseStream(
    { headers: { accept: 'application/x-ndjson, application/json' } }, before.response);
assert.equal(beforeStream.error(Object.assign(new Error('guard'),
    { code: 'GUARD_FAILED', statusCode: 409 })), false);
assert.equal(before.output.writes.length, 0);
assert.equal(before.output.statusCode, null);

const after = responseHarness();
const afterStream = createWeeklyHrStage2BulkResponseStream(
    { headers: { accept: 'application/x-ndjson, application/json' } }, after.response);
afterStream.progress({ processed: 1, total: 19, employee_kodikos: 'PII_FORBIDDEN' });
assert.equal(afterStream.error(new Error('raw database detail')), true);
const afterEvents = after.output.writes.map((line) => JSON.parse(line));
assert.deepEqual(afterEvents[0], { type: 'progress', processed_in_batch: 1,
    total_in_batch: 19 });
assert.deepEqual(afterEvents[1], { type: 'error',
    code: 'STAGE2_BULK_COMPLETION_FAILED',
    message: 'Αποτυχία μαζικής ολοκλήρωσης Stage 2.' });
assert.equal(after.output.ended, true);
assert.equal(after.output.headers['X-Accel-Buffering'], 'no');
assert.doesNotMatch(after.output.writes.join(''), /PII_FORBIDDEN|raw database detail/);

const json = responseHarness();
const jsonStream = createWeeklyHrStage2BulkResponseStream(
    { headers: { accept: 'application/json' } }, json.response);
assert.equal(jsonStream.requested, false);
assert.equal(jsonStream.error(new Error('json failure')), false);
assert.equal(json.output.writes.length, 0);
console.log('weekly HR Stage-2 bulk controller contract tests passed');
