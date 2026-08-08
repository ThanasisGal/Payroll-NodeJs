'use strict';

const { dateKeyUtc } = require('../../utils/date/mondaySundayWeek');
const { resolveDailyActualWorkFacts } = require('./apasxoliseisDailyActualWorkFactsService');
const { POLICY_VERSION, resolveCurrentRepoCandidateIdentities } =
    require('./apasxoliseisWeeklySixthSeventhDayPolicyService');

const SOURCE_VERSION = 'weekly-post-check-canonical-decision-input:v1';

function id(value) { return String(value?._id ?? value ?? '').trim(); }

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
    profileHistory = [], automaticAnalysis = {}, appliedProtectionContext
} = {}) {
    const rows = [...weekRows].sort((a, b) => dateKeyUtc(a.hmeromhnia).localeCompare(dateKeyUtc(b.hmeromhnia)));
    const actualFacts = Object.fromEntries(rows.map((row) => [
        dateKeyUtc(row.hmeromhnia), resolveDailyActualWorkFacts(row)
    ]));
    const currentRepoIdentities = resolveCurrentRepoCandidateIdentities({
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
        profile_history: profileHistory,
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
    for (const record of records) {
        const key = weeklyCanonicalDecisionGroupKey(record);
        if (!result.has(key)) result.set(key, []);
        result.get(key).push(record);
    }
    return result;
}

module.exports = {
    SOURCE_VERSION,
    normalizeAppliedAtomicRepoTransfer,
    buildWeeklyCanonicalDecisionSnapshotInput,
    weeklyCanonicalDecisionGroupKey,
    groupWeeklyCanonicalDecisions
};
