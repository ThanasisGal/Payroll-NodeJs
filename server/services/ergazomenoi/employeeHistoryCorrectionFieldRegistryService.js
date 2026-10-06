'use strict';

const C = require('../../utils/ergazomenoi/employmentProfileContract');

const REGISTRY_VERSION = 'employee-history-correction-field-registry:v1';
const TEMPORAL_PERIOD_FIELDS = Object.freeze([
    'hmeromhnia_isxyos_oron_ergasias_apo',
    'hmeromhnia_isxyos_oron_ergasias_eos'
]);
const NEVER_IMPLICITLY_MUTATE = Object.freeze([
    'hmeromhnia_allaghs_symbashs',
    'hmeromhnia_proslhpshs',
    'hmeromhnia_apoxorhshs',
    'hmeromhnia_allaghs_orarioy_apo',
    'hmeromhnia_allaghs_orarioy_eos'
]);

const entries = [
    {
        id: 'KPK', label: 'Ασφαλιστική κατηγορία / ΚΠΚ', fields: ['krathsh_01'],
        dataType: 'CATALOG_CHOICE', catalog: 'KPK_EFKA',
        correctionCanAlterPeriodValue: true, realChangeRequiresEffectiveBoundary: true,
        normalize(value) {
            const result = String(value ?? '').trim();
            if (!/^\d{4}$/.test(result)) invalid('KPK', 'INVALID_CATALOG_CODE');
            return result;
        }
    },
    {
        id: 'SPECIALTY', label: 'Ειδικότητα σύμβασης', fields: ['eidikothta_symbashs'],
        dataType: 'CATALOG_CHOICE', catalog: 'CONTRACT_SPECIALTY',
        correctionCanAlterPeriodValue: true, realChangeRequiresEffectiveBoundary: true,
        normalize(value) {
            const result = String(value ?? '').trim();
            if (!/^[0-9A-Za-z._/-]{1,40}$/.test(result)) {
                invalid('SPECIALTY', 'INVALID_CATALOG_CODE');
            }
            return result;
        }
    },
    {
        id: 'CONTRACT_TYPE', label: 'Τύπος σύμβασης', fields: ['symbash'],
        dataType: 'CATALOG_CHOICE', catalog: 'CONTRACT_TYPE',
        correctionCanAlterPeriodValue: true, realChangeRequiresEffectiveBoundary: true,
        normalize: catalogCode('CONTRACT_TYPE')
    },
    {
        id: 'CONTRACT_CATEGORY', label: 'Κατηγορία σύμβασης', fields: ['kathgoria_symbashs'],
        dataType: 'CATALOG_CHOICE', catalog: 'CONTRACT_CATEGORY',
        correctionCanAlterPeriodValue: true, realChangeRequiresEffectiveBoundary: true,
        normalize: catalogCode('CONTRACT_CATEGORY')
    },
    {
        id: 'WORK_DAYS', label: 'Ημέρες εργασίας ανά εβδομάδα',
        fields: ['hmeres_ergasias_ebdomadas'], dataType: 'INTEGER',
        correctionCanAlterPeriodValue: true, realChangeRequiresEffectiveBoundary: true,
        min: 1, max: 7, normalize: integer('WORK_DAYS', 1, 7)
    },
    {
        id: 'WEEKLY_HOURS', label: 'Ώρες εργασίας ανά εβδομάδα',
        fields: ['ores_ergasias_ebdomadas'], dataType: 'DECIMAL',
        correctionCanAlterPeriodValue: true, realChangeRequiresEffectiveBoundary: true,
        min: 0.01, max: 168, normalize: decimal('WEEKLY_HOURS', 0.01, 168)
    },
    {
        id: 'DAILY_HOURS', label: 'Μέσος όρος ημερήσιας εργασίας',
        fields: ['mo_oron_hmerhsias_ergasias'], dataType: 'DECIMAL',
        correctionCanAlterPeriodValue: true, realChangeRequiresEffectiveBoundary: true,
        min: 0.01, max: 24, normalize: decimal('DAILY_HOURS', 0.01, 24)
    },
    {
        id: 'LEGAL_PAY', label: 'Νόμιμες αποδοχές', fields: ['nomimosMisthos'],
        dataType: 'DECIMAL', correctionCanAlterPeriodValue: true,
        realChangeRequiresEffectiveBoundary: true, min: 0, max: 1000000,
        normalize: decimal('LEGAL_PAY', 0, 1000000)
    },
    {
        id: 'ACTUAL_PAY', label: 'Πραγματικές αποδοχές', fields: ['pragmatikosMisthos'],
        dataType: 'DECIMAL', correctionCanAlterPeriodValue: true,
        realChangeRequiresEffectiveBoundary: true, min: 0, max: 1000000,
        normalize: decimal('ACTUAL_PAY', 0, 1000000)
    },
    {
        id: 'CONTRACT_PAY', label: 'Συνολικές αποδοχές σύμβασης', fields: ['synolo_symbashs'],
        dataType: 'DECIMAL', correctionCanAlterPeriodValue: true,
        realChangeRequiresEffectiveBoundary: true, min: 0, max: 1000000,
        normalize: decimal('CONTRACT_PAY', 0, 1000000)
    }
].map(entry => Object.freeze({
    ...entry,
    fields: Object.freeze([...entry.fields]),
    correctionTemporalFieldsMayBeAffected: Object.freeze([]),
    realChangeTemporalFieldsMayBeAffected: TEMPORAL_PERIOD_FIELDS,
    temporalFieldsMayBeAffected: TEMPORAL_PERIOD_FIELDS,
    temporalFieldsMustNeverBeAffected: NEVER_IMPLICITLY_MUTATE,
    invariants: Object.freeze([
        'FIELD_ISOLATION',
        'CORRECTION_DOES_NOT_CREATE_CHANGE_EVENT',
        'REAL_CHANGE_USES_MINIMUM_PERIOD_BOUNDARY'
    ])
}));

const byId = new Map(entries.map(entry => [entry.id, entry]));
const byField = new Map(entries.flatMap(entry => entry.fields.map(field => [field, entry])));

function invalid(fieldId, reason) {
    const error = new TypeError(`${fieldId}: ${reason}`);
    error.code = 'EMPLOYEE_HISTORY_USER_CORRECTION_INVALID_VALUE';
    error.fieldId = fieldId;
    error.reason = reason;
    throw error;
}

function catalogCode(fieldId) {
    return value => {
        const result = String(value ?? '').trim();
        if (!result || result.length > 40) invalid(fieldId, 'INVALID_CATALOG_CODE');
        return result;
    };
}

function decimal(fieldId, min, max) {
    return value => {
        if (!['number', 'string'].includes(typeof value) || String(value).trim() === '') {
            invalid(fieldId, 'NUMBER_REQUIRED');
        }
        const result = Number(value);
        if (!Number.isFinite(result) || result < min || result > max) {
            invalid(fieldId, 'NUMBER_OUT_OF_RANGE');
        }
        return result;
    };
}

function integer(fieldId, min, max) {
    const normalizeDecimal = decimal(fieldId, min, max);
    return value => {
        const result = normalizeDecimal(value);
        if (!Number.isInteger(result)) invalid(fieldId, 'INTEGER_REQUIRED');
        return result;
    };
}

function registryEntry(fieldId) {
    return byId.get(String(fieldId || '')) || null;
}

function registryEntryForCanonicalField(field) {
    return byField.get(String(field || '')) || null;
}

function normalizedCatalog(catalog = []) {
    if (!Array.isArray(catalog)) return [];
    const byCode = new Map();
    for (const item of catalog) {
        const code = String(item?.code ?? item?.kodikos ?? '').trim();
        const label = String(item?.label ?? item?.perigrafh ?? '').trim();
        if (!code || !label || code.length > 40 || label.length > 250) continue;
        if (!byCode.has(code)) byCode.set(code, Object.freeze({ value: code, label: `${code} — ${label}` }));
    }
    return [...byCode.values()].sort((left, right) => left.value.localeCompare(right.value, 'el'));
}

function normalizeConfirmedFieldValue(fieldId, value, { allowedValues = [] } = {}) {
    const entry = registryEntry(fieldId);
    if (!entry) invalid(fieldId, 'UNSUPPORTED_FIELD');
    const normalized = entry.normalize(value);
    if (entry.dataType === 'CATALOG_CHOICE') {
        const allowed = new Set((allowedValues || []).map(item => String(item?.value ?? item ?? '').trim()));
        if (!allowed.size || !allowed.has(String(normalized))) invalid(fieldId, 'UNKNOWN_CATALOG_CODE');
    }
    return normalized;
}

function publicRegistryDescriptor(fieldId, catalogs = {}) {
    const entry = registryEntry(fieldId);
    if (!entry) return null;
    const result = {
        id: entry.id,
        label: entry.label,
        inputType: entry.dataType
    };
    if (entry.min !== undefined) result.min = entry.min;
    if (entry.max !== undefined) result.max = entry.max;
    if (entry.catalog) result.catalogValues = normalizedCatalog(catalogs[entry.catalog]);
    return Object.freeze(result);
}

function registryFingerprintMaterial(catalogs = {}) {
    return {
        version: REGISTRY_VERSION,
        fields: entries.map(entry => ({
            id: entry.id,
            label: entry.label,
            fields: entry.fields,
            dataType: entry.dataType,
            catalog: entry.catalog || null,
            min: entry.min ?? null,
            max: entry.max ?? null,
            correctionCanAlterPeriodValue: entry.correctionCanAlterPeriodValue,
            realChangeRequiresEffectiveBoundary: entry.realChangeRequiresEffectiveBoundary,
            correctionTemporalFieldsMayBeAffected: entry.correctionTemporalFieldsMayBeAffected,
            realChangeTemporalFieldsMayBeAffected: entry.realChangeTemporalFieldsMayBeAffected,
            temporalFieldsMayBeAffected: entry.temporalFieldsMayBeAffected,
            temporalFieldsMustNeverBeAffected: entry.temporalFieldsMustNeverBeAffected,
            invariants: entry.invariants,
            catalogValues: entry.catalog ? normalizedCatalog(catalogs[entry.catalog]) : []
        }))
    };
}

function validateWorkTermRelationships(values = {}) {
    const days = values.hmeres_ergasias_ebdomadas;
    const weekly = values.ores_ergasias_ebdomadas;
    const daily = values.mo_oron_hmerhsias_ergasias;
    if (days !== undefined && weekly !== undefined && Number(weekly) > Number(days) * 24) {
        invalid('WEEKLY_HOURS', 'HOURS_EXCEED_AVAILABLE_DAYS');
    }
    if (days !== undefined && weekly !== undefined && daily !== undefined &&
        Math.abs(Number(weekly) / Number(days) - Number(daily)) > 0.011) {
        invalid('DAILY_HOURS', 'DAILY_AVERAGE_DOES_NOT_MATCH_WEEKLY_HOURS');
    }
    if (Object.keys(values).some(field => C.FACT_FIELDS.includes(field))) {
        C.normalizeEmploymentProfileSubmission(values, values);
    }
    return true;
}

module.exports = {
    REGISTRY_VERSION,
    TEMPORAL_PERIOD_FIELDS,
    NEVER_IMPLICITLY_MUTATE,
    CORRECTION_FIELD_REGISTRY: Object.freeze(entries),
    registryEntry,
    registryEntryForCanonicalField,
    normalizedCatalog,
    normalizeConfirmedFieldValue,
    publicRegistryDescriptor,
    registryFingerprintMaterial,
    validateWorkTermRelationships
};
