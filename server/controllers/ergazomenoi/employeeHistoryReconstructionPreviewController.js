'use strict';

const mongoose = require('mongoose');
const { findHistoryIdReferences } = require('../../services/ergazomenoi/employeeHistoryReferenceAuditService');
const { buildEmployeeHistorySettlementPreview } = require('../../services/ergazomenoi/employeeHistorySettlementPreviewService');
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
    loadCatalogs = loadEmployeeHistoryCorrectionCatalogs, referenceChecker = findHistoryIdReferences,
    settlementProject = buildEmployeeHistorySettlementPreview, resolveBusinessDecision = false } = {}) {
    return async function employeeHistoryReconstructionPreview(req, res) {
        if (!resolveBusinessDecision && req.query?.presentation === 'settlement' &&
            require('../../services/ergazomenoi/employeeHistorySettlementDevActivation').getEmployeeHistorySettlementDevHandle(req)) {
            return require('./employeeHistorySettlementHttpController').createEmployeeHistorySettlementHttpController().preview(req, res);
        }
        res.set('Cache-Control', 'no-store');
        const fail = (status, explanation, reference) => res.status(status).json({ success: false,
            message: `Ο έλεγχος του Ιστορικού δεν ολοκληρώθηκε. ${explanation} Δεν έχει αποθηκευτεί καμία αλλαγή.\n1. Ελέγξτε ότι έχετε επιλέξει τη σωστή εταιρεία και τον σωστό εργαζόμενο.\n2. Συνδεθείτε ξανά ή ζητήστε από τον διαχειριστή να ελέγξει την πρόσβασή σας.\nΚωδικός αναφοράς: ${reference}.` });
        if (!req.session?.userId) return fail(401, 'Απαιτείται σύνδεση στην εφαρμογή.', 'ΙΣΤ-ΠΡΟΕΠ-02');
        try {
            if (resolveBusinessDecision && (!req.body || Array.isArray(req.body) ||
                Object.keys(req.body).length !== 1 || !Object.hasOwn(req.body, 'businessDecision'))) {
                return fail(400, 'Η επιλογή δεν αναγνωρίστηκε και ο επανέλεγχος σταμάτησε.', 'ΙΣΤ-ΕΠΙΛ-01');
            }
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
            const settlement = resolveBusinessDecision || req.query?.presentation === 'settlement';
            const employeeQuery = employeeModel.findOne({ _id: req.params.id, team, company_kod: company });
            if (settlement) employeeQuery.select('+employee_profile_mutation_sequence');
            const employee = await employeeQuery.lean();
            if (!employee || employee.team !== team || employee.company_kod !== company || typeof employee.kodikos !== 'string') {
                return fail(404, 'Δεν βρέθηκε εργαζόμενος στην επιλεγμένη εταιρεία με την πρόσβασή σας.', 'ΙΣΤ-ΠΡΟΕΠ-03');
            }
            const scope = { team, company_kod: company, kodikos: employee.kodikos };
            const query = historyModel.find(scope);
            query.mongooseOptions({ includeRedundantHistoryArtifacts: true });
            if (settlement) query.select('+history_reference_fence');
            const history = await query.lean();
            if (settlement) {
                const protectedReferenceSummary = {};
                // Bounded read concurrency. This projection never opens a write session.
                let next = 0;
                await Promise.all(Array.from({ length: Math.min(4, history.length) }, async () => {
                    while (next < history.length) {
                        const row = history[next++];
                        protectedReferenceSummary[String(row._id)] = await referenceChecker({
                            connection: historyModel.db, historyIds: [row._id] });
                    }
                }));
                const catalogs = await loadCatalogs();
                const input = { scope, currentEmployee: employee, completeHistoryRows: history, protectedReferenceSummary };
                const businessDecision = resolveBusinessDecision ? req.body.businessDecision : null;
                if (businessDecision !== null) input.businessDecision = businessDecision;
                const settlementPreview = settlementProject(input, catalogs, { unified: true });
                // The browser supports only business questions with a complete
                // descriptor. Physical plans and internal diagnostics never leave.
                const supportedDecision = settlementPreview.state !== 'decision' ||
                    settlementPreview.questions.length > 0 && settlementPreview.questions.every(question =>
                        typeof question.id === 'string' && typeof question.label === 'string' &&
                        (['DATE', 'DECIMAL'].includes(question.type) ||
                            question.type === 'HISTORY_FACTS' && question.resolution?.kind === 'USER_CONFIRMED_HISTORY_CORRECTION' ||
                            question.type === 'SINGLE_CHOICE' && Array.isArray(question.options) &&
                            question.options.length > 0 && question.options.every(option =>
                                typeof option.id === 'string' && typeof option.label === 'string')));
                return res.json({ success: true, executionMode: 'PREVIEW_ONLY', decisionEnabled: true,
                    ...(businessDecision === null ? {} : { businessDecision }),
                    settlementPreview: supportedDecision ? settlementPreview : {
                        state: 'unknown', previewOnly: true, questions: [], assumptions: [], actions: [] } });
            }
            const plan = planner({ scope, currentEmployee: employee, completeHistoryRows: history });
            const catalogs = await loadCatalogs();
            return res.json({ success: true, preview: project({ plan, completeHistoryRows: history, catalogs, scope, currentEmployee: employee }),
                ...(!isNoOp(plan) && ['PLANNED', 'REVIEW_REQUIRED'].includes(plan.status) ? { previewToken:
                    buildAutomaticReconstructionPreviewToken({ scope, currentEmployee: employee, completeHistoryRows: history, plan,
                        actorUserId: req.session.userId }) } : {}) });
        } catch (error) {
            // No response bodies, employee values, scope, cookies or exceptions
            // are logged. All planner diagnostics stay behind the projection.
            if ((resolveBusinessDecision || req.query?.presentation === 'settlement') &&
                error?.code !== 'INVALID_TEAM_SCOPE') {
                const stale = error?.statusCode === 409;
                const reference = stale ? 'ΙΣΤ-ΕΠΙΛ-02' : 'ΙΣΤ-ΑΥΤ-3Τ';
                return res.status(stale ? 409 : 500).json({ success:false, code:reference,
                    message: (stale ? 'Η επιχειρησιακή επιλογή δεν επιβεβαιώθηκε με τα διαθέσιμα στοιχεία. Ο επανέλεγχος σταμάτησε επειδή η πρόταση μπορεί να έχει αλλάξει ή η απάντηση δεν ολοκληρώνει με ασφάλεια την περίοδο.' :
                        'Ο έλεγχος του Ιστορικού σταμάτησε επειδή δεν ολοκληρώθηκε η φόρτωση ή η επαλήθευση της προεπισκόπησης.') +
                        ' Δεν αποθηκεύτηκε καμία αλλαγή.\n1. Ανοίξτε ξανά τον έλεγχο του Ιστορικού και επαναλάβετε τις επιλογές σας.\n2. Αν το πρόβλημα παραμένει, επικοινωνήστε με τον διαχειριστή και συνεχίστε τις ανεξάρτητες εργασίες.\nΚωδικός αναφοράς: ' + reference + '.' });
            }
            return fail(error?.code === 'INVALID_TEAM_SCOPE' ? 403 : error?.statusCode === 409 ? 409 : 500,
                'Δεν ήταν δυνατό να φορτωθούν και να ελεγχθούν με ασφάλεια τα στοιχεία.', 'ΙΣΤ-ΠΡΟΕΠ-04');
        }
    };
}
module.exports = { createEmployeeHistoryReconstructionPreviewController,
    employeeHistoryReconstructionPreview: createEmployeeHistoryReconstructionPreviewController() };
