const assert = require('assert');
const {
    REPO_RESOLUTION_SOURCE,
    REPO_RESOLUTION_REASON,
    resolveEffectiveExpectedWeeklyRepo
} = require('./apasxoliseisWeeklyRepoTransferExpectedRepoResolverService');
const {
    analyzeWeeklyRepoTransferSinglePairV1,
    analyzeWeeklyRepoTransferSinglePairV2,
    ELIGIBILITY_STATUS
} = require('./apasxoliseisWeeklyRepoTransferSinglePairService');

function scheduledRows(count, { cardsOnlySixth = false } = {}) {
    return Array.from({ length: 7 }, (_, index) => ({
        hmeromhnia: `2026-06-${String(8 + index).padStart(2, '0')}`,
        kathgoria_ergasias: index < count ? 'ΕΡΓ' : 'ΑΝ',
        ores_ergasias: index < count ? 8 : 0,
        ...(cardsOnlySixth && index === 5
            ? { kathgoria_ergasias: 'ΑΝ', ores_ergasias: 0, cards_ores_ergasias: 8 }
            : {})
    }));
}

function resolve(rows, profile) {
    return resolveEffectiveExpectedWeeklyRepo({
        weekRows: rows,
        effectiveProfile: profile
    });
}

{
    const result = resolve(scheduledRows(5), {
        hmeres_ergasias_ebdomadas: 5
    });
    assert.strictEqual(result.effectiveExpectedWeeklyRepo, 2);
    assert.strictEqual(result.repoResolutionSource, REPO_RESOLUTION_SOURCE.CONTRACTUAL_WEEKLY_WORKDAYS);
}

for (let contractualWorkdays = 1; contractualWorkdays <= 6; contractualWorkdays++) {
    const result = resolve(scheduledRows(contractualWorkdays), {
        hmeres_ergasias_ebdomadas: contractualWorkdays
    });
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.effectiveExpectedWeeklyRepo, 7 - contractualWorkdays);
    assert.strictEqual(result.effectiveWeeklyWorkdays, contractualWorkdays);
    assert.strictEqual(
        result.repoResolutionSource,
        REPO_RESOLUTION_SOURCE.CONTRACTUAL_WEEKLY_WORKDAYS
    );
}

{
    const result = resolve(scheduledRows(5), {
        hmeres_ergasias_ebdomadas: 6
    });
    assert.strictEqual(result.effectiveExpectedWeeklyRepo, 1);
}

for (const contractualWorkdays of [5, 6]) {
    const result = resolve(scheduledRows(6), {
        hmeres_ergasias_ebdomadas: contractualWorkdays
    });
    assert.strictEqual(result.effectiveExpectedWeeklyRepo, 7 - contractualWorkdays);
    assert.strictEqual(result.repoResolutionSource, REPO_RESOLUTION_SOURCE.CONTRACTUAL_WEEKLY_WORKDAYS);
    assert.strictEqual(result.scheduledWorkDays, 6);
    assert.strictEqual(result.effectiveWeeklyWorkdays, contractualWorkdays);
}

{
    const sevenActualDaysDoNotChangeContract = resolve(scheduledRows(7), {
        hmeres_ergasias_ebdomadas: 5
    });
    assert.strictEqual(sevenActualDaysDoNotChangeContract.effectiveExpectedWeeklyRepo, 2);
    assert.strictEqual(
        sevenActualDaysDoNotChangeContract.repoResolutionSource,
        REPO_RESOLUTION_SOURCE.CONTRACTUAL_WEEKLY_WORKDAYS
    );
}

{
    const contractualProfile = resolve(scheduledRows(5), {
        hmeres_ergasias_ebdomadas: 5
    });
    assert.strictEqual(contractualProfile.effectiveExpectedWeeklyRepo, 2);
    assert.strictEqual(
        contractualProfile.repoResolutionSource,
        REPO_RESOLUTION_SOURCE.CONTRACTUAL_WEEKLY_WORKDAYS
    );

    const changedProfile = resolve(scheduledRows(5), {
        hmeres_ergasias_ebdomadas: 5,
        profile_changed_inside_week: true
    });
    assert.strictEqual(changedProfile.ok, true);
    assert.strictEqual(changedProfile.reason, null);
    assert.strictEqual(changedProfile.effectiveExpectedWeeklyRepo, 2);

    const unresolvedProfile = resolve(scheduledRows(5), {
        hmeres_ergasias_ebdomadas: 5,
        profile_changed_inside_week: true,
        date_effective_profiles_by_date: {
            '2026-06-08': { istorikoId: '0003' },
            '2026-06-09': null
        }
    });
    assert.strictEqual(unresolvedProfile.ok, false);
    assert.strictEqual(
        unresolvedProfile.reason,
        REPO_RESOLUTION_REASON.UNRESOLVED_DAILY_EMPLOYMENT_PROFILE
    );
}

{
    const result = resolve(scheduledRows(5, { cardsOnlySixth: true }), {
        hmeres_ergasias_ebdomadas: 5
    });
    assert.strictEqual(result.scheduledWorkDays, 5);
    assert.strictEqual(result.effectiveExpectedWeeklyRepo, 2);
}

function regressionWeek() {
    const categories = ['ΕΡΓ', 'ΑΝ', 'ΕΡΓ', 'ΕΡΓ', 'ΕΡΓ', 'ΕΡΓ', 'ΕΡΓ'];
    return categories.map((category, index) => {
        const date = `2026-06-${String(8 + index).padStart(2, '0')}`;
        const source = index === 1;
        const target = index === 3;
        const hasCards = source || (!target && category === 'ΕΡΓ');
        return {
            _id: `row-${index}`,
            team: 'team',
            company_kod: 'company',
            ypokatasthma: 'branch',
            kodikos: '0002',
            hmeromhnia: date,
            kathgoria_ergasias: category,
            ores_ergasias: category === 'ΕΡΓ' ? 8 : 0,
            apo_ora_01: category === 'ΕΡΓ' ? '09:00' : '',
            eos_ora_01: category === 'ΕΡΓ' ? '17:00' : '',
            cards_ores_ergasias: hasCards ? 8 : 0,
            cards_apo_ora_01: hasCards ? '09:00' : '',
            cards_eos_ora_01: hasCards ? '17:00' : '',
            kathgoria_ergasias_apologistika: '',
            repo_apologistika: false,
            adeia_apologistika: false,
            astheneia_apologistika: false,
            is_locked: false
        };
    });
}

for (const [type, analyzer] of [
    ['PLHRHS', analyzeWeeklyRepoTransferSinglePairV1],
    ['MERIKH', analyzeWeeklyRepoTransferSinglePairV2],
    ['EK_PERITROPHS', analyzeWeeklyRepoTransferSinglePairV2]
]) {
    const rows = regressionWeek();
    if (type !== 'PLHRHS') rows[1].kathgoria_ergasias = 'ΜΕ';
    const result = analyzer({
        weekRows: rows,
        employmentProfile: {
            typos_apasxolhshs: type,
            hmeres_ergasias_ebdomadas: 5
        }
    });
    assert.strictEqual(result.employee.effective_expected_weekly_repo, 2);
    assert.strictEqual(result.employee.repo_resolution_source, 'CONTRACTUAL_WEEKLY_WORKDAYS');
    if (type === 'PLHRHS') {
        assert.deepStrictEqual(result.reasons, []);
        assert.strictEqual(result.eligibility_status, ELIGIBILITY_STATUS.ELIGIBLE);
    } else {
        assert.ok(result.reasons.includes('REPO_DEFICIT_REMAINS'));
        assert.strictEqual(result.eligibility_status, ELIGIBILITY_STATUS.NEEDS_REVIEW);
    }
}

console.log('weekly repo-transfer effective expected repo resolver tests passed');
