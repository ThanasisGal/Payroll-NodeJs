const CARD_PAIR_NUMBERS = Object.freeze(['01', '02', '03']);
const {
    CARD_VERIFICATION_STATUS,
    resolveCardPairVerification
} = require('./apasxoliseisCardPairResolverService');

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

function buildPartialVerifiedCardUpdate(row = {}) {
    const verification = resolveCardPairVerification(row, {
        pairNumbers: CARD_PAIR_NUMBERS
    });
    const update = buildIncompleteCardSafeUpdate();
    const hasVerifiedWork = verification.hasCompleteCardEvidence;
    const hasRealCardPunch = verification.completePairs.length > 0 ||
        verification.unresolvedPairs.length > 0;

    update.apologistiko_biblio = false;
    update.kathgoria_ergasias_apologistika = hasRealCardPunch ? 'ΕΡΓ' : '';
    update.ores_ergasias_apologistika = Number(
        verification.verifiedHours.toFixed(2)
    );
    update.ores_pragmatikhs_ergasias_apologistika = Number(
        verification.verifiedHours.toFixed(2)
    );

    for (const pair of verification.completePairs) {
        update[`apo_ora_${pair.pairNumber}_apologistika`] = pair.start;
        update[`eos_ora_${pair.pairNumber}_apologistika`] = pair.end;
    }

    return {
        verificationStatus: verification.status,
        update
    };
}

module.exports = {
    CARD_PAIR_NUMBERS,
    RESET_NUMBER_FIELDS,
    getIncompleteCardPairs,
    hasIncompleteCardPair,
    buildIncompleteCardSafeUpdate,
    buildPartialVerifiedCardUpdate,
    CARD_VERIFICATION_STATUS
};
