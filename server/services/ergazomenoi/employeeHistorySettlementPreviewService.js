'use strict';

const { planEmployeeHistoryAutomaticSettlement, verifyEmployeeHistoryAutomaticSettlement } = require('./employeeHistoryAutomaticReconstructionPlannerService');
const { classifyEmployeeHistoryResolutionCapability } = require('./employeeHistoryResolutionCapabilityService');
const { calculateCanonicalDiff } = require('./employeeHistoryCanonicalizationService');
const { partitionHistoryUpdateReferences } = require('./employeeHistoryReferenceSemanticsService');
const { formatValue } = require('./employeeHistoryReconstructionPreviewService');
const labels = require('../../../public/js/ergazomenoi/genika/employeeHistoryFieldLabels');

// Adapt only an independently verified, identity-preserving proposal. This is
// presentation data; it must never become an execution/approval capability.
function verifiedUniquePlan(input, unique) {
    if (unique?.status !== 'APPLICABLE' || !Array.isArray(unique.physicalDeleteIds) ||
        !Array.isArray(unique.insertedRows) || !Array.isArray(unique.desiredHistoryRows) ||
        !unique.currentPatch || Array.isArray(unique.currentPatch) ||
        unique.physicalDeleteIds.length || unique.insertedRows.length ||
        Object.keys(unique.currentPatch).some(field => field !== 'hmeromhnia_isxyos_oron_ergasias_eos')) return null;
    for (const row of input.completeHistoryRows) {
        const references = input.protectedReferenceSummary?.[String(row._id)];
        if (!Array.isArray(references) || references.some(reference => !reference ||
            reference.historyId != null && String(reference.historyId) !== String(row._id))) return null;
        try { if (partitionHistoryUpdateReferences(references).liveDereference.length) return null; }
        catch { return null; }
    }
    const currentEmployee = { ...input.currentEmployee, ...unique.currentPatch };
    const verification = verifyEmployeeHistoryAutomaticSettlement({ ...input, currentEmployee,
        proposedRows: unique.desiredHistoryRows, requiredHistoryRows: input.completeHistoryRows });
    if (verification.status !== 'CLEAN') return null;
    const diff = calculateCanonicalDiff(input.completeHistoryRows, unique.desiredHistoryRows);
    if (diff.rowsToDelete.length || diff.rowsToInsert.length || diff.rowsToUpdate.some(change =>
        Object.keys(change.patch).some(field => !labels[field] &&
            !['employment_history_canonical_status', 'employment_history_canonical_survivor_id'].includes(field)))) return null;
    return { status: 'CLEAN', verification, noOp: false, fieldChanges: diff.rowsToUpdate,
        currentPatch: unique.currentPatch,
        redundantRows: diff.rowsToUpdate.filter(change => change.patch.employment_history_canonical_status === 'REDUNDANT_REFERENCED'),
        assumptions: [{ businessRationale: 'Η υπάρχουσα μοναδική ασφαλής πρόταση επαληθεύτηκε ανεξάρτητα για ολόκληρο το Ιστορικό.' }] };
}

// Presentation only: no physical plans, identities or approval capabilities leave this boundary.
function buildEmployeeHistorySettlementPreview(input, catalogs = {}, { simpleDecisionsOnly = false } = {}) {
    let plan = planEmployeeHistoryAutomaticSettlement(input);
    const result = { state: 'unknown', previewOnly: true, questions: [], assumptions: [], actions: [] };
    let capability;
    if (plan.status !== 'CLEAN' && input.businessDecision === undefined) {
        capability = classifyEmployeeHistoryResolutionCapability(input);
        if (capability.uniquePlan?.status === 'APPLICABLE') {
            const verified = verifiedUniquePlan(input, capability.uniquePlan);
            if (!verified) return { ...result, reviewRequired: true };
            plan = verified;
            result.executionEnabled = false;
        }
    }
    if (plan.status === 'CLEAN' && plan.verification?.status === 'CLEAN') {
        result.state = plan.noOp ? 'clean' : 'automatic';
        result.assumptions = [...new Set(plan.assumptions.map(item => item.businessRationale))];
        const rows = new Map(input.completeHistoryRows.map(row => [String(row._id), row]));
        for (const change of plan.fieldChanges) {
            const row = rows.get(change.historyId);
            for (const [field, value] of Object.entries(change.patch)) {
                if (!labels[field]) continue;
                result.actions.push(`Εγγραφή ${row?.aa_eggrafhs || 'χωρίς αρίθμηση'} — ${labels[field]}: ${formatValue(field, row?.[field], catalogs, row)} → ${formatValue(field, value, catalogs, row)}`);
            }
        }
        for (const [field, value] of Object.entries(plan.currentPatch || {})) {
            result.actions.push(`Ισχύοντα στοιχεία — ${labels[field]}: ${formatValue(field, input.currentEmployee[field], catalogs, input.currentEmployee)} → ${formatValue(field, value, catalogs, input.currentEmployee)}`);
        }
        if (plan.redundantRows.length) result.actions.push(`Συνδυασμός ${plan.redundantRows.length} πλεοναζουσών εγγραφών. Οι εγγραφές με συνδεδεμένα στοιχεία διατηρούνται για την προστασία τους.`);
        return result;
    }
    // Ask only established factual questions. Approved assumptions never become questions.
    if (input.businessDecision !== undefined) return result;
    if (plan.reason !== 'RECONSTRUCTION_REQUIRES_BUSINESS_CONFIRMATION') return result;
    capability ||= classifyEmployeeHistoryResolutionCapability(input);
    if (capability.multiplePlan?.status === 'APPLICABLE') {
        if (simpleDecisionsOnly && capability.multiplePlan.shapeKind !== 'SAME_PERIOD_PROFILE_ALTERNATIVES') return result;
        result.questions = [{ id: 'businessChoice', type: 'SINGLE_CHOICE',
            label: 'Τι ίσχυε πραγματικά στην αμφίβολη περίοδο;', required: true,
            options: capability.multiplePlan.businessOptions.map(({ id, label, description, inputs }) =>
                ({ id, label, description, ...(inputs ? { inputs: inputs.map(({ id, type, label, required, min, max }) =>
                    ({ id, type, label, required, min, max })) } : {}) })) }];
    } else if (!simpleDecisionsOnly && capability.businessFactPlan?.status === 'APPLICABLE') {
        result.questions = capability.businessFactPlan.factQuestions.map(({ id, type, label, required, min, max, condition, options }) =>
            ({ id, type, label, required, ...(min ? { min } : {}), ...(max ? { max } : {}),
                ...(condition ? { condition: { questionId: condition.questionId, equals: condition.equals } } : {}),
                ...(options ? { options: options.map(({ id, label }) => ({ id, label })) } : {}) }));
    }
    if (result.questions.length) result.state = 'decision';
    return result;
}
module.exports = { buildEmployeeHistorySettlementPreview };
