'use strict';

const CANONICAL_EMPLOYMENT_TYPES = Object.freeze(['0', '1', '2']);
const EMPLOYMENT_TYPE_SEMANTIC_STATUSES = Object.freeze({
    ABSENT: 'ABSENT',
    RESOLVED: 'RESOLVED',
    INVALID_CANONICAL: 'INVALID_CANONICAL',
    INVALID_LEGACY_FALLBACK: 'INVALID_LEGACY_FALLBACK',
    CONFLICTING_VALID_ALIASES: 'CONFLICTING_VALID_ALIASES'
});
const LEGACY_ALIAS_STATUSES = Object.freeze({
    ABSENT: 'ABSENT',
    CONSISTENT: 'CONSISTENT',
    INVALID_IGNORED: 'INVALID_IGNORED',
    CONFLICTING_VALID: 'CONFLICTING_VALID',
    AUTHORITATIVE_FALLBACK: 'AUTHORITATIVE_FALLBACK'
});

function normalizedRaw(value) {
    return String(value ?? '')
        .trim()
        .toUpperCase()
        .replace(/\s+/g, '_');
}

function normalizeEmploymentTypeValue(value) {
    const raw = normalizedRaw(value);

    if (['0', '00', 'ΠΛΗΡΗΣ', 'PLHRHS', 'PLIRIS', 'FULL', 'FULL_TIME'].includes(raw)) {
        return '0';
    }

    if (['1', '01', 'ΜΕΡΙΚΗ', 'MERIKH', 'MERIKI', 'PART_TIME'].includes(raw)) {
        return '1';
    }

    if (
        [
            '2',
            '02',
            'ΕΚ_ΠΕΡΙΤΡΟΠΗΣ',
            'ΕΚ_ΠΕΡΙΤΡΟΠΗΣ_ΑΠΑΣΧΟΛΗΣΗ',
            'EK_PERITROPHS',
            'EK_PERITROPHIS',
            'ROTATIONAL'
        ].includes(raw)
    ) {
        return '2';
    }

    return '';
}

function resolveEmploymentTypeSemantics(record = {}) {
    const canonicalRaw = normalizedRaw(record.kathestos_apasxolhshs);
    const legacyRaw = normalizedRaw(record.typos_apasxolhshs);
    const canonicalValue = normalizeEmploymentTypeValue(canonicalRaw);
    const legacyValue = normalizeEmploymentTypeValue(legacyRaw);

    if (canonicalRaw) {
        if (!canonicalValue) {
            return Object.freeze({
                status: EMPLOYMENT_TYPE_SEMANTIC_STATUSES.INVALID_CANONICAL,
                effectiveValue: '',
                source: 'CANONICAL',
                legacyAliasStatus: legacyRaw
                    ? LEGACY_ALIAS_STATUSES.INVALID_IGNORED : LEGACY_ALIAS_STATUSES.ABSENT,
                comparisonKey: `INVALID_CANONICAL:${canonicalRaw}|LEGACY:${legacyRaw}`,
                quality: 0,
                hasEvidence: true
            });
        }

        if (legacyValue && legacyValue !== canonicalValue) {
            return Object.freeze({
                status: EMPLOYMENT_TYPE_SEMANTIC_STATUSES.CONFLICTING_VALID_ALIASES,
                effectiveValue: '',
                source: 'CONFLICT',
                legacyAliasStatus: LEGACY_ALIAS_STATUSES.CONFLICTING_VALID,
                comparisonKey: `CONFLICTING_VALID_ALIASES:${canonicalValue}:${legacyValue}`,
                quality: 0,
                hasEvidence: true
            });
        }

        const legacyAliasStatus = legacyValue === canonicalValue
            ? LEGACY_ALIAS_STATUSES.CONSISTENT
            : legacyRaw ? LEGACY_ALIAS_STATUSES.INVALID_IGNORED : LEGACY_ALIAS_STATUSES.ABSENT;
        return Object.freeze({
            status: EMPLOYMENT_TYPE_SEMANTIC_STATUSES.RESOLVED,
            effectiveValue: canonicalValue,
            source: 'CANONICAL',
            legacyAliasStatus,
            comparisonKey: `EMPLOYMENT_TYPE:${canonicalValue}`,
            quality: legacyAliasStatus === LEGACY_ALIAS_STATUSES.CONSISTENT ? 4
                : legacyAliasStatus === LEGACY_ALIAS_STATUSES.ABSENT ? 3 : 2,
            hasEvidence: true
        });
    }

    if (legacyValue) {
        return Object.freeze({
            status: EMPLOYMENT_TYPE_SEMANTIC_STATUSES.RESOLVED,
            effectiveValue: legacyValue,
            source: 'LEGACY_FALLBACK',
            legacyAliasStatus: LEGACY_ALIAS_STATUSES.AUTHORITATIVE_FALLBACK,
            comparisonKey: `EMPLOYMENT_TYPE:${legacyValue}`,
            quality: 1,
            hasEvidence: true
        });
    }

    if (legacyRaw) {
        return Object.freeze({
            status: EMPLOYMENT_TYPE_SEMANTIC_STATUSES.INVALID_LEGACY_FALLBACK,
            effectiveValue: '',
            source: 'LEGACY_FALLBACK',
            legacyAliasStatus: LEGACY_ALIAS_STATUSES.INVALID_IGNORED,
            comparisonKey: `INVALID_LEGACY_FALLBACK:${legacyRaw}`,
            quality: 0,
            hasEvidence: true
        });
    }

    return Object.freeze({
        status: EMPLOYMENT_TYPE_SEMANTIC_STATUSES.ABSENT,
        effectiveValue: '',
        source: 'NONE',
        legacyAliasStatus: LEGACY_ALIAS_STATUSES.ABSENT,
        comparisonKey: 'EMPLOYMENT_TYPE:ABSENT',
        quality: 0,
        hasEvidence: false
    });
}

function employmentTypesSemanticallyEqual(left = {}, right = {}) {
    return resolveEmploymentTypeSemantics(left).comparisonKey ===
        resolveEmploymentTypeSemantics(right).comparisonKey;
}

module.exports = {
    CANONICAL_EMPLOYMENT_TYPES,
    EMPLOYMENT_TYPE_SEMANTIC_STATUSES,
    LEGACY_ALIAS_STATUSES,
    normalizeEmploymentTypeValue,
    resolveEmploymentTypeSemantics,
    employmentTypesSemanticallyEqual
};
