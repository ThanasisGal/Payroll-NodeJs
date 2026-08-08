'use strict';

const { Schema, model } = require('mongoose');

const immutableRequired = (type, extra = {}) => ({ type, required: true, immutable: true, ...extra });
const schema = new Schema({
    team: immutableRequired(String, { trim: true }),
    company_kod: immutableRequired(String, { trim: true }),
    ypokatasthma: immutableRequired(String, { trim: true }),
    period_start: immutableRequired(Date),
    period_end: immutableRequired(Date),
    snapshot_schema_version: immutableRequired(String, { trim: true }),
    source_calculation_version: immutableRequired(String, { trim: true }),
    frozen_snapshot_fingerprint: immutableRequired(String, { trim: true, minlength: 64, maxlength: 64 }),
    frozen_snapshot: immutableRequired(Schema.Types.Mixed),
    finalized_at: immutableRequired(Date),
    finalized_by_user_id: immutableRequired(Schema.Types.ObjectId),
    finalized_by_user_name: immutableRequired(String, { trim: true }),
    finalized_by_user_role: immutableRequired(String, { trim: true, enum: ['A', 'S', 'HR'] }),
    finalize_reason: immutableRequired(String, { trim: true, maxlength: 2000 }),
    request_id: immutableRequired(String, { trim: true }),
    created_at: immutableRequired(Date, { default: Date.now })
}, {
    collection: 'Apasxoliseis_Period_Frozen_Snapshots', versionKey: false,
    autoIndex: false, autoCreate: false
});

schema.index({ team: 1, company_kod: 1, ypokatasthma: 1, period_start: 1, period_end: 1 },
    { unique: true, name: 'unique_apasxoliseis_frozen_snapshot_scope' });
schema.index({ team: 1, company_kod: 1, request_id: 1 },
    { unique: true, name: 'unique_apasxoliseis_finalize_request' });

module.exports = model('ApasxoliseisPeriodFrozenSnapshot', schema);
