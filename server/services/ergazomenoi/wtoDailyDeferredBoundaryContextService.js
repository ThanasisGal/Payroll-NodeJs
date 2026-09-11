'use strict';
const WorkflowState = require('../../models/apasxoliseisWeeklyHrWorkflowState');
const Decision = require('../../models/apasxoliseisWeeklyRepoTransferDecision');
const { deriveDeferredWeekScope } = require('./apasxoliseisEmploymentPeriodScopeService');
const { assessDeferredCrossPeriodRequirement, REQUIREMENT_STATUS } = require('./deferredCrossPeriodRepoAuthoritativeService');
const { startOfWeekMondayUtc, endOfWeekSundayUtc, dateKeyUtc } = require('../../utils/date/mondaySundayWeek');

function datesBetween(start, end) { const result = []; const cursor = new Date(`${start}T00:00:00Z`); const last = new Date(`${end}T00:00:00Z`);
    while (cursor <= last) { result.push(dateKeyUtc(cursor)); cursor.setUTCDate(cursor.getUTCDate() + 1); } return result; }
async function loadWtoDailyDeferredBoundaryContext({ scope, frozenSnapshot, session = {}, models = {}, assessor = assessDeferredCrossPeriodRequirement }) {
    const workflowModel = models.workflowModel || WorkflowState; const decisionModel = models.decisionModel || Decision;
    const periodStart = dateKeyUtc(scope.period_start); const periodEnd = dateKeyUtc(scope.period_end);
    const candidates = [{ weekStart: dateKeyUtc(startOfWeekMondayUtc(scope.period_end)), weekEnd: dateKeyUtc(endOfWeekSundayUtc(scope.period_end)) },
        { weekStart: dateKeyUtc(startOfWeekMondayUtc(scope.period_start)), weekEnd: dateKeyUtc(endOfWeekSundayUtc(scope.period_start)) }]
        .filter((item, index, all) => (item.weekStart < periodStart || item.weekEnd > periodEnd) && all.findIndex((other) => other.weekStart === item.weekStart) === index);
    const workflows = [];
    for (const boundary of candidates) workflows.push(...await workflowModel.find({ team: scope.team, company_kod: scope.company_kod,
        ypokatasthma: scope.ypokatasthma, week_start: new Date(`${boundary.weekStart}T00:00:00Z`),
        week_end: new Date(`${boundary.weekEnd}T00:00:00Z`) }).select('employee_id employee_kodikos week_start week_end').lean());
    const workflowKeys = new Set(workflows.map((item) => `${item.employee_id}|${dateKeyUtc(item.week_start)}`));
    for (const boundary of candidates) {
        const ownedRows = (frozenSnapshot?.daily_results || []).filter((row) =>
            String(row.ypokatasthma || '').padStart(4, '0') === String(scope.ypokatasthma).padStart(4, '0') &&
            dateKeyUtc(row.hmeromhnia) >= boundary.weekStart && dateKeyUtc(row.hmeromhnia) <= boundary.weekEnd);
        for (const row of ownedRows) {
            const employeeId = String(row.effective_profile_employee_id || '').trim();
            const key = `${employeeId}|${boundary.weekStart}`;
            if (!employeeId || workflowKeys.has(key)) continue;
            workflows.push({ employee_id: employeeId, employee_kodikos: String(row.kodikos || ''),
                week_start: new Date(`${boundary.weekStart}T00:00:00Z`),
                week_end: new Date(`${boundary.weekEnd}T00:00:00Z`) });
            workflowKeys.add(key);
        }
    }
    const derived = workflows.map((workflow) => deriveDeferredWeekScope({ scope: { ...scope, employee_id: workflow.employee_id,
        week_start: dateKeyUtc(workflow.week_start), week_end: dateKeyUtc(workflow.week_end) },
    periodScope: { period_start: periodStart, period_end: periodEnd }, employmentDateScope: {
        natural_week_start: dateKeyUtc(workflow.week_start), natural_week_end: dateKeyUtc(workflow.week_end),
        employment_owned_dates: datesBetween(dateKeyUtc(workflow.week_start), dateKeyUtc(workflow.week_end)),
        period_start: periodStart, period_end: periodEnd } })).filter(Boolean);
    const unique = [...new Map(derived.map((week) => [week.deferred_week_id, week])).values()];
    const assessed = await Promise.all(unique.map(async (week) => {
        let assessment;
        try { assessment = await assessor({ deferredWeekId: week.deferred_week_id,
            session: { userTeam: scope.team, companyInUse: scope.company_kod, ...session }, models }); }
        catch (error) { assessment = { requirement_status: REQUIREMENT_STATUS.REQUIRED,
            assessment_error: { code: error.code || 'DEFERRED_BOUNDARY_ASSESSMENT_FAILED', message: error.message } }; }
        return { ...week, requirement_status: Object.values(REQUIREMENT_STATUS)
            .includes(assessment.requirement_status) ? assessment.requirement_status : REQUIREMENT_STATUS.NOT_REQUIRED,
        current_period_dates: datesBetween(workflowBoundaryStart(week, periodStart), workflowBoundaryEnd(week, periodEnd)),
        next_period_context_dates: datesBetween(week.week_start, week.week_end),
        assessment_error: assessment.assessment_error || null };
    }));
    const ids = assessed.filter((week) => week.requirement_status === REQUIREMENT_STATUS.REQUIRED).map((week) => week.deferred_week_id);
    const decisions = ids.length ? await decisionModel.find({ team: scope.team, company_kod: scope.company_kod,
        ypokatasthma: scope.ypokatasthma, deferred_week_id: { $in: ids }, resolution_kind: 'DEFERRED_CROSS_PERIOD_REPO_RESOLUTION' }).lean() : [];
    return { deferredWeeks: assessed, decisions };
}
function workflowBoundaryStart(week, periodStart) { return week.week_start > periodStart ? week.week_start : periodStart; }
function workflowBoundaryEnd(week, periodEnd) { return week.week_end < periodEnd ? week.week_end : periodEnd; }
module.exports = { loadWtoDailyDeferredBoundaryContext };
