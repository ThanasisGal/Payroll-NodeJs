'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { POLICY_VERSION } = require('./apasxoliseisOrphanCardResolutionService');
const { buildPeriodDataQualityReadiness, assertPeriodDataQualityReady } = require(
    './apasxoliseisPeriodDataQualityReadinessService');
function row(resolution = null) { return { _id: 'row-1', kodikos: '0003', employeeName: 'ΘΕΟΔΩΡΟΥ ΘΕΟΔΩΡΟΣ',
    hmeromhnia: '2026-06-02', cards_apo_ora_01: '10:09', cards_eos_ora_01: '',
    orphan_card_resolution: resolution }; }
test('unresolved orphan είναι period data-quality blocker', () => {
    const result = buildPeriodDataQualityReadiness({ rows: [row()] });
    assert.equal(result.ready, false); assert.equal(result.unresolved_count, 1);
    assert.equal(result.unresolved_cases[0].issue_code, 'ORPHAN_CARD_PUNCH');
    assert.throws(() => assertPeriodDataQualityReady(result, 'LOCK'),
        (error) => error.code === 'PERIOD_HAS_UNRESOLVED_DATA_QUALITY_ISSUES');
});
test('έγκυρη persisted HR orphan resolution δεν μπλοκάρει', () => {
    const result = buildPeriodDataQualityReadiness({ rows: [row({ status: 'HR_APPROVED',
        policy_version: POLICY_VERSION })] });
    assert.equal(result.ready, true); assert.equal(result.unresolved_count, 0);
});
test('παρωχημένο ή ελλιπές resolution δεν θεωρείται έγκυρο', () => {
    assert.equal(buildPeriodDataQualityReadiness({ rows: [row({ status: 'HR_APPROVED' })] }).ready, false);
});
