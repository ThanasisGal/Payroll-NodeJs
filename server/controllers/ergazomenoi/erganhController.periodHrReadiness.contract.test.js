'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const controller = fs.readFileSync(path.join(__dirname, 'erganhController.js'), 'utf8');
const frontend = fs.readFileSync(path.join(__dirname,
    '../../../public/js/ergazomenoi/programmata/elegxosApasxolhseonPeriodoy.js'), 'utf8');

test('period control συλλέγει όλες τις σελίδες από το ίδιο UI projection pipeline', () => {
    assert.match(controller, /async function loadEmploymentPeriodReadiness[\s\S]*collectPeriodWideUiProjections/);
    assert.match(controller, /erganhController\.getProdhlomenaOrariaForReview\(periodRequest, periodResponse\)/);
    assert.match(controller, /_skipPeriodHrReadiness = true/);
    assert.match(controller, /period_hr_readiness: periodHrReadiness/);
    assert.match(controller, /lock_period:[\s\S]*periodHrReadiness\.ready/);
    assert.match(controller, /finalize_period:[\s\S]*periodHrReadiness\.ready/);
});

test('LOCK και FINALIZE περνούν ανεξάρτητο authoritative resolver', () => {
    const matches = controller.match(/periodHrReadinessResolver:\s*async\s*\(\)\s*=>\s*\(await periodReadiness\(\)\)\.hr/g) || [];
    assert.equal(matches.length, 2);
});
test('data-quality readiness τροφοδοτεί reconstruction, LOCK, FINALIZE και period control', () => {
    assert.match(controller, /period_data_quality_readiness: periodDataQualityReadiness/);
    assert.match(controller, /historical_reconstruct:[\s\S]*periodDataQualityReadiness\.ready/);
    assert.match(controller, /periodDataQualityReadinessResolver/);
    assert.match(controller, /assertPeriodDataQualityReady\([\s\S]*HISTORICAL_RECONSTRUCTION/);
});

test('το UI εμφανίζει ελληνικό readiness μήνυμα χωρίς reason code', () => {
    assert.match(frontend, /εκκρεμότητες ελέγχου εργαζομένων/);
    assert.doesNotMatch(frontend, /PERIOD_HAS_PENDING_HR_ACTIONS/);
});
