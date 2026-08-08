'use strict';

const { Schema, model } = require('mongoose');
const immutableRequired = (type, extra = {}) => ({ type, required: true, immutable: true, ...extra });
const schema = new Schema({
    team: immutableRequired(String, { trim: true }), company_kod: immutableRequired(String, { trim: true }),
    ypokatasthma: immutableRequired(String, { trim: true }), period_start: immutableRequired(Date),
    period_end: immutableRequired(Date), event_type: immutableRequired(String, { enum: [
        'FINALIZE', 'SUBMISSION_LINK', 'CORRECTIVE_OPEN', 'CORRECTIVE_CALCULATION',
        'CORRECTIVE_CLOSE', 'CORRECTIVE_PAYROLL_POST', 'SUBMISSION_NEEDED_DETERMINATION'
    ] }), actor_user_id: immutableRequired(Schema.Types.ObjectId),
    actor_user_name: immutableRequired(String, { trim: true }),
    actor_user_role: immutableRequired(String, { trim: true, enum: ['A', 'S', 'HR'] }),
    reason: immutableRequired(String, { trim: true }), reference_id: { type: String, trim: true, immutable: true, default: '' },
    details: { type: Schema.Types.Mixed, immutable: true, default: {} }, occurred_at: immutableRequired(Date, { default: Date.now })
}, { collection: 'Apasxoliseis_Period_Lifecycle_Audits', versionKey: false, autoIndex: false, autoCreate: false });
schema.index({ team: 1, company_kod: 1, ypokatasthma: 1, period_start: 1, period_end: 1, occurred_at: -1 },
    { name: 'apasxoliseis_period_lifecycle_audit_scope' });
module.exports = model('ApasxoliseisPeriodLifecycleAudit', schema);
