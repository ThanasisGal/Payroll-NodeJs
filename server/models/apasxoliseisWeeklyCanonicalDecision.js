'use strict';

const { Schema, model } = require('mongoose');

const immutableRequired = (type, extra = {}) => ({ type, required: true, immutable: true, ...extra });

const WeeklyCanonicalDecisionSchema = new Schema({
    team: immutableRequired(String, { trim: true }),
    company_kod: immutableRequired(String, { trim: true }),
    ypokatasthma: immutableRequired(String, { trim: true }),
    employee_kodikos: immutableRequired(String, { trim: true }),
    employee_id: { type: Schema.Types.ObjectId, default: null, immutable: true },
    week_start: immutableRequired(Date),
    week_end: immutableRequired(Date),
    scope_key: immutableRequired(String, { trim: true }),

    snapshot_version: immutableRequired(String, { trim: true }),
    snapshot_fingerprint: immutableRequired(String, { trim: true, minlength: 64, maxlength: 64 }),
    canonical_snapshot: immutableRequired(Schema.Types.Mixed),
    canonical_status: immutableRequired(String, { enum: ['NEEDS_HR_DECISION'] }),
    canonical_reasons: immutableRequired([String]),

    decision_type: immutableRequired(String, {
        enum: [
            'PROFILE_CHANGED_INSIDE_WEEK',
            'CARD_VERIFICATION_PENDING',
            'CANONICAL_REPO_IDENTITIES_NOT_DETERMINISTIC',
            'CLASSIFICATION_BY_DATE'
        ]
    }),
    decision_payload: immutableRequired(Schema.Types.Mixed),
    decision_payload_fingerprint: immutableRequired(String, {
        trim: true,
        minlength: 64,
        maxlength: 64
    }),
    decision_status: immutableRequired(String, { enum: ['RECORDED'], default: 'RECORDED' }),
    request_id: immutableRequired(String, { trim: true }),
    command_identity: immutableRequired(String, { trim: true, minlength: 64, maxlength: 64 }),

    decision_schema_version: immutableRequired(String, { trim: true }),
    policy_version: { type: String, trim: true, default: '', immutable: true },
    source_version: { type: String, trim: true, default: '', immutable: true },
    source: { type: String, trim: true, default: 'WEEKLY_CANONICAL_HUMAN_DECISION', immutable: true },
    notes: { type: String, trim: true, maxlength: 2000, default: '', immutable: true },

    created_by_user_id: immutableRequired(Schema.Types.ObjectId),
    created_by_user_name: immutableRequired(String, { trim: true }),
    created_by_user_role: immutableRequired(String, { trim: true, enum: ['A', 'S', 'HR'] }),
    created_at: immutableRequired(Date, { default: Date.now })
}, {
    collection: 'Apasxoliseis_Weekly_Canonical_Decisions',
    versionKey: false,
    autoIndex: false,
    autoCreate: false
});

WeeklyCanonicalDecisionSchema.index(
    { team: 1, company_kod: 1, request_id: 1 },
    { unique: true, name: 'unique_weekly_canonical_decision_request' }
);
WeeklyCanonicalDecisionSchema.index(
    {
        team: 1,
        company_kod: 1,
        ypokatasthma: 1,
        employee_kodikos: 1,
        week_start: 1,
        week_end: 1,
        snapshot_fingerprint: 1
    },
    {
        unique: true,
        name: 'unique_active_weekly_canonical_decision_snapshot_slot',
        partialFilterExpression: { decision_status: 'RECORDED' }
    }
);
WeeklyCanonicalDecisionSchema.index({
    team: 1,
    company_kod: 1,
    ypokatasthma: 1,
    employee_kodikos: 1,
    week_start: 1,
    week_end: 1,
    snapshot_fingerprint: 1,
    decision_status: 1,
    created_at: -1
});
WeeklyCanonicalDecisionSchema.index({
    team: 1,
    company_kod: 1,
    ypokatasthma: 1,
    employee_kodikos: 1,
    week_start: 1,
    created_at: -1
});

module.exports = model('ApasxoliseisWeeklyCanonicalDecision', WeeklyCanonicalDecisionSchema);
