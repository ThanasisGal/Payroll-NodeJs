'use strict';

const crypto = require('node:crypto');
const { CANONICAL_STATUSES } = require('./employeeHistoryCanonicalizationService');

const RESOLUTION_ANALYSIS_VERSION = 'employee-history-resolution-analysis:v1';
const RESOLUTION_CLASSES = Object.freeze({
    UNIQUE_SAFE_PLAN: 'UNIQUE_SAFE_PLAN',
    MULTIPLE_SAFE_BUSINESS_PLANS: 'MULTIPLE_SAFE_BUSINESS_PLANS',
    BUSINESS_FACT_REQUIRED: 'BUSINESS_FACT_REQUIRED',
    ADMIN_REVIEW_REQUIRED: 'ADMIN_REVIEW_REQUIRED',
    FALSE_POSITIVE_OR_ALREADY_RESOLVABLE: 'FALSE_POSITIVE_OR_ALREADY_RESOLVABLE'
});
const REFERENCE_CLASSES = Object.freeze({
    NO_REFERENCES: 'NO_REFERENCES',
    PROVENANCE_ONLY: 'PROVENANCE_ONLY',
    LIVE_REFERENCE: 'LIVE_REFERENCE',
    UNKNOWN_REFERENCE: 'UNKNOWN_REFERENCE'
});

function stableValue(value) {
    if (Array.isArray(value)) return value.map(stableValue);
    if (!value || typeof value !== 'object') return value;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? String(value) : value.toISOString();
    if (typeof value.toHexString === 'function') return value.toHexString();
    return Object.fromEntries(Object.keys(value).sort()
        .map(key => [key, stableValue(value[key])]));
}

function containsPhysicalRowIdentity(value) {
    if (Array.isArray(value)) return value.some(containsPhysicalRowIdentity);
    if (!value || typeof value !== 'object') return false;
    return Object.entries(value).some(([key, nested]) =>
        /(?:^_id$|historyIds?$|rowIds?$)/i.test(key) ||
        containsPhysicalRowIdentity(nested));
}

function buildFingerprint(payload) {
    return crypto.createHash('sha256')
        .update(JSON.stringify(stableValue(payload)))
        .digest('hex');
}

function buildEmployeeHistoryResolutionAnalysis({ resolutionClass, reason,
    candidateBusinessPlans = [], missingBusinessFacts = [],
    referenceClass = REFERENCE_CLASSES.UNKNOWN_REFERENCE,
    hypotheticalCanonicalResult = null, sourceStateFingerprint = null } = {}) {
    if (!Object.values(RESOLUTION_CLASSES).includes(resolutionClass)) {
        throw new TypeError('Unknown employee-history resolution class');
    }
    if (!String(reason || '').trim()) throw new TypeError('Resolution reason is required');
    if (!Object.values(REFERENCE_CLASSES).includes(referenceClass)) {
        throw new TypeError('Unknown employee-history reference class');
    }
    if (!Array.isArray(candidateBusinessPlans) || !Array.isArray(missingBusinessFacts)) {
        throw new TypeError('Resolution plans and missing facts must be arrays');
    }
    if (containsPhysicalRowIdentity(candidateBusinessPlans)) {
        throw new TypeError('Business resolution options cannot expose physical history-row identities');
    }

    const payload = {
        version: RESOLUTION_ANALYSIS_VERSION,
        resolutionClass,
        reason: String(reason).trim(),
        candidateBusinessPlans: stableValue(candidateBusinessPlans),
        missingBusinessFacts: stableValue(missingBusinessFacts),
        referenceClass,
        sourceStateFingerprint: sourceStateFingerprint == null
            ? null : String(sourceStateFingerprint),
        hypotheticalCanonicalResult: hypotheticalCanonicalResult
            ? stableValue(hypotheticalCanonicalResult) : null
    };
    return Object.freeze({ ...payload, fingerprint: buildFingerprint(payload) });
}

function canonicalSourceStateFingerprint(canonicalResult = {}) {
    return buildFingerprint({
        status: canonicalResult.status || null,
        canonicalRows: canonicalResult.canonicalRows || [],
        rowsToUpdate: canonicalResult.rowsToUpdate || [],
        rowsToDelete: canonicalResult.rowsToDelete || [],
        rowsToInsert: canonicalResult.rowsToInsert || [],
        employeePatch: canonicalResult.employeePatch || {},
        diagnostics: canonicalResult.diagnostics || {}
    });
}

function analyzeCanonicalLegacyAliasResolution({ canonicalResult,
    referenceClass = REFERENCE_CLASSES.UNKNOWN_REFERENCE } = {}) {
    const collapsedGroups = canonicalResult?.diagnostics?.collapsedGroups || [];
    const exclusivelyLegacyAliasNormalization = collapsedGroups.length > 0 &&
        collapsedGroups.every(group =>
            group.normalizationReason === 'INVALID_LEGACY_EMPLOYMENT_TYPE_ALIAS');
    const deterministicRemovalOnly = canonicalResult?.status === CANONICAL_STATUSES.AUTO_REPAIRABLE &&
        canonicalResult.rowsToDelete?.length > 0 &&
        canonicalResult.rowsToUpdate?.length === 0 &&
        canonicalResult.rowsToInsert?.length === 0 &&
        Object.keys(canonicalResult.employeePatch || {}).length === 0;

    if (referenceClass !== REFERENCE_CLASSES.NO_REFERENCES ||
        !exclusivelyLegacyAliasNormalization || !deterministicRemovalOnly) return null;

    return buildEmployeeHistoryResolutionAnalysis({
        resolutionClass: RESOLUTION_CLASSES.FALSE_POSITIVE_OR_ALREADY_RESOLVABLE,
        reason: 'INVALID_LEGACY_EMPLOYMENT_TYPE_ALIAS_NORMALIZED',
        candidateBusinessPlans: [{
            id: 'PRESERVE_CANONICAL_EMPLOYMENT_PROFILE',
            businessMeaning: 'PRESERVE_AUTHORITATIVE_PROFILE_AND_REMOVE_REDUNDANT_ARTIFACT',
            mutationKind: 'REDUNDANT_ARTIFACT_REMOVAL'
        }],
        missingBusinessFacts: [],
        referenceClass,
        sourceStateFingerprint: canonicalSourceStateFingerprint(canonicalResult),
        hypotheticalCanonicalResult: {
            status: CANONICAL_STATUSES.CLEAN,
            reason: 'CANONICAL_CLEAN',
            blocksOrdinaryMaintenance: false
        }
    });
}

module.exports = {
    RESOLUTION_ANALYSIS_VERSION,
    RESOLUTION_CLASSES,
    REFERENCE_CLASSES,
    canonicalSourceStateFingerprint,
    buildEmployeeHistoryResolutionAnalysis,
    analyzeCanonicalLegacyAliasResolution
};
