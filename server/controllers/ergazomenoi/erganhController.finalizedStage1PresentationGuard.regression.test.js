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
assert.match(presentationGuard, /const lockedWithAuthoritativeResult = state\.effective_mode === 'LOCKED' &&/);
assert.match(presentationGuard, /state\.has_authoritative_calculation_result === true/);
assert.match(presentationGuard, /if \(!lockedWithAuthoritativeResult && !\['NORMAL', 'HISTORICAL_RECONSTRUCTED'/);
assert.match(presentationGuard, /'HISTORICAL_RECONSTRUCTION_STALE', 'FINALIZED'/);
assert.match(presentationGuard, /isWeekAllowedForEmploymentPeriod\(\{/);
assert.match(presentationGuard, /required_authoritative_dates:/);
assert.match(presentationGuard, /allow_presentation_boundary_slice: exactPresentationPeriod/);
assert.match(presentationGuard, /dateKeyUtc\(requiredRange\.periodStart\)/);
assert.match(stage1Get, /assertActiveEmploymentReviewPeriodPresentationReadable\(/);
assert.match(stage1Get, /authoritative_date_set\?\.includes/);
assert.match(stage1Get, /requiredAuthoritativeDates:[\s\S]*authoritative_date_set \|\| null/);
assert.match(stage1Get, /employment_date_scope: context\.employmentDateScope/);
assert.doesNotMatch(stage1Get,
    /requiredAuthoritativeDates:[\s\S]{0,120}employment_owned_dates/);
assert.match(stage1Get, /loadFinalizedWeeklyHrPresentationSnapshot/);
assert.match(stage1Get, /loadAuthoritativeStage1HolidayContext\(\{/);
assert.match(stage1Get, /presentationSnapshot,[\s\S]*loadHolidayContext: buildNoCardsDisplayContext/);
assert.doesNotMatch(stage1Get,
    /presentationSnapshot\s*\?\s*\{ companyFlags: \{\}, argiesByDateKey: new Map\(\) \}/);
assert.match(stage1Get,
    /presentationSnapshot\s*\?\s*buildFinalizedWeeklyHrLifecyclePresentation\([\s\S]*?: await buildWeeklyLifecycleWithStage2State/);
const finalizedSource = section(
    'async function loadFinalizedWeeklyHrPresentationSnapshot',
    'async function loadWeeklyHrContext'
);
assert.match(finalizedSource, /state\.stored_status !== 'FINALIZED'/);
assert.match(finalizedSource, /ApasxoliseisPeriodFrozenSnapshotModel\.findOne/);
assert.match(finalizedSource, /return document\.frozen_snapshot/);
assert.doesNotMatch(stage1Get, /assertActiveEmploymentReviewPeriodReadable\(/);
assert.match(stage1Completion, /assertActiveEmploymentReviewStage1CompletionReadable\(/);
assert.match(stage2Completion, /assertActiveEmploymentReviewPeriodReadable\(/);
assert.match(stage3Decision, /assertActiveEmploymentReviewStage3DayWritable\(/);
assert.match(orphanWrite, /assertActiveEmploymentReviewOrphanResolutionPeriod\(/);
assert.strictEqual(
    (controller.match(/assertActiveEmploymentReviewPeriodPresentationReadable\(/g) || []).length,
    2
);

function executablePresentationGuard(state) {
    return Function(
        'activeEmploymentReviewPeriodScope', 'getPeriodControl',
        'isWeekAllowedForEmploymentPeriod', 'resolveWeeklyRepoPreviewAsOfDate', 'dateKeyUtc',
        `${presentationGuard}; return assertActiveEmploymentReviewPeriodPresentationReadable;`
    )(
        async () => ({ team: 'THA', company_kod: 'company', ypokatasthma: '0000',
            period_start: '2026-06-01', period_end: '2026-06-30' }),
        async () => state,
        () => true,
        () => new Date('2026-07-05T00:00:00.000Z'),
        (value) => String(value || '').slice(0, 10)
    );
}

(async () => {
    const lockedAuthoritativeState = {
        effective_mode: 'LOCKED',
        has_authoritative_calculation_result: true,
        historical_reconstruction_status: 'COMPLETED',
        historical_reconstruction_version: 2
    };
    const lockedResult = await executablePresentationGuard(lockedAuthoritativeState)({ session: {} });
    assert.strictEqual(lockedResult.state, lockedAuthoritativeState);

    await assert.rejects(
        () => executablePresentationGuard({ ...lockedAuthoritativeState,
            has_authoritative_calculation_result: false })({ session: {} }),
        (error) => error.code === 'PERIOD_CONTROL_REVIEW_NOT_AVAILABLE'
    );

    const finalizedState = { effective_mode: 'FINALIZED' };
    const finalizedResult = await executablePresentationGuard(finalizedState)({ session: {} });
    assert.strictEqual(finalizedResult.state, finalizedState);

    console.log('finalized Stage 1 presentation guard regression tests: PASS');
})().catch((error) => { console.error(error); process.exitCode = 1; });
