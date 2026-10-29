'use strict';

const mongoose = require('mongoose');
const { findHistoryIdReferences } = require('../../services/ergazomenoi/employeeHistoryReferenceAuditService');
const { buildEmployeeHistorySettlementPreview } = require('../../services/ergazomenoi/employeeHistorySettlementPreviewService');
const { buildEmployeeHistoryPeriodSplitProposal, projectEmployeeHistoryPeriodSplitProposal } =
    require('../../services/ergazomenoi/employeeHistoryPeriodSplitPreviewService');
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
            const employee = await employeeModel.findOne({ _id: req.params.id, team, company_kod: company }).lean();
            if (!employee || employee.team !== team || employee.company_kod !== company || typeof employee.kodikos !== 'string') {
                return fail(404, 'Δεν βρέθηκε εργαζόμενος στην επιλεγμένη εταιρεία με την πρόσβασή σας.', 'ΙΣΤ-ΠΡΟΕΠ-03');
            }
            const scope = { team, company_kod: company, kodikos: employee.kodikos };
            const query = historyModel.find(scope);
            query.mongooseOptions({ includeRedundantHistoryArtifacts: true });
            const history = await query.lean();
            if (resolveBusinessDecision || req.query?.presentation === 'settlement') {
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
                let choices;
                if (businessDecision !== null) {
                    // Validate the recorded choice before projecting whole-period
                    // terms or a split. Browser facts and physical plans are refused.
                    require('../../services/ergazomenoi/employeeHistorySettlementDecisionService')
                        .resolveSettlementDecision(input, businessDecision);
                    const initial = settlementProject(input, catalogs, { simpleDecisionsOnly: true });
                    choices = initial.questions.flatMap(question => question.options || [])
                        .filter(option => option.id === businessDecision.choiceId).map(option => option.label);
                    input.businessDecision = businessDecision;
                }
                const splitProposal = businessDecision === null ? null
                    : buildEmployeeHistoryPeriodSplitProposal(input, businessDecision);
                const settlementPreview = splitProposal ? projectEmployeeHistoryPeriodSplitProposal(splitProposal)
                    : settlementProject(input, catalogs, { simpleDecisionsOnly: true });
                if (choices) settlementPreview.choices = choices;
                // Only recorded choices without custom dates belong to this form.
                // Special departures and custom facts keep their administrator boundary.
                const supportedDecision = settlementPreview.state !== 'decision' ||
                    settlementPreview.questions.length === 1 &&
                    settlementPreview.questions[0].id === 'businessChoice' &&
                    settlementPreview.questions[0].options.every(option => !option.inputs?.length);
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
            return fail(error?.code === 'INVALID_TEAM_SCOPE' ? 403 : error?.statusCode === 409 ? 409 : 500,
                'Δεν ήταν δυνατό να φορτωθούν και να ελεγχθούν με ασφάλεια τα στοιχεία.', 'ΙΣΤ-ΠΡΟΕΠ-04');
        }
    };
}
module.exports = { createEmployeeHistoryReconstructionPreviewController,
    employeeHistoryReconstructionPreview: createEmployeeHistoryReconstructionPreviewController() };
