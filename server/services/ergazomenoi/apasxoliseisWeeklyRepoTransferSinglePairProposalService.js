// Pure materializer for one atomic weekly repo-transfer proposal pair.
// This module must stay isolated from runtime and write dependencies.

const {
    analyzeWeeklyRepoTransferSinglePair,
    SCENARIO_CODE,
    SCENARIO_VERSION,
    ELIGIBILITY_STATUS
} = require('./apasxoliseisWeeklyRepoTransferSinglePairService');
const {
    buildApasxoliseisScenarioFacts
} = require('./apasxoliseisScenarioFactsService');
const {
    getApasxoliseisPolicyByCode
} = require('./apasxoliseisPolicyCatalogService');

const PROPOSAL_VERSION = 'repo-transfer-single-pair-proposal:v1';
const CHOICE_CODE = 'TRANSFER_REPO_WITHIN_WEEK_SINGLE_PAIR';

const PROPOSAL_STATUS = Object.freeze({
    READY: 'READY',
    NOT_AVAILABLE: 'NOT_AVAILABLE',
    INVALID_ANALYSIS: 'INVALID_ANALYSIS'
});

const WEEKLY_REPO_POLICY_CODE = 'WEEKLY_REPO_BALANCE';
const SOURCE_WORK_POLICY_CODE = 'DECLARED_REPO_OR_NON_WORK_WITH_CARDS';
const SOURCE_ROLE = 'SOURCE_BECOMES_WORK';
const TARGET_ROLE = 'TARGET_BECOMES_REPO';

const CARD_INTERVAL_FIELDS = Object.freeze([
    ['cards_apo_ora_01', 'cards_eos_ora_01'],
    ['cards_apo_ora_02', 'cards_eos_ora_02'],
    ['cards_apo_ora_03', 'cards_eos_ora_03']
]);

const APOLOGISTIKA_INTERVAL_FIELDS = Object.freeze([
    ['apo_ora_01_apologistika', 'eos_ora_01_apologistika'],
    ['apo_ora_02_apologistika', 'eos_ora_02_apologistika'],
    ['apo_ora_03_apologistika', 'eos_ora_03_apologistika']
]);

const REQUIRED_WEEKLY_REPO_FIELDS = Object.freeze([
    'repo_apologistika',
    'kathgoria_ergasias_apologistika'
]);

const REQUIRED_SOURCE_WORK_FIELDS = Object.freeze([
    'kathgoria_ergasias_apologistika',
    ...APOLOGISTIKA_INTERVAL_FIELDS.flat(),
    'ores_ergasias_apologistika'
]);

function deepFreeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.freeze(value);
    Object.keys(value).forEach((key) => deepFreeze(value[key]));
    return value;
}

function normalizePrimitiveString(value, maxLength = 150) {
    if (!['string', 'number', 'bigint', 'boolean'].includes(typeof value)) return null;
    if (typeof value === 'number' && !Number.isFinite(value)) return null;
    const normalized = String(value).trim();
    return normalized ? normalized.slice(0, maxLength) : null;
}

function normalizeId(value) {
    if (typeof value === 'boolean') return null;
    const primitive = normalizePrimitiveString(value, 100);
    if (primitive) return primitive;
    if (!value || typeof value !== 'object') return null;

    try {
        return typeof value.toHexString === 'function'
            ? normalizePrimitiveString(value.toHexString(), 100)
            : null;
    } catch (_error) {
        return null;
    }
}

function dateKeyUtc(value) {
    if (!value) return null;
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
        const key = value.trim();
        const parsed = new Date(`${key}T00:00:00.000Z`);
        return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== key
            ? null
            : key;
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function copyAnalysisMetadata(analysis) {
    return {
        reasons: Array.isArray(analysis?.reasons) ? [...analysis.reasons] : [],
        warnings: Array.isArray(analysis?.warnings) ? [...analysis.warnings] : [],
        week: {
            start_date: normalizePrimitiveString(analysis?.week?.start_date, 10),
            end_date: normalizePrimitiveString(analysis?.week?.end_date, 10)
        },
        employee: {
            team: normalizePrimitiveString(analysis?.employee?.team),
            company_kod: normalizePrimitiveString(analysis?.employee?.company_kod),
            kodikos: normalizePrimitiveString(analysis?.employee?.kodikos),
            typos_apasxolhshs: normalizePrimitiveString(
                analysis?.employee?.typos_apasxolhshs
            ),
            mhniaia_repo: Number.isSafeInteger(analysis?.employee?.mhniaia_repo)
                ? analysis.employee.mhniaia_repo
                : null,
            profile_source: normalizePrimitiveString(analysis?.employee?.profile_source),
            profile_istoriko_id: normalizePrimitiveString(
                analysis?.employee?.profile_istoriko_id,
                100
            ),
            profile_effective_date: normalizePrimitiveString(
                analysis?.employee?.profile_effective_date,
                10
            ),
            profile_changed_inside_week:
                analysis?.employee?.profile_changed_inside_week === true
        },
        counts: {
            source_candidates: analysis?.counts?.source_candidates ?? 0,
            target_candidates: analysis?.counts?.target_candidates ?? 0,
            existing_actual_repo: analysis?.counts?.existing_actual_repo ?? null,
            predicted_final_repo: analysis?.counts?.predicted_final_repo ?? null
        }
    };
}

function readPolicyContext() {
    const weeklyRepoPolicy = getApasxoliseisPolicyByCode(WEEKLY_REPO_POLICY_CODE);
    const sourceWorkPolicy = getApasxoliseisPolicyByCode(SOURCE_WORK_POLICY_CODE);
    const weeklyFields = weeklyRepoPolicy?.proposed_update_fields;
    const sourceFields = sourceWorkPolicy?.proposed_update_fields;

    if (
        !weeklyRepoPolicy ||
        !sourceWorkPolicy ||
        !normalizePrimitiveString(weeklyRepoPolicy.policy_version) ||
        !normalizePrimitiveString(sourceWorkPolicy.policy_version) ||
        !Array.isArray(weeklyFields) ||
        !Array.isArray(sourceFields) ||
        REQUIRED_WEEKLY_REPO_FIELDS.some((field) => !weeklyFields.includes(field)) ||
        REQUIRED_SOURCE_WORK_FIELDS.some((field) => !sourceFields.includes(field))
    ) {
        return null;
    }

    return {
        metadata: {
            weekly_repo_policy_code: WEEKLY_REPO_POLICY_CODE,
            weekly_repo_policy_version: weeklyRepoPolicy.policy_version,
            source_work_policy_code: SOURCE_WORK_POLICY_CODE,
            source_work_policy_version: sourceWorkPolicy.policy_version
        },
        allowedFields: new Set([...weeklyFields, ...sourceFields])
    };
}

function buildResult({
    analysis,
    proposalStatus,
    reasons,
    warnings,
    policyContext = null,
    items = []
}) {
    const metadata = copyAnalysisMetadata(analysis);
    const ready = proposalStatus === PROPOSAL_STATUS.READY;

    return deepFreeze({
        scenario_code: SCENARIO_CODE,
        scenario_version: SCENARIO_VERSION,
        proposal_version: PROPOSAL_VERSION,
        proposal_status: proposalStatus,
        choice_code: CHOICE_CODE,
        requires_hr_review: true,
        can_auto_apply: false,
        atomic_pair_required: true,
        runtime_apply_supported: false,
        reasons: [...new Set(reasons ?? metadata.reasons)],
        warnings: [...new Set(warnings ?? metadata.warnings)],
        week: metadata.week,
        employee: metadata.employee,
        counts: metadata.counts,
        policy_context: policyContext ? { ...policyContext } : null,
        items: items.map((item) => ({
            role: item.role,
            prodhlomena_oraria_id: item.prodhlomena_oraria_id,
            employee_kodikos: item.employee_kodikos,
            hmeromhnia: item.hmeromhnia,
            current_category: item.current_category,
            proposed_values: { ...item.proposed_values }
        })),
        apply_readiness: {
            status: 'BLOCKED',
            reason: ready ? 'ATOMIC_APPLY_SUPPORT_REQUIRED' : 'PROPOSAL_NOT_READY'
        }
    });
}

function invalidResult(analysis, reason, policyContext = null) {
    return buildResult({
        analysis,
        proposalStatus: PROPOSAL_STATUS.INVALID_ANALYSIS,
        reasons: [...(analysis.reasons || []), reason],
        warnings: analysis.warnings,
        policyContext
    });
}

function findReferencedRow(weekRows, reference, role) {
    const referenceDate = normalizePrimitiveString(reference?.hmeromhnia, 10);
    const referenceId = normalizePrimitiveString(reference?.prodhlomena_oraria_id, 100);
    const dateMatches = weekRows.filter((row) => dateKeyUtc(row?.hmeromhnia) === referenceDate);
    const matches = referenceId
        ? dateMatches.filter((row) => normalizeId(row?._id || row?.id) === referenceId)
        : dateMatches;

    if (matches.length === 0) return { reason: `${role}_ROW_NOT_FOUND` };
    if (matches.length > 1) return { reason: `${role}_ROW_AMBIGUOUS` };
    return { row: matches[0] };
}

function materializeSourceValues(row) {
    const facts = buildApasxoliseisScenarioFacts(row);
    const intervals = facts.cards.cardIntervalsRaw;
    if (
        intervals.length !== CARD_INTERVAL_FIELDS.length ||
        intervals.some((interval, index) => {
            const [startField, endField] = CARD_INTERVAL_FIELDS[index];
            const hasRawValue = [row?.[startField], row?.[endField]].some(
                (value) => value !== null && value !== undefined && String(value).trim() !== ''
            );
            return !interval.isComplete && hasRawValue;
        })
    ) {
        return null;
    }

    const cardHours = Number(String(row.cards_ores_ergasias ?? '').replace(',', '.').trim());
    if (!Number.isFinite(cardHours) || cardHours <= 0) return { invalidHours: true };

    const proposedValues = {
        kathgoria_ergasias_apologistika: 'ΕΡΓ',
        repo_apologistika: false
    };

    intervals.forEach((interval, index) => {
        const [startField, endField] = APOLOGISTIKA_INTERVAL_FIELDS[index];
        const materializable = interval.isComplete && !interval.isZeroLength;
        proposedValues[startField] = materializable ? interval.start : '';
        proposedValues[endField] = materializable ? interval.end : '';
    });
    proposedValues.ores_ergasias_apologistika = cardHours;

    return { proposedValues };
}

function materializeTargetValues(targetCategory) {
    return {
        kathgoria_ergasias_apologistika: targetCategory,
        repo_apologistika: true,
        ores_ergasias_apologistika: 0,
        apo_ora_01_apologistika: '',
        eos_ora_01_apologistika: '',
        apo_ora_02_apologistika: '',
        eos_ora_02_apologistika: '',
        apo_ora_03_apologistika: '',
        eos_ora_03_apologistika: ''
    };
}

function hasOnlyAllowedFields(proposedValues, allowedFields) {
    return Object.keys(proposedValues).every((field) => allowedFields.has(field));
}

function buildWeeklyRepoTransferSinglePairProposal({
    weekRows = [],
    employmentProfile = {},
    holidayByDateKey = new Map(),
    existingAuditCountByRowKey = new Map()
} = {}) {
    const analysis = analyzeWeeklyRepoTransferSinglePair({
        weekRows,
        employmentProfile,
        holidayByDateKey,
        existingAuditCountByRowKey
    });

    if (analysis.eligibility_status !== ELIGIBILITY_STATUS.ELIGIBLE) {
        return buildResult({
            analysis,
            proposalStatus: PROPOSAL_STATUS.NOT_AVAILABLE
        });
    }

    const policy = readPolicyContext();
    if (!policy) return invalidResult(analysis, 'POLICY_CATALOG_NOT_MATERIALIZABLE');

    const rows = Array.isArray(weekRows) ? weekRows : [];
    const sourceMatch = findReferencedRow(rows, analysis.source, 'SOURCE');
    if (!sourceMatch.row) return invalidResult(analysis, sourceMatch.reason, policy.metadata);
    const targetMatch = findReferencedRow(rows, analysis.target, 'TARGET');
    if (!targetMatch.row) return invalidResult(analysis, targetMatch.reason, policy.metadata);

    const sourceId = normalizePrimitiveString(analysis.source?.prodhlomena_oraria_id, 100);
    const targetId = normalizePrimitiveString(analysis.target?.prodhlomena_oraria_id, 100);
    if (!sourceId) return invalidResult(analysis, 'MISSING_SOURCE_RECORD_ID', policy.metadata);
    if (!targetId) return invalidResult(analysis, 'MISSING_TARGET_RECORD_ID', policy.metadata);
    if (sourceId === targetId) {
        return invalidResult(analysis, 'DUPLICATE_PAIR_RECORD_ID', policy.metadata);
    }

    const sourceMaterialization = materializeSourceValues(sourceMatch.row);
    if (!sourceMaterialization) {
        return invalidResult(
            analysis,
            'SOURCE_CARD_INTERVALS_NOT_MATERIALIZABLE',
            policy.metadata
        );
    }
    if (sourceMaterialization.invalidHours) {
        return invalidResult(
            analysis,
            'SOURCE_CARD_HOURS_NOT_MATERIALIZABLE',
            policy.metadata
        );
    }

    const targetCategory = normalizePrimitiveString(
        analysis.target?.semantic_target_category,
        10
    );
    if (!['ΑΝ', 'ΜΕ'].includes(targetCategory)) {
        return invalidResult(analysis, 'TARGET_CATEGORY_NOT_MATERIALIZABLE', policy.metadata);
    }
    const targetProposedValues = materializeTargetValues(targetCategory);
    if (
        !hasOnlyAllowedFields(sourceMaterialization.proposedValues, policy.allowedFields) ||
        !hasOnlyAllowedFields(targetProposedValues, policy.allowedFields)
    ) {
        return invalidResult(analysis, 'PROPOSED_FIELD_NOT_ALLOWED', policy.metadata);
    }

    const employeeKodikos = normalizePrimitiveString(analysis.employee?.kodikos, 100);
    const items = [
        {
            role: SOURCE_ROLE,
            prodhlomena_oraria_id: sourceId,
            employee_kodikos: employeeKodikos,
            hmeromhnia: analysis.source.hmeromhnia,
            current_category: analysis.source.current_category,
            proposed_values: sourceMaterialization.proposedValues
        },
        {
            role: TARGET_ROLE,
            prodhlomena_oraria_id: targetId,
            employee_kodikos: employeeKodikos,
            hmeromhnia: analysis.target.hmeromhnia,
            current_category: analysis.target.current_category,
            proposed_values: targetProposedValues
        }
    ];

    return buildResult({
        analysis,
        proposalStatus: PROPOSAL_STATUS.READY,
        policyContext: policy.metadata,
        items
    });
}

module.exports = {
    buildWeeklyRepoTransferSinglePairProposal,
    PROPOSAL_STATUS,
    PROPOSAL_VERSION,
    CHOICE_CODE
};
