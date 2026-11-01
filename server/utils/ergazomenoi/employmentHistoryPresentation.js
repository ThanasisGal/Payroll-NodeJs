'use strict';
const { effectiveStart } = require('./employmentProfileHistory');
const { isInactiveHistoryRow } = require('./employmentHistoryCanonicalStatus');
const { calendarDate } = require('./employmentProfileContract');

// Presentation only: never change the persisted sequence or business dates.
function sortHistoryForPresentation(rows = []) {
    const start = row => {
        try {
            return effectiveStart(row) || calendarDate(row.hmeromhnia_allaghs_symbashs) ||
                calendarDate(row.hmeromhnia_proslhpshs);
        } catch (error) {
            // Invalid evidence must remain inspectable in the editor.
            if (error.code === 'INVALID_EMPLOYMENT_PROFILE') return null;
            throw error;
        }
    };
    return [...rows].sort((left, right) =>
        Number(isInactiveHistoryRow(left)) - Number(isInactiveHistoryRow(right)) ||
        (start(left)?.getTime() ?? Infinity) - (start(right)?.getTime() ?? Infinity) ||
        String(left.aa_eggrafhs || '').localeCompare(String(right.aa_eggrafhs || ''), 'el', { numeric: true }) ||
        String(left._id).localeCompare(String(right._id)));
}
module.exports = { sortHistoryForPresentation };
