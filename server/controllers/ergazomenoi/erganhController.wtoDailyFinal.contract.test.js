'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const controller = fs.readFileSync(path.join(__dirname, 'erganhController.js'), 'utf8');
const routes = fs.readFileSync(path.join(__dirname, '../../routes/usersRoute.js'), 'utf8');
assert.match(routes, /period-control\/submission\/final'[\s\S]*checkAuth[\s\S]*requireEmploymentReviewAccess[\s\S]*requireCriticalEmploymentDecisionRole[\s\S]*submitFinalWTODayilyA/);
assert.match(controller, /stored_status !== 'FINALIZED'/);
assert.match(controller, /state\.past_deadline/);
assert.match(controller, /submissionCode: 'WTODailyA', payload,[\s\S]*fetchSubmittedPdf: true/);
assert.match(controller, /resolveWtoDailyRestIdentity\(restResult, process\.env\.ERGANI_ENV\)/);
assert.match(controller, /submission_id: resolvedIdentity\.submission_id/);
assert.doesNotMatch(controller.slice(controller.indexOf('static submitFinalWTODayilyA'),
    controller.indexOf('static linkEmploymentReviewPeriodSubmission')), /process_code:\s*['"](?:91|207)['"]/);
assert.match(controller, /body\.WTOS !== undefined/);
assert.match(controller, /WTODAILY_RECONCILIATION_REQUIRED/);
assert.match(controller, /assertWtoDailyFrozenSnapshotVersion\(frozen\.frozen_snapshot\)/);
const finalMethod = controller.slice(controller.indexOf('static submitFinalWTODayilyA'),
    controller.indexOf('static linkEmploymentReviewPeriodSubmission'));
assert.doesNotMatch(finalMethod, /ErgazomenoiModel\.find/);
assert.match(controller, /linkEmploymentPeriodSubmission/);
console.log('WTODailyA final endpoint contract tests passed');
