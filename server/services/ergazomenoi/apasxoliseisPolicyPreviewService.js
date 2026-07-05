// Pure policy preview builder for Apasxoliseis rows.
// This module must stay free of DB, controller, route, network, and filesystem dependencies.

const {
    buildApasxoliseisScenarioFacts
} = require('./apasxoliseisScenarioFactsService');
const {
    matchApasxoliseisScenarioFacts
} = require('./apasxoliseisScenarioMatcherService');
const {
    evaluateApasxoliseisPolicyForScenario
} = require('./apasxoliseisPolicyEngineService');
const { POLICY_RESULT_STATUS } = require('./apasxoliseisPolicyCatalogService');

const REVIEW_REQUIRED_RESULT_STATUSES = new Set([
    POLICY_RESULT_STATUS.NEEDS_REVIEW,
    POLICY_RESULT_STATUS.PREFILLED_PENDING_APPROVAL,
    POLICY_RESULT_STATUS.CONFLICT_AMBIGUOUS,
    POLICY_RESULT_STATUS.UNKNOWN_PATTERN
]);

function asArray(value) {
    return Array.isArray(value) ? value : [];
}

function asObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function dateKeyUtc(date) {
    if (!date) return '';

    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return '';

    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
        d.getUTCDate()
    ).padStart(2, '0')}`;
}

function getMapValue(source, key) {
    if (!source || !key) return null;

    if (source instanceof Map) {
        return source.get(key) || null;
    }

    if (typeof source === 'object') {
        return source[key] || null;
    }

    return null;
}

function getRowContextKey(row = {}) {
    return String(row._id || row.id || dateKeyUtc(row.hmeromhnia) || '').trim();
}

function buildHolidayContext(row, argiesByDateKey) {
    const argiaRec = getMapValue(argiesByDateKey, dateKeyUtc(row?.hmeromhnia));
    const isHoliday = Boolean(argiaRec);

    return {
        isHoliday,
        isMandatoryHoliday: argiaRec?.ypoxreotikh_argia === true,
        isOptionalHoliday: isHoliday && argiaRec?.ypoxreotikh_argia !== true,
        description: argiaRec?.description || argiaRec?.perigrafh || argiaRec?.perigrafh_argias || ''
    };
}

function buildScenarioFactsSummary(facts = {}) {
    return {
        declared_category: facts?.declared?.kathgoria_ergasias || '',
        declared_hours: facts?.declared?.declaredHours || 0,
        card_hours: facts?.cards?.cardHours || 0,
        has_cards: facts?.cards?.hasCards === true,
        has_zero_length_card_interval: facts?.cards?.hasZeroLengthCardInterval === true,
        is_holiday: facts?.holiday?.isHoliday === true,
        is_mandatory_holiday: facts?.holiday?.isMandatoryHoliday === true,
        is_optional_holiday: facts?.holiday?.isOptionalHoliday === true,
        is_locked: facts?.review?.is_locked === true,
        has_manual_override: facts?.review?.hasManualOverride === true
    };
}

function buildApasxoliseisPolicyPreviewRows(options = {}) {
    const safeOptions = asObject(options);
    const rows = asArray(safeOptions.rows);
    const argiesByDateKey = safeOptions.argiesByDateKey || new Map();
    const companyFlags = asObject(safeOptions.companyFlags);
    const weeklyContextByRowKey = safeOptions.weeklyContextByRowKey || new Map();
    const defaultPolicyMode = String(safeOptions.defaultPolicyMode || '').trim() || undefined;
    const policyCode = String(safeOptions.policyCode || '').trim() || undefined;

    return rows.map((row) => {
        const rowContextKey = getRowContextKey(row);
        const weeklyContext = getMapValue(weeklyContextByRowKey, rowContextKey) || {};
        const facts = buildApasxoliseisScenarioFacts(row, {
            holiday: buildHolidayContext(row, argiesByDateKey),
            companyFlags,
            existingAuditCount: safeOptions.existingAuditCountByRowKey
                ? getMapValue(safeOptions.existingAuditCountByRowKey, rowContextKey)
                : undefined
        });
        const scenarioDecision = matchApasxoliseisScenarioFacts(facts, {
            weeklyContext
        });
        const policyResult = evaluateApasxoliseisPolicyForScenario({
            facts,
            scenarioDecision,
            policyCode,
            mode: defaultPolicyMode,
            parameters: safeOptions.parameters,
            context: {
                rowContextKey,
                weeklyContext
            }
        });

        return {
            prodhlomena_oraria_id: facts.identity.prodhlomena_oraria_id,
            team: facts.identity.team,
            company_kod: facts.identity.company_kod,
            ypokatasthma: facts.identity.ypokatasthma,
            kodikos: facts.identity.kodikos,
            hmeromhnia: facts.identity.hmeromhnia,
            scenarioDecision,
            scenarioFactsSummary: buildScenarioFactsSummary(facts),
            policyResult
        };
    });
}

function incrementGroupedCount(target, key) {
    const normalizedKey = key || 'UNKNOWN';
    target[normalizedKey] = (target[normalizedKey] || 0) + 1;
}

function summarizeApasxoliseisPolicyPreviewResults(rows = []) {
    const safeRows = asArray(rows);
    const summary = {
        total: safeRows.length,
        by_result_status: {},
        by_policy_code: {},
        by_scenario_code: {},
        by_confidence: {},
        blocked_count: 0,
        proposed_updates_count: 0,
        review_required_count: 0
    };

    safeRows.forEach((row) => {
        const scenarioDecision = asObject(row.scenarioDecision);
        const policyResult = asObject(row.policyResult);
        const proposedUpdates = asObject(policyResult.proposed_updates);
        const resultStatus = policyResult.result_status || POLICY_RESULT_STATUS.UNKNOWN_PATTERN;

        incrementGroupedCount(summary.by_result_status, resultStatus);
        incrementGroupedCount(summary.by_policy_code, policyResult.policy_code);
        incrementGroupedCount(summary.by_scenario_code, scenarioDecision.scenario_code);
        incrementGroupedCount(summary.by_confidence, scenarioDecision.confidence);

        if (policyResult.blocked === true) {
            summary.blocked_count++;
        }

        if (Object.keys(proposedUpdates).length > 0) {
            summary.proposed_updates_count++;
        }

        if (REVIEW_REQUIRED_RESULT_STATUSES.has(resultStatus)) {
            summary.review_required_count++;
        }
    });

    return summary;
}

module.exports = {
    buildApasxoliseisPolicyPreviewRows,
    summarizeApasxoliseisPolicyPreviewResults
};
