const { Schema, model } = require('mongoose');
const {
    POLICY_CODE
} = require('../services/ergazomenoi/apasxoliseisCompanyPolicyRuleService');

const ApasxoliseisCompanyPolicyRuleSchema = new Schema(
    {
        team: { type: String, trim: true, required: true, index: true },
        company_kod: { type: String, trim: true, required: true, index: true },
        policy_code: {
            type: String,
            enum: Object.values(POLICY_CODE),
            required: true,
            index: true
        },
        rate_percent: { type: Number, min: 0, required: true },
        mandatory_floor_rate_percent: { type: Number, min: 0, required: true },
        effective_from: { type: Date, required: true, index: true },
        effective_to: { type: Date, default: null, index: true },
        version: { type: String, trim: true, required: true },
        justification: { type: String, trim: true, required: true },
        legal_basis_type: { type: String, trim: true, required: true },
        legal_basis_reference: { type: String, trim: true, required: true },
        status: {
            type: String,
            enum: ['DRAFT', 'ACTIVE', 'REJECTED', 'EXPIRED'],
            default: 'DRAFT',
            index: true
        },
        created_by: { type: String, trim: true, required: true },
        activated_by: { type: String, trim: true, default: '' },
        rejection_reason: { type: String, trim: true, default: '' }
    },
    {
        timestamps: true,
        collection: 'Apasxoliseis_Company_Policy_Rules'
    }
);

ApasxoliseisCompanyPolicyRuleSchema.pre('validate', function enforceSafeActivation() {
    if (this.effective_to && this.effective_from && this.effective_to < this.effective_from) {
        throw new Error('COMPANY_POLICY_INVALID_EFFECTIVE_RANGE');
    }
    if (
        this.status === 'ACTIVE' &&
        Number(this.rate_percent) < Number(this.mandatory_floor_rate_percent)
    ) {
        throw new Error('COMPANY_POLICY_LESS_FAVORABLE_THAN_MANDATORY_RULE');
    }
    if (this.status === 'ACTIVE' && !String(this.activated_by || '').trim()) {
        throw new Error('COMPANY_POLICY_ACTIVATOR_REQUIRED');
    }
});

ApasxoliseisCompanyPolicyRuleSchema.index(
    { team: 1, company_kod: 1, policy_code: 1, effective_from: 1, effective_to: 1, status: 1 },
    { name: 'company_policy_effective_lookup' }
);

module.exports = model('ApasxoliseisCompanyPolicyRule', ApasxoliseisCompanyPolicyRuleSchema);
