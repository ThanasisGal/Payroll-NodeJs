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

const REUSABLE_DECISION_TYPES = new Set([
    'APPROVE_PREFILL', 'MARK_OK', 'MARK_REVIEWED', 'REJECT_PROPOSAL'
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

function stableObject(value) {
    const source = asObject(value);
    return Object.keys(source).sort().reduce((result, key) => {
        result[key] = source[key];
        return result;
    }, {});
}

function stableValue(value) {
    if (Array.isArray(value)) return value.map(stableValue);
    if (!value || typeof value !== 'object') return value;
    return Object.keys(value).sort().reduce((result, key) => {
        result[key] = stableValue(value[key]);
        return result;
    }, {});
}

function buildPolicySpecificConditions(policyCode, scenarioCode, facts = {}, supplied = {}) {
    const policy = normalize(policyCode, '');
    const scenario = normalize(scenarioCode, '');
    const evidenceClass = facts.has_cards === true
        ? 'VERIFIED_CARDS'
        : facts.has_zero_length_card_interval === true
            ? 'UNRESOLVED_CARD_EVIDENCE'
            : 'NO_CARDS';
    if (['SPLIT_SHIFT_MINIMUM_REST', 'INTERDAY_MINIMUM_REST'].includes(policy)) {
        return stableValue(supplied);
    }
    if (policy === 'NO_CARDS_DECLARED_WORK_LEAVE_OR_HOLIDAY') {
        const conditions = {
            declared_category: normalize(facts.declared_category, ''),
            card_evidence_class: evidenceClass
        };
        if (scenario.includes('HOLIDAY')) {
            Object.assign(conditions, {
                holiday_class: facts.is_mandatory_holiday === true
                    ? 'MANDATORY'
                    : facts.is_optional_holiday === true ? 'OPTIONAL' : 'NONE'
            });
        }
        return stableValue({ ...conditions, ...asObject(supplied) });
    }
    if (['WEEKLY_REPO_BALANCE', 'DECLARED_REPO_OR_NON_WORK_WITH_CARDS'].includes(policy)) {
        return stableValue({
            declared_category: normalize(facts.declared_category, ''),
            card_evidence_class: evidenceClass,
            ...asObject(supplied)
        });
    }
    return stableValue(supplied);
}

function buildReusablePolicyContextFromPreviewRow(row = {}) {
    const policy = asObject(row.policyResult);
    const scenario = asObject(row.scenarioDecision);
    const facts = asObject(row.scenarioFactsSummary);
    const audit = asObject(policy.audit_payload);
    return {
        policy_version: normalize(policy.policy_version || audit.policy_version, ''),
        scenario_version: normalize(scenario.scenario_version || audit.scenario_version, ''),
        decision_grain: normalize(policy.decision_grain || 'ROW_DAY'),
        rule_branch: normalize(policy.rule_branch || scenario.rule_branch, ''),
        parameters: stableValue(audit.parameters),
        thresholds: stableValue({
            ...asObject(scenario.policy_thresholds),
            ...asObject(policy.policy_thresholds)
        }),
        conditions: buildPolicySpecificConditions(
            policy.policy_code,
            scenario.scenario_code,
            facts,
            { ...asObject(scenario.policy_conditions), ...asObject(policy.policy_conditions) }
        ),
        application_gates: {
            is_locked: facts.is_locked === true,
            has_manual_override: facts.has_manual_override === true
        }
    };
}

function buildReusablePolicyCriteria(groupCriteria = {}, item = {}) {
    const context = asObject(item.policy_context);
    return stableValue({
        version: 3,
        team: normalize(groupCriteria.team, ''),
        company_kod: normalize(groupCriteria.company_kod, ''),
        ypokatasthma: normalizeBranch(groupCriteria.ypokatasthma),
        employee_kodikos: normalize(item.employee_kodikos, ''),
        policy_code: normalize(groupCriteria.policy_code),
        scenario_code: normalize(groupCriteria.scenario_code),
        action_type: normalize(groupCriteria.action_type),
        policy_version: normalize(context.policy_version, ''),
        scenario_version: normalize(context.scenario_version, ''),
        decision_grain: normalize(context.decision_grain, ''),
        rule_branch: normalize(context.rule_branch, ''),
        parameters: stableValue(context.parameters),
        thresholds: stableValue(context.thresholds),
        conditions: stableValue(context.conditions)
    });
}

function buildReusablePolicyCriteriaV4(groupCriteria = {}, item = {}) {
    const context = asObject(item.policy_context);
    return stableValue({
        version: 4,
        team: normalize(groupCriteria.team, ''),
        company_kod: normalize(groupCriteria.company_kod, ''),
        ypokatasthma: normalizeBranch(groupCriteria.ypokatasthma),
        policy_code: normalize(groupCriteria.policy_code),
        scenario_code: normalize(groupCriteria.scenario_code),
        action_type: normalize(groupCriteria.action_type),
        policy_version: normalize(context.policy_version, ''),
        scenario_version: normalize(context.scenario_version, ''),
        decision_grain: normalize(context.decision_grain, ''),
        rule_branch: normalize(context.rule_branch, ''),
        parameters: stableValue(asObject(context.parameters)),
        thresholds: stableValue(asObject(context.thresholds)),
        conditions: stableValue(asObject(context.conditions))
    });
}

function buildReusableItemMatchCriteria(groupCriteria = {}, item = {}) {
    const flags = asObject(item.flags);
    return {
        ...buildReusableMatchCriteriaFromGroup(groupCriteria, groupCriteria.ypokatasthma),
        version: 2,
        team: normalize(groupCriteria.team, ''),
        company_kod: normalize(groupCriteria.company_kod, ''),
        decision_type: normalize(groupCriteria.decision_type, ''),
        employee_kodikos: normalize(item.employee_kodikos, ''),
        declared_category: normalize(item.kathgoria_ergasias, ''),
        apologistika_category: normalize(item.kathgoria_ergasias_apologistika, ''),
        declared_hours: Number(item.declared_hours ?? 0),
        card_hours: Number(item.cards_ores_ergasias ?? 0),
        conditions: stableObject(flags),
        proposed_values: stableObject(item.proposed_values)
    };
}

function buildReusableItemMatchCriteriaFromPreviewRow(row = {}, decisionType = '') {
    const facts = asObject(row.scenarioFactsSummary);
    const policy = asObject(row.policyResult);
    return buildReusableItemMatchCriteria({
        ...buildReusableMatchCriteriaFromPreviewRow(row),
        team: row.team,
        company_kod: row.company_kod,
        decision_type: decisionType
    }, {
        employee_kodikos: row.kodikos,
        kathgoria_ergasias: facts.declared_category,
        kathgoria_ergasias_apologistika: facts.apologistika_category,
        declared_hours: facts.declared_hours,
        cards_ores_ergasias: facts.card_hours,
        proposed_values: policy.proposed_updates,
        flags: {
            has_cards: facts.has_cards === true,
            is_holiday: facts.is_holiday === true,
            is_mandatory_holiday: facts.is_mandatory_holiday === true,
            is_optional_holiday: facts.is_optional_holiday === true,
            is_locked: facts.is_locked === true,
            has_manual_override: facts.has_manual_override === true,
            blocked: policy.blocked === true,
            requires_human_approval: policy.requires_human_approval === true,
            batch_approvable: policy.batch_approvable === true
        }
    });
}

function buildReusableDecisionFingerprint(criteria = {}) {
    const normalized = Number(criteria.version) >= 2
        ? stableValue(criteria)
        : buildReusableMatchCriteriaFromGroup(criteria, criteria.ypokatasthma);
    return crypto.createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
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
    if (['UNKNOWN', 'RESOLVED_BY_POLICY'].includes(criteria.status) || criteria.policy_code === 'UNKNOWN') {
        return {
            eligible: false,
            reason_code: 'STATUS_NOT_REUSABLE',
            reason: 'Η κατάσταση δεν είναι ασφαλής για επαναχρησιμοποίηση.'
        };
    }
    return { eligible: true, reason_code: '', reason: '' };
}

function utcDateKey(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string' && value.trim() === '') return null;

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
        const fingerprints = asArray(rule.reuse_fingerprints).length
            ? rule.reuse_fingerprints
            : [rule.reuse_fingerprint];
        fingerprints.map((value) => String(value || '').trim()).filter(Boolean).forEach((fingerprint) => {
            if (!activeRulesByFingerprint.has(fingerprint)) activeRulesByFingerprint.set(fingerprint, []);
            activeRulesByFingerprint.get(fingerprint).push(rule);
        });
    });

    return asArray(rows).map((row) => {
        const criteria = buildReusableMatchCriteriaFromPreviewRow(row);
        const eligibility = getReusableDecisionEligibility({
            group: criteria,
            decisionType: 'MARK_REVIEWED',
            items: [{ proposed_values: asObject(row?.policyResult?.proposed_updates) }]
        });
        if (!eligibility.eligible) return row;

        const policyContext = buildReusablePolicyContextFromPreviewRow(row);
        const policyCriteriaBase = {
            ...criteria,
            team: row.team,
            company_kod: row.company_kod
        };
        const v4Criteria = buildReusablePolicyCriteriaV4(
            policyCriteriaBase,
            { policy_context: policyContext }
        );
        const v4Fingerprint = buildReusableDecisionFingerprint(v4Criteria);
        const effectiveV4Rules = (activeRulesByFingerprint.get(v4Fingerprint) || [])
            .filter((candidate) => isRuleEffectiveForRow(candidate, row));
        if (effectiveV4Rules.length > 1) {
            return {
                ...row,
                policyResult: {
                    ...asObject(row.policyResult),
                    reusable_conflict: true,
                    reusable_conflict_code: 'MULTIPLE_ACTIVE_REUSABLE_DECISIONS'
                }
            };
        }
        const v3Criteria = buildReusablePolicyCriteria(
            policyCriteriaBase,
            { employee_kodikos: row.kodikos, policy_context: policyContext }
        );
        const v3Fingerprint = buildReusableDecisionFingerprint(v3Criteria);
        const effectiveV3Rules = (activeRulesByFingerprint.get(v3Fingerprint) || [])
            .filter((candidate) => isRuleEffectiveForRow(candidate, row));
        if (effectiveV3Rules.length > 1) {
            return {
                ...row,
                policyResult: {
                    ...asObject(row.policyResult),
                    reusable_conflict: true,
                    reusable_conflict_code: 'MULTIPLE_ACTIVE_REUSABLE_DECISIONS'
                }
            };
        }
        const gates = asObject(policyContext.application_gates);
        const matchedPolicyRule = effectiveV4Rules[0] || effectiveV3Rules[0] || null;
        if (matchedPolicyRule && (gates.is_locked || gates.has_manual_override)) {
            return {
                ...row,
                policyResult: {
                    ...asObject(row.policyResult),
                    reusable_application_blocked: true,
                    reusable_application_gate_code: gates.is_locked
                        ? 'CURRENT_RECORD_LOCKED'
                        : 'CURRENT_MANUAL_OVERRIDE'
                }
            };
        }
        let rule = matchedPolicyRule;
        const v2Fingerprints = [...REUSABLE_DECISION_TYPES].map((decisionType) =>
            buildReusableDecisionFingerprint(
                buildReusableItemMatchCriteriaFromPreviewRow(row, decisionType)
            ));
        const legacyFingerprint = buildReusableDecisionFingerprint(criteria);
        if (!rule) rule = v2Fingerprints.flatMap((fingerprint) =>
            activeRulesByFingerprint.get(fingerprint) || []).find((candidate) =>
            isRuleEffectiveForRow(candidate, row)) || null;
        if (!rule) {
            const legacyRule = (activeRulesByFingerprint.get(legacyFingerprint) || [])[0];
            const employeeCodes = new Set(asArray(legacyRule?.items).map((item) => normalize(item.employee_kodikos, '')).filter(Boolean));
            const sameLegacyScope = legacyRule &&
                normalize(legacyRule.team, '') === normalize(row.team, '') &&
                normalize(legacyRule.company_kod, '') === normalize(row.company_kod, '') &&
                normalizeBranch(legacyRule.ypokatasthma) === normalizeBranch(row.ypokatasthma);
            if (sameLegacyScope && employeeCodes.has(normalize(row.kodikos, ''))) rule = legacyRule;
        }
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
    buildReusablePolicyContextFromPreviewRow,
    buildReusablePolicyCriteria,
    buildReusablePolicyCriteriaV4,
    buildReusableItemMatchCriteria,
    buildReusableItemMatchCriteriaFromPreviewRow,
    buildReusableDecisionFingerprint,
    getReusableDecisionEligibility,
    utcDateKey,
    isRuleEffectiveForRow,
    applyReusablePolicyDecisionsToPreviewRows
};
