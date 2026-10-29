'use strict';

const { planEmployeeHistoryAutomaticSettlement } = require('./employeeHistoryAutomaticReconstructionPlannerService');
const { classifyEmployeeHistoryResolutionCapability } = require('./employeeHistoryResolutionCapabilityService');
const { formatValue } = require('./employeeHistoryReconstructionPreviewService');
const labels = require('../../../public/js/ergazomenoi/genika/employeeHistoryFieldLabels');

// Presentation only: no physical plans, identities or approval capabilities leave this boundary.
function buildEmployeeHistorySettlementPreview(input, catalogs = {}, { simpleDecisionsOnly = false } = {}) {
    const plan = planEmployeeHistoryAutomaticSettlement(input);
    const result = { state: 'unknown', previewOnly: true, questions: [], assumptions: [], actions: [] };
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
        if (plan.redundantRows.length) result.actions.push(`Συνδυασμός ${plan.redundantRows.length} πλεοναζουσών εγγραφών. Οι εγγραφές με συνδεδεμένα στοιχεία διατηρούνται για την προστασία τους.`);
        return result;
    }
    // Ask only established factual questions. Approved assumptions never become questions.
    if (input.businessDecision !== undefined) return result;
    if (plan.reason !== 'RECONSTRUCTION_REQUIRES_BUSINESS_CONFIRMATION') return result;
    const capability = classifyEmployeeHistoryResolutionCapability(input);
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
