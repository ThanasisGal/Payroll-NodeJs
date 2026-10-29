'use strict';
const A = require('./employeeHistoryAutomaticReconstructionApplyContract');
const { classifyEmployeeHistoryResolutionCapability } = require('./employeeHistoryResolutionCapabilityService');
const { resolveEmployeeHistoryBusinessFacts } = require('./employeeHistoryBusinessFactResolutionPlannerService');
function assessEmployeeHistorySpecialFacts(input, decision) {
    const fail = () => { throw Object.assign(Error('EMPLOYEE_HISTORY_SPECIAL_FACT_INVALID'),
        { code: 'EMPLOYEE_HISTORY_SPECIAL_FACT_INVALID', statusCode: 409 }); };
    if (!decision || Array.isArray(decision) || !A.equal(Object.keys(decision), ['facts'])) fail();
    const plannerResult = classifyEmployeeHistoryResolutionCapability({ ...input,
        asOfDate: new Date().toISOString().slice(0, 10) }).businessFactPlan;
    if (plannerResult?.status !== 'APPLICABLE') fail();
    const execution = resolveEmployeeHistoryBusinessFacts({ ...input, plannerResult, answers: decision.facts });
    const changedCurrentFields = Object.keys(execution.currentPatch).filter(field =>
        !A.equal(input.currentEmployee[field], execution.currentPatch[field]));
    // Existing settlement has a deliberately empty Employee patch. Do not route
    // lifecycle/pay decisions around that boundary or manufacture a new writer.
    return { status: 'ADMIN_REQUIRED', executionEnabled: false,
        reason: changedCurrentFields.length ? 'CURRENT_STATE_CHANGE_REQUIRES_LIFECYCLE_BOUNDARY' : 'SPECIAL_FACT_WRITE_NOT_ENABLED',
        changedCurrentFields, canonicalStatus: execution.hypotheticalCanonicalResult.status };
}
module.exports = { assessEmployeeHistorySpecialFacts };
