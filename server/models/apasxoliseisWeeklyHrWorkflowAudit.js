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
    default: required === true ? undefined : '',
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
    stage: immutableRequired(String, { enum: ['STAGE1', 'STAGE2', 'STAGE3'] }),
    action: immutableRequired(String, {
        enum: ['STAGE1_COMPLETED', 'STAGE1_PERIOD_SLICE_COMPLETED', 'STAGE2_COMPLETED',
            'STAGE3_DAILY_RESOLVED']
    }),
    stage_version: immutableRequired(Number, { min: 1 }),
    input_fingerprint: fingerprint(true),
    previous_completion_fingerprint: fingerprint(false),
    new_completion_fingerprint: fingerprint(function stageCompletionFingerprintRequired() {
        return this.action === 'STAGE1_COMPLETED';
    }),
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
    }),
    stage2_resolution_items: {
        type: [{ _id: false, prodhlomena_oraria_id: Schema.Types.ObjectId,
            decision_date: Date, classification: {
                type: String, enum: ['REST_REPO', 'NON_WORK'] } }],
        default: undefined,
        required: function stage2ItemsRequired() {
            return this.action === 'STAGE2_COMPLETED';
        }
    },
    decision_date: {
        type: Date,
        immutable: true,
        required: function stage3DecisionDateRequired() {
            return this.action === 'STAGE3_DAILY_RESOLVED';
        }
    },
    prodhlomena_oraria_id: {
        type: Schema.Types.ObjectId,
        ref: 'ProdhlomenaOraria',
        immutable: true,
        required: function stage3RowRequired() {
            return this.action === 'STAGE3_DAILY_RESOLVED';
        }
    },
    previous_residual_status: {
        type: String,
        enum: ['PENDING'],
        immutable: true,
        required: function stage3ResidualRequired() {
            return this.action === 'STAGE3_DAILY_RESOLVED';
        }
    },
    previous_classification: {
        type: String,
        trim: true,
        enum: ['UNCLASSIFIED', 'LEAVE', 'SICKNESS', 'ABSENCE', 'NON_WORK'],
        immutable: true,
        required: function stage3PreviousClassificationRequired() {
            return this.action === 'STAGE3_DAILY_RESOLVED';
        }
    },
    final_classification: {
        type: String,
        enum: ['LEAVE', 'SICKNESS', 'ABSENCE', 'NON_WORK'],
        immutable: true,
        required: function stage3FinalClassificationRequired() {
            return this.action === 'STAGE3_DAILY_RESOLVED';
        }
    },
    period_control_version: {
        type: Number,
        min: 0,
        immutable: true,
        required: function stage3PeriodVersionRequired() {
            return this.action === 'STAGE3_DAILY_RESOLVED';
        }
    },
    period_write_fence_version: {
        type: Number,
        min: 0,
        immutable: true,
        required: function stage3FenceVersionRequired() {
            return this.action === 'STAGE3_DAILY_RESOLVED';
        }
    },
    previous_stage1_effective_fingerprint: {
        ...fingerprint(function stage3PreviousStage1FingerprintRequired() {
            return this.action === 'STAGE3_DAILY_RESOLVED';
        })
    },
    new_stage1_effective_fingerprint: {
        ...fingerprint(function stage3NewStage1FingerprintRequired() {
            return this.action === 'STAGE3_DAILY_RESOLVED';
        })
    },
    previous_stage1_version: {
        type: Number,
        min: 1,
        immutable: true,
        required: function stage3PreviousStage1VersionRequired() {
            return this.action === 'STAGE3_DAILY_RESOLVED';
        }
    },
    new_stage1_version: {
        type: Number,
        min: 2,
        immutable: true,
        required: function stage3NewStage1VersionRequired() {
            return this.action === 'STAGE3_DAILY_RESOLVED';
        }
    },
    period_start: {
        type: Date, immutable: true,
        required: function periodSliceAuditRequired() {
            return this.action === 'STAGE1_PERIOD_SLICE_COMPLETED';
        }
    },
    period_end: {
        type: Date, immutable: true,
        required: function periodSliceAuditRequired() {
            return this.action === 'STAGE1_PERIOD_SLICE_COMPLETED';
        }
    },
    actionable_dates: {
        type: [Date], immutable: true, default: undefined,
        required: function periodSliceAuditRequired() {
            return this.action === 'STAGE1_PERIOD_SLICE_COMPLETED';
        }
    },
    context_only_dates: {
        type: [Date], immutable: true, default: undefined,
        required: function periodSliceAuditRequired() {
            return this.action === 'STAGE1_PERIOD_SLICE_COMPLETED';
        }
    },
    context_fingerprint: {
        ...fingerprint(function periodSliceAuditRequired() {
            return this.action === 'STAGE1_PERIOD_SLICE_COMPLETED';
        })
    },
    slice_completion_fingerprint: {
        ...fingerprint(function periodSliceAuditRequired() {
            return this.action === 'STAGE1_PERIOD_SLICE_COMPLETED';
        })
    },
    slice_effective_fingerprint: {
        ...fingerprint(function periodSliceAuditRequired() {
            return this.action === 'STAGE1_PERIOD_SLICE_COMPLETED';
        })
    },
    previous_slice_version: {
        type: Number, min: 0, immutable: true,
        required: function periodSliceAuditRequired() {
            return this.action === 'STAGE1_PERIOD_SLICE_COMPLETED';
        }
    },
    new_slice_version: {
        type: Number, min: 1, immutable: true,
        required: function periodSliceAuditRequired() {
            return this.action === 'STAGE1_PERIOD_SLICE_COMPLETED';
        }
    }
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
