'use strict';

(function exposeDailyRestValidation(root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) root.EmployeeDailyRestValidation = api;
})(typeof window !== 'undefined' ? window : globalThis, function createDailyRestValidation() {
    const MINIMUM_DAILY_REST_MINUTES = 11 * 60;
    const NON_WORKING_CATEGORIES = new Set(['ΑΝ', 'ΜΕ']);

    function clockMinutes(value) {
        const match = String(value || '').trim().match(/^([01]\d|2[0-3]):([0-5]\d)$/);
        if (!match) return null;
        return Number(match[1]) * 60 + Number(match[2]);
    }

    function normalizedIntervals(day) {
        if (NON_WORKING_CATEGORIES.has(String(day?.category || '').trim().toUpperCase())) {
            return [];
        }

        return (Array.isArray(day?.intervals) ? day.intervals : [])
            .map((interval) => ({
                start: clockMinutes(interval?.start),
                end: clockMinutes(interval?.end)
            }))
            .filter((interval) => interval.start !== null && interval.end !== null);
    }

    function collectDailyRestViolations(scheduleDays) {
        const violations = [];
        let previousWorkingDay = null;

        for (const day of Array.isArray(scheduleDays) ? scheduleDays : []) {
            const intervals = normalizedIntervals(day);
            let dailyMinutes = 0;

            for (const interval of intervals) {
                let intervalMinutes = interval.end - interval.start;
                if (intervalMinutes < 0) intervalMinutes += 24 * 60;
                dailyMinutes += intervalMinutes;
            }

            const currentDayStartMinutes = intervals[0]?.start ?? null;
            const currentDayEndMinutes = intervals.at(-1)?.end ?? null;

            if (
                previousWorkingDay &&
                currentDayStartMinutes !== null &&
                dailyMinutes > 0 &&
                previousWorkingDay.endMinutes > 0
            ) {
                const restMinutes =
                    24 * 60 + currentDayStartMinutes -
                    (previousWorkingDay.endMinutes +
                        (previousWorkingDay.crossesMidnight ? 24 * 60 : 0));

                if (restMinutes < MINIMUM_DAILY_REST_MINUTES) {
                    violations.push({
                        previousDate: previousWorkingDay.date || '',
                        currentDate: day?.date || '',
                        previousLabel: previousWorkingDay.label,
                        currentLabel: day?.label || day?.date || '',
                        restMinutes,
                        restHours: restMinutes / 60
                    });
                }
            }

            previousWorkingDay =
                dailyMinutes > 0 && currentDayEndMinutes !== null && currentDayEndMinutes > 0
                    ? {
                        date: day?.date || '',
                        label: day?.label || day?.date || '',
                        endMinutes: currentDayEndMinutes,
                        crossesMidnight: intervals.some(
                            (interval) => interval.end < interval.start
                        )
                    }
                    : null;
        }

        return violations;
    }

    function scheduleDayIndexes(formData, dayCount) {
        if (Number.isInteger(dayCount) && dayCount > 0) {
            return Array.from({ length: dayCount }, (_, index) => index + 1);
        }

        const indexes = new Set();
        for (const key of Object.keys(formData || {})) {
            const match = key.match(
                /^(?:hmeromhnia|kathgoria_ergasias(?:_stathera|_sthathera)?|apo_ora_0[1-3]|eos_ora_0[1-3])_(\d+)$/
            );
            if (match) indexes.add(Number(match[1]));
        }
        return [...indexes].filter(Number.isInteger).sort((left, right) => left - right);
    }

    function scheduleDaysFromFormData(formData, options = {}) {
        const source = formData && typeof formData === 'object' ? formData : {};
        const labelForIndex =
            typeof options.labelForIndex === 'function' ? options.labelForIndex : null;

        return scheduleDayIndexes(source, options.dayCount).map((index) => {
            const suffix = String(index).padStart(2, '0');
            const date = String(source[`hmeromhnia_${suffix}`] || '').trim();
            const category = String(
                source[`kathgoria_ergasias_stathera_${suffix}`] ||
                source[`kathgoria_ergasias_sthathera_${suffix}`] ||
                source[`kathgoria_ergasias_${suffix}`] ||
                ''
            ).trim();

            return {
                index,
                date,
                label: labelForIndex?.(index, suffix, date) || date || `Ημέρα ${index}`,
                category,
                intervals: [1, 2, 3].map((intervalIndex) => {
                    const intervalSuffix = String(intervalIndex).padStart(2, '0');
                    return {
                        start: source[`apo_ora_${intervalSuffix}_${suffix}`] || '',
                        end: source[`eos_ora_${intervalSuffix}_${suffix}`] || ''
                    };
                })
            };
        });
    }

    return Object.freeze({
        MINIMUM_DAILY_REST_MINUTES,
        collectDailyRestViolations,
        scheduleDaysFromFormData
    });
});
