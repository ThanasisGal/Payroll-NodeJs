'use strict';

// Phase 3B integration seam. Deliberately NOT registered in usersRoute.
// Only an in-memory capability can construct these handlers; no model/connection
// overrides, environment switch or production fallback exists.
const { memorySettlementContext } = require('../../../test/fixtures/employeeHistorySettlementSyntheticStore');
const { applyEmployeeEmploymentHistorySettlementInSyntheticStore: apply } = require('../../services/ergazomenoi/employeeEmploymentProfileWriter');
const { authorizeEmployeeMaintenance } = require('../../services/ergazomenoi/employeeMaintenanceAuthorizationService');
const { actorAccess } = require('../../services/ergazomenoi/employeeHistoryAutomaticReconstructionApplyService');
const { planEmployeeHistoryAutomaticSettlement: plan } = require('../../services/ergazomenoi/employeeHistoryAutomaticReconstructionPlannerService');
const { buildEmployeeHistorySettlementPreview: project } = require('../../services/ergazomenoi/employeeHistorySettlementPreviewService');
const S = require('../../services/ergazomenoi/employeeHistoryAutomaticSettlementPreparationContract');
const A = require('../../services/ergazomenoi/employeeHistoryAutomaticReconstructionApplyContract');
const { formatValue } = require('../../services/ergazomenoi/employeeHistoryReconstructionPreviewService');
const labels = require('../../../public/js/ergazomenoi/genika/employeeHistoryFieldLabels');
const { classifyEmployeeHistoryResolutionCapability } = require('../../services/ergazomenoi/employeeHistoryResolutionCapabilityService');
const { buildEmployeeHistoryPeriodSplitProposal: splitProposal,
    projectEmployeeHistoryPeriodSplitProposal: splitProject,
    hasEmployeeHistoryPeriodSplitChoices } = require('../../services/ergazomenoi/employeeHistoryPeriodSplitPreviewService');

function splitResponse(input, businessDecision) {
    const proposal = splitProposal(input, businessDecision);
    if (!proposal) return null;
    const approvalFingerprint = S.buildEmployeeHistorySettlementApprovalFingerprint({ ...input, proposal,
        ...(businessDecision === undefined ? {} : { businessDecision }) });
    return { success: true, decisionEnabled: true, executionMode: 'SYNTHETIC_ONLY', approvalFingerprint,
        ...(businessDecision === undefined ? {} : { businessDecision }),
        proposalFingerprint: proposal.proposalFingerprint, settlementPreview: { ...splitProject(proposal), state: 'automatic', executionEnabled: true } };
}

function selectedChoiceLabel(input, decision) {
    if (!decision) return [];
    const capability = classifyEmployeeHistoryResolutionCapability(input);
    const label = capability.multiplePlan?.businessOptions.find(option => option.id === decision.choiceId)?.label;
    return label ? [label] : [];
}
function initialPresentation(input) {
    const preview = project(input);
    // Factual answers requiring Employee changes/custom dates are outside this slice.
    if (preview.state === 'decision' && (preview.questions.some(question => question.id !== 'businessChoice') ||
        !hasEmployeeHistoryPeriodSplitChoices(input) && !preview.questions[0].options.some(option => {
            if (option.inputs?.length) return false;
            try { return plan({ ...input, businessDecision: { choiceId: option.id } }).status === 'CLEAN'; }
            catch { return false; }
        }))) {
        return { ...preview, state: 'unknown', questions: [], actions: [], assumptions: [] };
    }
    return preview;
}

function recordedCorrections(record) {
    if (!record) return { actions: [], assumptions: [] };
    const before = new Map(record.diagnostics.historyBefore.map(row => [String(row._id), row]));
    const actions = [];
    for (const row of record.diagnostics.historyAfter) {
        const old = before.get(String(row._id));
        if (!old) {
            actions.push(`Δημιουργήθηκε η εγγραφή ${row.aa_eggrafhs}: ${formatValue('hmeromhnia_isxyos_oron_ergasias_apo', row.hmeromhnia_isxyos_oron_ergasias_apo)}–${formatValue('hmeromhnia_isxyos_oron_ergasias_eos', row.hmeromhnia_isxyos_oron_ergasias_eos)}, ${row.hmeres_ergasias_ebdomadas} ημέρες / ${row.ores_ergasias_ebdomadas} ώρες την εβδομάδα.`);
            if (record.diagnostics.resolutionKind === 'CORRECTED_DUPLICATE') actions.push(`Καταγεγραμμένες αποδοχές της εγγραφής ${row.aa_eggrafhs}: ${new Intl.NumberFormat('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(row.synolo_symbashs)} €.`);
            continue;
        }
        for (const field of Object.keys(labels)) {
            if (!A.equal(old?.[field], row[field])) actions.push(`Εγγραφή ${row.aa_eggrafhs || 'χωρίς αρίθμηση'} — ${labels[field]}: ${formatValue(field, old?.[field], {}, old)} → ${formatValue(field, row[field], {}, row)}`);
        }
        if (old?.employment_history_canonical_status !== row.employment_history_canonical_status &&
            row.employment_history_canonical_status === 'REDUNDANT_REFERENCED') {
            actions.push(`Η πλεονάζουσα εγγραφή ${row.aa_eggrafhs || 'χωρίς αρίθμηση'} διατηρήθηκε με τις ιστορικές αναφορές της και εξαιρέθηκε από το ενεργό Ιστορικό.`);
        }
    }
    return { actions, assumptions: [...new Set(record.diagnostics.assumptions.map(item => item.businessRationale))],
        choices: selectedChoiceLabel({ scope: record.employeeScope, currentEmployee: record.currentBefore,
            completeHistoryRows: record.diagnostics.historyBefore,
            protectedReferenceSummary: record.diagnostics.protectedReferences }, record.diagnostics.businessDecision) };
}

function createEmployeeHistoryAutomaticSettlementSyntheticController({ syntheticStore } = {}) {
    const context = memorySettlementContext(syntheticStore);
    const reviewedDecisions = new Map();
    const decisionKey = input => `${input.actorUserId}:${input.employeeId}`;
    async function trustedInput(req) {
        const actorUserId = req.session?.userId;
        const snapshot = context.readHttpSnapshot(actorUserId);
        const input = snapshot.input;
        if (!actorUserId || req.params.id !== input.employeeId ||
            req.session.companyInUse !== input.scope.company_kod || req.session.userTeam !== input.scope.team) {
            throw Object.assign(Error('FORBIDDEN'), { statusCode: 403 });
        }
        const session = { syntheticActor: snapshot.actor, syntheticPermission: snapshot.permission };
        await authorizeEmployeeMaintenance({ actorUserId, scope: input.scope, employeeId: input.employeeId,
            current: input.currentEmployee, session, userModel: context.deps.userModel,
            privilegeModel: context.deps.privilegeModel });
        await actorAccess({ actorUserId, scope: input.scope, session, userModel: context.deps.userModel });
        return input;
    }
    function rejected(res, error) {
        const code = error?.code || 'EMPLOYEE_HISTORY_SETTLEMENT_REJECTED';
        if (code === A.PREFIX + 'COMMIT_UNCERTAIN') return res.status(503).json({ outcome: 'UNKNOWN', code,
            retryWithSameApproval: true, message: error.message });
        return res.status(error?.statusCode || 409).json({ success: false, code,
            message: 'Η τακτοποίηση του Ιστορικού σταμάτησε επειδή δεν επιβεβαιώθηκαν η πρόσβαση ή τα εγκεκριμένα στοιχεία. Δεν αποθηκεύτηκε καμία αλλαγή.\n1. Ανοίξτε ξανά την προεπισκόπηση και ελέγξτε τα στοιχεία.\n2. Αν δεν υπάρχει ασφαλής πρόταση, επικοινωνήστε με τον διαχειριστή και συνεχίστε τις ανεξάρτητες λειτουργίες.\nΚωδικός αναφοράς: ΙΣΤ-ΑΥΤ-3Β.' });
    }
    return {
        async resolve(req, res) {
            res.set('Cache-Control', 'no-store');
            try {
                if (!req.body || !A.equal(Object.keys(req.body), ['businessDecision'])) S.fail('INVALID_REQUEST');
                const input = await trustedInput(req);
                reviewedDecisions.delete(decisionKey(input));
                if (req.body.businessDecision === null) {
                    const resetSplit = splitResponse(input);
                    if (resetSplit) reviewedDecisions.set(decisionKey(input), { split: true, approvalFingerprint: resetSplit.approvalFingerprint });
                    return res.json(resetSplit || { success: true, decisionEnabled: true, settlementPreview: initialPresentation(input) });
                }
                const businessDecision = req.body.businessDecision;
                if (businessDecision && Object.hasOwn(businessDecision, 'facts')) {
                    require('../../services/ergazomenoi/employeeHistorySpecialFactBoundaryService')
                        .assessEmployeeHistorySpecialFacts(input, businessDecision);
                    return res.json({ success: true, settlementPreview: { state: 'unknown', previewOnly: true,
                        questions: [], assumptions: [], actions: [] } });
                }
                const split = splitResponse(input, businessDecision);
                if (split) {
                    reviewedDecisions.set(decisionKey(input), { split: true, businessDecision: S.clone(businessDecision), approvalFingerprint: split.approvalFingerprint });
                    return res.json(split);
                }
                const proposal = plan({ ...input, businessDecision });
                const settlementPreview = project({ ...input, businessDecision });
                settlementPreview.choices = selectedChoiceLabel(input, businessDecision);
                if (proposal.status !== 'CLEAN') return res.json({ success: true, decisionEnabled: true, settlementPreview });
                const approvalFingerprint = S.buildEmployeeHistorySettlementApprovalFingerprint({ ...input, proposal, businessDecision });
                reviewedDecisions.set(decisionKey(input), { businessDecision: S.clone(businessDecision), approvalFingerprint });
                return res.json({ success: true, executionMode: 'SYNTHETIC_ONLY', decisionEnabled: true,
                    settlementPreview, approvalFingerprint, businessDecision });
            } catch (error) { return rejected(res, error); }
        },
        async preview(req, res) {
            res.set('Cache-Control', 'no-store');
            try {
                const input = await trustedInput(req), proposal = plan(input);
                const settledSplit = context.readHttpSnapshot(input.actorUserId).audits.some(record =>
                    record.diagnostics?.settlementKind === 'PERIOD_SPLIT' &&
                    String(record.employeeScope.employee_id) === input.employeeId &&
                    record.diagnostics.stateAfterHash === A.hash({ scope: input.scope, employeeId: input.employeeId,
                        actorUserId: record.diagnostics.actorUserId, current: input.currentEmployee,
                        history: A.ordered(input.completeHistoryRows), references: input.protectedReferenceSummary }));
                if (settledSplit && require('../../services/ergazomenoi/employeeHistoryAutomaticReconstructionPlannerService')
                    .verifyEmployeeHistoryAutomaticSettlement({ ...input, proposedRows: input.completeHistoryRows }).status === 'CLEAN') {
                    return res.json({ success: true, settlementPreview: { state: 'clean', previewOnly: true,
                        questions: [], assumptions: [], actions: [] } });
                }
                const split = splitResponse(input);
                if (split) {
                    reviewedDecisions.set(decisionKey(input), { split: true, approvalFingerprint: split.approvalFingerprint });
                    return res.json(split);
                }
                const settlementPreview = initialPresentation(input);
                return res.json({ success: true, settlementPreview, decisionEnabled: true,
                    ...(settlementPreview.state === 'automatic' ? { executionMode: 'SYNTHETIC_ONLY',
                        approvalFingerprint: S.buildEmployeeHistorySettlementApprovalFingerprint({ ...input, proposal }) } : {}) });
            } catch (error) { return rejected(res, error); }
        },
        async apply(req, res) {
            res.set('Cache-Control', 'no-store');
            let commitConfirmed = false;
            try {
                // Business choices and proposed mutations cannot become write instructions.
                // The existing writer supports only its server-rebuilt CLEAN proposal.
                if (!req.body || ![ ['approval'], ['approval', 'businessDecision'] ]
                    .some(keys => A.equal(Object.keys(req.body).sort(), keys))) S.fail('INVALID_REQUEST');
                const input = await trustedInput(req);
                const businessDecision = req.body.businessDecision;
                const reviewed = reviewedDecisions.get(decisionKey(input));
                if (businessDecision !== undefined || reviewed?.split) {
                    if (!reviewed || !A.equal(reviewed.businessDecision, businessDecision) ||
                        reviewed.approvalFingerprint !== req.body.approval?.fingerprint) S.fail('STALE');
                }
                const result = await apply({ syntheticStore, scope: input.scope, employeeId: input.employeeId,
                    actorUserId: input.actorUserId, approval: req.body.approval,
                    ...(businessDecision === undefined ? {} : { businessDecision }) });
                commitConfirmed = true;
                if (result.historyStatus !== 'CLEAN') throw Error('UNVERIFIED_RESULT');
                const snapshot = context.readHttpSnapshot(input.actorUserId);
                const record = snapshot.audits.find(item => item.diagnostics?.approvalFingerprint === req.body.approval.fingerprint &&
                    item.diagnostics.actorUserId === input.actorUserId && String(item.employeeScope.employee_id) === input.employeeId);
                if (!record) throw Error('MISSING_COMMITTED_AUDIT');
                return res.json({ success: true, historyStatus: 'CLEAN', alreadyApplied: result.alreadyApplied === true,
                    message: 'Το Ιστορικό τακτοποιήθηκε επιτυχώς', corrections: recordedCorrections(record) });
            } catch (error) {
                // A response/report failure after the writer returned must never claim rollback.
                if (commitConfirmed) return res.status(503).json({ outcome: 'UNKNOWN', retryWithSameApproval: true,
                    code: A.PREFIX + 'COMMIT_UNCERTAIN', message: 'Η τακτοποίηση καταχωρίστηκε, αλλά δεν ολοκληρώθηκε η επιβεβαίωση στην οθόνη.\n1. Επαναλάβετε με την ίδια έγκριση.\n2. Αν χρειάζεται, επικοινωνήστε με τον διαχειριστή.\nΚωδικός αναφοράς: ΙΣΤ-ΑΥΤ-3Β-ΑΒ.' });
                return rejected(res, error);
            }
        }
    };
}
module.exports = { createEmployeeHistoryAutomaticSettlementSyntheticController };
