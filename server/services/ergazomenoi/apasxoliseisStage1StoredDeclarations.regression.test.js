'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildWeeklyHrLifecycleProjection: lifecycle } = require('./apasxoliseisWeeklyHrLifecycleProjectionService');
const { buildWeeklyHrWorkflowProjection: projection } = require('./apasxoliseisWeeklyHrWorkflowProjectionService');
const { buildStage1Fingerprint } = require('./apasxoliseisStage1FingerprintService');
const { deriveEmploymentOwnedDateScope } = require('./apasxoliseisEmploymentPeriodScopeService');
const { deriveStage1PeriodSlice, buildStage1PeriodSliceFingerprints } = require('./apasxoliseisStage1PeriodSliceService');
const { buildStage3InputFingerprint } = require('./apasxoliseisStage3FingerprintService');
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

function boundaryInput(start, period) {
    const dates = Array.from({ length: 7 }, (_, i) => new Date(Date.parse(start) + i * 86400000).toISOString().slice(0, 10));
    const scope = { team: 'TEST', company_kod: 'synthetic', ypokatasthma: '0000', employee_id: 'synthetic-employee',
        employee_kodikos: 'TEST', week_start: dates[0], week_end: dates[6] };
    const rows = dates.map((date, i) => ({ ...scope, _id: 'synthetic-row-' + i, hmeromhnia: date,
        kathgoria_ergasias: i < 5 ? 'ΕΡΓ' : 'ΑΝ', repo: i >= 5,
        kathgoria_ergasias_apologistika: i < 5 ? '' : 'ΑΝ', repo_apologistika: i >= 5,
        ores_ergasias: i < 5 ? 8 : 0, cards_ores_ergasias: 0, ores_ergasias_apologistika: 0,
        astheneia_apologistika: false, adeia_apologistika: false, apousia_apologistika: false,
        kathgoria_adeias_apologistika: i < 5 ? 'POSSIBLE_LEAVE' : '' }));
    return { scope, weekRows: rows, effectiveProfile: profile, periodScope: period,
        employmentDateScope: deriveEmploymentOwnedDateScope({ natural_week_start: dates[0], natural_week_end: dates[6], ...period }) };
}
function completedBoundary() {
    const input = boundaryInput('2026-08-31', { period_start: '2026-09-01', period_end: '2026-09-30' });
    const slice = deriveStage1PeriodSlice({ weekRows: input.weekRows, ...input.scope, ...input.periodScope,
        employment_date_scope: input.employmentDateScope });
    const fingerprints = buildStage1PeriodSliceFingerprints({ weekRows: input.weekRows, slice });
    input.persistedStage1State = { status: 'OPEN', version: 8, period_slices: [{ ...slice, ...fingerprints,
        status: 'COMPLETED', effective_fingerprint: fingerprints.completion_fingerprint, version: 3 }] };
    return input;
}
test('legacy boundary exposes the persisted slice metadata used by downstream writes', () => {
    const input = completedBoundary(), stage = lifecycle(input).stages.stage1;
    const persisted = input.persistedStage1State.period_slices[0];
    assert.equal(stage.business_status, 'COMPLETED');
    assert.equal(stage.period_slice.completion_fingerprint, persisted.completion_fingerprint);
    assert.equal(stage.period_slice.effective_fingerprint, persisted.effective_fingerprint);
    assert.equal(stage.period_slice.version, 3);
});
for (const mixed of [false, true]) test(`legacy boundary Stage3 fingerprint matches controller context (automatic non-work=${mixed})`, () => {
    const input = completedBoundary();
    if (mixed) input.effectiveProfilesByDate = { '2026-09-02': { ...profile,
        kathestos_apasxolhshs: '2', typos_apasxolhshs: '2' } };
    const result = lifecycle(input), first = result.stages.stage1, third = result.stages.stage3;
    assert.equal(third.stage2_automatic_resolved_dates.length, mixed ? 1 : 0);
    const pending = third.pending_items[0];
    assert.ok(pending);
    const expected = buildStage3InputFingerprint({ scope: input.scope,
        row: input.weekRows.find(row => String(row._id) === pending.row_id), dailyProfile: profile, isResidual: true,
        stage2: { fingerprint: third.stage2_fingerprint, status: third.stage2_status,
            resolution: third.stage2_resolution, resolved_dates: third.stage2_automatic_resolved_dates },
        upstream: { stage1_attestation_scope: first.attestation_scope,
            stage1_period_start: first.period_slice?.period_start || '', stage1_period_end: first.period_slice?.period_end || '',
            stage1_context_fingerprint: first.current_context_fingerprint, stage1_current_fingerprint: first.current_completion_fingerprint,
            stage1_completion_fingerprint: first.period_slice?.completion_fingerprint || input.persistedStage1State.completion_fingerprint || '',
            stage1_effective_fingerprint: first.period_slice?.effective_fingerprint || first.period_slice?.completion_fingerprint ||
                input.persistedStage1State.effective_fingerprint || input.persistedStage1State.completion_fingerprint || '',
            stage1_version: first.period_slice?.version || input.persistedStage1State.version || 0,
            stage2_fingerprint: third.stage2_fingerprint, stage2_version: 0 } });
    assert.equal(pending.input_fingerprint, expected.fingerprint);
});
test('legacy trailing week can be read before next-month rows exist', () => {
    const input = boundaryInput('2026-09-28', { period_start: '2026-09-01', period_end: '2026-09-30' });
    input.weekRows = input.weekRows.slice(0, 3);
    const before = JSON.stringify(input);
    const result = lifecycle(input);
    assert.equal(result.read_only, true);
    assert.equal(result.history_pending, true);
    assert.equal(result.all_results_documented, false);
    assert.equal(JSON.stringify(input), before);
});

test('legacy leading-week reads tolerate partial stored rows while completion remains strict', () => {
    const input = boundaryInput('2026-08-31', { period_start: '2026-09-01', period_end: '2026-09-30' });
    input.weekRows = [input.weekRows[2]];
    const before = JSON.stringify(input);
    const result = lifecycle(input);
    assert.equal(result.read_only, true);
    assert.equal(result.history_pending, true);
    assert.equal(result.all_results_documented, false);
    assert.notEqual(result.stages.stage1.business_status, 'COMPLETED');
    assert.equal(JSON.stringify(input), before);
    assert.throws(() => deriveStage1PeriodSlice({ weekRows: input.weekRows, ...input.scope,
        ...input.periodScope, employment_date_scope: input.employmentDateScope }), { code: 'INCOMPLETE_NATURAL_WEEK' });
});

test('legacy slice rejects a changed previous-month context and an attestation from another period', () => {
    const input = completedBoundary();
    input.weekRows[0].astheneia_apologistika = true;
    let stage = lifecycle(input).stages.stage1;
    assert.equal(stage.persisted_status, 'STALE');
    assert.notEqual(stage.business_status, 'COMPLETED');
    assert.ok(stage.pending_count > 0);
    const other = completedBoundary();
    other.persistedStage1State.period_slices[0].period_start = '2026-08-01';
    other.persistedStage1State.period_slices[0].period_end = '2026-08-31';
    stage = lifecycle(other).stages.stage1;
    assert.equal(stage.persisted_status, 'OPEN');
    assert.notEqual(stage.business_status, 'COMPLETED');
});
