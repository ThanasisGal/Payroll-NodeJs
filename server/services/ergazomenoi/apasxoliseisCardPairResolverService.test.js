const assert = require('assert');
const {
    CARD_PAIR_STATE,
    CARD_VERIFICATION_STATUS,
    resolveCardPairVerification
} = require('./apasxoliseisCardPairResolverService');

let result = resolveCardPairVerification({});
assert.strictEqual(result.status, CARD_VERIFICATION_STATUS.READY);
assert.strictEqual(result.verifiedHours, 0);
assert.deepStrictEqual(result.completePairNumbers, []);
assert.deepStrictEqual(result.unresolvedPairNumbers, []);

result = resolveCardPairVerification({ cards_ores_ergasias: 8 });
assert.strictEqual(result.status, CARD_VERIFICATION_STATUS.UNVERIFIED);
assert.strictEqual(result.aggregateHoursWithoutPairs, true);
assert.strictEqual(result.verifiedHours, 0);

result = resolveCardPairVerification({
    cards_apo_ora_01: '09:00',
    cards_eos_ora_01: '13:00'
});
assert.strictEqual(result.status, CARD_VERIFICATION_STATUS.READY);
assert.strictEqual(result.verifiedHours, 4);
assert.deepStrictEqual(result.completePairNumbers, ['01']);

result = resolveCardPairVerification({
    cards_apo_ora_01: '09:00',
    cards_eos_ora_01: '13:00',
    cards_apo_ora_02: '16:00',
    cards_eos_ora_02: ''
});
assert.strictEqual(result.status, CARD_VERIFICATION_STATUS.PARTIALLY_VERIFIED);
assert.strictEqual(result.verifiedHours, 4);
assert.deepStrictEqual(result.completePairNumbers, ['01']);
assert.deepStrictEqual(result.unresolvedPairNumbers, ['02']);
assert.strictEqual(result.unresolvedPairs[0].state, CARD_PAIR_STATE.START_ONLY);

result = resolveCardPairVerification({
    cards_apo_ora_01: '',
    cards_eos_ora_01: '13:00',
    cards_apo_ora_02: '16:00',
    cards_eos_ora_02: '20:00'
});
assert.strictEqual(result.status, CARD_VERIFICATION_STATUS.PARTIALLY_VERIFIED);
assert.strictEqual(result.verifiedHours, 4);
assert.strictEqual(result.unresolvedPairs[0].state, CARD_PAIR_STATE.END_ONLY);

// Different incomplete slots must never be joined into an artificial pair.
result = resolveCardPairVerification({
    cards_apo_ora_01: '09:00',
    cards_eos_ora_01: '',
    cards_apo_ora_02: '',
    cards_eos_ora_02: '20:00'
});
assert.strictEqual(result.status, CARD_VERIFICATION_STATUS.UNVERIFIED);
assert.strictEqual(result.verifiedHours, 0);
assert.deepStrictEqual(result.completePairNumbers, []);
assert.deepStrictEqual(result.unresolvedPairNumbers, ['01', '02']);

result = resolveCardPairVerification({
    cards_apo_ora_01: '09:00',
    cards_eos_ora_01: '13:00',
    cards_apo_ora_02: '16:00',
    cards_eos_ora_02: '20:00'
});
assert.strictEqual(result.status, CARD_VERIFICATION_STATUS.READY);
assert.strictEqual(result.verifiedHours, 8);

result = resolveCardPairVerification({
    cards_apo_ora_01: '08:00',
    cards_eos_ora_01: '09:00',
    cards_apo_ora_04: '20:00',
    cards_eos_ora_04: '21:00'
});
assert.strictEqual(result.status, CARD_VERIFICATION_STATUS.READY);
assert.strictEqual(result.verifiedHours, 2);
assert.deepStrictEqual(result.completePairNumbers, ['01', '04']);

result = resolveCardPairVerification({
    cards_apo_ora_01: '22:00',
    cards_eos_ora_01: '02:00'
});
assert.strictEqual(result.status, CARD_VERIFICATION_STATUS.READY);
assert.strictEqual(result.verifiedHours, 4);
assert.strictEqual(result.completePairs[0].isOvernight, true);

result = resolveCardPairVerification({
    cards_apo_ora_01: 'bad',
    cards_eos_ora_01: '13:00'
});
assert.strictEqual(result.status, CARD_VERIFICATION_STATUS.UNVERIFIED);
assert.strictEqual(result.unresolvedPairs[0].state, CARD_PAIR_STATE.INVALID_TIME);

result = resolveCardPairVerification({
    cards_apo_ora_01: '09:00',
    cards_eos_ora_01: '09:00'
});
assert.strictEqual(result.status, CARD_VERIFICATION_STATUS.UNVERIFIED);
assert.strictEqual(result.unresolvedPairs[0].state, CARD_PAIR_STATE.ZERO_LENGTH);

console.log('card pair resolver service tests passed');
