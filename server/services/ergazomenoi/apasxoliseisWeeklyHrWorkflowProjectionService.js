'use strict';

const { dateKeyUtc } = require('../../utils/date/mondaySundayWeek');
const { buildStage1Fingerprint, resolveStage1Status } = require(
    './apasxoliseisStage1FingerprintService'
);
const { resolveWeeklyHrWorkflow } = require('./apasxoliseisWeeklyHrWorkflowResolverService');

function uniqueDates(rows, predicate) {
    return [...new Set((rows || []).filter(predicate)
        .map((row) => dateKeyUtc(row?.hmeromhnia)).filter(Boolean))].sort();
}

function deriveStoredStage1Decisions(weekRows = []) {
    return Object.freeze({
        confirmed_leave_dates: Object.freeze(uniqueDates(weekRows, (row) =>
            row?.adeia_apologistika === true &&
            String(row?.kathgoria_adeias_apologistika || '').trim() !== '' &&
            String(row?.kathgoria_adeias_apologistika || '').trim() !== 'POSSIBLE_LEAVE')),
        confirmed_sickness_dates: Object.freeze(uniqueDates(weekRows,
            (row) => row?.astheneia_apologistika === true)),
        confirmed_absence_dates: Object.freeze(uniqueDates(weekRows,
            (row) => row?.apousia_apologistika === true))
    });
}

// The weekly resolver validates classifications against its POSSIBLE_LEAVE input set.
// Re-present already persisted Stage-1 decisions as reviewed candidates; the authoritative
// outcome remains exclusively in the three confirmed_* arrays above.
function resolverRowsFromStoredDecisions(weekRows, decisions) {
    const classified = new Set([
        ...decisions.confirmed_leave_dates,
        ...decisions.confirmed_sickness_dates,
        ...decisions.confirmed_absence_dates
    ]);
    return (weekRows || []).map((row) => classified.has(dateKeyUtc(row?.hmeromhnia))
        ? { ...row, repo_apologistika: false, adeia_apologistika: false,
            kathgoria_adeias_apologistika: 'POSSIBLE_LEAVE',
            astheneia_apologistika: false, apousia_apologistika: false,
            ores_apoysias_apologistika: 0 }
        : row);
}

function buildWeeklyHrWorkflowProjection({ weekRows = [], effectiveProfile = {},
    effectiveProfilesByDate = {},
    persistedStage1State = null, indexState = { ready: false },
    expected_date_keys = null } = {}) {
    const currentFingerprint = buildStage1Fingerprint(weekRows).fingerprint;
    const stage1Status = resolveStage1Status({
        current_fingerprint: currentFingerprint,
        persisted_stage1_state: persistedStage1State
    });
    const decisions = deriveStoredStage1Decisions(weekRows);
    const completed = stage1Status === 'COMPLETED';
    const workflow = resolveWeeklyHrWorkflow({
        weekRows: completed ? resolverRowsFromStoredDecisions(weekRows, decisions) : weekRows,
        effectiveProfile,
        effectiveProfilesByDate,
        expected_date_keys,
        leave_classification_completed: completed,
        ...(completed ? decisions : {})
    });
    return Object.freeze({ stage1_status: stage1Status,
        current_fingerprint: currentFingerprint, write_enabled: indexState?.ready === true,
        write_disabled_code: indexState?.ready === true ? null :
            'WEEKLY_HR_WORKFLOW_INDEXES_NOT_READY', ...decisions, workflow });
}

module.exports = { deriveStoredStage1Decisions, resolverRowsFromStoredDecisions,
    buildWeeklyHrWorkflowProjection };
