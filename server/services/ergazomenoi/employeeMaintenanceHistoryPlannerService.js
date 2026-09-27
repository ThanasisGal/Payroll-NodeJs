'use strict';

const { INTENTS, resolveEmployeeHistoryMutation } =
    require('./employeeEmploymentProfileMutationResolverService');

function maintenanceDateOrNull(value) {
    if (!value) return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    const date = new Date(String(value).includes('T')
        ? value : `${value}T00:00:00.000+00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
}

function buildEmployeeMaintenanceIdentity(record = {}) {
    const scheduleStart = maintenanceDateOrNull(record.hmeromhnia_allaghs_orarioy_apo);
    return {
        hmeromhnia_proslhpshs: maintenanceDateOrNull(record.hmeromhnia_proslhpshs),
        hmeromhnia_allaghs_symbashs:
            maintenanceDateOrNull(record.hmeromhnia_allaghs_symbashs),
        hmeromhnia_allaghs_orarioy_apo: scheduleStart,
        hmeromhnia_allaghs_orarioy_eos:
            maintenanceDateOrNull(record.hmeromhnia_allaghs_orarioy_eos),
        hmeromhnia_isxyos_oron_ergasias_apo:
            maintenanceDateOrNull(record.hmeromhnia_isxyos_oron_ergasias_apo) || scheduleStart,
        hmeromhnia_isxyos_oron_ergasias_eos:
            maintenanceDateOrNull(record.hmeromhnia_isxyos_oron_ergasias_eos),
        hmeromhnia_lhxhs_symbashs:
            maintenanceDateOrNull(record.hmeromhnia_lhxhs_symbashs),
        hmeromhnia_apoxorhshs: maintenanceDateOrNull(record.hmeromhnia_apoxorhshs)
    };
}

function planEmployeeMaintenanceHistory({ scope, currentEmployee, historyRows = [],
    submittedState = {}, historyId = null, expectedRevision = null } = {}) {
    const identity = submittedState.identity ||
        buildEmployeeMaintenanceIdentity(currentEmployee);
    const effectiveFrom = submittedState.effectiveFrom ||
        identity.hmeromhnia_isxyos_oron_ergasias_apo ||
        identity.hmeromhnia_allaghs_orarioy_apo ||
        identity.hmeromhnia_proslhpshs;
    return resolveEmployeeHistoryMutation({
        scope,
        currentEmployee,
        historyRows,
        submittedState: { ...submittedState, identity, effectiveFrom },
        intentHint: INTENTS.MAINTENANCE,
        historyId,
        expectedRevision
    });
}

module.exports = { maintenanceDateOrNull, buildEmployeeMaintenanceIdentity,
    planEmployeeMaintenanceHistory };
