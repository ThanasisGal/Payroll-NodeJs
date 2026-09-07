'use strict';

const DAY = 1440;
const valid = interval => Number.isFinite(interval?.start) && Number.isFinite(interval?.end) &&
    interval.end > interval.start;

// Pure half-open interval difference. No date, weekday or payroll classification.
function subtractIntervals(workIntervals = [], breakIntervals = []) {
    const breaks = breakIntervals.filter(valid).slice().sort((a, b) => a.start - b.start);
    return workIntervals.filter(valid).flatMap(work => {
        let cursor = work.start;
        const pieces = [];
        for (const pause of breaks) {
            if (pause.end <= cursor) continue;
            if (pause.start >= work.end) break;
            if (pause.start > cursor) pieces.push({ ...work, start: cursor, end: pause.start });
            cursor = Math.min(work.end, Math.max(cursor, pause.end));
            if (cursor === work.end) break;
        }
        if (cursor < work.end) pieces.push({ ...work, start: cursor, end: work.end });
        return pieces;
    });
}

function clockMinutes(value) {
    if (typeof value !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
    return Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
}

function exactExternalBreaks(effectiveEmployee = {}) {
    if (!effectiveEmployee || effectiveEmployee.dialleima_entos_ektos_orarioy === true) return [];
    return ['01', '02', '03'].flatMap(slot => {
        const start = clockMinutes(effectiveEmployee[`dialleima_apo_ora_${slot}`]);
        let end = clockMinutes(effectiveEmployee[`dialleima_eos_ora_${slot}`]);
        if (start === null || end === null || start === end) return [];
        if (end < start) end += DAY;
        return [{ start, end }];
    });
}

function hasExactExternalBreaks(effectiveEmployee) {
    return exactExternalBreaks(effectiveEmployee).length > 0;
}

// Clock pairs belong to the already-resolved shift profile. Project them onto
// the same minute axis as the work, including either side of midnight.
function subtractExternalBreakIntervals(workIntervals, effectiveEmployee) {
    const breaks = exactExternalBreaks(effectiveEmployee);
    if (!breaks.length) return workIntervals;
    let previousStart = -Infinity;
    const work = workIntervals.filter(valid).map(interval => {
        let { start, end } = interval;
        while (start < previousStart) { start += DAY; end += DAY; }
        previousStart = start;
        return { ...interval, start, end };
    });
    if (!work.length) return [];
    const first = Math.min(...work.map(i => i.start));
    const last = Math.max(...work.map(i => i.end));
    const projected = [];
    for (let day = Math.floor(first / DAY) - 1; day <= Math.floor(last / DAY); day++) {
        for (const pause of breaks) projected.push({ start: pause.start + day * DAY, end: pause.end + day * DAY });
    }
    const clock = minute => `${String(Math.floor(((minute % DAY) + DAY) % DAY / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
    return subtractIntervals(work, projected).map(interval => ({
        ...interval, apo: clock(interval.start), eos: clock(interval.end)
    }));
}

module.exports = { subtractIntervals, exactExternalBreaks, hasExactExternalBreaks, subtractExternalBreakIntervals };
