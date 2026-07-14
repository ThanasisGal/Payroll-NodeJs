const { Schema, model } = require('mongoose');

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
        created_at: { type: Date, default: Date.now, immutable: true }
    },
    { collection: 'Apasxoliseis_Weekly_Repo_Transfer_Decisions', versionKey: false }
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

module.exports = model('ApasxoliseisWeeklyRepoTransferDecision', WeeklyRepoTransferDecisionSchema);
