const assert = require('assert');
const {
    POLICY_CODE,
    STATUS,
    resolveCompanyPolicyRate
} = require('./apasxoliseisCompanyPolicyRuleService');

const documented = (rate, extra = {}) => ({
    _id: `rule-${rate}`,
    company_kod: 'COMPANY-1',
    policy_code: POLICY_CODE.NIGHT_PREMIUM,
    rate_percent: rate,
    effective_from: '2026-01-01',
    effective_to: null,
    version: 'v1',
    justification: 'Ευνοϊκότερος εταιρικός όρος',
    legal_basis_type: 'ΕΠΙΧΕΙΡΗΣΙΑΚΗ_ΣΥΜΒΑΣΗ',
    legal_basis_reference: 'ΕΣΣΕ-2026-01',
    status: 'ACTIVE',
    ...extra
});

const resolve = (rules) => resolveCompanyPolicyRate({
    companyKod: 'COMPANY-1',
    policyCode: POLICY_CODE.NIGHT_PREMIUM,
    atDate: '2026-08-02',
    commonRatePercent: 25,
    mandatoryFloorRatePercent: 25,
    companyRules: rules
});

assert.strictEqual(resolve([]).status, STATUS.COMMON_RULE_APPLIED);
assert.strictEqual(resolve([]).ratePercent, 25);
assert.strictEqual(resolve([documented(30)]).status, STATUS.COMPANY_RULE_APPLIED);
assert.strictEqual(resolve([documented(30)]).ratePercent, 30);
assert.strictEqual(resolve([documented(20)]).status, STATUS.REJECTED_LESS_FAVORABLE);
assert.strictEqual(resolve([documented(20)]).ratePercent, 25);
assert.strictEqual(resolve([documented(30, { legal_basis_reference: '' })]).status, STATUS.REJECTED_UNDOCUMENTED);
assert.strictEqual(resolve([documented(30), documented(35, { _id: 'rule-35' })]).status, STATUS.REJECTED_AMBIGUOUS);
assert.strictEqual(resolve([documented(30, { effective_to: '2026-07-31' })]).status, STATUS.COMMON_RULE_APPLIED);

console.log('company policy rule tests passed');
