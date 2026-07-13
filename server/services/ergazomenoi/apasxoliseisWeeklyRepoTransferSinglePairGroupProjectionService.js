// Pure projection of one weekly repo-transfer proposal into one atomic preview group.
// This module must stay isolated from runtime, persistence, and apply dependencies.

const crypto = require('crypto');

const {
    buildWeeklyRepoTransferSinglePairProposal,
    PROPOSAL_STATUS,
    PROPOSAL_VERSION,
    CHOICE_CODE
} = require('./apasxoliseisWeeklyRepoTransferSinglePairProposalService');

const PROJECTION_STATUS = Object.freeze({
    READY: 'READY',
    NOT_AVAILABLE: 'NOT_AVAILABLE',
    INVALID_PROJECTION: 'INVALID_PROJECTION'
});

const GROUP_TYPE = 'ATOMIC_PAIRED_PROPOSAL';
const SCENARIO_CODE = 'REPO_TRANSFER_WITHIN_WEEK_SINGLE_PAIR';
const PRIMARY_POLICY_CODE = 'WEEKLY_REPO_BALANCE';
const SECONDARY_POLICY_CODE = 'DECLARED_REPO_OR_NON_WORK_WITH_CARDS';
const SOURCE_ROLE = 'SOURCE_BECOMES_WORK';
const TARGET_ROLE = 'TARGET_BECOMES_REPO';

function deepFreeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.freeze(value);
    Object.keys(value).forEach((key) => deepFreeze(value[key]));
    return value;
}

function isPlainObject(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

function primitiveString(value, maxLength = 200) {
    if (!['string', 'number', 'bigint', 'boolean'].includes(typeof value)) return null;
    if (typeof value === 'number' && !Number.isFinite(value)) return null;
    const normalized = String(value).trim();
    return normalized ? normalized.slice(0, maxLength) : null;
}

function dateKey(value) {
    const normalized = primitiveString(value, 10);
    if (!normalized || !/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;
    const parsed = new Date(`${normalized}T00:00:00.000Z`);
    return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== normalized
        ? null
        : normalized;
}

function displayDate(value) {
    const key = dateKey(value);
    if (!key) return '';
    const [year, month, day] = key.split('-');
    return `${day}/${month}/${year}`;
}

function stableHash(value) {
    return crypto.createHash('sha1').update(value).digest('hex').slice(0, 16);
}

function groupKeyValue(value) {
    return encodeURIComponent(value);
}

function buildGroupKey({ employeeKodikos, weekStart, weekEnd, sourceId, targetId }) {
    return [
        `group_type=${GROUP_TYPE}`,
        `scenario=${SCENARIO_CODE}`,
        `choice=${CHOICE_CODE}`,
        `proposal_version=${PROPOSAL_VERSION}`,
        `employee=${groupKeyValue(employeeKodikos)}`,
        `week=${groupKeyValue(weekStart)}:${groupKeyValue(weekEnd)}`,
        `source=${groupKeyValue(sourceId)}`,
        `target=${groupKeyValue(targetId)}`
    ].join('|');
}

function buildGroupId(groupKey) {
    return `policy-preview-paired-group-${stableHash(groupKey)}`;
}

function buildPreviewId(groupKey, item) {
    return `policy-preview-paired-item-${stableHash(
        `${groupKey}|role=${item.role}|record=${item.prodhlomena_oraria_id}`
    )}`;
}

function copyReasons(values) {
    return Array.isArray(values)
        ? [...new Set(values.filter((value) => typeof value === 'string'))]
        : [];
}

function emptySummary(notAvailableCount) {
    return {
        groups_count: 0,
        decision_units_count: 0,
        items_count: 0,
        employees_count: 0,
        ready_count: 0,
        not_available_count: notAvailableCount
    };
}

function buildEmptyResult({ proposal, projectionStatus, reason = null }) {
    const reasons = copyReasons(proposal?.reasons);
    if (reason && !reasons.includes(reason)) reasons.push(reason);

    return deepFreeze({
        version: 1,
        scope: 'weekly_atomic_pair',
        projection_status: projectionStatus,
        summary: emptySummary(1),
        reasons,
        warnings: copyReasons(proposal?.warnings),
        groups: []
    });
}

function validateReadyProposal(proposal) {
    if (
        proposal?.scenario_code !== SCENARIO_CODE ||
        proposal?.proposal_version !== PROPOSAL_VERSION ||
        proposal?.choice_code !== CHOICE_CODE ||
        proposal?.atomic_pair_required !== true ||
        proposal?.requires_hr_review !== true ||
        proposal?.can_auto_apply !== false ||
        proposal?.runtime_apply_supported !== false ||
        proposal?.apply_readiness?.status !== 'BLOCKED' ||
        proposal?.apply_readiness?.reason !== 'ATOMIC_APPLY_SUPPORT_REQUIRED'
    ) {
        return 'PROPOSAL_SAFETY_CONTRACT_INVALID';
    }

    if (
        proposal?.policy_context?.weekly_repo_policy_code !== PRIMARY_POLICY_CODE ||
        proposal?.policy_context?.source_work_policy_code !== SECONDARY_POLICY_CODE ||
        !primitiveString(proposal?.policy_context?.weekly_repo_policy_version) ||
        !primitiveString(proposal?.policy_context?.source_work_policy_version)
    ) {
        return 'PROPOSAL_POLICY_CONTEXT_INVALID';
    }

    if (!Array.isArray(proposal.items) || proposal.items.length !== 2) {
        return 'PROPOSAL_ATOMIC_PAIR_INVALID';
    }

    const [source, target] = proposal.items;
    if (source?.role !== SOURCE_ROLE || target?.role !== TARGET_ROLE) {
        return 'PROPOSAL_ITEM_ORDER_INVALID';
    }

    const sourceId = primitiveString(source.prodhlomena_oraria_id, 100);
    const targetId = primitiveString(target.prodhlomena_oraria_id, 100);
    const sourceEmployee = primitiveString(source.employee_kodikos, 100);
    const targetEmployee = primitiveString(target.employee_kodikos, 100);
    if (!sourceId || !targetId || sourceId === targetId) return 'PROPOSAL_ITEM_IDS_INVALID';
    if (!sourceEmployee || sourceEmployee !== targetEmployee) {
        return 'PROPOSAL_ITEM_EMPLOYEE_INVALID';
    }
    if (!dateKey(source.hmeromhnia) || !dateKey(target.hmeromhnia)) {
        return 'PROPOSAL_ITEM_DATES_INVALID';
    }
    if (!isPlainObject(source.proposed_values) || !isPlainObject(target.proposed_values)) {
        return 'PROPOSAL_VALUES_INVALID';
    }
    if (source.proposed_values.kathgoria_ergasias_apologistika !== 'ΕΡΓ') {
        return 'PROPOSAL_SOURCE_CATEGORY_INVALID';
    }
    if (!['ΑΝ', 'ΜΕ'].includes(target.proposed_values.kathgoria_ergasias_apologistika)) {
        return 'PROPOSAL_TARGET_CATEGORY_INVALID';
    }

    const weekStart = dateKey(proposal?.week?.start_date);
    const weekEnd = dateKey(proposal?.week?.end_date);
    if (!weekStart || !weekEnd || weekStart > weekEnd) return 'PROPOSAL_WEEK_INVALID';

    return null;
}

function projectItem(item, groupKey) {
    return {
        preview_id: buildPreviewId(groupKey, item),
        prodhlomena_oraria_id: primitiveString(item.prodhlomena_oraria_id, 100),
        employee_id: null,
        employee_kodikos: primitiveString(item.employee_kodikos, 100),
        employee_full_name: null,
        role: item.role,
        hmeromhnia: dateKey(item.hmeromhnia),
        kathgoria_ergasias: primitiveString(item.current_category, 20),
        kathgoria_ergasias_apologistika:
            primitiveString(item.proposed_values.kathgoria_ergasias_apologistika, 20),
        proposed_values: { ...item.proposed_values },
        flags: {
            atomic_pair_member: true,
            requires_human_approval: true,
            approval_supported: false,
            batch_approvable: false,
            runtime_apply_supported: false
        }
    };
}

function buildDescription({ employeeKodikos, sourceDate, targetDate, targetCategory }) {
    const employmentLabel = targetCategory === 'ΜΕ' ? 'μερική απασχόληση' : 'πλήρης απασχόληση';
    return (
        `Μεταφορά ρεπό για τον εργαζόμενο ${employeeKodikos}: ` +
        `η ${displayDate(sourceDate)} γίνεται εργασία και η ${displayDate(targetDate)} ` +
        `γίνεται ρεπό (${targetCategory}, ${employmentLabel}). ` +
        'Η atomic read-only πρόταση απαιτεί ενιαία έγκριση και δεν είναι ακόμη διαθέσιμη για εφαρμογή.'
    );
}

function buildWeeklyRepoTransferSinglePairGroupProjection({
    weekRows = [],
    employmentProfile = {},
    holidayByDateKey = new Map(),
    existingAuditCountByRowKey = new Map()
} = {}) {
    const proposal = buildWeeklyRepoTransferSinglePairProposal({
        weekRows,
        employmentProfile,
        holidayByDateKey,
        existingAuditCountByRowKey
    });

    if (proposal.proposal_status !== PROPOSAL_STATUS.READY) {
        return buildEmptyResult({
            proposal,
            projectionStatus: PROJECTION_STATUS.NOT_AVAILABLE
        });
    }

    const invalidReason = validateReadyProposal(proposal);
    if (invalidReason) {
        return buildEmptyResult({
            proposal,
            projectionStatus: PROJECTION_STATUS.INVALID_PROJECTION,
            reason: invalidReason
        });
    }

    const [sourceProposalItem, targetProposalItem] = proposal.items;
    const employeeKodikos = sourceProposalItem.employee_kodikos;
    const groupKey = buildGroupKey({
        employeeKodikos,
        weekStart: proposal.week.start_date,
        weekEnd: proposal.week.end_date,
        sourceId: sourceProposalItem.prodhlomena_oraria_id,
        targetId: targetProposalItem.prodhlomena_oraria_id
    });
    const items = [
        projectItem(sourceProposalItem, groupKey),
        projectItem(targetProposalItem, groupKey)
    ];
    const itemDates = items.map((item) => item.hmeromhnia).sort();
    const warnings = copyReasons(proposal.warnings);
    const targetCategory = items[1].kathgoria_ergasias_apologistika;
    const group = {
        group_id: buildGroupId(groupKey),
        group_key: groupKey,
        group_type: GROUP_TYPE,
        status: 'NEEDS_REVIEW',
        policy_code: PRIMARY_POLICY_CODE,
        secondary_policy_code: SECONDARY_POLICY_CODE,
        scenario_code: SCENARIO_CODE,
        action_type: 'PAIRED_PROPOSAL',
        reason_code: 'REPO_TRANSFER_CANDIDATE',
        title: 'Μεταφορά ρεπό εντός εβδομάδας',
        description: buildDescription({
            employeeKodikos,
            sourceDate: items[0].hmeromhnia,
            targetDate: items[1].hmeromhnia,
            targetCategory
        }),
        count: 2,
        decision_units_count: 1,
        employees_count: 1,
        first_date: itemDates[0],
        last_date: itemDates[1],
        representative_item: items[0],
        items,
        pair_contract: {
            choice_code: CHOICE_CODE,
            proposal_version: PROPOSAL_VERSION,
            atomic_pair_required: true,
            requires_hr_review: true,
            approval_supported: false,
            batch_approvable: false,
            runtime_apply_supported: false,
            apply_readiness: {
                status: 'BLOCKED',
                reason: 'ATOMIC_APPLY_SUPPORT_REQUIRED'
            }
        },
        warnings: [...warnings]
    };

    return deepFreeze({
        version: 1,
        scope: 'weekly_atomic_pair',
        projection_status: PROJECTION_STATUS.READY,
        summary: {
            groups_count: 1,
            decision_units_count: 1,
            items_count: 2,
            employees_count: 1,
            ready_count: 1,
            not_available_count: 0
        },
        reasons: copyReasons(proposal.reasons),
        warnings,
        groups: [group]
    });
}

module.exports = {
    buildWeeklyRepoTransferSinglePairGroupProjection,
    PROJECTION_STATUS,
    GROUP_TYPE
};
