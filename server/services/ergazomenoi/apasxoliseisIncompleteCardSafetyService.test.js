const assert = require('assert');
const {
    getIncompleteCardPairs,
    hasIncompleteCardPair,
    buildIncompleteCardSafeUpdate
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

console.log('incomplete card safety service tests passed');
