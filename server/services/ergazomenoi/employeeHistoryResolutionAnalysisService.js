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
const UNIQUE_SAFE_REPAIR_CONTRACT_VERSION = 1;
const UNIQUE_SAFE_REPAIR_KIND = 'UNIQUE_SAFE_REPAIR';
const UNIQUE_SAFE_REPAIR_ACTION = 'APPLY_UNIQUE_SAFE_PLAN';
const UNIQUE_SAFE_REPAIR_TITLE = 'Βρέθηκε ασυνέπεια στο ιστορικό';
const UNIQUE_SAFE_REPAIR_EXPLANATION =
    'Η ασυνέπεια μπορεί να τακτοποιηθεί με ασφάλεια χωρίς να αλλάξει η πραγματική εργασιακή σχέση.';

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
    hypotheticalCanonicalResult = null, sourceStateFingerprint = null,
    resolutionKind = null, title = null, explanation = null, action = null } = {}) {
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
        ...(resolutionKind ? { resolutionKind: String(resolutionKind) } : {}),
        ...(title ? { title: String(title) } : {}),
        ...(explanation ? { explanation: String(explanation) } : {}),
        ...(action ? { action: String(action) } : {}),
        sourceStateFingerprint: sourceStateFingerprint == null
            ? null : String(sourceStateFingerprint),
        hypotheticalCanonicalResult: hypotheticalCanonicalResult
            ? stableValue(hypotheticalCanonicalResult) : null
    };
    return Object.freeze({ ...payload, fingerprint: buildFingerprint(payload) });
}

function buildUniqueSafeRepairStateFingerprint({ scope, currentEmployee,
    completeHistoryRows = [], protectedReferenceSummary = {}, repairPlan,
    normalizedSaveRequest = {} } = {}) {
    if (repairPlan?.status !== 'APPLICABLE' || repairPlan?.operation !==
        'EMPLOYEE_HISTORY_UNIQUE_SAFE_REPAIR') {
        throw new TypeError('Applicable unique-safe repair plan required');
    }
    return buildFingerprint({
        contract: 'employee-history-unique-safe-repair-confirmation:v1',
        scope,
        employee: currentEmployee,
        completeHistory: completeHistoryRows,
        referenceState: protectedReferenceSummary,
        exactRepairPlan: repairPlan,
        normalizedSaveRequest
    });
}

function buildUniqueSafeRepairResolutionAnalysis({ repairPlan,
    sourceStateFingerprint } = {}) {
    if (repairPlan?.status !== 'APPLICABLE' || !sourceStateFingerprint) return null;
    if (![REFERENCE_CLASSES.NO_REFERENCES, REFERENCE_CLASSES.PROVENANCE_ONLY]
        .includes(repairPlan.referenceClass) || repairPlan.physicalDeleteIds?.length ||
        repairPlan.insertedRows?.length ||
        repairPlan.hypotheticalCanonicalResult?.status !== CANONICAL_STATUSES.CLEAN) return null;
    return buildEmployeeHistoryResolutionAnalysis({
        resolutionClass: RESOLUTION_CLASSES.UNIQUE_SAFE_PLAN,
        resolutionKind: 'SAFE_HISTORY_REPAIR',
        reason: repairPlan.reason,
        title: UNIQUE_SAFE_REPAIR_TITLE,
        explanation: UNIQUE_SAFE_REPAIR_EXPLANATION,
        action: UNIQUE_SAFE_REPAIR_ACTION,
        candidateBusinessPlans: [{
            id: UNIQUE_SAFE_REPAIR_ACTION,
            businessMeaning: 'PRESERVE_REAL_EMPLOYMENT_RELATIONSHIP',
            mutationKind: 'SAFE_HISTORY_REPAIR'
        }],
        missingBusinessFacts: [],
        referenceClass: repairPlan.referenceClass,
        sourceStateFingerprint,
        hypotheticalCanonicalResult: {
            status: CANONICAL_STATUSES.CLEAN,
            reason: 'CANONICAL_CLEAN',
            blocksOrdinaryMaintenance: false
        }
    });
}

function buildUniqueSafeRepairPublicResolution({ analysis, fingerprint } = {}) {
    if (analysis?.resolutionClass !== RESOLUTION_CLASSES.UNIQUE_SAFE_PLAN ||
        analysis?.action !== UNIQUE_SAFE_REPAIR_ACTION ||
        !/^[a-f0-9]{64}$/.test(String(fingerprint || ''))) {
        throw new TypeError('Valid unique-safe resolution analysis and fingerprint required');
    }
    return Object.freeze({
        version: UNIQUE_SAFE_REPAIR_CONTRACT_VERSION,
        kind: UNIQUE_SAFE_REPAIR_KIND,
        title: UNIQUE_SAFE_REPAIR_TITLE,
        explanation: UNIQUE_SAFE_REPAIR_EXPLANATION,
        options: Object.freeze([Object.freeze({
            id: UNIQUE_SAFE_REPAIR_ACTION,
            label: 'Τακτοποίηση ιστορικού',
            description: 'Η εφαρμογή θα διορθώσει μόνο τις αποδεδειγμένα ασυνεπείς ιστορικές εγγραφές.'
        })]),
        fingerprint: String(fingerprint)
    });
}

function resolutionRequestError(code = 'EMPLOYEE_HISTORY_RESOLUTION_INVALID_REQUEST') {
    const error = new Error(code);
    error.code = code;
    error.statusCode = 400;
    return error;
}

function normalizeUniqueSafeRepairConfirmation(value) {
    if (value == null) return null;
    if (!value || typeof value !== 'object' || Array.isArray(value) ||
        Object.getPrototypeOf(value) !== Object.prototype) throw resolutionRequestError();
    const keys = Object.keys(value).sort();
    if (keys.length !== 2 || keys[0] !== 'choiceId' || keys[1] !== 'fingerprint' ||
        value.choiceId !== UNIQUE_SAFE_REPAIR_ACTION ||
        !/^[a-f0-9]{64}$/.test(String(value.fingerprint || ''))) {
        throw resolutionRequestError();
    }
    return Object.freeze({ choiceId: UNIQUE_SAFE_REPAIR_ACTION,
        fingerprint: String(value.fingerprint) });
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
    UNIQUE_SAFE_REPAIR_CONTRACT_VERSION,
    UNIQUE_SAFE_REPAIR_KIND,
    UNIQUE_SAFE_REPAIR_ACTION,
    UNIQUE_SAFE_REPAIR_TITLE,
    UNIQUE_SAFE_REPAIR_EXPLANATION,
    canonicalSourceStateFingerprint,
    buildEmployeeHistoryResolutionAnalysis,
    analyzeCanonicalLegacyAliasResolution,
    buildUniqueSafeRepairStateFingerprint,
    buildUniqueSafeRepairResolutionAnalysis,
    buildUniqueSafeRepairPublicResolution,
    normalizeUniqueSafeRepairConfirmation
};
