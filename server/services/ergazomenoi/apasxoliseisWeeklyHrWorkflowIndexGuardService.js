'use strict';

const StateModel = require('../../models/apasxoliseisWeeklyHrWorkflowState');
const AuditModel = require('../../models/apasxoliseisWeeklyHrWorkflowAudit');

const REQUIRED_INDEXES = Object.freeze([
    Object.freeze({
        collection: 'state',
        name: 'unique_weekly_hr_workflow_employee_natural_week',
        key: Object.freeze({ team: 1, company_kod: 1, ypokatasthma: 1,
            employee_id: 1, week_start: 1, week_end: 1 })
    }),
    Object.freeze({
        collection: 'audit',
        name: 'unique_weekly_hr_workflow_audit_request',
        key: Object.freeze({ team: 1, company_kod: 1, request_id: 1 })
    })
]);

function sameKey(actual, expected) {
    const left = Object.entries(actual || {});
    const right = Object.entries(expected || {});
    return left.length === right.length && left.every(([key, value], index) =>
        right[index]?.[0] === key && right[index]?.[1] === value);
}

async function getWeeklyHrWorkflowIndexState({
    stateIndexLoader = () => StateModel.collection.indexes(),
    auditIndexLoader = () => AuditModel.collection.indexes()
} = {}) {
    try {
        const [stateIndexes, auditIndexes] = await Promise.all([
            stateIndexLoader(), auditIndexLoader()
        ]);
        const indexesByCollection = { state: stateIndexes, audit: auditIndexes };
        const missing = REQUIRED_INDEXES.filter((contract) => {
            const index = (indexesByCollection[contract.collection] || [])
                .find((candidate) => candidate?.name === contract.name);
            return index?.unique !== true || !sameKey(index?.key, contract.key);
        }).map((contract) => contract.name);
        return Object.freeze({
            ready: missing.length === 0,
            code: missing.length ? 'WEEKLY_HR_WORKFLOW_INDEXES_NOT_READY' : null,
            missing: Object.freeze(missing)
        });
    } catch {
        return Object.freeze({ ready: false,
            code: 'WEEKLY_HR_WORKFLOW_INDEXES_NOT_READY', missing: Object.freeze([]) });
    }
}

async function assertWeeklyHrWorkflowIndexesReady(options) {
    const state = await getWeeklyHrWorkflowIndexState(options);
    if (!state.ready) {
        const error = new Error('Η λειτουργία εγγραφής της εβδομαδιαίας ροής HR δεν έχει ενεργοποιηθεί στη βάση.');
        error.statusCode = 503;
        error.code = state.code;
        throw error;
    }
    return state;
}

module.exports = { REQUIRED_INDEXES, sameKey, getWeeklyHrWorkflowIndexState,
    assertWeeklyHrWorkflowIndexesReady };
