'use strict';

const { buildCompleteProfileSnapshot } =
    require('../../../utils/ergazomenoi/employmentProfileHistory');

const IDS = Object.freeze({
    SPARSE: '507f1f77bcf86cd799439301',
    OPEN: '507f1f77bcf86cd799439302',
    DEPARTURE_A: '507f1f77bcf86cd799439303',
    DEPARTURE_B: '507f1f77bcf86cd799439304',
    EMPLOYEE: '507f1f77bcf86cd799439305'
});

const provenance = id => [{
    collection: 'Apasxoliseis_Period_Frozen_Snapshots',
    documentId: `synthetic-fact-reference-${id}`
}];

function scopeFor(name) {
    return { team: 'TEST', company_kod: `synthetic-${name}`, kodikos: '0098' };
}

function baseTerms({ hire, pay = 1145.32 } = {}) {
    return {
        hmeromhnia_proslhpshs: hire,
        hmeromhnia_allaghs_symbashs: hire,
        hmeromhnia_allaghs_orarioy_apo: hire,
        hmeromhnia_allaghs_orarioy_eos: null,
        hmeromhnia_lhxhs_symbashs: '2026-12-31',
        misthologiko_klimakio: 3,
        symbash: '0002',
        kathgoria_symbashs: '0001',
        eidikothta_symbashs: '0001',
        synolo_symbashs: pay,
        synolo_symbashs_basei_oron_ergasias: pay,
        nomimosMisthos: pay,
        nomimoHmeromisthio: pay / 25,
        nomimoOromisthio: pay / 166.667,
        pragmatikosMisthos: pay,
        pragmatikoHmeromisthio: pay / 25,
        pragmatikoOromisthio: pay / 166.667,
        hmeres_ergasias_ebdomadas: 5,
        ores_ergasias_ebdomadas: 40,
        mo_oron_hmerhsias_ergasias: 8,
        kathestos_apasxolhshs: '0',
        typos_apasxolhshs: '0',
        typos_ebdomadas: '5HMERH',
        apasxolhsh_basei_symbashs: '5',
        pososto_prosayxhshs_6hs_hmeras: 0
    };
}

function profile({ id, scope, hire, departure = null, pay = 1145.32,
    sequence, createdAt, payCorrection = false } = {}) {
    const terms = baseTerms({ hire, pay });
    if (payCorrection) {
        terms.stoixeio_symbashs_04 = '0010';
        terms.poso_symbashs_04 = -19.8;
        terms.poso_symbashs_basei_oron_ergasias_04 = -19.8;
        terms.stoixeio_symbashs_05 = '0012';
        terms.poso_symbashs_05 = -69.3;
        terms.poso_symbashs_basei_oron_ergasias_05 = -69.3;
    }
    return {
        _id: id,
        ...scope,
        ...buildCompleteProfileSnapshot({ current: terms, effectiveFrom: hire }),
        ...terms,
        hmeromhnia_apoxorhshs: departure,
        hmeromhnia_isxyos_oron_ergasias_apo: hire,
        hmeromhnia_isxyos_oron_ergasias_eos: null,
        afora_proslhpsh: sequence === 1,
        afora_allagh_oron_ergasias: true,
        employment_profile_source: 'SYNTHETIC_FACT_FIXTURE',
        aa_eggrafhs: String(sequence).padStart(4, '0'),
        createdAt: new Date(createdAt),
        updatedAt: new Date(createdAt),
        __v: 0
    };
}

function sparseHire({ scope, hire } = {}) {
    const terms = baseTerms({ hire });
    return {
        _id: IDS.SPARSE,
        ...scope,
        ...terms,
        hmeromhnia_apoxorhshs: null,
        afora_proslhpsh: true,
        aa_eggrafhs: '0001',
        createdAt: new Date(`${hire}T07:00:00.000Z`),
        updatedAt: new Date(`${hire}T07:00:00.000Z`),
        __v: 0
    };
}

function currentEmployee({ scope, row, departure } = {}) {
    return {
        ...row,
        _id: IDS.EMPLOYEE,
        ...scope,
        aa_eggrafhs: undefined,
        hmeromhnia_apoxorhshs: departure,
        hmeromhnia_isxyos_oron_ergasias_eos: null,
        energos: true,
        archived: false
    };
}

function references(rows, referencedIds = []) {
    const referenced = new Set(referencedIds);
    return Object.fromEntries(rows.map(row => [String(row._id),
        referenced.has(String(row._id)) ? provenance(row._id) : []]));
}

function competingDepartureDatesFixture({
    name = 'competing-departure-dates',
    hire = '2026-04-29',
    firstDeparture = '2026-08-19',
    secondDeparture = '2026-08-20',
    includeOpenProfile = true,
    referencedIds = []
} = {}) {
    const scope = scopeFor(name);
    const rows = [sparseHire({ scope, hire })];
    if (includeOpenProfile) rows.push(profile({ id: IDS.OPEN, scope, hire,
        sequence: 2, createdAt: '2026-06-22T08:00:00.000Z' }));
    rows.push(profile({ id: IDS.DEPARTURE_A, scope, hire, departure: firstDeparture,
        sequence: includeOpenProfile ? 3 : 2,
        createdAt: `${firstDeparture}T08:00:00.000Z` }));
    rows.push(profile({ id: IDS.DEPARTURE_B, scope, hire, departure: secondDeparture,
        sequence: includeOpenProfile ? 4 : 3,
        createdAt: `${firstDeparture}T09:00:00.000Z` }));
    return {
        name: 'COMPETING_DEPARTURE_DATES_ACTIVE_MASTER',
        scope,
        currentEmployee: currentEmployee({ scope, row: rows.at(-1),
            departure: secondDeparture }),
        completeHistoryRows: rows,
        protectedReferenceSummary: references(rows, referencedIds),
        asOfDate: '2026-10-06'
    };
}

function departureAndHistoricalPayFactFixture({ referencedIds = [] } = {}) {
    const scope = scopeFor('departure-and-pay-effective-date');
    const hire = '2026-05-01';
    const oldPay = 1095.16;
    const currentPay = 1006.06;
    const rows = [
        profile({ id: IDS.OPEN, scope, hire, pay: oldPay,
            sequence: 1, createdAt: '2026-05-25T08:00:00.000Z' }),
        profile({ id: IDS.DEPARTURE_A, scope, hire, departure: '2026-08-17', pay: oldPay,
            sequence: 2, createdAt: '2026-08-17T08:00:00.000Z' }),
        profile({ id: IDS.DEPARTURE_B, scope, hire, departure: '2026-08-12', pay: currentPay,
            payCorrection: true, sequence: 3, createdAt: '2026-08-17T09:00:00.000Z' })
    ];
    return {
        name: 'DEPARTURE_AND_HISTORICAL_PAY_EFFECTIVE_DATE_FACTS',
        scope,
        currentEmployee: currentEmployee({ scope, row: rows[2], departure: '2026-08-12' }),
        completeHistoryRows: rows,
        protectedReferenceSummary: references(rows, referencedIds),
        asOfDate: '2026-10-06'
    };
}

module.exports = {
    IDS,
    provenance,
    competingDepartureDatesFixture,
    departureAndHistoricalPayFactFixture
};
