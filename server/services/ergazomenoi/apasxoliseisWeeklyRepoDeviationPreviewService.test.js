const assert = require('assert');
const {
    POLICY_VERSION,
    STATUS,
    normalizeLegacyDeviation,
    buildWeeklyRepoDeviationPreview
} = require('./apasxoliseisWeeklyRepoDeviationPreviewService');

function rows(start, count = 7, overrides = {}) {
    return Array.from({ length: count }, (_, offset) => {
        const date = new Date(`${start}T00:00:00.000Z`);
        date.setUTCDate(date.getUTCDate() + offset);
        return {
            ypokatasthma: '0000',
            kodikos: '0001',
            hmeromhnia: date.toISOString().slice(0, 10),
            kathgoria_ergasias: 'ΕΡΓ',
            ores_ergasias: 8,
            cards_ores_ergasias: 8,
            ...overrides[offset]
        };
    });
}

const fiveDayProfile = () => ({
    expectedWeeklyRepo: 2,
    repoResolutionReason: null,
    effectiveProfile: {
        hmeres_ergasias_ebdomadas: 5,
        typos_apasxolhshs: '0',
        source: 'ERG_AKTUAL'
    }
});

function testSundayAndMondayUseDifferentBuckets() {
    const sundayWeek = buildWeeklyRepoDeviationPreview({
        rows: rows('2026-06-08'),
        periodStart: '2026-06-01',
        periodEnd: '2026-06-30',
        asOfDate: '2026-07-06',
        resolveWeeklyProfile: fiveDayProfile
    });
    assert.strictEqual(sundayWeek.deviations[0].weekStart, '2026-06-08');
    assert.strictEqual(sundayWeek.deviations[0].weekEnd, '2026-06-14');

    const mondayWeek = buildWeeklyRepoDeviationPreview({
        rows: rows('2026-06-15'),
        periodStart: '2026-06-01',
        periodEnd: '2026-06-30',
        asOfDate: '2026-07-06',
        resolveWeeklyProfile: fiveDayProfile
    });
    assert.strictEqual(mondayWeek.deviations[0].weekStart, '2026-06-15');
    assert.strictEqual(mondayWeek.deviations[0].weekEnd, '2026-06-21');
    assert.notStrictEqual(sundayWeek.deviations[0].weekStart, mondayWeek.deviations[0].weekStart);
}

function testCompletedMondaySundayRanges() {
    for (const [start, end] of [
        ['2026-06-15', '2026-06-21'],
        ['2026-06-22', '2026-06-28']
    ]) {
        const result = buildWeeklyRepoDeviationPreview({
            rows: rows(start),
            periodStart: '2026-06-01',
            periodEnd: '2026-06-30',
            asOfDate: '2026-06-30',
            resolveWeeklyProfile: fiveDayProfile
        });
        assert.strictEqual(result.deviations[0].week_apo, start);
        assert.strictEqual(result.deviations[0].week_eos, end);
        assert.strictEqual(result.deviations[0].policyVersion, POLICY_VERSION);
        assert.strictEqual(result.deviations[0].expected_repo, 2);
    }
}

function testContractualProfileControlsExpectedRepo() {
    const sixDay = buildWeeklyRepoDeviationPreview({
        rows: rows('2026-06-15'),
        periodStart: '2026-06-01',
        periodEnd: '2026-06-30',
        asOfDate: '2026-06-30',
        resolveWeeklyProfile: () => ({
            expectedWeeklyRepo: 1,
            repoResolutionReason: null,
            effectiveProfile: { hmeres_ergasias_ebdomadas: 6 }
        })
    });
    assert.strictEqual(sixDay.deviations[0].expected_repo, 1);

    const changed = buildWeeklyRepoDeviationPreview({
        rows: rows('2026-06-15'),
        periodStart: '2026-06-01',
        periodEnd: '2026-06-30',
        asOfDate: '2026-06-30',
        resolveWeeklyProfile: () => ({
            expectedWeeklyRepo: null,
            repoResolutionReason: 'PROFILE_CHANGED_INSIDE_WEEK',
            effectiveProfile: { profile_changed_inside_week: true }
        })
    });
    assert.strictEqual(changed.deviations[0].status, STATUS.NEEDS_HR_DECISION);
    assert.deepStrictEqual(changed.deviations[0].reasons, ['PROFILE_CHANGED_INSIDE_WEEK']);
}

function testOpenTrailingWeekIsPendingNotDeviation() {
    const result = buildWeeklyRepoDeviationPreview({
        rows: rows('2026-06-29'),
        periodStart: '2026-06-01',
        periodEnd: '2026-06-30',
        asOfDate: '2026-06-30',
        resolveWeeklyProfile: fiveDayProfile
    });
    assert.strictEqual(result.deviations.length, 0);
    assert.strictEqual(result.pendingWeeks.length, 1);
    assert.strictEqual(result.pendingWeeks[0].status, STATUS.OPEN_WEEK_PENDING_COMPLETION);
    assert.strictEqual(result.pendingWeeks[0].complete, false);
    assert.strictEqual(result.pendingWeeks[0].weekStart, '2026-06-29');
    assert.strictEqual(result.pendingWeeks[0].weekEnd, '2026-07-05');
}

function testLegacyPersistedRangeIsExplicit() {
    const legacy = normalizeLegacyDeviation({
        week_apo: '2026-06-14',
        week_eos: '2026-06-20'
    });
    assert.strictEqual(legacy.is_legacy_policy, true);
    assert.strictEqual(legacy.policyVersion, null);
    assert.strictEqual(legacy.legacy_label, 'Ιστορική εγγραφή παλιάς πολιτικής');

    const current = normalizeLegacyDeviation({
        week_apo: '2026-06-15',
        week_eos: '2026-06-21',
        policyVersion: POLICY_VERSION
    });
    assert.strictEqual(current.is_legacy_policy, false);
}

testSundayAndMondayUseDifferentBuckets();
testCompletedMondaySundayRanges();
testContractualProfileControlsExpectedRepo();
testOpenTrailingWeekIsPendingNotDeviation();
testLegacyPersistedRangeIsExplicit();

console.log('weekly repo deviation Monday-Sunday preview tests passed');
