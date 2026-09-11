'use strict';

const { dateKey } = require('./wtoDailySubmissionProjectionService');
const { RESOLUTION_KIND, ACCOUNTING_TIME_FIELDS, fingerprint,
    hasValidResolutionFingerprint, stableValue } =
    require('./deferredCrossPeriodRepoResolutionService');
const { resolveEffectiveDeferredCrossPeriodDecision } =
    require('./deferredCrossPeriodRepoDecisionRevisionService');

const OVERLAY_ALLOWED_FIELDS = ACCOUNTING_TIME_FIELDS;

function overlayError(code, message, details = {}) {
    const error = new Error(message || code);
    error.code = code;
    error.statusCode = 409;
    error.details = details;
    return error;
}

function projectionFingerprint(projection) {
    return fingerprint({ period_start: dateKey(projection.period_start), period_end: dateKey(projection.period_end),
        side: projection.side, accounting_rows: stableValue(projection.accounting_rows || []) });
}

function applyWtoDailyAccountingOverlay({ frozenDailyResults, periodStart, periodEnd, decisions = [] } = {}) {
    const start = dateKey(periodStart, 'period start');
    const end = dateKey(periodEnd, 'period end');
    if (start > end) throw overlayError('INVALID_WTODAILY_OVERLAY_PERIOD', 'Μη έγκυρη περίοδος επικάλυψης.');
    if (!Array.isArray(frozenDailyResults)) throw overlayError('INVALID_FROZEN_DAILY_RESULTS', 'Μη έγκυρα frozen ημερήσια αποτελέσματα.');
    const result = frozenDailyResults.filter((row) => {
        const rowDate = dateKey(row.hmeromhnia, 'frozen row date');
        return rowDate >= start && rowDate <= end;
    }).map((row) => ({ ...row }));
    const rowIndex = new Map();
    result.forEach((row, index) => {
        const id = String(row._id || row.row_id || row.prodhlomena_oraria_id || '').trim();
        const rowDate = dateKey(row.hmeromhnia, 'frozen row date');
        if (id) rowIndex.set(`${id}|${rowDate}`, index);
    });
    const grouped = new Map();
    decisions.filter((decision) => decision?.resolution_kind === RESOLUTION_KIND).forEach((decision) => {
        const key = String(decision?.deferred_week_id || '').trim();
        if (!key) throw overlayError('WTODAILY_OVERLAY_DECISION_AMBIGUITY', 'Υπάρχει απόφαση χωρίς deferred εβδομάδα.');
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key).push(decision);
    });
    const crossPeriodDecisions = [...grouped.entries()].map(([key, group]) => {
        try { return resolveEffectiveDeferredCrossPeriodDecision(group, key); }
        catch (error) { throw overlayError('WTODAILY_OVERLAY_DECISION_AMBIGUITY', error.message); }
    });
    for (const decision of crossPeriodDecisions) {
        if (decision?.resolution_status !== 'RESOLVED' || decision?.conflict === true || decision?.stale === true) {
            throw overlayError('WTODAILY_OVERLAY_DECISION_CONFLICT', 'Η απόφαση επικάλυψης είναι ανεπίλυτη, stale ή σε σύγκρουση.');
        }
    }
    const claimedRows = new Set();
    for (const decision of crossPeriodDecisions) {
        if (!hasValidResolutionFingerprint(decision)) {
            throw overlayError('STALE_WTODAILY_RESOLUTION', 'Το resolution fingerprint δεν είναι έγκυρο.');
        }
        const matchingProjections = (decision.period_projections || []).filter((item) =>
            dateKey(item.period_start) === start && dateKey(item.period_end) === end);
        if (matchingProjections.length > 1) {
            throw overlayError('WTODAILY_OVERLAY_PROJECTION_AMBIGUITY', 'Υπάρχουν πολλαπλές προβολές για την ίδια περίοδο.');
        }
        const projection = matchingProjections[0];
        if (!projection) continue;
        if (projection.projection_fingerprint !== projectionFingerprint(projection)) {
            throw overlayError('STALE_WTODAILY_PERIOD_PROJECTION', 'Το projection fingerprint δεν είναι έγκυρο.');
        }
        for (const accountingRow of projection.accounting_rows || []) {
            const rowDate = dateKey(accountingRow.hmeromhnia || accountingRow.date, 'accounting row date');
            if (rowDate < start || rowDate > end) {
                throw overlayError('WTODAILY_OVERLAY_ROW_OUTSIDE_PERIOD', 'Η γραμμή επικάλυψης βρίσκεται εκτός περιόδου.', { date: rowDate });
            }
            const id = String(accountingRow.row_id || accountingRow.prodhlomena_oraria_id || accountingRow._id || '').trim();
            const rowIdentity = `${id}|${rowDate}`;
            if (claimedRows.has(rowIdentity)) {
                throw overlayError('WTODAILY_OVERLAY_ROW_CONFLICT', 'Περισσότερες από μία αποφάσεις αλλάζουν την ίδια frozen γραμμή.');
            }
            claimedRows.add(rowIdentity);
            const index = rowIndex.get(rowIdentity);
            if (index === undefined) throw overlayError('WTODAILY_OVERLAY_ROW_NOT_IN_FROZEN_SNAPSHOT', 'Η γραμμή επικάλυψης δεν βρέθηκε στο frozen snapshot.', { row_id: id, date: rowDate });
            const patch = {};
            OVERLAY_ALLOWED_FIELDS.forEach((field) => {
                if (Object.prototype.hasOwnProperty.call(accountingRow, field)) {
                    const value = accountingRow[field];
                    if (value !== null && typeof value === 'object') {
                        throw overlayError('INVALID_WTODAILY_OVERLAY_FIELD', 'Τα πεδία επικάλυψης πρέπει να είναι scalar τιμές.', { field });
                    }
                    patch[field] = value;
                }
            });
            result[index] = { ...result[index], ...patch };
        }
    }
    return result;
}

module.exports = { OVERLAY_ALLOWED_FIELDS, projectionFingerprint, applyWtoDailyAccountingOverlay };
