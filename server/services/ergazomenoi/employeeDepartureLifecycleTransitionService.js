'use strict';

const { dateKeyUtc } = require('../../utils/date/mondaySundayWeek');
const { effectiveStart, effectiveEnd } = require('../../utils/ergazomenoi/employmentProfileHistory');
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
    if ([effectiveStart(currentEmployee), currentEmployee.hmeromhnia_allaghs_orarioy_apo,
        currentEmployee.hmeromhnia_allaghs_symbashs].some(value => dateKeyUtc(value) > departure)) {
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
        const eventDates = [effectiveStart(row), row.hmeromhnia_allaghs_orarioy_apo,
            row.hmeromhnia_allaghs_symbashs, row.hmeromhnia_isxyos_dialleimatos_apo];
        return (priorDeparture && priorDeparture !== departure) ||
            eventDates.some(value => dateKeyUtc(value) > departure);
    })) throw departureError('EMPLOYEE_DEPARTURE_CONFLICT');

    const terminalHistoryRow = rows.at(-1) || null;
    const latestProfileRow = [...rows].reverse().find(row => effectiveStart(row)) || null;
    if (rows.length && (!terminalHistoryRow || !latestProfileRow)) {
        throw departureError('EMPLOYEE_DEPARTURE_HISTORY_REQUIRED');
    }
    if (latestProfileRow && dateKeyUtc(effectiveStart(latestProfileRow)) > departure) {
        throw departureError('EMPLOYEE_DEPARTURE_CONFLICT');
    }
    return { departure, cycle, terminalHistoryRow, latestProfileRow,
        clampEmployeeEnd: !dateKeyUtc(currentEmployee.hmeromhnia_isxyos_oron_ergasias_eos) ||
            dateKeyUtc(currentEmployee.hmeromhnia_isxyos_oron_ergasias_eos) > departure,
        clampProfileEnd: latestProfileRow && (!dateKeyUtc(effectiveEnd(latestProfileRow)) ||
            dateKeyUtc(effectiveEnd(latestProfileRow)) > departure) };
}

module.exports = { buildEmployeeDepartureTransition };
