'use strict';

const { projectFrozenReview, projectFrozenSixthSeventhPresentation } =
    require('./apasxoliseisPeriodFrozenSnapshotService');
const { startOfWeekMondayUtc, dateKeyUtc } = require('../../utils/date/mondaySundayWeek');

function dailyKey(row = {}) {
    return `${String(row.kodikos || '')}|${dateKeyUtc(row.hmeromhnia)}`;
}

function weeklyKey(row = {}) {
    return `${String(row.kodikos || row.employee_kodikos || '')}|${dateKeyUtc(
        startOfWeekMondayUtc(row.week_apo || row.week_start || row.hmeromhnia))}`;
}

function affectedCorrectiveWeekKeys(correctedContext = {}) {
    return new Set((correctedContext.commands || []).map((command) =>
        `${String(command.employee_kodikos || '')}|${dateKeyUtc(
            startOfWeekMondayUtc(command.week_start || command.date))}`));
}

function mergeAffectedRows(baselineRows = [], correctedRows = [], affectedWeeks = new Set()) {
    const correctedByKey = new Map(correctedRows.map((row) => [dailyKey(row), row]));
    return baselineRows.map((baselineRow) => {
        if (!affectedWeeks.has(weeklyKey(baselineRow))) return baselineRow;
        const correctedRow = correctedByKey.get(dailyKey(baselineRow));
        return correctedRow
            ? projectFrozenSixthSeventhPresentation({ ...baselineRow, ...correctedRow })
            : baselineRow;
    });
}

function mergeAffectedWeeklyProjection(baselineRows = [], correctedRows = [], affectedWeeks = new Set()) {
    const correctedByKey = new Map(correctedRows.map((row) => [weeklyKey(row), row]));
    const merged = baselineRows.map((baselineRow) => affectedWeeks.has(weeklyKey(baselineRow))
        ? correctedByKey.get(weeklyKey(baselineRow)) || baselineRow
        : baselineRow);
    const baselineKeys = new Set(baselineRows.map(weeklyKey));
    for (const [key, correctedRow] of correctedByKey) {
        if (affectedWeeks.has(key) && !baselineKeys.has(key)) merged.push(correctedRow);
    }
    return merged.sort((left, right) => weeklyKey(left).localeCompare(weeklyKey(right)));
}

function projectFinalizedCorrectiveReview(snapshot = {}, corrective = null, { kodikos = '' } = {}) {
    const baseline = projectFrozenReview(snapshot, { kodikos });
    if (corrective?.status !== 'CLOSED' || !corrective.corrected_result) return baseline;
    const affectedWeeks = affectedCorrectiveWeekKeys(corrective.corrected_context);
    const correctedRows = (corrective.corrected_result.daily_results || [])
        .filter((row) => !kodikos || String(row.kodikos) === String(kodikos));
    const correctedDeviations = (corrective.corrected_result.deviations || [])
        .filter((row) => !kodikos || String(row.kodikos || row.employee_kodikos) === String(kodikos));
    const rows = mergeAffectedRows(baseline.rows, correctedRows, affectedWeeks);
    return Object.freeze({ ...baseline, source: 'FROZEN_FINALIZED_CORRECTED', rows, total: rows.length,
        deviations: mergeAffectedWeeklyProjection(baseline.deviations, correctedDeviations, affectedWeeks),
        corrective });
}

module.exports = { affectedCorrectiveWeekKeys, mergeAffectedRows,
    mergeAffectedWeeklyProjection, projectFinalizedCorrectiveReview };
