'use strict';

const THA_0014_SCOPE = Object.freeze({
    team: 'THA', company_kod: 'company-0004', kodikos: '0014'
});
const THA_0014_IDS = Object.freeze({
    hire: '507f1f77bcf86cd799439101',
    firstProfile: '507f1f77bcf86cd799439102',
    technicalOne: '507f1f77bcf86cd799439103',
    technicalTwo: '507f1f77bcf86cd799439104',
    latestProfile: '507f1f77bcf86cd799439105',
    terminal: '507f1f77bcf86cd799439106',
    rehire: '507f1f77bcf86cd799439107'
});

function buildRow(id, sequence, extra = {}) {
    return {
        _id: id,
        ...THA_0014_SCOPE,
        aa_eggrafhs: sequence,
        hmeromhnia_proslhpshs: '2026-04-25',
        hmeromhnia_apoxorhshs: null,
        hmeromhnia_allaghs_symbashs: '2026-04-25',
        hmeromhnia_lhxhs_symbashs: '2026-10-31',
        hmeromhnia_allaghs_orarioy_apo: null,
        hmeromhnia_allaghs_orarioy_eos: null,
        hmeromhnia_isxyos_oron_ergasias_apo: null,
        hmeromhnia_isxyos_oron_ergasias_eos: null,
        afora_proslhpsh: false,
        afora_allagh_oron_ergasias: false,
        createdAt: `2026-0${Math.min(Number(sequence) + 3, 9)}-01T00:00:00.000Z`,
        updatedAt: `2026-0${Math.min(Number(sequence) + 3, 9)}-01T00:00:00.000Z`,
        ...extra
    };
}

function buildTha0014SanitizedDepartureCorrectionFixture() {
    const oldDeparture = '2026-09-20';
    const history = [
        buildRow(THA_0014_IDS.hire, '0001', { afora_proslhpsh: true,
            hmeromhnia_allaghs_orarioy_apo: '2026-04-25',
            hmeromhnia_allaghs_orarioy_eos: '2026-05-01' }),
        buildRow(THA_0014_IDS.firstProfile, '0002', {
            afora_allagh_oron_ergasias: true,
            hmeromhnia_isxyos_oron_ergasias_apo: '2026-05-25',
            hmeromhnia_isxyos_oron_ergasias_eos: '2026-06-14',
            hmeromhnia_allaghs_orarioy_apo: '2026-05-25',
            hmeromhnia_allaghs_orarioy_eos: '2026-05-31' }),
        buildRow(THA_0014_IDS.technicalOne, '0003', {
            hmeromhnia_allaghs_orarioy_apo: '2026-06-02',
            hmeromhnia_allaghs_orarioy_eos: '2026-06-08' }),
        buildRow(THA_0014_IDS.technicalTwo, '0004', {
            hmeromhnia_allaghs_orarioy_apo: '2026-06-14',
            hmeromhnia_allaghs_orarioy_eos: '2026-06-20' }),
        buildRow(THA_0014_IDS.latestProfile, '0005', {
            afora_allagh_oron_ergasias: true,
            hmeromhnia_isxyos_oron_ergasias_apo: '2026-06-15',
            hmeromhnia_isxyos_oron_ergasias_eos: oldDeparture,
            hmeromhnia_allaghs_orarioy_apo: '2026-06-16',
            hmeromhnia_allaghs_orarioy_eos: '2026-06-22',
            updatedAt: '2026-06-27T07:30:53.692Z' }),
        buildRow(THA_0014_IDS.terminal, '0006', {
            hmeromhnia_apoxorhshs: oldDeparture,
            hmeromhnia_allaghs_orarioy_apo: '2026-07-06',
            hmeromhnia_allaghs_orarioy_eos: '2026-07-12',
            updatedAt: '2026-08-14T21:20:31.283Z' })
    ];
    const employee = {
        ...history[4],
        _id: 'employee-0014',
        hmeromhnia_isxyos_oron_ergasias_apo: '2026-05-25',
        hmeromhnia_isxyos_oron_ergasias_eos: oldDeparture,
        hmeromhnia_apoxorhshs: oldDeparture,
        energos: false,
        archived: false,
        updatedAt: '2026-09-21T12:04:56.190Z'
    };
    const departureAuditContext = [{ historyBefore: [
        { ...history[4] }, { ...history[5] }
    ] }];
    return {
        scope: { ...THA_0014_SCOPE },
        currentEmployee: employee,
        completeHistoryRows: history,
        departureAuditContext,
        protectedReferences: {
            [THA_0014_IDS.terminal]: [{
                collection: 'Apasxoliseis_Period_Frozen_Snapshots',
                documentId: `snapshot-${THA_0014_IDS.terminal}`
            }],
            [THA_0014_IDS.latestProfile]: [{
                collection: 'Apasxoliseis_Period_Frozen_Snapshots',
                documentId: `snapshot-${THA_0014_IDS.latestProfile}`
            }]
        }
    };
}

module.exports = { THA_0014_SCOPE, THA_0014_IDS, buildRow,
    buildTha0014SanitizedDepartureCorrectionFixture };
