'use strict';

const { getOrarioTermsForDate } = require('../../utils/ergazomenoi/getOrarioTermsForDate');
const {
    APPLICABILITY,
    buildCanonicalWeeklyDecisionSnapshot,
    selectedProfileFingerprint,
    resolvePreloadedWeeklyCanonicalDecision
} = require('./apasxoliseisWeeklyCanonicalDecisionService');
const { analyzeWeeklySixthSeventhDay } = require('./apasxoliseisWeeklySixthSeventhDayPolicyService');
const {
    findApplicableWeeklyReusableDecision
} = require('./apasxoliseisReusablePolicyDecisionService');

function blocked(automaticAnalysis, reason, extra = {}) {
    return Object.freeze({ ...automaticAnalysis, ...extra, status: 'NEEDS_HR_DECISION',
        reasons: [...new Set([...(automaticAnalysis?.reasons || []), reason])],
        sixthDay: null, seventhDay: null });
}

function historyId(row) { return String(row?._id ?? row?.istorikoId ?? row?.id ?? '').trim(); }

function resolveSelectedProfile({ payload = {}, employee = {}, profileHistory = [] } = {}) {
    if (payload.profile_outcome !== 'USE_PROFILE' || !payload.selected_profile_reference ||
        !payload.selected_profile_fingerprint) return { ok: false, reason: 'CANONICAL_DECISION_OUTCOME_NOT_CONSUMABLE' };
    const reference = payload.selected_profile_reference;
    let selected;
    if (reference.kind === 'HISTORY') {
        const history = profileHistory.find((row) => historyId(row) === String(reference.id));
        if (!history) return { ok: false, reason: 'CANONICAL_DECISION_PROFILE_REFERENCE_INVALID' };
        const effectiveDate = history.hmeromhnia_isxyos_oron_ergasias_apo ||
            history.hmeromhnia_allaghs_orarioy_apo || history.hmeromhnia_allaghs_symbashs;
        selected = getOrarioTermsForDate(effectiveDate, [history], employee);
    } else if (reference.kind === 'CURRENT_EMPLOYEE' &&
        [historyId(employee), String(employee.kodikos || '')].includes(String(reference.id))) {
        selected = getOrarioTermsForDate(new Date(0), [], employee);
    } else return { ok: false, reason: 'CANONICAL_DECISION_PROFILE_REFERENCE_INVALID' };
    const profile = { ...selected, profile_changed_inside_week: false };
    if (selectedProfileFingerprint(profile) !== payload.selected_profile_fingerprint) {
        return { ok: false, reason: 'CANONICAL_DECISION_PROFILE_REFERENCE_INVALID' };
    }
    return { ok: true, profile };
}

function appliedTransferConflicts(payload = {}, snapshotInput = {}) {
    const applied = snapshotInput.applied_atomic_repo_transfer;
    if (!applied) return false;
    if (applied.has_conflict === true) return true;
    const expected = String(applied.execution_id || '');
    return Boolean(expected && String(payload.applied_execution_id || '') !== expected);
}

function resolveWeeklyCanonicalDecisionAnalysis({
    automaticAnalysis,
    snapshotInput,
    decisionRecords = [],
    weekRows = [],
    effectiveProfile = {},
    employee = {},
    profileHistory = []
} = {}) {
    if (automaticAnalysis?.status !== 'NEEDS_HR_DECISION') {
        return { analysis: automaticAnalysis, applicability: APPLICABILITY.NOT_FOUND, decision: null };
    }
    const oneTimeResolved = resolvePreloadedWeeklyCanonicalDecision({ currentInput: snapshotInput,
        records: decisionRecords });
    let resolved = oneTimeResolved;
    if (oneTimeResolved.applicability !== APPLICABILITY.APPLICABLE &&
        oneTimeResolved.applicability !== APPLICABILITY.CONFLICT) {
        const snapshotResult = buildCanonicalWeeklyDecisionSnapshot(snapshotInput);
        const reusableResolved = findApplicableWeeklyReusableDecision({ snapshotResult,
            rules: decisionRecords });
        if (reusableResolved.applicability !== APPLICABILITY.NOT_FOUND) resolved = {
            ...reusableResolved, current_fingerprint: snapshotResult.fingerprint
        };
    }
    if (resolved.applicability === APPLICABILITY.STALE) return {
        analysis: blocked(automaticAnalysis, 'CANONICAL_DECISION_STALE'), ...resolved, decision: resolved.record
    };
    if (resolved.applicability === APPLICABILITY.CONFLICT) return {
        analysis: blocked(automaticAnalysis, 'CANONICAL_DECISION_CONFLICT'), ...resolved, decision: null
    };
    if (resolved.applicability !== APPLICABILITY.APPLICABLE) return {
        analysis: automaticAnalysis, ...resolved, decision: null
    };
    const record = resolved.record;
    const payload = record.decision_payload || {};
    if (record.decision_type === 'CARD_VERIFICATION_PENDING') return {
        analysis: automaticAnalysis, ...resolved, decision: record, documentaryOnly: true
    };
    let profile = effectiveProfile;
    const analyzerOptions = {};
    if (record.decision_type === 'PROFILE_CHANGED_INSIDE_WEEK') {
        const selected = resolveSelectedProfile({ payload, employee, profileHistory });
        if (!selected.ok) return { analysis: blocked(automaticAnalysis, selected.reason),
            ...resolved, decision: record };
        profile = selected.profile;
    } else if (record.decision_type === 'CANONICAL_REPO_IDENTITIES_NOT_DETERMINISTIC') {
        if (appliedTransferConflicts(payload, snapshotInput)) return {
            analysis: blocked(automaticAnalysis, 'CANONICAL_DECISION_APPLIED_TRANSFER_CONFLICT'),
            ...resolved, decision: record
        };
        analyzerOptions.canonicalRepoDayIdentitiesOverride = payload.current_repo_identities;
    } else if (record.decision_type === 'CLASSIFICATION_BY_DATE') {
        if (snapshotInput.applied_atomic_repo_transfer?.has_conflict === true) return {
            analysis: blocked(automaticAnalysis, 'CANONICAL_DECISION_APPLIED_TRANSFER_CONFLICT'),
            ...resolved, decision: record
        };
        const classifications = payload.classification_by_date || {};
        if (!Array.isArray(automaticAnalysis.canonicalRepoDayIdentities) ||
            automaticAnalysis.canonicalRepoDayIdentities.length !== 2) {
            return { analysis: blocked(automaticAnalysis,
                'CANONICAL_DECISION_CLASSIFICATION_INVALID'), ...resolved, decision: record };
        }
        analyzerOptions.classificationByDateOverride = payload.classification_by_date;
    } else return { analysis: blocked(automaticAnalysis, 'CANONICAL_DECISION_OUTCOME_NOT_CONSUMABLE'),
        ...resolved, decision: record };
    const analysis = analyzeWeeklySixthSeventhDay({ weekRows, effectiveProfile: profile,
        hourlyRate: profile.pragmatikoOromisthio, ...analyzerOptions });
    return { analysis, ...resolved, decision: record, effectiveProfile: profile };
}

module.exports = {
    blocked,
    resolveSelectedProfile,
    appliedTransferConflicts,
    resolveWeeklyCanonicalDecisionAnalysis
};
