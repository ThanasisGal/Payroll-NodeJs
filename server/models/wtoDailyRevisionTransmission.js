'use strict';
const { Schema, model } = require('mongoose');
const schema = new Schema({
    _id: { type: String, required: true, immutable: true },
    team: { type: String, required: true, immutable: true },
    company_kod: { type: String, required: true, immutable: true },
    ypokatasthma: { type: String, required: true, immutable: true },
    period_start: { type: Date, required: true, immutable: true },
    period_end: { type: Date, required: true, immutable: true },
    revision_id: { type: String, required: true, immutable: true },
    payload_fingerprint: { type: String, required: true, immutable: true },
    request_id: { type: String, required: true, immutable: true },
    approval: { type: Schema.Types.Mixed, required: true, immutable: true },
    status: { type: String, required: true, enum: ['SENDING', 'SUCCESS', 'REJECTED', 'UNKNOWN'] },
    result: Schema.Types.Mixed, erganh_log_id: Schema.Types.ObjectId,
    created_at: { type: Date, required: true, immutable: true }, completed_at: Date
}, { collection: 'WTO_Daily_Revision_Transmissions', versionKey: false,
    autoCreate: false, autoIndex: false, strict: 'throw' });
module.exports = model('WtoDailyRevisionTransmission', schema);
