'use strict';
const { AUTO_DERIVED_READONLY_FIELDS, departureMaintenanceValuesEqual } =
    require('./employmentProfileMaintenance');

// The Edit serializer emits these exact defaults even for legacy documents
// without the fields. Other lending fields and the lending flag are not echoes.
const PASSIVE_LENDING_DEFAULTS = Object.freeze({
    afm_daneizontos_ergodoth: '',
    afm_daneizomenoy_ergodoth: '',
    typos_ergodoth_daneismoy: false,
    kodikos_ergazomenoy_alloy_ergodoth: ''
});

function normalizeEmployeeNormalSaveRequest(request, current) {
    const maintenance = request.maintenance;
    if (!current || !maintenance) return request;
    const changes = maintenance.employeeChanges || {};
    const submitted = maintenance.submittedFormValues || changes;
    const omitted = new Set(AUTO_DERIVED_READONLY_FIELDS);
    if (current.afora_daneismo_ergazomenoy !== true &&
        submitted.afora_daneismo_ergazomenoy !== true &&
        changes.afora_daneismo_ergazomenoy !== true) {
        for (const [field, neutral] of Object.entries(PASSIVE_LENDING_DEFAULTS)) {
            // Check the original submission too: the controller's legitimate
            // non-lending cleanup must not disguise a forged non-neutral value.
            const original = Object.hasOwn(submitted, field) ? submitted[field] : changes[field];
            if (Object.hasOwn(changes, field) && changes[field] === neutral &&
                original === neutral &&
                (current[field] == null || current[field] === neutral)) omitted.add(field);
        }
    }
    if (Object.hasOwn(changes, 'forologikh_klimaka') &&
        departureMaintenanceValuesEqual('forologikh_klimaka',
            changes.forologikh_klimaka, current.forologikh_klimaka)) omitted.add('forologikh_klimaka');
    const patch = value => value && Object.fromEntries(Object.entries(value)
        .filter(([field]) => !omitted.has(field)));
    const names = value => value && value.filter(field => !omitted.has(field));
    return { ...request, input: patch(request.input), maintenance: { ...maintenance,
        employeeChanges: patch(maintenance.employeeChanges),
        historyChanges: patch(maintenance.historyChanges),
        submittedHistoryChanges: patch(maintenance.submittedHistoryChanges),
        submittedEmployeeFields: names(maintenance.submittedEmployeeFields),
        submittedProfileFields: names(maintenance.submittedProfileFields) } };
}

module.exports = { PASSIVE_LENDING_DEFAULTS, normalizeEmployeeNormalSaveRequest };
