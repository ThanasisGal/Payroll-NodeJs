'use strict';

// Privacy-safe exact structural fixture: real scope/identities and employment
// facts are retained, while all personal fields are deliberately absent.
const SCOPE = Object.freeze({ team: 'THA', company_kod: '6a1f305859dd2f1ac8afac69', kodikos: '0002' });
const IDS = Object.freeze({ OLD_PROFILE: '6a1f3df559dd2f1ac8afac81',
    DEPARTURE: '6a731cee61cb0b2bc7419480', CURRENT_PROFILE: '6aacdfdb4d39bff236275f6d' });

function profile(id, aa, hire, from, until, contractEnd, createdAt, extra = {}) {
    return { _id: id, ...SCOPE, aa_eggrafhs: aa,
        hmeromhnia_proslhpshs: hire,
        hmeromhnia_allaghs_symbashs: from,
        hmeromhnia_allaghs_orarioy_apo: from,
        hmeromhnia_allaghs_orarioy_eos: until,
        hmeromhnia_isxyos_oron_ergasias_apo: from,
        hmeromhnia_isxyos_oron_ergasias_eos: until,
        hmeromhnia_isxyos_dialleimatos_apo: null,
        hmeromhnia_lhxhs_symbashs: contractEnd,
        afora_proslhpsh: true,
        afora_allagh_oron_ergasias: true,
        afora_allagh_dialleimatos: false,
        kathestos_apasxolhshs: '0',
        typos_ebdomadas: '5HMERH',
        apasxolhsh_basei_symbashs: 'ΠΛΗΡΗΣ',
        hmeres_ergasias_ebdomadas: 5,
        ores_ergasias_ebdomadas: 40,
        mo_oron_hmerhsias_ergasias: 8,
        createdAt,
        updatedAt: createdAt,
        ...extra };
}

function buildReal0002SanitizedHistoryFixture() {
    const history = [
        profile(IDS.OLD_PROFILE, '0001', '2025-12-01', '2026-04-01', '2026-09-15',
            '2026-07-31', '2026-06-02T20:32:53.000Z',
            { typos_apasxolhshs: '5', hmeromhnia_apoxorhshs: null }),
        profile(IDS.DEPARTURE, '0002', '2025-12-01', '2026-04-01', '2026-07-31',
            '2026-07-31', '2026-08-05T11:22:22.000Z',
            { typos_apasxolhshs: '1', hmeromhnia_apoxorhshs: '2026-07-31' }),
        profile(IDS.CURRENT_PROFILE, '0003', '2026-09-16', '2026-09-16', null,
            '2027-07-30', '2026-09-18T06:53:15.000Z',
            { typos_apasxolhshs: '1', hmeromhnia_apoxorhshs: null,
                hmeromhnia_allaghs_orarioy_eos: '2026-09-22',
                employment_profile_schema_version: 1,
                employment_profile_type_version: 1,
                employment_profile_source: 'EMPLOYEE_PROFILE_FOUNDATION',
                dieythesi_xronoy_ergasias_energh: false })
    ];
    const currentEmployee = { ...history[2], _id: '6a1f3df259dd2f1ac8afac79' };
    return { scope: { ...SCOPE }, currentEmployee, history: history.map(row => ({ ...row })) };
}

module.exports = { REAL_0002_IDS: IDS, buildReal0002SanitizedHistoryFixture };
