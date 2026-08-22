'use strict';

const { Schema, model } = require('mongoose');

const immutableRequired = (type, extra = {}) => ({
    type,
    required: true,
    immutable: true,
    ...extra
});
const fingerprint = (required = false) => ({
    type: String,
    trim: true,
    immutable: true,
    required,
    default: required ? undefined : '',
    validate: {
        validator: (value) => value === '' || /^[a-f0-9]{64}$/.test(value),
        message: 'Fingerprint must be an empty value or a SHA-256 hex digest.'
    }
});
const stageSnapshotSchema = new Schema({
    status: immutableRequired(String, { enum: ['OPEN', 'COMPLETED'] }),
    completion_fingerprint: fingerprint(false),
    version: immutableRequired(Number, { min: 0 })
}, { _id: false });

const schema = new Schema({
    team: immutableRequired(String, { trim: true }),
    company_kod: immutableRequired(String, { trim: true }),
    ypokatasthma: immutableRequired(String, { trim: true }),
    employee_id: immutableRequired(Schema.Types.ObjectId, { ref: 'Ergazomenoi' }),
    employee_kodikos: immutableRequired(String, { trim: true }),
    week_start: immutableRequired(Date),
    week_end: immutableRequired(Date),
    workflow_version: immutableRequired(String, { enum: ['weekly-hr-workflow:v1'] }),
    stage: immutableRequired(String, { enum: ['STAGE1'] }),
    action: immutableRequired(String, { enum: ['STAGE1_COMPLETED'] }),
    stage_version: immutableRequired(Number, { min: 1 }),
    input_fingerprint: fingerprint(true),
    previous_completion_fingerprint: fingerprint(false),
    new_completion_fingerprint: fingerprint(true),
    before_stage: immutableRequired(stageSnapshotSchema),
    after_stage: immutableRequired(stageSnapshotSchema),
    performed_at: immutableRequired(Date),
    performed_by_user_id: immutableRequired(Schema.Types.ObjectId),
    performed_by_user_name: immutableRequired(String, { trim: true, maxlength: 150 }),
    performed_by_user_role: immutableRequired(String, { enum: ['A', 'S', 'HR'] }),
    reason_or_notes: immutableRequired(String, { trim: true, maxlength: 2000 }),
    request_id: immutableRequired(String, {
        trim: true,
        minlength: 8,
        maxlength: 100,
        match: /^[A-Za-z0-9][A-Za-z0-9:._-]*$/
    }),
    command_identity: immutableRequired(String, {
        trim: true,
        minlength: 64,
        maxlength: 64,
        match: /^[a-f0-9]{64}$/
    })
}, {
    collection: 'Apasxoliseis_Weekly_Hr_Workflow_Audits',
    versionKey: false,
    autoIndex: false,
    autoCreate: false
});

schema.index(
    { team: 1, company_kod: 1, request_id: 1 },
    { unique: true, name: 'unique_weekly_hr_workflow_audit_request' }
);

module.exports = model('ApasxoliseisWeeklyHrWorkflowAudit', schema);
