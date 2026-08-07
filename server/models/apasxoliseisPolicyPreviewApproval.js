const { Schema, model } = require('mongoose');

const PolicyPreviewApprovalItemSchema = new Schema(
    {
        preview_id: { type: String, trim: true, required: true },
        prodhlomena_oraria_id: { type: Schema.Types.ObjectId, ref: 'ProdhlomenaOraria' },
        employee_id: { type: Schema.Types.ObjectId, ref: 'Ergazomenoi' },
        employee_kodikos: { type: String, trim: true },
        hmeromhnia: { type: Date, required: true },
        kathgoria_ergasias: { type: String, trim: true },
        kathgoria_ergasias_apologistika: { type: String, trim: true },
        cards_ores_ergasias: { type: Number },
        declared_hours: { type: Number },
        policy_context: { type: Schema.Types.Mixed, default: {} },
        proposed_values: { type: Schema.Types.Mixed, default: {} },
        flags: { type: Schema.Types.Mixed, default: {} }
    },
    { _id: false }
);

const ApasxoliseisPolicyPreviewApprovalSchema = new Schema(
    {
        team: { type: String, trim: true, required: true },
        company_kod: { type: String, trim: true, required: true },
        ypokatasthma: { type: String, trim: true, default: '' },
        etos: { type: String, trim: true, default: '' },
        period_kodikos: { type: String, trim: true, default: '' },
        period_id: { type: String, trim: true, default: '' },
        apo_hmeromhnia: { type: Date, required: true },
        eos_hmeromhnia: { type: Date, required: true },

        group_id: { type: String, trim: true, required: true },
        group_key: { type: String, trim: true, required: true },
        grouping_scope: { type: String, trim: true, default: 'page' },
        policy_code: { type: String, trim: true, default: '' },
        scenario_code: { type: String, trim: true, default: '' },
        status: { type: String, trim: true, default: '' },
        action_type: { type: String, trim: true, default: '' },
        reason_code: { type: String, trim: true, default: '' },

        decision_type: {
            type: String,
            required: true,
            enum: [
                'APPROVE_PROPOSAL',
                'APPROVE_PREFILL',
                'MARK_OK',
                'MARK_REVIEWED',
                'REJECT_PROPOSAL',
                'NEEDS_MORE_REVIEW'
            ]
        },
        decision_status: {
            type: String,
            required: true,
            enum: ['RECORDED', 'CANCELLED'],
            default: 'RECORDED'
        },
        reuse_scope: {
            type: String,
            required: true,
            enum: ['ONE_TIME', 'FUTURE_IDENTICAL'],
            default: 'ONE_TIME'
        },
        reuse_status: {
            type: String,
            required: true,
            enum: ['NOT_APPLICABLE', 'ACTIVE', 'REVOKED'],
            default: 'NOT_APPLICABLE'
        },
        reuse_fingerprint: { type: String, trim: true, maxlength: 64, default: '' },
        reuse_fingerprints: { type: [String], default: [] },
        active_policy_key: { type: String, trim: true, maxlength: 64, default: '' },
        active_policy_keys: { type: [String], default: [] },
        reuse_match_criteria: { type: Schema.Types.Mixed, default: null },
        reuse_effective_from: { type: Date, default: null },
        reuse_effective_to: { type: Date, default: null },
        revoked_at: { type: Date, default: null },
        revoked_by_user_id: { type: Schema.Types.ObjectId, ref: 'User', default: null },
        revoked_by_user_name: { type: String, trim: true, maxlength: 150, default: '' },
        revoke_reason: { type: String, trim: true, maxlength: 1000, default: '' },
        cancelled_at: { type: Date, default: null },
        cancel_reason_code: {
            type: String,
            trim: true,
            maxlength: 100,
            enum: ['', 'CONCURRENT_ACTIVE_POLICY_CONFLICT'],
            default: ''
        },
        cancelled_by: {
            type: String,
            trim: true,
            maxlength: 100,
            enum: ['', 'SYSTEM_POST_CREATE_GUARD'],
            default: ''
        },

        items: {
            type: [PolicyPreviewApprovalItemSchema],
            required: true,
            validate: {
                validator: (items) => Array.isArray(items) && items.length > 0 && items.length <= 500,
                message: 'Τα items πρέπει να περιέχουν από 1 έως 500 εγγραφές.'
            }
        },
        snapshot_summary: {
            items_count: { type: Number, required: true },
            employees_count: { type: Number, required: true },
            first_date: { type: Date, required: true },
            last_date: { type: Date, required: true }
        },

        created_by_user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        created_by_user_name: { type: String, trim: true, required: true },
        created_by_user_role: { type: String, trim: true, default: '' },
        created_at: { type: Date, default: Date.now, immutable: true },
        source: { type: String, trim: true, default: 'POLICY_PREVIEW_GROUP_UI' },
        notes: { type: String, trim: true, maxlength: 2000, default: '' },
        client_payload_version: { type: String, trim: true, maxlength: 50, default: '' }
    },
    {
        collection: 'Apasxoliseis_Policy_Preview_Approvals'
    }
);

ApasxoliseisPolicyPreviewApprovalSchema.index({
    team: 1,
    company_kod: 1,
    apo_hmeromhnia: 1,
    eos_hmeromhnia: 1,
    group_id: 1,
    decision_type: 1,
    decision_status: 1
});

ApasxoliseisPolicyPreviewApprovalSchema.index({
    team: 1,
    company_kod: 1,
    ypokatasthma: 1,
    reuse_scope: 1,
    reuse_status: 1,
    reuse_fingerprints: 1,
    created_at: -1
});

ApasxoliseisPolicyPreviewApprovalSchema.index({
    team: 1,
    company_kod: 1,
    created_at: -1
});

ApasxoliseisPolicyPreviewApprovalSchema.index({
    team: 1,
    company_kod: 1,
    policy_code: 1,
    decision_status: 1,
    created_at: -1
});

ApasxoliseisPolicyPreviewApprovalSchema.index({
    team: 1,
    company_kod: 1,
    ypokatasthma: 1,
    reuse_scope: 1,
    reuse_status: 1,
    reuse_fingerprint: 1,
    created_at: -1
});

const ApasxoliseisPolicyPreviewApprovalsModel = model(
    'ApasxoliseisPolicyPreviewApprovals',
    ApasxoliseisPolicyPreviewApprovalSchema
);

module.exports = ApasxoliseisPolicyPreviewApprovalsModel;
