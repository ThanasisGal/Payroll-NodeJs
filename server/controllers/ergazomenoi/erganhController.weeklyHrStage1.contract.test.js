'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const controller = fs.readFileSync(path.join(__dirname, 'erganhController.js'), 'utf8');
const routes = fs.readFileSync(path.join(__dirname, '../../routes/usersRoute.js'), 'utf8');
const employeeModels = fs.readFileSync(path.join(__dirname, '../../models/ergazomenoi.js'), 'utf8');
const browser = fs.readFileSync(path.join(__dirname,
    '../../../public/js/ergazomenoi/programmata/elegxosApasxolhseonPeriodoy.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '../../../public/css/main.css'), 'utf8');
const view = fs.readFileSync(path.join(__dirname,
    '../../../views/ergazomenoi/programmata/elegxosApasxolhseonPeriodoy.ejs'), 'utf8');

assert.match(controller, /static getWeeklyHrWorkflowStage1/);
const stage1Read = controller.slice(controller.indexOf('static getWeeklyHrWorkflowStage1'),
    controller.indexOf('static completeWeeklyHrWorkflowStage1'));
assert.match(stage1Read, /assertActiveEmploymentReviewPeriodPresentationReadable/);
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
assert.match(controller, /assertActiveEmploymentReviewStage1CompletionReadable/);
assert.match(controller, /const exactActivePeriod = dateKeyUtc\(input\.period_start\)/);
assert.match(controller, /const authoritativeDates = initial\.employmentDateScope\?\.authoritative_date_set \|\| \[\]/);
assert.match(controller, /authoritativeSliceInsideActivePeriod/);
assert.doesNotMatch(controller,
    /allow_presentation_boundary_slice:\s*true[\s\S]{0,500}completeWeeklyHrStage1ForScope/);
assert.match(controller, /STAGE1_DATE_OUTSIDE_ACTIONABLE_PERIOD/);
assert.match(controller, /STAGE1_CLASSIFICATION_PERIOD_SCOPE_MISMATCH/);
assert.match(controller, /STAGE1_HOLIDAY_NOT_AUTHORITATIVE/);
assert.match(controller, /Η ημέρα δεν πληροί τις προϋποθέσεις χαρακτηρισμού ως Αργία/);
assert.strictEqual((controller.match(/\.\.\.stage1HolidayEligibilityContext\(holidayRecord,/g) || [])
    .length, 3);
const holidayContextHelper = controller.match(
    /function stage1HolidayEligibilityContext\([\s\S]*?\n}/)?.[0];
assert.ok(holidayContextHelper);
const mapHolidayContext = vm.runInNewContext(
    `(() => { ${holidayContextHelper}; return stage1HolidayEligibilityContext; })()`
);
const companyOpenOnAllHolidays = { apasxolhsh_kata_tis_argies: true,
    leitoyrgia_stis_mh_ypoxreotikes_argies: true };
assert.strictEqual(mapHolidayContext({ ypoxreotikh_argia: true,
    companyOperatesOnHoliday: false }, companyOpenOnAllHolidays)
    .companyFlags.companyWorksOnMandatoryHoliday, false);
assert.strictEqual(mapHolidayContext({ ypoxreotikh_argia: true,
    companyOperatesOnHoliday: true }, {}).companyFlags.companyWorksOnMandatoryHoliday, true);
assert.strictEqual(mapHolidayContext({ ypoxreotikh_argia: false,
    companyOperatesOnHoliday: false }, companyOpenOnAllHolidays)
    .companyFlags.companyWorksOnOptionalHoliday, false);
assert.strictEqual(mapHolidayContext({ ypoxreotikh_argia: true }, companyOpenOnAllHolidays)
    .companyFlags.companyWorksOnMandatoryHoliday, true);
assert.match(controller, /STAGE3_DATE_OUTSIDE_ACTIVE_PERIOD/);
assert.strictEqual((controller.match(/allow_presentation_boundary_slice:/g) || []).length, 1);
assert.match(controller, /buildFullMonthBoundaryContextPreflight\(\{/);
assert.match(controller, /boundaryContextPreflight,/);
assert.match(stage1Read, /stage1DailyPresentation/);
assert.match(stage1Read, /resolveStage3DailyActualWorkFacts\(row\)/);
assert.match(stage1Read, /declared_intervals/);
assert.match(stage1Read, /card_intervals/);
assert.match(stage1Read, /current_apologistiko_classification/);
assert.match(stage1Read, /holiday_classification_eligible: holidayEligibility\.eligible/);
assert.match(stage1Read, /resolveAuthoritativeHolidayClassification\(\{/);
assert.match(stage1Read, /loadWeeklyRepoTransferDecisionBatch/);
assert.match(stage1Read, /buildWeeklyLifecycleWithStage2State/);
assert.match(stage1Read, /loadFinalizedWeeklyHrPresentationSnapshot/);
assert.match(stage1Read, /presentationSnapshot/);
assert.match(stage1Read, /buildFinalizedWeeklyHrLifecyclePresentation/);
assert.match(stage1Read, /current_proposal_fingerprint/);
assert.match(stage1Read, /current_proposal\?\.employee_kodikos/);
const weeklyContext = controller.slice(controller.indexOf('async function loadWeeklyHrContext'),
    controller.indexOf('async function loadWeeklyHrStage3DecisionContext'));
assert.match(weeklyContext, /presentationSnapshot\?\.weekly_calculation_context\?\.rows/);
assert.match(weeklyContext, /presentationSnapshot\?\.weekly_calculation_context\?\.profile_history/);
assert.match(weeklyContext, /presentationSnapshot\?\.employees/);
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
assert.match(browser, /function isFullCalendarMonthRange/);
assert.match(browser, /holiday_classification_eligible === true/);
assert.match(browser, /\['UNCLASSIFIED', 'LEAVE', 'SICKNESS', 'ABSENCE', 'HOLIDAY'\]/);
assert.match(browser, /HOLIDAY: 'Αργία'/);
assert.match(browser, /holidayEligible \? `<button[^`]*weekly-hr-save-holiday-day[^`]*data-row-id=/);
assert.match(browser, /draft\.classification === 'HOLIDAY'[\s\S]*disabled aria-disabled="true"/);
assert.match(browser, /async function saveStage1DailyClassificationDrafts\(requestedRowIds = null\)/);
assert.match(browser, /const draftsToSave = \[\.\.\.weeklyHrStage1DayDrafts\][\s\S]*requestedSet\.has/);
assert.match(browser, /const changes = draftsToSave\.map/);
assert.match(browser, /saveStage1DailyClassificationDrafts\(\[holidaySaveButton\.dataset\.rowId\]\)/);
assert.match(browser, /draftsToSave\.some\(\(\[rowId\]\)[\s\S]*affectedKeys\.add\(key\)/);
assert.match(browser, /requestedSet && Number\(result\.failed_count \|\| 0\) > 0[\s\S]*Η ημερήσια αλλαγή δεν αποθηκεύτηκε/);
assert.match(browser, /Δεν εντοπίστηκαν δεδομένα Ψηφιακών Καρτών για το χρονικό διάστημα/);
assert.match(browser, /Εντοπίστηκαν δεδομένα Ψηφιακών Καρτών για το χρονικό διάστημα/);
assert.match(browser, /compactBoundaryCoverageDateRange\(side\.dates\)/);
assert.doesNotMatch(browser, /Δεν υπάρχει διαθέσιμη καταγραφή που να επιβεβαιώνει την κάλυψη λήψης/);
assert.match(browser, /payload\.finalized === true\s*\? \{ disabled: true \}/);
assert.match(browser, /period_slice\?\.actionable_dates/);
assert.match(browser, /card mb-0 weekly-hr-stage1-bulk-toolbar/);
assert.match(browser, /CARD_DATA_FOUND: 'Εντοπίστηκαν δεδομένα Ψηφιακών Καρτών'/);
assert.match(browser, /NO_CARD_DATA_FOUND: 'Δεν εντοπίστηκαν δεδομένα Ψηφιακών Καρτών'/);
assert.match(browser, /NOT_REQUIRED: 'Δεν απαιτείται'/);
assert.match(browser, /showEmploymentReviewBoundaryContextDialog\(\)/);
assert.match(browser, /confirmButtonText: 'Κλείσιμο',[\s\S]*heightAuto: false/);
assert.match(browser, /returnFocus: false,[\s\S]*popup: 'employment-review-boundary-popup',[\s\S]*htmlContainer: 'employment-review-boundary-html-container'/);
assert.match(browser, /const htmlContainer = Swal\.getHtmlContainer\(\);/);
assert.match(browser, /didClose: \(\) => requestAnimationFrame\(\(\) => refreshEmploymentReviewStickyLayout\(\)\)/);
assert.match(browser, /const preservedScrollTop = scrollContainer\.scrollTop;[\s\S]*updateWeeklyDeviationStickyMetrics\(\);[\s\S]*scrollContainer\.scrollTop = preservedScrollTop;/);
assert.match(browser, /boundaryCoverageStatusLabel\(side\.status\)/);
assert.doesNotMatch(browser, />\$\{side\.status\}</);
assert.match(view, /id="employmentReviewBoundaryContextButton"/);
assert.match(view, /Πληροφορίες οριακών εβδομάδων/);
assert.match(view, /employment-review-boundary-context-button/);
assert.match(view, /employment-review-action-btn employment-review-action-secondary employment-review-boundary-context-button/);
assert.match(css, /\.weekly-hr-stage1-table > thead > tr > th\s*\{[\s\S]*position: sticky;/);
assert.match(css, /\.weekly-hr-stage1-table-shell\s*\{[\s\S]*overflow: visible;/);
assert.match(css, /\.weekly-hr-stage1-bulk-toolbar\s*\{[\s\S]*margin-bottom: 0\.625rem !important;/);
assert.match(css, /\.employment-review-boundary-dialog\s*\{[\s\S]*overflow: visible;/);
assert.match(css, /\.employment-review-action-secondary\s*\{[\s\S]*background: var\(--bs-secondary-bg-subtle, #e9ecef\);/);
assert.match(css, /\.employment-review-action-secondary:hover,[\s\S]*background: #6c757d;[\s\S]*color: #ffffff;/);
assert.match(css, /\.employment-review-boundary-context-button\s*\{[\s\S]*flex: 0 0 auto;[\s\S]*width: auto;[\s\S]*white-space: nowrap;/);
assert.doesNotMatch(css, /\.employment-review-boundary-context-button:hover/);
assert.match(css, /#employmentReviewBoundaryContextButton:not\(:hover\):not\(:focus\)\s*\{[\s\S]*background-color: var\(--bs-secondary-bg-subtle, #e9ecef\);[\s\S]*color: #41464b;[\s\S]*border-color: #ced4da;/);
assert.match(css, /\.swal2-popup\.employment-review-boundary-popup\s*\{[\s\S]*max-height: calc\(100vh - 2rem\);[\s\S]*overflow: hidden;/);
assert.doesNotMatch(css, /\.employment-review-boundary-html-container\s*\{[\s\S]*max-height:/);
const boundaryDialogSource = browser.match(
    /function showEmploymentReviewBoundaryContextDialog\(\) \{[\s\S]*?\n\}\n\nfunction renderEmploymentReviewBoundaryContextSummary/
)?.[0].replace(/\n\nfunction renderEmploymentReviewBoundaryContextSummary$/, '');
assert.ok(boundaryDialogSource);
const appliedBoundaryStyles = [];
const boundaryDialogOptions = vm.runInNewContext(`(() => {
    let currentEmploymentReviewBoundaryContextDialogHtml = '<div>boundary</div>';
    const Swal = { getHtmlContainer: () => ({ style: {
        setProperty: (...args) => appliedBoundaryStyles.push(args)
    } }) };
    const employmentReviewSwal = (options) => options;
    const requestAnimationFrame = () => {};
    const refreshEmploymentReviewStickyLayout = () => {};
    ${boundaryDialogSource}
    return showEmploymentReviewBoundaryContextDialog();
})()`, { appliedBoundaryStyles, Promise });
boundaryDialogOptions.didOpen();
assert.deepStrictEqual(JSON.parse(JSON.stringify(appliedBoundaryStyles)), [
    ['max-height', '18rem', 'important'],
    ['overflow-y', 'auto', 'important'],
    ['overflow-x', 'hidden', 'important'],
    ['overscroll-behavior', 'contain']
]);
assert.match(controller, /const \[previousBoundaryRows, nextBoundaryRows\][\s\S]*Promise\.all/);
assert.match(controller, /cards_apo_ora_01 cards_eos_ora_01[\s\S]*cards_ores_ergasias/);
console.log('erganhController weekly HR Stage 1 contract tests passed');
