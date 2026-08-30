'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const controller = fs.readFileSync(path.join(__dirname, 'erganhController.js'), 'utf8');
const helperSource = controller.slice(
    controller.indexOf('async function assertActiveEmploymentReviewStage3DayWritable'),
    controller.indexOf('async function loadWeeklyHrStage2CompletionContext')
);
assert.ok(helperSource.startsWith(
    'async function assertActiveEmploymentReviewStage3DayWritable'
));

const guardCalls = [];
const activeScope = { period_start: new Date('2026-01-01T00:00:00.000Z'),
    period_end: new Date('2026-01-31T00:00:00.000Z') };
const authorize = vm.runInNewContext(`(() => {
    ${helperSource}
    return assertActiveEmploymentReviewStage3DayWritable;
})()`, {
    assertActiveEmploymentReviewPeriodReadable: async (_req, _branch, requiredRange) => {
        guardCalls.push(requiredRange);
        return { scope: activeScope, state: { effective_mode: 'NORMAL' }, token: 'token' };
    },
    weeklyHrApiError: (code, statusCode, message) =>
        Object.assign(new Error(message), { code, statusCode }),
    dateKeyUtc: (value) => value instanceof Date
        ? value.toISOString().slice(0, 10) : String(value || '').slice(0, 10)
});

function context({ weekStart, weekEnd, targetDate, authoritativeDates }) {
    const row = { hmeromhnia: new Date(`${targetDate}T00:00:00.000Z`) };
    return { scope: { ypokatasthma: '0000', week_start: weekStart, week_end: weekEnd },
        row, weekRows: [row], lifecycle: { employment_date_scope: {
            authoritative_date_set: authoritativeDates
        } } };
}
const january = { period_start: '2026-01-01', period_end: '2026-01-31' };

(async () => {
    const leading = { weekStart: '2025-12-29', weekEnd: '2026-01-04',
        authoritativeDates: ['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04'] };
    await authorize({}, context({ ...leading, targetDate: '2026-01-04' }), january);
    assert.equal(guardCalls.at(-1), undefined);
    await assert.rejects(authorize({}, context({ ...leading, targetDate: '2025-12-31' }),
        january), { code: 'STAGE3_DATE_OUTSIDE_ACTIVE_PERIOD' });
    await assert.rejects(authorize({}, context({ ...leading, targetDate: '2026-01-04' }),
        { period_start: '2025-12-01', period_end: '2025-12-31' }),
    { code: 'STAGE3_DATE_OUTSIDE_ACTIVE_PERIOD' });

    await authorize({}, context({ weekStart: '2026-01-05', weekEnd: '2026-01-11',
        targetDate: '2026-01-07', authoritativeDates: ['2026-01-07'] }), january);

    const trailing = { weekStart: '2026-01-26', weekEnd: '2026-02-01',
        authoritativeDates: ['2026-01-26', '2026-01-27', '2026-01-28', '2026-01-29',
            '2026-01-30', '2026-01-31'] };
    await authorize({}, context({ ...trailing, targetDate: '2026-01-31' }), january);
    await assert.rejects(authorize({}, context({ ...trailing, targetDate: '2026-02-01' }),
        january), { code: 'STAGE3_DATE_OUTSIDE_ACTIVE_PERIOD' });

    await assert.rejects(authorize({}, context({ weekStart: '2026-01-05',
        weekEnd: '2026-01-11', targetDate: '2026-01-07',
        authoritativeDates: ['2026-01-05', '2026-01-06'] }), january),
    { code: 'STAGE3_DATE_OUTSIDE_ACTIVE_PERIOD' });

    const legacy = context({ weekStart: '2026-01-05', weekEnd: '2026-01-11',
        targetDate: '2026-01-07', authoritativeDates: ['2026-01-07'] });
    await authorize({}, legacy, {});
    assert.equal(guardCalls.at(-1).kind, 'WEEKLY_CONTEXT');
    console.log('Stage-3 boundary authorization regression tests passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
