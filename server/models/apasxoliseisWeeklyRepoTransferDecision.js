const { Schema, model } = require('mongoose');

const PeriodProjectionSchema = new Schema(
    {
        period_start: { type: Date, immutable: true },
        period_end: { type: Date, immutable: true },
        side: { type: String, trim: true, immutable: true },
        accounting_rows: { type: [Schema.Types.Mixed], default: undefined, immutable: true },
        projection_fingerprint: { type: String, trim: true, immutable: true }
    },
    { _id: false, versionKey: false }
);

const WeeklyRepoTransferDecisionSchema = new Schema(
    {
        proposal_identity: { type: String, required: true, trim: true, immutable: true },
        proposal_id: { type: String, required: true, trim: true, immutable: true },
        canonical_group_key: { type: String, required: true, immutable: true },
        snapshot_version: { type: String, required: true, immutable: true },
        snapshot_fingerprint: { type: String, required: true, immutable: true },
        canonical_snapshot: { type: Schema.Types.Mixed, required: true, immutable: true },
        decision_code: {
            type: String,
            required: true,
            immutable: true,
            enum: ['APPROVE_PROPOSAL', 'REJECT_PROPOSAL', 'NEEDS_MORE_REVIEW']
        },
        decision_status: { type: String, enum: ['RECORDED'], default: 'RECORDED', immutable: true },
        notes: { type: String, trim: true, maxlength: 2000, default: '', immutable: true },
        request_id: { type: String, required: true, trim: true, immutable: true },
        command_identity: { type: String, required: true, trim: true, immutable: true },
        team: { type: String, required: true, trim: true, immutable: true },
        company_kod: { type: String, required: true, trim: true, immutable: true },
        ypokatasthma: { type: String, required: true, trim: true, immutable: true },
        employee_id: { type: Schema.Types.ObjectId, ref: 'Ergazomenoi', required: true, immutable: true },
        employee_kodikos: { type: String, required: true, trim: true, immutable: true },
        week_start: { type: Date, required: true, immutable: true },
        week_end: { type: Date, required: true, immutable: true },
        source_prodhlomena_oraria_id: { type: Schema.Types.ObjectId, required: true, immutable: true },
        target_prodhlomena_oraria_id: { type: Schema.Types.ObjectId, required: true, immutable: true },
        created_by_user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
        created_by_user_name: { type: String, required: true, trim: true, immutable: true },
        created_by_user_role: { type: String, trim: true, default: '', immutable: true },
        created_at: { type: Date, default: Date.now, immutable: true },
        resolution_kind: { type: String, trim: true, immutable: true },
        deferred_week_id: { type: String, trim: true, immutable: true },
        resolution_status: { type: String, trim: true, immutable: true },
        resolution_period_start: { type: Date, immutable: true },
        resolution_period_end: { type: Date, immutable: true },
        source_period_start: { type: Date, immutable: true },
        source_period_end: { type: Date, immutable: true },
        target_period_start: { type: Date, immutable: true },
        target_period_end: { type: Date, immutable: true },
        resolution_reason: { type: String, trim: true, immutable: true },
        resolution_fingerprint: { type: String, trim: true, immutable: true },
        resolved_by_user_id: { type: Schema.Types.ObjectId, ref: 'User', immutable: true },
        resolved_by_user_name: { type: String, trim: true, immutable: true },
        resolved_by_user_role: { type: String, trim: true, immutable: true },
        resolved_at: { type: Date, immutable: true },
        resolution_revision: { type: Number, min: 1, immutable: true },
        supersedes_decision_id: { type: Schema.Types.ObjectId, ref: 'ApasxoliseisWeeklyRepoTransferDecision', immutable: true },
        supersedes_resolution_fingerprint: { type: String, trim: true, immutable: true },
        correction_reason: { type: String, trim: true, maxlength: 2000, immutable: true },
        period_projections: { type: [PeriodProjectionSchema], default: undefined, immutable: true }
    },
    { collection: 'Apasxoliseis_Weekly_Repo_Transfer_Decisions', versionKey: false,
        autoIndex: false, autoCreate: false }
);

WeeklyRepoTransferDecisionSchema.index(
    { team: 1, company_kod: 1, ypokatasthma: 1, proposal_identity: 1, decision_status: 1 },
    { unique: true, name: 'unique_recorded_repo_transfer_proposal' }
);
WeeklyRepoTransferDecisionSchema.index(
    { team: 1, company_kod: 1, request_id: 1 },
    { unique: true, name: 'unique_repo_transfer_request' }
);
WeeklyRepoTransferDecisionSchema.index({ team: 1, company_kod: 1, ypokatasthma: 1, week_start: 1 });
WeeklyRepoTransferDecisionSchema.index(
    { team: 1, company_kod: 1, ypokatasthma: 1, deferred_week_id: 1, resolution_revision: 1 },
    {
        unique: true,
        name: 'unique_deferred_cross_period_resolution_revision',
        partialFilterExpression: {
            resolution_kind: 'DEFERRED_CROSS_PERIOD_REPO_RESOLUTION',
            resolution_status: 'RESOLVED'
        }
    }
);

module.exports = model('ApasxoliseisWeeklyRepoTransferDecision', WeeklyRepoTransferDecisionSchema);
