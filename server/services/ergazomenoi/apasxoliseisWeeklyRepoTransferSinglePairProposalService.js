// Pure materializer for one atomic weekly repo-transfer proposal pair.
// This module must stay isolated from runtime and write dependencies.

const {
    analyzeWeeklyRepoTransferSinglePairV1,
    analyzeWeeklyRepoTransferSinglePairV2,
    SCENARIO_CODE,
    SCENARIO_VERSION,
    SCENARIO_VERSION_V2,
    ELIGIBILITY_STATUS
} = require('./apasxoliseisWeeklyRepoTransferSinglePairService');
const {
    buildApasxoliseisScenarioFacts
} = require('./apasxoliseisScenarioFactsService');
const {
    getApasxoliseisPolicyByCode
} = require('./apasxoliseisPolicyCatalogService');
const {
    resolveCurrentApologistikaDisplayCategory
} = require('./apasxoliseisWeeklyRepoTransferAuthoritativeContextService');

const PROPOSAL_VERSION = 'repo-transfer-single-pair-proposal:v4';
const PROPOSAL_VERSION_V2 = 'repo-transfer-single-pair-proposal:v4';
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
    'kathgoria_ergasias_apologistika',
    'ores_pragmatikhs_ergasias_apologistika',
    'ores_adeias_pistomenes_apologistika',
    'ores_argias_pistomenes_apologistika',
    'compensation_breakdown_apologistika'
]);

const REQUIRED_SOURCE_WORK_FIELDS = Object.freeze([
    'kathgoria_ergasias_apologistika',
    ...APOLOGISTIKA_INTERVAL_FIELDS.flat(),
    'ores_ergasias_apologistika',
    'ores_pragmatikhs_ergasias_apologistika',
    'ores_adeias_pistomenes_apologistika',
    'ores_argias_pistomenes_apologistika',
    'compensation_breakdown_apologistika'
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
            effective_expected_weekly_repo:
                Number.isSafeInteger(analysis?.employee?.effective_expected_weekly_repo)
                    ? analysis.employee.effective_expected_weekly_repo
                    : null,
            repo_resolution_source: normalizePrimitiveString(
                analysis?.employee?.repo_resolution_source
            ),
            scheduled_work_days:
                Number.isSafeInteger(analysis?.employee?.scheduled_work_days)
                    ? analysis.employee.scheduled_work_days
                    : null,
            effective_weekly_workdays:
                Number.isSafeInteger(analysis?.employee?.effective_weekly_workdays)
                    ? analysis.employee.effective_weekly_workdays
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
        },
        weekly_resolution: analysis?.weekly_resolution || null
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
    items = [],
    scenarioVersion = SCENARIO_VERSION,
    proposalVersion = PROPOSAL_VERSION,
    atomicPairRequired = true,
    runtimeApplySupported = false,
    applyReadinessReason = null,
    allowedHrChoices = [],
    investigationGuidance = [],
    reviewOnlyOutcome = null
}) {
    const metadata = copyAnalysisMetadata(analysis);
    const ready = proposalStatus === PROPOSAL_STATUS.READY;

    return deepFreeze({
        scenario_code: SCENARIO_CODE,
        scenario_version: scenarioVersion,
        proposal_version: proposalVersion,
        proposal_status: proposalStatus,
        eligibility_status: analysis?.eligibility_status || null,
        choice_code: CHOICE_CODE,
        requires_hr_review: true,
        can_auto_apply: false,
        atomic_pair_required: atomicPairRequired,
        runtime_apply_supported: runtimeApplySupported,
        allowed_hr_choices: [...allowedHrChoices],
        investigation_guidance: [...investigationGuidance],
        review_only_outcome: reviewOnlyOutcome,
        reasons: [...new Set(reasons ?? metadata.reasons)],
        warnings: [...new Set(warnings ?? metadata.warnings)],
        week: metadata.week,
        employee: metadata.employee,
        counts: metadata.counts,
        weekly_resolution: metadata.weekly_resolution,
        policy_context: policyContext ? { ...policyContext } : null,
        items: items.map((item) => ({
            role: item.role,
            prodhlomena_oraria_id: item.prodhlomena_oraria_id,
            employee_kodikos: item.employee_kodikos,
            hmeromhnia: item.hmeromhnia,
            current_category: item.current_category,
            ...(item.current_apologistika_category
                ? {
                      current_apologistika_category:
                          item.current_apologistika_category
                  }
                : {}),
            proposed_values: { ...item.proposed_values }
        })),
        apply_readiness: {
            status: 'BLOCKED',
            reason: applyReadinessReason ||
                (ready ? 'ATOMIC_APPLY_SUPPORT_REQUIRED' : 'PROPOSAL_NOT_READY')
        }
    });
}

function invalidResult(
    analysis,
    reason,
    policyContext = null,
    {
        scenarioVersion = SCENARIO_VERSION,
        proposalVersion = PROPOSAL_VERSION
    } = {}
) {
    return buildResult({
        analysis,
        proposalStatus: PROPOSAL_STATUS.INVALID_ANALYSIS,
        reasons: [...(analysis.reasons || []), reason],
        warnings: analysis.warnings,
        policyContext,
        scenarioVersion,
        proposalVersion
    });
}

function normalizePositiveFiniteNumber(value) {
    if (!['string', 'number'].includes(typeof value)) return null;
    const trimmed = String(value).trim();
    if (!trimmed) return null;
    const normalized = Number(trimmed.replace(',', '.'));
    return Number.isFinite(normalized) && normalized > 0 ? normalized : null;
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
    const hasCalculatedIntervals = facts.apologistika.currentApologistikaIntervals.some(
        (interval) => interval.isComplete && !interval.isZeroLength
    );
    const intervals = hasCalculatedIntervals
        ? facts.apologistika.currentApologistikaIntervals
        : facts.cards.cardIntervalsRaw;
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
    const calculatedHours = Number(
        String(row.ores_ergasias_apologistika ?? '').replace(',', '.').trim()
    );
    const sourceHours = Number.isFinite(calculatedHours) && calculatedHours > 0
        ? calculatedHours
        : cardHours;
    if (!Number.isFinite(sourceHours) || sourceHours <= 0) return { invalidHours: true };

    const proposedValues = {
        kathgoria_ergasias_apologistika: 'ΕΡΓ',
        repo_apologistika: false,
        adeia_apologistika: false,
        kathgoria_adeias_apologistika: '',
        ores_apoysias_apologistika: 0
    };

    intervals.forEach((interval, index) => {
        const [startField, endField] = APOLOGISTIKA_INTERVAL_FIELDS[index];
        const materializable = interval.isComplete && !interval.isZeroLength;
        proposedValues[startField] = materializable ? interval.start : '';
        proposedValues[endField] = materializable ? interval.end : '';
    });
    proposedValues.ores_ergasias_apologistika = sourceHours;
    proposedValues.ores_pragmatikhs_ergasias_apologistika = sourceHours;
    proposedValues.ores_adeias_pistomenes_apologistika = 0;
    proposedValues.ores_argias_pistomenes_apologistika = 0;
    proposedValues.compensation_breakdown_apologistika = null;

    return { proposedValues };
}

function materializeTargetValues(targetCategory) {
    return {
        kathgoria_ergasias_apologistika: targetCategory,
        repo_apologistika: true,
        adeia_apologistika: false,
        kathgoria_adeias_apologistika: '',
        ores_ergasias_apologistika: 0,
        ores_pragmatikhs_ergasias_apologistika: 0,
        ores_adeias_pistomenes_apologistika: 0,
        ores_argias_pistomenes_apologistika: 0,
        compensation_breakdown_apologistika: null,
        ores_apoysias_apologistika: 0,
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
    existingAuditCountByRowKey = new Map(),
    contractVersion = 'v1'
} = {}, dependencies = {}) {
    if (!['v1', 'v2'].includes(contractVersion)) {
        throw new TypeError('Unsupported repo-transfer proposal contract version.');
    }
    const legacy = contractVersion === 'v1';
    const analyzer = dependencies.analyzer || (
        legacy
            ? analyzeWeeklyRepoTransferSinglePairV1
            : analyzeWeeklyRepoTransferSinglePairV2
    );
    const scenarioVersion = legacy ? SCENARIO_VERSION : SCENARIO_VERSION_V2;
    const proposalVersion = legacy ? PROPOSAL_VERSION : PROPOSAL_VERSION_V2;
    const analysis = analyzer({
        weekRows,
        employmentProfile,
        holidayByDateKey,
        existingAuditCountByRowKey
    });

    if (analysis.eligibility_status !== ELIGIBILITY_STATUS.ELIGIBLE) {
        const operationType = analysis.semantic_proposal?.operation_type;
        const noTarget =
            operationType === 'PARTIAL_UNEXPECTED_WORK_WITHOUT_OFFSET_DAY';
        const blockedTarget = operationType === 'PARTIAL_OFFSET_TARGET_BLOCKED';
        const reviewOnly = noTarget || blockedTarget;
        const sourceRow = reviewOnly
            ? (Array.isArray(weekRows) ? weekRows : []).find(
                (row) => dateKeyUtc(row?.hmeromhnia) === analysis.source?.hmeromhnia
            )
            : null;
        const reviewCardHours = reviewOnly
            ? sourceRow
                ? normalizePositiveFiniteNumber(sourceRow.cards_ores_ergasias)
                : null
            : null;
        if (reviewOnly && reviewCardHours === null) {
            return invalidResult(
                analysis,
                'SOURCE_CARD_HOURS_NOT_MATERIALIZABLE',
                null,
                { scenarioVersion, proposalVersion }
            );
        }
        return buildResult({
            analysis,
            proposalStatus: PROPOSAL_STATUS.NOT_AVAILABLE,
            scenarioVersion,
            proposalVersion,
            atomicPairRequired: reviewOnly ? false : true,
            runtimeApplySupported: false,
            applyReadinessReason: noTarget
                ? 'NO_TARGET_SCHEDULED_WORK_WITHOUT_CARDS'
                : blockedTarget
                    ? 'OFFSET_TARGET_BLOCKED'
                    : 'PROPOSAL_NOT_READY',
            investigationGuidance: noTarget
                ? analysis.semantic_proposal.investigation_guidance
                : [],
            reviewOnlyOutcome: reviewOnly ? {
                outcome_code: operationType,
                reason: noTarget
                    ? 'NO_TARGET_SCHEDULED_WORK_WITHOUT_CARDS'
                    : 'OFFSET_TARGET_BLOCKED',
                source: {
                    prodhlomena_oraria_id: normalizeId(sourceRow?._id || sourceRow?.id),
                    hmeromhnia: dateKeyUtc(sourceRow?.hmeromhnia),
                    cards_ores_ergasias: reviewCardHours,
                    card_intervals: CARD_INTERVAL_FIELDS.map(([start, end]) => ({
                        apo: normalizePrimitiveString(sourceRow?.[start]),
                        eos: normalizePrimitiveString(sourceRow?.[end])
                    })).filter((interval) => interval.apo && interval.eos),
                    proposed_category: 'ΕΡΓ'
                },
                employee_kodikos: normalizePrimitiveString(
                    analysis.employee?.kodikos,
                    100
                ),
                week_start: normalizePrimitiveString(analysis.week?.start_date, 10),
                week_end: normalizePrimitiveString(analysis.week?.end_date, 10),
                team: normalizePrimitiveString(analysis.employee?.team),
                company_kod: normalizePrimitiveString(analysis.employee?.company_kod),
                ypokatasthma: normalizePrimitiveString(sourceRow?.ypokatasthma, 100),
                blocked_target_candidates_count: blockedTarget
                    ? analysis.semantic_proposal.blocked_target_candidates_count
                    : 0,
                blocked_target_reasons: blockedTarget
                    ? [...analysis.semantic_proposal.blocked_target_reasons]
                    : [],
                blocked_target_candidates: blockedTarget
                    ? analysis.semantic_proposal.blocked_target_candidates.map((candidate) => ({
                        prodhlomena_oraria_id: candidate.prodhlomena_oraria_id,
                        hmeromhnia: candidate.hmeromhnia,
                        current_category: candidate.current_category,
                        blocker_reasons: [...candidate.blocker_reasons]
                    }))
                    : [],
                investigation_guidance: noTarget
                    ? [...analysis.semantic_proposal.investigation_guidance]
                    : [],
                requires_hr_review: true,
                can_auto_apply: false,
                atomic_pair_required: false,
                runtime_apply_supported: false,
                apply_readiness: {
                    status: 'BLOCKED',
                    reason: noTarget
                        ? 'NO_TARGET_SCHEDULED_WORK_WITHOUT_CARDS'
                        : 'OFFSET_TARGET_BLOCKED'
                }
            } : null
        });
    }

    const policy = (dependencies.readPolicyContext || readPolicyContext)();
    const versions = { scenarioVersion, proposalVersion };
    if (!policy) {
        return invalidResult(
            analysis,
            'POLICY_CATALOG_NOT_MATERIALIZABLE',
            null,
            versions
        );
    }

    const rows = Array.isArray(weekRows) ? weekRows : [];
    const sourceMatch = findReferencedRow(rows, analysis.source, 'SOURCE');
    if (!sourceMatch.row) {
        return invalidResult(analysis, sourceMatch.reason, policy.metadata, versions);
    }
    const targetMatch = findReferencedRow(rows, analysis.target, 'TARGET');
    if (!targetMatch.row) {
        return invalidResult(analysis, targetMatch.reason, policy.metadata, versions);
    }

    const sourceId = normalizePrimitiveString(analysis.source?.prodhlomena_oraria_id, 100);
    const targetId = normalizePrimitiveString(analysis.target?.prodhlomena_oraria_id, 100);
    if (!sourceId) {
        return invalidResult(analysis, 'MISSING_SOURCE_RECORD_ID', policy.metadata, versions);
    }
    if (!targetId) {
        return invalidResult(analysis, 'MISSING_TARGET_RECORD_ID', policy.metadata, versions);
    }
    if (sourceId === targetId) {
        return invalidResult(analysis, 'DUPLICATE_PAIR_RECORD_ID', policy.metadata, versions);
    }

    const sourceMaterialization = materializeSourceValues(sourceMatch.row);
    if (!sourceMaterialization) {
        return invalidResult(
            analysis,
            'SOURCE_CARD_INTERVALS_NOT_MATERIALIZABLE',
            policy.metadata,
            versions
        );
    }
    if (sourceMaterialization.invalidHours) {
        return invalidResult(
            analysis,
            'SOURCE_CARD_HOURS_NOT_MATERIALIZABLE',
            policy.metadata,
            versions
        );
    }

    const targetCategory = normalizePrimitiveString(
        analysis.target?.semantic_target_category,
        10
    );
    if (!['ΑΝ', 'ΜΕ'].includes(targetCategory)) {
        return invalidResult(
            analysis,
            'TARGET_CATEGORY_NOT_MATERIALIZABLE',
            policy.metadata,
            versions
        );
    }
    const targetProposedValues = (
        dependencies.materializeTargetValues || materializeTargetValues
    )(targetCategory);
    if (
        !hasOnlyAllowedFields(sourceMaterialization.proposedValues, policy.allowedFields) ||
        !hasOnlyAllowedFields(targetProposedValues, policy.allowedFields)
    ) {
        return invalidResult(
            analysis,
            'PROPOSED_FIELD_NOT_ALLOWED',
            policy.metadata,
            versions
        );
    }

    const employeeKodikos = normalizePrimitiveString(analysis.employee?.kodikos, 100);
    const items = [
        {
            role: SOURCE_ROLE,
            prodhlomena_oraria_id: sourceId,
            employee_kodikos: employeeKodikos,
            hmeromhnia: analysis.source.hmeromhnia,
            current_category: analysis.source.current_category,
            current_apologistika_category: normalizePrimitiveString(
                resolveCurrentApologistikaDisplayCategory(sourceMatch.row, {
                    argiesByDateKey: holidayByDateKey
                }),
                20
            ),
            proposed_values: sourceMaterialization.proposedValues
        },
        {
            role: TARGET_ROLE,
            prodhlomena_oraria_id: targetId,
            employee_kodikos: employeeKodikos,
            hmeromhnia: analysis.target.hmeromhnia,
            current_category: analysis.target.current_category,
            current_apologistika_category: normalizePrimitiveString(
                resolveCurrentApologistikaDisplayCategory(targetMatch.row, {
                    argiesByDateKey: holidayByDateKey
                }),
                20
            ),
            proposed_values: targetProposedValues
        }
    ];

    return buildResult({
        analysis,
        proposalStatus: PROPOSAL_STATUS.READY,
        policyContext: policy.metadata,
        items,
        scenarioVersion,
        proposalVersion
    });
}

module.exports = {
    buildWeeklyRepoTransferSinglePairProposal,
    PROPOSAL_STATUS,
    PROPOSAL_VERSION,
    PROPOSAL_VERSION_V2,
    CHOICE_CODE
};
