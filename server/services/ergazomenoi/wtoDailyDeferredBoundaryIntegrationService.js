'use strict';

const { READY, REQUIRED, resolveWtoDailyDeferredBoundaryReadiness } =
    require('./wtoDailyDeferredBoundaryReadinessService');
const { applyWtoDailyAccountingOverlay } = require('./wtoDailyAccountingOverlayService');
const { buildWtoDailySubmissionProjection } = require('./wtoDailySubmissionProjectionService');

function integrationError(code, message, details = {}) {
    return Object.assign(new Error(message || code), { code, statusCode: 409, details });
}
function prepareFinalWtoDailyInput({ frozenSnapshot, deferredWeeks, decisions, periodStart,
    periodEnd, branch, comments = '', projector = buildWtoDailySubmissionProjection } = {}) {
    const readiness = resolveWtoDailyDeferredBoundaryReadiness({ deferredWeeks, decisions,
        periodStart, periodEnd });
    if (readiness.status !== READY) throw integrationError(REQUIRED,
        'Απαιτείται απόφαση HR για εκκρεμή οριακή εβδομάδα πριν από την τελική WTODailyA.', readiness);
    const rows = applyWtoDailyAccountingOverlay({ frozenDailyResults: frozenSnapshot?.daily_results,
        periodStart, periodEnd, decisions });
    return Object.freeze({ readiness, rows, projection: projector({ rows,
        employees: frozenSnapshot?.employees || [], branch, periodStart, periodEnd, comments }) });
}

module.exports = { prepareFinalWtoDailyInput };
