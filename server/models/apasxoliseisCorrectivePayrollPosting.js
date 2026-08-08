'use strict';

const { Schema, model } = require('mongoose');
const immutable = (type, extra = {}) => ({ type, required: true, immutable: true, ...extra });
const schema = new Schema({
    team: immutable(String, { trim: true }), company_kod: immutable(String, { trim: true }),
    ypokatasthma: immutable(String, { trim: true }), period_start: immutable(Date), period_end: immutable(Date),
    case_id: immutable(String, { trim: true }), employee_kodikos: immutable(String, { trim: true }),
    original_payroll_row_references: immutable([Schema.Types.ObjectId]),
    corrective_payroll_row_references: immutable([Schema.Types.ObjectId]),
    typos_apodoxon: immutable(String, { trim: true }), original_aa_misthodosias: immutable([String]),
    corrective_aa_misthodosias: immutable(String, { trim: true, enum: ['1','2','3','4','5','6','7','8','9'] }),
    corrective_delta_fingerprint: immutable(String, { trim: true, minlength: 64, maxlength: 64 }),
    gross_corrective_delta: immutable(Number), open_offset_balance_consumed_from: immutable(Number),
    offset_applied: immutable(Number), remaining_after_offset: immutable(Number),
    withholding_rate_percent: immutable(Number, { min: 0, max: 100 }), withholding_amount: immutable(Number),
    payable_now: immutable(Number), carry_forward_created: immutable(Number),
    posting_status: immutable(String, { enum: ['POSTED'] }), request_id: immutable(String, { trim: true }),
    command_fingerprint: immutable(String, { trim: true, minlength: 64, maxlength: 64 }),
    posted_by_user_id: immutable(Schema.Types.ObjectId), posted_by_user_name: immutable(String, { trim: true }),
    posted_by_user_role: immutable(String, { trim: true, enum: ['A', 'S', 'HR'] }), posted_at: immutable(Date)
}, { collection: 'Apasxoliseis_Corrective_Payroll_Postings', versionKey: false,
    autoIndex: false, autoCreate: false, timestamps: false });
schema.index({ team: 1, company_kod: 1, ypokatasthma: 1, period_start: 1, period_end: 1,
    case_id: 1, employee_kodikos: 1, typos_apodoxon: 1 },
{ unique: true, name: 'unique_corrective_payroll_posting_business_key' });
schema.index({ team: 1, company_kod: 1, request_id: 1 },
{ unique: true, name: 'unique_corrective_payroll_posting_request' });
module.exports = model('ApasxoliseisCorrectivePayrollPosting', schema);
