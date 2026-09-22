const UserModel = require('../models/userModel');
const { normalizeRequiredUserTeam } = require('../services/userTeamScopeService');
const {
    normalizeUserRole,
    isAdminUserRole,
    isAdminOrSupervisorRole
} = require('../constants/userRoles');

function requireActiveRole(rolePredicate) {
    return async function requireRole(req, res, next) {
        if (!req.session?.userId) {
            return res.redirect('/login');
        }

        try {
            const user = await UserModel.findById(req.session.userId)
                .select('_id privileges situation team')
                .lean();

            if (
                !user ||
                (rolePredicate === isAdminOrSupervisorRole && !user._id) ||
                !rolePredicate(normalizeUserRole(user.privileges)) ||
                String(user.situation || '').trim().toUpperCase() !== 'A'
            ) {
                return res.status(403).send('Δεν έχετε δικαίωμα πρόσβασης');
            }

            if (rolePredicate === isAdminOrSupervisorRole) {
                req.adminActor = Object.freeze({
                    userId: String(user._id),
                    role: normalizeUserRole(user.privileges),
                    team: normalizeRequiredUserTeam(user.team)
                });
            }
            return next();
        } catch (error) {
            if (Number(error?.status) === 403) return res.status(403).send('Δεν έχετε δικαίωμα πρόσβασης');
            return res.status(500).send('Σφάλμα ελέγχου πρόσβασης');
        }
    };
}

const requireAdminRole = requireActiveRole(isAdminUserRole);
const requireAdminOrSupervisorRole = requireActiveRole(isAdminOrSupervisorRole);
const requireUserPrivilegesManagerRole = requireAdminOrSupervisorRole;

module.exports = requireAdminRole;
module.exports.requireAdminOrSupervisorRole = requireAdminOrSupervisorRole;
module.exports.requireActiveRole = requireActiveRole;
module.exports.requireUserPrivilegesManagerRole = requireUserPrivilegesManagerRole;
