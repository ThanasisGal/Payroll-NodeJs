'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const { dateKeyUtc } = require('../../utils/date/mondaySundayWeek');
const {
    isWeekAllowedForEmploymentPeriod
} = require('../../services/ergazomenoi/apasxoliseisPeriodControlService');
const {
    deriveEmploymentOwnedDateScope
} = require('../../services/ergazomenoi/apasxoliseisEmploymentPeriodScopeService');
const {
    deriveStage1PeriodSlice
} = require('../../services/ergazomenoi/apasxoliseisStage1PeriodSliceService');

const controller = fs.readFileSync(path.join(__dirname, 'erganhController.js'), 'utf8');
const guardStart = controller.indexOf(
    'async function assertActiveEmploymentReviewPeriodPresentationReadable'
);
const guardEnd = controller.indexOf(
    'async function loadEmploymentPeriodFrozenSnapshotInput', guardStart
);
assert.notStrictEqual(guardStart, -1, 'Missing Stage 1 presentation read guard');
assert.notStrictEqual(guardEnd, -1, 'Missing end of Stage 1 presentation read guard');
const guardSource = controller.slice(guardStart, guardEnd);

const activeScope = Object.freeze({
    team: 'team-1',
    company_kod: 'company-1',
    ypokatasthma: '0000',
    period_start: '2026-01-01',
    period_end: '2026-01-31'
});
const normalState = Object.freeze({
    effective_mode: 'NORMAL',
    has_authoritative_calculation_result: false
});

const presentationGuard = vm.runInNewContext(`(() => {
    ${guardSource}
    return assertActiveEmploymentReviewPeriodPresentationReadable;
})()`, {
    activeEmploymentReviewPeriodScope: async () => activeScope,
    getPeriodControl: async () => normalState,
    isWeekAllowedForEmploymentPeriod,
    resolveWeeklyRepoPreviewAsOfDate: () => new Date('2026-01-31T00:00:00.000Z'),
    dateKeyUtc
});

function requiredRange({ weekStart, weekEnd, periodStart, periodEnd, authoritativeDates }) {
    return {
        kind: 'WEEKLY_CONTEXT',
        start: new Date(`${weekStart}T00:00:00.000Z`),
        end: new Date(`${weekEnd}T00:00:00.000Z`),
        periodStart,
        periodEnd,
        requiredAuthoritativeDates: authoritativeDates,
        authoritativeRowDates: authoritativeDates.map((date) =>
            new Date(`${date}T00:00:00.000Z`))
    };
}

async function assertReadable(range) {
    const result = await presentationGuard({ session: {} }, '0000', range);
    assert.strictEqual(result.scope, activeScope);
    assert.strictEqual(result.state, normalState);
}

const cases = [
    ['full-month leading control', async () => {
        await assertReadable(requiredRange({
            weekStart: '2025-12-29',
            weekEnd: '2026-01-04',
            periodStart: '2026-01-01',
            periodEnd: '2026-01-31',
            authoritativeDates: [
                '2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04'
            ]
        }));
    }],
    ['partial leading boundary is presentation-readable', async () => {
        await assertReadable(requiredRange({
            weekStart: '2025-12-29',
            weekEnd: '2026-01-04',
            periodStart: '2026-01-02',
            periodEnd: '2026-01-31',
            authoritativeDates: ['2026-01-02', '2026-01-03', '2026-01-04']
        }));
    }],
    ['partial trailing boundary is presentation-readable in NORMAL mode', async () => {
        await assertReadable(requiredRange({
            weekStart: '2026-01-26',
            weekEnd: '2026-02-01',
            periodStart: '2026-01-02',
            periodEnd: '2026-01-31',
            authoritativeDates: [
                '2026-01-26', '2026-01-27', '2026-01-28',
                '2026-01-29', '2026-01-30', '2026-01-31'
            ]
        }));
    }],
    ['outside-period presentation slice remains rejected', async () => {
        await assert.rejects(() => presentationGuard({ session: {} }, '0000', requiredRange({
            weekStart: '2025-12-29',
            weekEnd: '2026-01-04',
            periodStart: '2025-12-31',
            periodEnd: '2026-01-31',
            authoritativeDates: [
                '2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04'
            ]
        })), { code: 'PERIOD_CONTROL_SCOPE_MISMATCH', statusCode: 409 });
    }],
    ['partial leading context remains non-actionable', async () => {
        const employmentDateScope = deriveEmploymentOwnedDateScope({
            natural_week_start: '2025-12-29',
            natural_week_end: '2026-01-04',
            period_start: '2026-01-02',
            period_end: '2026-01-31'
        });
        const weekRows = employmentDateScope.employment_owned_dates.map((hmeromhnia) =>
            ({ hmeromhnia }));
        const periodSlice = deriveStage1PeriodSlice({
            weekRows,
            week_start: '2025-12-29',
            week_end: '2026-01-04',
            period_start: '2026-01-02',
            period_end: '2026-01-31',
            employment_date_scope: employmentDateScope
        });
        assert.deepStrictEqual([...employmentDateScope.authoritative_date_set],
            ['2026-01-02', '2026-01-03', '2026-01-04']);
        assert.deepStrictEqual([...periodSlice.actionable_dates],
            ['2026-01-02', '2026-01-03', '2026-01-04']);
        assert.deepStrictEqual([...periodSlice.context_only_dates], [
            '2025-12-29', '2025-12-30', '2025-12-31', '2026-01-01'
        ]);
    }]
];

(async () => {
    const failures = [];
    for (const [name, test] of cases) {
        try {
            await test();
            console.log(`CASE ${name}: PASS`);
        } catch (error) {
            failures.push({ name, error });
            console.error(`CASE ${name}: FAIL - ${error.code || error.message}`);
        }
    }
    assert.strictEqual(failures.length, 0,
        `Stage 1 partial-display boundary failures: ${failures
            .map(({ name }) => name).join(', ')}`);
    console.log('Stage 1 partial-display boundary presentation regression: PASS');
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
