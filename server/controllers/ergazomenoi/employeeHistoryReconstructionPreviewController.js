'use strict';

const mongoose = require('mongoose');
const { buildAutomaticReconstructionPreviewToken, isNoOp } = require('../../services/ergazomenoi/employeeHistoryAutomaticReconstructionApplyContract');
const { ErgazomenoiModel, IstorikoProslhpseonAllagonModel } = require('../../models/ergazomenoi');
const { CompaniesModel } = require('../../models/companies');
const { normalizeRequiredUserTeam, CANONICAL_ALL_TEAMS_CODE } = require('../../services/userTeamScopeService');
const { planEmployeeHistoryAutomaticReconstruction } = require('../../services/ergazomenoi/employeeHistoryAutomaticReconstructionPlannerService');
const { buildEmployeeHistoryReconstructionPreview } = require('../../services/ergazomenoi/employeeHistoryReconstructionPreviewService');
const { loadEmployeeHistoryCorrectionCatalogs } = require('../../services/ergazomenoi/employeeHistoryCorrectionCatalogService');

function createEmployeeHistoryReconstructionPreviewController({ employeeModel = ErgazomenoiModel,
    historyModel = IstorikoProslhpseonAllagonModel, companyModel = CompaniesModel,
    planner = planEmployeeHistoryAutomaticReconstruction, project = buildEmployeeHistoryReconstructionPreview,
    loadCatalogs = loadEmployeeHistoryCorrectionCatalogs } = {}) {
    return async function employeeHistoryReconstructionPreview(req, res) {
        res.set('Cache-Control', 'no-store');
        const fail = (status, explanation, reference) => res.status(status).json({ success: false,
            message: `Ο έλεγχος του Ιστορικού δεν ολοκληρώθηκε. ${explanation} Δεν έχει αποθηκευτεί καμία αλλαγή.\n1. Ελέγξτε ότι έχετε επιλέξει τη σωστή εταιρεία και τον σωστό εργαζόμενο.\n2. Συνδεθείτε ξανά ή ζητήστε από τον διαχειριστή να ελέγξει την πρόσβασή σας.\nΚωδικός αναφοράς: ${reference}.` });
        if (!req.session?.userId) return fail(401, 'Απαιτείται σύνδεση στην εφαρμογή.', 'ΙΣΤ-ΠΡΟΕΠ-02');
        try {
            // The existing read-permission middleware reloads the active user
            // and supplies authenticatedUserTeam. Never trust browser role/scope.
            const authenticatedTeam = normalizeRequiredUserTeam(req.authenticatedUserTeam);
            const team = normalizeRequiredUserTeam(req.session.userTeam);
            const company = req.session.companyInUse;
            if ((authenticatedTeam !== CANONICAL_ALL_TEAMS_CODE && authenticatedTeam !== team) ||
                typeof company !== 'string' || !mongoose.isObjectIdOrHexString(company) ||
                !mongoose.isObjectIdOrHexString(req.params.id)) {
                return fail(404, 'Δεν βρέθηκε εργαζόμενος στην επιλεγμένη εταιρεία με την πρόσβασή σας.', 'ΙΣΤ-ΠΡΟΕΠ-03');
            }
            const selectedCompany = await companyModel.findOne({ _id: company, team }).select('_id').lean();
            if (!selectedCompany) return fail(404, 'Η επιλεγμένη εταιρεία δεν είναι διαθέσιμη με την πρόσβασή σας.', 'ΙΣΤ-ΠΡΟΕΠ-03');
            const employee = await employeeModel.findOne({ _id: req.params.id, team, company_kod: company }).lean();
            if (!employee || employee.team !== team || employee.company_kod !== company || typeof employee.kodikos !== 'string') {
                return fail(404, 'Δεν βρέθηκε εργαζόμενος στην επιλεγμένη εταιρεία με την πρόσβασή σας.', 'ΙΣΤ-ΠΡΟΕΠ-03');
            }
            const scope = { team, company_kod: company, kodikos: employee.kodikos };
            const query = historyModel.find(scope);
            query.mongooseOptions({ includeRedundantHistoryArtifacts: true });
            const history = await query.lean();
            const plan = planner({ scope, currentEmployee: employee, completeHistoryRows: history });
            const catalogs = await loadCatalogs();
            return res.json({ success: true, preview: project({ plan, completeHistoryRows: history, catalogs }),
                ...(!isNoOp(plan) && ['PLANNED', 'REVIEW_REQUIRED'].includes(plan.status) ? { previewToken:
                    buildAutomaticReconstructionPreviewToken({ scope, currentEmployee: employee, completeHistoryRows: history, plan }) } : {}) });
        } catch (error) {
            // No response bodies, employee values, scope, cookies or exceptions
            // are logged. All planner diagnostics stay behind the projection.
            return fail(error?.code === 'INVALID_TEAM_SCOPE' ? 403 : 500,
                'Δεν ήταν δυνατό να φορτωθούν και να ελεγχθούν με ασφάλεια τα στοιχεία.', 'ΙΣΤ-ΠΡΟΕΠ-04');
        }
    };
}
module.exports = { createEmployeeHistoryReconstructionPreviewController,
    employeeHistoryReconstructionPreview: createEmployeeHistoryReconstructionPreviewController() };
