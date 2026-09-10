'use strict';

const assert = require('node:assert/strict');
const { getMondaySundayWeekRange, getNaturalWeekPeriodBoundary, addDaysUtc, dateKeyUtc } =
    require('../../utils/date/mondaySundayWeek');
const { deriveDeferredWeekScope, deriveEmploymentOwnedDateScope, DEFERRED_WEEK_STATUS,
    DEFERRED_WEEK_MESSAGE } = require('./apasxoliseisEmploymentPeriodScopeService');
const { resolveWeeklyHrWorkflow } = require('./apasxoliseisWeeklyHrWorkflowResolverService');
const { buildWeeklyHrWorkflowProjection } = require('./apasxoliseisWeeklyHrWorkflowProjectionService');
const { buildWeeklyHrLifecycleProjection, buildFinalizedWeeklyHrLifecyclePresentation } =
    require('./apasxoliseisWeeklyHrLifecycleProjectionService');
const { buildStage1Fingerprint } = require('./apasxoliseisStage1FingerprintService');
const { buildWeeklyRepoDeviationPreview } = require('./apasxoliseisWeeklyRepoDeviationPreviewService');
const { runPossibleLeaveRepoAutoRuntime } = require('./apasxoliseisPossibleLeaveRepoAutoRuntimeService');
const { buildWeeklyRepoPostCheckWritePlan } = require('./apasxoliseisWeeklyPostCheckWritePlanService');
const { buildWeeklyIllegalOvertimeUpdate } = require('./apasxoliseisWeeklyIllegalOvertimeCalculationService');

const periodScope = { period_start: '2026-06-01', period_end: '2026-06-30' };
const july = { period_start: '2026-07-01', period_end: '2026-07-31' };
const scope = { team: 'test', company_kod: 'company', ypokatasthma: '0001',
    employee_id: 'employee-a', employee_kodikos: '0001', week_start: '2026-06-29', week_end: '2026-07-05' };
const profile = { typos_apasxolhshs: '0', hmeres_ergasias_ebdomadas: 5,
    ores_ergasias_ebdomadas: 40, pososto_prosayxhshs_6hs_hmeras: 40,
    pragmatikoOromisthio: 10, nomimoOromisthio: 10 };
const rows = Array.from({ length: 7 }, (_, index) => ({ ...scope, _id: `row-${index}`,
    kodikos: scope.employee_kodikos, hmeromhnia: dateKeyUtc(addDaysUtc(scope.week_start, index)),
    kathgoria_ergasias: index < 5 ? 'ΕΡΓ' : 'ΑΝ', repo: index >= 5,
    kathgoria_ergasias_apologistika: index < 5 ? 'ΕΡΓ' : 'ΑΝ', repo_apologistika: index >= 5,
    ores_ergasias: index < 5 ? 8 : 0, ores_ergasias_apologistika: index < 5 ? 8 : 0,
    cards_ores_ergasias: index < 5 ? 8 : 0,
    cards_apo_ora_01: index < 5 ? '08:00' : '', cards_eos_ora_01: index < 5 ? '16:00' : '' }));
const current = [rows[0], { ...rows[1], cards_ores_ergasias: 0,
    cards_apo_ora_01: '', cards_eos_ora_01: '', kathgoria_ergasias_apologistika: '',
    kathgoria_adeias_apologistika: 'POSSIBLE_LEAVE', adeia_apologistika: false }];
const employment = period => deriveEmploymentOwnedDateScope({
    natural_week_start: scope.week_start, natural_week_end: scope.week_end, ...period });
const input = { weekRows: current, scope, periodScope, effectiveProfile: profile,
    employmentDateScope: employment(periodScope) };

for (const [end, day] of [['2026-08-31', 1], ['2026-06-30', 2], ['2026-09-30', 3],
    ['2026-12-31', 4], ['2026-07-31', 5], ['2026-10-31', 6], ['2026-05-31', 0]]) {
    const range = getMondaySundayWeekRange(end);
    const period = { period_start: `${end.slice(0, 7)}-01`, period_end: end };
    const boundary = getNaturalWeekPeriodBoundary({ ...period,
        week_start: range.weekStartKey, week_end: range.weekEndKey });
    assert.equal(boundary.is_trailing_week, day !== 0);
    assert.equal(boundary.current_period_dates.length, day || 7);
    assert.equal(boundary.next_period_context_dates.length, day ? 7 - day : 0);
    const deferred = deriveDeferredWeekScope({ scope: { ...scope,
        week_start: range.weekStartKey, week_end: range.weekEndKey }, periodScope: period });
    assert.equal(deferred?.status === DEFERRED_WEEK_STATUS, day !== 0);
}
assert.equal(getNaturalWeekPeriodBoundary({ ...periodScope,
    week_start: '2026-06-30', week_end: '2026-07-05' }), null);
assert.equal(deriveDeferredWeekScope({ scope, periodScope: {
    period_start: '2026-06-15', period_end: '2026-06-30' } }), null);

assert.equal(buildWeeklyHrLifecycleProjection({ ...input, weekRows: rows }).deferred_week.status, DEFERRED_WEEK_STATUS);
assert.equal(buildWeeklyHrLifecycleProjection({ ...input, weekRows: rows }).stages.stage1.business_status, DEFERRED_WEEK_STATUS);
assert.equal(buildWeeklyHrLifecycleProjection(input).requires_hr_action, false);
const before = JSON.stringify(current);
const result = buildWeeklyHrLifecycleProjection(input);
assert.equal(result.deferred_week.status, DEFERRED_WEEK_STATUS);
assert.equal(result.deferred_week.display_message, DEFERRED_WEEK_MESSAGE);
assert.deepEqual(result.deferred_week.current_period_dates, ['2026-06-29', '2026-06-30']);
assert.deepEqual(result.deferred_week.next_period_context_dates,
    ['2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04', '2026-07-05']);
assert.deepEqual(result.deferred_week.current_period_writable_dates, ['2026-06-29', '2026-06-30']);
assert.equal(result.requires_hr_action, false);
assert.equal(result.total_pending_count, 0);
assert.equal(result.deferred_action_required, true);
assert.deepEqual(result.deferred_possible_leave_dates, ['2026-06-30']);
assert.ok(Object.values(result.stages).every(stage => stage.business_status === DEFERRED_WEEK_STATUS));
assert.equal(JSON.stringify(current), before);
assert.deepEqual(buildWeeklyHrLifecycleProjection(input), result);
assert.equal(buildFinalizedWeeklyHrLifecyclePresentation(result).deferred_action_required, true);

const workflow = resolveWeeklyHrWorkflow({ weekRows: current, effectiveProfile: profile, scope,
    period_scope: periodScope, leave_classification_completed: true });
assert.equal(workflow.next_required_hr_stage, DEFERRED_WEEK_STATUS);
assert.equal(workflow.repo_transfer_allowed, false);
assert.deepEqual(workflow.repo_transfer_candidates, []);
assert.equal(workflow.current_period_hr_action_required_for_this_reason, false);
assert.equal(buildWeeklyHrWorkflowProjection({ weekRows: current, effectiveProfile: profile,
    scope, period_scope: periodScope }).workflow.next_required_hr_stage, DEFERRED_WEEK_STATUS);

for (const changed of [current.slice(1), [current[0], current[0]],
    [{ ...current[0], cards_eos_ora_01: '' }, current[1]],
    [{ ...current[0], cards_ores_ergasias: -1 }, current[1]],
    [{ ...current[0], repo_apologistika: true }, current[1]]]) {
    const blocked = buildWeeklyHrLifecycleProjection({ ...input, weekRows: changed });
    assert.equal(blocked.requires_hr_action, true);
    assert.equal(blocked.stages.stage1.business_status, 'BLOCKED');
    assert.ok(blocked.total_pending_count > 0);
    assert.equal(blocked.deferred_action_required, true);
}
const stale = buildWeeklyHrLifecycleProjection({ ...input, persistedStage1State: {
    status: 'COMPLETED', completion_fingerprint: buildStage1Fingerprint(rows).fingerprint } });
assert.equal(stale.stages.stage1.business_status, 'STALE');
assert.equal(stale.requires_hr_action, true);
assert.equal(buildWeeklyHrLifecycleProjection({ ...input, effectiveProfile: {
    ...profile, resolution_blocked: true, resolution_reason: 'PROFILE_CONFLICT' } }).requires_hr_action, true);
assert.equal(buildWeeklyHrLifecycleProjection({ ...input,
    stage2StateDiagnostic: 'STAGE2_DECISION_STATE_UNAVAILABLE' }).requires_hr_action, true);

const handoff = deriveDeferredWeekScope({ scope, periodScope: july });
assert.equal(handoff.deferred_week_id, result.deferred_week.deferred_week_id);
assert.equal(handoff.handoff_from_previous_period, true);
assert.deepEqual(handoff.previous_period_context_dates, ['2026-06-29', '2026-06-30']);
assert.deepEqual(handoff.previous_period_writable_dates, []);
assert.deepEqual(handoff.current_period_writable_dates, result.deferred_week.next_period_context_dates);
assert.notEqual(deriveDeferredWeekScope({ scope: { ...scope, employee_id: 'employee-b' }, periodScope })
    .deferred_week_id, result.deferred_week.deferred_week_id);
assert.notEqual(deriveDeferredWeekScope({ scope: { ...scope, ypokatasthma: '0002' }, periodScope })
    .deferred_week_id, result.deferred_week.deferred_week_id);
const julyProjection = buildWeeklyHrLifecycleProjection({ ...input, weekRows: rows,
    periodScope: july, employmentDateScope: employment(july) });
assert.equal(julyProjection.deferred_week.status, 'READ_ONLY_HANDOFF');
assert.deepEqual(julyProjection.employment_date_scope.employment_owned_dates,
    rows.map(row => row.hmeromhnia));
assert.notEqual(julyProjection.stages.stage1.business_status, DEFERRED_WEEK_STATUS);

const fullWeekRows = rows.map((row, index) => ({ ...row,
    hmeromhnia: dateKeyUtc(addDaysUtc('2026-06-15', index)) }));
assert.equal(buildWeeklyHrLifecycleProjection({ weekRows: fullWeekRows, effectiveProfile: profile,
    scope: { ...scope, week_start: '2026-06-15', week_end: '2026-06-21' } }).requires_hr_action, false);
assert.equal(resolveWeeklyHrWorkflow({ weekRows: [...current, ...rows.slice(2)],
    effectiveProfile: profile }).next_required_hr_stage, 'LEAVE_CLASSIFICATION');

const preview = buildWeeklyRepoDeviationPreview({ rows: current,
    periodStart: periodScope.period_start, periodEnd: periodScope.period_end,
    asOfDate: periodScope.period_end, resolveWeeklyProfile: () => ({ effectiveProfile: profile }) });
assert.equal(preview.pendingWeeks[0].status, DEFERRED_WEEK_STATUS);
assert.equal(preview.pendingWeeks[0].is_deviation, false);
const brokenPreview = buildWeeklyRepoDeviationPreview({ rows: current.slice(1),
    periodStart: periodScope.period_start, periodEnd: periodScope.period_end,
    asOfDate: periodScope.period_end, resolveWeeklyProfile: () => ({ effectiveProfile: profile }) });
assert.ok(brokenPreview.deviations[0].reasons.includes('INCOMPLETE_NATURAL_WEEK'));

// Real pure write planner: inspect the plan, never execute it.
for (const period of [periodScope, july]) {
    const plan = buildWeeklyRepoPostCheckWritePlan({ sessionTeam: scope.team,
        companyId: scope.company_kod, apoDate: new Date(period.period_start), eosDate: new Date(period.period_end),
        employees: [{ ...profile, kodikos: scope.employee_kodikos }], rows,
        weeklyContextRows: rows, resolveProfileForDate: () => profile, buildWeeklyIllegalOvertimeUpdate });
    const written = plan.bulkOps.map(op => rows.find(row => row._id === op.updateOne.filter._id).hmeromhnia);
    assert.deepEqual(written, rows.filter(row => row.hmeromhnia >= period.period_start &&
        row.hmeromhnia <= period.period_end).map(row => row.hmeromhnia));
}

(async () => {
    let calls = 0;
    const runtime = await runPossibleLeaveRepoAutoRuntime({ rows, periodScope,
        createDecision: async () => { calls++; throw Error('Unexpected decision'); },
        applyDecision: async () => { calls++; throw Error('Unexpected apply'); } });
    assert.equal(calls, 0);
    assert.equal(runtime.results[0].status, DEFERRED_WEEK_STATUS);
    assert.equal(runtime.results[0].repo_transfer_applied, false);
    // A previously approved same-month pair remains applicable. In July, June is read-only.
    const pairRows = rows.map(row => ({ ...row }));
    Object.assign(pairRows[0], { kathgoria_ergasias: 'ΑΝ', repo: true });
    Object.assign(pairRows[1], current[1]);
    const approval = { _id: 'approval', team: scope.team, company_kod: scope.company_kod,
        ypokatasthma: scope.ypokatasthma, reuse_scope: 'FUTURE_IDENTICAL', reuse_status: 'ACTIVE',
        decision_status: 'RECORDED', decision_type: 'APPROVE_PROPOSAL',
        items: [{ role: 'SOURCE_BECOMES_WORK', kathgoria_ergasias: 'ΑΝ', cards_ores_ergasias: 8,
            proposed_values: { kathgoria_ergasias_apologistika: 'ΕΡΓ' } }] };
    const group = { group_id: 'pair', pair_contract: { proposal_version: 'test',
        choice_code: 'TRANSFER_REPO_WITHIN_WEEK_SINGLE_PAIR' }, items: [
        { role: 'SOURCE_BECOMES_WORK', prodhlomena_oraria_id: pairRows[0]._id },
        { role: 'TARGET_BECOMES_REPO', prodhlomena_oraria_id: pairRows[1]._id }] };
    const options = { rows: pairRows, groups: [group], approvals: [approval],
        createDecision: async () => { calls++; return { id: 'in-memory' }; },
        applyDecision: async () => { calls++; return { id: 'in-memory' }; } };
    const previousPair = await runPossibleLeaveRepoAutoRuntime({ ...options, periodScope: july });
    assert.equal(calls, 0);
    assert.deepEqual(previousPair.results[0].reasons, ['REPO_PAIR_OUTSIDE_WRITABLE_PERIOD']);
    const sameMonth = await runPossibleLeaveRepoAutoRuntime({ ...options, periodScope,
        rows: pairRows.map((row, index) => ({ ...row,
            hmeromhnia: dateKeyUtc(addDaysUtc('2026-06-15', index)) })) });
    assert.equal(sameMonth.results[0].status, 'AUTO_APPLIED');
    assert.equal(calls, 2);
    console.log('PASS deferred trailing week: boundaries, lifecycle, blockers, handoff and write scope');
})().catch(error => { console.error(error); process.exitCode = 1; });
