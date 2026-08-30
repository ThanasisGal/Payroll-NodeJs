'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const controller = fs.readFileSync(path.join(__dirname, 'erganhController.js'), 'utf8');

function section(start, end) {
    const startIndex = controller.indexOf(start);
    const endIndex = controller.indexOf(end, startIndex);
    assert.notEqual(startIndex, -1, `Missing controller section: ${start}`);
    assert.notEqual(endIndex, -1, `Missing controller section end: ${end}`);
    return controller.slice(startIndex, endIndex);
}

const helperSource = controller.match(
    /function stage1HolidayEligibilityContext\([\s\S]*?\n}/
)?.[0];
assert.ok(helperSource, 'Missing stage1HolidayEligibilityContext helper');

const stage1HolidayEligibilityContext = vm.runInNewContext(
    `(() => { ${helperSource}; return stage1HolidayEligibilityContext; })()`
);
const companyOpen = {
    apasxolhsh_kata_tis_argies: true,
    leitoyrgia_stis_mh_ypoxreotikes_argies: true
};
const companyClosed = {
    apasxolhsh_kata_tis_argies: false,
    leitoyrgia_stis_mh_ypoxreotikes_argies: false
};

assert.equal(stage1HolidayEligibilityContext({
    ypoxreotikh_argia: true,
    companyOperatesOnHoliday: false
}, companyOpen).companyFlags.companyWorksOnMandatoryHoliday, false);
assert.equal(stage1HolidayEligibilityContext({
    ypoxreotikh_argia: true,
    companyOperatesOnHoliday: true
}, companyClosed).companyFlags.companyWorksOnMandatoryHoliday, true);
assert.equal(stage1HolidayEligibilityContext({
    ypoxreotikh_argia: true
}, companyOpen).companyFlags.companyWorksOnMandatoryHoliday, true);
assert.equal(stage1HolidayEligibilityContext({
    ypoxreotikh_argia: false,
    companyOperatesOnHoliday: false
}, companyOpen).companyFlags.companyWorksOnOptionalHoliday, false);
assert.equal(stage1HolidayEligibilityContext({
    ypoxreotikh_argia: false,
    companyOperatesOnHoliday: true
}, companyClosed).companyFlags.companyWorksOnOptionalHoliday, true);
assert.equal(stage1HolidayEligibilityContext({
    ypoxreotikh_argia: false
}, companyOpen).companyFlags.companyWorksOnOptionalHoliday, true);

const stage1Get = section(
    'static getWeeklyHrWorkflowStage1',
    'static exportProdhlomenaOrariaReviewAuditDossierPdf'
);
assert.match(stage1Get, /loadAuthoritativeStage1HolidayContext\(\{/);
assert.match(stage1Get, /presentationSnapshot,[\s\S]*loadHolidayContext: buildNoCardsDisplayContext/);
assert.match(stage1Get, /stage1HolidayContext\.argiesByDateKey[\s\S]*\.get\(rowDate\)/);
assert.match(stage1Get, /resolveAuthoritativeHolidayClassification\(\{[\s\S]*row,[\s\S]*stage1HolidayEligibilityContext\(holidayRecord,/);
assert.match(stage1Get, /holiday_classification_eligible: holidayEligibility\.eligible/);
assert.doesNotMatch(stage1Get,
    /presentationSnapshot\s*\?\s*\{\s*companyFlags:\s*\{\},\s*argiesByDateKey:\s*new Map\(\)\s*}/);
assert.doesNotMatch(stage1Get,
    /stage1HolidayContext\.companyFlags\.apasxolhsh_kata_tis_argies/);

const stage1Save = section(
    'static saveWeeklyHrStage1DailyClassificationsBulk',
    'static resolveWeeklyHrStage3Day'
);
assert.match(stage1Save, /applyOne: async \(\{ row_id, classification, updates, reason }\)/);
assert.match(stage1Save, /if \(classification === 'HOLIDAY'\)/);
assert.match(stage1Save, /ProdhlomenaOrariaModel\.findOne\(\{ _id: row_id,[\s\S]*\.select\(REVIEW_SELECT_FIELDS\)\.lean\(\)/);
assert.match(stage1Save, /buildNoCardsDisplayContext\(\{[\s\S]*authoritativeTarget\.hmeromhnia/);
assert.match(stage1Save, /resolveAuthoritativeHolidayClassification\(\{[\s\S]*stage1HolidayEligibilityContext\(holidayRecord,/);
assert.match(stage1Save, /STAGE1_HOLIDAY_NOT_AUTHORITATIVE/);
assert.match(stage1Save, /updates = buildStage1ClassificationUpdates\([\s\S]*classification: 'HOLIDAY'/);
assert.ok(stage1Save.indexOf('resolveAuthoritativeHolidayClassification({') <
    stage1Save.indexOf("updates = buildStage1ClassificationUpdates("));

const manualUpdate = section(
    'static updateProdhlomenaOrariaReviewRecord',
    'static unlockProdhlomenaOrariaReviewRecord'
);
assert.match(manualUpdate, /if \(cleanUpdates\.argia === true\)/);
assert.match(manualUpdate, /buildNoCardsDisplayContext\(\{/);
assert.match(manualUpdate, /resolveAuthoritativeHolidayClassification\(\{[\s\S]*stage1HolidayEligibilityContext\(holidayRecord,/);
assert.match(manualUpdate, /STAGE1_HOLIDAY_NOT_AUTHORITATIVE/);
assert.match(manualUpdate, /cleanUpdates = buildStage1ClassificationUpdates\([\s\S]*classification: 'HOLIDAY'/);
assert.ok(manualUpdate.indexOf('resolveAuthoritativeHolidayClassification({') <
    manualUpdate.indexOf('cleanUpdates = buildStage1ClassificationUpdates('));

console.log('Stage 1 holiday authorization regression tests: PASS');
