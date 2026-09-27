'use strict';

const { Schema, model } = require('mongoose');
const {
    AUDIT_COLLECTION_NAME,
    AUDIT_SCOPE_INDEX_NAME,
    AUDIT_SCOPE_INDEX_KEYS
} = require('../constants/employeeHistoryRepairAudit');

const schema = new Schema({
    employeeScope: {
        team: { type: String, required: true, trim: true },
        company_kod: { type: String, required: true, trim: true },
        kodikos: { type: String, required: true, trim: true },
        employee_id: { type: Schema.Types.ObjectId, required: true }
    },
    repairedAt: { type: Date, required: true, default: Date.now, immutable: true },
    currentBefore: { type: Schema.Types.Mixed, required: true, immutable: true },
    historyBefore: { type: [Schema.Types.Mixed], required: true, immutable: true },
    historyAfter: { type: [Schema.Types.Mixed], required: true, immutable: true },
    survivingHistoryIds: { type: [String], required: true, immutable: true },
    deletedLegacyHistoryIds: { type: [String], required: true, immutable: true },
    mutationSource: { type: String, required: true, trim: true, immutable: true },
    diagnostics: { type: Schema.Types.Mixed, required: true, immutable: true }
}, {
    collection: AUDIT_COLLECTION_NAME,
    versionKey: false,
    autoIndex: false,
    autoCreate: false
});

schema.index(AUDIT_SCOPE_INDEX_KEYS, { name: AUDIT_SCOPE_INDEX_NAME });

module.exports = model('EmployeeHistoryRepairAudit', schema);
