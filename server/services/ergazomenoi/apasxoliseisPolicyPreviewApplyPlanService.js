const mongoose = require('mongoose');

const {
    APPLY_DRY_RUN_DECISION_TYPE,
    APPLY_DRY_RUN_FIELD_DEFINITIONS,
    validateApplyDryRunFilters,
    runPolicyPreviewApplyDryRun
} = require('./apasxoliseisPolicyPreviewApplyDryRunService');

const BLOCK_REASONS = Object.freeze({
    UNSUPPORTED_FIELD: 'Το πεδίο δεν υποστηρίζεται για εφαρμογή.',
    MISSING_RECORD: 'Η εγγραφή προδηλωμένου ωραρίου δεν βρέθηκε.',
    INVALID_RECORD_ID: 'Δεν υπάρχει έγκυρο ID εγγραφής προδηλωμένου ωραρίου.',
    MISSING_PROPOSED_VALUES: 'Δεν υπάρχουν προτεινόμενες τιμές για εφαρμογή.',
    MISSING_FIELD_DIFFS: 'Δεν υπάρχουν αποτελέσματα πεδίων από το dry-run για επικύρωση.',
    DRY_RUN_SKIPPED: 'Το πεδίο παραλείφθηκε στο dry-run.',
    CURRENT_VALUE_NOT_VALIDATED: 'Η τρέχουσα τιμή δεν έχει επιβεβαιωθεί από το dry-run.',
    APPROVAL_NOT_ELIGIBLE: 'Το approval δεν είναι εγκεκριμένη πρόταση για εφαρμογή.'
});

function asObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function uniqueReasons(reasons) {
    return [...new Set(reasons.filter(Boolean))];
}

function validateApplyPlanFilters(filters = {}) {
    return validateApplyDryRunFilters(filters);
}

function validateDryRunFieldDiffForApply(fieldDiff = {}, item = {}) {
    const definition = APPLY_DRY_RUN_FIELD_DEFINITIONS[fieldDiff.field];
    const base = {
        field: fieldDiff.field || '',
        label: fieldDiff.label || definition?.label || fieldDiff.field || '',
        current_value: fieldDiff.current_value ?? null,
        proposed_value: fieldDiff.proposed_value ?? null
    };

    if (fieldDiff.action === 'ALREADY_SAME') {
        return { ...base, plan_action: 'NOOP', block_reason: null };
    }
    if (!definition) {
        return { ...base, plan_action: 'BLOCKED', block_reason: BLOCK_REASONS.UNSUPPORTED_FIELD };
    }
    if (fieldDiff.action === 'SKIPPED') {
        return { ...base, plan_action: 'BLOCKED', block_reason: BLOCK_REASONS.DRY_RUN_SKIPPED };
    }
    if (fieldDiff.action !== 'WOULD_SET' || item.status !== 'WOULD_CHANGE') {
        return {
            ...base,
            plan_action: 'BLOCKED',
            block_reason: BLOCK_REASONS.CURRENT_VALUE_NOT_VALIDATED
        };
    }

    return { ...base, plan_action: 'ALLOW_SET', block_reason: null };
}

function inferItemBlockReasons(item) {
    const reasons = [];
    const id = String(item.prodhlomena_oraria_id || '').trim();
    if (!id || !mongoose.isValidObjectId(id)) reasons.push(BLOCK_REASONS.INVALID_RECORD_ID);
    if (Object.keys(asObject(item.proposed_values)).length === 0) {
        reasons.push(BLOCK_REASONS.MISSING_PROPOSED_VALUES);
    }
    if (item.status === 'SKIPPED' && /δεν βρέθηκε/i.test(String(item.reason || ''))) {
        reasons.push(BLOCK_REASONS.MISSING_RECORD);
    }
    return reasons;
}

function validateDryRunItemForApply(item = {}) {
    const itemBlockReasons = inferItemBlockReasons(item);
    const fieldDiffs = Array.isArray(item.field_diffs) ? item.field_diffs : [];
    const fields = fieldDiffs.map((diff) => validateDryRunFieldDiffForApply(diff, item));

    if (fieldDiffs.length === 0) {
        itemBlockReasons.push(BLOCK_REASONS.MISSING_FIELD_DIFFS);
    }

    const hasAllowSet = fields.some((field) => field.plan_action === 'ALLOW_SET');
    const hasBlocked = fields.some((field) => field.plan_action === 'BLOCKED');
    const hasCriticalBlock = itemBlockReasons.length > 0;
    let planStatus;

    if (hasCriticalBlock || (!hasAllowSet && hasBlocked)) planStatus = 'BLOCKED';
    else if (hasAllowSet && hasBlocked) planStatus = 'PARTIALLY_APPLYABLE';
    else if (hasAllowSet) planStatus = 'APPLYABLE';
    else if (fields.length > 0 && fields.every((field) => field.plan_action === 'NOOP')) {
        planStatus = 'NOOP';
    } else planStatus = 'BLOCKED';

    return {
        prodhlomena_oraria_id: item.prodhlomena_oraria_id || null,
        employee_kodikos: item.employee_kodikos || '',
        hmeromhnia: item.hmeromhnia || null,
        plan_status: planStatus,
        block_reasons: uniqueReasons([
            ...itemBlockReasons,
            ...fields.map((field) => field.block_reason)
        ]),
        fields
    };
}

function buildApprovalPlan(approval = {}) {
    const eligible = approval.decision_type === APPLY_DRY_RUN_DECISION_TYPE;
    const items = (Array.isArray(approval.items) ? approval.items : []).map(
        validateDryRunItemForApply
    );
    const hasApplyable = items.some((item) =>
        ['APPLYABLE', 'PARTIALLY_APPLYABLE'].includes(item.plan_status)
    );
    const hasBlocked = items.some((item) =>
        ['BLOCKED', 'PARTIALLY_APPLYABLE'].includes(item.plan_status)
    );
    let planStatus;

    if (!eligible) planStatus = 'BLOCKED';
    else if (items.length === 0) planStatus = 'EMPTY';
    else if (!hasApplyable && items.every((item) => item.plan_status === 'NOOP')) planStatus = 'NOOP';
    else if (hasApplyable && hasBlocked) planStatus = 'PARTIALLY_APPLYABLE';
    else if (hasApplyable) planStatus = 'APPLYABLE';
    else planStatus = 'BLOCKED';

    return {
        approval_id: approval.approval_id || '',
        group_id: approval.group_id || '',
        plan_status: planStatus,
        block_reasons: eligible ? [] : [BLOCK_REASONS.APPROVAL_NOT_ELIGIBLE],
        items
    };
}

function buildApplyPlanSummary(approvals = []) {
    const items = approvals.flatMap((approval) => approval.items);
    const fields = items.flatMap((item) => item.fields);
    const hasApplyable = approvals.some((approval) =>
        ['APPLYABLE', 'PARTIALLY_APPLYABLE'].includes(approval.plan_status)
    );
    const hasBlocked = approvals.some((approval) =>
        ['BLOCKED', 'PARTIALLY_APPLYABLE'].includes(approval.plan_status)
    );
    let planStatus;

    if (approvals.length === 0 || items.length === 0) planStatus = 'EMPTY';
    else if (hasApplyable && hasBlocked) planStatus = 'PARTIALLY_APPLYABLE';
    else if (hasApplyable) planStatus = 'APPLYABLE';
    else planStatus = 'BLOCKED';

    return {
        approvals_total: approvals.length,
        approvals_applyable: approvals.filter((approval) =>
            ['APPLYABLE', 'PARTIALLY_APPLYABLE'].includes(approval.plan_status)
        ).length,
        approvals_blocked: approvals.filter((approval) =>
            ['BLOCKED', 'EMPTY'].includes(approval.plan_status)
        ).length,
        items_total: items.length,
        items_applyable: items.filter((item) =>
            ['APPLYABLE', 'PARTIALLY_APPLYABLE'].includes(item.plan_status)
        ).length,
        items_blocked: items.filter((item) => item.plan_status === 'BLOCKED').length,
        fields_total: fields.length,
        fields_applyable: fields.filter((field) => field.plan_action === 'ALLOW_SET').length,
        fields_blocked: fields.filter((field) => field.plan_action === 'BLOCKED').length,
        plan_status: planStatus
    };
}

function buildApplyPlanFromDryRun(dryRunReport = {}) {
    const approvals = (Array.isArray(dryRunReport.approvals) ? dryRunReport.approvals : []).map(
        buildApprovalPlan
    );
    return { approvals, plan_summary: buildApplyPlanSummary(approvals) };
}

async function runPolicyPreviewApplyPlan({
    session,
    filters,
    dryRunRunner = runPolicyPreviewApplyDryRun
}) {
    validateApplyPlanFilters(filters);
    const dryRun = await dryRunRunner({ session, filters });
    const plan = buildApplyPlanFromDryRun(dryRun);

    return {
        scope: dryRun.scope,
        page: dryRun.page,
        limit: dryRun.limit,
        total: dryRun.total,
        totalPages: dryRun.totalPages,
        dry_run_summary: dryRun.summary,
        ...plan
    };
}

module.exports = {
    BLOCK_REASONS,
    validateApplyPlanFilters,
    validateDryRunFieldDiffForApply,
    validateDryRunItemForApply,
    buildApplyPlanFromDryRun,
    buildApplyPlanSummary,
    runPolicyPreviewApplyPlan
};
