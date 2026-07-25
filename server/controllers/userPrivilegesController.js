const mongoose = require('mongoose');
const UserModel = require('../models/userModel');
const { UserPrivilegesModel } = require('../models/privileges');
const UserPrivilegeFormCatalogModel = require('../models/userPrivilegeFormCatalog');
const { getUserRoleLabel } = require('../constants/userRoles');
const {
    normalizeRequiredUserTeam,
    buildManagedUserFilter,
    buildManagedUserIdentityFilter
} = require('../services/userTeamScopeService');
const {
    getSchemaPrivilegeKeys,
    serializePrivilegeDocuments,
    updateAllPrivilegesAtomically
} = require('../services/userPrivilegesManagementService');

function sendError(res, error) {
    const status = Number(error?.status) || 500;
    const message = status >= 500 ? 'Παρουσιάστηκε σφάλμα κατά την επεξεργασία' : error.message;
    return res.status(status).json({ success: false, code: error?.code || 'INTERNAL_ERROR', message });
}

async function requireExistingUser(userId, sessionTeam, dbSession = null) {
    if (!mongoose.isValidObjectId(userId)) {
        throw Object.assign(new Error('Μη έγκυρο αναγνωριστικό χρήστη'), { status: 400, code: 'INVALID_USER_ID' });
    }
    let query = UserModel.findOne(buildManagedUserIdentityFilter(sessionTeam, userId))
        .select('_id kod firstName lastName email team privileges situation');
    if (dbSession) query = query.session(dbSession);
    const user = await query.lean();
    if (!user) throw Object.assign(new Error('Ο χρήστης δεν βρέθηκε'), { status: 404, code: 'USER_NOT_FOUND' });
    return user;
}

exports.renderPage = (req, res) => {
    try {
        normalizeRequiredUserTeam(req.session?.userTeam);
        return res.render('users/dikaiomataXrhston', {
            title: 'Δικαιώματα Χρηστών',
            description: 'Διαχείριση δικαιωμάτων χρηστών',
            bodyClass: 'user-privileges-page'
        });
    } catch (error) {
        return res.status(Number(error?.status) || 500).send('Δεν έχετε έγκυρο team scope');
    }
};

exports.listUsers = async (req, res) => {
    try {
        const users = await UserModel.find(buildManagedUserFilter(req.session?.userTeam))
            .select('_id kod firstName lastName email team privileges situation')
            .sort({ lastName: 1, firstName: 1, email: 1 })
            .lean();
        const items = users.map((user) => {
            const identity = [user.lastName, user.firstName].filter(Boolean).join(' ').trim();
            const details = [user.email, user.team].filter(Boolean).join(' · ');
            return {
                value: String(user._id),
                label: [user.kod, identity, details].filter(Boolean).join(' — '),
                role: user.privileges,
                roleLabel: getUserRoleLabel(user.privileges),
                active: String(user.situation).toUpperCase() === 'A'
            };
        });
        return res.json({ items, hasMore: false });
    } catch (error) {
        return sendError(res, error);
    }
};

exports.getPrivileges = async (req, res) => {
    try {
        const user = await requireExistingUser(req.params.userId, req.session?.userTeam);
        const [catalog, documents] = await Promise.all([
            UserPrivilegeFormCatalogModel.find({ active: true, showInPrivileges: true })
                .select('_id form formLabel sidebarOrder')
                .sort({ sidebarOrder: 1, form: 1 })
                .lean(),
            UserPrivilegesModel.find({ userId: String(user._id) })
                .select('_id form privileges')
                .lean()
        ]);
        const table = serializePrivilegeDocuments(catalog, documents, getSchemaPrivilegeKeys());
        return res.json({
            success: true,
            user: { id: String(user._id), role: user.privileges, roleLabel: getUserRoleLabel(user.privileges) },
            ...table
        });
    } catch (error) {
        return sendError(res, error);
    }
};

exports.updatePrivileges = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.userId)) {
            throw Object.assign(new Error('Μη έγκυρο αναγνωριστικό χρήστη'), {
                status: 400,
                code: 'INVALID_USER_ID'
            });
        }
        const userId = String(req.params.userId);
        await updateAllPrivilegesAtomically({
            userId,
            payload: req.body,
            authorizeTarget: (session) => requireExistingUser(userId, req.session?.userTeam, session)
        });
        return res.json({ success: true, message: 'Τα δικαιώματα ενημερώθηκαν επιτυχώς' });
    } catch (error) {
        return sendError(res, error);
    }
};

exports.requireExistingUser = requireExistingUser;
