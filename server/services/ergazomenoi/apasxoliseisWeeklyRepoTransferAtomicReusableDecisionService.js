// Pure v5 reusable-decision contract for one complete weekly repo-transfer pair.
// This module intentionally has no persistence, transport, preview-row, or apply dependencies.

const crypto = require('crypto');

const ATOMIC_FINGERPRINT_VERSION = 5;
const DECISION_GRAIN = 'ATOMIC_LINKED_SET';
const GROUP_TYPE = 'ATOMIC_PAIRED_PROPOSAL';
const SOURCE_ROLE = 'SOURCE_BECOMES_WORK';
const TARGET_ROLE = 'TARGET_BECOMES_REPO';
const CANONICAL_ROLES = Object.freeze([SOURCE_ROLE, TARGET_ROLE]);

const DIAGNOSTIC = Object.freeze({
    ELIGIBLE: 'ATOMIC_LINKED_SET_ELIGIBLE',
    CONTRACT_INVALID: 'ATOMIC_LINKED_SET_CONTRACT_INVALID',
    GROUP_TYPE_UNSUPPORTED: 'ATOMIC_LINKED_SET_GROUP_TYPE_UNSUPPORTED',
    MISSING_SOURCE: 'ATOMIC_LINKED_SET_SOURCE_MISSING',
    MISSING_TARGET: 'ATOMIC_LINKED_SET_TARGET_MISSING',
    DUPLICATE_SOURCE: 'ATOMIC_LINKED_SET_SOURCE_DUPLICATE',
    DUPLICATE_TARGET: 'ATOMIC_LINKED_SET_TARGET_DUPLICATE',
    UNSUPPORTED_ROLE: 'ATOMIC_LINKED_SET_ROLE_UNSUPPORTED',
    ROW_ID_INVALID: 'ATOMIC_LINKED_SET_ROW_ID_INVALID',
    ROW_ID_DUPLICATE: 'ATOMIC_LINKED_SET_ROW_ID_DUPLICATE',
    EMPLOYEE_MISMATCH: 'ATOMIC_LINKED_SET_EMPLOYEE_MISMATCH',
    TEAM_MISMATCH: 'ATOMIC_LINKED_SET_TEAM_MISMATCH',
    COMPANY_MISMATCH: 'ATOMIC_LINKED_SET_COMPANY_MISMATCH',
    BRANCH_MISMATCH: 'ATOMIC_LINKED_SET_BRANCH_MISMATCH',
    SOURCE_SCOPE_UNRESOLVED: 'ATOMIC_LINKED_SET_SOURCE_SCOPE_UNRESOLVED',
    DATE_INVALID: 'ATOMIC_LINKED_SET_DATE_INVALID',
    WEEK_MISMATCH: 'ATOMIC_LINKED_SET_WEEK_MISMATCH',
    POLICY_CONTEXT_INCOMPLETE: 'ATOMIC_LINKED_SET_POLICY_CONTEXT_INCOMPLETE',
    PROFILE_CONTEXT_INCOMPLETE: 'ATOMIC_LINKED_SET_PROFILE_CONTEXT_INCOMPLETE',
    ROW_OVERLAP: 'ATOMIC_LINKED_SET_ROW_OVERLAP',
    MEMBER_INELIGIBLE: 'ATOMIC_LINKED_SET_MEMBER_INELIGIBLE',
    NO_ACTIVE_MATCH: 'ATOMIC_REUSABLE_NO_ACTIVE_MATCH',
    EFFECTIVE_PERIOD_MISMATCH: 'ATOMIC_REUSABLE_EFFECTIVE_PERIOD_MISMATCH',
    MULTIPLE_ACTIVE_MATCHES: 'ATOMIC_REUSABLE_MULTIPLE_ACTIVE_MATCHES',
    MATCHED: 'ATOMIC_REUSABLE_MATCHED',
    DECISION_TYPE_NOT_REUSABLE: 'ATOMIC_REUSABLE_DECISION_TYPE_NOT_ALLOWED'
});

function asObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asArray(value) {
    return Array.isArray(value) ? value : [];
}

function normalize(value) {
    return String(value ?? '').trim().toUpperCase();
}

function normalizeBranch(value) {
    const branch = String(value ?? '').trim();
    return branch ? branch.padStart(4, '0') : '';
}

function stableValue(value) {
    if (Array.isArray(value)) return value.map(stableValue);
    if (!value || typeof value !== 'object') return value;
    return Object.keys(value).sort().reduce((result, key) => {
        result[key] = stableValue(value[key]);
        return result;
    }, {});
}

function dateKey(value) {
    if (value === null || value === undefined || String(value).trim() === '') return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function mondayKey(value) {
    const key = dateKey(value);
    if (!key) return null;
    const date = new Date(`${key}T00:00:00.000Z`);
    const day = date.getUTCDay();
    date.setUTCDate(date.getUTCDate() - (day === 0 ? 6 : day - 1));
    return date.toISOString().slice(0, 10);
}

function itemValue(item, group, key) {
    const value = item?.[key] ?? group?.[key];
    return key === 'ypokatasthma' ? normalizeBranch(value) : normalize(value);
}

function result(eligible, diagnostics, canonicalItems = []) {
    return {
        eligible,
        pending: !eligible,
        diagnostics: [...new Set(diagnostics)],
        canonical_items: canonicalItems
    };
}

function hasCompletePolicyContext(context) {
    const source = asObject(context.source_conditions);
    const target = asObject(context.target_conditions);
    const policyVersions = asObject(context.policy_versions);
    const effectiveParameters = asObject(context.effective_parameters);
    const thresholds = asObject(context.thresholds);
    const roleStructure = asObject(context.role_structure);
    const completeValues = (object) => Object.keys(object).length > 0 &&
        Object.values(object).every((value) => value !== null && value !== undefined && value !== '');
    return Boolean(
        normalize(context.primary_policy_code) &&
        normalize(policyVersions.primary) &&
        normalize(context.secondary_policy_code) &&
        normalize(policyVersions.secondary) &&
        normalize(source.current_category) && normalize(source.required_result_category) === 'ΕΡΓ' &&
        normalize(target.current_category) &&
        normalize(target.required_result_category) === normalize(context.target_category) &&
        completeValues(effectiveParameters) &&
        completeValues(thresholds) &&
        normalize(context.target_repo_category_rule) &&
        ['ΑΝ', 'ΜΕ'].includes(normalize(context.target_category)) &&
        normalize(context.week_boundary_semantics) &&
        CANONICAL_ROLES.every((role) => completeValues(asObject(roleStructure[role])))
    );
}

function hasCompleteProfileContext(context) {
    const profile = asObject(context.employment_profile_class);
    return Object.keys(profile).length > 0 &&
        Object.values(profile).every((value) => value !== null && value !== undefined && value !== '');
}

function validateAtomicLinkedSet(group = {}) {
    const diagnostics = [];
    const items = asArray(group.items);
    if (asArray(group.atomic_reusable_diagnostics).includes(
        DIAGNOSTIC.SOURCE_SCOPE_UNRESOLVED
    )) diagnostics.push(DIAGNOSTIC.SOURCE_SCOPE_UNRESOLVED);
    if (normalize(group.group_type) !== GROUP_TYPE) {
        diagnostics.push(DIAGNOSTIC.GROUP_TYPE_UNSUPPORTED);
    }
    if (
        normalize(group.group_type) !== GROUP_TYPE ||
        normalize(group.decision_grain) !== DECISION_GRAIN ||
        group?.pair_contract?.atomic_pair_required !== true ||
        group.count !== 2 ||
        group.decision_units_count !== 1 ||
        items.length !== 2
    ) diagnostics.push(DIAGNOSTIC.CONTRACT_INVALID);

    const byRole = new Map(CANONICAL_ROLES.map((role) => [role, []]));
    items.forEach((item) => {
        const role = normalize(item?.role);
        if (!byRole.has(role)) diagnostics.push(DIAGNOSTIC.UNSUPPORTED_ROLE);
        else byRole.get(role).push(item);
    });
    if (byRole.get(SOURCE_ROLE).length === 0) diagnostics.push(DIAGNOSTIC.MISSING_SOURCE);
    if (byRole.get(TARGET_ROLE).length === 0) diagnostics.push(DIAGNOSTIC.MISSING_TARGET);
    if (byRole.get(SOURCE_ROLE).length > 1) diagnostics.push(DIAGNOSTIC.DUPLICATE_SOURCE);
    if (byRole.get(TARGET_ROLE).length > 1) diagnostics.push(DIAGNOSTIC.DUPLICATE_TARGET);

    const canonicalItems = CANONICAL_ROLES.flatMap((role) => byRole.get(role).slice(0, 1));
    if (canonicalItems.length === 2) {
        const rowIds = canonicalItems.map((item) => String(item.prodhlomena_oraria_id ?? '').trim());
        if (rowIds.some((id) => !id)) diagnostics.push(DIAGNOSTIC.ROW_ID_INVALID);
        else if (rowIds[0] === rowIds[1]) diagnostics.push(DIAGNOSTIC.ROW_ID_DUPLICATE);

        const dimensions = [
            ['employee_kodikos', DIAGNOSTIC.EMPLOYEE_MISMATCH],
            ['team', DIAGNOSTIC.TEAM_MISMATCH],
            ['company_kod', DIAGNOSTIC.COMPANY_MISMATCH],
            ['ypokatasthma', DIAGNOSTIC.BRANCH_MISMATCH]
        ];
        dimensions.forEach(([key, code]) => {
            const values = canonicalItems.map((item) => itemValue(item, group, key));
            if (!values[0] || values[0] !== values[1]) diagnostics.push(code);
        });

        const dates = canonicalItems.map((item) => dateKey(item.hmeromhnia));
        if (dates.some((date) => !date)) diagnostics.push(DIAGNOSTIC.DATE_INVALID);
        else if (mondayKey(dates[0]) !== mondayKey(dates[1])) {
            diagnostics.push(DIAGNOSTIC.WEEK_MISMATCH);
        }
    }

    const context = asObject(group.atomic_reusable_context);
    if (!hasCompletePolicyContext(context)) {
        diagnostics.push(DIAGNOSTIC.POLICY_CONTEXT_INCOMPLETE);
    }
    if (!hasCompleteProfileContext(context)) {
        diagnostics.push(DIAGNOSTIC.PROFILE_CONTEXT_INCOMPLETE);
    }
    return result(diagnostics.length === 0, diagnostics, canonicalItems);
}

function buildAtomicReusableCriteriaV5(group = {}) {
    const validation = validateAtomicLinkedSet(group);
    if (!validation.eligible) return { validation, criteria: null, fingerprint: null };
    const context = asObject(group.atomic_reusable_context);
    const policyVersions = asObject(context.policy_versions);
    const criteria = stableValue({
        version: ATOMIC_FINGERPRINT_VERSION,
        decision_grain: DECISION_GRAIN,
        team: itemValue(validation.canonical_items[0], group, 'team'),
        company: itemValue(validation.canonical_items[0], group, 'company_kod'),
        branch: itemValue(validation.canonical_items[0], group, 'ypokatasthma'),
        group_type: normalize(group.group_type),
        scenario_code: normalize(group.scenario_code),
        action_type: normalize(group.action_type),
        choice_code: normalize(group.pair_contract.choice_code),
        proposal_version: normalize(group.pair_contract.proposal_version),
        primary_policy: {
            code: normalize(context.primary_policy_code),
            version: normalize(policyVersions.primary)
        },
        secondary_policy: {
            code: normalize(context.secondary_policy_code),
            version: normalize(policyVersions.secondary)
        },
        canonical_role_structure: CANONICAL_ROLES.map((role) => ({
            role,
            semantics: stableValue(asObject(context.role_structure)[role])
        })),
        linked_member_count: 2,
        source_policy_conditions: stableValue(context.source_conditions),
        target_policy_conditions: stableValue(context.target_conditions),
        employment_profile_class: stableValue(context.employment_profile_class),
        effective_policy_parameters: stableValue(context.effective_parameters),
        thresholds: stableValue(context.thresholds),
        target_repo_category_rule: normalize(context.target_repo_category_rule),
        target_category: normalize(context.target_category),
        week_boundary_semantics: normalize(context.week_boundary_semantics),
        additional_policy_identity: stableValue(asObject(context.additional_policy_identity))
    });
    const fingerprint = crypto.createHash('sha256')
        .update(JSON.stringify(criteria))
        .digest('hex');
    return { validation, criteria, fingerprint };
}

function validateAtomicGroupOverlaps(groups = []) {
    const entries = asArray(groups).map((group, index) => ({
        group,
        index,
        validation: validateAtomicLinkedSet(group)
    }));
    const eligibleRows = new Map();
    entries.forEach((entry) => {
        entry.validation.canonical_items.forEach((item) => {
            const rowId = String(item.prodhlomena_oraria_id);
            if (!eligibleRows.has(rowId)) eligibleRows.set(rowId, []);
            eligibleRows.get(rowId).push(entry.index);
        });
    });
    const conflicts = new Set(
        [...eligibleRows.values()].filter((indexes) => indexes.length > 1).flat()
    );
    return entries.map((entry) => ({
        group: entry.group,
        eligible: entry.validation.eligible && !conflicts.has(entry.index),
        pending: !entry.validation.eligible || conflicts.has(entry.index),
        conflict: conflicts.has(entry.index),
        diagnostics: conflicts.has(entry.index)
            ? [...entry.validation.diagnostics, DIAGNOSTIC.ROW_OVERLAP]
            : entry.validation.diagnostics,
        canonical_items: entry.validation.canonical_items
    }));
}

function validateAtomicReusableDecision({ reuseScope, decisionType } = {}) {
    const reusable = normalize(reuseScope) === 'FUTURE_IDENTICAL';
    const allowed = !reusable || normalize(decisionType) === 'APPROVE_PROPOSAL';
    return {
        valid: allowed,
        diagnostic: allowed ? null : DIAGNOSTIC.DECISION_TYPE_NOT_REUSABLE
    };
}

function isEffectiveForBothMembers(rule, canonicalItems) {
    const from = dateKey(rule.reuse_effective_from);
    const to = dateKey(rule.reuse_effective_to);
    if (!from) return false;
    return canonicalItems.every((item) => {
        const itemDate = dateKey(item.hmeromhnia);
        return itemDate && itemDate >= from && (!to || itemDate <= to);
    });
}

function isMemberEligible(item) {
    const flags = asObject(item.flags);
    return flags.is_locked !== true &&
        flags.has_manual_override !== true &&
        flags.current_eligible !== false;
}

function atomicReusableApprovalMetadata(rule = {}) {
    return {
        approval_id: String(rule._id ?? ''),
        approved_by_user_name: String(rule.created_by_user_name ?? ''),
        approved_at: rule.created_at || null,
        effective_from: rule.reuse_effective_from || null,
        effective_to: rule.reuse_effective_to || null,
        fingerprint_version: ATOMIC_FINGERPRINT_VERSION
    };
}

function matchAtomicReusableApproval({ group = {}, approvals = [], overlap = null } = {}) {
    const built = buildAtomicReusableCriteriaV5(group);
    if (!built.validation.eligible) {
        return { status: 'PENDING', resolved: false, diagnostics: built.validation.diagnostics };
    }
    if (overlap?.conflict === true) {
        return { status: 'PENDING', resolved: false, diagnostics: [DIAGNOSTIC.ROW_OVERLAP] };
    }
    if (!built.validation.canonical_items.every(isMemberEligible)) {
        return { status: 'PENDING', resolved: false, diagnostics: [DIAGNOSTIC.MEMBER_INELIGIBLE] };
    }

    const fingerprintMatches = asArray(approvals).filter((approval) =>
        normalize(approval.reuse_scope) === 'FUTURE_IDENTICAL' &&
        normalize(approval.reuse_status) === 'ACTIVE' &&
        normalize(approval.decision_status) === 'RECORDED' &&
        normalize(approval.decision_type) === 'APPROVE_PROPOSAL' &&
        (asArray(approval.reuse_fingerprints).length
            ? approval.reuse_fingerprints
            : [approval.reuse_fingerprint]
        ).some((value) => String(value ?? '').trim() === built.fingerprint)
    );
    const effectiveMatches = fingerprintMatches.filter((approval) =>
        isEffectiveForBothMembers(approval, built.validation.canonical_items)
    );
    if (effectiveMatches.length > 1) {
        return {
            status: 'CONFLICT',
            resolved: false,
            diagnostics: [DIAGNOSTIC.MULTIPLE_ACTIVE_MATCHES]
        };
    }
    if (effectiveMatches.length === 1) {
        return {
            status: 'RESOLVED_BY_REUSABLE_APPROVAL',
            resolved: true,
            diagnostics: [DIAGNOSTIC.MATCHED],
            reusable_approval: atomicReusableApprovalMetadata(effectiveMatches[0]),
            fingerprint: built.fingerprint
        };
    }
    return {
        status: 'PENDING',
        resolved: false,
        diagnostics: [fingerprintMatches.length
            ? DIAGNOSTIC.EFFECTIVE_PERIOD_MISMATCH
            : DIAGNOSTIC.NO_ACTIVE_MATCH]
    };
}

module.exports = {
    ATOMIC_FINGERPRINT_VERSION,
    DECISION_GRAIN,
    GROUP_TYPE,
    SOURCE_ROLE,
    TARGET_ROLE,
    CANONICAL_ROLES,
    DIAGNOSTIC,
    validateAtomicLinkedSet,
    buildAtomicReusableCriteriaV5,
    validateAtomicGroupOverlaps,
    validateAtomicReusableDecision,
    isEffectiveForBothMembers,
    isMemberEligible,
    atomicReusableApprovalMetadata,
    matchAtomicReusableApproval
};
