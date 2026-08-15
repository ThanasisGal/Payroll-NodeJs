'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const controller = fs.readFileSync(path.join(__dirname, 'erganhController.js'), 'utf8');
const routes = fs.readFileSync(path.join(__dirname, '../../routes/usersRoute.js'), 'utf8');
const view = fs.readFileSync(path.join(__dirname, '../../../views/ergazomenoi/programmata/elegxosApasxolhseonPeriodoy.ejs'), 'utf8');
const browser = fs.readFileSync(path.join(__dirname, '../../../public/js/ergazomenoi/programmata/elegxosApasxolhseonPeriodoy.js'), 'utf8');
const policyExecution = fs.readFileSync(path.join(__dirname, '../../services/ergazomenoi/apasxoliseisPolicyPreviewApplyExecutionService.js'), 'utf8');
const periodControlService = fs.readFileSync(path.join(__dirname,
    '../../services/ergazomenoi/apasxoliseisPeriodControlService.js'), 'utf8');

assert.match(controller, /calculationOwnership = await acquirePeriodCalculationOwnership\(\{ scope: periodControlScope,[\s\S]*historicalRequestId \}\)/);
assert.match(controller, /completeHistoricalReconstruction\(\{ scope: periodControlScope,[\s\S]*calculationId: calculationOwnership\.calculationId/);
assert.match(controller, /runWithPeriodCalculationWriteFence\(\{[\s\S]*calculationId: calculationOwnership\.calculationId[\s\S]*ProdhlomenaOrariaModel\.bulkWrite\(chunk, \{/);
assert.match(controller, /runWeeklyRepoPostCheck\(\{[\s\S]*calculationId: calculationOwnership\.calculationId/);
assert.match(controller, /replaceDeviations[\s\S]*deleteMany\(deviationsCleanupFilter[\s\S]*insertMany[\s\S]*runWithPeriodCalculationWriteFence/);
assert.match(controller, /releasePeriodCalculationOwnership\(\{[\s\S]*calculationOwnership = null;[\s\S]*return res\.json/);
assert.match(controller, /executeWeeklyCanonicalDecisionCreation[\s\S]*assertActiveEmploymentReviewCanonicalDecisionPeriod/);
assert.match(controller, /executeWeeklyCanonicalDecisionCreation[\s\S]*kind: 'WEEKLY_CONTEXT'/);
assert.match(controller, /executeWeeklyCanonicalDecisionCreation[\s\S]*authoritativeRowDates: context\.rows\.map\(\(row\) => row\.hmeromhnia\)/);
assert.match(controller, /assertActiveEmploymentReviewPeriodNormal[\s\S]*assertNormalPeriod\(\{ scope, expectedToken \}\)[\s\S]*resolveWeeklyRepoPreviewAsOfDate/);
assert.match(controller, /executeWeeklyCanonicalDecisionCreation[\s\S]*recordDecision\(\{[\s\S]*mutationRunner:[\s\S]*fenceRunner/);
assert.match(controller, /HISTORICAL_RECONSTRUCTION_STALE'[\s\S]*runStalePeriodFence/);
const canonicalCreation = controller.slice(controller.indexOf('async function executeWeeklyCanonicalDecisionCreation'),
    controller.indexOf('async function loadEmploymentPeriodFrozenSnapshotInput'));
assert.doesNotMatch(canonicalCreation, /ProdhlomenaOrariaModel\.(?:create|update|bulkWrite|findOneAndUpdate)/);
assert.match(controller, /createWeeklyRepoTransferDecision[\s\S]*periodGuard/);
assert.match(controller, /createWeeklyRepoTransferDecision[\s\S]*kind: 'WEEKLY_CONTEXT'/);
assert.match(controller, /createWeeklyRepoTransferDecision\([\s\S]*mutationRunner:[\s\S]*runWithPeriodWriteFence/);
assert.match(controller, /applyWeeklyRepoTransferDecision[\s\S]*assertActiveEmploymentReviewPeriodNormal/);
assert.match(controller, /periodWriteGuard:[\s\S]*start: plan\.source\.date[\s\S]*start: plan\.target\.date/);
assert.match(controller, /periodFence: \(\{ session \}\) => fencePeriodForWrite/);
const updateReviewRecord = controller.slice(
    controller.indexOf('static updateProdhlomenaOrariaReviewRecord'),
    controller.indexOf('static unlockProdhlomenaOrariaReviewRecord')
);
const unlockReviewRecord = controller.slice(
    controller.indexOf('static unlockProdhlomenaOrariaReviewRecord'),
    controller.indexOf('static restoreProdhlomenaOrariaReviewRecord')
);
const restoreReviewRecord = controller.slice(
    controller.indexOf('static restoreProdhlomenaOrariaReviewRecord'),
    controller.indexOf('static getProdhlomenaOrariaReviewAudit')
);
assert.match(updateReviewRecord, /orphanResolutionCommand[\s\S]*assertActiveEmploymentReviewOrphanResolutionPeriod\([\s\S]*:[\s\S]*assertActiveEmploymentReviewPeriodNormal\(/);
assert.match(updateReviewRecord, /staleOrphanResolution[\s\S]*runWithStaleOrphanResolutionWriteFence[\s\S]*runWithPeriodWriteFence/);
assert.match(unlockReviewRecord, /assertActiveEmploymentReviewPeriodNormal\(req, oldRecord\.ypokatasthma[\s\S]*runWithPeriodWriteFence/);
assert.match(restoreReviewRecord, /assertActiveEmploymentReviewPeriodNormal\(req, oldRecord\.ypokatasthma[\s\S]*runWithPeriodWriteFence/);
const readablePeriodGuard = controller.slice(
    controller.indexOf('async function assertActiveEmploymentReviewPeriodReadable'),
    controller.indexOf('async function assertActiveEmploymentReviewCanonicalDecisionPeriod')
);
assert.match(readablePeriodGuard, /assertReviewReadablePeriod/);
assert.doesNotMatch(readablePeriodGuard,
    /runWithPeriodWriteFence|runWithStaleCanonicalDecisionWriteFence|runWithStaleOrphanResolutionWriteFence|can_record_decision/);
const staleCanonicalFence = periodControlService.slice(
    periodControlService.indexOf('async function runWithStaleCanonicalDecisionWriteFence'),
    periodControlService.indexOf('async function fenceStaleOrphanResolutionWrite')
);
const staleOrphanFence = periodControlService.slice(
    periodControlService.indexOf('async function runWithStaleOrphanResolutionWriteFence'),
    periodControlService.indexOf('async function fencePeriodForWrite')
);
for (const specialFence of [staleCanonicalFence, staleOrphanFence]) {
    assert.doesNotMatch(specialFence,
        /assertCriticalEmploymentDecisionRole|acquirePeriodCalculationOwnership|runWithPeriodCalculationWriteFence|completeHistoricalReconstruction/);
}
assert.ok((controller.match(/scope: periodAccess\.scope,[\s\S]{0,120}expectedToken: periodAccess\.token/g) || []).length >= 3);
assert.match(controller, /runProdhlomenaOrariaPolicyPreviewApplyExecutionLocked[\s\S]*assertActiveEmploymentReviewPeriodNormal/);
assert.match(policyExecution, /runPolicyPreviewApplyExecutionLocked[\s\S]*return buildLockedApplyExecutionResult\(applyPlan\)/);
assert.doesNotMatch(policyExecution.slice(policyExecution.indexOf('async function runPolicyPreviewApplyExecutionLocked')), /model\.bulkWrite|writer\(/);
assert.match(routes, /period-control\/current'[\s\S]*checkAuth[\s\S]*requireEmploymentReviewAccess/);
assert.match(routes, /period-control\/:action\(lock\|unlock\)'[\s\S]*requireCriticalEmploymentDecisionRole/);
assert.ok(view.includes('Κατάσταση:'));
assert.ok(view.includes('Κλείδωμα περιόδου'));
assert.ok(view.includes('Ξεκλείδωμα περιόδου'));
assert.ok(browser.includes("NORMAL: 'Ανοικτή'"));
assert.ok(browser.includes("LOCKED: 'ΚΛΕΙΔΩΜΕΝΟ'"));
assert.ok(browser.includes("CORRECTIVE_ONLY: 'Μόνο διορθωτική μισθοδοσία'"));
assert.ok(browser.includes("HISTORICAL_RECONSTRUCTION_REQUIRED: 'ΕΚΠΡΟΘΕΣΜΗ — ΧΩΡΙΣ ΟΡΙΣΤΙΚΟΠΟΙΗΜΕΝΟ ΑΠΟΤΕΛΕΣΜΑ'"));
assert.ok(browser.includes('δεν ξεκλειδώνει χειροκίνητα κλειδωμένες ημερήσιες εγγραφές'));
assert.ok(browser.includes("transitionEmploymentPeriod('unlock')"));
assert.ok(browser.includes("/period-control/${action}"));
assert.ok(!/apologistiko_biblio[\s\S]{0,80}(PERIOD_CONTROL|periodControl)/.test(controller));
console.log('erganhController period control contract tests: PASS');
