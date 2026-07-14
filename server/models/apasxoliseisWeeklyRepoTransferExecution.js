const { Schema, model } = require('mongoose');

const immutable = (type, extra = {}) => ({ type, required: true, immutable: true, ...extra });
const fixedValuesDefinition = {
    kathgoria_ergasias_apologistika: immutable(String), repo_apologistika: immutable(Boolean),
    adeia_apologistika: immutable(Boolean), kathgoria_adeias_apologistika: immutable(String),
    ores_apoysias_apologistika: immutable(Number), apo_ora_01_apologistika: immutable(String),
    eos_ora_01_apologistika: immutable(String), apo_ora_02_apologistika: immutable(String),
    eos_ora_02_apologistika: immutable(String), apo_ora_03_apologistika: immutable(String),
    eos_ora_03_apologistika: immutable(String), ores_ergasias_apologistika: immutable(Number)
};
const fixedValuesSchema = new Schema(fixedValuesDefinition, { _id: false, strict: 'throw' });
const snapshotSchema = new Schema({ source: { type: fixedValuesSchema, required: true }, target: { type: fixedValuesSchema, required: true }, source_locked: { type: Boolean, required: true }, target_locked: { type: Boolean, required: true } }, { _id: false, strict: 'throw' });
const WeeklyRepoTransferExecutionSchema = new Schema({
    decision_id: immutable(Schema.Types.ObjectId), decision_fingerprint: immutable(String, { trim: true }),
    proposal_id: immutable(String, { trim: true }), source_prodhlomena_oraria_id: immutable(Schema.Types.ObjectId),
    target_prodhlomena_oraria_id: immutable(Schema.Types.ObjectId), team: immutable(String, { trim: true }),
    company_kod: immutable(String, { trim: true }), ypokatasthma: immutable(String, { trim: true }),
    employee_id: immutable(Schema.Types.ObjectId), employee_kodikos: immutable(String, { trim: true }),
    week_start: immutable(Date), week_end: immutable(Date), request_id: immutable(String, { trim: true }),
    command_identity: immutable(String, { trim: true }), created_by_user_id: immutable(Schema.Types.ObjectId),
    created_by_user_name: immutable(String, { trim: true }), created_by_user_role: immutable(String, { trim: true }),
    execution_status: immutable(String, { enum: ['APPLIED'] }),
    before_snapshot: immutable(snapshotSchema), after_snapshot: immutable(snapshotSchema),
    applied_at: immutable(Date), created_at: immutable(Date, { default: Date.now })
}, { collection: 'Apasxoliseis_Weekly_Repo_Transfer_Executions', versionKey: false });

WeeklyRepoTransferExecutionSchema.index({ decision_id: 1 }, { unique: true, name: 'unique_applied_repo_transfer_decision' });
WeeklyRepoTransferExecutionSchema.index({ team: 1, company_kod: 1, request_id: 1 }, { unique: true, name: 'unique_repo_transfer_apply_request' });
WeeklyRepoTransferExecutionSchema.index({ team: 1, company_kod: 1, ypokatasthma: 1, applied_at: -1 });
WeeklyRepoTransferExecutionSchema.index({ decision_id: 1, decision_fingerprint: 1, proposal_id: 1 });

module.exports = model('ApasxoliseisWeeklyRepoTransferExecution', WeeklyRepoTransferExecutionSchema);
