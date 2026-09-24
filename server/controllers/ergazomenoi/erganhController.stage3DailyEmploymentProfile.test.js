'use strict';

const assert = require('node:assert/strict');
const Controller = require('./erganhController');
const { getDailyRepoProfileInfo } = require(
    '../../services/ergazomenoi/apasxoliseisWeeklyRepoTransferAuthoritativeContextService');
const { buildWeeklyHrLifecycleProjection } = require(
    '../../services/ergazomenoi/apasxoliseisWeeklyHrLifecycleProjectionService');
const { buildStage3InputFingerprint } = require(
    '../../services/ergazomenoi/apasxoliseisStage3FingerprintService');
const { resolveNoWorkCandidateForDate } = require(
    '../../services/ergazomenoi/apasxoliseisWeeklyHrWorkflowResolverService');

const { prepareWeeklyHrStage2LifecycleRow, weeklyHrStage2LifecycleProfileFromRow,
    resolveWeeklyHrSearchDailyProfile } = Controller.__stage3DailyEmploymentProfileTestHooks;

const acceptance0031 = prepareWeeklyHrStage2LifecycleRow({
    row: { hmeromhnia: '2026-08-05', kathgoria_ergasias: 'ΕΡΓ',
        ores_ergasias: 5, apo_ora_01: '10:00', eos_ora_01: '15:00' },
    effectiveProfile: { kathestos_apasxolhshs: '0', typos_apasxolhshs: '0',
        hmeres_ergasias_ebdomadas: 6, ores_ergasias_ebdomadas: 40,
        mo_oron_hmerhsias_ergasias: 40 / 6, source: 'DATE_EFFECTIVE_HISTORY' },
    reviewPhaseCode: '1'
});
assert.equal(acceptance0031.effective_is_full_time, true);
assert.equal(acceptance0031.effective_kathestos_apasxolhshs, '0');
assert.equal(acceptance0031.effective_typos_apasxolhshs, '0');
assert.equal(acceptance0031.effective_schedule_phase_code, '1');
assert.equal(acceptance0031.effective_profile_source, 'DATE_EFFECTIVE_HISTORY');
assert.equal(resolveNoWorkCandidateForDate({ date: '2026-08-05',
    effectiveProfilesByDate: { '2026-08-05':
        weeklyHrStage2LifecycleProfileFromRow(acceptance0031) } }).candidate_kind, 'REST_REPO');

function dateAt(start, offset) {
    const value = new Date(`${start}T00:00:00.000Z`);
    value.setUTCDate(value.getUTCDate() + offset);
    return value.toISOString().slice(0, 10);
}

function week(start, code) {
    return Array.from({ length: 7 }, (_, index) => ({
        _id: `${code}-${index}`, team: 'THA', company_kod: 'company',
        ypokatasthma: '0000', kodikos: code, hmeromhnia: dateAt(start, index),
        kathgoria_ergasias: 'ΕΡΓ', kathgoria_ergasias_apologistika: 'ΕΡΓ',
        ores_ergasias: 8, ores_ergasias_apologistika: 8,
        apo_ora_01: '12:30', eos_ora_01: '20:30',
        cards_ores_ergasias: 8, cards_apo_ora_01: '12:30', cards_eos_ora_01: '20:30',
        repo: false, repo_apologistika: false, adeia_apologistika: false,
        astheneia_apologistika: false, apousia_apologistika: false,
        kathgoria_adeias_apologistika: ''
    }));
}

function possibleLeave(row) {
    return { ...row, kathgoria_ergasias_apologistika: '', ores_ergasias_apologistika: 0,
        cards_ores_ergasias: 0, cards_apo_ora_01: '', cards_eos_ora_01: '',
        kathgoria_adeias_apologistika: 'POSSIBLE_LEAVE' };
}

function resolvedDailyProfiles(rows, employee, history) {
    return Object.fromEntries(rows.map((row) => {
        const authoritative = getDailyRepoProfileInfo({
            row, istorikoRows: history, ergazomenos: employee
        }).profile;
        const searchResolved = resolveWeeklyHrSearchDailyProfile({
            row, employee, istorikoRows: history
        });
        const prepared = prepareWeeklyHrStage2LifecycleRow({
            row, effectiveProfile: searchResolved, reviewPhaseCode: '0'
        });
        assert.equal(prepared.effective_profile_source,
            searchResolved.resolution_source || searchResolved.source || '');
        assert.equal(prepared.effective_daily_employment_source,
            authoritative.daily_employment_snapshot_source);
        return [row.hmeromhnia, {
            authoritative,
            search: weeklyHrStage2LifecycleProfileFromRow(prepared)
        }];
    }));
}

function assertDailyMaterialEquivalent(searchContext, authoritativeContext) {
    const search = buildStage3InputFingerprint(searchContext);
    const authoritative = buildStage3InputFingerprint(authoritativeContext);
    assert.deepEqual(search.material.daily_employment,
        authoritative.material.daily_employment);
    assert.deepEqual(search.material, authoritative.material);
    assert.equal(search.fingerprint, authoritative.fingerprint);
    return search;
}

function baseFingerprintContext({ row, dailyProfile, start, stage2Version = 0,
    resolvedDates = [] }) {
    return {
        scope: { team: 'THA', company_kod: 'company', ypokatasthma: '0000',
            employee_id: 'employee', employee_kodikos: row.kodikos,
            week_start: start, week_end: dateAt(start, 6) },
        row, dailyProfile, isResidual: true,
        stage2: { fingerprint: 'a'.repeat(64), status: 'COMPLETED',
            resolution: 'NOT_APPLICABLE', resolved_dates: resolvedDates },
        upstream: { stage1_current_fingerprint: 'b'.repeat(64),
            stage1_completion_fingerprint: 'b'.repeat(64),
            stage1_effective_fingerprint: 'b'.repeat(64), stage1_version: 1,
            stage2_fingerprint: 'a'.repeat(64), stage2_version: stage2Version }
    };
}

const employee = { kodikos: '0007', kathestos_apasxolhshs: '0',
    hmeres_ergasias_ebdomadas: 5 };

for (const fixture of [
    { label: 'normal week', start: '2026-05-04', effectiveFrom: '2026-04-27',
        stage2Version: 0, resolvedDates: [] },
    { label: 'persisted Stage 2 and automatic resolutions', start: '2026-05-11',
        effectiveFrom: '2026-04-27', stage2Version: 4,
        resolvedDates: ['2026-05-12'] }
]) {
    const rows = week(fixture.start, `0007-${fixture.start}`);
    const history = [{ _id: `terms-${fixture.start}`, afora_allagh_oron_ergasias: true,
        hmeromhnia_isxyos_oron_ergasias_apo: fixture.effectiveFrom,
        kathestos_apasxolhshs: '0', hmeres_ergasias_ebdomadas: 5 }];
    const profiles = resolvedDailyProfiles(rows, employee, history);
    const selected = rows[2];
    const common = { row: selected, start: fixture.start,
        stage2Version: fixture.stage2Version, resolvedDates: fixture.resolvedDates };
    assertDailyMaterialEquivalent(
        baseFingerprintContext({ ...common, dailyProfile: profiles[selected.hmeromhnia].search }),
        baseFingerprintContext({ ...common,
            dailyProfile: profiles[selected.hmeromhnia].authoritative })
    );
}

const boundaryRows = week('2026-04-27', '0007');
for (const index of [0, 1]) Object.assign(boundaryRows[index], {
    kathgoria_ergasias: 'ΑΝ', kathgoria_ergasias_apologistika: 'ΑΝ',
    ores_ergasias: 0, ores_ergasias_apologistika: 0, apo_ora_01: '', eos_ora_01: '',
    cards_ores_ergasias: 0, cards_apo_ora_01: '', cards_eos_ora_01: '',
    repo: true, repo_apologistika: true
});
for (const index of [5, 6]) boundaryRows[index] = possibleLeave(boundaryRows[index]);
const boundaryHistory = [{ _id: 'terms-2026-04-27', afora_allagh_oron_ergasias: true,
    hmeromhnia_isxyos_oron_ergasias_apo: '2026-04-27',
    kathestos_apasxolhshs: '0', hmeres_ergasias_ebdomadas: 5 }];
const boundaryProfiles = resolvedDailyProfiles(boundaryRows, employee, boundaryHistory);
const searchProfiles = Object.fromEntries(Object.entries(boundaryProfiles)
    .map(([date, value]) => [date, value.search]));
const boundaryScope = { team: 'THA', company_kod: 'company', ypokatasthma: '0000',
    employee_id: 'employee', employee_kodikos: '0007',
    week_start: '2026-04-27', week_end: '2026-05-03' };
const boundaryPeriod = { period_start: '2026-05-01', period_end: '2026-05-31' };
const initialBoundary = buildWeeklyHrLifecycleProjection({ weekRows: boundaryRows,
    effectiveProfile: searchProfiles['2026-05-03'], effectiveProfilesByDate: searchProfiles,
    scope: boundaryScope, periodScope: boundaryPeriod });
const slice = initialBoundary.stages.stage1.period_slice;
const completedBoundary = buildWeeklyHrLifecycleProjection({ weekRows: boundaryRows,
    effectiveProfile: searchProfiles['2026-05-03'], effectiveProfilesByDate: searchProfiles,
    scope: boundaryScope, periodScope: boundaryPeriod,
    persistedStage1State: { status: 'OPEN', period_slices: [{
        period_start: boundaryPeriod.period_start, period_end: boundaryPeriod.period_end,
        status: 'COMPLETED', context_fingerprint: slice.context_fingerprint,
        completion_fingerprint: slice.completion_fingerprint,
        effective_fingerprint: slice.completion_fingerprint, version: 1 }] } });
assert.deepEqual(completedBoundary.stages.stage3.pending_dates,
    ['2026-05-02', '2026-05-03']);
for (const item of completedBoundary.stages.stage3.pending_items) {
    const row = boundaryRows.find((candidate) => candidate.hmeromhnia === item.date);
    const authoritativeProfile = boundaryProfiles[item.date].authoritative;
    const stage1 = completedBoundary.stages.stage1;
    const authoritativeContext = {
        scope: boundaryScope, row, dailyProfile: authoritativeProfile, isResidual: true,
        stage2: { fingerprint: item.stage2_fingerprint, status: 'COMPLETED',
            resolution: 'NOT_APPLICABLE', resolved_dates: [] },
        upstream: { stage1_attestation_scope: 'PERIOD_SLICE',
            stage1_period_start: boundaryPeriod.period_start,
            stage1_period_end: boundaryPeriod.period_end,
            stage1_context_fingerprint: stage1.current_context_fingerprint,
            stage1_current_fingerprint: stage1.current_completion_fingerprint,
            stage1_completion_fingerprint: stage1.period_slice.completion_fingerprint,
            stage1_effective_fingerprint: stage1.period_slice.effective_fingerprint,
            stage1_version: 1, stage2_fingerprint: item.stage2_fingerprint,
            stage2_version: 0 }
    };
    const authoritative = buildStage3InputFingerprint(authoritativeContext);
    assert.deepEqual(authoritative.material.daily_employment, {
        type: '0', source: 'ORARIO_TERMS_FOR_DATE', effective_from: '2026-04-27'
    });
    assert.equal(item.input_fingerprint, authoritative.fingerprint);
}

const snapshotRow = { ...boundaryRows[5], kathestos_apasxolhshs_hmeras: '0' };
const snapshotProfiles = resolvedDailyProfiles([snapshotRow], employee, boundaryHistory);
const snapshotSearch = buildStage3InputFingerprint(baseFingerprintContext({
    row: snapshotRow, dailyProfile: snapshotProfiles[snapshotRow.hmeromhnia].search,
    start: '2026-04-27'
}));
const snapshotAuthoritative = buildStage3InputFingerprint(baseFingerprintContext({
    row: snapshotRow, dailyProfile: snapshotProfiles[snapshotRow.hmeromhnia].authoritative,
    start: '2026-04-27'
}));
assert.equal(snapshotSearch.material.daily_employment.source, 'PRODHLomena_ORARIA');
assert.deepEqual(snapshotSearch.material, snapshotAuthoritative.material);
assert.equal(snapshotSearch.fingerprint, snapshotAuthoritative.fingerprint);

const genuineBase = baseFingerprintContext({ row: boundaryRows[5],
    dailyProfile: boundaryProfiles['2026-05-02'].authoritative,
    start: '2026-04-27' });
const genuineFingerprint = buildStage3InputFingerprint(genuineBase).fingerprint;
for (const changed of [
    { dailyProfile: { ...genuineBase.dailyProfile, kathestos_apasxolhshs: '1' } },
    { dailyProfile: { ...genuineBase.dailyProfile,
        hmeromhnia_isxyos_oron_ergasias_apo: '2026-04-28' } },
    { dailyProfile: { ...genuineBase.dailyProfile,
        daily_employment_snapshot_source: 'PRODHLomena_ORARIA' } },
    { row: { ...genuineBase.row, ores_ergasias: 7 } },
    { upstream: { ...genuineBase.upstream,
        stage1_current_fingerprint: 'c'.repeat(64) } },
    { upstream: { ...genuineBase.upstream, stage2_version: 1 } },
    { stage2: { ...genuineBase.stage2, resolved_dates: ['2026-05-01'] } }
]) {
    assert.notEqual(buildStage3InputFingerprint({ ...genuineBase, ...changed }).fingerprint,
        genuineFingerprint);
}

console.log('Stage-3 daily employment profile equivalence tests passed');
