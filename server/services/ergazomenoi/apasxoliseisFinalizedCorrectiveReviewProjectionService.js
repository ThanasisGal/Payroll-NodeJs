'use strict';

const { projectFrozenReview, projectFrozenDailyPresentation } =
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

function mergeAffectedRows(baselineRows = [], correctedRows = [], affectedWeeks = new Set(), snapshot = {}) {
    const correctedByKey = new Map(correctedRows.map((row) => [dailyKey(row), row]));
    return baselineRows.map((baselineRow) => {
        if (!affectedWeeks.has(weeklyKey(baselineRow))) return baselineRow;
        const correctedRow = correctedByKey.get(dailyKey(baselineRow));
        return correctedRow
            ? projectFrozenDailyPresentation({ ...baselineRow, ...correctedRow }, snapshot)
            : baselineRow;
    });
}

function missingPresentationValue(value) {
    return value === null || value === undefined || value === '';
}

function normalizeWeeklyPresentation(weeklyRows = [], dailyRows = []) {
    const dailyByWeek = new Map();
    for (const row of dailyRows) {
        const key = weeklyKey(row);
        if (!dailyByWeek.has(key)) dailyByWeek.set(key, []);
        dailyByWeek.get(key).push(row);
    }
    return weeklyRows.map((row) => {
        const facts = dailyByWeek.get(weeklyKey(row)) || [];
        const actualWorkdays = facts.filter((item) =>
            Number(item.ores_pragmatikhs_ergasias_apologistika ??
                item.compensation_breakdown_apologistika?.hours?.actualWorkHours ??
                item.ores_ergasias_apologistika ?? 0) > 0).length;
        const sixthDayCount = facts.filter((item) => item.is_sixth_day === true ||
            Number(item.sixth_day_hours || 0) > 0).length;
        const seventhDayCount = facts.filter((item) => item.is_seventh_day === true ||
            Number(item.seventh_day_hours || 0) > 0).length;
        return { ...row,
            ...(missingPresentationValue(row.resolved_repo) && !missingPresentationValue(row.actual_repo)
                ? { resolved_repo: Number(row.actual_repo) } : {}),
            ...(missingPresentationValue(row.actual_workdays) ? { actual_workdays: actualWorkdays } : {}),
            ...(missingPresentationValue(row.sixth_day_count) ? { sixth_day_count: sixthDayCount } : {}),
            ...(missingPresentationValue(row.seventh_day_count) ? { seventh_day_count: seventhDayCount } : {}) };
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
    const rows = mergeAffectedRows(baseline.rows, correctedRows, affectedWeeks, snapshot);
    const weeklyContextRows = (snapshot.weekly_calculation_context?.rows || snapshot.daily_results || [])
        .map((row) => projectFrozenDailyPresentation(row, snapshot));
    const correctedWeeklyFacts = mergeAffectedRows(weeklyContextRows, correctedRows,
        affectedWeeks, snapshot);
    const deviations = mergeAffectedWeeklyProjection(
        baseline.deviations, correctedDeviations, affectedWeeks);
    return Object.freeze({ ...baseline, source: 'FROZEN_FINALIZED_CORRECTED', rows, total: rows.length,
        deviations: normalizeWeeklyPresentation(deviations, correctedWeeklyFacts),
        corrective });
}

module.exports = { affectedCorrectiveWeekKeys, mergeAffectedRows,
    mergeAffectedWeeklyProjection, normalizeWeeklyPresentation,
    projectFinalizedCorrectiveReview };
