'use strict';
const { Schema, model } = require('mongoose');
const required = type => ({ type, required: true, immutable: true });
// One submission-only revision per frozen baseline. The deterministic _id
// provides uniqueness without relying on a newly provisioned secondary index.
const schema = new Schema({
    _id: required(String), team: required(String), company_kod: required(String),
    ypokatasthma: required(String), period_start: required(Date), period_end: required(Date),
    baseline_snapshot_id: required(Schema.Types.ObjectId), baseline_fingerprint: required(String),
    baseline_content_fingerprint: required(String), preview_fingerprint: required(String),
    request_id: required(String), correction: required(Schema.Types.Mixed),
    corrections: required([Schema.Types.Mixed]), control_report: required(Schema.Types.Mixed),
    reason: required(String), payload: required(Schema.Types.Mixed),
    contacts: required([Schema.Types.Mixed]), approval: required(Schema.Types.Mixed),
    required_before_submission: required([String]),
    submission_enabled: { type: Boolean, required: true, immutable: true, default: false,
        validate: value => value === false },
    created_at: required(Date)
}, { collection: 'WTO_Daily_Submission_Revisions', versionKey: false,
    autoIndex: false, autoCreate: false, strict: 'throw' });
schema.pre(['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne', 'findOneAndReplace',
    'deleteOne', 'deleteMany', 'findOneAndDelete'], function rejectRevisionMutation() {
    throw new Error('Submission revision records are append-only.');
});
schema.pre('save', function rejectExistingRevisionSave() {
    if (!this.isNew) throw new Error('Submission revision records are append-only.');
});
module.exports = model('WtoDailySubmissionRevision', schema);
