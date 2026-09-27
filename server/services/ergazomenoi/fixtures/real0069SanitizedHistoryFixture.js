'use strict';

const REAL_0069_SCOPE = Object.freeze({
    team: 'BLG',
    company_kod: '69e7812a74cb535fd4d1a6e1',
    kodikos: '0069'
});

const REAL_0069_IDS = Object.freeze({
    employee: '6a0ae4f19d755b68813ab0d3',
    '0001': '6a0ae4f19d755b68813ab0d4',
    '0002': '6a1ea990452cce439d414746',
    '0003': '6a3d404d8e5ad16d02bc01bf',
    '0004': '6a684d7161cb0b2bc73457ad',
    '0005': '6a8d6ef55de956f225b64693'
});

const dates = Object.freeze({
    hmeromhnia_proslhpshs: '2026-05-02',
    hmeromhnia_allaghs_symbashs: '2026-05-02',
    hmeromhnia_allaghs_orarioy_apo: '2026-05-02',
    hmeromhnia_allaghs_orarioy_eos: '2026-05-08',
    hmeromhnia_isxyos_oron_ergasias_apo: '2026-05-02',
    hmeromhnia_isxyos_oron_ergasias_eos: null,
    hmeromhnia_apoxorhshs: null
});

const workState = Object.freeze({
    hmeres_ergasias_ebdomadas: 5,
    ores_ergasias_ebdomadas: 20,
    mo_oron_hmerhsias_ergasias: 4,
    kathestos_apasxolhshs: '1',
    typos_apasxolhshs: '1',
    typos_ebdomadas: '5HMERH',
    nomimoHmeromisthio: 48.0128,
    nomimoOromisthio: 7.2019,
    pragmatikoHmeromisthio: 28.8077,
    pragmatikoOromisthio: 7.2019
});

const completeProfileFacts = Object.freeze({
    employment_profile_schema_version: 1,
    afora_egkekrimenh_rythmish_ergasias: false,
    typos_egkekrimenhs_rythmishs: null,
    hmnia_enarxhs_egkekrimenhs_rythmishs: null,
    hmnia_lhxhs_egkekrimenhs_rythmishs: null,
    diakoph_apo_ora_egkekrimenhs_rythmishs: null,
    diakoph_eos_ora_egkekrimenhs_rythmishs: null,
    hmeres_efarmoghs_egkekrimenhs_rythmishs: [],
    kathgoria_adeias_egkekrimenhs_rythmishs: null,
    ekdosh_typoy_egkekrimenhs_rythmishs: null,
    dialleima_se_lepta: 20,
    dialleima_entos_ektos_orarioy: false,
    dialleima_apo_ora_01: null,
    dialleima_eos_ora_01: null,
    dialleima_apo_ora_02: null,
    dialleima_eos_ora_02: null,
    dialleima_apo_ora_03: null,
    dialleima_eos_ora_03: null,
    synexes_diakekomeno: false,
    typos_orarioy: false,
    evelikth_proselefsh: 120,
    symbatikes_ores_ergasias: 40
});

function buildReal0069SanitizedHistoryFixture(scope = REAL_0069_SCOPE) {
    const scoped = { ...scope };
    const legacyProfile = (aa, contractEnd, createdAt, updatedAt, extra = {}) => ({
        _id: REAL_0069_IDS[aa],
        ...scoped,
        aa_eggrafhs: aa,
        ...dates,
        hmeromhnia_lhxhs_symbashs: contractEnd,
        employment_profile_source: 'ERGOMENOI_CONTROLLER',
        afora_proslhpsh: true,
        afora_allagh_oron_ergasias: true,
        ...workState,
        ...extra,
        createdAt,
        updatedAt
    });

    const history = [
        {
            _id: REAL_0069_IDS['0001'],
            ...scoped,
            aa_eggrafhs: '0001',
            hmeromhnia_proslhpshs: dates.hmeromhnia_proslhpshs,
            hmeromhnia_allaghs_symbashs: dates.hmeromhnia_allaghs_symbashs,
            hmeromhnia_allaghs_orarioy_apo: dates.hmeromhnia_allaghs_orarioy_apo,
            hmeromhnia_allaghs_orarioy_eos: dates.hmeromhnia_allaghs_orarioy_eos,
            hmeromhnia_lhxhs_symbashs: null,
            hmeromhnia_apoxorhshs: null,
            afora_proslhpsh: true,
            kathestos_apasxolhshs: '',
            nomimoHmeromisthio: 0,
            nomimoOromisthio: 0,
            pragmatikoHmeromisthio: 0,
            pragmatikoOromisthio: 0,
            createdAt: '2026-05-18T10:07:45.779Z',
            updatedAt: '2026-05-18T10:07:45.779Z'
        },
        legacyProfile('0002', '2026-10-31', '2026-06-02T09:59:44.165Z',
            '2026-06-25T14:45:46.877Z', { typos_apasxolhshs: '5' }),
        legacyProfile('0003', '2026-07-31', '2026-06-25T14:50:53.542Z',
            '2026-07-26T08:00:09.128Z'),
        legacyProfile('0004', '2026-08-31', '2026-07-28T06:34:25.034Z',
            '2026-07-28T06:34:25.043Z'),
        {
            ...legacyProfile('0005', '2026-09-30', '2026-08-25T10:31:17.307Z',
                '2026-09-25T13:18:45.189Z'),
            ...completeProfileFacts,
            employment_profile_source: 'EMPLOYEE_PROFILE_FOUNDATION',
            afora_allagh_dialleimatos: true,
            hmeromhnia_isxyos_dialleimatos_apo: '2026-05-02',
            eidikh_kathgoria_ergazomenoy: '0009',
            pososto_prosayxhshs_6hs_hmeras: 0
        }
    ];

    const currentEmployee = {
        _id: REAL_0069_IDS.employee,
        ...scoped,
        ...dates,
        hmeromhnia_lhxhs_symbashs: '2026-10-31',
        ...workState,
        ...completeProfileFacts,
        apasxolhsh_basei_symbashs: '5',
        pososto_prosayxhshs_6hs_hmeras: 0,
        eidikh_kathgoria_ergazomenoy: '0009',
        eidikh_periptosh: '',
        typos_ergazomenon: 'Μ',
        createdAt: '2026-05-13T13:00:44.328Z',
        updatedAt: '2026-09-25T13:18:45.208Z'
    };

    return { scope: scoped, currentEmployee, history };
}

module.exports = {
    REAL_0069_SCOPE,
    REAL_0069_IDS,
    buildReal0069SanitizedHistoryFixture
};
