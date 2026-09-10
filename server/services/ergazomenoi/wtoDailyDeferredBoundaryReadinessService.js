'use strict';

const { dateKey } = require('./wtoDailySubmissionProjectionService');
const { RESOLUTION_KIND, hasValidResolutionFingerprint } = require('./deferredCrossPeriodRepoResolutionService');
const { projectionFingerprint } = require('./wtoDailyAccountingOverlayService');

const READY = 'READY';
const REQUIRED = 'WTODAILY_DEFERRED_BOUNDARY_RESOLUTION_REQUIRED';

function affectsPeriod(deferredWeek, start, end) {
    const dates = [...(deferredWeek?.current_period_dates || []),
        ...(deferredWeek?.next_period_context_dates || [])];
    return dates.some((value) => {
        const key = dateKey(value);
        return key >= start && key <= end;
    });
}

function isValidDecision(decision, deferredWeekId, start, end) {
    if (decision?.resolution_kind !== RESOLUTION_KIND || decision?.deferred_week_id !== deferredWeekId ||
        decision?.resolution_status !== 'RESOLVED' || decision?.conflict === true || decision?.stale === true ||
        !hasValidResolutionFingerprint(decision)) return false;
    const matchingProjections = (decision.period_projections || []).filter((item) =>
        dateKey(item.period_start) === start && dateKey(item.period_end) === end);
    if (matchingProjections.length !== 1) return false;
    const projection = matchingProjections[0];
    if (projectionFingerprint(projection) !== projection.projection_fingerprint) return false;
    return (projection.accounting_rows || []).every((row) => {
        const key = dateKey(row.hmeromhnia || row.date);
        return key >= start && key <= end;
    });
}

function resolveWtoDailyDeferredBoundaryReadiness({ deferredWeeks = [], decisions = [], periodStart, periodEnd } = {}) {
    const start = dateKey(periodStart, 'period start');
    const end = dateKey(periodEnd, 'period end');
    const affected = deferredWeeks.filter((week) => affectsPeriod(week, start, end));
    const unresolved = affected.filter((week) => {
        const deferredWeekId = String(week.deferred_week_id || '');
        const candidates = (decisions || []).filter((decision) =>
            decision?.resolution_kind === RESOLUTION_KIND && decision?.deferred_week_id === deferredWeekId);
        if (candidates.length !== 1) return true;
        try {
            return !isValidDecision(candidates[0], deferredWeekId, start, end);
        } catch {
            return true;
        }
    });
    return Object.freeze({ status: unresolved.length ? REQUIRED : READY,
        unresolved_deferred_week_ids: Object.freeze(unresolved.map((week) => String(week.deferred_week_id || ''))) });
}

module.exports = { READY, REQUIRED, resolveWtoDailyDeferredBoundaryReadiness };
