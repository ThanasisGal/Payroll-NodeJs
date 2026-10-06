'use strict';

const { buildCompleteProfileSnapshot } =
    require('../../../utils/ergazomenoi/employmentProfileHistory');
const C = require('../../../utils/ergazomenoi/employmentProfileContract');

const scope = Object.freeze({ team: 'TEST', company_kod: 'synthetic-company', kodikos: '0099' });
const provenance = id => [{ collection: 'Apasxoliseis_Period_Frozen_Snapshots',
    documentId: `synthetic-reference-${id}` }];

function shapeALifecycleFixture() {
    const hire = '2026-04-24';
    const profileStart = '2026-05-25';
    const departure = '2026-09-08';
    const facts = { ...buildCompleteProfileSnapshot({ effectiveFrom: profileStart }),
        hmeromhnia_isxyos_oron_ergasias_eos: departure,
        hmeres_ergasias_ebdomadas: 5, ores_ergasias_ebdomadas: 40,
        mo_oron_hmerhsias_ergasias: 8, krathsh_01: '0115' };
    const hireRow = { _id: 'shape-a-hire', ...scope, aa_eggrafhs: '0001',
        createdAt: new Date('2026-04-24T08:00:00Z'),
        hmeromhnia_proslhpshs: hire, hmeromhnia_allaghs_symbashs: hire,
        hmeromhnia_allaghs_orarioy_apo: hire,
        hmeromhnia_allaghs_orarioy_eos: '2026-04-30', afora_proslhpsh: true,
        afora_allagh_oron_ergasias: false };
    const profileRow = { _id: 'shape-a-profile', ...scope, ...facts, aa_eggrafhs: '0002',
        createdAt: new Date('2026-05-25T08:00:00Z'), hmeromhnia_proslhpshs: hire,
        hmeromhnia_allaghs_symbashs: hire,
        hmeromhnia_allaghs_orarioy_apo: profileStart,
        hmeromhnia_allaghs_orarioy_eos: '2026-05-31',
        hmeromhnia_apoxorhshs: departure, afora_proslhpsh: true,
        afora_allagh_oron_ergasias: true };
    const departureRow = { _id: 'shape-a-departure', ...scope, ...facts,
        aa_eggrafhs: '0003', createdAt: new Date('2026-09-08T08:00:00Z'),
        hmeromhnia_proslhpshs: hire, hmeromhnia_allaghs_symbashs: hire,
        hmeromhnia_allaghs_orarioy_apo: profileStart,
        hmeromhnia_allaghs_orarioy_eos: '2026-05-31',
        hmeromhnia_isxyos_oron_ergasias_apo: null,
        hmeromhnia_isxyos_oron_ergasias_eos: null,
        hmeromhnia_apoxorhshs: departure, afora_proslhpsh: true,
        afora_allagh_oron_ergasias: false };
    for (const field of C.FACT_FIELDS) delete departureRow[field];
    const rows = [hireRow, profileRow, departureRow];
    return {
        name: 'SANITIZED_SINGLE_CYCLE_LIFECYCLE_FLAGS', scope,
        currentEmployee: { _id: 'shape-a-employee', ...scope, ...facts,
            hmeromhnia_proslhpshs: hire, hmeromhnia_allaghs_symbashs: hire,
            hmeromhnia_allaghs_orarioy_apo: profileStart,
            hmeromhnia_allaghs_orarioy_eos: '2026-05-31',
            hmeromhnia_apoxorhshs: departure, energos: false, archived: false },
        completeHistoryRows: rows,
        protectedReferenceSummary: Object.fromEntries(rows.map(row =>
            [String(row._id), provenance(row._id)]))
    };
}

function shapeBCorrectedProfileFixture() {
    const hire = '2026-05-30';
    const departure = '2026-06-01';
    const base = { ...buildCompleteProfileSnapshot({ effectiveFrom: hire }),
        hmeres_ergasias_ebdomadas: 3, ores_ergasias_ebdomadas: 24,
        mo_oron_hmerhsias_ergasias: 8, krathsh_02: '4172',
        krathsh_03: '0024', krathsh_04: '0025', krathsh_05: null };
    const older = { _id: 'shape-b-older', ...scope, ...base, aa_eggrafhs: '0001',
        createdAt: new Date('2026-05-30T08:00:00Z'), updatedAt: new Date('2026-05-30T09:00:00Z'),
        hmeromhnia_proslhpshs: hire, hmeromhnia_allaghs_symbashs: hire,
        hmeromhnia_allaghs_orarioy_apo: hire,
        hmeromhnia_allaghs_orarioy_eos: departure,
        hmeromhnia_isxyos_oron_ergasias_apo: hire,
        hmeromhnia_isxyos_oron_ergasias_eos: null,
        hmeromhnia_lhxhs_symbashs: departure, hmeromhnia_apoxorhshs: null,
        afora_proslhpsh: true, afora_allagh_oron_ergasias: true, krathsh_01: '0111' };
    const survivor = { ...older, _id: 'shape-b-survivor', aa_eggrafhs: '0002',
        createdAt: new Date('2026-05-30T20:00:00Z'), updatedAt: new Date('2026-05-30T21:00:00Z'),
        hmeromhnia_allaghs_orarioy_eos: '2026-06-05', krathsh_01: '0109' };
    const terminalFacts = { ...survivor, krathsh_03: '0023', krathsh_05: '2694' };
    const departureRow = { ...terminalFacts, _id: 'shape-b-departure', aa_eggrafhs: '0003',
        createdAt: new Date('2026-06-04T18:00:00Z'), updatedAt: new Date('2026-06-04T19:00:00Z'),
        hmeromhnia_apoxorhshs: departure };
    delete departureRow.employment_profile_schema_version;
    const rows = [older, survivor, departureRow];
    return {
        name: 'SANITIZED_CORRECTED_SAME_DATE_REFERENCED_PROFILE', scope,
        currentEmployee: { _id: 'shape-b-employee', ...scope, ...terminalFacts,
            hmeromhnia_isxyos_oron_ergasias_eos: null,
            hmeromhnia_apoxorhshs: departure, energos: false, archived: false },
        completeHistoryRows: rows,
        protectedReferenceSummary: Object.fromEntries(rows.map(row =>
            [String(row._id), provenance(row._id)]))
    };
}

module.exports = { scope, provenance, shapeALifecycleFixture, shapeBCorrectedProfileFixture };
