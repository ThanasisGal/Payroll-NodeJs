'use strict';

const { Schema, model } = require('mongoose');

const WORKFLOW_VERSION = 'weekly-hr-workflow:v1';
const STAGE_STATUS = Object.freeze(['OPEN', 'COMPLETED']);
const FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/;

const stageDefinition = {
    status: {
        type: String,
        enum: STAGE_STATUS,
        required: true,
        default: 'OPEN',
        validate: {
            validator: function completedStageHasAttribution(value) {
                return value !== 'COMPLETED' || (
                    FINGERPRINT_PATTERN.test(this.completion_fingerprint || '') &&
                    this.completed_at instanceof Date &&
                    this.completed_by_user_id &&
                    String(this.completed_by_user_name || '').trim() !== '' &&
                    ['A', 'S', 'HR'].includes(this.completed_by_user_role)
                );
            },
            message: 'COMPLETED stage requires fingerprint and complete actor attribution.'
        }
    },
    completion_fingerprint: {
        type: String,
        trim: true,
        default: '',
        validate: {
            validator: (value) => value === '' || FINGERPRINT_PATTERN.test(value),
            message: 'completion_fingerprint must be an empty value or a SHA-256 hex digest.'
        }
    },
    completed_at: { type: Date, default: null },
    completed_by_user_id: { type: Schema.Types.ObjectId, default: null },
    completed_by_user_name: { type: String, trim: true, maxlength: 150, default: '' },
    completed_by_user_role: {
        type: String,
        trim: true,
        enum: ['', 'A', 'S', 'HR'],
        default: ''
    },
    reason_or_notes: { type: String, trim: true, maxlength: 2000, default: '' },
    version: { type: Number, required: true, min: 1, default: 1 }
};

function stageSchema(dependencyField = '') {
    const definition = { ...stageDefinition };
    if (dependencyField) {
        definition[dependencyField] = {
            type: String,
            trim: true,
            default: '',
            validate: {
                validator: (value) => value === '' || FINGERPRINT_PATTERN.test(value),
                message: 'Stage dependency must be an empty value or a SHA-256 hex digest.'
            }
        };
    }
    return new Schema(definition, { _id: false });
}

const stage1Schema = stageSchema();
const stage2Schema = stageSchema('depends_on_stage1_fingerprint');
const stage3Schema = stageSchema('depends_on_stage2_fingerprint');
const finalStageSchema = stageSchema('depends_on_stage3_fingerprint');

const schema = new Schema({
    team: { type: String, trim: true, required: true, immutable: true },
    company_kod: { type: String, trim: true, required: true, immutable: true },
    ypokatasthma: { type: String, trim: true, required: true, immutable: true },
    employee_id: { type: Schema.Types.ObjectId, ref: 'Ergazomenoi', required: true, immutable: true },
    employee_kodikos: { type: String, trim: true, required: true, immutable: true },
    week_start: { type: Date, required: true, immutable: true },
    week_end: {
        type: Date,
        required: true,
        immutable: true,
        validate: {
            validator: function naturalMondaySundayWeek(value) {
                const start = this.week_start instanceof Date
                    ? this.week_start : new Date(this.week_start);
                const end = value instanceof Date ? value : new Date(value);
                return !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) &&
                    start.getUTCDay() === 1 && end.getUTCDay() === 0 &&
                    end.getTime() - start.getTime() === 6 * 86400000;
            },
            message: 'Workflow scope must be one natural Monday-Sunday week.'
        }
    },
    workflow_version: {
        type: String,
        enum: [WORKFLOW_VERSION],
        required: true,
        immutable: true,
        default: WORKFLOW_VERSION
    },
    stage1: {
        type: stage1Schema,
        required: true,
        default: () => ({})
    },
    stage2: { type: stage2Schema, default: undefined },
    stage3: { type: stage3Schema, default: undefined },
    final_stage: { type: finalStageSchema, default: undefined }
}, {
    collection: 'Apasxoliseis_Weekly_Hr_Workflow_States',
    versionKey: false,
    autoIndex: false,
    autoCreate: false
});

schema.index({
    team: 1,
    company_kod: 1,
    ypokatasthma: 1,
    employee_id: 1,
    week_start: 1,
    week_end: 1
}, { unique: true, name: 'unique_weekly_hr_workflow_employee_natural_week' });

module.exports = model('ApasxoliseisWeeklyHrWorkflowState', schema);
module.exports.WORKFLOW_VERSION = WORKFLOW_VERSION;
