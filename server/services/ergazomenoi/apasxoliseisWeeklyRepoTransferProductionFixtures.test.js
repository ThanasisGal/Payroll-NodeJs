const assert = require('assert');
const fixtures = require('./fixtures/weeklyRepoTransferProductionRegressionFixtures');
const {
    analyzeWeeklyRepoTransferForEmploymentContract
} = require('./apasxoliseisWeeklyRepoTransferSinglePairService');
const {
    resolveDailyActualWorkFacts
} = require('./apasxoliseisDailyActualWorkFactsService');
const {
    analyzeWeeklySixthSeventhDay
} = require('./apasxoliseisWeeklySixthSeventhDayPolicyService');

const outcomes = fixtures.map((fixture) => {
    const replayRows = fixture.rows.map((row) => ({
            ...row,
            team: 'THA',
            company_kod: '0004',
            kodikos: fixture.employeeCode,
            ypokatasthma: '0000'
        }));
    const analysis = analyzeWeeklyRepoTransferForEmploymentContract({
        weekRows: replayRows,
        employmentProfile: fixture.employmentProfile
    });
    const dailyFacts = replayRows.map(resolveDailyActualWorkFacts);
    const sixthSeventh = analyzeWeeklySixthSeventhDay({
        weekRows: replayRows,
        effectiveProfile: fixture.employmentProfile
    });
    const resolution = analysis.weekly_resolution;
    return {
        employeeCode: fixture.employeeCode,
        week: fixture.week,
        currentRepos: resolution?.current_actual_repo ?? replayRows.filter(
            (row) =>
                Number(row.cards_ores_ergasias) === 0 &&
                (row.repo_apologistika || row.kathgoria_ergasias_apologistika === 'ΑΝ')
        ).length,
        resolvedRepos: resolution?.resolved_repo ?? null,
        actualWorkdays: resolution?.actual_workdays ??
            dailyFacts.filter((fact) => fact.countsAsActualWorkDay).length,
        sixthDay: resolution?.sixth_day?.hmeromhnia ||
            sixthSeventh.sixthDay?.hmeromhnia || null,
        seventhDay: resolution?.seventh_day?.hmeromhnia ||
            sixthSeventh.seventhDay?.hmeromhnia || null,
        sixthDayStatus: sixthSeventh.status,
        sixthDayReasons: sixthSeventh.reasons,
        source: analysis.source?.hmeromhnia || null,
        target: analysis.target?.hmeromhnia || null,
        eligibility: analysis.eligibility_status,
        reasons: analysis.reasons
    };
});

assert.deepStrictEqual(
    outcomes.map(({ employeeCode, week, eligibility }) => ({
        employeeCode,
        week,
        eligibility
    })),
    [
        { employeeCode: '0005', week: '2026-06-01/2026-06-07', eligibility: 'NEEDS_REVIEW' },
        { employeeCode: '0002', week: '2026-06-15/2026-06-21', eligibility: 'NEEDS_REVIEW' },
        { employeeCode: '0002', week: '2026-06-22/2026-06-28', eligibility: 'NEEDS_REVIEW' },
        { employeeCode: '0003', week: '2026-06-01/2026-06-07', eligibility: 'NOT_APPLICABLE' }
    ]
);
for (const outcome of outcomes.slice(0, 3)) {
    assert.ok(outcome.reasons.includes('NO_SOURCE_CANDIDATE'));
    assert.ok(outcome.reasons.includes('SOURCE_ALREADY_PROCESSED'));
}
assert.strictEqual(outcomes[0].sixthDayStatus, 'READY');
for (const outcome of outcomes.slice(1, 3)) {
    assert.strictEqual(outcome.sixthDayStatus, 'NEEDS_HR_DECISION');
    assert.ok(
        outcome.sixthDayReasons.includes(
            'MISSING_OR_INVALID_SIXTH_DAY_PREMIUM_RATE'
        )
    );
}
assert.ok(
    fixtures.every(
        (fixture) =>
            fixture.rows.every(
                (row) =>
                    !Object.hasOwn(row, '_id') &&
                    !Object.hasOwn(row, 'name') &&
                    !Object.hasOwn(row, 'afm') &&
                    !Object.hasOwn(row, 'amka') &&
                    !Object.hasOwn(row, 'user_id')
            )
    )
);

console.log(JSON.stringify(outcomes, null, 2));
console.log('sanitized production weekly fixture replay tests passed');
