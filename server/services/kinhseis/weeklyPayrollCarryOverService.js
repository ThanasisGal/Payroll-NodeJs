const crypto = require('crypto');
const {
    dateKeyUtc,
    getMondaySundayWeekRange
} = require('../../utils/date/mondaySundayWeek');

const POLICY_VERSION = 'weekly-payroll-carry-over:v1';
const DIFFERENCE_TYPES = Object.freeze([
    'yperergasia',
    'yperoria',
    'sixthDay',
    'otherWeekly'
]);

function monthKey(value) {
    const key = dateKeyUtc(value);
    return key ? key.slice(0, 7) : null;
}

function normalizeBreakdown(value = {}) {
    const result = {};
    for (const type of DIFFERENCE_TYPES) {
        const number = Number(String(value[type] ?? 0).replace(',', '.'));
        if (!Number.isFinite(number)) return null;
        result[type] = Number(number.toFixed(4));
    }
    return Object.freeze(result);
}

function createWeeklyPayrollCarryOver({
    scopeKey,
    sourceWeekDate,
    sourcePayrollMonth,
    targetPayrollMonth,
    breakdown
} = {}) {
    const range = getMondaySundayWeekRange(sourceWeekDate);
    const normalizedBreakdown = normalizeBreakdown(breakdown);
    const sourceMonth = monthKey(`${sourcePayrollMonth}-01`);
    const targetMonth = monthKey(`${targetPayrollMonth}-01`);
    if (!scopeKey || !range || !normalizedBreakdown || !sourceMonth || !targetMonth) {
        return Object.freeze({
            ok: false,
            reason: 'INVALID_WEEKLY_CARRY_OVER_INPUT'
        });
    }
    if (targetMonth <= sourceMonth) {
        return Object.freeze({
            ok: false,
            reason: 'INVALID_WEEKLY_CARRY_OVER_TARGET_MONTH'
        });
    }

    const identityInput = [
        POLICY_VERSION,
        String(scopeKey),
        range.weekStartKey,
        range.weekEndKey,
        sourceMonth,
        targetMonth
    ].join('|');
    return Object.freeze({
        ok: true,
        reason: null,
        idempotencyKey: crypto.createHash('sha256').update(identityInput).digest('hex'),
        policyVersion: POLICY_VERSION,
        sourceWeekStart: range.weekStartKey,
        sourceWeekEnd: range.weekEndKey,
        sourcePayrollMonth: sourceMonth,
        targetPayrollMonth: targetMonth,
        breakdown: normalizedBreakdown
    });
}

function materializeInMemory(store, carryOver) {
    if (!(store instanceof Map) || carryOver?.ok !== true) {
        return Object.freeze({ status: 'INVALID', carryOver: null });
    }
    const existing = store.get(carryOver.idempotencyKey);
    if (existing) {
        return Object.freeze({
            status:
                JSON.stringify(existing) === JSON.stringify(carryOver)
                    ? 'IDEMPOTENT_REPLAY'
                    : 'CONFLICT',
            carryOver: existing
        });
    }
    store.set(carryOver.idempotencyKey, carryOver);
    return Object.freeze({ status: 'CREATED', carryOver });
}

module.exports = {
    POLICY_VERSION,
    DIFFERENCE_TYPES,
    monthKey,
    normalizeBreakdown,
    createWeeklyPayrollCarryOver,
    materializeInMemory
};
