const assert = require('assert');
const {
    POLICY_VERSION,
    STATUS,
    normalizeLegacyDeviation,
    buildWeeklyRepoDeviationPreview,
    attachSixthDayPresentationToRows,
    resolveWeeklyRepoPreviewAsOfDate
} = require('./apasxoliseisWeeklyRepoDeviationPreviewService');
const {
    analyzeWeeklyRepoTransferForEmploymentContract
} = require('./apasxoliseisWeeklyRepoTransferSinglePairService');
const {
    analyzeWeeklySixthSeventhDay
} = require('./apasxoliseisWeeklySixthSeventhDayPolicyService');
const {
    buildWeeklyRepoTransferAtomicPageProjection
} = require('./apasxoliseisWeeklyRepoTransferAtomicPageProjectionService');
const {
    buildWeeklyRepoTransferSinglePairGroupProjection
} = require('./apasxoliseisWeeklyRepoTransferSinglePairGroupProjectionService');
const productionFixtures = require('./fixtures/weeklyRepoTransferProductionRegressionFixtures');

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
        assert.strictEqual(result.deviations[0].missing_repo, 2);
        assert.strictEqual(result.deviations[0].effective_expected_repo, 2);
        assert.strictEqual(result.deviations[0].effective_weekly_workdays, 5);
        assert.strictEqual(
            result.deviations[0].expected_repo_source,
            'CONTRACTUAL_WEEKLY_WORKDAYS'
        );
    }
}

function testDepartureWeekDoesNotCreateWeeklyPolicyChecks() {
    const result = buildWeeklyRepoDeviationPreview({
        rows: rows('2026-06-01', 2),
        periodStart: '2026-06-01',
        periodEnd: '2026-06-30',
        asOfDate: '2026-06-30',
        resolveWeeklyProfile: fiveDayProfile,
        resolveEmploymentPeriod: () => ({
            employmentStart: '2025-01-01',
            employmentEnd: '2026-06-02'
        })
    });

    assert.deepStrictEqual(result.deviations, []);
    assert.deepStrictEqual(result.pendingWeeks, []);
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

    const fourDay = buildWeeklyRepoDeviationPreview({
        rows: rows('2026-06-15'),
        periodStart: '2026-06-01',
        periodEnd: '2026-06-30',
        asOfDate: '2026-06-30',
        resolveWeeklyProfile: () => ({
            expectedWeeklyRepo: 99,
            repoResolutionReason: null,
            effectiveProfile: {
                hmeres_ergasias_ebdomadas: 4
            }
        })
    });
    assert.strictEqual(fourDay.deviations[0].expected_repo, 3);

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
    assert.strictEqual(changed.deviations[0].sixth_seventh_day_status, 'NEEDS_HR_DECISION');
    assert.deepStrictEqual(
        changed.deviations[0].sixth_seventh_day_reasons,
        ['PROFILE_CHANGED_INSIDE_WEEK']
    );
    assert.strictEqual(changed.deviations[0].sixth_day_count, 0);
    assert.strictEqual(changed.deviations[0].seventh_day_count, 0);
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

function testCompletedHistoricalReconstructionEvaluatesCrossMonthWeek() {
    const historicalAsOf = resolveWeeklyRepoPreviewAsOfDate({
        sessionAppDate: '2026-06-30',
        periodEnd: '2026-06-30',
        periodControl: {
            historical_reconstruction_status: 'COMPLETED',
            historical_reconstruction_completed_at: '2026-08-12T11:23:27.960Z'
        }
    });
    assert.strictEqual(historicalAsOf, '2026-08-12');
    const contextRows = rows('2026-06-29');
    assert.deepStrictEqual(
        contextRows.slice(2).map((row) => row.hmeromhnia),
        ['2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04', '2026-07-05']
    );
    const result = buildWeeklyRepoDeviationPreview({
        rows: contextRows,
        periodStart: '2026-06-01',
        periodEnd: '2026-06-30',
        asOfDate: historicalAsOf,
        resolveWeeklyProfile: fiveDayProfile
    });
    assert.strictEqual(result.pendingWeeks.length, 0);
    assert.strictEqual(result.deviations.length, 1);
    assert.strictEqual(result.deviations[0].weekStart, '2026-06-29');
    assert.strictEqual(result.deviations[0].weekEnd, '2026-07-05');
}

function repoTransferWeek({ applied = false } = {}) {
    return rows('2026-06-22', 7, {
        2: {
            kathgoria_ergasias: 'ΑΝ',
            ores_ergasias: 0,
            cards_ores_ergasias: 0
        },
        ...(applied
            ? {
                  4: {
                      kathgoria_ergasias: 'ΕΡΓ',
                      kathgoria_ergasias_apologistika: 'ΑΝ',
                      repo_apologistika: true,
                      ores_ergasias: 8,
                      ores_ergasias_apologistika: 0,
                      cards_ores_ergasias: 0
                  }
              }
            : {})
    });
}

function previewRepoTransferWeek(options = {}) {
    return buildWeeklyRepoDeviationPreview({
        rows: repoTransferWeek(options),
        periodStart: '2026-06-01',
        periodEnd: '2026-06-30',
        asOfDate: '2026-06-30',
        resolveWeeklyProfile: fiveDayProfile,
        resolveDailyProfile: () => ({ fullTime: true }),
        isFullTimeProfile: (profile) => profile.fullTime === true
    });
}

function testRepoTransferLifecycleUsesEffectiveFinalRows() {
    const beforeApply = previewRepoTransferWeek();
    assert.strictEqual(beforeApply.deviations.length, 1);
    assert.strictEqual(beforeApply.deviations[0].expected_repo, 2);
    assert.strictEqual(beforeApply.deviations[0].actual_repo, 1);

    // An approval without an APPLIED execution does not alter the raw daily rows.
    const approvedWithoutExecution = previewRepoTransferWeek();
    assert.strictEqual(approvedWithoutExecution.deviations.length, 1);
    assert.strictEqual(approvedWithoutExecution.deviations[0].actual_repo, 1);

    const applied = previewRepoTransferWeek({ applied: true });
    assert.strictEqual(applied.deviations.length, 0);
    assert.strictEqual(applied.pendingWeeks.length, 0);

    const rolledBack = previewRepoTransferWeek();
    assert.strictEqual(rolledBack.deviations.length, 1);
    assert.strictEqual(rolledBack.deviations[0].expected_repo, 2);
    assert.strictEqual(rolledBack.deviations[0].actual_repo, 1);
}

function previewCanonicalRepoState(repoRow, { partial = false } = {}) {
    const weekRows = rows('2026-06-15');
    weekRows[6] = { ...weekRows[6], ...repoRow };
    return buildWeeklyRepoDeviationPreview({
        rows: weekRows,
        periodStart: '2026-06-01',
        periodEnd: '2026-06-30',
        asOfDate: '2026-06-30',
        resolveWeeklyProfile: () => ({
            repoResolutionReason: null,
            effectiveProfile: {
                hmeres_ergasias_ebdomadas: partial ? 5 : 5,
                typos_apasxolhshs: partial ? '1' : '0'
            }
        }),
        resolveDailyProfile: () => ({ fullTime: !partial }),
        isFullTimeProfile: (profile) => profile.fullTime === true
    });
}

function testCanonicalCurrentRepoStateAndApprovalIsolation() {
    const baseRepo = previewCanonicalRepoState({
        kathgoria_ergasias: 'ΑΝ',
        repo: true,
        ores_ergasias: 0,
        cards_ores_ergasias: 0
    });
    assert.strictEqual(baseRepo.deviations[0].actual_repo, 1);

    const appliedSource = previewCanonicalRepoState({
        kathgoria_ergasias: 'ΑΝ',
        repo: true,
        kathgoria_ergasias_apologistika: 'ΕΡΓ',
        repo_apologistika: false,
        ores_ergasias_apologistika: 0,
        cards_ores_ergasias: 0
    });
    assert.strictEqual(appliedSource.deviations[0].actual_repo, 0);

    const appliedTarget = previewCanonicalRepoState({
        kathgoria_ergasias: 'ΕΡΓ',
        repo: false,
        kathgoria_ergasias_apologistika: 'ΑΝ',
        repo_apologistika: true,
        ores_ergasias_apologistika: 0,
        cards_ores_ergasias: 0
    });
    assert.strictEqual(appliedTarget.deviations[0].actual_repo, 1);

    const partialTarget = previewCanonicalRepoState({
        kathgoria_ergasias: 'ΕΡΓ',
        repo: false,
        kathgoria_ergasias_apologistika: 'ΜΕ',
        repo_apologistika: true,
        ores_ergasias_apologistika: 0,
        cards_ores_ergasias: 0
    }, { partial: true });
    assert.strictEqual(partialTarget.deviations[0].actual_repo, 1);

    const defaultFalse = previewCanonicalRepoState({
        kathgoria_ergasias: 'ΑΝ',
        repo: true,
        kathgoria_ergasias_apologistika: '',
        repo_apologistika: false,
        ores_ergasias: 0,
        cards_ores_ergasias: 0
    });
    assert.strictEqual(defaultFalse.deviations[0].actual_repo, 1);

    for (const metadata of [
        { reuse_status: 'ACTIVE', approval_id: 'synthetic-approval' },
        { reusable_decision: { status: 'RESOLVED_BY_POLICY' } },
        { decision_status: 'RECORDED', decision_type: 'APPROVE_PROPOSAL' }
    ]) {
        const approvalOnly = previewCanonicalRepoState({
            kathgoria_ergasias: 'ΑΝ',
            repo: true,
            ores_ergasias: 0,
            cards_ores_ergasias: 0,
            fingerprint: 'synthetic-fingerprint',
            ...metadata
        });
        assert.strictEqual(approvalOnly.deviations[0].actual_repo, 1);
    }

    const conflict = previewCanonicalRepoState({
        kathgoria_ergasias: 'ΕΡΓ',
        repo: false,
        kathgoria_ergasias_apologistika: 'ΕΡΓ',
        repo_apologistika: true,
        ores_ergasias_apologistika: 0,
        cards_ores_ergasias: 0
    });
    assert.strictEqual(conflict.deviations[0].actual_repo, 0);
    assert.strictEqual(conflict.deviations[0].status, STATUS.NEEDS_HR_DECISION);
    assert.ok(conflict.deviations[0].reasons.includes('CATEGORY_REPO_CONFLICT'));
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

function testDeviationAndAtomicUseTheSameContractSelector() {
    const profiles = [
        { typos_apasxolhshs: '0', hmeres_ergasias_ebdomadas: 5 },
        { typos_apasxolhshs: 'MERIKH', hmeres_ergasias_ebdomadas: 6 },
        { typos_apasxolhshs: 'EK_PERITROPHS', hmeres_ergasias_ebdomadas: 6 },
        {
            typos_apasxolhshs: 'MERIKH',
            hmeres_ergasias_ebdomadas: 3,
            mo_oron_hmerhsias_ergasias: 4
        }
    ];
    const capturedVersions = [];
    for (const profile of profiles) {
        const weekRows = rows('2026-06-22').map((row, index) => ({
            ...row,
            _id: `contract-${profile.typos_apasxolhshs}-${index}`,
            team: 'THA',
            company_kod: '0004'
        }));
        const isFull = profile.typos_apasxolhshs === '0';
        Object.assign(weekRows[0], {
            kathgoria_ergasias: isFull ? 'ΑΝ' : 'ΜΕ',
            ores_ergasias: 0
        });
        Object.assign(weekRows[6], {
            cards_ores_ergasias: 0,
            adeia_apologistika: isFull,
            kathgoria_adeias_apologistika: isFull ? 'ΑΔΑΛ' : ''
        });
        const direct = analyzeWeeklyRepoTransferForEmploymentContract({
            weekRows,
            employmentProfile: profile
        });
        const sixthSeventhDay = analyzeWeeklySixthSeventhDay({
            weekRows,
            effectiveProfile: profile
        });
        const preview = buildWeeklyRepoDeviationPreview({
            rows: weekRows,
            periodStart: '2026-06-01',
            periodEnd: '2026-06-30',
            asOfDate: '2026-06-30',
            resolveWeeklyProfile: () => ({
                expectedWeeklyRepo: 7 - profile.hmeres_ergasias_ebdomadas,
                effectiveProfile: profile
            })
        });
        const deviation = preview.deviations[0];
        assert.strictEqual(deviation.repo_transfer_status, direct.eligibility_status);
        assert.deepStrictEqual(deviation.repo_transfer_reasons, direct.reasons);
        assert.strictEqual(
            deviation.resolved_repo,
            direct.weekly_resolution?.resolved_repo ?? deviation.actual_repo
        );
        assert.strictEqual(
            deviation.sixth_day_count,
            sixthSeventhDay.sixthDay ? 1 : 0
        );
        assert.strictEqual(
            deviation.seventh_day_count,
            sixthSeventhDay.seventhDay ? 1 : 0
        );
        buildWeeklyRepoTransferAtomicPageProjection(
            { weeklyInputs: [{ weekRows, employmentProfile: profile }] },
            {
                singleWeekProjectionBuilder: ({ contractVersion }) => {
                    capturedVersions.push(contractVersion);
                    return {
                        projection_status: 'NOT_AVAILABLE',
                        reasons: direct.reasons,
                        warnings: [],
                        groups: [],
                        review_outcomes: []
                    };
                }
            }
        );
    }
    assert.deepStrictEqual(capturedVersions, ['v1', 'v2', 'v2', 'v2']);
}

function testSixthDaySurvivesMissingRepoTransferSource() {
    const weekRows = rows('2026-06-01');
    weekRows.forEach((row, index) => {
        Object.assign(row, {
            _id: `employee-0006-${index}`,
            team: 'THA',
            company_kod: '0004',
            ypokatasthma: '0000',
            kodikos: '0006'
        });
    });
    Object.assign(weekRows[0], {
        kathgoria_ergasias: 'ΑΝ',
        ores_ergasias: 0,
        cards_ores_ergasias: 0,
        cards_apo_ora_01: '',
        cards_eos_ora_01: ''
    });
    weekRows.slice(1).forEach((row) => {
        Object.assign(row, {
            cards_apo_ora_01: '09:00',
            cards_eos_ora_01: '17:00'
        });
    });
    Object.assign(weekRows[6], {
        kathgoria_ergasias_apologistika: 'ΑΝ',
        repo_apologistika: true
    });
    const profile = {
        hmeres_ergasias_ebdomadas: 5,
        typos_apasxolhshs: '0',
        pososto_prosayxhshs_6hs_hmeras: 40
    };
    const preview = buildWeeklyRepoDeviationPreview({
        rows: weekRows,
        periodStart: '2026-06-01',
        periodEnd: '2026-06-07',
        asOfDate: '2026-06-08',
        resolveWeeklyProfile: () => ({
            expectedWeeklyRepo: 2,
            effectiveProfile: profile
        })
    });
    const deviation = preview.deviations[0];

    assert.strictEqual(deviation.repo_transfer_status, 'NOT_APPLICABLE');
    assert.ok(deviation.repo_transfer_reasons.includes('NO_SOURCE_CANDIDATE'));
    assert.strictEqual(deviation.actual_workdays, 6);
    assert.strictEqual(deviation.sixth_day_count, 1);
    assert.strictEqual(deviation.seventh_day_count, 0);
    assert.strictEqual(deviation.sixth_day_date, '2026-06-07');
    assert.strictEqual(deviation.sixth_day_premium_rate, 40);
}

function testDeviationAndAtomicContextParity() {
    const fixture = productionFixtures[0];
    const baseRows = fixture.rows.map((row) => ({
        ...row,
        _id: `parity-${row.hmeromhnia}`,
        team: 'THA',
        company_kod: '0004',
        ypokatasthma: '0000',
        kodikos: '0005'
    }));
    const cases = [
        { name: 'automatic leave target', profile: fixture.employmentProfile },
        {
            name: 'holiday target',
            profile: fixture.employmentProfile,
            holidayByDateKey: new Map([
                ['2026-06-04', { blocksRepoTransfer: true }]
            ])
        },
        {
            name: 'audited source',
            profile: fixture.employmentProfile,
            existingAuditCountByRowKey: new Map([
                ['parity-2026-06-02', 1]
            ])
        },
        {
            name: 'partial contract',
            profile: { ...fixture.employmentProfile, typos_apasxolhshs: 'MERIKH' }
        },
        {
            name: 'rotational contract',
            profile: {
                ...fixture.employmentProfile,
                typos_apasxolhshs: 'EK_PERITROPHS'
            }
        }
    ];

    for (const parityCase of cases) {
        const holidayByDateKey = parityCase.holidayByDateKey || new Map();
        const existingAuditCountByRowKey =
            parityCase.existingAuditCountByRowKey || new Map();
        const preview = buildWeeklyRepoDeviationPreview({
            rows: baseRows,
            periodStart: '2026-06-01',
            periodEnd: '2026-06-07',
            asOfDate: '2026-06-08',
            holidayByDateKey,
            existingAuditCountByRowKey,
            resolveWeeklyProfile: () => ({
                expectedWeeklyRepo: 2,
                effectiveProfile: parityCase.profile
            })
        });
        const deviation = preview.deviations[0];
        const atomic = buildWeeklyRepoTransferSinglePairGroupProjection({
            weekRows: baseRows,
            employmentProfile: parityCase.profile,
            holidayByDateKey,
            existingAuditCountByRowKey,
            contractVersion:
                parityCase.profile.typos_apasxolhshs === '0' ? 'v1' : 'v2'
        });
        const group = atomic.groups[0] || null;
        const atomicResolution = group?.repo_resolution || atomic.repo_resolution;

        assert.strictEqual(
            deviation.repo_transfer_status,
            group ? 'ELIGIBLE' : atomic.eligibility_status,
            parityCase.name
        );
        assert.deepStrictEqual(
            deviation.repo_transfer_reasons,
            atomic.reasons,
            parityCase.name
        );
        assert.strictEqual(
            deviation.repo_transfer_source_available,
            group
                ? group.items.some((item) => item.role === 'SOURCE_BECOMES_WORK')
                : atomic.source_available,
            parityCase.name
        );
        assert.strictEqual(
            deviation.repo_transfer_target_available,
            group
                ? group.items.some((item) => item.role === 'TARGET_BECOMES_REPO')
                : atomic.target_available,
            parityCase.name
        );
        assert.strictEqual(
            deviation.resolved_repo,
            atomicResolution?.resolved_repo ?? deviation.actual_repo,
            parityCase.name
        );
        assert.strictEqual(
            deviation.sixth_day_count,
            atomicResolution?.sixth_day_count ?? 0,
            parityCase.name
        );
        assert.strictEqual(
            deviation.seventh_day_count,
            atomicResolution?.seventh_day_count ?? 0,
            parityCase.name
        );
    }
}

function testSixthDayPresentationIsAttachedOnlyToTheMatchingDailyRow() {
    const reviewRows = attachSixthDayPresentationToRows(
        [
            { kodikos: '0006', hmeromhnia: '2026-06-05' },
            { kodikos: '0006', hmeromhnia: '2026-06-06' },
            { kodikos: '0007', hmeromhnia: '2026-06-06' }
        ],
        [
            {
                kodikos: '0006',
                sixth_day_date: '2026-06-06',
                sixth_day_premium_rate: 0,
                sixth_seventh_day_status: 'READY'
            }
        ]
    );

    assert.strictEqual(reviewRows[0].is_sixth_day, false);
    assert.strictEqual(reviewRows[0].sixth_day_premium_rate, null);
    assert.strictEqual(reviewRows[1].is_sixth_day, true);
    assert.strictEqual(reviewRows[1].sixth_day_premium_rate, 0);
    assert.strictEqual(reviewRows[1].sixth_day_policy_status, 'READY');
    assert.strictEqual(reviewRows[2].is_sixth_day, false);
}

testSundayAndMondayUseDifferentBuckets();
testCompletedMondaySundayRanges();
testDepartureWeekDoesNotCreateWeeklyPolicyChecks();
testContractualProfileControlsExpectedRepo();
testOpenTrailingWeekIsPendingNotDeviation();
testCompletedHistoricalReconstructionEvaluatesCrossMonthWeek();
testRepoTransferLifecycleUsesEffectiveFinalRows();
testCanonicalCurrentRepoStateAndApprovalIsolation();
testLegacyPersistedRangeIsExplicit();
testDeviationAndAtomicUseTheSameContractSelector();
testDeviationAndAtomicContextParity();
testSixthDaySurvivesMissingRepoTransferSource();
testSixthDayPresentationIsAttachedOnlyToTheMatchingDailyRow();

console.log('weekly repo deviation Monday-Sunday preview tests passed');
