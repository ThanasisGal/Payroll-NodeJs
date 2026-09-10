const { startOfWeekMondayUtc, dateKeyUtc, endOfWeekSundayUtc } = require('../../utils/date/mondaySundayWeek');
const { deriveDeferredWeekScope, isDeferredWeekPending, DEFERRED_WEEK_STATUS } = require('./apasxoliseisEmploymentPeriodScopeService');
const {
    resolveUniquePossibleLeaveTransfer
} = require('./apasxoliseisPossibleLeaveRepoAutoResolutionService');

function text(value) { return String(value ?? '').trim(); }
function id(value) { return text(value?._id ?? value); }
function groupRowsByEmployeeWeek(rows = []) {
    const grouped = new Map();
    for (const row of rows) {
        const key = JSON.stringify([text(row.team), text(row.company_kod), text(row.ypokatasthma),
            text(row.employee_id), text(row.kodikos), dateKeyUtc(startOfWeekMondayUtc(row.hmeromhnia))]);
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key).push(row);
    }
    return [...grouped.values()];
}
function groupForPair(groups, resolution) {
    return (groups || []).find((group) => {
        const ids = new Set((group.items || []).map((item) => id(item.prodhlomena_oraria_id)));
        return ids.has(id(resolution.source)) && ids.has(id(resolution.target));
    }) || null;
}
function commandForGroup(group, identity) {
    const source = group.items.find((item) => item.role === 'SOURCE_BECOMES_WORK');
    const target = group.items.find((item) => item.role === 'TARGET_BECOMES_REPO');
    return {
        proposal_id: group.group_id,
        expected_source_id: id(source.prodhlomena_oraria_id),
        expected_target_id: id(target.prodhlomena_oraria_id),
        expected_proposal_version: group.pair_contract.proposal_version,
        expected_choice_code: group.pair_contract.choice_code,
        decision_code: 'APPROVE_PROPOSAL',
        notes: 'Αυτόματη μεταφορά ρεπό βάσει παλαιότερης έγκρισης HR.',
        request_id: `auto-decision-${identity.slice(0, 64)}`
    };
}
async function runPossibleLeaveRepoAutoRuntime({
    rows = [], groups = [], approvals = [], appliedExecutions = [],
    createDecision, applyDecision, periodScope = null
}) {
    if (typeof createDecision !== 'function' || typeof applyDecision !== 'function') {
        throw new TypeError('Existing decision and atomic apply callbacks are required.');
    }
    const persistedIdentities = new Set(appliedExecutions.map((execution) =>
        text(execution.authorization_metadata?.atomic_pair_identity)).filter(Boolean));
    const results = [];
    for (const weekRows of groupRowsByEmployeeWeek(rows)) {
        const first = weekRows[0];
        const boundary = deriveDeferredWeekScope({ periodScope, scope: { ...first,
            week_start: startOfWeekMondayUtc(first.hmeromhnia),
            week_end: endOfWeekSundayUtc(first.hmeromhnia) } });
        if (isDeferredWeekPending({ boundary })) {
            results.push({ status: DEFERRED_WEEK_STATUS, deferred_week: boundary,
                deferred_action_required: true, repo_transfer_applied: false });
            continue;
        }
        const resolution = resolveUniquePossibleLeaveTransfer({
            weekRows, approvals, appliedPairIdentities: persistedIdentities
        });
        if (resolution.status !== 'AUTO_RESOLVED') {
            results.push(resolution);
            continue;
        }
        if (periodScope && [resolution.source, resolution.target].some(row =>
            dateKeyUtc(row.hmeromhnia) < dateKeyUtc(periodScope.period_start) ||
            dateKeyUtc(row.hmeromhnia) > dateKeyUtc(periodScope.period_end))) {
            results.push({ status: 'NEEDS_HR', reasons: ['REPO_PAIR_OUTSIDE_WRITABLE_PERIOD'],
                repo_transfer_applied: false });
            continue;
        }
        const group = groupForPair(groups, resolution);
        const unsafeGroup = group && (
            group.reusable_conflict === true ||
            (group.atomic_reusable_diagnostics || []).some((code) =>
                !['ATOMIC_REUSABLE_NO_ACTIVE_MATCH', 'ATOMIC_REUSABLE_MATCHED',
                    'ATOMIC_LINKED_SET_ELIGIBLE'].includes(code)) ||
            (group.items || []).some((item) => item.flags?.is_locked === true ||
                item.flags?.has_manual_override === true || item.flags?.current_eligible === false)
        );
        if (!group || unsafeGroup) {
            results.push({ status: 'NEEDS_HR', reasons: ['ATOMIC_PROPOSAL_NOT_CANONICAL'] });
            continue;
        }
        const decision = await createDecision({
            command: commandForGroup(group, resolution.atomic_pair_identity),
            authorization_metadata: resolution.audit,
            group
        });
        const applied = await applyDecision({
            decision_id: decision.id,
            request_id: `auto-apply-${resolution.atomic_pair_identity.slice(0, 64)}`,
            authorization_metadata: resolution.audit,
            group
        });
        persistedIdentities.add(resolution.atomic_pair_identity);
        results.push({ status: 'AUTO_APPLIED', decision, execution: applied,
            automatic_resolution: resolution.audit });
    }
    return { approval_queries: 0, execution_queries: 0, results };
}

module.exports = {
    groupRowsByEmployeeWeek, groupForPair, commandForGroup,
    runPossibleLeaveRepoAutoRuntime
};
