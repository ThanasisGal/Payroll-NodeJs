'use strict';
const assert = require('assert'); const fs = require('fs'); const path = require('path');
const controller = fs.readFileSync(path.join(__dirname, 'erganhController.js'), 'utf8');
const routes = fs.readFileSync(path.join(__dirname, '../../routes/usersRoute.js'), 'utf8');
const browser = fs.readFileSync(path.join(__dirname, '../../../public/js/ergazomenoi/programmata/elegxosApasxolhseonPeriodoy.js'), 'utf8');
const view = fs.readFileSync(path.join(__dirname, '../../../views/ergazomenoi/programmata/elegxosApasxolhseonPeriodoy.ejs'), 'utf8');
const correctiveWeekly = fs.readFileSync(path.join(__dirname, '../../services/ergazomenoi/apasxoliseisCorrectiveWeeklyRecalculationService.js'), 'utf8');
assert.match(routes, /period-control\/finalize'[\s\S]*requireCriticalEmploymentDecisionRole[\s\S]*finalizeEmploymentReviewPeriod/);
assert.match(routes, /period-control\/submission-link'[\s\S]*requireCriticalEmploymentDecisionRole[\s\S]*linkEmploymentReviewPeriodSubmission/);
assert.match(routes, /period-control\/corrective\/open'[\s\S]*requireCriticalEmploymentDecisionRole[\s\S]*openEmploymentReviewCorrectiveCase/);
assert.match(routes, /period-control\/corrective\/calculate'[\s\S]*requireCriticalEmploymentDecisionRole[\s\S]*calculateEmploymentReviewCorrectiveCase/);
assert.match(routes, /period-control\/corrective\/close'[\s\S]*requireCriticalEmploymentDecisionRole[\s\S]*closeEmploymentReviewCorrectiveCase/);
assert.match(controller, /calculateEmploymentReviewCorrectiveCase[\s\S]*normalizeCorrectionCommands\(req\.body\)[\s\S]*saveCorrectiveResult/);
assert.ok((controller.match(/buildEmploymentDailyCalculationUpdate\(\{/g) || []).length >= 2);
assert.match(controller, /runFrozenAuthoritativeEmploymentWeek[\s\S]*buildWeeklyRepoPostCheckWritePlan\(/);
assert.match(controller, /runAuthoritativeWeek:\s*runFrozenAuthoritativeEmploymentWeek/);
for (const duplicatedRule of ['ordinal < 480', 'ordinal < 540', 'ordinal < 720', '22:00', '06:00',
    'analyzeWeeklySixthSeventhDay', 'buildWeeklyIllegalOvertimePersistenceMapping']) {
    assert.ok(!correctiveWeekly.includes(duplicatedRule), `corrective-specific rule remained: ${duplicatedRule}`);
}
assert.match(controller, /closeEmploymentReviewCorrectiveCase[\s\S]*closeCorrectiveCase/);
assert.match(controller, /generateWTOApologistiko[\s\S]*xmlType:\s*'wto_variable_apologistiko'[\s\S]*isPermanent:\s*false/);
assert.ok(!/submitWTOWeekToErganh[\s\S]*employment_period_start/.test(controller));
assert.match(controller, /finalizeEmploymentReviewPeriod[\s\S]*loadEmploymentPeriodFrozenSnapshotInput[\s\S]*finalizeEmploymentPeriod/);
assert.match(controller, /getProdhlomenaOrariaForReview[\s\S]*stored_status === 'FINALIZED'[\s\S]*projectFrozenReview/);
assert.match(controller, /getReviewRowsForExport[\s\S]*stored_status === 'FINALIZED'[\s\S]*projectFrozenReview/);
assert.ok(!/apologistiko_biblio[\s\S]{0,100}(submission|FINALIZED|corrective)/i.test(controller));
for (const label of ['Οριστικοποιημένη περίοδος', 'Ημερομηνία οριστικοποίησης', 'Υποβολή', 'Πρωτόκολλο',
    'Εμπρόθεσμη', 'Εκπρόθεσμη', 'Άνοιγμα διορθωτικής μισθοδοσίας', 'Διορθωτική μισθοδοσία σε εξέλιξη',
    'Αρχικό οριστικοποιημένο αποτέλεσμα', 'Διορθωτική διαφορά', 'Διορθωμένο αποτέλεσμα',
    'Καταχώρηση διορθωτικών στοιχείων', 'Υπολογισμός διορθωτικής μισθοδοσίας',
    'Κλείσιμο διορθωτικής μισθοδοσίας']) {
    assert.ok(`${view}\n${browser}`.includes(label), `missing Greek UI label: ${label}`);
}
assert.ok(browser.includes("FINALIZED: 'Οριστικοποιημένη περίοδος'"));
assert.ok(!browser.includes("textContent = state?.frozen_snapshot_fingerprint"));
assert.match(browser, /payload\.finalized !== true[\s\S]*fetchScenarioClassifications/);
assert.match(browser, /if \(payload\.finalized !== true\) \{[\s\S]*Promise\.allSettled/);
console.log('employment period lifecycle controller/UI contracts: PASS');
