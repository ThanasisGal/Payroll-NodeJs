'use strict';
const mongoose = require('mongoose');
const { ErgazomenoiModel } = require('../../models/ergazomenoi');
const { CompaniesModel } = require('../../models/companies');
const { normalizeRequiredUserTeam, CANONICAL_ALL_TEAMS_CODE } = require('../../services/userTeamScopeService');
const { applyEmployeeHistoryAutomaticReconstruction } = require('../../services/ergazomenoi/employeeHistoryAutomaticReconstructionApplyService');
const { PREFIX } = require('../../services/ergazomenoi/employeeHistoryAutomaticReconstructionApplyContract');
function createEmployeeHistoryReconstructionApplyController({ employeeModel = ErgazomenoiModel,
    companyModel = CompaniesModel, apply = applyEmployeeHistoryAutomaticReconstruction } = {}) {
    return async function employeeHistoryReconstructionApply(req, res) {
        res.set('Cache-Control', 'no-store');
        const fail = (status, suffix, explanation) => res.status(status).json({ success: false, code: PREFIX + suffix,
            message: `${explanation} Δεν αποθηκεύτηκε καμία αλλαγή.\n1. Ανοίξτε ξανά την προεπισκόπηση και εξετάστε την πρόταση.\n2. Αν δεν μπορείτε να συνεχίσετε, ζητήστε βοήθεια από τον διαχειριστή.\nΚωδικός αναφοράς: ΙΣΤ-ΕΦΑΡΜ-01.` });
        if (!req.session?.userId) return fail(401, 'FORBIDDEN', 'Για την τακτοποίηση του Ιστορικού απαιτείται σύνδεση.');
        const body = req.body;
        if (!body || typeof body !== 'object' || Array.isArray(body) ||
            Object.keys(body).length !== 2 || !Object.hasOwn(body, 'previewToken') || !Object.hasOwn(body, 'approvalAccepted') ||
            typeof body.previewToken !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(body.previewToken) || body.approvalAccepted !== true) {
            return fail(400, 'INVALID_REQUEST', 'Η τακτοποίηση δεν εφαρμόστηκε επειδή δεν παραλήφθηκε έγκυρη έγκριση της πρότασης.');
        }
        try {
            const authenticatedTeam = normalizeRequiredUserTeam(req.authenticatedUserTeam);
            const team = normalizeRequiredUserTeam(req.session.userTeam), company = req.session.companyInUse;
            if ((authenticatedTeam !== CANONICAL_ALL_TEAMS_CODE && authenticatedTeam !== team) ||
                typeof company !== 'string' || !mongoose.isObjectIdOrHexString(company) || !mongoose.isObjectIdOrHexString(req.params.id)) {
                return fail(404, 'NOT_FOUND', 'Ο εργαζόμενος δεν βρέθηκε στην επιλεγμένη εταιρεία με την πρόσβασή σας.');
            }
            if (!await companyModel.findOne({ _id: company, team }).select('_id').lean()) {
                return fail(404, 'NOT_FOUND', 'Η επιλεγμένη εταιρεία δεν είναι διαθέσιμη με την πρόσβασή σας.');
            }
            // Identity/scope lookup only. No business value read here is used
            // for planning: the writer fences, then reloads the complete state.
            const identity = await employeeModel.findOne({ _id: req.params.id, team, company_kod: company }).select('_id team company_kod kodikos').lean();
            if (!identity || identity.team !== team || identity.company_kod !== company || typeof identity.kodikos !== 'string') {
                return fail(404, 'NOT_FOUND', 'Ο εργαζόμενος δεν βρέθηκε στην επιλεγμένη εταιρεία με την πρόσβασή σας.');
            }
            return res.json(await apply({ scope: { team, company_kod: company, kodikos: identity.kodikos },
                employeeId: identity._id, previewToken: body.previewToken, approvalAccepted: true, actorUserId: req.session.userId }));
        } catch (error) {
            if (error?.code === PREFIX + 'STALE') return res.status(409).json({ success: false, code: error.code,
                message: 'Τα στοιχεία του Ιστορικού άλλαξαν από τότε που έγινε ο έλεγχος. Δεν αποθηκεύτηκε καμία αλλαγή. Ανοίξτε ξανά την προεπισκόπηση.' });
            if (error?.statusCode === 403 || error?.code === 'INVALID_TEAM_SCOPE') {
                return fail(403, 'FORBIDDEN', 'Η τακτοποίηση σταμάτησε επειδή δεν έχετε δικαίωμα διόρθωσης όλων των επηρεαζόμενων εγγραφών.');
            }
            if (error?.code === PREFIX + 'BLOCKED') return fail(409, 'BLOCKED', 'Δεν είναι δυνατό να εφαρμοστεί αυτόματα ασφαλής τακτοποίηση.');
            return fail(error?.statusCode === 503 ? 503 : 500,
                error?.code === PREFIX + 'FINAL_VERIFICATION_FAILED' ? 'FINAL_VERIFICATION_FAILED' : 'FAILED',
                'Η τακτοποίηση σταμάτησε επειδή δεν επιβεβαιώθηκε ότι όλες οι εγκεκριμένες αλλαγές μπορούν να αποθηκευτούν με ασφάλεια.');
        }
    };
}
module.exports = { createEmployeeHistoryReconstructionApplyController,
    employeeHistoryReconstructionApply: createEmployeeHistoryReconstructionApplyController() };
