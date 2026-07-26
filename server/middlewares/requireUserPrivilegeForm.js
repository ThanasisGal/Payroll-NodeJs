const { UserPrivilegesModel } = require('../models/privileges');
const UserModel = require('../models/userModel');
const { normalizeRequiredUserTeam } = require('../services/userTeamScopeService');

const ALLOWED_PRIVILEGE_ACTIONS = new Set([
    'admin',
    'create',
    'read',
    'update',
    'delete',
    'print',
    'export'
]);

function validateCanonicalForm(canonicalForm) {
    if (
        typeof canonicalForm !== 'string' ||
        canonicalForm.trim() !== canonicalForm ||
        !/^[A-Za-z][A-Za-z0-9]*$/.test(canonicalForm)
    ) {
        throw new TypeError('canonicalForm must be a non-empty canonical string');
    }
}

function requireUserPrivilegeForm(canonicalForm) {
    if (typeof canonicalForm !== 'string' || !canonicalForm) {
        throw new TypeError('canonicalForm is required');
    }
    return async function requireCanonicalFormAccess(req, res, next) {
        if (!req.session?.userId) {
            return res.status(401).send('Απαιτείται σύνδεση');
        }
        try {
            const record = await UserPrivilegesModel.findOne({
                userId: String(req.session.userId),
                form: canonicalForm
            }).select('_id privileges.admin privileges.read').lean();
            if (record?.privileges?.admin !== true && record?.privileges?.read !== true) {
                return res.status(403).send('Δεν έχετε δικαίωμα πρόσβασης');
            }
            return next();
        } catch {
            return res.status(500).send('Σφάλμα ελέγχου πρόσβασης');
        }
    };
}

function requireUserPrivilegeAction(canonicalForm, privilegeKey) {
    validateCanonicalForm(canonicalForm);
    if (typeof privilegeKey !== 'string' || !ALLOWED_PRIVILEGE_ACTIONS.has(privilegeKey)) {
        throw new TypeError('privilegeKey is not allowed');
    }

    return async function requireCanonicalFormAction(req, res, next) {
        if (!req.session?.userId) {
            return res.status(401).send('Απαιτείται σύνδεση');
        }

        try {
            const userId = String(req.session.userId);
            const user = await UserModel.findById(userId).select('_id situation team').lean();
            if (!user || String(user.situation || '').trim().toUpperCase() !== 'A') {
                return res.status(403).send('Δεν έχετε δικαίωμα πρόσβασης');
            }
            req.authenticatedUserTeam = normalizeRequiredUserTeam(user.team);

            const record = await UserPrivilegesModel.findOne({
                userId,
                form: canonicalForm
            })
                .select(`_id privileges.admin privileges.${privilegeKey}`)
                .lean();

            if (
                record?.privileges?.admin !== true &&
                record?.privileges?.[privilegeKey] !== true
            ) {
                return res.status(403).send('Δεν έχετε δικαίωμα πρόσβασης');
            }
            return next();
        } catch (error) {
            if (error?.code === 'INVALID_TEAM_SCOPE') {
                return res.status(403).send('Δεν έχετε δικαίωμα πρόσβασης');
            }
            return res.status(500).send('Σφάλμα ελέγχου πρόσβασης');
        }
    };
}

module.exports = requireUserPrivilegeForm;
module.exports.requireUserPrivilegeAction = requireUserPrivilegeAction;
module.exports.ALLOWED_PRIVILEGE_ACTIONS = ALLOWED_PRIVILEGE_ACTIONS;
