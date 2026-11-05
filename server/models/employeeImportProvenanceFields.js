'use strict';
const { Schema } = require('mongoose');
const { SOURCE } = require('../utils/ergazomenoi/employeeImportProvenance');
module.exports = new Schema({
    version: { type: Number, enum: [1], required: true },
    source: { type: String, enum: [SOURCE], required: true },
    status: { type: String, enum: ['VERIFIED'], required: true },
    hireDate: { type: Date, required: true },
    trackingStartDate: { type: Date, required: true },
    // Optional legacy metadata retained only to read already confirmed declarations.
    sourceApplication: { type: String, maxlength: 300 },
    evidenceReference: { type: String, maxlength: 300 },
    verifiedBy: { type: String, required: true, maxlength: 300 },
    verifiedAt: { type: Date, required: true },
    auditId: { type: String, required: true, match: /^[a-f0-9]{24}$/ }
}, { _id: false, strict: 'throw' });
