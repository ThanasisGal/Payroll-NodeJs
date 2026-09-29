'use strict';

const { READY, REQUIRED, resolveWtoDailyDeferredBoundaryReadiness } =
    require('./wtoDailyDeferredBoundaryReadinessService');
const { applyWtoDailyAccountingOverlay } = require('./wtoDailyAccountingOverlayService');
const { buildWtoDailySubmissionProjection } = require('./wtoDailySubmissionProjectionService');
const { filterEligibleApologistikosSource, buildCanonicalApologistikosRows, buildReportFromCanonical } =
    require('./apologistikosPinakasControlReportService');

function integrationError(code, message, details = {}) {
    return Object.assign(new Error(message || code), { code, statusCode: 409, details });
}
function prepareFinalWtoDailyCanonicalControl({ frozenSnapshot, deferredWeeks, decisions,
    periodStart, periodEnd } = {}) {
    const readiness = resolveWtoDailyDeferredBoundaryReadiness({ deferredWeeks, decisions,
        periodStart, periodEnd });
    if (readiness.status !== READY) throw integrationError(REQUIRED,
        'Απαιτείται απόφαση HR για εκκρεμή οριακή εβδομάδα πριν από την τελική WTODailyA.', readiness);
    const overlayedRows = applyWtoDailyAccountingOverlay({ frozenDailyResults: frozenSnapshot?.daily_results,
        periodStart, periodEnd, decisions });
    const eligibleSource = filterEligibleApologistikosSource({ rows: overlayedRows,
        employees: frozenSnapshot?.employees || [], requireFrozenEligibility: true });
    const canonicalRows = buildCanonicalApologistikosRows(eligibleSource);
    const criteria = { ypokatasthma: String(frozenSnapshot?.scope?.ypokatasthma || '').padStart(4, '0'),
        startIso: String(periodStart instanceof Date ? periodStart.toISOString().slice(0, 10) : periodStart).slice(0, 10),
        endIso: String(periodEnd instanceof Date ? periodEnd.toISOString().slice(0, 10) : periodEnd).slice(0, 10) };
    return Object.freeze({ readiness, rows: eligibleSource.rows, canonicalRows,
        controlReport: buildReportFromCanonical({ canonicalRows, criteria }) });
}

function prepareFinalWtoDailyInput({ frozenSnapshot, deferredWeeks, decisions, periodStart,
    periodEnd, branch, comments = '', projector = buildWtoDailySubmissionProjection } = {}) {
    const prepared = prepareFinalWtoDailyCanonicalControl({ frozenSnapshot, deferredWeeks,
        decisions, periodStart, periodEnd });
    return Object.freeze({ ...prepared, projection: projector({ canonicalRows: prepared.canonicalRows,
        branch, periodStart, periodEnd, comments }) });
}

module.exports = { prepareFinalWtoDailyCanonicalControl, prepareFinalWtoDailyInput };
