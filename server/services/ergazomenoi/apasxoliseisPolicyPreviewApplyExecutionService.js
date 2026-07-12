const {
    validateSessionScope
} = require('./apasxoliseisPolicyPreviewApprovalService');
const {
    validateApplyPlanFilters,
    runPolicyPreviewApplyPlan
} = require('./apasxoliseisPolicyPreviewApplyPlanService');

const APPLY_EXECUTION_STATUS = 'LOCKED';
const APPLY_EXECUTION_ALLOWED_ROLES = Object.freeze(['A', 'S']);
const APPLY_EXECUTION_LOCKED_MESSAGE =
    'Η πραγματική εφαρμογή προτεινόμενων τιμών είναι απενεργοποιημένη σε αυτό το στάδιο.';

function executionError(message, statusCode, code) {
    const error = new Error(message);
    error.statusCode = statusCode;
    error.code = code;
    return error;
}

function validateApplyExecutionInput(filters = {}) {
    try {
        return validateApplyPlanFilters(filters);
    } catch (error) {
        if (!error.code) error.code = 'INVALID_FILTERS';
        throw error;
    }
}

function assertApplyExecutionPermission(session = {}) {
    let scope;
    try {
        scope = validateSessionScope(session);
    } catch (error) {
        if (!error.code) error.code = 'NOT_AUTHORIZED';
        throw error;
    }

    if (!APPLY_EXECUTION_ALLOWED_ROLES.includes(scope.created_by_user_role)) {
        throw executionError(
            'Δεν έχετε δικαίωμα πρόσβασης στην εκτέλεση εφαρμογής προτεινόμενων τιμών.',
            403,
            'NOT_AUTHORIZED'
        );
    }

    return scope;
}

function buildLockedApplyExecutionResult(applyPlan = {}) {
    const planSummary = applyPlan.plan_summary || {};
    const noApplyablePlan = ['EMPTY', 'BLOCKED'].includes(planSummary.plan_status);
    const fieldsApplyable = Number(planSummary.fields_applyable);
    const wouldApplyFields = Number.isFinite(fieldsApplyable) && fieldsApplyable > 0
        ? fieldsApplyable
        : 0;

    return {
        execution_enabled: false,
        execution_status: APPLY_EXECUTION_STATUS,
        message: APPLY_EXECUTION_LOCKED_MESSAGE,
        scope: applyPlan.scope || {},
        dry_run_summary: applyPlan.dry_run_summary || {},
        plan_summary: planSummary,
        execution_summary: {
            execution_status: APPLY_EXECUTION_STATUS,
            would_apply_fields: wouldApplyFields,
            blocked_code: noApplyablePlan ? 'NO_APPLYABLE_PLAN' : 'LOCKED',
            blocked_reason: noApplyablePlan
                ? 'Δεν υπάρχει εφαρμόσιμο πλάνο για εκτέλεση.'
                : 'Η εκτέλεση εφαρμογής δεν έχει ενεργοποιηθεί ακόμα.',
            writes_performed: 0
        },
        approvals: Array.isArray(applyPlan.approvals) ? applyPlan.approvals : []
    };
}

async function runPolicyPreviewApplyExecutionLocked({
    session,
    filters,
    applyPlanRunner = runPolicyPreviewApplyPlan
}) {
    assertApplyExecutionPermission(session);
    validateApplyExecutionInput(filters);

    const applyPlan = await applyPlanRunner({ session, filters });
    return buildLockedApplyExecutionResult(applyPlan);
}

module.exports = {
    APPLY_EXECUTION_STATUS,
    APPLY_EXECUTION_ALLOWED_ROLES,
    APPLY_EXECUTION_LOCKED_MESSAGE,
    validateApplyExecutionInput,
    assertApplyExecutionPermission,
    buildLockedApplyExecutionResult,
    runPolicyPreviewApplyExecutionLocked
};
