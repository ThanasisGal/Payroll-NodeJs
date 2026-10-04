'use strict';

function validEmergencyHourlyLeaveSegments(value) {
    if (!Array.isArray(value)) return false;
    let previousEnd = -1;
    return value.every((segment) => {
        if (!segment || typeof segment !== 'object') return false;
        const source = typeof segment.toObject === 'function'
            ? segment.toObject({ depopulate: true, versionKey: false }) : segment;
        const keys = Object.keys(source);
        if (keys.length !== 2 || keys.some((key) =>
            !['apo_lepto', 'eos_lepto'].includes(key))) return false;
        const start = source.apo_lepto;
        const end = source.eos_lepto;
        const valid = Number.isSafeInteger(start) && Number.isSafeInteger(end) &&
            start >= 0 && start < end && end <= 1439 && start >= previousEnd;
        if (valid) previousEnd = end;
        return valid;
    });
}

function emergencyHourlyLeaveMinutes(value) {
    if (!validEmergencyHourlyLeaveSegments(value)) return null;
    return value.reduce((sum, segment) => sum + segment.eos_lepto - segment.apo_lepto, 0);
}

module.exports = { validEmergencyHourlyLeaveSegments, emergencyHourlyLeaveMinutes };
