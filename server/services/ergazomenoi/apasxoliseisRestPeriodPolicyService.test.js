const assert = require('assert');
const {
    MINIMUM_SPLIT_REST_MINUTES,
    MINIMUM_INTERDAY_REST_MINUTES,
    STATUS,
    REASON,
    evaluateSplitShiftRest,
    evaluateInterdayRest
} = require('./apasxoliseisRestPeriodPolicyService');

assert.strictEqual(MINIMUM_SPLIT_REST_MINUTES, 180);
assert.strictEqual(MINIMUM_INTERDAY_REST_MINUTES, 660);

let row = {
    cards_apo_ora_01: '09:00',
    cards_eos_ora_01: '13:00',
    cards_apo_ora_02: '16:00',
    cards_eos_ora_02: '20:00'
};
const originalRow = { ...row };
let result = evaluateSplitShiftRest(row);
assert.strictEqual(result.status, STATUS.READY);
assert.strictEqual(result.measuredRestMinutes, 180);
assert.deepStrictEqual(result.reasons, []);
assert.deepStrictEqual(row, originalRow);

result = evaluateSplitShiftRest({
    ...row,
    cards_apo_ora_02: '15:59'
});
assert.strictEqual(result.status, STATUS.VIOLATION);
assert.strictEqual(result.measuredRestMinutes, 179);
assert.deepStrictEqual(result.reasons, [REASON.SPLIT_REST_BELOW_MINIMUM]);

result = evaluateSplitShiftRest({
    cards_apo_ora_01: '09:00',
    cards_eos_ora_01: '13:00',
    cards_apo_ora_02: '16:00',
    cards_eos_ora_02: '18:00',
    cards_apo_ora_03: '21:15',
    cards_eos_ora_03: '22:00'
});
assert.strictEqual(result.status, STATUS.READY);
assert.strictEqual(result.measuredRestMinutes, 180);
assert.strictEqual(result.details.length, 2);

result = evaluateSplitShiftRest({
    cards_apo_ora_01: '09:00',
    cards_eos_ora_01: '13:00',
    cards_apo_ora_02: '12:30',
    cards_eos_ora_02: '17:00'
});
assert.strictEqual(result.status, STATUS.VIOLATION);
assert.strictEqual(result.measuredRestMinutes, -30);
assert.deepStrictEqual(result.reasons, [REASON.SPLIT_INTERVALS_OVERLAP]);

result = evaluateSplitShiftRest({
    cards_apo_ora_01: '09:00',
    cards_eos_ora_01: '13:00'
});
assert.strictEqual(result.status, STATUS.NOT_APPLICABLE);

result = evaluateSplitShiftRest({
    cards_apo_ora_01: '09:00',
    cards_eos_ora_01: '13:00',
    cards_apo_ora_02: '16:00',
    cards_eos_ora_02: ''
});
assert.strictEqual(result.status, STATUS.NEEDS_HR_DECISION);
assert.deepStrictEqual(result.reasons, [REASON.CARD_VERIFICATION_PENDING]);
assert.deepStrictEqual(result.warnings, ['ROW_1_UNRESOLVED_CARD_PAIR_02']);

// A single incomplete card slot belongs to the incomplete-punch workflow; it
// does not by itself prove that a split-shift rest check is applicable.
result = evaluateSplitShiftRest({
    cards_apo_ora_01: '09:00',
    cards_eos_ora_01: ''
});
assert.strictEqual(result.status, STATUS.NOT_APPLICABLE);

// A start in one slot and an end in another never form an artificial interval.
result = evaluateSplitShiftRest({
    cards_apo_ora_01: '09:00',
    cards_eos_ora_01: '',
    cards_apo_ora_02: '',
    cards_eos_ora_02: '20:00'
});
assert.strictEqual(result.status, STATUS.NEEDS_HR_DECISION);
assert.strictEqual(result.measuredRestMinutes, null);

let currentRow = {
    hmeromhnia: '2026-06-01',
    cards_apo_ora_01: '12:00',
    cards_eos_ora_01: '22:00'
};
let nextRow = {
    hmeromhnia: '2026-06-02',
    cards_apo_ora_01: '09:00',
    cards_eos_ora_01: '17:00'
};
const originalCurrentRow = { ...currentRow };
const originalNextRow = { ...nextRow };
result = evaluateInterdayRest(currentRow, nextRow);
assert.strictEqual(result.status, STATUS.READY);
assert.strictEqual(result.measuredRestMinutes, 660);
assert.deepStrictEqual(currentRow, originalCurrentRow);
assert.deepStrictEqual(nextRow, originalNextRow);

result = evaluateInterdayRest(currentRow, {
    ...nextRow,
    cards_apo_ora_01: '08:59'
});
assert.strictEqual(result.status, STATUS.VIOLATION);
assert.strictEqual(result.measuredRestMinutes, 659);
assert.deepStrictEqual(result.reasons, [REASON.INTERDAY_REST_BELOW_MINIMUM]);

// An overnight final interval ends on the following calendar day.
result = evaluateInterdayRest(
    {
        hmeromhnia: '2026-06-01',
        cards_apo_ora_01: '22:00',
        cards_eos_ora_01: '02:00'
    },
    {
        hmeromhnia: '2026-06-02',
        cards_apo_ora_01: '13:00',
        cards_eos_ora_01: '19:00'
    }
);
assert.strictEqual(result.status, STATUS.READY);
assert.strictEqual(result.measuredRestMinutes, 660);

// The last current-day pair and the first next-day pair define the boundary.
result = evaluateInterdayRest(
    {
        hmeromhnia: new Date('2026-06-01T00:00:00.000Z'),
        cards_apo_ora_01: '09:00',
        cards_eos_ora_01: '13:00',
        cards_apo_ora_02: '16:00',
        cards_eos_ora_02: '20:00'
    },
    {
        hmeromhnia: new Date('2026-06-02T00:00:00.000Z'),
        cards_apo_ora_01: '07:00',
        cards_eos_ora_01: '11:00',
        cards_apo_ora_02: '15:00',
        cards_eos_ora_02: '19:00'
    }
);
assert.strictEqual(result.status, STATUS.READY);
assert.strictEqual(result.measuredRestMinutes, 660);
assert.strictEqual(result.details[0].currentPairNumber, '02');
assert.strictEqual(result.details[0].nextPairNumber, '01');

result = evaluateInterdayRest(
    {
        hmeromhnia: '2026-06-01',
        cards_apo_ora_01: '09:00',
        cards_eos_ora_01: '13:00',
        cards_apo_ora_02: '16:00',
        cards_eos_ora_02: ''
    },
    nextRow
);
assert.strictEqual(result.status, STATUS.NEEDS_HR_DECISION);
assert.deepStrictEqual(result.reasons, [REASON.CARD_VERIFICATION_PENDING]);

result = evaluateInterdayRest(
    { hmeromhnia: '2026-06-01' },
    nextRow
);
assert.strictEqual(result.status, STATUS.NOT_APPLICABLE);

result = evaluateInterdayRest(
    { hmeromhnia: '2026-06-01' },
    {
        hmeromhnia: '2026-06-02',
        cards_apo_ora_01: '09:00',
        cards_eos_ora_01: ''
    }
);
assert.strictEqual(result.status, STATUS.NOT_APPLICABLE);

result = evaluateInterdayRest(currentRow, {
    ...nextRow,
    hmeromhnia: ''
});
assert.strictEqual(result.status, STATUS.NEEDS_HR_DECISION);
assert.deepStrictEqual(result.reasons, [REASON.MISSING_OR_INVALID_DATE]);

result = evaluateInterdayRest(nextRow, currentRow);
assert.strictEqual(result.status, STATUS.NEEDS_HR_DECISION);
assert.deepStrictEqual(result.reasons, [REASON.INVALID_DATE_SEQUENCE]);

console.log('verified card rest-period policy tests passed');
