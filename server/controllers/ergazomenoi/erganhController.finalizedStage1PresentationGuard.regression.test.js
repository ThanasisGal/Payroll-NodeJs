'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const controller = fs.readFileSync(path.join(__dirname, 'erganhController.js'), 'utf8');
const section = (start, end) => controller.slice(controller.indexOf(start), controller.indexOf(end));
const presentationGuard = section(
    'async function assertActiveEmploymentReviewPeriodPresentationReadable',
    'async function loadEmploymentPeriodFrozenSnapshotInput'
);
const stage1Get = section(
    'static getWeeklyHrWorkflowStage1',
    'static exportProdhlomenaOrariaReviewAuditDossierPdf'
);
const stage1Completion = section(
    'async function completeWeeklyHrStage1ForScope',
    'const CORRECTIVE_DELTA_LABELS'
);
const stage2Completion = section(
    'static completeWeeklyHrWorkflowStage2',
    'static saveWeeklyHrStage1DailyClassificationsBulk'
);
const stage3Decision = section(
    'static resolveWeeklyHrStage3Day',
    'static previewProdhlomenaOrariaOrphanResolution'
);
const orphanWrite = section(
    'static updateProdhlomenaOrariaReviewRecord',
    'static unlockProdhlomenaOrariaReviewRecord'
);

assert.match(presentationGuard, /getPeriodControl\(\{ scope \}\)/);
assert.match(presentationGuard, /'HISTORICAL_RECONSTRUCTION_STALE', 'FINALIZED'/);
assert.match(presentationGuard, /isWeekAllowedForEmploymentPeriod\(\{/);
assert.match(presentationGuard, /required_authoritative_dates:/);
assert.match(stage1Get, /assertActiveEmploymentReviewPeriodPresentationReadable\(/);
assert.doesNotMatch(stage1Get, /assertActiveEmploymentReviewPeriodReadable\(/);
assert.match(stage1Completion, /assertActiveEmploymentReviewPeriodReadable\(/);
assert.match(stage2Completion, /assertActiveEmploymentReviewPeriodReadable\(/);
assert.match(stage3Decision, /assertActiveEmploymentReviewPeriodReadable\(/);
assert.match(orphanWrite, /assertActiveEmploymentReviewOrphanResolutionPeriod\(/);
assert.strictEqual(
    (controller.match(/assertActiveEmploymentReviewPeriodPresentationReadable\(/g) || []).length,
    2
);

console.log('finalized Stage 1 presentation guard regression tests: PASS');
