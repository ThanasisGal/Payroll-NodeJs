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
        hmeromhnia: `2026-06-${String(7 + index).padStart(2, '0')}`,
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
        mhniaia_repo: 0,
        hmeres_ergasias_ebdomadas: 5
    });
    assert.strictEqual(result.effectiveExpectedWeeklyRepo, 2);
    assert.strictEqual(result.repoResolutionSource, REPO_RESOLUTION_SOURCE.WEEKLY_WORKDAYS_FALLBACK);
}

{
    const result = resolve(scheduledRows(5), {
        mhniaia_repo: 0,
        hmeres_ergasias_ebdomadas: 6
    });
    assert.strictEqual(result.effectiveExpectedWeeklyRepo, 1);
}

for (const mhniaiaRepo of [1, 2]) {
    const result = resolve(scheduledRows(5), {
        mhniaia_repo: mhniaiaRepo,
        hmeres_ergasias_ebdomadas: 6
    });
    assert.strictEqual(result.effectiveExpectedWeeklyRepo, mhniaiaRepo);
    assert.strictEqual(result.repoResolutionSource, REPO_RESOLUTION_SOURCE.EXPLICIT_MHNIAIA_REPO);
}

for (const mhniaiaRepo of [0, 2]) {
    const result = resolve(scheduledRows(6), {
        mhniaia_repo: mhniaiaRepo,
        hmeres_ergasias_ebdomadas: 5
    });
    assert.strictEqual(result.effectiveExpectedWeeklyRepo, 1);
    assert.strictEqual(result.repoResolutionSource, REPO_RESOLUTION_SOURCE.SIX_SCHEDULED_WORK_DAYS);
    assert.strictEqual(result.scheduledWorkDays, 6);
    assert.strictEqual(result.effectiveWeeklyWorkdays, 6);
}

for (const invalid of [7, 1.5, 'invalid', -1]) {
    const result = resolve(scheduledRows(5), {
        mhniaia_repo: invalid,
        hmeres_ergasias_ebdomadas: 5
    });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.reason, REPO_RESOLUTION_REASON.INVALID_EXPLICIT_MHNIAIA_REPO);
}

{
    const result = resolve(scheduledRows(5, { cardsOnlySixth: true }), {
        mhniaia_repo: 0,
        hmeres_ergasias_ebdomadas: 5
    });
    assert.strictEqual(result.scheduledWorkDays, 5);
    assert.strictEqual(result.effectiveExpectedWeeklyRepo, 2);
}

function regressionWeek() {
    const categories = ['ΕΡΓ', 'ΑΝ', 'ΕΡΓ', 'ΕΡΓ', 'ΕΡΓ', 'ΕΡΓ', 'ΕΡΓ'];
    return categories.map((category, index) => {
        const date = `2026-06-${String(7 + index).padStart(2, '0')}`;
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
            mhniaia_repo: 2,
            hmeres_ergasias_ebdomadas: 5
        }
    });
    assert.strictEqual(result.employee.effective_expected_weekly_repo, 1);
    assert.strictEqual(result.employee.repo_resolution_source, 'SIX_SCHEDULED_WORK_DAYS');
    assert.ok(!result.reasons.includes('REPO_DEFICIT_REMAINS'));
    assert.strictEqual(result.eligibility_status, ELIGIBILITY_STATUS.ELIGIBLE);
    assert.strictEqual(result.source.hmeromhnia, '2026-06-08');
    assert.strictEqual(result.target.hmeromhnia, '2026-06-10');
}

console.log('weekly repo-transfer effective expected repo resolver tests passed');
