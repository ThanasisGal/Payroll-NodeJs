'use strict';

const crypto = require('crypto');
const { dateKeyUtc } = require('../../utils/date/mondaySundayWeek');
const { buildStage1Fingerprint } = require('./apasxoliseisStage1FingerprintService');

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
    period_start, period_end, employment_date_scope = null } = {}) {
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
    if (weekRows.length !== expectedDates.length || rowDates.length !== expectedDates.length ||
        expectedDates.some((item) => !rowDates.includes(item))) fail('INCOMPLETE_NATURAL_WEEK',
        'Απαιτούνται όλες οι ημέρες της πραγματικής σχέσης εργασίας.', 409);
    const actionable = expectedDates.filter((item) =>
        item >= key(periodStart) && item <= key(periodEnd));
    const contextOnly = expectedDates.filter((item) => !actionable.includes(item));
    if (!actionable.length || !contextOnly.length) fail('STAGE1_PERIOD_SLICE_NOT_CROSS_BOUNDARY',
        'Το τμήμα περιόδου χρησιμοποιείται μόνο σε εβδομάδα που τέμνει όριο περιόδου.');
    return Object.freeze({ period_start: key(periodStart), period_end: key(periodEnd),
        actionable_dates: Object.freeze(actionable), context_only_dates: Object.freeze(contextOnly) });
}
function buildStage1PeriodSliceFingerprints({ weekRows = [], slice } = {}) {
    const actionable = new Set(slice?.actionable_dates || []);
    const actionableRows = weekRows.filter((row) => actionable.has(key(row.hmeromhnia)));
    const contextFingerprint = buildStage1Fingerprint(weekRows).fingerprint;
    const rowFingerprint = buildStage1Fingerprint(actionableRows);
    const material = { contract: 'weekly-hr-stage1-period-slice:v1',
        period_start: key(slice?.period_start), period_end: key(slice?.period_end),
        actionable_dates: [...actionable].sort(), actionable_rows: rowFingerprint.canonical_input.rows };
    return Object.freeze({ context_fingerprint: contextFingerprint,
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
    const applicable = String(persisted_slice.effective_fingerprint ||
        persisted_slice.completion_fingerprint || '');
    return applicable === String(current_completion_fingerprint || '') ? 'COMPLETED' : 'STALE';
}

module.exports = { deriveStage1PeriodSlice, buildStage1PeriodSliceFingerprints,
    findStage1PeriodSlice, resolveStage1PeriodSliceStatus, periodSliceKey };
