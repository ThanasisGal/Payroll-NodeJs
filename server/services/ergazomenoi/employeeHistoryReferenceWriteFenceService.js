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

module.exports = { HISTORY_REFERENCE_FENCE_FIELD, SUPPORTED_COLLECTIONS,
    employeeHistoryReferenceTargets, fenceEmployeeHistoryReferences };
