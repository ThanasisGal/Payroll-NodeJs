'use strict';

const mongoose = require('mongoose');
const { IstorikoProslhpseonAllagonModel } = require('../../models/ergazomenoi');
const { SUPPORTED_COLLECTIONS, extractEmployeeHistoryReferences } =
    require('./employeeHistoryReferenceDefinitionsService');

const HISTORY_REFERENCE_FENCE_FIELD = 'history_reference_fence';

function employeeHistoryReferenceTargets(collectionName, documents = []) {
    return extractEmployeeHistoryReferences(collectionName, documents).map(target => ({
        ...target,
        historyId: new mongoose.Types.ObjectId(target.historyId)
    }));
}

async function fenceEmployeeHistoryReferences({ collectionName, documents, session,
    historyModel = IstorikoProslhpseonAllagonModel } = {}) {
    const targets = employeeHistoryReferenceTargets(collectionName, documents);
    if (!targets.length) return { fenced: 0 };
    if (!session) {
        const error = new Error('EMPLOYEE_HISTORY_REFERENCE_TRANSACTION_REQUIRED');
        error.code = 'EMPLOYEE_HISTORY_REFERENCE_TRANSACTION_REQUIRED';
        error.statusCode = 503;
        throw error;
    }
    for (const target of targets) {
        const result = await historyModel.updateOne({ team: target.team,
            company_kod: target.company_kod, kodikos: target.kodikos,
            _id: target.historyId }, {
            $inc: { [HISTORY_REFERENCE_FENCE_FIELD]: 1 }
        }, { session });
        if (result.matchedCount !== 1) {
            const error = new Error('EMPLOYEE_HISTORY_REFERENCE_TARGET_MISSING');
            error.code = 'EMPLOYEE_HISTORY_REFERENCE_TARGET_MISSING';
            error.statusCode = 409;
            throw error;
        }
    }
    return { fenced: targets.length };
}

// Shared existing settlement claim: retain write intent while restoring exact
// metadata. No historical field or timestamp is changed by this operation.
async function claimUnchangedHistoryReferences({ historyRows, scope, historyModel, session }) {
    if (!session || (typeof session.inTransaction === 'function' && !session.inTransaction())) throw Object.assign(Error('TRANSACTION_REQUIRED'), { code: 'TRANSACTION_REQUIRED' });
    for (const row of historyRows) {
        const identity = { ...scope, _id: row._id }, options = { session, timestamps: false };
        if ((await historyModel.updateOne(identity, { $inc: { history_reference_fence: 1 } }, options)).matchedCount !== 1)
            throw Object.assign(Error('HISTORY_STALE'), { code: 'HISTORY_STALE' });
        const restore = Object.hasOwn(row, 'history_reference_fence')
            ? { $set: { history_reference_fence: row.history_reference_fence } }
            : { $unset: { history_reference_fence: 1 } };
        if ((await historyModel.updateOne(identity, restore, options)).matchedCount !== 1)
            throw Object.assign(Error('HISTORY_STALE'), { code: 'HISTORY_STALE' });
    }
}
module.exports = { claimUnchangedHistoryReferences, HISTORY_REFERENCE_FENCE_FIELD, SUPPORTED_COLLECTIONS,
    employeeHistoryReferenceTargets, fenceEmployeeHistoryReferences };
