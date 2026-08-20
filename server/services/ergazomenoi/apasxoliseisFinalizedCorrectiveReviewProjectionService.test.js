'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { projectFinalizedCorrectiveReview } =
    require('./apasxoliseisFinalizedCorrectiveReviewProjectionService');

const affectedBaseline = { _id: '0004-14', kodikos: '0004', ypokatasthma: '0000',
    hmeromhnia: '2026-06-14', cards_apo_ora_01: '14:51', cards_eos_ora_01: '',
    orphan_card_resolution: { status: 'HR_APPROVED' }, sixth_seventh_classification: '',
    sixth_day_hours: 0, seventh_day_hours: 0,
    scenarioDecision: { scenario_code: 'ORPHAN_CARD_PUNCH' } };
const unaffectedRow = { _id: '0009-01', kodikos: '0009', ypokatasthma: '0000',
    hmeromhnia: '2026-06-01', argia: true,
    scenarioDecision: { scenario_code: 'HOLIDAY' }, persisted_badge: 'ΑΡΓΙΑ' };
const correctedAffected = { ...affectedBaseline, apo_ora_01_apologistika: '14:51',
    eos_ora_01_apologistika: '23:21', ores_ergasias_apologistika: 8,
    ores_pragmatikhs_ergasias_apologistika: 8, sixth_seventh_classification: 'SIXTH',
    sixth_day_hours: 8, seventh_day_hours: 0, effective_sixth_day_rate: 0 };
const baselineAffectedWeek = { kodikos: '0004', week_apo: '2026-06-08',
    actual_workdays: 5, sixth_day_count: 0, seventh_day_count: 0 };
const correctedAffectedWeek = { kodikos: '0004', week_apo: '2026-06-08',
    actual_repo: 1, resolved_repo: 1, actual_workdays: 6,
    sixth_day_count: 1, seventh_day_count: 0,
    effective_expected_repo: 2, effective_weekly_workdays: 5 };
const unrelatedWeek = { kodikos: '0009', week_apo: '2026-06-08',
    actual_workdays: 5, sixth_day_count: 0, seventh_day_count: 0 };

const snapshot = { daily_results: [affectedBaseline, unaffectedRow],
    deviations: [baselineAffectedWeek, unrelatedWeek], payroll_results: [] };
const corrective = { status: 'CLOSED', corrected_context: { commands: [{
    type: 'RECOMPUTE_FROZEN_WEEK', employee_kodikos: '0004', week_start: '2026-06-08'
}] }, corrected_result: {
    daily_results: [correctedAffected, { ...unaffectedRow, persisted_badge: 'CHANGED' }],
    deviations: [correctedAffectedWeek, { ...unrelatedWeek, actual_workdays: 0 }]
} };

const projected = projectFinalizedCorrectiveReview(snapshot, corrective);
const affected = projected.rows.find((row) => row.kodikos === '0004');
const unaffected = projected.rows.find((row) => row.kodikos === '0009');
assert.equal(projected.source, 'FROZEN_FINALIZED_CORRECTED');
assert.deepEqual(unaffected, { ...unaffectedRow, is_sixth_day: false,
    sixth_day_premium_rate: null, is_seventh_day: false, seventh_day_severity: '' });
assert.deepEqual(affected.scenarioDecision, affectedBaseline.scenarioDecision);
assert.equal(affected.orphan_card_resolution.status, 'HR_APPROVED');
assert.equal(affected.is_sixth_day, true);
assert.equal(affected.sixth_day_premium_rate, 0);
assert.equal(affected.sixth_day_hours, 8);
const week0004 = projected.deviations.find((row) => row.kodikos === '0004');
const week0009 = projected.deviations.find((row) => row.kodikos === '0009');
assert.equal(week0004.actual_workdays, 6);
assert.equal(week0004.sixth_day_count, 1);
assert.equal(week0004.seventh_day_count, 0);
assert.deepEqual(week0009, unrelatedWeek);
const browser = fs.readFileSync(path.join(__dirname,
    '../../../public/js/ergazomenoi/programmata/elegxosApasxolhseonPeriodoy.js'), 'utf8');
assert.match(browser,
    /preloaded_projections:\s*payload\.finalized === true \? \[\] : payload\.weekly_hr_projections/);

console.log('finalized corrective review projection: PASS');
