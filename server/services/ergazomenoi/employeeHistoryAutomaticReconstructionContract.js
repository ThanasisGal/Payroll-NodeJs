'use strict';

// Independent Phase 1 contract. Do not import canonical/guided boundary helpers:
// their legacy schedule-date semantics intentionally remain unchanged.
const VERSION = 'employee-history-automatic-reconstruction:v1';
const SCOPE_FIELDS = Object.freeze(['team', 'company_kod', 'kodikos']);
const START = 'hmeromhnia_isxyos_oron_ergasias_apo';
const END = 'hmeromhnia_isxyos_oron_ergasias_eos';
const HIRE = 'hmeromhnia_proslhpshs';
const CHANGE = 'hmeromhnia_allaghs_symbashs';
const CONTRACT_END = 'hmeromhnia_lhxhs_symbashs';
const DEPARTURE = 'hmeromhnia_apoxorhshs';
const CRITICAL_NUMBERS = Object.freeze([
    'hmeres_ergasias_ebdomadas', 'ores_ergasias_ebdomadas', 'mo_oron_hmerhsias_ergasias'
]);

const FIELD_GROUPS = Object.freeze({
    IDENTITY_PROTECTED: Object.freeze([
        '_id', 'aa_eggrafhs', ...SCOPE_FIELDS, 'createdAt', 'updatedAt', 'history_reference_fence'
    ]),
    INFORMATIONAL: Object.freeze([
        'hmeromhnia_allaghs_orarioy_apo', 'hmeromhnia_allaghs_orarioy_eos',
        // Event/audit flags are retained, never borrowed from another event.
        'afora_allagh_oron_ergasias', 'afora_allagh_dialleimatos'
    ]),
    TEMPORAL_SEMANTIC: Object.freeze([HIRE, CHANGE, START, END, CONTRACT_END, DEPARTURE, 'afora_proslhpsh']),
    CANONICAL_METADATA: Object.freeze([
        'employment_history_canonical_status', 'employment_history_canonical_survivor_id',
        // Reconstruction must not certify a legacy snapshot or invent provenance.
        'employment_profile_source', 'employment_profile_schema_version',
        'ekdosh_typoy_egkekrimenhs_rythmishs'
    ]),
    INTERNAL_MONGOOSE: Object.freeze(['__v'])
});

const typed = (type, fields) => fields.map(field => [field, type]);
const PROFILE_FIELD_TYPES = Object.freeze(Object.fromEntries([
    ...typed('Number', [...CRITICAL_NUMBERS, 'misthologiko_klimakio',
        'pososto_prosayxhshs_6hs_hmeras', 'synolo_symbashs', 'synolo_symbashs_basei_oron_ergasias',
        'nomimosMisthos', 'nomimoHmeromisthio', 'nomimoOromisthio',
        'pragmatikosMisthos', 'pragmatikoHmeromisthio', 'pragmatikoOromisthio',
        'dialleima_se_lepta', 'evelikth_proselefsh', 'symbatikes_ores_ergasias']),
    ...typed('String', ['kathestos_apasxolhshs', 'typos_apasxolhshs', 'typos_ebdomadas',
        'symbash', 'kathgoria_symbashs', 'eidikothta_symbashs', 'eidikh_kathgoria_ergazomenoy',
        'typos_egkekrimenhs_rythmishs', 'diakoph_apo_ora_egkekrimenhs_rythmishs',
        'diakoph_eos_ora_egkekrimenhs_rythmishs', 'kathgoria_adeias_egkekrimenhs_rythmishs',
        ...Array.from({ length: 7 }, (_, i) => `krathsh_${String(i + 1).padStart(2, '0')}`),
        ...Array.from({ length: 3 }, (_, i) => String(i + 1).padStart(2, '0'))
            .flatMap(i => [`dialleima_apo_ora_${i}`, `dialleima_eos_ora_${i}`])]),
    ...Array.from({ length: 15 }, (_, i) => String(i + 1).padStart(2, '0')).flatMap(i => [
        [`stoixeio_symbashs_${i}`, 'String'], [`poso_symbashs_${i}`, 'Number'],
        [`poso_symbashs_basei_oron_ergasias_${i}`, 'Number']
    ]),
    ...typed('Boolean', ['afora_egkekrimenh_rythmish_ergasias', 'dialleima_entos_ektos_orarioy',
        'synexes_diakekomeno', 'typos_orarioy']),
    ...typed('Date', ['hmnia_enarxhs_egkekrimenhs_rythmishs', 'hmnia_lhxhs_egkekrimenhs_rythmishs',
        'hmeromhnia_isxyos_dialleimatos_apo']),
    ['hmeres_efarmoghs_egkekrimenhs_rythmishs', 'Array']
]));
const PROFILE_FIELDS = Object.freeze(Object.keys(PROFILE_FIELD_TYPES).sort());
const FIELD_CLASSIFICATION = Object.freeze(Object.fromEntries([
    ...Object.entries(FIELD_GROUPS).flatMap(([category, fields]) => fields.map(field => [field, category])),
    ...PROFILE_FIELDS.map(field => [field, 'RECONSTRUCTABLE_PROFILE'])
]));

// Empty discriminators do not prove incompatibility. Non-empty differences do.
// Critical work-time values are positive evidence only; legacy schema zero is a
// placeholder and may be replaced by compatible positive historical evidence.
const COMPATIBILITY_FIELDS = Object.freeze([
    'symbash', 'kathgoria_symbashs', 'eidikothta_symbashs', 'kathestos_apasxolhshs',
    'typos_apasxolhshs', 'typos_ebdomadas', 'eidikh_kathgoria_ergazomenoy', ...CRITICAL_NUMBERS
]);

module.exports = { VERSION, SCOPE_FIELDS, START, END, HIRE, CHANGE, CONTRACT_END, DEPARTURE,
    CRITICAL_NUMBERS, FIELD_GROUPS, PROFILE_FIELD_TYPES, PROFILE_FIELDS, FIELD_CLASSIFICATION,
    COMPATIBILITY_FIELDS };
