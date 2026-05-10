/**
 * ============================================================================
 * userContext.js - UPDATED με company slug support
 * ============================================================================
 *
 * ΣΚΟΠΟΣ:
 * Παρέχει helper functions για να παίρνουμε πληροφορίες χρήστη και εταιρειών
 * ============================================================================
 */

const mongoose = require('mongoose');
const { CompaniesModel } = require('../models/companies');

/**
 * Μετατρέπει string σε URL-safe slug
 *
 * @param {string} text - Το κείμενο προς μετατροπή
 * @returns {string} Slug (π.χ. "ΞΕΝΟΔΟΧΕΙΟ ΙΚΑΡΙΑ Α.Ε." → "ΞΕΝΟΔΟΧΕΙΟ_ΙΚΑΡΙΑ_ΑΕ")
 *
 * ΛΟΓΙΚΗ:
 * 1. Αφαιρεί ειδικούς χαρακτήρες (. , - / \ κτλ)
 * 2. Αντικαθιστά spaces με underscore
 * 3. Uppercase
 * 4. Περιορίζει το μήκος (max 50 χαρακτήρες)
 *
 * ΠΑΡΑΔΕΙΓΜΑΤΑ:
 * "ΞΕΝΟΔΟΧΕΙΟ ΙΚΑΡΙΑ Α.Ε." → "ΞΕΝΟΔΟΧΕΙΟ_ΙΚΑΡΙΑ_ΑΕ"
 * "Εστιατόριο Το Λιμάνι - Αθήνα" → "ΕΣΤΙΑΤΟΡΙΟ_ΤΟ_ΛΙΜΑΝΙ_ΑΘΗΝΑ"
 */
function createSlug(text) {
    if (!text) return 'COMPANY';

    return (
        text
            .toUpperCase()
            // 1. Αντικαθιστά & με AND
            .replace(/\s*&\s*/g, '_AND_') // "A & B" → "A_AND_B"
            // 2. Αφαιρεί ειδικούς χαρακτήρες
            .replace(/[.\-,/\\()[\]{}'"!@#$%^*+=<>?;:|`~]/g, '')
            // 3. Spaces → underscores
            .replace(/\s+/g, '_')
            // 4. Πολλαπλά underscores → ένα
            .replace(/_+/g, '_')
            // 5. Αφαιρεί underscore από αρχή/τέλος
            .replace(/^_|_$/g, '')
            // 6. Max 50 χαρακτήρες
            .substring(0, 50)
            // 7. Αφαιρεί underscore από τέλος (αν κόπηκε)
            .replace(/_$/, '')
    );
}

/**
 * Παίρνει όλες τις εταιρείες που έχει πρόσβαση ο χρήστης
 */
async function getUserCompanies(userId, team) {
    try {
        const companies = await CompaniesModel.find({
            team: team,
            users: userId,
            anenergh: mongoose.trusted({ $ne: true })
        })
            .select('_id kod eponymia')
            .sort({ kod: 1 })
            .lean();

        return companies;
    } catch (error) {
        console.error('Error fetching user companies:', error);
        return [];
    }
}

/**
 * Δημιουργεί το company folder name (kod + slug)
 *
 * @param {string} companyId - Company ObjectId
 * @param {string} team - Team name
 * @returns {Promise<string>} "0001_ΞΕΝΟΔΟΧΕΙΟ_ΙΚΑΡΙΑ"
 *
 * ΠΑΡΑΔΕΙΓΜΑ:
 * Company: { kod: "0001", eponymia: "ΞΕΝΟΔΟΧΕΙΟ ΙΚΑΡΙΑ Α.Ε." }
 * Returns: "0001_ΞΕΝΟΔΟΧΕΙΟ_ΙΚΑΡΙΑ_ΑΕ"
 */
async function getCompanyFolder(companyId, team) {
    try {
        const company = await CompaniesModel.findOne({
            _id: companyId,
            team: team
        })
            .select('kod eponymia')
            .lean();

        if (!company) {
            console.warn(`Company not found: ${companyId}`);
            return '0000_UNKNOWN';
        }

        const kod = company.kod || '0000';
        const slug = createSlug(company.eponymia);

        return `${kod}_${slug}`;
    } catch (error) {
        console.error('Error getting company folder:', error);
        return '0000_UNKNOWN';
    }
}

/**
 * Παίρνει το context του χρήστη (team + company folder)
 *
 * @param {Object} req - Express request
 * @param {string} [companyId] - Optional company ID
 * @returns {Promise<Object>} { team, companyFolder, companyId, companyKod }
 *
 * ΧΡΗΣΗ ΣΕ CONTROLLER:
 * const { team, companyFolder } = await getUserContext(req);
 * const s3Key = `txt/${team}/${companyFolder}/symbash/_HOTEL_0001.txt`;
 * // → "txt/THA/0001_ΞΕΝΟΔΟΧΕΙΟ_ΙΚΑΡΙΑ/symbash/_HOTEL_0001.txt"
 */
async function getUserContext(req, companyId = null) {
    try {
        const team = req.session?.userTeam;

        if (!team) {
            throw new Error('User team not found in session');
        }

        let targetCompanyId = companyId || req.session?.companyInUse;

        if (!targetCompanyId) {
            const userId = req.session?.userId;
            if (!userId) {
                throw new Error('User ID not found in session');
            }

            const companies = await getUserCompanies(userId, team);
            if (companies.length === 0) {
                throw new Error('User has no companies');
            }

            targetCompanyId = companies[0]._id.toString();
        }

        const companyFolder = await getCompanyFolder(targetCompanyId, team);

        // Παίρνουμε και τον kod ξεχωριστά (για display purposes)
        const company = await CompaniesModel.findOne({ _id: targetCompanyId }).select('kod').lean();

        return {
            team,
            companyFolder, // "0001_ΞΕΝΟΔΟΧΕΙΟ_ΙΚΑΡΙΑ"
            companyId: targetCompanyId,
            companyKod: company?.kod || '0000'
        };
    } catch (error) {
        console.error('Error getting user context:', error);
        return {
            team: 'UNKNOWN',
            companyFolder: '0000_UNKNOWN',
            companyId: null,
            companyKod: '0000'
        };
    }
}

/**
 * Ελέγχει αν ο χρήστης έχει πρόσβαση σε συγκεκριμένη εταιρεία
 */
async function canAccessCompany(userId, companyId, team) {
    try {
        const company = await CompaniesModel.findOne({
            _id: companyId,
            team: team,
            users: userId
        })
            .select('_id')
            .lean();

        return !!company;
    } catch (error) {
        console.error('Error checking company access:', error);
        return false;
    }
}

module.exports = {
    getUserCompanies,
    getCompanyFolder,
    getUserContext,
    canAccessCompany,
    createSlug // Export για testing/reuse
};
