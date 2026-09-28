'use strict';

const contract = require('../utils/ergazomenoi/employmentProfileContract');
const { LEGACY_OPEN_CYCLE_CLEANUP_FOUNDATION_SOURCE } =
    require('../constants/employeeLegacyOpenCycleCleanup');

const LEGACY_FOUNDATION_FORBIDDEN_DATES = Object.freeze([
    'hmeromhnia_apoxorhshs',
    'hmeromhnia_isxyos_oron_ergasias_apo',
    'hmeromhnia_isxyos_oron_ergasias_eos',
    'hmeromhnia_allaghs_symbashs',
    'hmeromhnia_allaghs_orarioy_apo',
    'hmeromhnia_allaghs_orarioy_eos',
    'hmeromhnia_lhxhs_symbashs'
]);
const LEGACY_FOUNDATION_ALLOWED_FIELDS = new Set([
    '_id', '__v', 'team', 'company_kod', 'kodikos', 'aa_eggrafhs',
    'hmeromhnia_proslhpshs', 'afora_proslhpsh', 'afora_allagh_oron_ergasias',
    'employment_profile_source', 'createdAt', 'updatedAt'
]);

function isMinimalLegacyOpenCycleFoundation(document = {}) {
    return document.employment_profile_source ===
            LEGACY_OPEN_CYCLE_CLEANUP_FOUNDATION_SOURCE &&
        document.afora_proslhpsh === true &&
        document.afora_allagh_oron_ergasias === false &&
        document.afora_allagh_dialleimatos == null &&
        document.hmeromhnia_isxyos_dialleimatos_apo == null &&
        document[contract.SCHEMA_VERSION] == null &&
        document.hmeromhnia_proslhpshs != null &&
        LEGACY_FOUNDATION_FORBIDDEN_DATES.every(field => document[field] == null) &&
        Object.keys(document).every(field => LEGACY_FOUNDATION_ALLOWED_FIELDS.has(field));
}

function employmentProfileFields({ history = false } = {}) {
    const fields = {
        [contract.ENABLED]: { type: Boolean, default: false },
        [contract.FROM]: { type: Date, default: null },
        [contract.UNTIL]: { type: Date, default: null },
        [contract.DAYS]: { type: [Number], default: () => [] },
        // null remains null on hydration: schema defaults must not certify legacy history.
        [contract.SCHEMA_VERSION]: { type: Number, default: null }
    };
    for (const field of [contract.TYPE, contract.START, contract.END, contract.CATEGORY,
        contract.TYPE_VERSION, ...contract.BREAK_PAIRS.flat()]) {
        fields[field] = { type: String, trim: true, default: null };
    }
    if (history) {
        fields.eidikh_kathgoria_ergazomenoy = { type: String, trim: true };
        for (const field of ['dialleima_se_lepta', 'evelikth_proselefsh', 'symbatikes_ores_ergasias']) {
            fields[field] = { type: Number };
        }
        for (const field of ['dialleima_entos_ektos_orarioy', 'synexes_diakekomeno', 'typos_orarioy']) {
            fields[field] = { type: Boolean };
        }
        fields.afora_allagh_dialleimatos = { type: Boolean };
        fields.hmeromhnia_isxyos_dialleimatos_apo = { type: Date };
    }
    if (!history) fields.employment_profile_pre_v1 = { type: require('mongoose').Schema.Types.Mixed, default: undefined };
    return fields;
}

// Document writes share validation with the foundation writer. Query updates must
// use that writer: Mongoose update validators alone cannot validate complete pairs.
function attachEmploymentProfileValidation(schema) {
    schema.pre('validate', function () {
        const snapshot = this.toObject();
        if (this.isNew && snapshot.employment_profile_source ===
                LEGACY_OPEN_CYCLE_CLEANUP_FOUNDATION_SOURCE) {
            if (!isMinimalLegacyOpenCycleFoundation(snapshot)) {
                contract.invalid('employment_profile_source',
                    'legacy open-cycle foundation must remain sparse');
            }
            return;
        }
        if (this.isNew || contract.FACT_FIELDS.some((field) => this.isModified(field))) {
            const validated = this.$locals.employmentProfileValidation;
            if (validated) {
                const facts = contract.normalizeEmploymentProfileSubmission(validated.input, validated.current);
                for (const field of contract.FACT_FIELDS) {
                    if (JSON.stringify(this.toObject()[field]) !== JSON.stringify(facts[field])) {
                        contract.invalid(field, 'snapshot differs from validated facts');
                    }
                }
            } else {
                contract.normalizeEmploymentProfileSubmission(snapshot);
            }
        }
    });
}
module.exports = { employmentProfileFields, attachEmploymentProfileValidation,
    isMinimalLegacyOpenCycleFoundation };
