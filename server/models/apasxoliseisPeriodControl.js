'use strict';

const { Schema, model } = require('mongoose');

const schema = new Schema({
    team: { type: String, trim: true, required: true, immutable: true },
    company_kod: { type: String, trim: true, required: true, immutable: true },
    ypokatasthma: { type: String, trim: true, required: true, immutable: true },
    period_start: { type: Date, required: true, immutable: true },
    period_end: { type: Date, required: true, immutable: true },
    status: { type: String, enum: ['OPEN', 'LOCKED'], required: true, default: 'OPEN' },
    deadline: { type: Date, required: true, immutable: true },
    locked_at: { type: Date, default: null },
    locked_by_user_id: { type: Schema.Types.ObjectId, default: null },
    locked_by_user_name: { type: String, trim: true, default: '' },
    locked_by_user_role: { type: String, trim: true, enum: ['', 'A', 'S', 'HR'], default: '' },
    lock_reason: { type: String, trim: true, maxlength: 2000, default: '' },
    last_transition_at: { type: Date, default: null },
    last_transition_request_id: { type: String, trim: true, default: '' },
    last_transition_command_identity: { type: String, trim: true, default: '' },
    active_calculation_id: { type: String, trim: true, default: '' },
    active_calculation_started_at: { type: Date, default: null },
    write_fence_version: { type: Number, required: true, min: 0, default: 0 },
    version: { type: Number, required: true, min: 1, default: 1 },
    created_at: { type: Date, required: true, default: Date.now },
    updated_at: { type: Date, required: true, default: Date.now }
}, {
    collection: 'Apasxoliseis_Period_Controls',
    versionKey: false,
    autoIndex: false,
    autoCreate: false
});

schema.index({
    team: 1, company_kod: 1, ypokatasthma: 1, period_start: 1, period_end: 1
}, { unique: true, name: 'unique_apasxoliseis_period_control_scope' });

module.exports = model('ApasxoliseisPeriodControl', schema);
