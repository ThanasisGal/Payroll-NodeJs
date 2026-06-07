'use strict';

// ============================================================================
// ERGANI CREDENTIALS HELPER
// Παίρνει τους κωδικούς ΕΡΓΑΝΗ από το PasswordsModel, όπως στο υπάρχον flow.
// Query:
//   team = session.userTeam
//   companykod_object = session.companyInUse
//   kodikos = '0002'  // Ε.Φ.Κ.Α. / ΕΡΓΑΝΗ
// ============================================================================

const Models_C = require('../../models/companies');
const { PasswordsModel } = Models_C;

function normalizeId(value) {
    if (value === null || value === undefined) return '';
    return String(value).trim();
}

async function getErganiCredsFromPasswordsModel({ team, companyId, usertype = '01' } = {}) {
    const normalizedTeam = normalizeId(team);
    const normalizedCompanyId = normalizeId(companyId);

    if (!normalizedTeam) {
        throw new Error('[ERGANI CREDS] Λείπει team για αναζήτηση κωδικών ΕΡΓΑΝΗ.');
    }

    if (!normalizedCompanyId) {
        throw new Error(
            '[ERGANI CREDS] Λείπει companyId/companyInUse για αναζήτηση κωδικών ΕΡΓΑΝΗ.'
        );
    }

    const rec = await PasswordsModel.findOne({
        team: normalizedTeam,
        companykod_object: normalizedCompanyId,
        kodikos: '0002'
    }).lean();

    if (!rec) {
        throw new Error(
            `[ERGANI CREDS] Δεν βρέθηκε εγγραφή PasswordsModel για team=${normalizedTeam}, ` +
                `companykod_object=${normalizedCompanyId}, kodikos=0002.`
        );
    }

    if (!rec.username || !rec.password) {
        throw new Error(
            `[ERGANI CREDS] Η εγγραφή PasswordsModel kodikos=0002 δεν έχει username/password ` +
                `για team=${normalizedTeam}, companykod_object=${normalizedCompanyId}.`
        );
    }

    return {
        username: rec.username,
        password: rec.password,
        usertype: String(usertype || '01')
    };
}

async function getErganiCredsFromRequest(req, { usertype = '01' } = {}) {
    return getErganiCredsFromPasswordsModel({
        team: req?.session?.userTeam,
        companyId: req?.session?.companyInUse,
        usertype
    });
}

module.exports = {
    getErganiCredsFromPasswordsModel,
    getErganiCredsFromRequest
};
