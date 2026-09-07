'use strict';

const contract = require('../utils/ergazomenoi/employmentProfileContract');

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
                contract.normalizeEmploymentProfileSubmission(this.toObject());
            }
        }
    });
}
module.exports = { employmentProfileFields, attachEmploymentProfileValidation };
