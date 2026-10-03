'use strict';

const POLICY_VERSION = 'zero-length-card-work:v1';
const RESOLUTION_KIND = 'ACTUAL_WORK_ERGANI_TRANSMISSION_FAILURE';

function isApprovedZeroLengthResolution(row = {}) {
    const value = row.zero_length_card_resolution;
    return Boolean(value?.status === 'HR_APPROVED' &&
        value?.policy_version === POLICY_VERSION &&
        value?.resolution_kind === RESOLUTION_KIND &&
        value?.raw_cards_preserved === true);
}

module.exports = { POLICY_VERSION, RESOLUTION_KIND, isApprovedZeroLengthResolution };
