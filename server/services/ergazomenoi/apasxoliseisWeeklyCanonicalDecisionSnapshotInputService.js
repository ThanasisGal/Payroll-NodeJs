'use strict';

const { dateKeyUtc } = require('../../utils/date/mondaySundayWeek');
const { resolveDailyActualWorkFacts } = require('./apasxoliseisDailyActualWorkFactsService');
const { POLICY_VERSION, resolveSafeHumanRepoCandidateIdentities } =
    require('./apasxoliseisWeeklySixthSeventhDayPolicyService');

const SOURCE_VERSION = 'weekly-post-check-canonical-decision-input:v1';

function id(value) { return String(value?._id ?? value ?? '').trim(); }

function dateOrNull(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function selectRelevantProfileHistory(profileHistory = [], week = {}) {
    const start = dateOrNull(week?.naturalWeekStart || week?.weekStart);
    const end = dateOrNull(week?.naturalWeekEnd || week?.weekEnd);
    if (!start || !end) return [];
    return (Array.isArray(profileHistory) ? profileHistory : []).filter((row) => {
        const termsStart = dateOrNull(row.hmeromhnia_isxyos_oron_ergasias_apo);
        const termsEnd = dateOrNull(row.hmeromhnia_isxyos_oron_ergasias_eos);
        if (termsStart) return termsStart <= end && (!termsEnd || termsEnd >= start);
        const scheduleStart = dateOrNull(row.hmeromhnia_allaghs_orarioy_apo);
        const scheduleEnd = dateOrNull(row.hmeromhnia_allaghs_orarioy_eos);
        if (scheduleStart) return scheduleStart <= end && (!scheduleEnd || scheduleEnd >= start);
        const contractChange = dateOrNull(row.hmeromhnia_allaghs_symbashs);
        return Boolean(contractChange && contractChange <= end);
    });
}

function normalizeAppliedAtomicRepoTransfer({ weekRows = [], protectionContext } = {}) {
    const entries = weekRows.map((row) => protectionContext?.entriesByRowId?.[id(row)]).filter(Boolean);
    if (!entries.length) return null;
    const executionIds = [...new Set(entries.map((entry) => id(entry.executionId)).filter(Boolean))].sort();
    return {
        execution_id: executionIds.length === 1 ? executionIds[0] : null,
        execution_ids: executionIds,
        has_conflict: entries.some((entry) => entry.state === 'CONFLICT') || executionIds.length !== 1,
        protected_rows: entries.map((entry) => ({
            row_id: id(entry.rowId), execution_id: id(entry.executionId), role: String(entry.role || ''),
            repo_apologistika: entry.repo_apologistika,
            kathgoria_ergasias_apologistika: entry.kathgoria_ergasias_apologistika
        })).sort((a, b) => a.row_id.localeCompare(b.row_id))
    };
}

function buildWeeklyCanonicalDecisionSnapshotInput({
    team, company_kod, employee = {}, week, weekRows = [], effectiveProfile = {},
    profileHistory = [], automaticAnalysis = {}, appliedProtectionContext,
    calculatedWorkHoursAuthoritative = false
} = {}) {
    const rows = [...weekRows].sort((a, b) => dateKeyUtc(a.hmeromhnia).localeCompare(dateKeyUtc(b.hmeromhnia)));
    const actualFacts = Object.fromEntries(rows.map((row) => [
        dateKeyUtc(row.hmeromhnia), resolveDailyActualWorkFacts(row, {
            calculatedWorkHoursAuthoritative
        })
    ]));
    const currentRepoIdentities = resolveSafeHumanRepoCandidateIdentities({
        weekRows: rows, effectiveProfile
    });
    return {
        team,
        company_kod,
        ypokatasthma: String(employee.ypokatasthma || rows[0]?.ypokatasthma || '').trim(),
        employee_kodikos: String(employee.kodikos || rows[0]?.kodikos || '').trim(),
        employee_id: id(employee),
        week_start: dateKeyUtc(week?.naturalWeekStart || week?.weekStart),
        week_end: dateKeyUtc(week?.naturalWeekEnd || week?.weekEnd),
        weekly_rows: rows,
        current_repo_identities: currentRepoIdentities,
        actual_work_facts: actualFacts,
        effective_profile: effectiveProfile,
        profile_history: selectRelevantProfileHistory(profileHistory, week),
        canonical_status: automaticAnalysis.status,
        canonical_reasons: automaticAnalysis.reasons,
        policy_version: automaticAnalysis.policyVersion || POLICY_VERSION,
        source_version: SOURCE_VERSION,
        applied_atomic_repo_transfer: normalizeAppliedAtomicRepoTransfer({
            weekRows: rows, protectionContext: appliedProtectionContext
        })
    };
}

function weeklyCanonicalDecisionGroupKey({ ypokatasthma, employee_kodikos, week_start, week_end } = {}) {
    return [String(ypokatasthma || '').trim(), String(employee_kodikos || '').trim(),
        dateKeyUtc(week_start), dateKeyUtc(week_end)].join('|');
}

function groupWeeklyCanonicalDecisions(records = []) {
    const result = new Map();
    const reusable = [];
    for (const record of records) {
        if (record?.reuse_scope === 'FUTURE_IDENTICAL') {
            reusable.push(record);
            continue;
        }
        const key = weeklyCanonicalDecisionGroupKey(record);
        if (!result.has(key)) result.set(key, []);
        result.get(key).push(record);
    }
    if (reusable.length) result.set('__REUSABLE__', reusable);
    return result;
}

module.exports = {
    SOURCE_VERSION,
    selectRelevantProfileHistory,
    normalizeAppliedAtomicRepoTransfer,
    buildWeeklyCanonicalDecisionSnapshotInput,
    weeklyCanonicalDecisionGroupKey,
    groupWeeklyCanonicalDecisions
};
