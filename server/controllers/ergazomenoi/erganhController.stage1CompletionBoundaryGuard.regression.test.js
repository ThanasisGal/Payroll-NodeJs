'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const controller = fs.readFileSync(path.join(__dirname, 'erganhController.js'), 'utf8');
const helperSource = controller.slice(
    controller.indexOf('async function assertActiveEmploymentReviewStage1CompletionReadable'),
    controller.indexOf('async function completeWeeklyHrStage1ForScope')
);
assert.ok(helperSource.startsWith(
    'async function assertActiveEmploymentReviewStage1CompletionReadable'
));

const activeScope = { period_start: new Date('2026-01-01T00:00:00.000Z'),
    period_end: new Date('2026-01-31T00:00:00.000Z') };
const guardCalls = [];
const completionGuard = vm.runInNewContext(`(() => {
    ${helperSource}
    return assertActiveEmploymentReviewStage1CompletionReadable;
})()`, {
    assertActiveEmploymentReviewPeriodReadable: async (_req, _branch, requiredRange) => {
        guardCalls.push(requiredRange);
        return { scope: activeScope, state: { effective_mode: 'NORMAL' }, token: 'token' };
    },
    weeklyHrApiError: (code, statusCode, message) =>
        Object.assign(new Error(message), { code, statusCode }),
    dateKeyUtc: (value) => value instanceof Date
        ? value.toISOString().slice(0, 10) : String(value || '').slice(0, 10),
    Set
});

function initial({ weekStart, weekEnd, authoritativeDates, rowDates }) {
    return { base: { ypokatasthma: '0000' },
        week: { start: new Date(`${weekStart}T00:00:00.000Z`),
            end: new Date(`${weekEnd}T00:00:00.000Z`),
            startKey: weekStart, endKey: weekEnd },
        employmentDateScope: { authoritative_date_set: authoritativeDates },
        rows: rowDates.map((date) => ({ hmeromhnia: new Date(`${date}T00:00:00.000Z`) })) };
}
const januaryInput = { period_start: '2026-01-01', period_end: '2026-01-31' };

(async () => {
    const leading = initial({ weekStart: '2025-12-29', weekEnd: '2026-01-04',
        authoritativeDates: ['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04'],
        rowDates: ['2025-12-29', '2025-12-30', '2025-12-31',
            '2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04'] });
    await completionGuard({}, leading, januaryInput);
    assert.equal(guardCalls.at(-1), undefined);
    assert.deepEqual(leading.employmentDateScope.authoritative_date_set,
        ['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04']);

    await completionGuard({}, initial({ weekStart: '2026-01-05', weekEnd: '2026-01-11',
        authoritativeDates: ['2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08',
            '2026-01-09', '2026-01-10', '2026-01-11'],
        rowDates: ['2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08',
            '2026-01-09', '2026-01-10', '2026-01-11'] }), januaryInput);

    await completionGuard({}, initial({ weekStart: '2026-01-26', weekEnd: '2026-02-01',
        authoritativeDates: ['2026-01-26', '2026-01-27', '2026-01-28', '2026-01-29',
            '2026-01-30', '2026-01-31'],
        rowDates: ['2026-01-26', '2026-01-27', '2026-01-28', '2026-01-29',
            '2026-01-30', '2026-01-31', '2026-02-01'] }), januaryInput);

    await assert.rejects(completionGuard({}, initial({
        weekStart: '2025-12-22', weekEnd: '2025-12-28', authoritativeDates: [],
        rowDates: ['2025-12-22'] }), januaryInput),
    { code: 'PERIOD_CONTROL_SCOPE_MISMATCH' });

    await assert.rejects(completionGuard({}, leading,
        { period_start: '2025-12-01', period_end: '2025-12-31' }),
    { code: 'PERIOD_CONTROL_SCOPE_MISMATCH' });

    const legacy = initial({ weekStart: '2026-01-05', weekEnd: '2026-01-11',
        authoritativeDates: ['2026-01-05'], rowDates: ['2026-01-05'] });
    await completionGuard({}, legacy, {});
    assert.equal(guardCalls.at(-1).kind, 'WEEKLY_CONTEXT');
    assert.equal(guardCalls.at(-1).start.toISOString().slice(0, 10), '2026-01-05');

    console.log('Stage-1 completion boundary guard regression tests passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
