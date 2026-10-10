'use strict';

// Entirely synthetic: these factories never read a database or real employee.
const scope = Object.freeze({ team: 'TEST', company_kod: 'synthetic-company', kodikos: 'synthetic-employee' });
const workTerms = Object.freeze({ hmeres_ergasias_ebdomadas: 5,
    ores_ergasias_ebdomadas: 40, mo_oron_hmerhsias_ergasias: 8 });

function row(identity, extra = {}) {
    return { _id: `synthetic-${identity}`, aa_eggrafhs: identity, ...scope,
        hmeromhnia_allaghs_orarioy_apo: '2031-01-01',
        hmeromhnia_allaghs_orarioy_eos: '2020-01-01', ...extra };
}
function caseA() {
    return { scope, currentEmployee: { _id: 'synthetic-current', ...scope,
        hmeromhnia_proslhpshs: '2026-04-24', hmeromhnia_lhxhs_symbashs: '2026-10-05' },
    completeHistoryRows: [
        row('0001', { afora_proslhpsh: true, hmeromhnia_proslhpshs: '2026-04-24',
            hmeromhnia_allaghs_symbashs: '2026-04-24',
            hmeromhnia_isxyos_oron_ergasias_apo: null, hmeromhnia_isxyos_oron_ergasias_eos: null,
            hmeres_ergasias_ebdomadas: null, ores_ergasias_ebdomadas: null, mo_oron_hmerhsias_ergasias: null }),
        row('0002', { hmeromhnia_proslhpshs: '2026-04-24', ...workTerms,
            hmeromhnia_isxyos_oron_ergasias_apo: '2026-05-25', hmeromhnia_lhxhs_symbashs: '2026-10-05' })
    ] };
}
function caseB() {
    return { scope, currentEmployee: { _id: 'synthetic-current', ...scope,
        hmeromhnia_proslhpshs: '2026-04-23' }, completeHistoryRows: [
        row('0002', { afora_proslhpsh: true, hmeromhnia_proslhpshs: '2026-04-23' }),
        row('0001', { hmeromhnia_allaghs_symbashs: '2026-04-23', hmeromhnia_lhxhs_symbashs: '2026-10-15' }),
        row('0003', { hmeromhnia_allaghs_symbashs: '2026-05-17', ...workTerms })
    ] };
}

// Separate enriched variant: keep the exact sparse Case B unchanged for the
// before/after default-count comparison and exercise complementary/conflicting facts.
function caseBWithProfileEvidence() {
    const input = caseB();
    Object.assign(input.completeHistoryRows.find(row => row.aa_eggrafhs === '0001'), {
        krathsh_01: '0111', pragmatikosMisthos: 1200
    });
    Object.assign(input.completeHistoryRows.find(row => row.aa_eggrafhs === '0002'), {
        krathsh_01: '0115', symbash: 'SYNTHETIC_CONTRACT', synexes_diakekomeno: false
    });
    return input;
}

// Three compatible legacy artifacts whose reconstructed periods coincide.
// Generic Maintenance cleanup would collapse them, although the automatic
// reconstruction contract deliberately preserves every original row and id.
function coincidentLegacyArtifacts() {
    const types = require('../employeeHistoryAutomaticReconstructionContract').PROFILE_FIELD_TYPES;
    const existingNumericZeros = Object.fromEntries(Object.entries(types)
        .filter(([field, type]) => type === 'Number' &&
            !['hmeres_ergasias_ebdomadas', 'ores_ergasias_ebdomadas', 'mo_oron_hmerhsias_ergasias',
                'dialleima_se_lepta', 'evelikth_proselefsh', 'symbatikes_ores_ergasias',
                'pososto_prosayxhshs_6hs_hmeras'].includes(field))
        .map(([field]) => [field, 0]));
    const identity = { afora_proslhpsh: true, hmeromhnia_proslhpshs: '2026-04-23',
        hmeromhnia_allaghs_symbashs: '2026-04-23',
        hmeromhnia_lhxhs_symbashs: '2026-10-15', hmeromhnia_apoxorhshs: null };
    const profile = { ...workTerms, typos_apasxolhshs: '0', typos_ebdomadas: '5HMERH',
        pososto_prosayxhshs_6hs_hmeras: 0,
        krathsh_01: '0111', krathsh_02: '0222', krathsh_03: '0333', krathsh_04: '0444' };
    const currentEmployee = { _id: 'synthetic-current', ...scope, ...identity, ...workTerms,
        hmeromhnia_isxyos_oron_ergasias_apo: '2026-05-25',
        hmeromhnia_isxyos_oron_ergasias_eos: '2026-10-15',
        dialleima_se_lepta: 30, dialleima_entos_ektos_orarioy: false,
        evelikth_proselefsh: 120, symbatikes_ores_ergasias: 40,
        meiosh_eisforon_mhteron: false };
    const revision = { ...existingNumericZeros, updatedAt: new Date('2026-06-01') };
    return { scope, currentEmployee, completeHistoryRows: [
        row('0001', { ...identity, ...revision,
            krathsh_01: null, krathsh_02: null, krathsh_03: null, krathsh_04: null }),
        row('0002', { ...identity, ...profile, ...revision, afora_allagh_oron_ergasias: true,
            hmeromhnia_isxyos_oron_ergasias_apo: '2026-05-25',
            hmeromhnia_isxyos_oron_ergasias_eos: '2026-10-15' }),
        row('0003', { ...identity, ...profile, ...revision, afora_allagh_oron_ergasias: false,
            hmeromhnia_isxyos_oron_ergasias_apo: null,
            hmeromhnia_isxyos_oron_ergasias_eos: null,
            dialleima_se_lepta: 0, dialleima_entos_ektos_orarioy: false })
    ] };
}

module.exports = { scope, workTerms, row, caseA, caseB, caseBWithProfileEvidence,
    coincidentLegacyArtifacts };
