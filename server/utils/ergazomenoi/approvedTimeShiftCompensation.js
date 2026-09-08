'use strict';

// Shift-start midnight is zero; overnight values have no artificial daily ceiling.
function validTimeShiftSegments(segments) {
    if (!Array.isArray(segments)) return false;
    let previousEnd = 0;
    for (const segment of segments) {
        if (!segment || !Number.isSafeInteger(segment.apo_lepto) ||
            !Number.isSafeInteger(segment.eos_lepto) || segment.apo_lepto < 0 ||
            segment.eos_lepto <= segment.apo_lepto || segment.apo_lepto < previousEnd) return false;
        previousEnd = segment.eos_lepto;
    }
    return true;
}

function validTimeShiftCompensation(value) {
    if (value == null) return true;
    const { diastimata_elleimmatos: shortage, diastimata_anaplhroshs: compensation,
        antistoixismena_lepta: matched, ypoloipomena_lepta: remaining } = value;
    if (!validTimeShiftSegments(shortage) || !validTimeShiftSegments(compensation) ||
        !Number.isSafeInteger(matched) || matched < 0 ||
        !Number.isSafeInteger(remaining) || remaining < 0) return false;
    const duration = segments => segments.reduce((total, segment) =>
        total + (segment.eos_lepto - segment.apo_lepto), 0);
    const shortageMinutes = duration(shortage);
    return Number.isSafeInteger(shortageMinutes) && Number.isSafeInteger(matched + remaining) &&
        duration(compensation) === matched && matched <= shortageMinutes &&
        shortageMinutes === matched + remaining;
}

module.exports = { validTimeShiftSegments, validTimeShiftCompensation };
