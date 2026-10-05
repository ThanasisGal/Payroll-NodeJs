'use strict';

function profileFacts(overrides = {}) {
    return {
        symbash: 'SYNTHETIC_CONTRACT',
        kathgoria_symbashs: 'SYNTHETIC_CATEGORY',
        eidikothta_symbashs: 'SYNTHETIC_SPECIALTY',
        misthologiko_klimakio: 1,
        synolo_symbashs: 1000,
        synolo_symbashs_basei_oron_ergasias: 500,
        nomimosMisthos: 1000,
        nomimoHmeromisthio: 40,
        nomimoOromisthio: 5,
        pragmatikosMisthos: 500,
        pragmatikoHmeromisthio: 20,
        pragmatikoOromisthio: 5,
        kathestos_apasxolhshs: '1',
        typos_ebdomadas: '5HMERH',
        apasxolhsh_basei_symbashs: '5',
        hmeres_ergasias_ebdomadas: 5,
        ores_ergasias_ebdomadas: 20,
        mo_oron_hmerhsias_ergasias: 4,
        pososto_prosayxhshs_6hs_hmeras: 0,
        eidikh_kathgoria_ergazomenoy: 'SYNTHETIC_EMPLOYEE_CATEGORY',
        ...overrides
    };
}

function buildTwoRowFixture(index, { invalidFirst = false } = {}) {
    const scope = { team: 'SYNTHETIC', company_kod: `FALSE-POSITIVE-${index}`,
        kodikos: `EMPLOYEE-${index}` };
    const hire = `2026-0${index}-01`;
    const common = { ...scope, hmeromhnia_proslhpshs: hire,
        hmeromhnia_allaghs_orarioy_apo: hire,
        hmeromhnia_isxyos_oron_ergasias_apo: hire,
        hmeromhnia_isxyos_oron_ergasias_eos: null,
        afora_proslhpsh: true, afora_allagh_oron_ergasias: true,
        ...profileFacts() };
    const valid = { _id: `synthetic-${index}-valid`, ...common,
        aa_eggrafhs: invalidFirst ? '0002' : '0001', typos_apasxolhshs: '1' };
    const invalid = { _id: `synthetic-${index}-invalid`, ...common,
        aa_eggrafhs: invalidFirst ? '0001' : '0002', typos_apasxolhshs: '5' };
    delete invalid.pososto_prosayxhshs_6hs_hmeras;
    return { name: `FALSE_POSITIVE_SHAPE_${index}`, scope,
        currentEmployee: { _id: `synthetic-${index}-employee`, ...common,
            hmeromhnia_lhxhs_symbashs: '2026-12-31' },
        historyRows: invalidFirst ? [invalid, valid] : [valid, invalid],
        expectedSurvivorId: valid._id, expectedRedundantId: invalid._id };
}

function buildThreeRowFixture(index, overrides = {}) {
    const scope = { team: 'SYNTHETIC', company_kod: `FALSE-POSITIVE-${index}`,
        kodikos: `EMPLOYEE-${index}` };
    const hire = `2026-0${index}-01`;
    const currentFacts = profileFacts(overrides);
    const sparseHire = { _id: `synthetic-${index}-hire`, ...scope, aa_eggrafhs: '0001',
        hmeromhnia_proslhpshs: hire, hmeromhnia_allaghs_orarioy_apo: hire,
        afora_proslhpsh: true, afora_allagh_oron_ergasias: false,
        kathestos_apasxolhshs: '1' };
    const common = { ...scope, hmeromhnia_proslhpshs: hire,
        hmeromhnia_allaghs_orarioy_apo: hire,
        hmeromhnia_isxyos_oron_ergasias_apo: hire,
        hmeromhnia_isxyos_oron_ergasias_eos: null,
        afora_proslhpsh: true, afora_allagh_oron_ergasias: true,
        ...currentFacts };
    const invalid = { _id: `synthetic-${index}-invalid`, ...common,
        aa_eggrafhs: '0002', typos_apasxolhshs: '5', typos_ebdomadas: null };
    delete invalid.pososto_prosayxhshs_6hs_hmeras;
    const valid = { _id: `synthetic-${index}-valid`, ...common,
        aa_eggrafhs: '0003', typos_apasxolhshs: '1',
        hmeromhnia_allaghs_orarioy_apo: `2026-0${index}-08` };
    return { name: `FALSE_POSITIVE_SHAPE_${index}`, scope,
        currentEmployee: { _id: `synthetic-${index}-employee`, ...common,
            hmeromhnia_allaghs_orarioy_apo: valid.hmeromhnia_allaghs_orarioy_apo },
        historyRows: [sparseHire, invalid, valid], expectedSurvivorId: valid._id,
        expectedRedundantId: invalid._id, expectedHireId: sparseHire._id };
}

function buildLegacyEmploymentTypeAliasFalsePositiveFixtures() {
    return [
        buildTwoRowFixture(1),
        buildTwoRowFixture(2, { invalidFirst: true }),
        buildThreeRowFixture(3, { hmeres_ergasias_ebdomadas: 1,
            ores_ergasias_ebdomadas: 1.5, mo_oron_hmerhsias_ergasias: 1.5 }),
        buildThreeRowFixture(4, { hmeres_ergasias_ebdomadas: 1,
            ores_ergasias_ebdomadas: 2, mo_oron_hmerhsias_ergasias: 2 }),
        buildThreeRowFixture(5, { hmeres_ergasias_ebdomadas: 1,
            ores_ergasias_ebdomadas: 3, mo_oron_hmerhsias_ergasias: 3,
            pragmatikosMisthos: 187.5, pragmatikoHmeromisthio: 45,
            pragmatikoOromisthio: 15 })
    ];
}

module.exports = { buildLegacyEmploymentTypeAliasFalsePositiveFixtures };
