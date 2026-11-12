'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildWeeklyHrLifecycleProjection, resolveWeeklyAnalysisPresentationStatus } = require('./apasxoliseisWeeklyHrLifecycleProjectionService');
const { buildWeeklyHrStage2BulkPreview } = require('./apasxoliseisWeeklyHrStage2BulkPreviewService');
const { buildStage1Fingerprint } = require('./apasxoliseisStage1FingerprintService');
const { deriveStage1PeriodSlice, buildStage1PeriodSliceFingerprints } = require('./apasxoliseisStage1PeriodSliceService');
const profile = { history_terms_unavailable: true, typos_apasxolhshs: '0',
    hmeres_ergasias_ebdomadas: 5, typos_ebdomadas: '5ΗΜΕΡΗ',
    history_warning: { diagnostics: [{ code: 'EMPLOYEE_HISTORY_COVERAGE_REQUIRED',
        dates: ['2026-09-07'], evidence: { coverage_reason: 'OVERLAPPING_WORK_TERMS' } }] } };
const scope = { employee_id: 'synthetic-employee', employee_kodikos: '0039',
    week_start: '2026-09-07', week_end: '2026-09-13' };
const rows = () => Array.from({ length: 7 }, (_, i) => ({ _id: 'synthetic-' + i,
    hmeromhnia: `2026-09-${String(7 + i).padStart(2, '0')}`,
    kathgoria_ergasias: i < 5 ? 'ΕΡΓ' : 'ΑΝ', repo: i >= 5,
    kathgoria_ergasias_apologistika: i < 5 ? 'ΑΣΘΕΝΕΙΑ' : 'ΑΝ', repo_apologistika: i >= 5,
    astheneia_apologistika: i < 5, adeia: i < 5,
    kathgoria_adeias: i < 5 ? 'SYNTHETIC-MATERNITY' : '',
    ores_ergasias: i < 5 ? 8 : 0, cards_ores_ergasias: 0,
    ores_ergasias_apologistika: 0, ores_pragmatikhs_ergasias_apologistika: 0 }));
function project(weekRows, extra = {}) {
    const fingerprint = buildStage1Fingerprint(weekRows).fingerprint;
    return buildWeeklyHrLifecycleProjection({ weekRows, effectiveProfile: profile, scope,
        persistedStage1State: { status: 'COMPLETED', completion_fingerprint: fingerprint, version: 1 }, ...extra });
}
function preview(weekRows, lifecycle) {
    return buildWeeklyHrStage2BulkPreview({ contexts: [{ scope, rows: weekRows, lifecycle }] });
}
test('recorded maternity sickness and valid rest create no Stage 2/3 task or HR exception', () => {
    const weekRows = rows(), before = JSON.stringify(weekRows), p = project(weekRows);
    for (const key of ['stage2', 'stage3']) {
        assert.equal(p.stages[key].pending_count, 0);
        assert.deepEqual(p.stages[key].pending_reasons, []);
        assert.ok(p.stages[key].read_warnings.some(d => d.code === 'EMPLOYEE_HISTORY_COVERAGE_REQUIRED'));
    }
    assert.notEqual(p.stages.stage2.resolution_route, 'STAGE3_HUMAN_DECISION');
    const bulk = preview(weekRows, p);
    assert.equal(bulk.pending_scope_count, 0);
    assert.equal(bulk.manual_exception_count, 0);
    assert.equal(bulk.safe_day_change_count, 0);
    assert.equal(bulk.valid_declared_rest_count, 2);
    assert.equal(p.requires_hr_action, false);
    assert.equal(p.total_pending_count, 0);
    assert.equal(p.all_results_documented, false);
    assert.equal(p.stages.stage4.final_weekly_analysis_available, false);
    assert.notEqual(p.stages.stage4.business_status, 'COMPLETED');
    assert.equal(resolveWeeklyAnalysisPresentationStatus(p), 'PROVISIONAL');
    assert.equal(JSON.stringify(weekRows), before);
});
test('contradictory rest and unpaired cards remain real blocking diagnostics', () => {
    for (const change of [{ cards_apo_ora_01: '09:00', cards_eos_ora_01: '17:00', cards_ores_ergasias: 8 },
        { cards_apo_ora_01: '09:00', cards_eos_ora_01: '' }, { astheneia_apologistika: true }]) {
        const weekRows = rows(); Object.assign(weekRows[5], change);
        const p = project(weekRows), bulk = preview(weekRows, p);
        assert.equal(p.stages.stage2.business_status, 'BLOCKED');
        assert.ok(p.stages.stage2.pending_count > 0);
        assert.ok(p.stages.stage2.blockers.includes('REST_CLASSIFICATION_REVIEW_REQUIRED'));
        assert.ok(p.stages.stage2.diagnostics.some(d => d.dates.includes('2026-09-12')));
        assert.equal(bulk.safe_day_change_count, 0);
        assert.equal(bulk.pending_scope_count, 1);
        assert.notEqual(p.stages.stage3.business_status, 'COMPLETED');
    }
});
test('two unclassified days retain real ambiguous HR decisions with exact Stage 3 count', () => {
    const weekRows = rows();
    for (const row of weekRows.slice(4, 6)) Object.assign(row, { repo: false, repo_apologistika: false,
        astheneia_apologistika: false, adeia: false, kathgoria_adeias: '',
        kathgoria_ergasias: 'ΕΡΓ', kathgoria_ergasias_apologistika: '',
        kathgoria_adeias_apologistika: 'POSSIBLE_LEAVE', ores_ergasias: 8 });
    const p = project(weekRows), bulk = preview(weekRows, p);
    assert.equal(p.stages.stage2.resolution_route, 'STAGE3_HUMAN_DECISION');
    assert.equal(p.stages.stage3.pending_count, 2);
    assert.deepEqual(p.stages.stage3.pending_dates, ['2026-09-11', '2026-09-12']);
    assert.ok(p.stages.stage2.pending_reasons.includes('AMBIGUOUS_WEEKLY_REST_DATES'));
    assert.equal(bulk.manual_exception_count, 1);
    assert.ok(!bulk.exceptions[0].reasons.includes('EMPLOYEE_HISTORY_COVERAGE_REQUIRED'));
    assert.equal(bulk.safe_day_change_count, 0);
    assert.equal(p.stages.stage4.final_weekly_analysis_available, false);
});
test('real Stage 2 preparation failures are retained independently of history warnings', () => {
    const weekRows = rows(), p = project(weekRows, { stage2StateDiagnostic: 'STAGE2_DECISION_STATE_UNAVAILABLE' });
    assert.equal(p.stages.stage2.business_status, 'BLOCKED');
    assert.ok(p.stages.stage2.blockers.includes('STAGE2_DECISION_STATE_UNAVAILABLE'));
    assert.equal(preview(weekRows, p).technical_conflict_count, 1);
});
test('worked declared rest with a real deficit cannot disappear when no replacement date exists', () => {
    const weekRows = rows();
    Object.assign(weekRows[5], { kathgoria_ergasias_apologistika: 'ΕΡΓ', repo_apologistika: false,
        cards_apo_ora_01: '09:00', cards_eos_ora_01: '17:00', cards_ores_ergasias: 8 });
    const p = project(weekRows);
    assert.equal(p.stages.stage2.business_status, 'OPEN');
    assert.ok(p.stages.stage2.pending_reasons.includes('WORKED_DECLARED_REPO_DAYS_REQUIRE_HR_CLASSIFICATION'));
    assert.deepEqual(p.stages.stage2.pending_dates, ['2026-09-12']);
    assert.equal(preview(weekRows, p).manual_exception_count, 1);
});
test('only missing future context is harmless; a missing owned date still blocks the attested slice', () => {
    const weekRows = rows().slice(0, 3).map((row, i) => ({ ...row, hmeromhnia: `2026-09-${28 + i}` }));
    const boundary = { ...scope, week_start: '2026-09-28', week_end: '2026-10-04' };
    const periodScope = { period_start: '2026-09-01', period_end: '2026-09-30' };
    const slice = deriveStage1PeriodSlice({ ...boundary, ...periodScope, weekRows, require_complete_slice: true });
    const fp = buildStage1PeriodSliceFingerprints({ weekRows, slice });
    const input = { scope: boundary, periodScope, stage2StateDiagnostic: 'INCOMPLETE_EMPLOYEE_WEEK',
        persistedStage1State: { status: 'OPEN', period_slices: [{ ...slice, status: 'COMPLETED', ...fp }] } };
    const complete = project(weekRows, input);
    assert.equal(complete.stages.stage1.persisted_status, 'COMPLETED');
    assert.equal(complete.stages.stage2.pending_count, 0);
    const missing = project([weekRows[0], weekRows[2]], input);
    assert.equal(missing.stages.stage1.persisted_status, 'STALE');
    assert.equal(missing.stages.stage2.business_status, 'BLOCKED');
    assert.ok(missing.stages.stage2.blockers.includes('INCOMPLETE_NATURAL_WEEK'));
    assert.ok(missing.stages.stage2.blockers.includes('INCOMPLETE_EMPLOYEE_WEEK'));
});
