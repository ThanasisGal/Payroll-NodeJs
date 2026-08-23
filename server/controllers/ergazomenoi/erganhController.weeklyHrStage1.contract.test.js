'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const controller = fs.readFileSync(path.join(__dirname, 'erganhController.js'), 'utf8');
const routes = fs.readFileSync(path.join(__dirname, '../../routes/usersRoute.js'), 'utf8');
const employeeModels = fs.readFileSync(path.join(__dirname, '../../models/ergazomenoi.js'), 'utf8');

assert.match(controller, /static getWeeklyHrWorkflowStage1/);
const stage1Read = controller.slice(controller.indexOf('static getWeeklyHrWorkflowStage1'),
    controller.indexOf('static completeWeeklyHrWorkflowStage1'));
assert.match(stage1Read, /assertActiveEmploymentReviewPeriodReadable/);
assert.doesNotMatch(stage1Read, /assertActiveEmploymentReviewPeriodNormal/);
const reviewSearch = controller.slice(
    controller.indexOf('static getProdhlomenaOrariaForReview'),
    controller.indexOf('static getProdhlomenaOrariaScenarioClassifications')
);
assert.match(reviewSearch, /employee_id: erg\?\._id \|\| null/);
assert.match(reviewSearch, /astheneia_apologistika apousia_apologistika/);
assert.match(controller, /buildWeeklyHrWorkflowProjection/);
assert.match(controller, /static completeWeeklyHrWorkflowStage1/);
assert.match(controller, /static completeWeeklyHrWorkflowStage1Bulk/);
assert.match(controller, /static saveWeeklyHrStage1DailyClassificationsBulk/);
assert.match(controller, /saveStage1DailyClassificationsBulk\(\{/);
assert.match(controller, /erganhController\.updateProdhlomenaOrariaReviewRecord\(\{/);
assert.match(controller, /const record = await ProdhlomenaOrariaModel\.findOne\(\{/);
assert.match(controller, /return \{ unchanged:[\s\S]*record \}/);
assert.match(controller, /completeWeeklyHrWorkflowStage1Bulk\(\{/);
assert.match(controller, /indexesAlreadyChecked: true/);
assert.match(controller, /await assertWeeklyHrWorkflowIndexesReady\(\)/);
assert.match(controller, /runWithPeriodWriteFence/);
assert.match(controller, /runWithStaleStage1CompletionWriteFence/);
assert.match(controller, /HISTORICAL_RECONSTRUCTION_STALE/);
assert.match(controller, /staleHistoricalCompletion[\s\S]*runWithStaleStage1CompletionWriteFence[\s\S]*runWithPeriodWriteFence/);
assert.match(controller, /STAGE1_COMPLETION_SCOPE_FIELDS_NOT_ALLOWED/);
assert.match(controller, /const loadFreshWeekRows[\s\S]*loadWeeklyHrContext/);
assert.match(controller, /completeWeeklyHrStage1PeriodSlice/);
assert.match(controller, /period_start.*period_end/);
assert.match(controller, /STAGE1_DATE_OUTSIDE_ACTIONABLE_PERIOD/);
assert.match(stage1Read, /stage1DailyPresentation/);
assert.match(stage1Read, /resolveStage3DailyActualWorkFacts\(row\)/);
assert.match(stage1Read, /declared_intervals/);
assert.match(stage1Read, /card_intervals/);
assert.match(stage1Read, /current_apologistiko_classification/);
assert.match(controller, /static completeWeeklyHrWorkflowStage2/);
assert.match(controller, /runWithStaleStage2MaterializationWriteFence/);
assert.match(routes, /weekly-hr-workflow\/stage2\/complete'[\s\S]*requireCriticalEmploymentDecisionRole[\s\S]*completeWeeklyHrWorkflowStage2/);
assert.match(controller, /'apousia_apologistika'/);
assert.match(employeeModels, /apousia_apologistika:\s*\{ type: Boolean, default: false \}/);
assert.match(employeeModels, /kathestos_apasxolhshs_hmeras:\s*\{ type: String,[^}]*default: '' \}/);
assert.match(employeeModels, /hmeres_apoysias_apologistika:\s*\{ type: Number, default: 0 \}/);
assert.match(controller, /applyCanonicalAbsenceMetrics\([\s\S]*oldRecord/);
assert.match(controller, /assertReviewDecisionMutualExclusion\(\{ \.\.\.oldRecord, \.\.\.permittedUpdates \}\)/);
for (const incompatible of ['adeia_apologistika', 'astheneia_apologistika',
    'repo_apologistika']) {
    assert.match(controller, new RegExp(`\\['[^']+', row\\.${incompatible} === true\\]`));
}
const errorHelper = controller.match(/function weeklyHrApiError\([\s\S]*?\n}/)?.[0];
const exclusionHelper = controller.match(/function assertReviewDecisionMutualExclusion\([\s\S]*?\n}/)?.[0];
assert.ok(errorHelper && exclusionHelper);
const validation = vm.runInNewContext(`(() => { ${errorHelper}\n${exclusionHelper}\nreturn assertReviewDecisionMutualExclusion; })()`);
for (const conflictingField of ['adeia_apologistika', 'astheneia_apologistika',
    'repo_apologistika']) {
    assert.throws(() => validation({ apousia_apologistika: true,
        [conflictingField]: true }), (error) =>
        error.code === 'INCOMPATIBLE_DAILY_REVIEW_DECISIONS' && error.statusCode === 400);
}
assert.match(routes, /weekly-hr-workflow\/stage1'[\s\S]*checkAuth[\s\S]*requireEmploymentReviewAccess/);
assert.match(routes, /weekly-hr-workflow\/stage1\/complete'[\s\S]*checkAuth[\s\S]*requireEmploymentReviewAccess[\s\S]*requireCriticalEmploymentDecisionRole[\s\S]*completeWeeklyHrWorkflowStage1/);
assert.match(routes, /weekly-hr-workflow\/stage1\/bulk-complete'[\s\S]*checkAuth[\s\S]*requireEmploymentReviewAccess[\s\S]*requireCriticalEmploymentDecisionRole[\s\S]*completeWeeklyHrWorkflowStage1Bulk/);
assert.match(routes, /weekly-hr-workflow\/stage1\/bulk-classify-days'[\s\S]*checkAuth[\s\S]*requireEmploymentReviewAccess[\s\S]*requireCriticalEmploymentDecisionRole[\s\S]*saveWeeklyHrStage1DailyClassificationsBulk/);
console.log('erganhController weekly HR Stage 1 contract tests passed');
