const { UserPrivilegesModel } = require('../models/privileges');

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

module.exports = requireUserPrivilegeForm;
