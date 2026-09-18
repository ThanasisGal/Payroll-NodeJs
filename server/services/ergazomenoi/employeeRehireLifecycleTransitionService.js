'use strict';

const { dateKeyUtc } = require('../../utils/date/mondaySundayWeek');
const {
    buildEmploymentCycles
} = require('./employeeEmploymentCycleResolverService');

function rehireError(code, details = {}) {
    const error = new Error(code);
    error.code = code;
    error.statusCode = 409;
    error.details = details;
    return error;
}

function explicitOr(value, fallback) {
    return value === undefined || value === '' ? fallback : value;
}

function buildEmployeeRehireTransition({
    currentEmployee = null,
    history = [],
    rehireDate,
    employeeChanges = {},
    historyChanges = {}
} = {}) {
    if (!currentEmployee || typeof currentEmployee !== 'object') {
        throw rehireError('EMPLOYEE_REHIRE_EMPLOYEE_REQUIRED');
    }

    if (currentEmployee.archived === true) {
        throw rehireError('EMPLOYEE_REHIRE_ARCHIVED_EMPLOYEE');
    }

    const rehire = dateKeyUtc(rehireDate);
    if (!rehire) {
        throw rehireError('EMPLOYEE_REHIRE_INVALID_DATE', { rehireDate });
    }

    const cycles = buildEmploymentCycles({
        currentEmployee,
        history: Array.isArray(history) ? history : []
    });

    if (!cycles.length) {
        throw rehireError('EMPLOYEE_REHIRE_NO_EMPLOYMENT_CYCLE');
    }

    const latest = cycles.at(-1);
    const currentHire = dateKeyUtc(currentEmployee.hmeromhnia_proslhpshs);

    if (
        !latest.is_current_cycle ||
        !currentHire ||
        latest.hire_date !== currentHire
    ) {
        throw rehireError('EMPLOYEE_REHIRE_CURRENT_CYCLE_MISMATCH', {
            current_hire_date: currentHire,
            latest_cycle: latest
        });
    }

    if (!latest.departure_date) {
        throw rehireError('EMPLOYEE_REHIRE_CURRENT_RELATIONSHIP_OPEN', {
            latest_cycle: latest
        });
    }

    if (rehire <= latest.departure_date) {
        throw rehireError('EMPLOYEE_REHIRE_DATE_NOT_AFTER_DEPARTURE', {
            rehire_date: rehire,
            departure_date: latest.departure_date
        });
    }

    const contractStart = dateKeyUtc(
        explicitOr(employeeChanges.hmeromhnia_allaghs_symbashs, rehire)
    );
    const scheduleStart = dateKeyUtc(
        explicitOr(employeeChanges.hmeromhnia_allaghs_orarioy_apo, rehire)
    );

    if (!contractStart || contractStart < rehire) {
        throw rehireError('EMPLOYEE_REHIRE_INVALID_CONTRACT_START', {
            rehire_date: rehire,
            contract_start: contractStart
        });
    }

    if (!scheduleStart || scheduleStart < rehire) {
        throw rehireError('EMPLOYEE_REHIRE_INVALID_SCHEDULE_START', {
            rehire_date: rehire,
            schedule_start: scheduleStart
        });
    }

    const employeePatch = Object.freeze({
        ...employeeChanges,

        // Lifecycle identity is authoritative and cannot be overridden by stale
        // values coming from a previously rendered edit form.
        hmeromhnia_proslhpshs: rehire,
        hmeromhnia_apoxorhshs: null,
        energos: true,

        // A new relationship must never inherit old finite boundaries by accident.
        hmeromhnia_allaghs_symbashs: contractStart,
        hmeromhnia_allaghs_orarioy_apo: scheduleStart,
        hmeromhnia_allaghs_orarioy_eos:
            explicitOr(employeeChanges.hmeromhnia_allaghs_orarioy_eos, null),
        hmeromhnia_lhxhs_symbashs:
            explicitOr(employeeChanges.hmeromhnia_lhxhs_symbashs, null),
        hmeromhnia_isxyos_oron_ergasias_apo: rehire,
        hmeromhnia_isxyos_oron_ergasias_eos: null
    });

    const historyPatch = Object.freeze({
        ...historyChanges,

        hmeromhnia_proslhpshs: rehire,
        hmeromhnia_apoxorhshs: null,
        // Lifecycle dates in the new history row are a projection of the
        // reviewed employee relationship. They must never have an independent
        // stale value from an older history/form snapshot.
        hmeromhnia_allaghs_symbashs:
            employeePatch.hmeromhnia_allaghs_symbashs,
        hmeromhnia_allaghs_orarioy_apo:
            employeePatch.hmeromhnia_allaghs_orarioy_apo,
        hmeromhnia_allaghs_orarioy_eos:
            employeePatch.hmeromhnia_allaghs_orarioy_eos,
        hmeromhnia_lhxhs_symbashs:
            employeePatch.hmeromhnia_lhxhs_symbashs,
        hmeromhnia_isxyos_oron_ergasias_apo: rehire,
        hmeromhnia_isxyos_oron_ergasias_eos: null,

        afora_proslhpsh: true
    });

    if (
        !historyPatch.hmeromhnia_allaghs_symbashs ||
        historyPatch.hmeromhnia_allaghs_symbashs < rehire
    ) {
        throw rehireError('EMPLOYEE_REHIRE_INVALID_HISTORY_CONTRACT_START');
    }

    if (
        !historyPatch.hmeromhnia_allaghs_orarioy_apo ||
        historyPatch.hmeromhnia_allaghs_orarioy_apo < rehire
    ) {
        throw rehireError('EMPLOYEE_REHIRE_INVALID_HISTORY_SCHEDULE_START');
    }

    return Object.freeze({
        effective_from: rehire,
        cycle_no: latest.cycle_no + 1,
        previous_cycle: latest,
        employee_changes: employeePatch,
        history_changes: historyPatch,
        cycles_before_rehire: cycles
    });
}

module.exports = {
    buildEmployeeRehireTransition
};
