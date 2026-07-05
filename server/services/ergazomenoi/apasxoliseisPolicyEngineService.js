// Pure policy evaluator for Apasxoliseis scenario decisions.
// This module must stay free of DB, controller, route, network, and filesystem dependencies.

const {
    POLICY_RESULT_STATUS,
    POLICY_MODE,
    getApasxoliseisPolicyCatalog,
    getApasxoliseisPolicyByCode
} = require('./apasxoliseisPolicyCatalogService');

function asObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asArray(value) {
    return Array.isArray(value) ? value : [];
}

function uniqueArray(values = []) {
    return [...new Set(values.filter((value) => value !== null && value !== undefined))];
}

function getScenarioCode(scenarioDecision = {}) {
    return String(scenarioDecision?.scenario_code || '').trim();
}

function findPoliciesByScenarioCode(scenarioCode) {
    if (!scenarioCode) return [];

    return getApasxoliseisPolicyCatalog().filter((policy) =>
        asArray(policy.related_scenario_codes).includes(scenarioCode)
    );
}

function buildEmptyResult({
    success,
    policy = null,
    mode = null,
    result_status,
    reasons = [],
    warnings = [],
    blocked = false,
    blocked_reasons = [],
    audit_payload = {}
}) {
    return {
        success: success === true,
        policy_code: policy?.policy_code || null,
        policy_version: policy?.policy_version || null,
        policy_title: policy?.title || null,
        mode,
        result_status,
        confidence: null,
        batch_approvable: policy?.batch_approvable === true,
        requires_human_approval: policy?.requires_human_approval === true,
        reasons: uniqueArray(reasons),
        warnings: uniqueArray(warnings),
        proposed_updates: {},
        blocked: blocked === true,
        blocked_reasons: uniqueArray(blocked_reasons),
        audit_payload
    };
}

function selectPolicy({ policyCode, scenarioDecision }) {
    const requestedPolicyCode = String(policyCode || '').trim();

    if (requestedPolicyCode) {
        const policy = getApasxoliseisPolicyByCode(requestedPolicyCode);
        const scenarioCode = getScenarioCode(scenarioDecision);

        if (!policy) {
            return {
                policy: null,
                errorStatus: POLICY_RESULT_STATUS.UNKNOWN_PATTERN,
                blocked: true,
                blockedReasons: ['POLICY_NOT_FOUND'],
                warnings: [`POLICY_NOT_FOUND:${requestedPolicyCode}`]
            };
        }

        if (
            scenarioCode &&
            asArray(policy.related_scenario_codes).length > 0 &&
            !asArray(policy.related_scenario_codes).includes(scenarioCode)
        ) {
            return {
                policy: null,
                errorStatus: POLICY_RESULT_STATUS.CONFLICT_AMBIGUOUS,
                blocked: true,
                blockedReasons: ['POLICY_SCENARIO_MISMATCH'],
                warnings: [`POLICY_SCENARIO_MISMATCH:${requestedPolicyCode}:${scenarioCode}`]
            };
        }

        return { policy, warnings: [], blockedReasons: [] };
    }

    const scenarioCode = getScenarioCode(scenarioDecision);
    const matchedPolicies = findPoliciesByScenarioCode(scenarioCode);

    if (matchedPolicies.length === 0) {
        return {
            policy: null,
            errorStatus: POLICY_RESULT_STATUS.UNKNOWN_PATTERN,
            blocked: true,
            blockedReasons: ['POLICY_NOT_FOUND_FOR_SCENARIO'],
            warnings: scenarioCode
                ? [`POLICY_NOT_FOUND_FOR_SCENARIO:${scenarioCode}`]
                : ['MISSING_SCENARIO_CODE']
        };
    }

    if (matchedPolicies.length > 1) {
        return {
            policy: null,
            matchedPolicies,
            errorStatus: POLICY_RESULT_STATUS.CONFLICT_AMBIGUOUS,
            blocked: true,
            blockedReasons: ['MULTIPLE_POLICIES_MATCHED'],
            warnings: [`MULTIPLE_POLICIES_MATCHED:${scenarioCode}`]
        };
    }

    return { policy: matchedPolicies[0], warnings: [], blockedReasons: [] };
}

function filterAllowedProposedUpdates(policy, proposedUpdates = {}) {
    const allowedFields = new Set(asArray(policy?.proposed_update_fields));
    const allowedUpdates = {};
    const warnings = [];

    Object.entries(asObject(proposedUpdates)).forEach(([field, value]) => {
        if (allowedFields.has(field)) {
            allowedUpdates[field] = value;
            return;
        }

        warnings.push(`DISALLOWED_PROPOSED_UPDATE_FIELD:${field}`);
    });

    return {
        proposed_updates: allowedUpdates,
        warnings
    };
}

function resolveMode(policy, requestedMode) {
    const mode = String(requestedMode || '').trim() || policy.default_mode;
    const supportedModes = asArray(policy.supported_modes);

    return {
        mode,
        isSupported: supportedModes.includes(mode)
    };
}

function resolveResultStatus({ policy, scenarioDecision, mode, hasAllowedProposedUpdates }) {
    if (scenarioDecision?.requires_review === true) {
        return hasAllowedProposedUpdates && mode === POLICY_MODE.PREFILL
            ? POLICY_RESULT_STATUS.PREFILLED_PENDING_APPROVAL
            : POLICY_RESULT_STATUS.NEEDS_REVIEW;
    }

    if (policy.requires_human_approval === true) {
        return hasAllowedProposedUpdates
            ? POLICY_RESULT_STATUS.PREFILLED_PENDING_APPROVAL
            : POLICY_RESULT_STATUS.NEEDS_REVIEW;
    }

    return POLICY_RESULT_STATUS.RESOLVED_BY_POLICY;
}

function buildAuditPayload({
    policy,
    mode,
    parameters,
    context,
    scenarioDecision,
    proposedUpdateFields,
    blockedReasons
}) {
    return {
        policy_code: policy?.policy_code || null,
        policy_version: policy?.policy_version || null,
        mode,
        scenario_code: scenarioDecision?.scenario_code || null,
        scenario_version: scenarioDecision?.scenario_version || null,
        parameters: asObject(parameters),
        context: asObject(context),
        proposed_update_fields: proposedUpdateFields,
        blocked_reasons: blockedReasons
    };
}

function evaluateApasxoliseisPolicyForScenario(input = {}) {
    const safeInput = asObject(input);
    const facts = asObject(safeInput.facts);
    const scenarioDecision = asObject(safeInput.scenarioDecision);
    const scenarioCode = getScenarioCode(scenarioDecision);
    const reasons = asArray(scenarioDecision.reasons);
    const warnings = asArray(scenarioDecision.warnings);
    const blockedReasons = [];

    if (!scenarioCode) {
        return buildEmptyResult({
            success: false,
            result_status: POLICY_RESULT_STATUS.UNKNOWN_PATTERN,
            reasons,
            warnings: uniqueArray([...warnings, 'MISSING_SCENARIO_CODE']),
            blocked: true,
            blocked_reasons: ['MISSING_SCENARIO_CODE'],
            audit_payload: {
                scenario_code: null,
                parameters: asObject(safeInput.parameters),
                context: asObject(safeInput.context)
            }
        });
    }

    const selected = selectPolicy({
        policyCode: safeInput.policyCode,
        scenarioDecision
    });

    if (!selected.policy) {
        return buildEmptyResult({
            success: false,
            result_status: selected.errorStatus || POLICY_RESULT_STATUS.UNKNOWN_PATTERN,
            reasons,
            warnings: uniqueArray([...warnings, ...asArray(selected.warnings)]),
            blocked: selected.blocked === true,
            blocked_reasons: selected.blockedReasons,
            audit_payload: {
                scenario_code: scenarioCode,
                matched_policy_codes: asArray(selected.matchedPolicies).map(
                    (policy) => policy.policy_code
                ),
                parameters: asObject(safeInput.parameters),
                context: asObject(safeInput.context)
            }
        });
    }

    const policy = selected.policy;
    const resolvedMode = resolveMode(policy, safeInput.mode);
    const filteredUpdates = filterAllowedProposedUpdates(
        policy,
        scenarioDecision.proposed_updates
    );
    const proposedUpdates = filteredUpdates.proposed_updates;
    const hasAllowedProposedUpdates = Object.keys(proposedUpdates).length > 0;

    if (!resolvedMode.isSupported) {
        blockedReasons.push('UNSUPPORTED_POLICY_MODE');
    }

    if (scenarioDecision.blocked_by_lock === true || facts?.review?.is_locked === true) {
        blockedReasons.push('LOCKED_RECORD');
    }

    if (scenarioDecision.blocked_by_legal_pending === true) {
        blockedReasons.push('LEGAL_CLASSIFICATION_PENDING');
    }

    const resultStatus = !resolvedMode.isSupported
        ? POLICY_RESULT_STATUS.CONFLICT_AMBIGUOUS
        : resolveResultStatus({
              policy,
              scenarioDecision,
              mode: resolvedMode.mode,
              hasAllowedProposedUpdates
          });
    const allWarnings = uniqueArray([
        ...warnings,
        ...asArray(selected.warnings),
        ...filteredUpdates.warnings
    ]);
    const uniqueBlockedReasons = uniqueArray(blockedReasons);

    return {
        success: true,
        policy_code: policy.policy_code,
        policy_version: policy.policy_version,
        policy_title: policy.title,
        mode: resolvedMode.mode,
        result_status: resultStatus,
        confidence: scenarioDecision.confidence || null,
        batch_approvable: policy.batch_approvable === true,
        requires_human_approval: policy.requires_human_approval === true,
        reasons: uniqueArray(reasons),
        warnings: allWarnings,
        proposed_updates: proposedUpdates,
        blocked: uniqueBlockedReasons.length > 0,
        blocked_reasons: uniqueBlockedReasons,
        audit_payload: buildAuditPayload({
            policy,
            mode: resolvedMode.mode,
            parameters: safeInput.parameters,
            context: safeInput.context,
            scenarioDecision,
            proposedUpdateFields: Object.keys(proposedUpdates),
            blockedReasons: uniqueBlockedReasons
        })
    };
}

function incrementGroupedCount(target, key) {
    const normalizedKey = key || 'UNKNOWN';
    target[normalizedKey] = (target[normalizedKey] || 0) + 1;
}

function evaluateApasxoliseisPoliciesForScenarios(items = []) {
    const safeItems = Array.isArray(items) ? items : [];
    const results = safeItems.map((item) => evaluateApasxoliseisPolicyForScenario(item));
    const summary = {
        by_result_status: {},
        by_policy_code: {}
    };

    results.forEach((result) => {
        incrementGroupedCount(summary.by_result_status, result.result_status);
        incrementGroupedCount(summary.by_policy_code, result.policy_code);
    });

    return {
        success: true,
        total: results.length,
        results,
        summary
    };
}

module.exports = {
    evaluateApasxoliseisPolicyForScenario,
    evaluateApasxoliseisPoliciesForScenarios
};
