'use strict';

// Minute positions start at midnight of the shift start date, including values > 1440.
// Keep adjacent segments separate; reject unordered input without mutating it.
function validApprovedHourlyLeaveSegments(segments) {
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

module.exports = { validApprovedHourlyLeaveSegments };
