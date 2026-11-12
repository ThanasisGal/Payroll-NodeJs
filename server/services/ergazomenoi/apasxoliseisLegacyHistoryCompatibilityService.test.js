'use strict';
const { test, before, after, mock } = require('node:test');
const assert = require('node:assert/strict');
const { employeeActiveHistoryFixture } = require('../../../test/fixtures/employeeActiveHistoryFixture');
const { resolveEffectiveEmploymentProfileForReviewDate: resolve } = require('./apasxoliseisBorrowedEmploymentProfileResolverService');
const { buildWeeklyHrLifecycleProjection: lifecycle } = require('./apasxoliseisWeeklyHrLifecycleProjectionService');
const { buildStage1Fingerprint } = require('./apasxoliseisStage1FingerprintService');
const { buildEmploymentDailyCalculationUpdate: daily } = require('./apasxoliseisEmploymentDailyCalculationAdapterService');
let operations;
before(() => {
    require('../../../test/fixtures/forbidRealSettlementMongo').forbidRealSettlementMongo(mock);
    const Module = require('node:module'), load = Module._load;
    try {
        Module._load = function(request, parent, main) {
            if (request === 'libxmljs2') return {};
            if (request === '../../config/aws') return { s3Client: {} };
            return load.call(this, request, parent, main);
        };
        operations = require('../../controllers/ergazomenoi/erganhController')
            .__orphanDailyCalculationTestHooks.AUTHORITATIVE_DAILY_CALCULATION_OPERATIONS;
    } finally { Module._load = load; }
});
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
const confirmedStage1 = rows => ({ status: 'COMPLETED',
    completion_fingerprint: buildStage1Fingerprint(rows).fingerprint, version: 1 });

function assertHistoryRemainsProvisional(result) {
    assert.equal(result.history_pending, true);
    assert.equal(result.all_results_documented, false);
    assert.equal(result.weekly_analysis_presentation_status, 'PROVISIONAL');
    for (const stage of Object.values(result.stages)) {
        assert.equal(stage.history_pending, true);
        assert.equal(stage.all_results_documented, false);
        assert.equal(stage.independent_checks_executed, true);
        assert.equal(stage.final_weekly_analysis_available, false);
        assert.ok(stage.read_warnings.some(item => item.code === 'EMPLOYEE_HISTORY_COVERAGE_REQUIRED'));
        assert.ok(!stage.blockers.includes('EMPLOYEE_HISTORY_COVERAGE_REQUIRED'));
        assert.ok(!stage.pending_reasons.includes('EMPLOYEE_HISTORY_COVERAGE_REQUIRED'));
    }
    assert.equal(result.stages.stage4.business_status, 'OPEN');
    assert.equal(result.stages.stage4.final_weekly_analysis, undefined);
}

test('both ambiguous observations remain immutable, no schema or ordering makes one trustworthy', () => {
    const f = fixture(), before = structuredClone(f);
    for (const history of [f.history, [...f.history].reverse(), f.history.map(row => ({ ...row, employment_profile_schema_version: undefined }))]) {
        const result = resolve({ reviewDate: '2026-04-06', normalEmployee: f.employee, normalHistory: history });
        assert.equal(result.resolution_blocked, false); assert.equal(result.history_terms_unavailable, true);
        assert.equal(result.hmeres_ergasias_ebdomadas, 5);
        assert.equal(result.ores_ergasias_ebdomadas, 40);
        assert.equal(result.mo_oron_hmerhsias_ergasias, 8);
        assert.equal(result.kathestos_apasxolhshs, '0');
        assert.equal(result.legacy_fallback_status, 'LEGACY_FALLBACK_ASSUMED');
        assert.equal(result.pragmatikoOromisthio, null);
    }
    assert.deepEqual(f, before);
});
test('all four stages execute independent checks; history alone creates no Stage 2 or 3 task', () => {
    const input = { weekRows: week(), effectiveProfile: profile(fixture()) }, before = structuredClone(input);
    const result = lifecycle(input);
    assertHistoryRemainsProvisional(result);
    assert.equal(result.stages.stage1.business_status, 'OPEN');
    assert.equal(result.stages.stage1.weekly_confirmation_required, true);
    assert.equal(result.stages.stage1.pending_count, 1);
    assert.deepEqual(result.stages.stage1.pending_dates, []);
    assert.deepEqual(result.stages.stage1.pending_reasons, ['STAGE1_WEEKLY_CONFIRMATION_REQUIRED']);
    assert.equal(result.current_stage, 'STAGE1');
    assert.equal(result.requires_hr_action, true);
    assert.equal(result.total_pending_count, 1);
    for (const key of ['stage2', 'stage3']) {
        const stage = result.stages[key];
        assert.equal(stage.business_status, 'COMPLETED');
        assert.equal(stage.pending_count, 0);
        assert.deepEqual(stage.pending_dates, []);
        assert.deepEqual(stage.pending_items, []);
        assert.deepEqual(stage.pending_reasons, []);
    }
    assert.equal(result.stages.stage2.resolution_route, undefined);
    for (const stage of Object.values(result.stages)) assert.deepEqual(stage.blockers, []);
    assert.deepEqual(input, before);
});
test('a recorded weekly confirmation clears Stage 1 without documenting unavailable history', () => {
    const rows = week();
    const input = { weekRows: rows, effectiveProfile: profile(fixture()), persistedStage1State: confirmedStage1(rows) };
    const before = structuredClone(input), result = lifecycle(input);
    assertHistoryRemainsProvisional(result);
    for (const key of ['stage1', 'stage2', 'stage3']) {
        assert.equal(result.stages[key].business_status, 'COMPLETED');
        assert.equal(result.stages[key].pending_count, 0);
        assert.deepEqual(result.stages[key].pending_reasons, []);
        assert.deepEqual(result.stages[key].blockers, []);
    }
    assert.equal(result.stages.stage1.weekly_confirmation_required, false);
    assert.equal(result.current_stage, null);
    assert.equal(result.requires_hr_action, false);
    assert.equal(result.total_pending_count, 0);
    assert.deepEqual(input, before);
});
test('independent invalid card evidence remains a real blocker with legacy uncertainty', () => {
    const rows = week(); rows[0].cards_eos_ora_01 = '08:00';
    const result = lifecycle({ weekRows: rows, effectiveProfile: profile(fixture()) });
    assertHistoryRemainsProvisional(result);
    for (const key of ['stage1', 'stage2', 'stage3']) {
        assert.equal(result.stages[key].business_status, 'BLOCKED');
        assert.ok(result.stages[key].blockers.includes('ZERO_LENGTH_CARD_INTERVAL_REQUIRES_HR_DECISION'));
    }
});
test('a real rest/work contradiction blocks Stages 2 and 3 independently of history', () => {
    const rows = week();
    Object.assign(rows[0], { repo_apologistika: true, kathgoria_ergasias_apologistika: 'ΑΝ' });
    const result = lifecycle({ weekRows: rows, effectiveProfile: profile(fixture()) });
    assertHistoryRemainsProvisional(result);
    for (const key of ['stage2', 'stage3']) {
        const stage = result.stages[key];
        assert.equal(stage.business_status, 'BLOCKED');
        assert.equal(stage.pending_count, 1);
        assert.deepEqual(stage.blockers, ['REST_CLASSIFICATION_REVIEW_REQUIRED']);
        assert.ok(stage.diagnostics.some(item => item.code === 'REST_CLASSIFICATION_WORK_CONFLICT' &&
            item.dates.includes('2026-04-06')));
    }
    assert.deepEqual(result.stages.stage2.pending_dates, ['2026-04-06']);
});
test('incomplete card evidence blocks all three checks and retains the affected date', () => {
    const rows = week(); rows[0].cards_eos_ora_01 = '';
    const result = lifecycle({ weekRows: rows, effectiveProfile: profile(fixture()) });
    assertHistoryRemainsProvisional(result);
    for (const key of ['stage1', 'stage2', 'stage3']) {
        const stage = result.stages[key];
        assert.equal(stage.business_status, 'BLOCKED');
        assert.ok(stage.blockers.includes('UNRESOLVED_INCOMPLETE_CARD_EVIDENCE'));
        assert.ok(stage.diagnostics.some(item => item.code === 'UNRESOLVED_INCOMPLETE_CARD_EVIDENCE' &&
            item.dates.includes('2026-04-06')));
    }
    assert.deepEqual(result.stages.stage2.pending_dates, ['2026-04-06']);
});
test('ambiguous unclassified days still require dated HR decisions after weekly confirmation', () => {
    const rows = week();
    for (const row of rows.slice(4, 6)) Object.assign(row, { repo: false, kathgoria_ergasias: 'ΕΡΓ',
        cards_apo_ora_01: '', cards_eos_ora_01: '', cards_ores_ergasias: 0, ores_ergasias: 8,
        kathgoria_adeias_apologistika: 'POSSIBLE_LEAVE' });
    const input = { weekRows: rows, effectiveProfile: profile(fixture()), persistedStage1State: confirmedStage1(rows) };
    const before = structuredClone(input), result = lifecycle(input);
    assertHistoryRemainsProvisional(result);
    assert.equal(result.stages.stage1.business_status, 'COMPLETED');
    assert.equal(result.stages.stage1.weekly_confirmation_required, false);
    assert.equal(result.current_stage, 'STAGE2');
    assert.equal(result.requires_hr_action, true);
    assert.equal(result.total_pending_count, 2);
    for (const key of ['stage2', 'stage3']) {
        assert.equal(result.stages[key].business_status, 'OPEN');
        assert.equal(result.stages[key].pending_count, 2);
        assert.deepEqual(result.stages[key].pending_dates, ['2026-04-10', '2026-04-11']);
        assert.deepEqual(result.stages[key].blockers, []);
    }
    assert.equal(result.stages.stage2.resolution_route, 'STAGE3_HUMAN_DECISION');
    assert.deepEqual(result.stages.stage2.pending_reasons, ['AMBIGUOUS_WEEKLY_REST_DATES']);
    assert.deepEqual(result.stages.stage3.pending_reasons, ['REMAINING_POSSIBLE_LEAVE_REVIEW_REQUIRED']);
    assert.deepEqual(result.stages.stage3.pending_items.map(item => item.date), ['2026-04-10', '2026-04-11']);
    for (const item of result.stages.stage3.pending_items) {
        assert.deepEqual(item.allowed_classifications, ['LEAVE', 'SICKNESS', 'ABSENCE']);
        assert.match(item.input_fingerprint, /^[a-f0-9]{64}$/);
    }
    assert.deepEqual(input, before);
});
test('independent split schedule gives eight actual hours with provisional classification and no pay', () => {
    const row = { ...week()[0], apo_ora_01: '08:00', eos_ora_01: '12:00',
        apo_ora_02: '16:00', eos_ora_02: '20:00', cards_eos_ora_01: '12:00',
        cards_apo_ora_02: '16:00', cards_eos_ora_02: '20:00' };
    const result = daily({ row, effectiveEmployee: profile(fixture()), operations, argiesDateSet: new Set(),
        weeklyState: { weeklyRegularCardsMinutes: 480, processedRegularMinutes: 0,
            weeklyOverworkCapMinutes: 300, weeklyLegalLimitMinutes: 2400, usedOverworkMinutes: 0 } });
    assert.equal(result.sanitizedUpdate.ores_pragmatikhs_ergasias_apologistika, 8);
    assert.equal(result.sanitizedUpdate.ores_paranomhs_yperorias_apologistika, 0);
    assert.equal(result.sanitizedUpdate.compensation_breakdown_apologistika.total_amount, null);
});
test('temporary execution terms calculate card hours explicitly and preserve source punches and locked results', () => {
    const row = week()[0], before = structuredClone(row), effectiveEmployee = profile(fixture());
    const result = daily({ row, effectiveEmployee, operations, argiesDateSet: new Set() });
    assert.equal(result.sanitizedUpdate.ores_pragmatikhs_ergasias_apologistika, 8);
    assert.equal(result.sanitizedUpdate.compensation_breakdown_apologistika.status, 'LEGACY_FALLBACK_ASSUMED');
    assert.equal(result.sanitizedUpdate.compensation_breakdown_apologistika.observed_card_minutes, 480);
    const compensation = result.sanitizedUpdate.compensation_breakdown_apologistika;
    assert.equal(compensation.all_results_documented, false);
    assert.equal(compensation.total_amount, null);
    assert.deepEqual(compensation.rates, { paidHourlyRate: null, legalHourlyRate: null });
    assert.deepEqual(compensation.amounts, { baseActualWorkAmount: null, premiumTotalAmount: null, grossWorkAmount: null });
    assert.deepEqual(row, before);
    assert.deepEqual(daily({ row: { ...row, is_locked: true }, effectiveEmployee, operations }).sanitizedUpdate, {});
});

test('the daily calculator preserves a recorded rotational regime over the temporary full-time assumption', () => {
    const row = { ...week()[0], kathestos_apasxolhshs_hmeras: '2' };
    let checked = false;
    const result = daily({ row, effectiveEmployee: profile(fixture()), argiesDateSet: new Set(),
        operations: { ...operations, checkNightHours(context) {
            checked = true;
            assert.equal(context.ergazomenos.kathestos_apasxolhshs, '2');
            return operations.checkNightHours(context);
        } } });
    assert.equal(checked, true);
    assert.equal(result.sanitizedUpdate.compensation_breakdown_apologistika.assumed_work_terms.kathestos_apasxolhshs, undefined);
    assert.equal(result.sanitizedUpdate.compensation_breakdown_apologistika.amounts.grossWorkAmount, null);
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
    assert.equal(result.ores_ergasias_ebdomadas, 40);
    assert.equal(result.mo_oron_hmerhsias_ergasias, 8);
    assert.deepEqual(result.assumed_work_terms, { ores_ergasias_ebdomadas: 40,
        mo_oron_hmerhsias_ergasias: 8 });
    assert.equal(result.history_terms_unavailable, true);
    assert.equal(result.resolution_blocked, false);
    assert.deepEqual(history, before);
});

test('legacy daily average uses its own recorded weekly hours and days; V1 still requires the field', () => {
    const f = fixture(); f.history = [f.history[0]];
    delete f.history[0].mo_oron_hmerhsias_ergasias;
    const strict = profile(f);
    assert.equal(strict.history_terms_unavailable, true);
    assert.equal(strict.mo_oron_hmerhsias_ergasias, 8);
    assert.equal(strict.legacy_fallback_status, 'LEGACY_FALLBACK_ASSUMED');
    assert.equal(strict.resolution_blocked, false);
    delete f.history[0].employment_profile_schema_version;
    // A V1 employee still requires recorded daily hours in an unversioned row.
    const mixed = profile(f);
    assert.equal(mixed.history_terms_unavailable, true);
    assert.equal(mixed.mo_oron_hmerhsias_ergasias, 8);
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
    assert.equal(compatible.legacy_fallback_status, undefined);
});

test('empty unverified history still supplies deterministic execution terms and nonblocking search warnings', () => {
    const f = { employee: { employment_profile_schema_version: 1 }, history: [] };
    const resolved = profile(f);
    assert.equal(resolved.legacy_fallback_status, 'LEGACY_FALLBACK_ASSUMED');
    assert.equal(resolved.resolution_blocked, false);
    assert.equal(resolved.hmeres_ergasias_ebdomadas, 5);
    assert.equal(resolved.ores_ergasias_ebdomadas, 40);
    const warnings = [];
    const shown = require('./apasxoliseisStoredReviewReadService').resolveProfileForStoredRead(
        () => resolved, { warnings });
    assert.equal(shown, resolved);
    assert.equal(warnings.length, 1);
    for (const stage of Object.values(lifecycle({ weekRows: week(), effectiveProfile: resolved }).stages))
        assert.deepEqual(stage.blockers, []);
});

test('temporary assumptions within a week do not invent a change to verified work terms', () => {
    const assumed = profile(fixture());
    const verified = { hmeres_ergasias_ebdomadas: 6, ores_ergasias_ebdomadas: 40,
        mo_oron_hmerhsias_ergasias: 40 / 6, kathestos_apasxolhshs: '0',
        typos_apasxolhshs: '0', typos_ebdomadas: '6HMERH', source: 'ISTORIKO' };
    const result = require('./apasxoliseisWeeklyRepoTransferAuthoritativeContextService').getWeeklyRepoProfileInfo({
        week: { weekStart: new Date('2026-04-06'), weekEnd: new Date('2026-04-12') },
        resolveProfileForDate: date => new Date(date).getUTCDate() === 8 ? assumed : verified });
    assert.equal(result.expectedWeeklyRepo, 1);
    assert.equal(result.profileChangedInsideWeek, false);
    assert.equal(result.effectiveProfile.legacy_fallback_status, 'LEGACY_FALLBACK_ASSUMED');
    assert.equal(result.effectiveProfile.history_terms_unavailable, true);
});
