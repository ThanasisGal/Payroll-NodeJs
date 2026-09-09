'use strict';

const { subtractIntervals } = require('./subtractExternalBreakIntervals');
const DAY = 1440;
const CONTINUOUS_WORK_MINUTES = 240;
const clockMinutes = value => typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)
    ? Number(value.slice(0, 2)) * 60 + Number(value.slice(3)) : null;
const clock = minute => `${String(Math.floor(((minute % DAY) + DAY) % DAY / 60)).padStart(2, '0')}:${String(((minute % 60) + 60) % 60).padStart(2, '0')}`;
const duration = intervals => intervals.reduce((sum, x) => sum + x.end - x.start, 0);

function clockIntervals(source = {}, prefix = '') {
    return ['01', '02', '03'].flatMap(slot => {
        const start = clockMinutes(source?.[`${prefix}apo_ora_${slot}`]);
        let end = clockMinutes(source?.[`${prefix}eos_ora_${slot}`]);
        if (start === null || end === null || start === end) return [];
        if (end < start) end += DAY;
        return [{ start, end }];
    });
}

function normalizeIntervals(intervals) {
    let previousEnd = 0;
    return intervals.filter(x => Number.isSafeInteger(x?.start) && Number.isSafeInteger(x?.end) && x.end > x.start)
        .map(interval => {
            let { start, end } = interval;
            // Η επόμενη ημέρα τεκμηριώνεται μόνο από πραγματικό πέρασμα μεσάνυχτων.
            const day = Math.floor(previousEnd / DAY);
            if (day > 0 && start < day * DAY) { start += day * DAY; end += day * DAY; }
            previousEnd = end;
            return { ...interval, start, end };
        });
}

// Εφαπτόμενα ζεύγη συνεχίζουν την ίδια εργασία. Κάθε πραγματικό κενό
// μηδενίζει τη συνέχεια, χωρίς να χαρακτηρίζει το δηλωμένο ωράριο σπαστό.
function continuousRuns(intervals) {
    const runs = [];
    for (const interval of intervals) {
        const last = runs.at(-1);
        if (last && interval.start >= last.start && interval.start <= last.end) last.end = Math.max(last.end, interval.end);
        else runs.push({ start: interval.start, end: interval.end });
    }
    return runs;
}

function resolvePayrollBreakIntervals({ row = {}, effectiveEmployee = {}, workIntervals = [] } = {}) {
    const work = normalizeIntervals(workIntervals);
    const declared = normalizeIntervals(clockIntervals(row));
    const splitSchedule = continuousRuns(declared).length > 1;
    const insideSchedule = effectiveEmployee?.dialleima_entos_ektos_orarioy === true;
    const configuredMinutes = Math.max(0, Number.parseInt(effectiveEmployee?.dialleima_se_lepta, 10) || 0);
    let source = splitSchedule ? 'SPLIT_SCHEDULE' : 'NONE';
    let breakIntervals = [];
    if (!splitSchedule) {
        // Το ισχύον προφίλ διατηρεί την υπάρχουσα προτεραιότητά του.
        const profileBreaks = clockIntervals(effectiveEmployee, 'dialleima_');
        const dailyBreaks = clockIntervals(row, 'dialleima_');
        const explicit = profileBreaks.length ? profileBreaks : dailyBreaks;
        if (explicit.length) {
            source = profileBreaks.length ? 'EFFECTIVE_PROFILE' : 'DAILY_SCHEDULE';
            const horizon = [...work, ...declared];
            if (horizon.length) {
                const firstDay = Math.floor(Math.min(...horizon.map(x => x.start)) / DAY) - 1;
                const lastDay = Math.floor(Math.max(...horizon.map(x => x.end)) / DAY);
                for (let day = firstDay; day <= lastDay; day++) {
                    for (const pause of explicit) {
                        const projected = { start: pause.start + day * DAY, end: pause.end + day * DAY };
                        breakIntervals.push(projected);
                    }
                }
            }
        } else if (configuredMinutes > 0) {
            const run = continuousRuns(work).find(x => x.end - x.start > CONTINUOUS_WORK_MINUTES);
            if (run) {
                source = 'AFTER_240_CONTINUOUS_MINUTES';
                const start = run.start + CONTINUOUS_WORK_MINUTES;
                breakIntervals = [{ start, end: start + configuredMinutes }];
            }
        }
    }
    const net = insideSchedule ? work : subtractIntervals(work, breakIntervals);
    return {
        source, splitSchedule, insideSchedule, configuredMinutes,
        breakIntervals: breakIntervals.map(x => ({ ...x, apo: clock(x.start), eos: clock(x.end) })),
        workIntervals: net.map(x => ({ ...x, apo: clock(x.start), eos: clock(x.end) })),
        grossMinutes: duration(work), removedMinutes: duration(work) - duration(net), netMinutes: duration(net)
    };
}

module.exports = { resolvePayrollBreakIntervals };
