const { Schema, model } = require('mongoose');

const immutable = (type, extra = {}) => ({ type, required: true, immutable: true, ...extra });
const compensationHoursSchema = new Schema({
    declaredWorkHours: Number, actualWorkHours: Number, paidLeaveHours: Number,
    holidayCreditedHours: Number, nightHours: Number, sundayHolidayWorkHours: Number,
    sixthDayHours: Number, illegalOvertimeHours: Number
}, { _id: false, strict: 'throw' });
const compensationRatesSchema = new Schema({
    paidHourlyRate: Number, legalHourlyRate: Number
}, { _id: false, strict: 'throw' });
const compensationComponentSchema = new Schema({
    code: String, hours: Number, ratePercent: Number, rateBasis: String,
    baseHourlyRate: Number, premiumAmount: Number, policySource: String,
    policyStatus: String, appliedRuleId: String
}, { _id: false, strict: 'throw' });
const compensationAmountsSchema = new Schema({
    baseActualWorkAmount: Number, premiumTotalAmount: Number, grossWorkAmount: Number
}, { _id: false, strict: 'throw' });
const compensationBreakdownSchema = new Schema({
    policyVersion: String,
    status: String,
    reasons: [String],
    warnings: [String],
    hours: compensationHoursSchema,
    rates: compensationRatesSchema,
    components: [compensationComponentSchema],
    amounts: compensationAmountsSchema,
    accumulationRule: String
}, { _id: false, strict: 'throw' });
const authorizationMetadataSchema = new Schema({
    authority: String, rule: String, rule_version: String,
    automatic_resolution_reason: String, original_approval_id: String,
    original_approving_user: String, original_approval_timestamp: Date,
    source_id: String, target_id: String, week_start: String, week_end: String,
    atomic_pair_identity: String
}, { _id: false, strict: 'throw' });
const SNAPSHOT_FIELDS = Object.freeze(['kathgoria_ergasias_apologistika','repo_apologistika','adeia_apologistika','kathgoria_adeias_apologistika','ores_apoysias_apologistika','apo_ora_01_apologistika','eos_ora_01_apologistika','apo_ora_02_apologistika','eos_ora_02_apologistika','apo_ora_03_apologistika','eos_ora_03_apologistika','ores_ergasias_apologistika','ores_pragmatikhs_ergasias_apologistika','ores_adeias_pistomenes_apologistika','ores_argias_pistomenes_apologistika','compensation_breakdown_apologistika']);
const snapshotFieldTypes = Object.freeze({
    kathgoria_ergasias_apologistika: String, repo_apologistika: Boolean,
    adeia_apologistika: Boolean, kathgoria_adeias_apologistika: String,
    ores_apoysias_apologistika: Number, apo_ora_01_apologistika: String,
    eos_ora_01_apologistika: String, apo_ora_02_apologistika: String,
    eos_ora_02_apologistika: String, apo_ora_03_apologistika: String,
    eos_ora_03_apologistika: String, ores_ergasias_apologistika: Number,
    ores_pragmatikhs_ergasias_apologistika: Number,
    ores_adeias_pistomenes_apologistika: Number,
    ores_argias_pistomenes_apologistika: Number,
    compensation_breakdown_apologistika: compensationBreakdownSchema
});
const snapshotDefinition = () => Object.fromEntries(SNAPSHOT_FIELDS.map((field) => [field, { type: snapshotFieldTypes[field], immutable: true }]));
const beforeValuesSchema = new Schema(snapshotDefinition(), { _id: false, strict: 'throw' });
const afterValuesSchema = new Schema(snapshotDefinition(), { _id: false, strict: 'throw' });
function plainSnapshot(value) { return value && typeof value.toObject === 'function' ? value.toObject({ getters: false, virtuals: false, minimize: false }) : value; }
function exactSnapshotValues(value, nullable) {
    const source = plainSnapshot(value); if (!source || typeof source !== 'object' || Array.isArray(source)) return false;
    const keys = Object.keys(source); if (keys.length !== SNAPSHOT_FIELDS.length || keys.some((field) => !SNAPSHOT_FIELDS.includes(field)) || SNAPSHOT_FIELDS.some((field) => !Object.hasOwn(source, field))) return false;
    return SNAPSHOT_FIELDS.every((field) => { const item = source[field]; if (item === null) return nullable || field === 'compensation_breakdown_apologistika'; if (!nullable && field === 'compensation_breakdown_apologistika') return false; const expected = snapshotFieldTypes[field]; if (expected === String) return typeof item === 'string'; if (expected === Boolean) return typeof item === 'boolean'; if (expected === Number) return typeof item === 'number' && Number.isFinite(item); return item && typeof item === 'object' && !Array.isArray(item); });
}
const exactValidator = (nullable) => ({ validator: (value) => exactSnapshotValues(value, nullable), message: 'Invalid fixed repo-transfer snapshot values.' });
const beforeSnapshotSchema = new Schema({ source: { type: beforeValuesSchema, required: true, validate: exactValidator(true) }, target: { type: beforeValuesSchema, required: true, validate: exactValidator(true) }, source_locked: { type: Boolean, required: true }, target_locked: { type: Boolean, required: true } }, { _id: false, strict: 'throw' });
const afterSnapshotSchema = new Schema({ source: { type: afterValuesSchema, required: true, validate: exactValidator(false) }, target: { type: afterValuesSchema, required: true, validate: exactValidator(false) }, source_locked: { type: Boolean, required: true }, target_locked: { type: Boolean, required: true } }, { _id: false, strict: 'throw' });
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
    before_snapshot: immutable(beforeSnapshotSchema), after_snapshot: immutable(afterSnapshotSchema),
    authorization_metadata: { type: authorizationMetadataSchema, default: null, immutable: true },
    applied_at: immutable(Date), created_at: immutable(Date, { default: Date.now })
}, {
    collection: 'Apasxoliseis_Weekly_Repo_Transfer_Executions',
    versionKey: false,
    autoIndex: false,
    autoCreate: false
});

WeeklyRepoTransferExecutionSchema.index({ decision_id: 1 }, { unique: true, name: 'unique_applied_repo_transfer_decision' });
WeeklyRepoTransferExecutionSchema.index({ team: 1, company_kod: 1, request_id: 1 }, { unique: true, name: 'unique_repo_transfer_apply_request' });
WeeklyRepoTransferExecutionSchema.index({ team: 1, company_kod: 1, ypokatasthma: 1, applied_at: -1 });
WeeklyRepoTransferExecutionSchema.index({ decision_id: 1, decision_fingerprint: 1, proposal_id: 1 });

module.exports = model('ApasxoliseisWeeklyRepoTransferExecution', WeeklyRepoTransferExecutionSchema);
