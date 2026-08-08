'use strict';

const { Schema, model } = require('mongoose');
const schema = new Schema({
    team: { type: String, required: true, trim: true }, company_kod: { type: String, required: true, trim: true },
    ypokatasthma: { type: String, required: true, trim: true }, employee_kodikos: { type: String, required: true, trim: true },
    typos_apodoxon: { type: String, required: true, trim: true }, open_balance: { type: Number, required: true, min: 0, default: 0 },
    version: { type: Number, required: true, min: 0, default: 0 }, updated_at: { type: Date, required: true, default: Date.now }
}, { collection: 'Apasxoliseis_Corrective_Payroll_Balances', versionKey: false,
    autoIndex: false, autoCreate: false });
schema.index({ team: 1, company_kod: 1, ypokatasthma: 1, employee_kodikos: 1, typos_apodoxon: 1 },
    { unique: true, name: 'unique_corrective_payroll_balance_scope' });
module.exports = model('ApasxoliseisCorrectivePayrollBalance', schema);
