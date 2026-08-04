// Pure reusable-decision matching for employment policy preview rows.
// No DB, controller, route, network, or filesystem dependencies belong here.

const crypto = require('crypto');

const REUSE_SCOPE = Object.freeze({
    ONE_TIME: 'ONE_TIME',
    FUTURE_IDENTICAL: 'FUTURE_IDENTICAL'
});

const REUSE_STATUS = Object.freeze({
    NOT_APPLICABLE: 'NOT_APPLICABLE',
    ACTIVE: 'ACTIVE',
    REVOKED: 'REVOKED'
});

const REUSABLE_DECISION_TYPES = new Set(['MARK_OK', 'MARK_REVIEWED', 'REJECT_PROPOSAL']);
const NON_REUSABLE_POLICY_CODES = new Set([
    'SPLIT_SHIFT_MINIMUM_REST',
    'INTERDAY_MINIMUM_REST'
]);
const NON_REUSABLE_REASON_CODES = new Set([
    'CARD_VERIFICATION_PENDING',
    'UNKNOWN_PATTERN',
    'SPLIT_REST_BELOW_MINIMUM',
    'SPLIT_INTERVALS_OVERLAP',
    'INTERDAY_REST_BELOW_MINIMUM',
    'INTERDAY_INTERVALS_OVERLAP'
]);

function asArray(value) {
    return Array.isArray(value) ? value : [];
}

function asObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalize(value, fallback = 'UNKNOWN') {
    const result = String(value || '').trim().toUpperCase();
    return result || fallback;
}

function normalizeBranch(value) {
    const branch = String(value || '').trim();
    return branch ? branch.padStart(4, '0') : '';
}

function firstReason(policyResult = {}, scenarioDecision = {}) {
    const policyReasons = asArray(policyResult.reasons);
    const scenarioReasons = asArray(scenarioDecision.reasons);
    return normalize((policyReasons.length ? policyReasons : scenarioReasons)[0]);
}

function buildReusableMatchCriteriaFromGroup(group = {}, branch = '') {
    return {
        version: 1,
        ypokatasthma: normalizeBranch(branch),
        status: normalize(group.status),
        policy_code: normalize(group.policy_code),
        scenario_code: normalize(group.scenario_code),
        action_type: normalize(group.action_type),
        reason_code: normalize(group.reason_code)
    };
}

function buildReusableMatchCriteriaFromPreviewRow(row = {}, branch = '') {
    const policyResult = asObject(row.policyResult);
    const scenarioDecision = asObject(row.scenarioDecision);
    return {
        version: 1,
        ypokatasthma: normalizeBranch(branch || row.ypokatasthma),
        status: normalize(policyResult.result_status),
        policy_code: normalize(policyResult.policy_code),
        scenario_code: normalize(scenarioDecision.scenario_code),
        action_type: normalize(policyResult.mode),
        reason_code: firstReason(policyResult, scenarioDecision)
    };
}

function buildReusableDecisionFingerprint(criteria = {}) {
    const normalized = buildReusableMatchCriteriaFromGroup(criteria, criteria.ypokatasthma);
    return crypto.createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}

function containsProposedValues(items = []) {
    return asArray(items).some((item) => Object.keys(asObject(item?.proposed_values)).length > 0);
}

function getReusableDecisionEligibility({ group = {}, decisionType = '', items = group.items } = {}) {
    const criteria = buildReusableMatchCriteriaFromGroup(group, group.ypokatasthma);
    const normalizedDecisionType = normalize(decisionType, '');

    if (normalizedDecisionType && !REUSABLE_DECISION_TYPES.has(normalizedDecisionType)) {
        return {
            eligible: false,
            reason_code: 'DECISION_TYPE_NOT_REUSABLE',
            reason: 'Ο συγκεκριμένος τύπος απόφασης δεν μπορεί να γίνει μόνιμος κανόνας.'
        };
    }
    if (criteria.status !== 'NEEDS_REVIEW' && criteria.status !== 'OK') {
        return {
            eligible: false,
            reason_code: 'STATUS_NOT_REUSABLE',
            reason: 'Η κατάσταση δεν είναι ασφαλής για επαναχρησιμοποίηση.'
        };
    }
    if (NON_REUSABLE_POLICY_CODES.has(criteria.policy_code)) {
        return {
            eligible: false,
            reason_code: 'LEGAL_REST_RULE',
            reason: 'Οι παραβάσεις ελάχιστης ανάπαυσης δεν μπορούν να καλυφθούν από παλιότερη έγκριση.'
        };
    }
    if (NON_REUSABLE_REASON_CODES.has(criteria.reason_code)) {
        return {
            eligible: false,
            reason_code: 'UNVERIFIED_OR_LEGAL_FACTS',
            reason: 'Η περίπτωση απαιτεί πλήρη στοιχεία ή νέο νομικό έλεγχο.'
        };
    }
    if (containsProposedValues(items)) {
        return {
            eligible: false,
            reason_code: 'PROPOSED_DATA_CHANGE',
            reason: 'Πρόταση που μεταβάλλει δεδομένα χρειάζεται έγκριση των συγκεκριμένων τιμών.'
        };
    }

    return { eligible: true, reason_code: '', reason: '' };
}

function utcDateKey(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function isRuleEffectiveForRow(rule = {}, row = {}) {
    const rowDate = utcDateKey(row.hmeromhnia);
    const fromDate = utcDateKey(rule.reuse_effective_from);
    const toDate = utcDateKey(rule.reuse_effective_to);
    if (!rowDate || !fromDate || rowDate < fromDate) return false;
    return !toDate || rowDate <= toDate;
}

function reusableRuleMetadata(rule = {}) {
    return {
        approval_id: String(rule._id || ''),
        decision_type: String(rule.decision_type || ''),
        approved_by_user_name: String(rule.created_by_user_name || ''),
        approved_by_user_role: String(rule.created_by_user_role || ''),
        approved_at: rule.created_at || null,
        effective_from: rule.reuse_effective_from || null,
        effective_to: rule.reuse_effective_to || null,
        source_group_id: String(rule.group_id || ''),
        source_period_from: rule.apo_hmeromhnia || null,
        source_period_to: rule.eos_hmeromhnia || null,
        notes: String(rule.notes || '')
    };
}

function applyReusablePolicyDecisionsToPreviewRows({ rows = [], rules = [] } = {}) {
    const activeRulesByFingerprint = new Map();
    asArray(rules).forEach((rule) => {
        if (
            normalize(rule.reuse_scope, '') !== REUSE_SCOPE.FUTURE_IDENTICAL ||
            normalize(rule.reuse_status, '') !== REUSE_STATUS.ACTIVE ||
            normalize(rule.decision_status, '') !== 'RECORDED'
        ) {
            return;
        }
        const fingerprint = String(rule.reuse_fingerprint || '').trim();
        if (!fingerprint || activeRulesByFingerprint.has(fingerprint)) return;
        activeRulesByFingerprint.set(fingerprint, rule);
    });

    return asArray(rows).map((row) => {
        const criteria = buildReusableMatchCriteriaFromPreviewRow(row);
        const eligibility = getReusableDecisionEligibility({
            group: criteria,
            decisionType: 'MARK_REVIEWED',
            items: [{ proposed_values: asObject(row?.policyResult?.proposed_updates) }]
        });
        if (!eligibility.eligible) return row;

        const fingerprint = buildReusableDecisionFingerprint(criteria);
        const rule = activeRulesByFingerprint.get(fingerprint);
        if (!rule || !isRuleEffectiveForRow(rule, row)) return row;

        return {
            ...row,
            scenarioDecision: {
                ...asObject(row.scenarioDecision),
                requires_review: false
            },
            policyResult: {
                ...asObject(row.policyResult),
                result_status: 'RESOLVED_BY_POLICY',
                requires_human_approval: false,
                batch_approvable: false,
                reusable_decision: reusableRuleMetadata(rule)
            }
        };
    });
}

module.exports = {
    REUSE_SCOPE,
    REUSE_STATUS,
    REUSABLE_DECISION_TYPES,
    buildReusableMatchCriteriaFromGroup,
    buildReusableMatchCriteriaFromPreviewRow,
    buildReusableDecisionFingerprint,
    getReusableDecisionEligibility,
    applyReusablePolicyDecisionsToPreviewRows
};
