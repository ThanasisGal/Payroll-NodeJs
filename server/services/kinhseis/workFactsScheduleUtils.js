const DEFAULTS = {
    monthlyRunDay: 2,
    monthlyRunTime: '02:30',
    timezone: 'Europe/Athens',
    periodMode: 'PREVIOUS_MONTH',
    scope: 'MONTHLY'
};

function toTrimmedString(value) {
    return String(value ?? '').trim();
}

function isValidDate(value) {
    return value instanceof Date && !Number.isNaN(value.getTime());
}

function normalizeMonthlyRunDay(value, warnings) {
    const day = Number.parseInt(String(value ?? ''), 10);

    if (Number.isInteger(day) && day >= 1 && day <= 28) {
        return day;
    }

    warnings.push('INVALID_MONTHLY_RUN_DAY: Χρησιμοποιήθηκε default 2.');
    return DEFAULTS.monthlyRunDay;
}

function normalizeMonthlyRunTime(value, warnings) {
    const time = toTrimmedString(value);

    if (/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
        return time;
    }

    warnings.push('INVALID_MONTHLY_RUN_TIME: Χρησιμοποιήθηκε default 02:30.');
    return DEFAULTS.monthlyRunTime;
}

function normalizeTimezone(value, warnings) {
    const timezone = toTrimmedString(value) || DEFAULTS.timezone;

    if (isSupportedTimezone(timezone)) {
        return timezone;
    }

    warnings.push(`INVALID_TIMEZONE: Δεν υποστηρίζεται "${timezone}", χρησιμοποιήθηκε UTC.`);
    return 'UTC';
}

function normalizePeriodMode(value, warnings) {
    const periodMode = toTrimmedString(value).toUpperCase();

    if (periodMode === DEFAULTS.periodMode || !periodMode) {
        return DEFAULTS.periodMode;
    }

    warnings.push('INVALID_PERIOD_MODE: Υποστηρίζεται μόνο PREVIOUS_MONTH.');
    return DEFAULTS.periodMode;
}

function normalizeScope(value, warnings) {
    const scope = toTrimmedString(value).toUpperCase();

    if (scope === DEFAULTS.scope || !scope) {
        return DEFAULTS.scope;
    }

    warnings.push('INVALID_SCOPE: Υποστηρίζεται μόνο MONTHLY.');
    return DEFAULTS.scope;
}

function isSupportedTimezone(timezone) {
    try {
        new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date());
        return true;
    } catch (_error) {
        return false;
    }
}

function getTimezoneParts(date, timezone) {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        calendar: 'iso8601',
        numberingSystem: 'latn',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23'
    });
    const values = {};

    formatter.formatToParts(date).forEach((part) => {
        if (part.type !== 'literal') {
            values[part.type] = Number.parseInt(part.value, 10);
        }
    });

    return {
        year: values.year,
        month: values.month,
        day: values.day,
        hour: values.hour,
        minute: values.minute,
        second: values.second
    };
}

function localPartsToUtcDate({ year, month, day, hour, minute, second = 0 }, timezone) {
    const expectedUtcMs = Date.UTC(year, month - 1, day, hour, minute, second, 0);
    let candidate = new Date(expectedUtcMs);

    for (let i = 0; i < 3; i += 1) {
        const actual = getTimezoneParts(candidate, timezone);
        const actualUtcMs = Date.UTC(
            actual.year,
            actual.month - 1,
            actual.day,
            actual.hour,
            actual.minute,
            actual.second,
            0
        );
        const deltaMs = expectedUtcMs - actualUtcMs;

        if (deltaMs === 0) {
            return candidate;
        }

        candidate = new Date(candidate.getTime() + deltaMs);
    }

    const verified = getTimezoneParts(candidate, timezone);
    if (
        verified.year === year &&
        verified.month === month &&
        verified.day === day &&
        verified.hour === hour &&
        verified.minute === minute
    ) {
        return candidate;
    }

    return new Date(expectedUtcMs);
}

function addOneMonth(year, month) {
    if (month === 12) {
        return { year: year + 1, month: 1 };
    }

    return { year, month: month + 1 };
}

function formatDateYMD({ year, month, day }) {
    return [
        String(year).padStart(4, '0'),
        String(month).padStart(2, '0'),
        String(day).padStart(2, '0')
    ].join('-');
}

function normalizeScheduleSettingsForRun(settings = {}) {
    const warnings = [];

    return {
        monthlyRunDay: normalizeMonthlyRunDay(settings.monthlyRunDay, warnings),
        monthlyRunTime: normalizeMonthlyRunTime(settings.monthlyRunTime, warnings),
        timezone: normalizeTimezone(settings.timezone, warnings),
        periodMode: normalizePeriodMode(settings.periodMode, warnings),
        scope: normalizeScope(settings.scope, warnings),
        warnings
    };
}

function computeNextMonthlyRunAt({
    monthlyRunDay = DEFAULTS.monthlyRunDay,
    monthlyRunTime = DEFAULTS.monthlyRunTime,
    timezone = DEFAULTS.timezone,
    fromDate = new Date()
} = {}) {
    const normalized = normalizeScheduleSettingsForRun({
        monthlyRunDay,
        monthlyRunTime,
        timezone
    });
    const baseDate = isValidDate(fromDate) ? fromDate : new Date();
    const localNow = getTimezoneParts(baseDate, normalized.timezone);
    const [hour, minute] = normalized.monthlyRunTime
        .split(':')
        .map((part) => Number.parseInt(part, 10));
    let candidate = localPartsToUtcDate(
        {
            year: localNow.year,
            month: localNow.month,
            day: normalized.monthlyRunDay,
            hour,
            minute
        },
        normalized.timezone
    );

    if (candidate <= baseDate) {
        const next = addOneMonth(localNow.year, localNow.month);
        candidate = localPartsToUtcDate(
            {
                year: next.year,
                month: next.month,
                day: normalized.monthlyRunDay,
                hour,
                minute
            },
            normalized.timezone
        );
    }

    return candidate;
}

function computePreviousMonthRangeForRunDate({ runAt, timezone = DEFAULTS.timezone } = {}) {
    const normalized = normalizeScheduleSettingsForRun({ timezone });
    const date = isValidDate(runAt) ? runAt : new Date();
    const localRun = getTimezoneParts(date, normalized.timezone);
    let year = localRun.year;
    let month = localRun.month - 1;

    if (month === 0) {
        year -= 1;
        month = 12;
    }

    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();

    return {
        apo: formatDateYMD({ year, month, day: 1 }),
        eos: formatDateYMD({ year, month, day: lastDay })
    };
}

module.exports = {
    computeNextMonthlyRunAt,
    computePreviousMonthRangeForRunDate,
    normalizeScheduleSettingsForRun
};
