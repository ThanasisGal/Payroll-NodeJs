'use strict';

const FIELDS = Object.freeze({
    enabled: 'elegxos_ypopta_mikron_diastimaton_kartas',
    veryShort: 'poly_mikro_diastima_kartas_eos_lepta',
    short: 'mikro_diastima_kartas_eos_lepta',
    percentage: 'mikro_diastima_kartas_max_pososto_programmatos',
    missing: 'mikro_diastima_kartas_elaxistos_xronos_pou_leipei_apo_programma_se_lepta'
});

function error(field) {
    const value = new Error(`Μη έγκυρη τιμή στο πεδίο ${field}.`);
    value.code = 'COMPANY_SUSPICIOUS_SHORT_POLICY_INVALID';
    value.fieldName = field;
    value.status = 400;
    return value;
}

function bounded(value, field, minimum, maximum, fallback) {
    if (value === '' || value === null || value === undefined) return fallback;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < minimum || parsed > maximum) throw error(field);
    return parsed;
}

function normalizeCompanySuspiciousShortCardPolicy(input = {}) {
    const normalized = {
        [FIELDS.enabled]: input[FIELDS.enabled] === true,
        [FIELDS.veryShort]: bounded(input[FIELDS.veryShort], FIELDS.veryShort, 0, 1440, 5),
        [FIELDS.short]: bounded(input[FIELDS.short], FIELDS.short, 0, 1440, 60),
        [FIELDS.percentage]: bounded(input[FIELDS.percentage], FIELDS.percentage, 0, 100, 25),
        [FIELDS.missing]: bounded(input[FIELDS.missing], FIELDS.missing, 0, 1440, 60)
    };
    if (normalized[FIELDS.veryShort] > normalized[FIELDS.short]) throw error(FIELDS.veryShort);
    return Object.freeze(normalized);
}

module.exports = { FIELDS, normalizeCompanySuspiciousShortCardPolicy };
