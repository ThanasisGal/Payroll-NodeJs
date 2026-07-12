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

function normalizeApplyableFieldValue(field = {}) {
    const fieldName = String(field.field || '').trim();

    if (
        field.plan_action !== 'ALLOW_SET' ||
        !fieldName ||
        field.proposed_value === undefined ||
        field.proposed_value === null
    ) {
        return null;
    }

    return {
        field: fieldName,
        proposed_value: field.proposed_value
    };
}

function buildApplyWriteOperationForItem({ approval = {}, item = {} } = {}) {
    if (!['APPLYABLE', 'PARTIALLY_APPLYABLE'].includes(item.plan_status)) return null;

    const prodhlomenaOrariaId = String(item.prodhlomena_oraria_id || '').trim();
    if (!prodhlomenaOrariaId) return null;

    const fields = (Array.isArray(item.fields) ? item.fields : [])
        .map(normalizeApplyableFieldValue)
        .filter(Boolean);
    if (fields.length === 0) return null;

    const set = {};
    fields.forEach((field) => {
        set[field.field] = field.proposed_value;
    });

    return {
        prodhlomena_oraria_id: prodhlomenaOrariaId,
        employee_kodikos: item.employee_kodikos || '',
        hmeromhnia: item.hmeromhnia || null,
        group_id: approval.group_id || '',
        approval_id: approval.approval_id || '',
        set,
        fields
    };
}

function buildApplyWriteOperationsFromPlan(applyPlan = {}) {
    const operations = [];
    const summary = {
        operations_total: 0,
        fields_total: 0,
        skipped_items: 0,
        skipped_fields: 0
    };

    (Array.isArray(applyPlan.approvals) ? applyPlan.approvals : []).forEach((approval) => {
        const items = Array.isArray(approval.items) ? approval.items : [];
        const approvalEligible = ['APPLYABLE', 'PARTIALLY_APPLYABLE'].includes(
            approval.plan_status
        );

        items.forEach((item) => {
            const itemFields = Array.isArray(item.fields) ? item.fields : [];
            const operation = approvalEligible
                ? buildApplyWriteOperationForItem({ approval, item })
                : null;

            if (!operation) {
                summary.skipped_items++;
                summary.skipped_fields += itemFields.length;
                return;
            }

            operations.push(operation);
            summary.fields_total += operation.fields.length;
            summary.skipped_fields += itemFields.length - operation.fields.length;
        });
    });

    summary.operations_total = operations.length;
    return { operations, summary };
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
        write_operations_preview: buildApplyWriteOperationsFromPlan(applyPlan),
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
    normalizeApplyableFieldValue,
    buildApplyWriteOperationForItem,
    buildApplyWriteOperationsFromPlan,
    buildLockedApplyExecutionResult,
    runPolicyPreviewApplyExecutionLocked
};
