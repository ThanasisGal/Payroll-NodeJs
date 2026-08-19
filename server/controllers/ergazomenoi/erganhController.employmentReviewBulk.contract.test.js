'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');

const controller = fs.readFileSync(path.join(__dirname, 'erganhController.js'), 'utf8');
const frontend = fs.readFileSync(path.join(__dirname,
    '../../../public/js/ergazomenoi/programmata/elegxosApasxolhseonPeriodoy.js'), 'utf8');
const view = fs.readFileSync(path.join(__dirname,
    '../../../views/ergazomenoi/programmata/elegxosApasxolhseonPeriodoy.ejs'), 'utf8');
const phaseDetector = fs.readFileSync(path.join(__dirname,
    '../../services/kinhseis/phaseDetectorService.js'), 'utf8');

const review = controller.slice(
    controller.indexOf('static getProdhlomenaOrariaForReview'),
    controller.indexOf('static getProdhlomenaOrariaScenarioClassifications')
);
assert.match(review, /limit = 50/);
assert.match(review, /Math\.min\(Math\.max\(parseInt\(limit, 10\) \|\| 50, 1\), 100\)/);
assert.match(review, /loadEmploymentReviewRequestContext\(\{/);
assert.match(review, /employeeCodeLoader: \(\) => ProdhlomenaOrariaModel\.distinct\('kodikos', filter\)/);
assert.match(review, /weekly_hr_projections: weeklyHrProjections/);
assert.match(review, /period_control: await periodControlProjectionPromise/);
assert.match(review, /scenario_classifications: scenarioClassifications/);
assert.match(review, /buildEmploymentReviewScenarioClassifications\(rows/);
assert.match(review, /summary_scope: 'CURRENT_EMPLOYEE_PAGE'/);
assert.match(review, /ApasxoliseisWeeklyHrWorkflowStateModel\.find\(\{/);
assert.match(review, /ApasxoliseisCompanyPolicyRuleModel\.find\(\{/);
assert.match(review, /filter\.kodikos = mongoose\.trusted\(\{ \$in: employeeCodes \}\)/);

assert.match(phaseDetector, /preloadedContext = null/);
assert.match(phaseDetector, /preloadedContext\?\.employee/);
assert.match(phaseDetector, /preloadedContext\?\.contractHistoryRows/);
assert.match(phaseDetector, /preloadedContext\?\.workTermsHistoryRows/);
assert.match(phaseDetector, /preloadedContext\?\.dailyRows/);

assert.match(frontend, /preloaded_projections: payload\.weekly_hr_projections/);
const initialLoad = frontend.slice(
    frontend.indexOf('async function loadResults()'),
    frontend.indexOf('function pairNo(')
);
assert.match(initialLoad, /const periodControl = payload\.period_control/);
assert.match(initialLoad, /payload\.scenario_classifications/);
assert.doesNotMatch(initialLoad, /loadEmploymentPeriodControl\(/);
assert.doesNotMatch(initialLoad, /fetchScenarioClassifications\(/);
assert.doesNotMatch(initialLoad, /fetchPolicyPreviewGrouping\(/);
assert.doesNotMatch(initialLoad, /refreshPolicyPreviewApprovals\(/);
assert.doesNotMatch(initialLoad, /fetchPolicyPreviewApplyDryRun\(/);
assert.doesNotMatch(initialLoad, /refreshRepoTransferDecisions\(/);
assert.doesNotMatch(initialLoad, /renderCurrentReviewRows\(\)/);
assert.match(frontend, /function loadPolicyPreviewOnDemand\(\)/);
assert.match(frontend, /\[data-workflow-stage="STAGE2"\] \.accordion-button/);
assert.match(frontend, /if \(Array\.isArray\(preloaded_projections\)\)/);
assert.match(frontend, /employmentReviewEmployeePageSize = 50/);
assert.equal(Math.ceil(26 / 50), 1);
assert.equal(Math.ceil(51 / 50), 2);
assert.match(frontend, /Προηγούμενη/);
assert.match(frontend, /Επόμενη/);
assert.match(frontend, /Σελίδα \$\{page\}\/\$\{totalPages\}/);
assert.match(view, /employmentReviewEmployeePagination/);

console.log('employment review bulk loading contract tests passed');
