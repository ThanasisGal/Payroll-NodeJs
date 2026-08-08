'use strict';

const { Schema, model } = require('mongoose');
const immutableRequired = (type, extra = {}) => ({ type, required: true, immutable: true, ...extra });
const schema = new Schema({
    team: immutableRequired(String, { trim: true }), company_kod: immutableRequired(String, { trim: true }),
    ypokatasthma: immutableRequired(String, { trim: true }), period_start: immutableRequired(Date),
    period_end: immutableRequired(Date), case_id: immutableRequired(String, { trim: true }),
    reason: immutableRequired(String, { trim: true, maxlength: 2000 }),
    opened_at: immutableRequired(Date), opened_by_user_id: immutableRequired(Schema.Types.ObjectId),
    opened_by_user_name: immutableRequired(String, { trim: true }),
    opened_by_user_role: immutableRequired(String, { trim: true, enum: ['A', 'S', 'HR'] }),
    status: { type: String, required: true, enum: ['ACTIVE', 'CLOSED'], default: 'ACTIVE' },
    baseline_fingerprint: immutableRequired(String, { trim: true, minlength: 64, maxlength: 64 }),
    baseline_snapshot_reference: immutableRequired(Schema.Types.ObjectId),
    corrected_context: { type: Schema.Types.Mixed, default: null },
    corrected_result: { type: Schema.Types.Mixed, default: null },
    corrective_delta: { type: Schema.Types.Mixed, default: null },
    corrective_delta_fingerprint: { type: String, trim: true, default: '' },
    corrected_result_fingerprint: { type: String, trim: true, default: '' },
    result_version: { type: Number, required: true, min: 0, default: 0 },
    last_calculation_request_id: { type: String, trim: true, default: '' },
    last_calculation_command_fingerprint: { type: String, trim: true, default: '' },
    requires_new_submission: { type: Boolean, default: false },
    can_submit_correction: { type: Boolean, default: false },
    calculated_at: { type: Date, default: null }, closed_at: { type: Date, default: null },
    closed_by_user_id: { type: Schema.Types.ObjectId, default: null },
    created_at: immutableRequired(Date, { default: Date.now }), updated_at: { type: Date, required: true, default: Date.now }
}, { collection: 'Apasxoliseis_Period_Corrective_Cases', versionKey: false, autoIndex: false, autoCreate: false });

schema.index({ team: 1, company_kod: 1, ypokatasthma: 1, period_start: 1, period_end: 1, status: 1 },
    { unique: true, partialFilterExpression: { status: 'ACTIVE' }, name: 'unique_active_apasxoliseis_corrective_case' });
schema.index({ team: 1, company_kod: 1, case_id: 1 }, { unique: true, name: 'unique_apasxoliseis_corrective_case_id' });

module.exports = model('ApasxoliseisPeriodCorrectiveCase', schema);
