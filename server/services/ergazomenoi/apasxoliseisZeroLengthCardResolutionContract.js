'use strict';

const POLICY_VERSION = 'zero-length-card-work:v1';
const RESOLUTION_KIND = 'ACTUAL_WORK_ERGANI_TRANSMISSION_FAILURE';

function canonicalPairNumber(value) {
    const number = Number(value);
    return Number.isInteger(number) && number >= 1 && number <= 3 ? number : null;
}

function isStrictPositiveInterval(value = {}) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    if (Object.keys(value).some((field) => !['pairNumber', 'start', 'end'].includes(field))) {
        return false;
    }
    const pair = canonicalPairNumber(value.pairNumber);
    const clock = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
    return Boolean(pair && clock.test(String(value.start || '')) &&
        clock.test(String(value.end || '')) && value.start !== value.end);
}

function canonicalApprovedPairSet(value = {}) {
    if (!Array.isArray(value.affected_pairs) || !value.affected_pairs.length ||
        !Array.isArray(value.approved_intervals) || !value.approved_intervals.length ||
        value.approved_intervals.some((interval) => !isStrictPositiveInterval(interval))) {
        return null;
    }
    const affected = value.affected_pairs.map(canonicalPairNumber).sort();
    const intervals = value.approved_intervals
        .map((interval) => canonicalPairNumber(interval.pairNumber)).sort();
    if (affected.some((pair) => pair === null) ||
        new Set(affected).size !== affected.length ||
        new Set(intervals).size !== intervals.length ||
        JSON.stringify(affected) !== JSON.stringify(intervals)) return null;
    return affected;
}

function isApprovedZeroLengthResolution(row = {}) {
    const value = row.zero_length_card_resolution;
    return Boolean(value?.status === 'HR_APPROVED' &&
        value?.policy_version === POLICY_VERSION &&
        value?.resolution_kind === RESOLUTION_KIND &&
        value?.raw_cards_preserved === true &&
        value?.transmission_failure_confirmed === true &&
        canonicalApprovedPairSet(value));
}

module.exports = { POLICY_VERSION, RESOLUTION_KIND, canonicalApprovedPairSet,
    isApprovedZeroLengthResolution };
