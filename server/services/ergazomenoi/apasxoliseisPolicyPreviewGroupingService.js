// Pure grouping layer for Apasxoliseis policy preview rows.
// This module must stay free of DB, controller, route, network, and filesystem dependencies.

const crypto = require('crypto');

const STATUS_PRIORITY = Object.freeze({
    NEEDS_REVIEW: 10,
    UNKNOWN_PATTERN: 20,
    PREFILLED_PENDING_APPROVAL: 30,
    OK: 40
});

function asArray(value) {
    return Array.isArray(value) ? value : [];
}

function asObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeKeyValue(value) {
    const normalized = String(value || '').trim();
    return normalized || 'UNKNOWN';
}

function dateKeyUtc(value) {
    if (!value) return null;

    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
            return trimmed;
        }
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;

    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(
        date.getUTCDate()
    ).padStart(2, '0')}`;
}

function compareText(left, right) {
    return String(left || '').localeCompare(String(right || ''), 'el', {
        sensitivity: 'base',
        numeric: true
    });
}

function incrementCount(target, key) {
    const normalizedKey = normalizeKeyValue(key);
    target[normalizedKey] = (target[normalizedKey] || 0) + 1;
}

function buildStableGroupId(groupKey) {
    return `policy-preview-group-${crypto
        .createHash('sha1')
        .update(groupKey)
        .digest('hex')
        .slice(0, 16)}`;
}

function buildGroupKeyParts(row = {}) {
    const scenarioDecision = asObject(row.scenarioDecision);
    const policyResult = asObject(row.policyResult);
    const reasons = asArray(policyResult.reasons).length
        ? asArray(policyResult.reasons)
        : asArray(scenarioDecision.reasons);

    return {
        status: normalizeKeyValue(policyResult.result_status),
        policy_code: normalizeKeyValue(policyResult.policy_code),
        scenario_code: normalizeKeyValue(scenarioDecision.scenario_code),
        action_type: normalizeKeyValue(policyResult.mode),
        reason_code: normalizeKeyValue(reasons[0])
    };
}

function buildGroupKey(parts) {
    return [
        `status=${parts.status}`,
        `policy_code=${parts.policy_code}`,
        `scenario_code=${parts.scenario_code}`,
        `action_type=${parts.action_type}`,
        `reason_code=${parts.reason_code}`
    ].join('|');
}

function buildPreviewItem(row = {}) {
    const policyResult = asObject(row.policyResult);
    const factsSummary = asObject(row.scenarioFactsSummary);
    const prodhlomenaOrariaId = String(row.prodhlomena_oraria_id || '').trim();
    const employeeKodikos = String(row.kodikos || '').trim();

    return {
        preview_id: prodhlomenaOrariaId,
        prodhlomena_oraria_id: prodhlomenaOrariaId,
        employee_id: null,
        employee_kodikos: employeeKodikos,
        employee_full_name: null,
        hmeromhnia: dateKeyUtc(row.hmeromhnia),
        kathgoria_ergasias: factsSummary.declared_category || null,
        kathgoria_ergasias_apologistika:
            row.kathgoria_ergasias_apologistika ||
            factsSummary.kathgoria_ergasias_apologistika ||
            null,
        cards_ores_ergasias: factsSummary.card_hours ?? null,
        proposed_values: asObject(policyResult.proposed_updates),
        flags: {
            has_cards: factsSummary.has_cards === true,
            is_holiday: factsSummary.is_holiday === true,
            is_mandatory_holiday: factsSummary.is_mandatory_holiday === true,
            is_optional_holiday: factsSummary.is_optional_holiday === true,
            is_locked: factsSummary.is_locked === true,
            has_manual_override: factsSummary.has_manual_override === true,
            blocked: policyResult.blocked === true,
            requires_human_approval: policyResult.requires_human_approval === true,
            batch_approvable: policyResult.batch_approvable === true
        }
    };
}

function buildGroupTitle(parts, row = {}) {
    const policyResult = asObject(row.policyResult);
    const scenarioDecision = asObject(row.scenarioDecision);
    const labels = asObject(scenarioDecision.display_labels);

    return (
        policyResult.policy_title ||
        labels.badge ||
        [parts.status, parts.policy_code, parts.scenario_code]
            .filter((value) => value && value !== 'UNKNOWN')
            .join(' / ') ||
        'UNKNOWN'
    );
}

function buildGroupDescription(parts, row = {}) {
    const policyResult = asObject(row.policyResult);
    const scenarioDecision = asObject(row.scenarioDecision);
    const reasons = asArray(policyResult.reasons).length
        ? asArray(policyResult.reasons)
        : asArray(scenarioDecision.reasons);

    return [
        parts.status !== 'UNKNOWN' ? `status:${parts.status}` : '',
        parts.policy_code !== 'UNKNOWN' ? `policy:${parts.policy_code}` : '',
        parts.scenario_code !== 'UNKNOWN' ? `scenario:${parts.scenario_code}` : '',
        reasons.length > 0 ? `reasons:${reasons.join(',')}` : ''
    ]
        .filter(Boolean)
        .join(' | ');
}

function sortItems(left, right) {
    return (
        compareText(left.employee_kodikos, right.employee_kodikos) ||
        compareText(left.hmeromhnia, right.hmeromhnia) ||
        compareText(left.prodhlomena_oraria_id, right.prodhlomena_oraria_id)
    );
}

function sortGroups(left, right) {
    const leftPriority = STATUS_PRIORITY[left.status] || 999;
    const rightPriority = STATUS_PRIORITY[right.status] || 999;

    return (
        leftPriority - rightPriority ||
        right.count - left.count ||
        compareText(left.policy_code, right.policy_code) ||
        compareText(left.scenario_code, right.scenario_code) ||
        compareText(left.group_key, right.group_key)
    );
}

function buildApasxoliseisPolicyPreviewGrouping(rows = []) {
    const safeRows = asArray(rows);
    const summary = {
        total: safeRows.length,
        groups_count: 0,
        by_status: {},
        by_policy_code: {},
        by_scenario_code: {}
    };
    const groupsByKey = new Map();

    safeRows.forEach((row) => {
        const parts = buildGroupKeyParts(row);
        const groupKey = buildGroupKey(parts);
        const item = buildPreviewItem(row);

        incrementCount(summary.by_status, parts.status);
        incrementCount(summary.by_policy_code, parts.policy_code);
        incrementCount(summary.by_scenario_code, parts.scenario_code);

        if (!groupsByKey.has(groupKey)) {
            groupsByKey.set(groupKey, {
                group_id: buildStableGroupId(groupKey),
                group_key: groupKey,
                status: parts.status,
                policy_code: parts.policy_code,
                scenario_code: parts.scenario_code,
                action_type: parts.action_type,
                reason_code: parts.reason_code,
                title: buildGroupTitle(parts, row),
                description: buildGroupDescription(parts, row),
                count: 0,
                employees_count: 0,
                first_date: null,
                last_date: null,
                representative_item: null,
                items: [],
                _employeeKeys: new Set()
            });
        }

        const group = groupsByKey.get(groupKey);
        group.count++;
        group.items.push(item);

        if (item.employee_kodikos) {
            group._employeeKeys.add(item.employee_kodikos);
        }

        if (item.hmeromhnia && (!group.first_date || item.hmeromhnia < group.first_date)) {
            group.first_date = item.hmeromhnia;
        }

        if (item.hmeromhnia && (!group.last_date || item.hmeromhnia > group.last_date)) {
            group.last_date = item.hmeromhnia;
        }
    });

    const groups = [...groupsByKey.values()].map((group) => {
        group.items.sort(sortItems);
        group.employees_count = group._employeeKeys.size;
        group.representative_item = group.items[0] || null;
        delete group._employeeKeys;
        return group;
    });

    groups.sort(sortGroups);
    summary.groups_count = groups.length;

    return {
        version: 1,
        scope: 'page',
        summary,
        groups
    };
}

module.exports = {
    buildApasxoliseisPolicyPreviewGrouping
};
