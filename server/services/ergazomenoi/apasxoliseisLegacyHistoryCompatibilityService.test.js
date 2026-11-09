'use strict';
const { test, before, after, mock } = require('node:test');
const assert = require('node:assert/strict');
const { employeeActiveHistoryFixture } = require('../../../test/fixtures/employeeActiveHistoryFixture');
const { resolveEffectiveEmploymentProfileForReviewDate: resolve } = require('./apasxoliseisBorrowedEmploymentProfileResolverService');
const { buildWeeklyHrLifecycleProjection: lifecycle } = require('./apasxoliseisWeeklyHrLifecycleProjectionService');
const { buildEmploymentDailyCalculationUpdate: daily } = require('./apasxoliseisEmploymentDailyCalculationAdapterService');
before(() => require('../../../test/fixtures/forbidRealSettlementMongo').forbidRealSettlementMongo(mock));
after(() => mock.restoreAll());
function fixture() {
    const f = employeeActiveHistoryFixture('SYNTHETIC');
    f.history.push({ ...structuredClone(f.history[0]), _id: '507f1f77bcf86cd799439099', aa_eggrafhs: '0002' });
    return f;
}
const profile = f => resolve({ reviewDate: '2026-04-06', normalEmployee: f.employee, normalHistory: f.history });
const week = () => Array.from({ length: 7 }, (_, i) => ({ _id: 'synthetic-' + i,
    hmeromhnia: '2026-04-' + String(6 + i).padStart(2, '0'),
    kathgoria_ergasias: i < 5 ? 'ΕΡΓ' : 'ΑΝ', repo: i >= 5,
    ores_ergasias: i < 5 ? 8 : 0, cards_ores_ergasias: i < 5 ? 8 : 0,
    cards_apo_ora_01: i < 5 ? '08:00' : '', cards_eos_ora_01: i < 5 ? '16:00' : '' }));
const operations = { sanitizeAppliedRepoTransferUpdate: ({ update }) => ({ sanitizedUpdate: update, diagnostics: [] }) };

test('both ambiguous observations remain immutable, no schema or ordering makes one trustworthy', () => {
    const f = fixture(), before = structuredClone(f);
    for (const history of [f.history, [...f.history].reverse(), f.history.map(row => ({ ...row, employment_profile_schema_version: undefined }))]) {
        const result = resolve({ reviewDate: '2026-04-06', normalEmployee: f.employee, normalHistory: history });
        assert.equal(result.resolution_blocked, false); assert.equal(result.history_terms_unavailable, true);
        for (const field of ['hmeres_ergasias_ebdomadas', 'ores_ergasias_ebdomadas', 'pragmatikoOromisthio'])
            assert.equal(result[field], null);
    }
    assert.deepEqual(f, before);
});
test('all four stages execute independent checks and stay open for history alone', () => {
    const result = lifecycle({ weekRows: week(), effectiveProfile: profile(fixture()) });
    for (const stage of Object.values(result.stages)) {
        assert.equal(stage.business_status, 'OPEN'); assert.equal(stage.all_results_documented, false);
        assert.equal(stage.independent_checks_executed, true); assert.deepEqual(stage.blockers, []);
    }
});
test('independent invalid card evidence remains a real blocker with legacy uncertainty', () => {
    const rows = week(); rows[0].cards_eos_ora_01 = '08:00';
    const result = lifecycle({ weekRows: rows, effectiveProfile: profile(fixture()) });
    assert.equal(result.stages.stage1.business_status, 'BLOCKED');
    assert.ok(result.stages.stage1.blockers.includes('ZERO_LENGTH_CARD_INTERVAL_REQUIRES_HR_DECISION'));
    assert.ok(!result.stages.stage1.blockers.includes('EMPLOYEE_HISTORY_COVERAGE_REQUIRED'));
});
test('independent split schedule gives eight actual hours; premiums and pay remain unknown', () => {
    const row = { ...week()[0], apo_ora_01: '08:00', eos_ora_01: '12:00',
        apo_ora_02: '16:00', eos_ora_02: '20:00', cards_eos_ora_01: '12:00',
        cards_apo_ora_02: '16:00', cards_eos_ora_02: '20:00' };
    const result = daily({ row, effectiveEmployee: profile(fixture()), operations });
    assert.equal(result.sanitizedUpdate.ores_pragmatikhs_ergasias_apologistika, 8);
    assert.equal(result.sanitizedUpdate.ores_paranomhs_yperorias_apologistika, null);
    assert.equal(result.sanitizedUpdate.compensation_breakdown_apologistika.total_amount, null);
});
test('unknown net break never becomes zero; source punches and locked results are preserved', () => {
    const row = week()[0], before = structuredClone(row), effectiveEmployee = profile(fixture());
    const result = daily({ row, effectiveEmployee, operations });
    assert.equal(result.sanitizedUpdate.ores_pragmatikhs_ergasias_apologistika, null);
    assert.equal(result.sanitizedUpdate.compensation_breakdown_apologistika.observed_card_minutes, 480);
    assert.deepEqual(row, before);
    assert.deepEqual(daily({ row: { ...row, is_locked: true }, effectiveEmployee, operations }).sanitizedUpdate, {});
});

test('legacy partial terms retain recorded type and days without borrowing missing hours from today', () => {
    const history = [{ _id: 'legacy-partial', afora_allagh_oron_ergasias: true,
        hmeromhnia_isxyos_oron_ergasias_apo: '2026-01-01',
        kathestos_apasxolhshs: '1', typos_ebdomadas: '5ΗΜΕΡΗ', hmeres_ergasias_ebdomadas: 4 }];
    const before = structuredClone(history);
    const result = resolve({ reviewDate: '2026-04-06', normalHistory: history,
        normalEmployee: { ores_ergasias_ebdomadas: 99, mo_oron_hmerhsias_ergasias: 19 } });
    assert.equal(result.kathestos_apasxolhshs, '1');
    assert.equal(result.hmeres_ergasias_ebdomadas, 4);
    assert.equal(result.ores_ergasias_ebdomadas, null);
    assert.equal(result.mo_oron_hmerhsias_ergasias, null);
    assert.equal(result.history_terms_unavailable, true);
    assert.equal(result.resolution_blocked, false);
    assert.deepEqual(history, before);
});

test('legacy daily average uses its own recorded weekly hours and days; V1 still requires the field', () => {
    const f = fixture(); f.history = [f.history[0]];
    delete f.history[0].mo_oron_hmerhsias_ergasias;
    const strict = profile(f);
    assert.equal(strict.history_terms_unavailable, true);
    assert.equal(strict.mo_oron_hmerhsias_ergasias, null);
    assert.equal(strict.resolution_blocked, false);
    delete f.history[0].employment_profile_schema_version;
    // A V1 employee still requires recorded daily hours in an unversioned row.
    const mixed = profile(f);
    assert.equal(mixed.history_terms_unavailable, true);
    assert.equal(mixed.mo_oron_hmerhsias_ergasias, null);
    assert.equal(mixed.resolution_blocked, false);

    // Pure legacy compatibility requires both observations to predate V1.
    const legacy = structuredClone(f);
    delete legacy.employee.employment_profile_schema_version;
    legacy.employee.ores_ergasias_ebdomadas = 99;
    legacy.employee.mo_oron_hmerhsias_ergasias = 19;
    const before = structuredClone(legacy);
    const compatible = profile(legacy);
    assert.equal(compatible.hmeres_ergasias_ebdomadas, 5);
    assert.equal(compatible.ores_ergasias_ebdomadas, 40);
    assert.equal(compatible.mo_oron_hmerhsias_ergasias, 8);
    assert.equal(String(compatible.istorikoId), String(f.history[0]._id));
    assert.deepEqual(legacy, before);
});
