const assert = require('assert');
const ApasxoliseisCompanyPolicyRuleModel = require('./apasxoliseisCompanyPolicyRule');

function activeRule(ratePercent, mandatoryFloorRatePercent) {
    return new ApasxoliseisCompanyPolicyRuleModel({
        team: 'TEAM',
        company_kod: 'COMPANY',
        policy_code: 'NIGHT_PREMIUM',
        rate_percent: ratePercent,
        mandatory_floor_rate_percent: mandatoryFloorRatePercent,
        effective_from: new Date('2026-01-01T00:00:00.000Z'),
        version: 'v1',
        justification: 'Τεκμηριωμένος κανόνας',
        legal_basis_type: 'ΣΣΕ',
        legal_basis_reference: 'ΣΣΕ-2026',
        status: 'ACTIVE',
        created_by: 'admin',
        activated_by: 'admin'
    });
}

(async () => {
    await activeRule(30, 25).validate();
    await assert.rejects(
        activeRule(20, 25).validate(),
        /LESS_FAVORABLE/
    );
    const missingActivator = activeRule(30, 25);
    missingActivator.activated_by = '';
    await assert.rejects(missingActivator.validate(), /ACTIVATOR_REQUIRED/);
    console.log('company policy rule model tests passed');
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
