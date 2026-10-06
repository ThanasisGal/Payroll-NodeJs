'use strict';

const { buildCompleteProfileSnapshot } =
    require('../../../utils/ergazomenoi/employmentProfileHistory');
const C = require('../../../utils/ergazomenoi/employmentProfileContract');

const scope = Object.freeze({ team: 'TEST', company_kod: 'synthetic-company', kodikos: '0099' });
const provenance = id => [{ collection: 'Apasxoliseis_Period_Frozen_Snapshots',
    documentId: `synthetic-reference-${id}` }];

function completeProfile(from, extra = {}) {
    return {
        ...buildCompleteProfileSnapshot({ effectiveFrom: from }),
        hmeromhnia_proslhpshs: '2026-04-24',
        hmeromhnia_allaghs_symbashs: '2026-04-24',
        hmeromhnia_lhxhs_symbashs: '2026-10-31',
        hmeres_ergasias_ebdomadas: 5,
        ores_ergasias_ebdomadas: 40,
        mo_oron_hmerhsias_ergasias: 8,
        symbash: '0002',
        kathgoria_symbashs: '0004',
        eidikothta_symbashs: '0003',
        synolo_symbashs: 1146.30,
        nomimosMisthos: 1146.30,
        pragmatikosMisthos: 1146.30,
        krathsh_01: '0115',
        ...extra
    };
}

function incompleteEvidence(id, hire, scheduleFrom, scheduleTo, extra = {}) {
    return {
        _id: id, ...scope, aa_eggrafhs: id.slice(-4),
        createdAt: new Date(`${hire}T08:00:00.000Z`),
        updatedAt: new Date(`${hire}T09:00:00.000Z`),
        hmeromhnia_proslhpshs: hire,
        hmeromhnia_allaghs_symbashs: hire,
        hmeromhnia_allaghs_orarioy_apo: scheduleFrom,
        hmeromhnia_allaghs_orarioy_eos: scheduleTo,
        hmeromhnia_lhxhs_symbashs: '2026-10-31',
        hmeromhnia_apoxorhshs: null,
        afora_proslhpsh: true,
        afora_allagh_oron_ergasias: false,
        symbash: '0002', kathgoria_symbashs: '0004', eidikothta_symbashs: '0003',
        synolo_symbashs: 1146.30, nomimosMisthos: 1146.30,
        pragmatikosMisthos: 1146.30,
        ...extra
    };
}

function fixtureResult(name, hire, currentEmployee, rows) {
    return {
        name,
        scope,
        currentEmployee: { _id: `${name}-employee`, ...scope, ...currentEmployee,
            hmeromhnia_proslhpshs: hire, energos: true, archived: false },
        completeHistoryRows: rows,
        protectedReferenceSummary: Object.fromEntries(rows.map(row =>
            [String(row._id), provenance(row._id)])),
        catalogs: {
            KPK_EFKA: [
                { code: '0109', label: 'ΜΙΚΤΑ, ΙΚΑ-ΤΕΑΜ' },
                { code: '0111', label: 'ΣΥΝΤΑΞΗ' },
                { code: '0115', label: 'ΣΥΝΤΑΞΗ, ΒΑΡΕΑ, ΙΚΑ-ΤΕΑΜ' }
            ]
        }
    };
}

function h1MissingInitialProfileFixture() {
    const hire = '2026-04-23';
    const later = { _id: 'h1-later-profile', ...scope,
        ...completeProfile('2026-05-25', { hmeromhnia_proslhpshs: hire,
            hmeromhnia_allaghs_symbashs: hire, krathsh_01: '0109' }),
        aa_eggrafhs: '0002', createdAt: new Date('2026-05-24T18:00:00Z'),
        updatedAt: new Date('2026-05-24T19:00:00Z'), afora_proslhpsh: true };
    const legacy = incompleteEvidence('h1-incomplete-initial', hire,
        '2026-04-27', '2026-05-03', { krathsh_01: null });
    const artifact = incompleteEvidence('h1-provenance-artifact', hire,
        '2026-05-25', '2026-05-31', { krathsh_01: '0109' });
    const rows = [legacy, later, artifact];
    return fixtureResult('H1_MISSING_INITIAL_PROFILE', hire,
        { ...later, _id: 'h1-current' }, rows);
}

function h2KpkBoundaryFixture() {
    const hire = '2026-04-24';
    const later = { _id: 'h2-later-profile', ...scope,
        ...completeProfile('2026-05-25', { hmeromhnia_proslhpshs: hire,
            hmeromhnia_allaghs_symbashs: hire, krathsh_01: '0115' }),
        aa_eggrafhs: '0002', createdAt: new Date('2026-05-24T18:00:00Z'),
        updatedAt: new Date('2026-05-24T19:00:00Z'), afora_proslhpsh: true };
    const legacy = incompleteEvidence('h2-incomplete-initial', hire,
        '2026-04-25', '2026-05-01', { krathsh_01: '0111' });
    const artifact = incompleteEvidence('h2-provenance-artifact', hire,
        '2026-05-25', '2026-05-31', { krathsh_01: '0115' });
    const rows = [legacy, later, artifact];
    return fixtureResult('H2_KPK_INITIAL_BOUNDARY', hire,
        { ...later, _id: 'h2-current' }, rows);
}

function h3IntermediateOverlapFixture() {
    const hire = '2026-04-23';
    const earlier = { _id: 'h3-earlier-profile', ...scope,
        ...completeProfile('2026-05-17', { hmeromhnia_proslhpshs: hire,
            hmeromhnia_allaghs_symbashs: '2026-05-17',
            hmeromhnia_allaghs_orarioy_apo: '2026-05-17',
            hmeromhnia_allaghs_orarioy_eos: '2026-05-23',
            hmeromhnia_isxyos_oron_ergasias_eos: '2026-10-15',
            typos_apasxolhshs: '0', krathsh_01: '0109',
            pososto_prosayxhshs_6hs_hmeras: 0 }),
        aa_eggrafhs: '0003', createdAt: new Date('2026-06-13T11:00:00Z'),
        updatedAt: new Date('2026-07-29T16:00:00Z'), afora_proslhpsh: false };
    const later = { _id: 'h3-later-profile', ...scope,
        ...completeProfile('2026-05-25', { hmeromhnia_proslhpshs: hire,
            hmeromhnia_allaghs_symbashs: hire,
            hmeromhnia_allaghs_orarioy_apo: '2026-05-25',
            hmeromhnia_allaghs_orarioy_eos: '2026-05-31',
            hmeromhnia_isxyos_oron_ergasias_eos: '2026-10-15',
            typos_apasxolhshs: '5', krathsh_01: '0109',
            pososto_prosayxhshs_6hs_hmeras: null }),
        aa_eggrafhs: '0002', createdAt: new Date('2026-05-24T19:00:00Z'),
        updatedAt: new Date('2026-06-13T11:00:00Z'), afora_proslhpsh: true };
    const artifact = incompleteEvidence('h3-intermediate-artifact', hire,
        '2026-05-18', '2026-05-24', { hmeromhnia_proslhpshs: null,
            afora_allagh_oron_ergasias: undefined, krathsh_01: null });
    for (const row of [earlier, later]) {
        for (const field of C.FACT_FIELDS) delete row[field];
    }
    const rows = [artifact, later, earlier];
    return fixtureResult('H3_INTERMEDIATE_OVERLAP', hire,
        { ...earlier, _id: 'h3-current' }, rows);
}

module.exports = {
    scope,
    provenance,
    completeProfile,
    h1MissingInitialProfileFixture,
    h2KpkBoundaryFixture,
    h3IntermediateOverlapFixture
};
