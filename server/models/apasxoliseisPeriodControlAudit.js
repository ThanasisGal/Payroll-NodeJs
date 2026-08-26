'use strict';

const { Schema, model } = require('mongoose');

const schema = new Schema({
    team: { type: String, trim: true, required: true, immutable: true },
    company_kod: { type: String, trim: true, required: true, immutable: true },
    ypokatasthma: { type: String, trim: true, required: true, immutable: true },
    period_start: { type: Date, required: true, immutable: true },
    period_end: { type: Date, required: true, immutable: true },
    previous_status: { type: String, enum: ['OPEN', 'LOCKED'], required: true, immutable: true },
    new_status: { type: String, enum: ['OPEN', 'LOCKED'], required: true, immutable: true },
    effective_mode_before: { type: String, enum: ['NORMAL', 'LOCKED', 'CORRECTIVE_ONLY',
        'HISTORICAL_RECONSTRUCTION_REQUIRED', 'HISTORICAL_RECONSTRUCTED',
        'HISTORICAL_RECONSTRUCTION_STALE'], required: true, immutable: true },
    effective_mode_after: { type: String, enum: ['NORMAL', 'LOCKED', 'CORRECTIVE_ONLY',
        'HISTORICAL_RECONSTRUCTION_REQUIRED', 'HISTORICAL_RECONSTRUCTED',
        'HISTORICAL_RECONSTRUCTION_STALE'], required: true, immutable: true },
    actor_user_id: { type: Schema.Types.ObjectId, required: true, immutable: true },
    actor_user_name: { type: String, trim: true, required: true, immutable: true },
    actor_user_role: { type: String, enum: ['A', 'S', 'HR'], required: true, immutable: true },
    reason: { type: String, trim: true, required: true, maxlength: 2000, immutable: true },
    request_id: { type: String, trim: true, required: true, immutable: true },
    command_identity: { type: String, trim: true, required: true, immutable: true },
    transitioned_at: { type: Date, required: true, immutable: true },
    version_before: { type: Number, required: true, immutable: true },
    version_after: { type: Number, required: true, immutable: true }
}, {
    collection: 'Apasxoliseis_Period_Control_Audits',
    versionKey: false,
    autoIndex: false,
    autoCreate: false
});

schema.index({
    team: 1, company_kod: 1, ypokatasthma: 1, period_start: 1, period_end: 1,
    transitioned_at: -1
}, { name: 'apasxoliseis_period_control_audit_history' });

module.exports = model('ApasxoliseisPeriodControlAudit', schema);
