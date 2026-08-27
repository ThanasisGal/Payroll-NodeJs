'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const controller = fs.readFileSync(path.join(__dirname, 'erganhController.js'), 'utf8');
const browser = fs.readFileSync(path.join(__dirname,
    '../../../public/js/ergazomenoi/programmata/elegxosApasxolhseonPeriodoy.js'), 'utf8');
const workflowPresentation = browser.slice(
    browser.indexOf('function updateEmploymentReviewWorkflowPresentation'),
    browser.indexOf('function renderWeeklyHrStage1BulkToolbar')
);
const departureBadge = browser.slice(
    browser.indexOf('function employeeDepartureBadge'),
    browser.indexOf('function renderReviewRows')
);

assert.match(controller, /hmeromhnia_apoxorhshs: erg\?\.hmeromhnia_apoxorhshs \|\| null/);
assert.match(departureBadge, /departureDate < periodStart \|\| departureDate > periodEnd/);
assert.match(departureBadge, /ΑΠΟΧΩΡΗΣΕ ΣΤΙΣ/);
assert.match(browser, /\$\{lifecycleBadge\}[\s\S]{0,100}\$\{departureBadge\}/);
assert.match(workflowPresentation, /\['STAGE1', 'STAGE2', 'STAGE3'\]\.includes\(stage\.stage\)/);
assert.match(workflowPresentation, /Number\(stage\.pending_count \|\| 0\) === 0/);
assert.match(workflowPresentation, /stage\.business_status !== 'BLOCKED'/);
assert.match(workflowPresentation, /presentationStatus !== 'LOCKED'/);
assert.match(workflowPresentation,
    /presentationStatus === 'LOCKED' \|\| noHrAction \? ''/);
assert.match(workflowPresentation, /stage\.stage === 'STAGE4'[\s\S]{0,80}stage\.business_status/);
assert.match(workflowPresentation, /workflowStageStatusLabels\[badgeStatus\]/);
assert.match(browser, /Δεν υπάρχουν ανέλεγκτες πιθανές άδειες\./);

console.log('employment review presentation badges regression tests: PASS');
