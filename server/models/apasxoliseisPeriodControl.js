'use strict';

const { Schema, model } = require('mongoose');

const schema = new Schema({
    team: { type: String, trim: true, required: true, immutable: true },
    company_kod: { type: String, trim: true, required: true, immutable: true },
    ypokatasthma: { type: String, trim: true, required: true, immutable: true },
    period_start: { type: Date, required: true, immutable: true },
    period_end: { type: Date, required: true, immutable: true },
    status: { type: String, enum: ['OPEN', 'LOCKED', 'FINALIZED'], required: true, default: 'OPEN' },
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
    successful_calculation_version: { type: Number, min: 0, default: 0 },
    last_successful_calculation_id: { type: String, trim: true, default: '' },
    last_successful_calculation_at: { type: Date, default: null },
    historical_reconstruction_status: {
        type: String,
        enum: ['', 'AUTHORIZED', 'COMPLETED'],
        default: ''
    },
    historical_reconstruction_version: { type: Number, min: 0, default: 0 },
    historical_reconstruction_pending_version: { type: Number, min: 0, default: 0 },
    historical_reconstruction_pending_started_at: { type: Date, default: null },
    historical_reconstruction_pending_by_user_id: { type: Schema.Types.ObjectId, default: null },
    historical_reconstruction_pending_by_user_name: { type: String, trim: true, default: '' },
    historical_reconstruction_pending_by_user_role: {
        type: String, trim: true, enum: ['', 'A', 'S', 'HR'], default: ''
    },
    historical_reconstruction_pending_reason: { type: String, trim: true, maxlength: 2000, default: '' },
    historical_reconstruction_started_at: { type: Date, default: null },
    historical_reconstruction_started_by_user_id: { type: Schema.Types.ObjectId, default: null },
    historical_reconstruction_started_by_user_name: { type: String, trim: true, default: '' },
    historical_reconstruction_started_by_user_role: {
        type: String, trim: true, enum: ['', 'A', 'S', 'HR'], default: ''
    },
    historical_reconstruction_completed_at: { type: Date, default: null },
    historical_reconstruction_reason: { type: String, trim: true, maxlength: 2000, default: '' },
    historical_source_fingerprint: { type: String, trim: true, default: '' },
    historical_dependency_fingerprint: { type: String, trim: true, default: '' },
    historical_holiday_dependency_fingerprint: { type: String, trim: true, default: '' },
    historical_dependency_window_start: { type: Date, default: null },
    historical_dependency_window_end: { type: Date, default: null },
    historical_result_fingerprint: { type: String, trim: true, default: '' },
    last_historical_reconstruction_request_id: { type: String, trim: true, default: '' },
    last_historical_reconstruction_command_identity: { type: String, trim: true, default: '' },
    frozen_snapshot_id: { type: Schema.Types.ObjectId, ref: 'ApasxoliseisPeriodFrozenSnapshot', default: null },
    frozen_snapshot_fingerprint: { type: String, trim: true, default: '' },
    finalized_at: { type: Date, default: null },
    finalized_by_user_id: { type: Schema.Types.ObjectId, default: null },
    finalized_by_user_name: { type: String, trim: true, default: '' },
    finalized_by_user_role: { type: String, trim: true, enum: ['', 'A', 'S', 'HR'], default: '' },
    finalize_reason: { type: String, trim: true, maxlength: 2000, default: '' },
    submitted_at: { type: Date, default: null },
    submission_reference: { type: Schema.Types.ObjectId, ref: 'ErgazomenoiErganh', default: null },
    submission_protocol: { type: String, trim: true, default: '' },
    submission_status: { type: String, trim: true, default: '' },
    submission_timeliness: { type: String, enum: ['', 'NOT_SUBMITTED', 'TIMELY', 'LATE'], default: 'NOT_SUBMITTED' },
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

schema.pre('validate', function requireFrozenSnapshotForFinalized() {
    if (this.status === 'FINALIZED' && (!this.frozen_snapshot_id || !this.frozen_snapshot_fingerprint)) {
        this.invalidate('status', 'FINALIZED requires a persisted frozen snapshot.');
    }
});

schema.pre('validate', function validateHistoricalReconstruction() {
    if (this.historical_reconstruction_status === 'COMPLETED' && (
        !this.historical_reconstruction_version ||
        !this.historical_source_fingerprint ||
        !this.historical_dependency_fingerprint ||
        !this.historical_result_fingerprint
    )) {
        this.invalidate('historical_reconstruction_status', 'Completed historical reconstruction requires fingerprints and a version.');
    }
    if (this.historical_reconstruction_status === 'AUTHORIZED' &&
        this.historical_reconstruction_pending_version !== this.historical_reconstruction_version + 1) {
        this.invalidate('historical_reconstruction_pending_version', 'Authorized reconstruction requires the next completed version.');
    }
});

module.exports = model('ApasxoliseisPeriodControl', schema);
