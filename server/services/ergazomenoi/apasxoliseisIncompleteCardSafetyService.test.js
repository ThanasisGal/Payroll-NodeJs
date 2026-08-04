const assert = require('assert');
const {
    getIncompleteCardPairs,
    hasIncompleteCardPair,
    buildIncompleteCardSafeUpdate,
    buildPartialVerifiedCardUpdate
} = require('./apasxoliseisIncompleteCardSafetyService');

assert.deepStrictEqual(getIncompleteCardPairs({}), []);
assert.strictEqual(
    hasIncompleteCardPair({ cards_apo_ora_01: '09:00', cards_eos_ora_01: '17:00' }),
    false
);
assert.deepStrictEqual(
    getIncompleteCardPairs({
        cards_apo_ora_01: '09:00',
        cards_eos_ora_01: '',
        cards_apo_ora_02: '',
        cards_eos_ora_02: '19:00'
    }),
    ['01', '02']
);

const update = buildIncompleteCardSafeUpdate();
assert.strictEqual(update.apologistiko_biblio, false);
assert.strictEqual(update.kathgoria_ergasias_apologistika, '');
assert.strictEqual(update.apo_ora_01_apologistika, '');
assert.strictEqual(update.eos_ora_03_apologistika, '');
assert.strictEqual(update.ores_ergasias_apologistika, 0);
assert.strictEqual(update.ores_nyxtas_apologistika, 0);
assert.strictEqual(update.ores_paranomhs_yperorias_argion_nyxtas_apologistika, 0);
assert.strictEqual(update.kyriakes_apologistika, false);
assert.strictEqual(update.apo_ora_yperories, '');
assert.strictEqual(update.eos_ora_yperories, '');
assert.strictEqual(update.compensation_breakdown_apologistika, null);
assert.strictEqual(Object.hasOwn(update, 'cards_ores_ergasias'), false);
assert.strictEqual(Object.hasOwn(update, 'cards_apo_ora_01'), false);
assert.strictEqual(Object.hasOwn(update, 'cards_eos_ora_01'), false);
assert.strictEqual(Object.hasOwn(update, 'argia'), false);

const partial = buildPartialVerifiedCardUpdate({
    cards_apo_ora_01: '09:00',
    cards_eos_ora_01: '13:00',
    cards_apo_ora_02: '16:00',
    cards_eos_ora_02: ''
});
assert.strictEqual(partial.verificationStatus, 'PARTIALLY_VERIFIED');
assert.strictEqual(partial.update.apologistiko_biblio, false);
assert.strictEqual(partial.update.kathgoria_ergasias_apologistika, 'ΕΡΓ');
assert.strictEqual(partial.update.apo_ora_01_apologistika, '09:00');
assert.strictEqual(partial.update.eos_ora_01_apologistika, '13:00');
assert.strictEqual(partial.update.apo_ora_02_apologistika, '');
assert.strictEqual(partial.update.eos_ora_02_apologistika, '');
assert.strictEqual(partial.update.ores_ergasias_apologistika, 4);
assert.strictEqual(partial.update.ores_pragmatikhs_ergasias_apologistika, 4);
assert.strictEqual(partial.update.ores_apoysias_apologistika, 0);
assert.strictEqual(Object.hasOwn(partial.update, 'cards_apo_ora_01'), false);

const unverified = buildPartialVerifiedCardUpdate({
    cards_apo_ora_01: '09:00',
    cards_eos_ora_01: '',
    cards_apo_ora_02: '',
    cards_eos_ora_02: '20:00'
});
assert.strictEqual(unverified.verificationStatus, 'UNVERIFIED');
assert.strictEqual(unverified.update.kathgoria_ergasias_apologistika, '');
assert.strictEqual(unverified.update.ores_ergasias_apologistika, 0);
assert.strictEqual(unverified.update.ores_pragmatikhs_ergasias_apologistika, 0);

console.log('incomplete card safety service tests passed');
