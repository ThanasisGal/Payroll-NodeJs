const UserModel = require('../models/userModel');
const {
    normalizeUserRole,
    isAdminUserRole,
    isUserPrivilegesManagerRole
} = require('../constants/userRoles');

function requireActiveRole(rolePredicate) {
    return async function requireRole(req, res, next) {
        if (!req.session?.userId) {
            return res.redirect('/login');
        }

        try {
            const user = await UserModel.findById(req.session.userId)
                .select('privileges situation')
                .lean();

            if (
                !user ||
                !rolePredicate(normalizeUserRole(user.privileges)) ||
                String(user.situation || '').trim().toUpperCase() !== 'A'
            ) {
                return res.status(403).send('Δεν έχετε δικαίωμα πρόσβασης');
            }

            return next();
        } catch (error) {
            return res.status(500).send('Σφάλμα ελέγχου πρόσβασης');
        }
    };
}

const requireAdminRole = requireActiveRole(isAdminUserRole);
const requireUserPrivilegesManagerRole = requireActiveRole(isUserPrivilegesManagerRole);

module.exports = requireAdminRole;
module.exports.requireActiveRole = requireActiveRole;
module.exports.requireUserPrivilegesManagerRole = requireUserPrivilegesManagerRole;
