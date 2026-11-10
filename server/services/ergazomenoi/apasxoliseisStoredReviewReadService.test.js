'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { projectStoredFrozenReview, projectStoredDraftReview, resolveProfileForStoredRead } = require('./apasxoliseisStoredReviewReadService');
const { assertVerifiedHistoryCoverageForDate } = require('../../utils/ergazomenoi/employmentHistoryCoverage');
const { resolveEffectiveEmploymentProfileForReviewDate } = require('./apasxoliseisBorrowedEmploymentProfileResolverService');

const scope = { team: 'synthetic', company_kod: 'company-A', ypokatasthma: '0000',
    period_start: '2026-09-01', period_end: '2026-09-30' };
function fixture(version = 3) {
    return { snapshot_schema_version: 'employment-period-frozen:v' + version, scope,
        employees: [{ _id: 'employee-A', kodikos: '001', eponymo: 'Συνθετικός', hmeromhnia_proslhpshs: '2026-01-01' },
            { _id: 'employee-B', kodikos: '002', hmeromhnia_proslhpshs: '2026-09-01', hmeromhnia_apoxorhshs: '2026-09-15' }],
        daily_results: ['001', '002'].map((code, index) => ({ _id: 'row-' + code,
            kodikos: code, ypokatasthma: '0000', hmeromhnia: '2026-09-02',
            kathgoria_ergasias: 'ΕΡΓ', ores_ergasias: 8,
            ores_ergasias_apologistika: 6.37 + index, cards_ores_ergasias: 9,
            cards_apo_ora_01: '08:00', cards_eos_ora_01: '17:00',
            repo_apologistika: false, is_locked: true,
            compensation_breakdown_apologistika: { hours: { sixthDayHours: 1.37 } },
            effective_profile_resolved: { hmeres_ergasias_ebdomadas: 5 } })),
        canonical_decisions: [{ _id: 'decision', decision_payload: { keep: true } }],
        applied_repo_transfers: [{ _id: 'transfer', after_snapshot: { keep: true } }],
        deviations: [{ kodikos: '001', status: 'STORED_ONLY' }], payroll_results: [{ plhroteo: 123.45 }],
        old_submissions: [{ protocol: 'unchanged' }] };
}
function freeze(value) { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }

for (const version of [1, 2, 3]) test(`v${version}: immutable saved values, all employees, decisions, four stages and export metadata`, () => {
    const snapshot = freeze(fixture(version)); const before = JSON.stringify(snapshot);
    const result = projectStoredFrozenReview({ snapshot, scope });
    assert.equal(result.rows.length, 2);
    for (const source of snapshot.daily_results) {
        const projected = result.rows.find(row => row._id === source._id);
        for (const field of Object.keys(source)) assert.deepEqual(projected[field], source[field]);
    }
    assert.deepEqual(result.canonical_decisions, snapshot.canonical_decisions);
    assert.deepEqual(result.applied_repo_transfers, snapshot.applied_repo_transfers);
    assert.deepEqual(result.payroll_results, snapshot.payroll_results);
    assert.equal(result.rows.__lifecycleByWeek.size, 2);
    for (const payload of result.payloads) {
        assert.equal(payload.write_enabled, false);
        assert.deepEqual(payload.employment_date_scope, payload.lifecycle_projection.employment_date_scope);
        assert.equal(Object.keys(payload.lifecycle_projection.stages).length, 4);
        assert.equal(payload.lifecycle_projection.stages.stage4.analysis_presentation_status, 'FINAL');
    }
    result.rows[0].compensation_breakdown_apologistika.hours.sixthDayHours = 999;
    assert.equal(JSON.stringify(snapshot), before);
});

test('company, branch, employee and date filters isolate the stored source', () => {
    const snapshot = fixture();
    snapshot.daily_results.push({ ...snapshot.daily_results[0], _id: 'other-branch', ypokatasthma: '0001' },
        { ...snapshot.daily_results[0], _id: 'other-company', company_kod: 'company-B' });
    assert.deepEqual(projectStoredFrozenReview({ snapshot, scope, kodikos: '002' }).rows.map(row => row._id), ['row-002']);
    assert.equal(projectStoredFrozenReview({ snapshot, scope, from: '2026-09-03' }).rows.length, 0);
});

test('missing, malformed or unsupported snapshots fail closed; an empty valid snapshot is readable', () => {
    for (const snapshot of [null, {}, { snapshot_schema_version: 'employment-period-frozen:v3' }])
        assert.throws(() => projectStoredFrozenReview({ snapshot, scope }), { code: 'FINALIZED_SNAPSHOT_MISSING' });
    assert.throws(() => projectStoredFrozenReview({ snapshot: { ...fixture(), snapshot_schema_version: 'future:v99' }, scope }),
        { code: 'FINALIZED_SNAPSHOT_VERSION_UNSUPPORTED' });
    assert.equal(projectStoredFrozenReview({ snapshot: { ...fixture(), daily_results: [] }, scope }).rows.length, 0);
});

test('new hire, departure, rehire and borrowing data never authorize a current-history read', () => {
    for (const employee of [
        { hmeromhnia_proslhpshs: '2026-09-02' },
        { hmeromhnia_proslhpshs: '2026-01-01', hmeromhnia_apoxorhshs: '2026-09-02' },
        { hmeromhnia_proslhpshs: '2026-10-01' },
        { afora_daneismo_ergazomenoy: true, typos_ergodoth_daneismoy: false }
    ]) {
        const snapshot = fixture(); Object.assign(snapshot.employees[0], employee);
        assert.equal(projectStoredFrozenReview({ snapshot, scope }).rows[0].ores_ergasias_apologistika, 6.37);
    }
});

test('trailing week remains deferred without rerunning classification', () => {
    const snapshot = fixture(); snapshot.daily_results = [{ ...snapshot.daily_results[0], hmeromhnia: '2026-09-30' }];
    const result = projectStoredFrozenReview({ snapshot, scope });
    assert.equal(result.payloads[0].lifecycle_projection.stages.stage4.business_status, 'DEFERRED_TO_NEXT_PERIOD');
    assert.equal(result.rows[0].ores_ergasias_apologistika, 6.37);
});

test('draft read keeps all employees and history is nonblocking while the strict verifier remains available', () => {
    const employee = { kodikos: '001', hmeromhnia_proslhpshs: '2026-01-01',
        employment_profile_schema_version: 1, hmeromhnia_isxyos_oron_ergasias_apo: '2026-01-01' };
    const strict = () => resolveEffectiveEmploymentProfileForReviewDate({ reviewDate: '2026-09-02', normalEmployee: employee, normalHistory: [] });
    assert.equal(strict().history_terms_unavailable, true);
    const warnings = [];
    assert.equal(resolveProfileForStoredRead(strict, { employeeKodikos: '001', warnings }).resolution_blocked, false);
    const rows = fixture().daily_results; const before = JSON.stringify(rows);
    const result = projectStoredDraftReview({ rows, scope, warnings });
    assert.equal(result.rows.length, 2);
    assert.equal(result.read_warnings.length, 1);
    assert.equal(result.payloads[0].lifecycle_projection.stages.stage1.business_status, 'OPEN');
    assert.equal(result.rows[0].ores_ergasias_apologistika, 6.37);
    assert.equal(JSON.stringify(rows), before);
    assert.throws(() => assertVerifiedHistoryCoverageForDate('2026-09-02', [], employee), { code: 'EMPLOYEE_HISTORY_COVERAGE_REQUIRED' });
    assert.equal(strict().history_terms_unavailable, true);
    assert.equal(projectStoredDraftReview({ rows: [], scope, warnings: [] }).rows.length, 0);
});

test('presentation tolerates coverage errors only, never authorization or unrelated failures', () => {
    const error = Object.assign(new Error('scope'), { code: 'PERIOD_CONTROL_SCOPE_FORBIDDEN', statusCode: 403 });
    assert.throws(() => resolveProfileForStoredRead(() => { throw error; }), error);
});

for (const [label, date, facts, owned, authoritative, context] of [
    ['hire and departure', '2026-09-11', {
        hmeromhnia_proslhpshs: '2026-09-10', hmeromhnia_apoxorhshs: '2026-09-12'
    }, ['2026-09-10', '2026-09-11', '2026-09-12']],
    ['rehire gap', '2026-09-11', {
        hmeromhnia_proslhpshs: '2026-09-11', employment_history: [
            { hmeromhnia_proslhpshs: '2026-09-01', hmeromhnia_apoxorhshs: '2026-09-08' },
            { hmeromhnia_proslhpshs: '2026-09-11' }]
    }, ['2026-09-07', '2026-09-08', '2026-09-11', '2026-09-12', '2026-09-13']],
    ['lending employer', '2026-09-08', {
        afora_daneismo_ergazomenoy: true, typos_ergodoth_daneismoy: false,
        hmnia_enarxhs_daneismoy: '2026-09-09', hmnia_lhxhs_daneismoy: '2026-09-11'
    }, ['2026-09-07', '2026-09-08', '2026-09-12', '2026-09-13']],
    ['borrowing employer', '2026-09-10', {
        afora_daneismo_ergazomenoy: true, typos_ergodoth_daneismoy: true,
        hmnia_enarxhs_daneismoy: '2026-09-09', hmnia_lhxhs_daneismoy: '2026-09-11'
    }, ['2026-09-09', '2026-09-10', '2026-09-11']],
    ['leading boundary', '2026-09-02', {},
        ['2026-08-31', '2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05', '2026-09-06'],
        ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05', '2026-09-06'], ['2026-08-31']],
    ['trailing boundary', '2026-09-30', {},
        ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'],
        ['2026-09-28', '2026-09-29', '2026-09-30'], ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']]
]) test(`stored draft date scope preserves ${label} with nonblocking legacy history`, () => {
    const employee = { _id: 'employee-A', kodikos: '001', ypokatasthma: '0000',
        hmeromhnia_proslhpshs: '2026-01-01', ...facts };
    const rows = freeze([{ ...fixture().daily_results[0], hmeromhnia: date }]);
    const employees = freeze([{ ...employee, _id: 'foreign', ypokatasthma: '0001',
        hmeromhnia_proslhpshs: '2026-10-01' }, employee]);
    const before = JSON.stringify({ rows, employees });
    const result = projectStoredDraftReview({ rows, scope, employees,
        warnings: [{ employee_kodikos: '001', code: 'EMPLOYEE_HISTORY_COVERAGE_REQUIRED', diagnostics: [] }] });
    const payload = result.payloads[0], dates = payload.employment_date_scope;
    assert.equal(payload.scope.employee_id, employee._id);
    assert.deepEqual(dates.employment_owned_dates, owned);
    assert.deepEqual(dates.authoritative_date_set, authoritative || owned);
    assert.deepEqual(dates.context_only_dates, context || []);
    assert.deepEqual(payload.lifecycle_projection.employment_date_scope, dates);
    assert.deepEqual(result.canonicalLifecycleProjections[0].lifecycle_projection.employment_date_scope, dates);
    assert.equal(payload.lifecycle_projection.stages.stage1.business_status, 'OPEN');
    assert.equal(payload.write_enabled, false);
    assert.equal(payload.rows[0].ores_ergasias_apologistika, 6.37);
    assert.equal(JSON.stringify({ rows, employees }), before);
});

test('draft without lifecycle evidence retains its employee identity and never uses a daily row id', () => {
    const result = projectStoredDraftReview({ rows: [fixture().daily_results[0]], scope });
    assert.equal(result.payloads[0].scope.employee_id, '');
    assert.equal(result.payloads[0].employment_date_scope.authoritative_date_set.length, 6);
});

test('coverage diagnostics survive stored Stage 1 with exact dates and no employee/history payload', () => {
    const { historyCoverageError } = require('../../utils/ergazomenoi/employmentHistoryCoverage');
    const warnings = [];
    for (const date of ['2026-09-02', '2026-09-03', '2026-09-09']) {
        const error = historyCoverageError([{ from: date, to: date, reason: 'OVERLAPPING_WORK_TERMS',
            matchingProfileCount: 2, beforeHistoryId: 'SECRET-ID', afm: 'SECRET-AFM', employee: { onoma: 'SECRET-NAME' } }], date);
        resolveProfileForStoredRead(() => { throw error; }, { employeeKodikos: '001', warnings });
    }
    const result = projectStoredDraftReview({ rows: [fixture().daily_results[0],
        { ...fixture().daily_results[0], hmeromhnia: '2026-09-09' }], scope, warnings });
    assert.equal(warnings.length, 1);
    assert.equal(result.payloads.length, 2);
    for (const [i, expected] of [['2026-09-02', '2026-09-03'], ['2026-09-09']].entries()) {
        const payload = result.payloads[i], stage1 = payload.lifecycle_projection.stages.stage1;
        assert.equal(stage1.business_status, 'OPEN');
        assert.equal(payload.write_enabled, false);
        assert.deepEqual(stage1.diagnostics[0].dates, expected);
        assert.equal(stage1.diagnostics[0].evidence.coverage_reason, 'OVERLAPPING_WORK_TERMS');
        assert.equal(stage1.diagnostics[0].evidence.matching_profile_count, 2);
        assert.deepEqual(payload.workflow.history_diagnostics, stage1.diagnostics);
        assert.deepEqual(stage1.blockers, []);
        assert.doesNotMatch(JSON.stringify(stage1.diagnostics), /SECRET|afm|employee|HistoryId/);
    }
});

module.exports = { fixture, scope };
