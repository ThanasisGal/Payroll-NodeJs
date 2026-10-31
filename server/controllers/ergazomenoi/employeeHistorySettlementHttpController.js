'use strict';
const mongoose = require('mongoose');
const A = require('../../services/ergazomenoi/employeeHistoryAutomaticReconstructionApplyContract');
const S = require('../../services/ergazomenoi/employeeHistoryAutomaticSettlementPreparationContract');
const U = require('../../services/ergazomenoi/employeeHistoryCoordinatedSettlementContract');
const W = require('../../services/ergazomenoi/employeeEmploymentProfileWriter');
const { settlementContext, getEmployeeHistorySettlementDevHandle } = require('../../services/ergazomenoi/employeeHistorySettlementDevActivation');
const { authorizeEmployeeMaintenance } = require('../../services/ergazomenoi/employeeMaintenanceAuthorizationService');
const { actorAccess } = require('../../services/ergazomenoi/employeeHistoryAutomaticReconstructionApplyService');
const { normalizeRequiredUserTeam } = require('../../services/userTeamScopeService');
const { buildUnifiedEmployeeHistorySettlementPreview: project } = require('../../services/ergazomenoi/employeeHistorySettlementPreviewService');
function readHandle(req){return getEmployeeHistorySettlementDevHandle(req) || require('../../services/ergazomenoi/employeeHistorySettlementIsolatedTestPolicy').getReadHandle(req);}
function applyHandle(req){return getEmployeeHistorySettlementDevHandle(req) || require('../../services/ergazomenoi/employeeHistorySettlementIsolatedTestPolicy').getApplyHandle(req);}
function createEmployeeHistorySettlementHttpController({ contextProvider = readHandle,
    applyContextProvider = contextProvider===readHandle?applyHandle:contextProvider,
    readSessionProvider = () => null } = {}) {
    function reject(res, error) {
        const unknown = error?.code === A.PREFIX + 'COMMIT_UNCERTAIN';
        return res.status(unknown ? 503 : error.statusCode || 409).json({ ...(unknown ? { outcome: 'UNKNOWN', retryWithSameApproval: true } : { success: false }),
            code: error.code || 'EMPLOYEE_HISTORY_SETTLEMENT_REJECTED',
            message: unknown ? error.message : 'Η τακτοποίηση του Ιστορικού σταμάτησε επειδή η πρόσβαση ή τα εγκεκριμένα στοιχεία δεν επιβεβαιώθηκαν. Δεν αποθηκεύτηκε καμία αλλαγή.\n1. Ανοίξτε ξανά την προεπισκόπηση στη σωστή εταιρεία και στον σωστό εργαζόμενο.\n2. Αν το πρόβλημα παραμένει, επικοινωνήστε με τον διαχειριστή.\nΚωδικός αναφοράς: ΙΣΤ-ΑΥΤ-HTTP-01.' });
    }
    async function inputFor(req, handle) {
        const actorUserId = req.session?.userId, employeeId = req.params?.id;
        if (!actorUserId) throw Object.assign(Error('UNAUTHENTICATED'), { statusCode: 401 });
        const company = req.session?.companyInUse;
        let team;
        try { team = normalizeRequiredUserTeam(req.session?.userTeam); }
        catch { throw Object.assign(Error('FORBIDDEN'), { statusCode: 403 }); }
        if (![actorUserId, employeeId, company].every(value => typeof value === 'string' && mongoose.isObjectIdOrHexString(value)))
            throw Object.assign(Error('FORBIDDEN'), { statusCode: actorUserId ? 403 : 401 });
        const context = settlementContext(handle), d = context.deps;
        if(context.assertRequest)await context.assertRequest(req);
        const session = readSessionProvider();
        {
            const current = await d.employeeModel.findOne({ _id: employeeId, team, company_kod: company })
                .select('+employee_profile_mutation_sequence').session(session).lean();
            const scope = { team, company_kod: company, kodikos: current?.kodikos };
            if (!current || current.team !== team || current.company_kod !== company || String(current._id) !== employeeId)
                throw Object.assign(Error('FORBIDDEN'), { statusCode: 403 });
            if (!await d.companyModel.findOne({ _id: company, team }).session(session).lean())
                throw Object.assign(Error('FORBIDDEN'), { statusCode: 403 });
            await authorizeEmployeeMaintenance({ actorUserId, employeeId, scope, current, session, userModel: d.userModel, privilegeModel: d.privilegeModel });
            const access = await actorAccess({ actorUserId, scope, session, userModel: d.userModel });
            if (access.mode !== 'ADMIN_FULL') throw Object.assign(Error('FORBIDDEN'), { statusCode: 403 });
            const query = d.historyModel.find(scope); query.mongooseOptions({ includeRedundantHistoryArtifacts: true });
            const rows = await query.select('+history_reference_fence').session(session).lean();
            return { scope, actorUserId, employeeId, currentEmployee: current, completeHistoryRows: rows,
                protectedReferenceSummary: await context.referenceSummary(rows, session) };
        }
    }
    return {
        async preview(req, res) {
            res.set('Cache-Control', 'no-store');
            const handle = contextProvider(req);
            if (!handle) return false;
            try {
                const decision = req.method === 'POST' ? req.body?.businessDecision : undefined;
                if (req.method === 'POST' && (!req.body || !A.equal(Object.keys(req.body), ['businessDecision']))) S.fail('INVALID_REQUEST');
                const input = await inputFor(req, handle), args = { ...input, ...(decision == null ? {} : { businessDecision: decision }) };
                const proposal = U.buildCoordinatedSettlementProposal(args), settlementPreview = project(args);
                const enabled=settlementContext(handle).executionEnabled!==false;
                if (proposal.status === 'CLEAN' && !proposal.noOp && enabled) { delete settlementPreview.limitation; settlementPreview.executionEnabled = true; }
                if(!enabled)settlementPreview.executionEnabled=false;
                return res.json({ success: true, decisionEnabled: true, historyStatus:proposal.status,noOp:proposal.noOp,
                    executionMode: enabled?'CONTROLLED_DEV':'PREVIEW_ONLY', settlementPreview,
                    ...(decision == null ? {} : { businessDecision: decision }),
                    ...(enabled && proposal.status === 'CLEAN' ? { approvalFingerprint: S.buildEmployeeHistorySettlementApprovalFingerprint({ ...args, proposal }) } : {}) });
            } catch (error) { return reject(res, error); }
        },
        async apply(req, res) {
            res.set('Cache-Control', 'no-store');
            const handle = applyContextProvider(req);
            if (!handle) return false;
            let committed = false;
            try {
                if (!req.body || ![['approval'], ['approval','businessDecision']].some(keys => A.equal(Object.keys(req.body).sort(), keys))) S.fail('INVALID_REQUEST');
                const input = await inputFor(req, handle);
                const result = await W.applyEmployeeEmploymentHistorySettlementInSyntheticStore({ syntheticStore: handle,
                    scope: input.scope, actorUserId: input.actorUserId, employeeId: input.employeeId, approval: req.body.approval,
                    coordinated: true, ...(req.body.businessDecision === undefined ? {} : { businessDecision: req.body.businessDecision }) });
                committed = result.applied || result.alreadyApplied;
                const fresh = await inputFor(req, handle), checked = U.buildCoordinatedSettlementProposal(fresh);
                if (checked.status !== 'CLEAN' || !checked.noOp) throw Error('POST_COMMIT_NOT_CLEAN');
                let corrections = { actions: [], assumptions: [] };
                if (committed) {
                    const records = await settlementContext(handle).readAudits(readSessionProvider(), { scope: input.scope, employeeId: input.employeeId });
                    const record = records.find(item => item.diagnostics?.approvalFingerprint === req.body.approval.fingerprint &&
                        item.diagnostics.actorUserId === input.actorUserId && String(item.employeeScope.employee_id) === input.employeeId);
                    if (!record) throw Error('MISSING_COMMITTED_AUDIT');
                    corrections = require('./employeeHistoryAutomaticSettlementSyntheticController').recordedCorrections(record);
                }
                return res.json({ success: true, historyStatus: 'CLEAN', noOp: !result.applied, alreadyApplied: result.alreadyApplied,
                    message: result.applied || result.alreadyApplied ? 'Το Ιστορικό τακτοποιήθηκε επιτυχώς' : 'Το Ιστορικό είναι ήδη τακτοποιημένο.',
                    corrections });
            } catch (error) {
                if (committed) { error = A.failure('COMMIT_UNCERTAIN',503); error.message = 'Η τακτοποίηση καταχωρίστηκε, αλλά δεν ολοκληρώθηκε η επιβεβαίωση στην οθόνη.\n1. Επαναλάβετε με την ίδια έγκριση.\n2. Ζητήστε έλεγχο από τον διαχειριστή αν το αποτέλεσμα παραμένει άγνωστο.\nΚωδικός αναφοράς: ΙΣΤ-ΑΥΤ-HTTP-02.'; }
                return reject(res,error);
            }
        }
    };
}
module.exports = { createEmployeeHistorySettlementHttpController };
