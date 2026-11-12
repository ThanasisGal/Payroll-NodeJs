'use strict';

const crypto = require('crypto');
const { dateKeyUtc } = require('../../utils/date/mondaySundayWeek');
const { buildStage1Fingerprint } = require('./apasxoliseisStage1FingerprintService');
const { diagnostic } = require('./apasxoliseisReviewDiagnosticService');

function fail(code, message, statusCode = 400) {
    throw Object.assign(new Error(message), { code, statusCode });
}
function key(value) { return dateKeyUtc(value); }
function date(value) {
    const valueKey = key(value);
    return valueKey ? new Date(`${valueKey}T00:00:00.000Z`) : null;
}
function stable(value) {
    if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
    if (value && typeof value === 'object') return `{${Object.keys(value).sort()
        .map((name) => `${JSON.stringify(name)}:${stable(value[name])}`).join(',')}}`;
    return JSON.stringify(value);
}
function periodSliceKey(slice = {}) {
    return `${key(slice.period_start)}|${key(slice.period_end)}`;
}
function deriveStage1PeriodSlice({ weekRows = [], week_start, week_end,
    period_start, period_end, employment_date_scope = null, require_complete_week = true,
    require_complete_slice = false } = {}) {
    const weekStart = date(week_start); const weekEnd = date(week_end);
    const periodStart = date(period_start); const periodEnd = date(period_end);
    if (!weekStart || !weekEnd || !periodStart || !periodEnd ||
        weekStart.getUTCDay() !== 1 || weekEnd.getUTCDay() !== 0 ||
        weekEnd.getTime() - weekStart.getTime() !== 6 * 86400000 ||
        periodStart > periodEnd || periodEnd < weekStart || periodStart > weekEnd) {
        fail('INVALID_STAGE1_PERIOD_SLICE', 'Μη έγκυρο τμήμα περιόδου φυσικής εβδομάδας.');
    }
    const rowDates = [...new Set(weekRows.map((row) => key(row.hmeromhnia)).filter(Boolean))].sort();
    const expectedDates = Array.isArray(employment_date_scope?.employment_owned_dates)
        ? [...employment_date_scope.employment_owned_dates] : Array.from({ length: 7 }, (_, index) => {
            const current = new Date(weekStart); current.setUTCDate(current.getUTCDate() + index);
            return key(current);
        });
    if (require_complete_week && !require_complete_slice && (weekRows.length !== expectedDates.length || rowDates.length !== expectedDates.length ||
        expectedDates.some((item) => !rowDates.includes(item)))) fail('INCOMPLETE_NATURAL_WEEK',
        'Απαιτούνται όλες οι ημέρες της πραγματικής σχέσης εργασίας.', 409);
    const actionable = expectedDates.filter((item) =>
        item >= key(periodStart) && item <= key(periodEnd));
    const contextOnly = expectedDates.filter((item) => !actionable.includes(item));
    if (!actionable.length || !contextOnly.length) fail('STAGE1_PERIOD_SLICE_NOT_CROSS_BOUNDARY',
        'Το τμήμα περιόδου χρησιμοποιείται μόνο σε εβδομάδα που τέμνει όριο περιόδου.');
    if (require_complete_slice) {
        const dates = weekRows.map(row => key(row.hmeromhnia));
        const missing = actionable.filter(day => !dates.includes(day));
        const duplicates = actionable.filter(day => dates.filter(value => value === day).length > 1);
        const unexpected = dates.filter(day => !day || !expectedDates.includes(day));
        if (missing.length || duplicates.length || unexpected.length) {
            throw Object.assign(new Error('Η επιβεβαίωση του τμήματος περιόδου σταμάτησε επειδή ' +
                'λείπουν ημέρες ή υπάρχουν επαναλαμβανόμενες ή μη έγκυρες ημερήσιες εγγραφές. ' +
                '1. Ελέγξτε τις αναφερόμενες ημερομηνίες στην ενεργή περίοδο. ' +
                '2. Διορθώστε τις εγγραφές και εκτελέστε ξανά Αναζήτηση. ' +
                'Δεν αποθηκεύτηκε καμία αλλαγή. Κωδικός αναφοράς: INCOMPLETE_NATURAL_WEEK.'), {
                code: 'INCOMPLETE_NATURAL_WEEK', statusCode: 409,
                blocking_reasons: ['INCOMPLETE_NATURAL_WEEK'],
                diagnostics: [diagnostic('INCOMPLETE_NATURAL_WEEK', [...missing, ...duplicates], {
                    missing_dates: missing, duplicate_dates: duplicates, unexpected_dates: unexpected,
                    required_dates: actionable })]
            });
        }
    }
    return Object.freeze({ period_start: key(periodStart), period_end: key(periodEnd),
        actionable_dates: Object.freeze(actionable), context_only_dates: Object.freeze(contextOnly) });
}
function buildStage1PeriodSliceFingerprints({ weekRows = [], slice,
    companySettings = {}, persisted_slice = null } = {}) {
    const actionable = new Set(slice?.actionable_dates || []);
    const actionableRows = weekRows.filter((row) => actionable.has(key(row.hmeromhnia)));
    // Stage 1 attests this period. Earlier actual context remains a dependency;
    // future-period rows cannot invalidate an independently attested slice.
    const contextRows = weekRows.filter(row => key(row.hmeromhnia) <= key(slice?.period_end));
    const scopedContext = buildStage1Fingerprint(contextRows, { companySettings }).fingerprint;
    const legacyContext = buildStage1Fingerprint(weekRows, { companySettings }).fingerprint;
    // Preserve existing attestations and their downstream identities while all
    // of their original dependencies still match. Never silently bless stale data.
    const contextFingerprint = persisted_slice?.context_fingerprint === legacyContext
        ? legacyContext : scopedContext;
    const rowFingerprint = buildStage1Fingerprint(actionableRows, { companySettings });
    const material = { contract: 'weekly-hr-stage1-period-slice:v1',
        period_start: key(slice?.period_start), period_end: key(slice?.period_end),
        actionable_dates: [...actionable].sort(), actionable_rows: rowFingerprint.canonical_input.rows };
    return Object.freeze({ context_fingerprint: contextFingerprint,
        legacy_context_fingerprint: legacyContext,
        completion_fingerprint: crypto.createHash('sha256').update(stable(material)).digest('hex'),
        material: Object.freeze(material) });
}
function findStage1PeriodSlice(stage1 = {}, period_start, period_end) {
    const wanted = `${key(period_start)}|${key(period_end)}`;
    return (stage1?.period_slices || []).find((slice) => periodSliceKey(slice) === wanted) || null;
}
function resolveStage1PeriodSliceStatus({ current_context_fingerprint,
    current_completion_fingerprint, persisted_slice } = {}) {
    if (!persisted_slice || persisted_slice.status !== 'COMPLETED') return 'OPEN';
    if (String(persisted_slice.context_fingerprint || '') !== String(current_context_fingerprint || '')) {
        return 'STALE';
    }
    const applicable = String(persisted_slice.effective_fingerprint ||
        persisted_slice.completion_fingerprint || '');
    return applicable === String(current_completion_fingerprint || '') ? 'COMPLETED' : 'STALE';
}

module.exports = { deriveStage1PeriodSlice, buildStage1PeriodSliceFingerprints,
    findStage1PeriodSlice, resolveStage1PeriodSliceStatus, periodSliceKey };
