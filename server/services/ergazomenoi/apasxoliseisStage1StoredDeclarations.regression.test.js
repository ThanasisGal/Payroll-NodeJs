'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildWeeklyHrLifecycleProjection: lifecycle } = require('./apasxoliseisWeeklyHrLifecycleProjectionService');
const { buildWeeklyHrWorkflowProjection: projection } = require('./apasxoliseisWeeklyHrWorkflowProjectionService');
const { buildStage1Fingerprint } = require('./apasxoliseisStage1FingerprintService');
const ui = require('../../../public/js/ergazomenoi/programmata/employmentReviewGuidanceUi');
const profile = { history_terms_unavailable: true, resolution_source: 'LEGACY_HISTORY_UNAVAILABLE',
    legacy_fallback_status: 'LEGACY_FALLBACK_ASSUMED', typos_apasxolhshs: '0', typos_ebdomadas: '5ΗΜΕΡΗ',
    hmeres_ergasias_ebdomadas: 5, ores_ergasias_ebdomadas: 40,
    history_warning: { code: 'EMPLOYEE_HISTORY_COVERAGE_REQUIRED', diagnostics: [
        { code: 'EMPLOYEE_HISTORY_COVERAGE_REQUIRED', dates: ['2026-09-07'], evidence: { coverage_reason: 'OVERLAPPING_WORK_TERMS' } }] } };
const rowsFor = classification => Array.from({ length: 7 }, (_, i) => ({
    _id: 'synthetic-declaration-' + i, hmeromhnia: `2026-09-${String(i + 7).padStart(2, '0')}`,
    kathgoria_ergasias: i < 5 ? 'ΕΡΓ' : 'ΑΝ', repo: i >= 5,
    kathgoria_ergasias_apologistika: i < 5 ? classification : 'ΑΝ', repo_apologistika: i >= 5,
    ores_ergasias: i < 5 ? 8 : 0, cards_ores_ergasias: 0,
    ores_ergasias_apologistika: 0,
    adeia_apologistika: i < 5 && classification === 'ΑΔΕΙΑ',
    kathgoria_adeias_apologistika: i < 5 && classification === 'ΑΔΕΙΑ' ? 'ΑΔΚΑΝ' : '',
    astheneia_apologistika: i < 5 && classification === 'ΑΣΘΕΝΕΙΑ',
    apousia_apologistika: i < 5 && classification === 'ΑΠΟΥΣΙΑ',
    // A registered maternity leave is already represented as sickness by the existing application.
    ...(i < 5 && classification === 'ΑΣΘΕΝΕΙΑ' ? { adeia: true, kathgoria_adeias: 'ΣΥΝΘΕΤΙΚΗ_ΜΗΤΡΟΤΗΤΑ' } : {})
}));
for (const [classification, field] of [['ΑΔΕΙΑ', 'confirmed_leave_dates'], ['ΑΣΘΕΝΕΙΑ', 'confirmed_sickness_dates'], ['ΑΠΟΥΣΙΑ', 'confirmed_absence_dates']]) {
    test(`stored ${classification}: daily declaration survives; only weekly attestation is pending`, () => {
        const rows = rowsFor(classification), before = JSON.stringify(rows);
        const input = { weekRows: rows, effectiveProfile: profile };
        const p = projection(input), result = lifecycle(input), stage = result.stages.stage1;
        assert.equal(p[field].length, 5);
        assert.equal(stage.business_status, 'OPEN');
        assert.deepEqual(stage.pending_dates, []);
        assert.deepEqual(stage.blockers, []);
        assert.deepEqual(stage.pending_reasons, ['STAGE1_WEEKLY_CONFIRMATION_REQUIRED']);
        assert.equal(stage.pending_count, 1);
        assert.equal(stage.history_pending, true);
        assert.equal(result.all_results_documented, false);
        const payload = { ...p, rows, lifecycle_projection: result };
        const html = ui.detailHtml({ payload, stage: 'STAGE1', date: null, issues: ui.issues(payload) });
        assert.match(html, new RegExp(classification));
        assert.match(html, /εβδομαδιαί/);
        assert.match(html, /δεν απαιτείται επαναχαρακτηρισμός/);
        assert.equal(JSON.stringify(rows), before);
    });
}
test('a real persisted weekly confirmation clears Stage1 pending count without cleaning history', () => {
    const rows = rowsFor('ΑΣΘΕΝΕΙΑ');
    const result = lifecycle({ weekRows: rows, effectiveProfile: profile,
        persistedStage1State: { status: 'COMPLETED', completion_fingerprint: buildStage1Fingerprint(rows).fingerprint } });
    assert.equal(result.stages.stage1.business_status, 'COMPLETED');
    assert.equal(result.stages.stage1.pending_count, 0);
    assert.deepEqual(result.stages.stage1.pending_reasons, []);
    assert.equal(result.history_pending, true);
    assert.equal(result.all_results_documented, false);
});
test('actual contradictions and missing required daily values still block Stage1', () => {
    for (const change of [{ repo_apologistika: true }, { ores_ergasias: -1 }]) {
        const rows = rowsFor('ΑΣΘΕΝΕΙΑ'); Object.assign(rows[0], change);
        const stage = lifecycle({ weekRows: rows, effectiveProfile: profile }).stages.stage1;
        assert.equal(stage.business_status, 'BLOCKED');
        assert.ok(stage.blockers.length > 0);
        assert.ok(!stage.blockers.includes('EMPLOYEE_HISTORY_COVERAGE_REQUIRED'));
    }
});
test('recorded rest and maternity label are distinguished; period restrictions are independent', () => {
    const rows = rowsFor('ΑΣΘΕΝΕΙΑ'), result = lifecycle({ weekRows: rows, effectiveProfile: profile });
    const target = { payload: { rows, lifecycle_projection: result }, stage: 'STAGE1',
        leaveCategories: [{ value: 'ΣΥΝΘΕΤΙΚΗ_ΜΗΤΡΟΤΗΤΑ', label: 'Άδεια μητρότητας' }],
        issues: ui.issues({ lifecycle_projection: result }), periodMode: 'FINALIZED', periodLabel: 'Οριστικοποιημένη περίοδος' };
    const html = ui.detailHtml(target);
    assert.match(html, /Άδεια μητρότητας/);
    assert.match(html, /ΡΕΠΟ: 12\/09\/2026, 13\/09\/2026/);
    assert.match(html, /Ανεξάρτητη κατάσταση περιόδου/);
    assert.match(html, /Οριστικοποιημένη περίοδος/);
    assert.match(ui.detailHtml({ ...target, periodMode: 'HISTORICAL_RECONSTRUCTION_REQUIRED',
        periodLabel: 'Εκπρόθεσμη περίοδος' }), /Εκπρόθεσμη περίοδος/);
});
test('legacy history respects a real period-slice confirmation and detects changed daily declarations', () => {
    const { deriveStage1PeriodSlice, buildStage1PeriodSliceFingerprints } = require('./apasxoliseisStage1PeriodSliceService');
    const rows = rowsFor('ΑΣΘΕΝΕΙΑ');
    const scope = { week_start: '2026-09-07', week_end: '2026-09-13' };
    const periodScope = { period_start: '2026-09-08', period_end: '2026-09-30' };
    const slice = deriveStage1PeriodSlice({ weekRows: rows, ...scope, ...periodScope });
    const fingerprints = buildStage1PeriodSliceFingerprints({ weekRows: rows, slice });
    const state = { period_slices: [{ ...slice, ...fingerprints, status: 'COMPLETED' }] };
    const input = { weekRows: rows, effectiveProfile: profile, scope, periodScope, persistedStage1State: state };
    const stage = lifecycle(input).stages.stage1;
    assert.equal(stage.business_status, 'COMPLETED');
    assert.equal(stage.attestation_scope, 'PERIOD_SLICE');
    assert.equal(stage.pending_count, 0);
    assert.equal(lifecycle({ ...input, persistedStage1State: null }).stages.stage1.business_status, 'OPEN');
    rows[2].astheneia_apologistika = false;
    assert.notEqual(lifecycle(input).stages.stage1.business_status, 'COMPLETED');
});
