'use strict';

const DIGITAL_CARD_FIELDS = Object.freeze([
    'cards_apo_ora_01', 'cards_eos_ora_01',
    'cards_apo_ora_02', 'cards_eos_ora_02',
    'cards_apo_ora_03', 'cards_eos_ora_03',
    'cards_ores_ergasias', 'check_ergasia'
]);

function buildDigitalCardsUpdate(source = {}) {
    return {
        cards_apo_ora_01: String(source.cards_apo_ora_01 || '').trim(),
        cards_eos_ora_01: String(source.cards_eos_ora_01 || '').trim(),
        cards_apo_ora_02: String(source.cards_apo_ora_02 || '').trim(),
        cards_eos_ora_02: String(source.cards_eos_ora_02 || '').trim(),
        cards_apo_ora_03: String(source.cards_apo_ora_03 || '').trim(),
        cards_eos_ora_03: String(source.cards_eos_ora_03 || '').trim(),
        cards_ores_ergasias: Number.isFinite(Number(source.cards_ores_ergasias))
            ? Number(source.cards_ores_ergasias) : 0,
        check_ergasia: source.check_ergasia === true
    };
}

function buildDigitalCardsUpdateFromPairs(pairs, lastCheck, calculateHours) {
    const update = buildDigitalCardsUpdate();
    for (let index = 0; index < Math.min(pairs.length, 3); index++) {
        const suffix = String(index + 1).padStart(2, '0');
        update[`cards_apo_ora_${suffix}`] = pairs[index].apo || '';
        update[`cards_eos_ora_${suffix}`] = pairs[index].eos || '';
        update.cards_ores_ergasias += calculateHours(pairs[index].apo, pairs[index].eos);
    }
    update.check_ergasia = lastCheck === 'Not Ok';
    return update;
}

module.exports = {
    DIGITAL_CARD_FIELDS,
    buildDigitalCardsUpdate,
    buildDigitalCardsUpdateFromPairs
};
