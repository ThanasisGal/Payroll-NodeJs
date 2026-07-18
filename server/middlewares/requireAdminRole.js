const UserModel = require('../models/userModel');
const { normalizeUserRole, isAdminUserRole } = require('../constants/userRoles');

async function requireAdminRole(req, res, next) {
    if (!req.session?.userId) {
        return res.redirect('/login');
    }

    try {
        const user = await UserModel.findById(req.session.userId)
            .select('privileges situation')
            .lean();

        if (
            !user ||
            !isAdminUserRole(normalizeUserRole(user.privileges)) ||
            String(user.situation || '').trim().toUpperCase() !== 'A'
        ) {
            return res.status(403).send('Δεν έχετε δικαίωμα πρόσβασης');
        }

        return next();
    } catch (error) {
        return res.status(500).send('Σφάλμα ελέγχου πρόσβασης');
    }
}

module.exports = requireAdminRole;
