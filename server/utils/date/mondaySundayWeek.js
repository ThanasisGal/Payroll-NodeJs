// Pure UTC/date-only helpers for every Monday-Sunday business week.

function dateKeyUtc(value) {
    if (
        value === null ||
        value === undefined ||
        (typeof value === 'string' && value.trim() === '')
    ) {
        return null;
    }
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
        const key = value.trim();
        const parsed = new Date(`${key}T00:00:00.000Z`);
        return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === key
            ? key
            : null;
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function dateOnlyUtc(value) {
    const key = dateKeyUtc(value);
    return key ? new Date(`${key}T00:00:00.000Z`) : null;
}

function addDaysUtc(value, days) {
    const date = dateOnlyUtc(value);
    if (!date || !Number.isInteger(days)) return null;
    date.setUTCDate(date.getUTCDate() + days);
    return date;
}

function startOfWeekMondayUtc(value) {
    const date = dateOnlyUtc(value);
    if (!date) return null;
    const offset = (date.getUTCDay() + 6) % 7;
    date.setUTCDate(date.getUTCDate() - offset);
    return date;
}

function endOfWeekSundayUtc(value) {
    const start = startOfWeekMondayUtc(value);
    if (!start) return null;
    start.setUTCDate(start.getUTCDate() + 6);
    start.setUTCHours(23, 59, 59, 999);
    return start;
}

function getMondaySundayWeekRange(value) {
    const start = startOfWeekMondayUtc(value);
    const end = endOfWeekSundayUtc(value);
    return start && end
        ? Object.freeze({
              weekStart: start,
              weekEnd: end,
              weekStartKey: dateKeyUtc(start),
              weekEndKey: dateKeyUtc(end)
          })
        : null;
}

function getNaturalWeekPeriodBoundary({ week_start, week_end, period_start, period_end } = {}) {
    const range = getMondaySundayWeekRange(week_start);
    const start = dateKeyUtc(period_start);
    const end = dateKeyUtc(period_end);
    if (!range || dateKeyUtc(week_start) !== range.weekStartKey ||
        dateKeyUtc(week_end) !== range.weekEndKey || !start || !end || start > end ||
        range.weekStartKey > end || range.weekEndKey < start) return null;
    const dates = Array.from({ length: 7 }, (_, index) => dateKeyUtc(addDaysUtc(range.weekStart, index)));
    return Object.freeze({ week_start: range.weekStartKey, week_end: range.weekEndKey,
        period_start: start, period_end: end,
        is_trailing_week: range.weekStartKey <= end && range.weekEndKey > end,
        is_leading_week: range.weekStartKey < start,
        current_period_dates: Object.freeze(dates.filter(date => date >= start && date <= end)),
        previous_period_context_dates: Object.freeze(dates.filter(date => date < start)),
        next_period_context_dates: Object.freeze(dates.filter(date => date > end)) });
}

function getMonthReadContextRange(year, month) {
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
        return null;
    }
    const monthStart = new Date(Date.UTC(year, month - 1, 1));
    const monthEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    return Object.freeze({
        monthStart,
        monthEnd,
        readContextStart: startOfWeekMondayUtc(monthStart),
        readContextEnd: monthEnd,
        completionContextEnd: endOfWeekSundayUtc(monthEnd)
    });
}

module.exports = {
    dateKeyUtc,
    dateOnlyUtc,
    addDaysUtc,
    startOfWeekMondayUtc,
    endOfWeekSundayUtc,
    getMondaySundayWeekRange,
    getNaturalWeekPeriodBoundary,
    getMonthReadContextRange
};
