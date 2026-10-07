'use strict';

const UserModel = require('../../models/userModel');
const { normalizeUserRole } = require('../../constants/userRoles');

const ACCESS_MODES = Object.freeze({
    ADMIN_FULL: 'ADMIN_FULL',
    SUPERVISOR_PROBLEM_SCOPE: 'SUPERVISOR_PROBLEM_SCOPE',
    NONE: 'NONE'
});

function accessForUser(user) {
    const active = user && String(user.situation || '').trim().toUpperCase() === 'A';
    const role = normalizeUserRole(user?.privileges);
    if (active && role === 'A' && String(user.team || '').trim().toUpperCase() === 'THA') {
        return { mode: ACCESS_MODES.ADMIN_FULL };
    }
    return { mode: active && role === 'S' ? ACCESS_MODES.SUPERVISOR_PROBLEM_SCOPE : ACCESS_MODES.NONE };
}

async function getEmployeeHistoryAccess(userId, { userModel = UserModel, session = null } = {}) {
    if (!userId) return accessForUser(null);
    let query = userModel.findById(userId).select('privileges team situation');
    if (session) query = query.session(session);
    return accessForUser(await query.lean());
}

// Existing callers of the broad capability remain Admin-only.
async function canManageEmployeeHistory(userId, options) {
    return (await getEmployeeHistoryAccess(userId, options)).mode === ACCESS_MODES.ADMIN_FULL;
}

function authorizationFailure(code) {
    const error = new Error(code);
    error.code = code;
    error.statusCode = 403;
    return error;
}

function assertEmployeeHistoryOperationsAuthorized({ accessMode, operations = [],
    originalHistoryRows = [], problemScope } = {}) {
    if (accessMode === ACCESS_MODES.ADMIN_FULL) return;
    if (accessMode !== ACCESS_MODES.SUPERVISOR_PROBLEM_SCOPE) {
        throw authorizationFailure('EMPLOYEE_HISTORY_MANAGEMENT_FORBIDDEN');
    }
    const persisted = new Set(originalHistoryRows.map(row => String(row._id)));
    const problematic = new Set(problemScope?.problematicHistoryIds || []);
    if (!problemScope?.deterministicallyResolved || !operations.length || !operations.every(op => {
        const id = op.state === 'inserted' ? op.anchorHistoryId : op.historyId;
        return ['inserted', 'modified', 'deleted'].includes(op.state) &&
            typeof id === 'string' && persisted.has(id) && problematic.has(id);
    })) {
        throw authorizationFailure('EMPLOYEE_HISTORY_SUPERVISOR_SCOPE_FORBIDDEN');
    }
}

module.exports = { ACCESS_MODES, accessForUser, getEmployeeHistoryAccess,
    canManageEmployeeHistory, authorizationFailure, assertEmployeeHistoryOperationsAuthorized };
