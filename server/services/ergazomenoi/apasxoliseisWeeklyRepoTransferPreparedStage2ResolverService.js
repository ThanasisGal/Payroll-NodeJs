'use strict';

const { buildWeeklyRepoTransferAtomicPageProjection } = require(
    './apasxoliseisWeeklyRepoTransferAtomicPageProjectionService');
const { buildCanonicalSnapshot, fingerprintSnapshot } = require(
    './apasxoliseisWeeklyRepoTransferDecisionReconstructionService');
const { dateKeyUtc } = require('../../utils/date/mondaySundayWeek');

function text(value, max = 100) { return String(value ?? '').trim().slice(0, max); }
function presentation(record, fingerprint) {
    return { id: String(record._id || ''), decision_code: record.decision_code,
        decision_status: record.decision_status, notes: record.notes || '',
        created_by_user_name: record.created_by_user_name || '',
        created_at: record.created_at || null, employee_kodikos: record.employee_kodikos || '',
        week_start: record.week_start || null, week_end: record.week_end || null,
        is_current: Boolean(fingerprint && record.snapshot_fingerprint === fingerprint) };
}
function executionPresentation(execution) {
    return execution ? { id: String(execution._id || ''),
        decision_id: String(execution.decision_id || ''),
        execution_status: execution.execution_status, applied_at: execution.applied_at || null,
        created_by_user_name: execution.created_by_user_name || '',
        authorization_metadata: execution.authorization_metadata || null } : null;
}
function appliedHistoryPresentation(decision, execution, employee = null) {
    if (!decision || !execution || execution.execution_status !== 'APPLIED') return null;
    const snapshot = decision.canonical_snapshot || {};
    const source = snapshot.source || {}; const target = snapshot.target || {};
    const after = execution.after_snapshot || {};
    return { decision_id: String(decision._id || ''), execution_id: String(execution._id || ''),
        proposal_id: String(decision.proposal_id || ''),
        employee_id: String(decision.employee_id || snapshot.employee_id || ''),
        employee_kodikos: text(decision.employee_kodikos || snapshot.employee_kodikos, 50),
        employee_name: [text(employee?.eponymo, 100), text(employee?.onoma, 100)]
            .filter(Boolean).join(' '), week_start: decision.week_start || snapshot.week_start || null,
        week_end: decision.week_end || snapshot.week_end || null,
        source: { prodhlomena_oraria_id: String(decision.source_prodhlomena_oraria_id ||
                source.prodhlomena_oraria_id || ''), hmeromhnia: source.hmeromhnia || null,
            result: text(after.source?.kathgoria_ergasias_apologistika ||
                source.proposed_values?.kathgoria_ergasias_apologistika, 20) },
        target: { prodhlomena_oraria_id: String(decision.target_prodhlomena_oraria_id ||
                target.prodhlomena_oraria_id || ''), hmeromhnia: target.hmeromhnia || null,
            result: text(after.target?.kathgoria_ergasias_apologistika ||
                target.proposed_values?.kathgoria_ergasias_apologistika, 20),
            repo_apologistika: after.target?.repo_apologistika === true ||
                target.proposed_values?.repo_apologistika === true },
        applied_at: execution.applied_at || null,
        applied_by_user_name: text(execution.created_by_user_name, 200),
        ...(execution.authorization_metadata
            ? { automatic_resolution: execution.authorization_metadata } : {}) };
}
function applyCapability({ applyState, runtimeEnabled, indexReady, context = null }) {
    const canApply = applyState === 'READY_TO_APPLY';
    return { apply_state: applyState, can_apply: canApply, apply_allowed: canApply,
        apply_readiness: { status: canApply ? 'READY' : 'BLOCKED',
            reason: canApply ? null : applyState }, runtime_enabled: runtimeEnabled === true,
        index_ready: indexReady === true, apply_context: context };
}

function resolveWeeklyRepoTransferDecisionFromPreparedWeek({ weeklyInput, scope = {},
    canonicalDecisionContext = {}, decisions = [], executions = [], applyProtection = {},
    presentationStart = null, presentationEnd = null,
    canonicalSnapshotBuilder = buildCanonicalSnapshot,
    snapshotFingerprintBuilder = fingerprintSnapshot } = {}) {
    const projection = buildWeeklyRepoTransferAtomicPageProjection({
        weeklyInputs: weeklyInput ? [weeklyInput] : []
    }, { presentationStart, presentationEnd });
    const group = projection.groups[0] || null;
    if (!group) return { record: null, projection, fingerprint: null, group: null };
    const sourceItem = group.items.find((item) => item.role === 'SOURCE_BECOMES_WORK') || {};
    const targetItem = group.items.find((item) => item.role === 'TARGET_BECOMES_REPO') || {};
    const weekRows = weeklyInput.weekRows || [];
    const context = { ...canonicalDecisionContext,
        candidates: [sourceItem, targetItem].map((item) => weekRows.find((row) =>
            String(row._id) === String(item.prodhlomena_oraria_id))), weekRows,
        employmentProfile: weeklyInput.employmentProfile,
        holidayByDateKey: weeklyInput.holidayByDateKey || new Map(),
        week: { start: group.group_key.match(/week=([^:|]+)/)?.[1],
            end: group.group_key.match(/week=[^:|]+:([^|]+)/)?.[1] } };
    const fingerprint = snapshotFingerprintBuilder(canonicalSnapshotBuilder({ scope, context, group }));
    const proposalDecisions = decisions.filter((decision) =>
        String(decision.proposal_id || '') === String(group.group_id || ''));
    const executionByDecisionId = new Map(executions.map((execution) =>
        [String(execution.decision_id || ''), execution]));
    const history = proposalDecisions.map((decision) => presentation(decision, fingerprint));
    const rawCurrent = proposalDecisions.find((decision) =>
        decision.snapshot_fingerprint === fingerprint) || null;
    const currentDecisionExecution = rawCurrent
        ? executionByDecisionId.get(String(rawCurrent._id)) || null : null;
    const executedDecision = proposalDecisions.find((decision) =>
        executionByDecisionId.has(String(decision._id))) || null;
    const execution = executedDecision
        ? executionByDecisionId.get(String(executedDecision._id)) || null : null;
    let applyState = 'NOT_APPROVED';
    if (execution) applyState = 'ALREADY_APPLIED';
    else if (rawCurrent?.decision_code === 'APPROVE_PROPOSAL' &&
        rawCurrent?.decision_status === 'RECORDED') {
        if (applyProtection.authorized !== true) applyState = 'NOT_AUTHORIZED';
        else if (applyProtection.runtimeEnabled !== true) applyState = 'RUNTIME_DISABLED';
        else if (applyProtection.indexReady !== true) applyState = 'INDEXES_NOT_READY';
        else applyState = 'READY_TO_APPLY';
    } else if (!rawCurrent && proposalDecisions.some((decision) =>
        decision.decision_code === 'APPROVE_PROPOSAL')) applyState = 'STALE_DECISION';
    const applyContext = rawCurrent ? { team: text(rawCurrent.team || scope.team, 50),
        company_kodikos: text(scope.company_kodikos, 50),
        ypokatasthma: text(rawCurrent.ypokatasthma || scope.ypokatasthma, 20),
        week_start: rawCurrent.week_start || null, week_end: rawCurrent.week_end || null } : null;
    const start = context.week.start || ''; const end = context.week.end || '';
    const inside = !presentationStart || !presentationEnd ||
        (start >= dateKeyUtc(presentationStart) && end <= dateKeyUtc(presentationEnd));
    return { projection, fingerprint, group, record: { proposal_id: group.group_id,
        current_proposal_fingerprint: fingerprint,
        current_decision_fingerprint: rawCurrent?.snapshot_fingerprint || null,
        current_proposal: { employee_kodikos: text(sourceItem.employee_kodikos ||
                targetItem.employee_kodikos, 50), week_start: inside ? start : null,
            week_end: inside ? end : null,
            command: { proposal_id: group.group_id,
                expected_source_id: String(sourceItem.prodhlomena_oraria_id || ''),
                expected_target_id: String(targetItem.prodhlomena_oraria_id || ''),
                expected_proposal_version: String(group.pair_contract?.proposal_version || ''),
                expected_choice_code: String(group.pair_contract?.choice_code || '') },
            source: { prodhlomena_oraria_id: String(sourceItem.prodhlomena_oraria_id || ''),
                current_category: String(sourceItem.kathgoria_ergasias || ''),
                proposed_values: { ...(sourceItem.proposed_values || {}) },
                proposed_classification: String(sourceItem.proposed_values
                    ?.kathgoria_ergasias_apologistika || '') },
            target: { prodhlomena_oraria_id: String(targetItem.prodhlomena_oraria_id || ''),
                current_category: String(targetItem.kathgoria_ergasias || ''),
                proposed_values: { ...(targetItem.proposed_values || {}) },
                proposed_classification: String(targetItem.proposed_values
                    ?.kathgoria_ergasias_apologistika || '') } },
        current_decision_execution: executionPresentation(currentDecisionExecution),
        current_decision: history.find((decision) => decision.is_current) || null,
        current_execution: executionPresentation(execution),
        applied_history: appliedHistoryPresentation(executedDecision, execution,
            canonicalDecisionContext.employee),
        ...applyCapability({ applyState, runtimeEnabled: applyProtection.runtimeEnabled,
            indexReady: applyProtection.indexReady, context: applyContext }),
        history, history_count: history.length } };
}

function buildAppliedOnlyWeeklyRepoTransferDecisionRecords({ decisions = [], executions = [],
    currentProposalIds = new Set(), employeeByCode = new Map(), applyProtection = {} } = {}) {
    const executionByDecisionId = new Map(executions.map((execution) =>
        [String(execution.decision_id || ''), execution]));
    const grouped = new Map();
    decisions.forEach((decision) => { const id = String(decision.proposal_id || '');
        if (!grouped.has(id)) grouped.set(id, []); grouped.get(id).push(decision); });
    return [...grouped.entries()].filter(([id, values]) => !currentProposalIds.has(id) &&
        values.some((value) => executionByDecisionId.has(String(value._id))))
        .map(([proposalId, values]) => { const decision = values.find((value) =>
            executionByDecisionId.has(String(value._id)));
        const execution = executionByDecisionId.get(String(decision._id));
        const history = values.map((value) => presentation(value, null));
        return { proposal_id: proposalId, current_decision: null,
            current_execution: executionPresentation(execution),
            applied_history: appliedHistoryPresentation(decision, execution,
                employeeByCode.get(text(decision?.employee_kodikos))),
            ...applyCapability({ applyState: 'ALREADY_APPLIED',
                runtimeEnabled: applyProtection.runtimeEnabled,
                indexReady: applyProtection.indexReady }), history, history_count: history.length };
    }).sort((left, right) => new Date(right.current_execution.applied_at || 0) -
        new Date(left.current_execution.applied_at || 0));
}

function resolveWeeklyRepoTransferStage2StateFromPreparedBatch({ records = [], scope = {} } = {}) {
    const code = String(scope.employee_kodikos || '').trim();
    const start = dateKeyUtc(scope.week_start); const end = dateKeyUtc(scope.week_end);
    if (!code || !start || !end) return null;
    return records.find((record) => Boolean(record?.current_proposal_fingerprint) &&
        String(record.current_proposal?.employee_kodikos || '').trim() === code &&
        dateKeyUtc(record.current_proposal?.week_start) === start &&
        dateKeyUtc(record.current_proposal?.week_end) === end) || null;
}

module.exports = { resolveWeeklyRepoTransferDecisionFromPreparedWeek,
    buildAppliedOnlyWeeklyRepoTransferDecisionRecords,
    resolveWeeklyRepoTransferStage2StateFromPreparedBatch, appliedHistoryPresentation };
