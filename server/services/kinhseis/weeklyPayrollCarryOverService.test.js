const assert = require('assert');
const {
    createWeeklyPayrollCarryOver,
    materializeInMemory
} = require('./weeklyPayrollCarryOverService');

const currentMonth = createWeeklyPayrollCarryOver({
    scopeKey: 'non-personal-test-scope',
    sourceWeekDate: '2026-09-30',
    sourcePayrollMonth: '2026-09',
    targetPayrollMonth: '2026-10',
    breakdown: { yperergasia: 2, yperoria: 1, sixthDay: 7, otherWeekly: 0 }
});
assert.strictEqual(currentMonth.ok, true);
assert.strictEqual(currentMonth.sourceWeekStart, '2026-09-28');
assert.strictEqual(currentMonth.sourceWeekEnd, '2026-10-04');
assert.strictEqual(currentMonth.sourcePayrollMonth, '2026-09');
assert.strictEqual(currentMonth.targetPayrollMonth, '2026-10');

const store = new Map();
assert.strictEqual(materializeInMemory(store, currentMonth).status, 'CREATED');
assert.strictEqual(materializeInMemory(store, currentMonth).status, 'IDEMPOTENT_REPLAY');
assert.strictEqual(store.size, 1);

const invalidTarget = createWeeklyPayrollCarryOver({
    scopeKey: 'non-personal-test-scope',
    sourceWeekDate: '2026-09-30',
    sourcePayrollMonth: '2026-09',
    targetPayrollMonth: '2026-09',
    breakdown: {}
});
assert.strictEqual(invalidTarget.ok, false);
assert.strictEqual(invalidTarget.reason, 'INVALID_WEEKLY_CARRY_OVER_TARGET_MONTH');

console.log('weekly payroll carry-over tests passed');
