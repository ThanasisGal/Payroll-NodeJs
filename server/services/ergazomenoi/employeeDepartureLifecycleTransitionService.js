'use strict';

const { dateKeyUtc } = require('../../utils/date/mondaySundayWeek');
const { effectiveEnd } = require('../../utils/ergazomenoi/employmentProfileHistory');
const { complete } = require('../../utils/ergazomenoi/employmentProfileTemporal');
const { buildEmploymentCycles } = require('./employeeEmploymentCycleResolverService');

function departureError(code) {
    const error = new Error(code);
    error.code = code;
    error.statusCode = 409;
    return error;
}

function latestCycleRows(cycle, history) {
    return cycle.history_ids.map(id => history.find(row => String(row._id) === id));
}

// Schedule dates describe a predeclared plan. The legacy effectiveStart helper
// falls back to them, so it cannot prove that work terms changed after departure.
function explicitWorkTermsStart(row = {}) {
    if (row.afora_allagh_oron_ergasias === false && !complete(row)) return null;
    return dateKeyUtc(row.hmeromhnia_isxyos_oron_ergasias_apo);
}

function hasFutureWorkTermsEvent(row, departure) {
    return [explicitWorkTermsStart(row), dateKeyUtc(row.hmeromhnia_allaghs_symbashs),
        row.afora_allagh_dialleimatos === true
            ? dateKeyUtc(row.hmeromhnia_isxyos_dialleimatos_apo) : null]
        .some(date => date && date > departure);
}

function departureProfileStart(row) {
    const explicit = explicitWorkTermsStart(row);
    if (explicit) return explicit;
    // Pure legacy rows may only have a schedule date. They can serve as the
    // existing profile baseline, but never as a future work-terms event.
    if (row.afora_allagh_oron_ergasias === false ||
        Object.hasOwn(row, 'hmeromhnia_isxyos_oron_ergasias_apo')) return null;
    return dateKeyUtc(row.hmeromhnia_allaghs_orarioy_apo);
}

function buildEmployeeDepartureTransition({ currentEmployee, history = [], departureDate }) {
    if (!currentEmployee || currentEmployee.archived === true) {
        throw departureError('EMPLOYEE_DEPARTURE_CURRENT_CYCLE_MISMATCH');
    }
    const submittedDate = departureDate instanceof Date
        ? (Number.isNaN(departureDate.getTime()) ? '' : departureDate.toISOString().slice(0, 10))
        : departureDate;
    const departure = typeof submittedDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(submittedDate)
        ? dateKeyUtc(submittedDate) : null;
    if (!departure) throw departureError('EMPLOYEE_DEPARTURE_INVALID_DATE');
    const hire = dateKeyUtc(currentEmployee.hmeromhnia_proslhpshs);
    if (!hire) throw departureError('EMPLOYEE_DEPARTURE_CURRENT_CYCLE_MISMATCH');
    if (departure < hire) throw departureError('EMPLOYEE_DEPARTURE_BEFORE_HIRE');
    if (hasFutureWorkTermsEvent(currentEmployee, departure)) {
        throw departureError('EMPLOYEE_DEPARTURE_CONFLICT');
    }
    const storedDeparture = dateKeyUtc(currentEmployee.hmeromhnia_apoxorhshs);
    if (storedDeparture && storedDeparture !== departure) throw departureError('EMPLOYEE_DEPARTURE_CONFLICT');

    let cycles;
    try {
        cycles = buildEmploymentCycles({ currentEmployee, history });
    } catch (error) {
        if (!String(error?.code || '').startsWith('EMPLOYMENT_CYCLE_')) throw error;
        throw departureError('EMPLOYEE_DEPARTURE_CURRENT_CYCLE_MISMATCH');
    }
    const cycle = cycles.at(-1);
    if (!cycle?.is_current_cycle || cycle.hire_date !== hire || cycle.departure_date !== storedDeparture) {
        throw departureError('EMPLOYEE_DEPARTURE_CURRENT_CYCLE_MISMATCH');
    }
    if (history.length && !cycle.history_ids.length) throw departureError('EMPLOYEE_DEPARTURE_HISTORY_REQUIRED');
    const rows = latestCycleRows(cycle, history);
    if (rows.some(row => !row)) throw departureError('EMPLOYEE_DEPARTURE_HISTORY_REQUIRED');
    if (rows.some(row => {
        const priorDeparture = dateKeyUtc(row.hmeromhnia_apoxorhshs);
        return (priorDeparture && priorDeparture !== departure) ||
            hasFutureWorkTermsEvent(row, departure);
    })) throw departureError('EMPLOYEE_DEPARTURE_CONFLICT');

    const terminalHistoryRow = rows.at(-1) || null;
    const latestProfileRow = [...rows].reverse().find(row => {
        const start = departureProfileStart(row);
        return start && start <= departure;
    }) || null;
    if (rows.length && (!terminalHistoryRow || !latestProfileRow)) {
        throw departureError('EMPLOYEE_DEPARTURE_HISTORY_REQUIRED');
    }
    return { departure, cycle, terminalHistoryRow, latestProfileRow,
        clampEmployeeEnd: !dateKeyUtc(currentEmployee.hmeromhnia_isxyos_oron_ergasias_eos) ||
            dateKeyUtc(currentEmployee.hmeromhnia_isxyos_oron_ergasias_eos) > departure,
        clampProfileEnd: latestProfileRow && (!dateKeyUtc(effectiveEnd(latestProfileRow)) ||
            dateKeyUtc(effectiveEnd(latestProfileRow)) > departure) };
}

module.exports = { buildEmployeeDepartureTransition };
