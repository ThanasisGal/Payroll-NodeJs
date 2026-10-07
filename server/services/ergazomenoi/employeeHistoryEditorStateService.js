'use strict';

const { createHash } = require('node:crypto');
const { CURRENT_SYNC_FIELDS, REDUNDANT_STATUS_FIELD, REDUNDANT_SURVIVOR_FIELD } =
    require('./employeeHistoryCanonicalizationService');
const T = require('../../utils/ergazomenoi/employmentProfileTemporal');

const IDENTITY_FIELDS = ['_id', 'team', 'company_kod', 'kodikos'];
// Explicit persisted business projections: never hash document blobs, lookups,
// the Employee serialization sequence, or the History reference-write fence.
const EMPLOYEE_STATE_FIELDS = Object.freeze([...new Set([
    ...IDENTITY_FIELDS, ...CURRENT_SYNC_FIELDS, T.ANCHOR,
    'archived', 'energos', 'employment_departure_restore',
    'afora_proslhpsh', 'afora_allagh_oron_ergasias', 'employment_profile_source',
    'afora_allagh_dialleimatos', 'hmeromhnia_isxyos_dialleimatos_apo'
])]);
const HISTORY_STATE_FIELDS = Object.freeze([...new Set([
    ...IDENTITY_FIELDS, ...CURRENT_SYNC_FIELDS,
    'aa_eggrafhs', 'afora_proslhpsh', 'afora_allagh_oron_ergasias',
    'afora_allagh_dialleimatos', 'hmeromhnia_isxyos_dialleimatos_apo',
    'employment_profile_source', REDUNDANT_STATUS_FIELD, REDUNDANT_SURVIVOR_FIELD,
    // Creation order and existing row revision checks participate in planning.
    'createdAt', 'updatedAt'
])]);

function stableValue(value) {
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? String(value) : value.toISOString();
    if (value && typeof value.toHexString === 'function') return value.toHexString();
    if (Array.isArray(value)) return value.map(stableValue);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, stableValue(value[key])]));
}

function project(record, fields) {
    return stableValue(Object.fromEntries(fields.filter(field =>
        Object.hasOwn(record, field) && record[field] !== undefined)
        .map(field => [field, record[field]])));
}

function buildEmployeeHistoryEditorStateToken({ currentEmployee, historyRows }) {
    const rows = historyRows.map(row => JSON.stringify(project(row, HISTORY_STATE_FIELDS))).sort();
    return createHash('sha256').update(JSON.stringify({
        version: 'employee-history-editor-state:v1',
        employee: project(currentEmployee, EMPLOYEE_STATE_FIELDS),
        history: rows
    })).digest('hex');
}

function isEmployeeHistoryEditorStateToken(value) {
    return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
}

function employeeHistoryEditorStaleError() {
    const error = new Error('EMPLOYEE_HISTORY_EDITOR_STALE');
    error.code = 'EMPLOYEE_HISTORY_EDITOR_STALE';
    error.statusCode = 409;
    return error;
}

function assertEmployeeHistoryEditorState({ expectedStateToken, currentEmployee, historyRows }) {
    if (!isEmployeeHistoryEditorStateToken(expectedStateToken) ||
        expectedStateToken !== buildEmployeeHistoryEditorStateToken({ currentEmployee, historyRows })) {
        throw employeeHistoryEditorStaleError();
    }
}

module.exports = { EMPLOYEE_STATE_FIELDS, HISTORY_STATE_FIELDS,
    buildEmployeeHistoryEditorStateToken, isEmployeeHistoryEditorStateToken,
    employeeHistoryEditorStaleError, assertEmployeeHistoryEditorState };
