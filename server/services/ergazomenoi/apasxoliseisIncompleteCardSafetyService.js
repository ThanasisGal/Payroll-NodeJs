const CARD_PAIR_NUMBERS = Object.freeze(['01', '02', '03']);

const RESET_NUMBER_FIELDS = Object.freeze([
    'ores_ergasias_apologistika',
    'ores_pragmatikhs_ergasias_apologistika',
    'ores_adeias_pistomenes_apologistika',
    'ores_argias_pistomenes_apologistika',
    'ores_apoysias_apologistika',
    'ores_nyxtas_apologistika',
    'ores_argion_prosayxhsh_apologistika',
    'ores_argion_ergasia_apologistika',
    'ores_prostheths_ergasias_apologistika',
    'ores_yperergasias_apologistika',
    'ores_yperergasias_nyxtas_apologistika',
    'ores_yperergasias_argion_apologistika',
    'ores_yperergasias_argion_nyxtas_apologistika',
    'ores_nominhs_yperorias_apologistika',
    'ores_nominhs_yperorias_nyxtas_apologistika',
    'ores_nominhs_yperorias_argion_apologistika',
    'ores_nominhs_yperorias_argion_nyxtas_apologistika',
    'ores_paranomhs_yperorias_apologistika',
    'ores_paranomhs_yperorias_nyxtas_apologistika',
    'ores_paranomhs_yperorias_argion_apologistika',
    'ores_paranomhs_yperorias_argion_nyxtas_apologistika'
]);

function hasValue(value) {
    return value !== null && value !== undefined && String(value).trim() !== '';
}

function getIncompleteCardPairs(row = {}) {
    return CARD_PAIR_NUMBERS.filter((pairNumber) => {
        const hasStart = hasValue(row[`cards_apo_ora_${pairNumber}`]);
        const hasEnd = hasValue(row[`cards_eos_ora_${pairNumber}`]);
        return hasStart !== hasEnd;
    });
}

function hasIncompleteCardPair(row = {}) {
    return getIncompleteCardPairs(row).length > 0;
}

function buildIncompleteCardSafeUpdate() {
    const update = {
        apologistiko_biblio: false,
        kathgoria_ergasias_apologistika: '',
        repo_apologistika: false,
        adeia_apologistika: false,
        kathgoria_adeias_apologistika: '',
        astheneia_apologistika: false,
        kyriakes_apologistika: false,
        apo_ora_yperories: '',
        eos_ora_yperories: '',
        compensation_breakdown_apologistika: null
    };

    for (const pairNumber of CARD_PAIR_NUMBERS) {
        update[`apo_ora_${pairNumber}_apologistika`] = '';
        update[`eos_ora_${pairNumber}_apologistika`] = '';
    }

    for (const field of RESET_NUMBER_FIELDS) {
        update[field] = 0;
    }

    return update;
}

module.exports = {
    CARD_PAIR_NUMBERS,
    RESET_NUMBER_FIELDS,
    getIncompleteCardPairs,
    hasIncompleteCardPair,
    buildIncompleteCardSafeUpdate
};
