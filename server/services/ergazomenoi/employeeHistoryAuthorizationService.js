'use strict';

const UserModel = require('../../models/userModel');
const { normalizeUserRole } = require('../../constants/userRoles');

async function canManageEmployeeHistory(userId) {
    if (!userId) return false;

    const user = await UserModel.findById(userId)
        .select('privileges team situation')
        .lean();

    return Boolean(
        user &&
        normalizeUserRole(user.privileges) === 'A' &&
        String(user.team || '').trim().toUpperCase() === 'THA' &&
        String(user.situation || '').trim().toUpperCase() === 'A'
    );
}

module.exports = { canManageEmployeeHistory };
