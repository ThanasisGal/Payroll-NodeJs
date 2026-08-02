const POLICY_VERSION = 'employment-company-policy-rules:v2';

const POLICY_CODE = Object.freeze({
    NIGHT_PREMIUM: 'NIGHT_PREMIUM',
    SUNDAY_HOLIDAY_PREMIUM: 'SUNDAY_HOLIDAY_PREMIUM',
    SIXTH_DAY_PREMIUM: 'SIXTH_DAY_PREMIUM',
    ILLEGAL_OVERTIME_PREMIUM: 'ILLEGAL_OVERTIME_PREMIUM'
});

const COMMON_RATE_PERCENT = Object.freeze({
    [POLICY_CODE.NIGHT_PREMIUM]: 25,
    [POLICY_CODE.SUNDAY_HOLIDAY_PREMIUM]: 75,
    [POLICY_CODE.ILLEGAL_OVERTIME_PREMIUM]: 120
});

const STATUS = Object.freeze({
    COMMON_RULE_APPLIED: 'COMMON_RULE_APPLIED',
    COMPANY_RULE_APPLIED: 'COMPANY_RULE_APPLIED',
    REJECTED_LESS_FAVORABLE: 'REJECTED_LESS_FAVORABLE',
    REJECTED_UNDOCUMENTED: 'REJECTED_UNDOCUMENTED',
    REJECTED_AMBIGUOUS: 'REJECTED_AMBIGUOUS'
});

function numberOrNull(value) {
    if (value === null || value === undefined || String(value).trim() === '') return null;
    const parsed = Number(String(value).replace(',', '.').trim());
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function dateOnly(value) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    date.setUTCHours(0, 0, 0, 0);
    return date;
}

function hasDocumentation(rule = {}) {
    return Boolean(
        String(rule.version || '').trim() &&
        String(rule.justification || '').trim() &&
        String(rule.legal_basis_type || '').trim() &&
        String(rule.legal_basis_reference || '').trim() &&
        dateOnly(rule.effective_from)
    );
}

function isActiveFor(rule = {}, { companyKod, policyCode, atDate }) {
    if (String(rule.status || '').toUpperCase() !== 'ACTIVE') return false;
    if (String(rule.company_kod || '').trim() !== String(companyKod || '').trim()) return false;
    if (String(rule.policy_code || '').trim() !== policyCode) return false;
    const at = dateOnly(atDate);
    const from = dateOnly(rule.effective_from);
    const to = dateOnly(rule.effective_to);
    return Boolean(at && from && at >= from && (!to || at <= to));
}

function resolveCompanyPolicyRate({
    companyKod,
    policyCode,
    atDate,
    commonRatePercent = COMMON_RATE_PERCENT[policyCode],
    mandatoryFloorRatePercent = commonRatePercent,
    companyRules = []
} = {}) {
    const commonRate = numberOrNull(commonRatePercent);
    const mandatoryFloor = numberOrNull(mandatoryFloorRatePercent);
    if (!Object.values(POLICY_CODE).includes(policyCode) || commonRate === null || mandatoryFloor === null) {
        throw new TypeError('INVALID_POLICY_RATE_RESOLUTION_INPUT');
    }

    const baselineRate = Math.max(commonRate, mandatoryFloor);
    const candidates = (Array.isArray(companyRules) ? companyRules : []).filter((rule) =>
        isActiveFor(rule, { companyKod, policyCode, atDate })
    );

    const base = {
        policyVersion: POLICY_VERSION,
        policyCode,
        ratePercent: baselineRate,
        commonRatePercent: commonRate,
        mandatoryFloorRatePercent: mandatoryFloor,
        source: 'COMMON_OR_MANDATORY_RULE',
        appliedRuleId: null,
        rejectedRuleIds: []
    };

    if (candidates.length === 0) {
        return Object.freeze({ ...base, status: STATUS.COMMON_RULE_APPLIED });
    }
    if (candidates.length > 1) {
        return Object.freeze({
            ...base,
            status: STATUS.REJECTED_AMBIGUOUS,
            rejectedRuleIds: candidates.map((rule) => String(rule._id || rule.rule_id || '')).filter(Boolean)
        });
    }

    const rule = candidates[0];
    const ruleId = String(rule._id || rule.rule_id || '');
    if (!hasDocumentation(rule)) {
        return Object.freeze({
            ...base,
            status: STATUS.REJECTED_UNDOCUMENTED,
            rejectedRuleIds: ruleId ? [ruleId] : []
        });
    }

    const candidateRate = numberOrNull(rule.rate_percent);
    if (candidateRate === null || candidateRate < baselineRate) {
        return Object.freeze({
            ...base,
            status: STATUS.REJECTED_LESS_FAVORABLE,
            rejectedRuleIds: ruleId ? [ruleId] : []
        });
    }

    return Object.freeze({
        ...base,
        status: STATUS.COMPANY_RULE_APPLIED,
        ratePercent: candidateRate,
        source: 'DOCUMENTED_COMPANY_RULE',
        appliedRuleId: ruleId || null
    });
}

module.exports = {
    POLICY_VERSION,
    POLICY_CODE,
    COMMON_RATE_PERCENT,
    STATUS,
    hasDocumentation,
    isActiveFor,
    resolveCompanyPolicyRate
};
