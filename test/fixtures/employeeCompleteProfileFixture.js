'use strict';

// Explicit test facts for successful definitive writes. This helper supplies
// no dates and is never used to fill missing facts in production or in legacy
// ambiguity fixtures. Individual tests can still omit/override any fact.
function completeSyntheticEmploymentTerms(overrides = {}) {
    return {
        krathsh_01: '0101', symbash: '01', kathgoria_symbashs: '01',
        eidikothta_symbashs: '01', nomimosMisthos: 1200,
        pragmatikosMisthos: 1300, synolo_symbashs: 1300,
        // This synthetic employee is paid monthly, not by a daily rate.
        nomimoHmeromisthio: 0, pragmatikoHmeromisthio: 0,
        nomimoOromisthio: 0, pragmatikoOromisthio: 0, misthologiko_klimakio: 0,
        // No separately itemized allowances are agreed in this synthetic
        // contract. Record their absence before reconstruction, in every
        // dated document and in current state, rather than treating null as 0.
        ...Object.fromEntries(Array.from({ length: 15 }, (_, index) => {
            const suffix = String(index + 1).padStart(2, '0');
            return [[`poso_symbashs_${suffix}`, 0],
                [`poso_symbashs_basei_oron_ergasias_${suffix}`, 0]];
        }).flat()),
        synolo_symbashs_basei_oron_ergasias: 0,
        hmeres_ergasias_ebdomadas: 5, ores_ergasias_ebdomadas: 40,
        mo_oron_hmerhsias_ergasias: 8, kathestos_apasxolhshs: '0',
        typos_apasxolhshs: '0', typos_ebdomadas: '5HMERH',
        pososto_prosayxhshs_6hs_hmeras: 0,
        evelikth_proselefsh: 0, symbatikes_ores_ergasias: 40, dialleima_se_lepta: 0,
        ...overrides
    };
}

module.exports = { completeSyntheticEmploymentTerms };
