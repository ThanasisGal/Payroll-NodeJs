'use strict';

const assert = require('node:assert/strict');
const {
    applySequentialPresentation,
    buildStage1NoClassificationPreviewItems,
    buildWeeklyHrLifecycleProjection,
    resolveStage3ActionableDates
} = require('./apasxoliseisWeeklyHrLifecycleProjectionService');
const {
    analyzeWeeklySixthSeventhDay
} = require('./apasxoliseisWeeklySixthSeventhDayPolicyService');
const {
    buildStage1Fingerprint
} = require('./apasxoliseisStage1FingerprintService');

const profile = { hmeres_ergasias_ebdomadas: 5, typos_apasxolhshs: '0',
    pososto_prosayxhshs_6hs_hmeras: 40, pragmatikoOromisthio: 10 };

function week(kodikos = '0004', start = '2026-06-15') {
    return Array.from({ length: 7 }, (_, index) => {
        const date = new Date(`${start}T00:00:00.000Z`);
        date.setUTCDate(date.getUTCDate() + index);
        return { _id: `${kodikos}-${index}`, team: 'THA', company_kod: 'company',
            ypokatasthma: '0000', kodikos, hmeromhnia: date.toISOString().slice(0, 10),
            kathgoria_ergasias: 'ΕΡΓ', kathgoria_ergasias_apologistika: 'ΕΡΓ',
            ores_ergasias: 8, ores_ergasias_apologistika: 8,
            cards_ores_ergasias: 8, cards_apo_ora_01: '09:00', cards_eos_ora_01: '17:00',
            apo_ora_01: '09:00', eos_ora_01: '17:00', repo: false,
            repo_apologistika: false, adeia_apologistika: false,
            astheneia_apologistika: false, apousia_apologistika: false,
            kathgoria_adeias_apologistika: '' };
    });
}

function possibleLeave(row) {
    return { ...row, cards_ores_ergasias: 0, cards_apo_ora_01: '', cards_eos_ora_01: '',
        ores_ergasias_apologistika: 0, kathgoria_ergasias_apologistika: '',
        kathgoria_adeias_apologistika: 'POSSIBLE_LEAVE' };
}

const employee0004 = week('0004');
Object.assign(employee0004[2], { kathgoria_ergasias: 'ΑΝ', repo: true,
    ores_ergasias: 0, cards_ores_ergasias: 419 / 60,
    cards_apo_ora_01: '15:41', cards_eos_ora_01: '22:40',
    ores_ergasias_apologistika: 6.48 });
Object.assign(employee0004[6], { cards_ores_ergasias: 437 / 60,
    cards_apo_ora_01: '15:40', cards_eos_ora_01: '22:57',
    ores_ergasias_apologistika: 6.78 });
const direct0004 = analyzeWeeklySixthSeventhDay({ weekRows: employee0004,
    effectiveProfile: profile });
const lifecycle0004 = buildWeeklyHrLifecycleProjection({ weekRows: employee0004,
    effectiveProfile: profile });
assert.equal(lifecycle0004.stages.stage1.business_status, 'COMPLETED');
assert.equal(lifecycle0004.stages.stage1.persisted_status, 'OPEN');
assert.equal(lifecycle0004.stages.stage1.persistence_state, 'NO_STATE');
assert.equal(lifecycle0004.stages.stage1.pending_count, 0);
assert.equal(lifecycle0004.stages.stage2.business_status, 'COMPLETED');
assert.equal(lifecycle0004.stages.stage2.pending_count, 0);
assert.equal(lifecycle0004.stages.stage2.stage2_applicability, 'NOT_APPLICABLE');
assert.deepEqual(lifecycle0004.stages.stage4.final_weekly_analysis, direct0004);

const resolvedChangedProfiles = Object.fromEntries(employee0004.map((row, index) => [
    row.hmeromhnia,
    { istorikoId: index === 0 ? '0003' : '0004' }
]));
const lifecycleResolvedProfileChange = buildWeeklyHrLifecycleProjection({
    weekRows: employee0004,
    effectiveProfile: {
        ...profile,
        profile_changed_inside_week: true,
        date_effective_profiles_by_date: resolvedChangedProfiles
    }
});
assert.equal(lifecycleResolvedProfileChange.stages.stage4.business_status, 'COMPLETED');
assert.ok(!lifecycleResolvedProfileChange.stages.stage4.pending_reasons.includes(
    'PROFILE_CHANGED_INSIDE_WEEK'
));

const lifecycleUnresolvedDailyProfile = buildWeeklyHrLifecycleProjection({
    weekRows: employee0004,
    effectiveProfile: {
        ...profile,
        profile_changed_inside_week: true,
        date_effective_profiles_by_date: {
            [employee0004[0].hmeromhnia]: { istorikoId: '0003' },
            [employee0004[1].hmeromhnia]: null
        }
    }
});
assert.equal(lifecycleUnresolvedDailyProfile.stages.stage4.business_status, 'BLOCKED');
assert.deepEqual(
    lifecycleUnresolvedDailyProfile.stages.stage4.pending_reasons,
    ['UNRESOLVED_DAILY_EMPLOYMENT_PROFILE']
);

const employee0001 = week('0001');
employee0001[1] = possibleLeave(employee0001[1]);
const lifecycle0001 = buildWeeklyHrLifecycleProjection({ weekRows: employee0001,
    effectiveProfile: profile });
assert.equal(lifecycle0001.stages.stage1.business_status, 'OPEN');
assert.equal(lifecycle0001.stages.stage1.presentation_status, 'ACTIVE');
assert.deepEqual(lifecycle0001.stages.stage1.pending_dates, ['2026-06-16']);
for (const key of ['stage2', 'stage3', 'stage4']) {
    assert.equal(lifecycle0001.stages[key].presentation_status, 'LOCKED');
}

const employee0009 = week('0009');
employee0009[1] = possibleLeave(employee0009[1]);
Object.assign(employee0009[4], { cards_apo_ora_01: '09:00', cards_eos_ora_01: '',
    cards_ores_ergasias: 0, ores_ergasias_apologistika: 0 });
const lifecycle0009 = buildWeeklyHrLifecycleProjection({ weekRows: employee0009,
    effectiveProfile: profile });
assert.equal(lifecycle0009.stages.stage1.business_status, 'BLOCKED');
assert.equal(lifecycle0009.stages.stage1.presentation_status, 'BLOCKED');
assert.ok(lifecycle0009.stages.stage1.pending_reasons.includes(
    'POSSIBLE_LEAVE_REQUIRES_HR_CLASSIFICATION'));
assert.ok(lifecycle0009.stages.stage1.blockers.includes(
    'UNRESOLVED_INCOMPLETE_CARD_EVIDENCE'));

const employee0012 = week('0012');
Object.assign(employee0012[6], { cards_apo_ora_01: '09:00', cards_eos_ora_01: '',
    cards_ores_ergasias: 0, ores_ergasias_apologistika: 0 });
const lifecycle0012 = buildWeeklyHrLifecycleProjection({ weekRows: employee0012,
    effectiveProfile: profile });
assert.equal(lifecycle0012.stages.stage1.business_status, 'BLOCKED');

const employee0014 = week('0014');
employee0014[2] = possibleLeave(employee0014[2]);
for (const index of [0, 1]) Object.assign(employee0014[index], {
    kathgoria_ergasias: 'ΑΝ', ores_ergasias: 0, apo_ora_01: '', eos_ora_01: '', repo: true,
    cards_ores_ergasias: 0, cards_apo_ora_01: '', cards_eos_ora_01: '',
    kathgoria_ergasias_apologistika: 'ΑΝ', ores_ergasias_apologistika: 0,
    repo_apologistika: true
});
const lifecycle0014 = buildWeeklyHrLifecycleProjection({ weekRows: employee0014,
    effectiveProfile: profile });
assert.equal(lifecycle0014.stages.stage1.business_status, 'OPEN');
assert.equal(lifecycle0014.stages.stage1.presentation_status, 'ACTIVE');

// Stage-1 completion records that HR finished that stage. It does not consume
// or negatively classify an unresolved possible-leave candidate.
const employee0014Fingerprint = buildStage1Fingerprint(employee0014).fingerprint;
const completed0014 = buildWeeklyHrLifecycleProjection({ weekRows: employee0014,
    effectiveProfile: profile, persistedStage1State: { status: 'COMPLETED',
        completion_fingerprint: employee0014Fingerprint } });
assert.equal(completed0014.stages.stage1.business_status, 'COMPLETED');
assert.equal(completed0014.stages.stage1.pending_count, 0);
assert.deepEqual(completed0014.stages.stage1.reviewed_possible_leave_dates,
    ['2026-06-17']);
assert.deepEqual(completed0014.stages.stage3.raw_remaining_possible_leave_dates,
    ['2026-06-17']);
assert.deepEqual(completed0014.stages.stage3.resolved_before_stage3_dates, []);
assert.deepEqual(completed0014.stages.stage3.pending_dates, ['2026-06-17']);
assert.equal(completed0014.stages.stage3.remaining_possible_leave_count, 1);
assert.equal(completed0014.stages.stage3.business_status, 'OPEN');

// A full-time candidate that Stage 2 deterministically resolves as the missing
// rest/repo identity is not a Stage-3 residual.
const fullRepoResolved = week('full-repo-resolved');
fullRepoResolved[1] = possibleLeave(fullRepoResolved[1]);
Object.assign(fullRepoResolved[2], { kathgoria_ergasias: 'ΑΝ', repo: true,
    ores_ergasias: 0, apo_ora_01: '', eos_ora_01: '', cards_ores_ergasias: 0,
    cards_apo_ora_01: '', cards_eos_ora_01: '', ores_ergasias_apologistika: 0,
    kathgoria_ergasias_apologistika: 'ΑΝ', repo_apologistika: true });
const fullRepoResolvedProjection = buildWeeklyHrLifecycleProjection({
    weekRows: fullRepoResolved, effectiveProfile: profile,
    persistedStage1State: { status: 'COMPLETED',
        completion_fingerprint: buildStage1Fingerprint(fullRepoResolved).fingerprint }
});
assert.deepEqual(fullRepoResolvedProjection.stages.stage3.pending_dates, []);
assert.equal(fullRepoResolvedProjection.stages.stage3.pending_count, 0);

// Έγκυρη ολοκλήρωση του Σταδίου 1 επιτρέπει στο Στάδιο 2 να επιλύσει
// αχαρακτήριστη ημέρα μη πλήρους απασχόλησης χωρίς εργασία ως ΜΗ ΕΡΓΑΣΙΑ.
const partialResidual = week('partial-residual');
partialResidual[1] = possibleLeave(partialResidual[1]);
const partialProfiles = Object.fromEntries(partialResidual.map((row) => [
    row.hmeromhnia, { ...profile, typos_apasxolhshs: '1', kathestos_apasxolhshs: '1' }
]));
const partialResidualProjection = buildWeeklyHrLifecycleProjection({
    weekRows: partialResidual,
    effectiveProfile: { ...profile, typos_apasxolhshs: '1' },
    effectiveProfilesByDate: partialProfiles,
    persistedStage1State: { status: 'COMPLETED',
        completion_fingerprint: buildStage1Fingerprint(partialResidual).fingerprint }
});
assert.deepEqual(partialResidualProjection.stages.stage3.pending_dates, []);
assert.deepEqual(partialResidualProjection.stages.stage3.stage2_non_full_non_work_dates,
    ['2026-06-16']);
assert.deepEqual(partialResidualProjection.stage1_no_classification_preview_items, [{
    date: '2026-06-16', safe: true, classification: 'NON_WORK',
    source_date: null, reasons: []
}]);
assert.ok(!completed0014.stages.stage3.pending_items[0]
    .allowed_classifications.includes('NON_WORK'));
assert.equal(completed0014.stages.stage3.pending_items[0].expected_stage3_version, 0);
const completed0014AtStage3Version = buildWeeklyHrLifecycleProjection({
    weekRows: employee0014, effectiveProfile: profile,
    persistedStage1State: { status: 'COMPLETED',
        completion_fingerprint: employee0014Fingerprint },
    persistedStage3State: { status: 'OPEN', version: 4 }
});
assert.equal(completed0014AtStage3Version.stages.stage3.pending_items[0]
    .expected_stage3_version, 4);

// After the last residual receives a canonical classification, the immutable
// HR attestation remains separate from the authorized effective successor.
const resolvedLastResidual = employee0014.map((row) => ({ ...row }));
Object.assign(resolvedLastResidual[2], { apousia_apologistika: true,
    kathgoria_adeias_apologistika: '' });
const resolvedLastProjection = buildWeeklyHrLifecycleProjection({
    weekRows: resolvedLastResidual, effectiveProfile: profile,
    persistedStage1State: { status: 'COMPLETED', version: 2,
        completion_fingerprint: employee0014Fingerprint,
        effective_fingerprint: buildStage1Fingerprint(resolvedLastResidual).fingerprint }
});
assert.equal(resolvedLastProjection.stages.stage3.business_status, 'COMPLETED');
assert.equal(resolvedLastProjection.stages.stage3.pending_count, 0);
assert.notEqual(resolvedLastProjection.stages.stage4.presentation_status, 'LOCKED');

// A changed weekly input invalidates the completion. The candidate is not
// treated as reviewed; Stage 1 is STALE and sequentially locks Stage 3.
const stale0014 = buildWeeklyHrLifecycleProjection({ weekRows: employee0014,
    effectiveProfile: profile, persistedStage1State: { status: 'COMPLETED',
        completion_fingerprint: 'a'.repeat(64) } });
assert.equal(stale0014.stages.stage1.business_status, 'STALE');
assert.deepEqual(stale0014.stages.stage3.pending_dates, ['2026-06-17']);
assert.deepEqual(stale0014.stages.stage3.resolved_before_stage3_dates, []);
assert.equal(stale0014.stages.stage3.business_status, 'OPEN');
assert.equal(stale0014.stages.stage3.presentation_status, 'LOCKED');

// Οι μη πλήρεις ημέρες που εξετάστηκαν στο Στάδιο 1 επιλύονται ως ΜΗ ΕΡΓΑΣΙΑ.
// Η πλήρης ημέρα παραμένει εξαίρεση όταν δεν υπάρχει ασφαλής επίλυση ρεπό.
const reviewed0014Weeks = [
    ['2026-06-01', [2]], ['2026-06-08', [1, 2]], ['2026-06-22', [0]]
].map(([start, offsets]) => {
    const fixture = week('0014', start);
    offsets.forEach((offset) => { fixture[offset] = possibleLeave(fixture[offset]); });
    for (const index of [5, 6]) Object.assign(fixture[index], {
        kathgoria_ergasias: 'ΑΝ', ores_ergasias: 0, apo_ora_01: '', eos_ora_01: '', repo: true,
        cards_ores_ergasias: 0, cards_apo_ora_01: '', cards_eos_ora_01: '',
        kathgoria_ergasias_apologistika: 'ΑΝ', ores_ergasias_apologistika: 0,
        repo_apologistika: true
    });
    const nonFull = start !== '2026-06-22';
    const profiles = Object.fromEntries(fixture.map((row) => [row.hmeromhnia,
        { ...profile, typos_apasxolhshs: nonFull ? '1' : '0',
            kathestos_apasxolhshs: nonFull ? '1' : '0' }]));
    return buildWeeklyHrLifecycleProjection({ weekRows: fixture, effectiveProfile: profile,
        effectiveProfilesByDate: profiles,
        persistedStage1State: { status: 'COMPLETED',
            completion_fingerprint: buildStage1Fingerprint(fixture).fingerprint } });
});
assert.equal(reviewed0014Weeks.reduce((sum, projection) =>
    sum + projection.stages.stage3.pending_count, 0), 1);
assert.deepEqual(reviewed0014Weeks.flatMap((projection) =>
    projection.stages.stage3.pending_dates),
['2026-06-22']);

const rotationalResidual = week('rotational');
rotationalResidual[1] = possibleLeave(rotationalResidual[1]);
const rotationalProfiles = Object.fromEntries(rotationalResidual.map((row) => [row.hmeromhnia,
    { ...profile, typos_apasxolhshs: '2', kathestos_apasxolhshs: '2' }]));
const rotationalProjection = buildWeeklyHrLifecycleProjection({ weekRows: rotationalResidual,
    effectiveProfile: { ...profile, typos_apasxolhshs: '2' },
    effectiveProfilesByDate: rotationalProfiles,
    persistedStage1State: { status: 'COMPLETED',
        completion_fingerprint: buildStage1Fingerprint(rotationalResidual).fingerprint } });
assert.deepEqual(rotationalProjection.stages.stage3.pending_dates, []);
assert.deepEqual(rotationalProjection.stages.stage3.stage2_non_full_non_work_dates,
    ['2026-06-16']);

const nonFullWithWork = rotationalResidual.map((row) => ({ ...row }));
Object.assign(nonFullWithWork[1], { cards_ores_ergasias: 2,
    cards_apo_ora_01: '15:00', cards_eos_ora_01: '17:00' });
const nonFullWithWorkProjection = buildWeeklyHrLifecycleProjection({
    weekRows: nonFullWithWork, effectiveProfile: { ...profile, typos_apasxolhshs: '2' },
    effectiveProfilesByDate: rotationalProfiles,
    persistedStage1State: { status: 'COMPLETED',
        completion_fingerprint: buildStage1Fingerprint(nonFullWithWork).fingerprint } });
assert.deepEqual(nonFullWithWorkProjection.stages.stage3.stage2_non_full_non_work_dates, []);
assert.ok(!nonFullWithWorkProjection.stages.stage3.stage2_automatic_resolution_items
    .some((item) => item.date === '2026-06-16'));

const deterministicFullRepo = week('0014', '2026-06-22');
deterministicFullRepo[0] = possibleLeave(deterministicFullRepo[0]);
Object.assign(deterministicFullRepo[1], { kathgoria_ergasias: 'ΑΝ', repo: true,
    ores_ergasias: 0, apo_ora_01: '', eos_ora_01: '', cards_ores_ergasias: 0,
    cards_apo_ora_01: '', cards_eos_ora_01: '', ores_ergasias_apologistika: 0,
    kathgoria_ergasias_apologistika: 'ΑΝ', repo_apologistika: true });
Object.assign(deterministicFullRepo[3], { kathgoria_ergasias: 'ΑΝ', repo: true,
    ores_ergasias: 0, apo_ora_01: '', eos_ora_01: '', cards_ores_ergasias: 6,
    cards_apo_ora_01: '15:00', cards_eos_ora_01: '21:00',
    ores_ergasias_apologistika: 5.5, kathgoria_ergasias_apologistika: 'ΕΡΓ' });
const deterministicFullProjection = buildWeeklyHrLifecycleProjection({
    weekRows: deterministicFullRepo, effectiveProfile: profile,
    persistedStage1State: { status: 'COMPLETED',
        completion_fingerprint: buildStage1Fingerprint(deterministicFullRepo).fingerprint } });
assert.deepEqual(deterministicFullProjection.stages.stage3.pending_dates, []);
assert.deepEqual(deterministicFullProjection.stages.stage3.stage2_automatic_resolved_dates,
    ['2026-06-22']);
assert.deepEqual(deterministicFullProjection.stage1_no_classification_preview_items, [{
    date: '2026-06-22', safe: true, classification: 'REST_REPO',
    source_date: null, reasons: []
}]);
const deterministicFullAfterStage2 = deterministicFullRepo.map((row) => ({ ...row }));
Object.assign(deterministicFullAfterStage2[0], { apologistiko_biblio: true,
    repo_apologistika: true, kathgoria_ergasias_apologistika: 'ΑΝ',
    kathgoria_adeias_apologistika: '', adeia_apologistika: false,
    astheneia_apologistika: false, apousia_apologistika: false,
    ores_ergasias_apologistika: 0 });
const deterministicFullAfterStage2Projection = buildWeeklyHrLifecycleProjection({
    weekRows: deterministicFullAfterStage2, effectiveProfile: profile,
    persistedStage1State: { status: 'COMPLETED', version: 2,
        completion_fingerprint: buildStage1Fingerprint(deterministicFullRepo).fingerprint,
        effective_fingerprint: buildStage1Fingerprint(deterministicFullAfterStage2).fingerprint }
});
assert.equal(deterministicFullAfterStage2Projection.stages.stage1.business_status, 'COMPLETED');
assert.equal(deterministicFullAfterStage2Projection.stages.stage2.business_status, 'COMPLETED');
assert.notEqual(deterministicFullAfterStage2Projection.current_stage, 'STAGE1');
assert.deepEqual(buildStage1NoClassificationPreviewItems({
    rows: deterministicFullRepo, possibleDates: ['2026-06-22'], effectiveProfile: profile,
    repoTransfer: { source: { hmeromhnia: '2026-06-25' },
        target: { hmeromhnia: '2026-06-22' }, reasons: [] },
    stage2Actionability: { has_transferable_pair: true }
}), [{ date: '2026-06-22', safe: true, classification: 'REST_REPO',
    source_date: '2026-06-25', reasons: [] }]);

// A genuinely uncovered leave-related fact is not globally hidden. When the
// sequential workflow reaches Stage 3, it remains actionable and ACTIVE.
const uncoveredStage3 = resolveStage3ActionableDates({
    rawRemainingDates: ['2026-06-30']
});
assert.deepEqual(uncoveredStage3.actionable, ['2026-06-30']);
const reachedStage3 = applySequentialPresentation({
    stage1: { stage: 'STAGE1', business_status: 'COMPLETED', pending_count: 0 },
    stage2: { stage: 'STAGE2', business_status: 'COMPLETED', pending_count: 0 },
    stage3: { stage: 'STAGE3', business_status: 'OPEN', pending_count: 1,
        pending_dates: uncoveredStage3.actionable },
    stage4: { stage: 'STAGE4', business_status: 'COMPLETED', pending_count: 0 }
});
assert.equal(reachedStage3.stage3.presentation_status, 'ACTIVE');
assert.equal(reachedStage3.stage3.pending_count, 1);

const stale = buildWeeklyHrLifecycleProjection({ weekRows: week('stale'),
    effectiveProfile: profile,
    persistedStage1State: { status: 'COMPLETED', completion_fingerprint: 'a'.repeat(64) } });
assert.equal(stale.stages.stage1.business_status, 'STALE');
assert.equal(stale.stages.stage1.presentation_status, 'STALE');
assert.equal(stale.stages.stage2.presentation_status, 'LOCKED');

const stage2Rows = week('stage2');
Object.assign(stage2Rows[1], { kathgoria_ergasias: 'ΑΝ', repo: true, ores_ergasias: 0,
    cards_ores_ergasias: 8, cards_apo_ora_01: '09:00', cards_eos_ora_01: '17:00' });
Object.assign(stage2Rows[3], { cards_ores_ergasias: 0, cards_apo_ora_01: '',
    cards_eos_ora_01: '', ores_ergasias_apologistika: 0 });
const lifecycleStage2 = buildWeeklyHrLifecycleProjection({ weekRows: stage2Rows,
    effectiveProfile: profile });
assert.equal(lifecycleStage2.stages.stage1.business_status, 'COMPLETED');
assert.equal(lifecycleStage2.stages.stage2.presentation_status, 'ACTIVE');
assert.equal(lifecycleStage2.stages.stage2.enabled, true);
assert.equal(lifecycleStage2.stages.stage2.pending_count, 1);
assert.equal(lifecycleStage2.stages.stage2.has_transferable_pair, true);

const noSource = week('0004', '2026-06-01');
Object.assign(noSource[2], { kathgoria_ergasias: 'ΑΝ', repo: true, ores_ergasias: 0,
    cards_ores_ergasias: 0, cards_apo_ora_01: '', cards_eos_ora_01: '',
    kathgoria_ergasias_apologistika: 'ΑΝ', repo_apologistika: true,
    ores_ergasias_apologistika: 0 });
const noSourceLifecycle = buildWeeklyHrLifecycleProjection({ weekRows: noSource,
    effectiveProfile: profile });
assert.equal(noSourceLifecycle.stages.stage2.repo_transfer_status, 'NOT_APPLICABLE');
assert.ok(noSourceLifecycle.stages.stage2.repo_transfer_reasons.includes('NO_SOURCE_CANDIDATE'));
assert.equal(noSourceLifecycle.stages.stage2.business_status, 'COMPLETED');
assert.equal(noSourceLifecycle.stages.stage2.pending_count, 0);

const alreadyProcessed = week('0004', '2026-06-08');
Object.assign(alreadyProcessed[2], { kathgoria_ergasias: 'ΑΝ', repo: true,
    ores_ergasias: 0, cards_ores_ergasias: 7,
    cards_apo_ora_01: '09:00', cards_eos_ora_01: '16:00' });
Object.assign(alreadyProcessed[3], { cards_ores_ergasias: 0,
    cards_apo_ora_01: '', cards_eos_ora_01: '', ores_ergasias_apologistika: 0,
    astheneia_apologistika: true, kathgoria_adeias_apologistika: 'ΑΔΑΣ' });
const alreadyProcessedLifecycle = buildWeeklyHrLifecycleProjection({
    weekRows: alreadyProcessed, effectiveProfile: profile });
assert.ok(alreadyProcessedLifecycle.stages.stage2.repo_transfer_reasons.includes(
    'SOURCE_ALREADY_PROCESSED'));
assert.equal(alreadyProcessedLifecycle.stages.stage2.business_status, 'COMPLETED');
assert.equal(alreadyProcessedLifecycle.stages.stage2.pending_count, 0);

const productionShapedWeeks = [noSourceLifecycle, alreadyProcessedLifecycle, lifecycle0004];
const processedAbsence = week('0004', '2026-06-22');
Object.assign(processedAbsence[2], { kathgoria_ergasias: 'ΑΝ', repo: true,
    ores_ergasias: 0, cards_ores_ergasias: 9.6,
    cards_apo_ora_01: '12:59', cards_eos_ora_01: '22:35' });
Object.assign(processedAbsence[4], { cards_ores_ergasias: 0,
    cards_apo_ora_01: '', cards_eos_ora_01: '', ores_ergasias_apologistika: 0,
    apousia_apologistika: true });
productionShapedWeeks.push(buildWeeklyHrLifecycleProjection({
    weekRows: processedAbsence, effectiveProfile: profile }));
for (const projection of productionShapedWeeks) {
    assert.equal(projection.stages.stage2.business_status, 'COMPLETED');
    assert.equal(projection.stages.stage2.pending_count, 0);
}
assert.equal(productionShapedWeeks.reduce((sum, projection) =>
    sum + projection.stages.stage2.pending_count, 0), 0);

const multipleTargets = stage2Rows.map((row) => ({ ...row }));
Object.assign(multipleTargets[4], { cards_ores_ergasias: 0, cards_apo_ora_01: '',
    cards_eos_ora_01: '', ores_ergasias_apologistika: 0 });
const multipleTargetsLifecycle = buildWeeklyHrLifecycleProjection({
    weekRows: multipleTargets, effectiveProfile: profile });
assert.ok(multipleTargetsLifecycle.stages.stage2.repo_transfer_reasons.includes(
    'MULTIPLE_TARGET_CANDIDATES'));
assert.equal(multipleTargetsLifecycle.stages.stage2.business_status, 'OPEN');
assert.equal(multipleTargetsLifecycle.stages.stage2.pending_count, 1);
assert.equal(multipleTargetsLifecycle.stages.stage2.has_bounded_selection, true);
const ambiguousPreview = buildStage1NoClassificationPreviewItems({
    rows: multipleTargets, possibleDates: ['2026-06-19'], effectiveProfile: profile,
    repoTransfer: { reasons: ['MULTIPLE_SOURCE_CANDIDATES'] },
    stage2Actionability: { has_transferable_pair: false, has_bounded_selection: true }
});
assert.deepEqual(ambiguousPreview, [{ date: '2026-06-19', safe: false,
    classification: null, source_date: null, requires_further_review: true,
    reasons: ['MULTIPLE_SOURCE_CANDIDATES'] }]);

const crossMonth = week('0014', '2026-06-29');
crossMonth[0] = possibleLeave(crossMonth[0]);
Object.assign(crossMonth[1], { kathgoria_ergasias: 'ΑΝ', repo: true,
    ores_ergasias: 0, apo_ora_01: '', eos_ora_01: '', cards_ores_ergasias: 9.12,
    cards_apo_ora_01: '14:07', cards_eos_ora_01: '23:14',
    ores_ergasias_apologistika: 8.62, kathgoria_ergasias_apologistika: 'ΕΡΓ' });
crossMonth[2] = possibleLeave(crossMonth[2]);
const crossScope = { team: 'THA', company_kod: 'company', ypokatasthma: '0000',
    employee_id: 'employee-0014', employee_kodikos: '0014',
    week_start: '2026-06-29', week_end: '2026-07-05' };
const juneCross = buildWeeklyHrLifecycleProjection({ weekRows: crossMonth,
    effectiveProfile: profile, scope: crossScope,
    periodScope: { period_start: '2026-06-01', period_end: '2026-06-30' } });
assert.equal(juneCross.stages.stage1.attestation_scope, 'PERIOD_SLICE');
assert.deepEqual(juneCross.stages.stage1.period_slice.actionable_dates,
    ['2026-06-29', '2026-06-30']);
assert.deepEqual(juneCross.stages.stage1.period_slice.context_only_dates,
    ['2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04', '2026-07-05']);
assert.deepEqual(juneCross.stages.stage1.pending_dates, ['2026-06-29']);
assert.equal(juneCross.stages.stage1.presentation_status, 'ACTIVE');
for (const stage of ['stage2', 'stage3', 'stage4']) {
    assert.equal(juneCross.stages[stage].presentation_status, 'LOCKED');
}
const completedJuneCross = buildWeeklyHrLifecycleProjection({ weekRows: crossMonth,
    effectiveProfile: profile, scope: crossScope,
    periodScope: { period_start: '2026-06-01', period_end: '2026-06-30' },
    persistedStage1State: { status: 'OPEN', version: 4, period_slices: [{
        period_start: '2026-06-01', period_end: '2026-06-30', status: 'COMPLETED',
        context_fingerprint: 'f'.repeat(64),
        completion_fingerprint: juneCross.stages.stage1.current_completion_fingerprint,
        effective_fingerprint: juneCross.stages.stage1.current_completion_fingerprint,
        version: 1 }] } });
assert.equal(completedJuneCross.stages.stage1.business_status, 'COMPLETED');
assert.deepEqual(completedJuneCross.stages.stage3.pending_dates, []);
assert.deepEqual(completedJuneCross.stages.stage3.stage2_automatic_resolved_dates, []);
assert.equal(completedJuneCross.trailing_partial_week.active, true);
assert.equal(completedJuneCross.trailing_partial_week.title, 'ΜΕΡΙΚΗ ΕΒΔΟΜΑΔΑ ΠΕΡΙΟΔΟΥ');
assert.deepEqual(completedJuneCross.deferred_weekly_dates, ['2026-06-29']);
assert.deepEqual(completedJuneCross.trailing_partial_week.deferred_weekly_dates,
    ['2026-06-29']);
assert.equal(completedJuneCross.stages.stage2.weekly_review_deferred, true);
assert.equal(completedJuneCross.stages.stage2.pending_count, 0);
assert.equal(completedJuneCross.stages.stage4.weekly_review_deferred, true);
assert.equal(completedJuneCross.stages.stage4.final_weekly_analysis_available, false);
assert.equal(completedJuneCross.stages.stage4.final_weekly_analysis, null);
const julyCross = buildWeeklyHrLifecycleProjection({ weekRows: crossMonth,
    effectiveProfile: profile, scope: crossScope,
    periodScope: { period_start: '2026-07-01', period_end: '2026-07-31' },
    persistedStage1State: { status: 'OPEN', version: 4, period_slices: [{
        period_start: '2026-06-01', period_end: '2026-06-30', status: 'COMPLETED',
        context_fingerprint: juneCross.stages.stage1.current_context_fingerprint,
        completion_fingerprint: juneCross.stages.stage1.current_completion_fingerprint,
        effective_fingerprint: juneCross.stages.stage1.current_completion_fingerprint,
        version: 1 }] } });
assert.deepEqual(julyCross.stages.stage1.pending_dates, ['2026-07-01']);
assert.equal(julyCross.stages.stage1.business_status, 'OPEN');
assert.equal(julyCross.trailing_partial_week, null);
assert.deepEqual(julyCross.deferred_weekly_dates, []);
assert.equal(julyCross.stages.stage2.weekly_review_deferred, false);
const completedJulyCross = buildWeeklyHrLifecycleProjection({ weekRows: crossMonth,
    effectiveProfile: profile, scope: crossScope,
    periodScope: { period_start: '2026-07-01', period_end: '2026-07-31' },
    persistedStage1State: { status: 'OPEN', version: 5, period_slices: [{
        period_start: '2026-07-01', period_end: '2026-07-31', status: 'COMPLETED',
        context_fingerprint: julyCross.stages.stage1.current_context_fingerprint,
        completion_fingerprint: julyCross.stages.stage1.current_completion_fingerprint,
        effective_fingerprint: julyCross.stages.stage1.current_completion_fingerprint,
        version: 1 }] } });
assert.equal(completedJulyCross.trailing_partial_week, null);
assert.deepEqual(completedJulyCross.deferred_weekly_dates, []);
assert.equal(completedJulyCross.stages.stage2.weekly_review_deferred, false);
assert.notEqual(completedJulyCross.stages.stage4.final_weekly_analysis, null);
assert.ok(completedJulyCross.stages.stage3.stage2_automatic_resolved_dates.includes(
    '2026-06-29'));

const contextOnlyStage2 = week('0004', '2026-06-29');
Object.assign(contextOnlyStage2[2], { kathgoria_ergasias: 'ΑΝ', repo: true,
    ores_ergasias: 0, apo_ora_01: '', eos_ora_01: '', cards_ores_ergasias: 8,
    cards_apo_ora_01: '09:00', cards_eos_ora_01: '17:00' });
contextOnlyStage2[4] = possibleLeave(contextOnlyStage2[4]);
const juneContextOnlyStage2 = buildWeeklyHrLifecycleProjection({
    weekRows: contextOnlyStage2, effectiveProfile: profile, scope: {
        ...crossScope, employee_kodikos: '0004', employee_id: 'employee-0004'
    }, periodScope: { period_start: '2026-06-01', period_end: '2026-06-30' }
});
assert.equal(juneContextOnlyStage2.stages.stage1.business_status, 'COMPLETED');
assert.equal(juneContextOnlyStage2.stages.stage2.business_status, 'COMPLETED');
assert.equal(juneContextOnlyStage2.stages.stage2.pending_count, 0);
assert.deepEqual(juneContextOnlyStage2.stages.stage2.pending_dates, []);
assert.equal(juneContextOnlyStage2.requires_hr_action, false);
assert.equal(juneContextOnlyStage2.total_pending_count, 0);

function employmentScope(start, end, dates) {
    return { natural_week_start: start, natural_week_end: end,
        period_start: start, period_end: end, employment_start: dates[0],
        employment_end: dates.at(-1), employment_owned_dates: dates,
        authoritative_date_set: dates, context_only_dates: [],
        is_full_natural_week: dates.length === 7 };
}
const hireTuesdayRows = week('0025', '2026-06-08').slice(1);
const hireTuesdayDates = hireTuesdayRows.map((row) => row.hmeromhnia);
const hireTuesdayLifecycle = buildWeeklyHrLifecycleProjection({
    weekRows: hireTuesdayRows, effectiveProfile: profile,
    employmentDateScope: employmentScope('2026-06-08', '2026-06-14', hireTuesdayDates)
});
assert.equal(hireTuesdayLifecycle.stages.stage1.blockers.includes(
    'INCOMPLETE_NATURAL_WEEK'), false);
assert.equal(hireTuesdayLifecycle.stages.stage4.business_status, 'COMPLETED');
assert.equal(hireTuesdayLifecycle.stages.stage4.final_weekly_analysis.status, 'READY');
assert.equal(hireTuesdayLifecycle.stages.stage4.final_weekly_analysis.sixthDay.hmeromhnia,
    '2026-06-14');
assert.equal(hireTuesdayLifecycle.stages.stage4.final_weekly_analysis.seventhDay, null);
assert.equal(hireTuesdayLifecycle.requires_hr_action, false);

const hireTuesdayMissingPremium = buildWeeklyHrLifecycleProjection({
    weekRows: hireTuesdayRows,
    effectiveProfile: { ...profile, pososto_prosayxhshs_6hs_hmeras: null,
        eidikh_kathgoria_ergazomenoy: '0009', source: 'ISTORIKO',
        istorikoId: '0025-history' },
    employmentDateScope: employmentScope('2026-06-08', '2026-06-14', hireTuesdayDates)
});
assert.equal(hireTuesdayMissingPremium.stages.stage4.business_status, 'COMPLETED');
assert.deepEqual(hireTuesdayMissingPremium.stages.stage4.blockers, []);
assert.equal(hireTuesdayMissingPremium.stages.stage4.final_weekly_analysis.sixthDay.hmeromhnia,
    '2026-06-14');
assert.equal(hireTuesdayMissingPremium.stages.stage4.final_weekly_analysis.sixthDay.premiumRate,
    0);
assert.equal(hireTuesdayMissingPremium.stages.stage4.final_weekly_analysis.premiumRateSource,
    'POLICY');

const hireSaturdayRows = week('0029', '2026-06-22').slice(5);
const hireSaturdayDates = hireSaturdayRows.map((row) => row.hmeromhnia);
const hireSaturdayLifecycle = buildWeeklyHrLifecycleProjection({
    weekRows: hireSaturdayRows, effectiveProfile: profile,
    employmentDateScope: employmentScope('2026-06-22', '2026-06-28', hireSaturdayDates)
});
assert.equal(hireSaturdayLifecycle.stages.stage1.blockers.includes(
    'INCOMPLETE_NATURAL_WEEK'), false);
assert.equal(hireSaturdayLifecycle.stages.stage4.final_weekly_analysis.status,
    'NOT_APPLICABLE');
assert.equal(hireSaturdayLifecycle.stages.stage4.final_weekly_analysis.dailyFacts.length, 2);
assert.equal(hireSaturdayLifecycle.requires_hr_action, false);

const departureTuesdayRows = week('0002', '2026-06-01').slice(0, 2);
const departureTuesdayDates = departureTuesdayRows.map((row) => row.hmeromhnia);
const departureTuesdayScope = employmentScope(
    '2026-06-01', '2026-06-07', departureTuesdayDates);
const departureTuesdayLifecycle = buildWeeklyHrLifecycleProjection({
    weekRows: departureTuesdayRows, effectiveProfile: profile,
    employmentDateScope: departureTuesdayScope
});
assert.equal(departureTuesdayLifecycle.stages.stage1.blockers.includes(
    'INCOMPLETE_NATURAL_WEEK'), false);
assert.equal(departureTuesdayLifecycle.stages.stage4.final_weekly_analysis.dailyFacts.length, 2);
assert.equal(departureTuesdayLifecycle.requires_hr_action, false);

const oneDayNoWork = [possibleLeave(week('0022', '2026-06-01')[0])];
const oneDayScope = employmentScope('2026-06-01', '2026-06-07', ['2026-06-01']);
const oneDayNoWorkLifecycle = buildWeeklyHrLifecycleProjection({
    weekRows: oneDayNoWork, effectiveProfile: profile, employmentDateScope: oneDayScope
});
assert.equal(oneDayNoWorkLifecycle.requires_hr_action, false);
assert.equal(oneDayNoWorkLifecycle.total_pending_count, 0);
for (const stage of Object.values(oneDayNoWorkLifecycle.stages)) {
    assert.equal(stage.business_status, 'COMPLETED');
}
const oneDayWorked = [{ ...oneDayNoWork[0], cards_apo_ora_01: '09:00',
    cards_eos_ora_01: '17:00', cards_ores_ergasias: 8,
    ores_ergasias_apologistika: 8, kathgoria_ergasias_apologistika: 'ΕΡΓ',
    kathgoria_adeias_apologistika: '' }];
assert.equal(buildWeeklyHrLifecycleProjection({ weekRows: oneDayWorked,
    effectiveProfile: profile, employmentDateScope: oneDayScope
}).employment_date_scope.authoritative_date_set.length, 1);
const oneDayOrphan = [{ ...oneDayNoWork[0], cards_apo_ora_01: '09:00',
    cards_eos_ora_01: '', cards_ores_ergasias: 0,
    kathgoria_adeias_apologistika: '' }];
const oneDayOrphanLifecycle = buildWeeklyHrLifecycleProjection({
    weekRows: oneDayOrphan, effectiveProfile: profile, employmentDateScope: oneDayScope
});
assert.equal(oneDayOrphanLifecycle.requires_hr_action, true);
assert.ok(oneDayOrphanLifecycle.stages.stage1.blockers.includes(
    'UNRESOLVED_INCOMPLETE_CARD_EVIDENCE'));

const departureTuesdayOrphanSlice = week('departure-orphan', '2026-06-01').slice(0, 2);
Object.assign(departureTuesdayOrphanSlice[1], { cards_apo_ora_01: '14:52', cards_eos_ora_01: '',
    cards_ores_ergasias: 0, ores_ergasias_apologistika: 0 });
const departureOrphanDates = departureTuesdayOrphanSlice.map((row) => row.hmeromhnia);
const departureOrphanScope = employmentScope(
    '2026-06-01', '2026-06-07', departureOrphanDates);
const departureOrphanBefore = buildWeeklyHrLifecycleProjection({
    weekRows: departureTuesdayOrphanSlice, effectiveProfile: profile,
    employmentDateScope: departureOrphanScope
});
assert.ok(departureOrphanBefore.stages.stage1.blockers.includes(
    'UNRESOLVED_INCOMPLETE_CARD_EVIDENCE'));
const departureOrphanApprovedRows = departureTuesdayOrphanSlice.map((row, index) => index !== 1 ? row : ({
    ...row, kathgoria_ergasias_apologistika: 'ΕΡΓ', ores_ergasias_apologistika: 8,
    orphan_card_resolution: { status: 'HR_APPROVED',
        policy_version: 'orphan-card-continuous:v1' }
}));
const departureOrphanAfter = buildWeeklyHrLifecycleProjection({
    weekRows: departureOrphanApprovedRows, effectiveProfile: profile,
    employmentDateScope: departureOrphanScope
});
assert.equal(departureOrphanAfter.stages.stage1.blockers.includes(
    'UNRESOLVED_INCOMPLETE_CARD_EVIDENCE'), false);
assert.deepEqual(departureOrphanAfter.employment_date_scope.authoritative_date_set,
    ['2026-06-01', '2026-06-02']);

const employee0002Actual = week('0002', '2026-06-01');
Object.assign(employee0002Actual[0], { kathgoria_ergasias: 'ΑΝ', repo: true,
    apo_ora_01: '', eos_ora_01: '', ores_ergasias: 0,
    cards_apo_ora_01: '', cards_eos_ora_01: '', cards_ores_ergasias: 0,
    kathgoria_ergasias_apologistika: 'ΑΝ', repo_apologistika: true,
    ores_ergasias_apologistika: 0 });
Object.assign(employee0002Actual[1], { apo_ora_01: '13:00', eos_ora_01: '21:00',
    cards_apo_ora_01: '14:52', cards_eos_ora_01: '22:19', cards_ores_ergasias: 7.45,
    ores_ergasias_apologistika: 6.95 });
employee0002Actual[2] = possibleLeave(employee0002Actual[2]);
const employee0002ActualScope = employmentScope('2026-06-01', '2026-06-07',
    employee0002Actual.map((row) => row.hmeromhnia));
const employee0002ActualLifecycle = buildWeeklyHrLifecycleProjection({
    weekRows: employee0002Actual, effectiveProfile: profile,
    employmentDateScope: employee0002ActualScope
});
assert.equal(employee0002ActualLifecycle.stages.stage1.blockers.includes(
    'UNRESOLVED_INCOMPLETE_CARD_EVIDENCE'), false);
assert.deepEqual(employee0002ActualLifecycle.stages.stage1.pending_dates, ['2026-06-03']);
assert.equal(employee0002ActualLifecycle.employment_date_scope.is_full_natural_week, true);

console.log('weekly HR derived lifecycle projection tests passed');
