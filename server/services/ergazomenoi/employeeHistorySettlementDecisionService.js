'use strict';
const A = require('./employeeHistoryAutomaticReconstructionApplyContract');
const { classifyEmployeeHistoryResolutionCapability } = require('./employeeHistoryResolutionCapabilityService');
const { resolveEmployeeHistoryMultipleSafeChoice } = require('./employeeHistoryMultipleSafeResolutionPlannerService');

// Pure adapter over the existing business resolver. It never accepts fields,
// dates or mutation plans. This first slice supports recorded whole-period choices.
function resolveSettlementDecision(input, decision) {
    const fail = () => { throw Object.assign(Error('Unsupported business decision'),
        { code: 'EMPLOYEE_HISTORY_SETTLEMENT_DECISION_INVALID', statusCode: 409 }); };
    if (!decision || Array.isArray(decision) || !A.equal(Object.keys(decision), ['choiceId']) ||
        typeof decision.choiceId !== 'string') fail();
    const capability = classifyEmployeeHistoryResolutionCapability(input);
    const plannerResult = capability.multiplePlan;
    const option = plannerResult?.businessOptions.find(item => item.id === decision.choiceId);
    if (plannerResult?.status !== 'APPLICABLE' || plannerResult.shapeKind !== 'SAME_PERIOD_PROFILE_ALTERNATIVES' ||
        !option || option.inputs?.length) fail();
    const execution = resolveEmployeeHistoryMultipleSafeChoice({ ...input, plannerResult, choiceId: option.id });
    if (Object.keys(execution.currentPatch).length || execution.physicalDeleteIds.length || execution.insertedRows.length) fail();
    return { execution, optionSetFingerprint: plannerResult.optionSetFingerprint };
}
module.exports = { resolveSettlementDecision };
