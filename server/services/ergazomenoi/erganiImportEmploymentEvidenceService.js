'use strict';

const { dateKeyUtc } = require('../../utils/date/mondaySundayWeek');
const { semanticHistoryRows } = require('../../utils/ergazomenoi/employmentHistoryCanonicalStatus');
const { resolveEmploymentCycleForDate, STATUS } = require('./employeeEmploymentCycleResolverService');

const ERGANI_PRIMARY_EVIDENCE = 'ERGANI_PRIMARY_EVIDENCE';
const UNKNOWN = 'UNKNOWN';
const LEGACY_LIFECYCLE_ERRORS = new Set([
    'AMBIGUOUS_LIFECYCLE_EVENTS', 'EMPLOYMENT_CYCLE_DEPARTURE_BEFORE_HIRE',
    'EMPLOYMENT_CYCLE_OPEN_BEFORE_NEXT_HIRE', 'EMPLOYMENT_CYCLE_OVERLAP',
    'EMPLOYMENT_CYCLE_AMBIGUOUS_DATE'
]);

// Permission to receive primary ERGANI evidence, never an employment/profile
// reconstruction. Calculations and all other writers retain the strict resolver.
function resolveErganiImportEmploymentEvidence(value, input = {}) {
    const date = dateKeyUtc(value);
    if (!date) return resolveEmploymentCycleForDate(value, input); // Keep invalid dates fatal.
    const history = semanticHistoryRows(input.history);
    const current = input.currentEmployee || {};
    const rows = [...history, current];
    const hasValue = value => value != null && String(value).trim() !== '';
    const incomplete = rows.some(row => !dateKeyUtc(row.hmeromhnia_proslhpshs) ||
        (hasValue(row.hmeromhnia_apoxorhshs) && !dateKeyUtc(row.hmeromhnia_apoxorhshs)));
    const hire = dateKeyUtc(current.hmeromhnia_proslhpshs);
    const departure = dateKeyUtc(current.hmeromhnia_apoxorhshs);
    // A definite departure on the current relationship remains an upper bound
    // even when an older row lacks a hire date. A documented later hire is a
    // contradiction, so it must not be hidden by that bound.
    if (departure && (!hire || departure >= hire) && date > departure &&
        history.every(row => !dateKeyUtc(row.hmeromhnia_proslhpshs) ||
            dateKeyUtc(row.hmeromhnia_proslhpshs) <= (hire || departure))) {
        return { status: STATUS.AFTER_LAST_DEPARTURE, date };
    }
    let resolution;
    try {
        resolution = resolveEmploymentCycleForDate(date, { currentEmployee: current, history });
    } catch (error) {
        if (!LEGACY_LIFECYCLE_ERRORS.has(error.code)) throw error;
        resolution = { status: UNKNOWN, reason: error.code };
    }
    if (resolution.status === STATUS.EMPLOYED) return resolution;

    // Old overlaps do not invalidate independent, uncontradicted outer bounds.
    // Missing lifecycle dates cannot establish a first hire or a last departure.
    if (!incomplete) {
        const firstHire = rows.map(row => dateKeyUtc(row.hmeromhnia_proslhpshs)).sort()[0];
        if (firstHire && date < firstHire) return { status: STATUS.BEFORE_FIRST_HIRE, date };
        if (resolution.status !== STATUS.NO_EMPLOYMENT_HISTORY && resolution.status !== UNKNOWN) {
            return resolution; // Includes an explicitly documented gap between clean cycles.
        }
    }
    return { status: UNKNOWN, date, reason: resolution.reason || resolution.status };
}

module.exports = { ERGANI_PRIMARY_EVIDENCE, UNKNOWN, resolveErganiImportEmploymentEvidence };
