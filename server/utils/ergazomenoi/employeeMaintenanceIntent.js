'use strict';
const { ErgazomenoiModel } = require('../../models/ergazomenoi');
const { normalizeEmployeeNormalSaveRequest } = require('./employeeNormalSaveNormalization');
const { departureMaintenanceFormEchoMatchesCurrent, departureMaintenanceValuesEqual,
    BASE_ZERO_NORMALIZABLE_FIELDS, normalizeBaseExperienceValue } = require('./employmentProfileMaintenance');
const { TRANSITION_FIELDS, semanticEmploymentProfilePatch } = require('./employmentProfileTransition');

function normalizeEmployeeMaintenanceIntent(request, current) {
    let normalized = require('../../services/ergazomenoi/employeeDepartureAutomaticReconstructionContract')
        .normalizeFirstDepartureRequest(normalizeEmployeeNormalSaveRequest(request, current), current);
    const C = require('./employmentProfileContract');
    const maintenance = normalized.maintenance || {};
    const form = maintenance.submittedFormValues || {};
    const owned = new Set(maintenance.submittedEmployeeFields || Object.keys(maintenance.employeeChanges || {}));
    const context = { ...current, ...Object.fromEntries(Object.entries(maintenance.employeeChanges || {})
        .filter(([field]) => owned.has(field) && !C.FACT_FIELDS.includes(field))) };
    const breaks = C.normalizeEmploymentBreakSubmission(normalized.input || {}, context,
        { allowLegacyDuration: false });
    const changedBreaks = semanticEmploymentProfilePatch(current, {}, breaks);
    normalized = { ...normalized, input: { ...normalized.input, ...changedBreaks } };
    const validity = 'hmeromhnia_isxyos_oron_ergasias_apo';
    const schedule = 'hmeromhnia_allaghs_orarioy_apo';
    const informationalFallback = current[validity] == null && Object.hasOwn(form, validity) &&
        (form[validity] == null || form[validity] === '') &&
        departureMaintenanceValuesEqual(validity, maintenance.employeeChanges?.[validity], form[schedule]);
    const unchanged = (field, value) => {
        if (departureMaintenanceFormEchoMatchesCurrent({ field, mappedValue: value,
            currentValue: current[field], formData: form })) return true;
        const visible = form[field];
        const visibleEmpty = visible == null || visible === '' || Array.isArray(visible) && visible.length === 0;
        if (Object.hasOwn(form, field) && visibleEmpty && Object.hasOwn(form, `${field}_stathera`) &&
            !departureMaintenanceValuesEqual(field, value, visible) &&
            !departureMaintenanceValuesEqual(field, value, current[field])) {
            throw Object.assign(new Error('EMPLOYEE_PROFILE_FORM_ECHO_CONFLICT'),
                { code: 'EMPLOYEE_PROFILE_FORM_ECHO_CONFLICT', statusCode: 409, field });
        }
        if (field === 'logos_peratosis' && value === '' && current[field]) return true;
        const path = ErgazomenoiModel.schema.path(field);
        // Only schema-declared neutral defaults may equate missing BSON with
        // serializer false/zero. Never coerce arbitrary missing business facts.
        if (current[field] == null && path &&
            ((path.instance === 'Boolean' && path.defaultValue === false && value === false) ||
             (path.instance === 'Number' && path.defaultValue === 0 && Number(value) === 0))) return true;
        if (TRANSITION_FIELDS.includes(field)) {
            return !Object.hasOwn(semanticEmploymentProfilePatch(current,
                { employeeChanges: { [field]: value } }), field);
        }
        const mirror = /^stoixeio_symbashs_(\d{2})_hidden$/.exec(field);
        return Boolean(mirror && departureMaintenanceValuesEqual(field, value,
            maintenance.employeeChanges?.[`stoixeio_symbashs_${mirror[1]}`]) &&
            departureMaintenanceValuesEqual(field, maintenance.employeeChanges?.[`stoixeio_symbashs_${mirror[1]}`], current[`stoixeio_symbashs_${mirror[1]}`]));
    };
    const patch = (values, employee = false) => Object.fromEntries(Object.entries(values || {})
        .map(([f,v]) => [f, BASE_ZERO_NORMALIZABLE_FIELDS.includes(f) ? normalizeBaseExperienceValue(v) : v])
        .filter(([f, v]) => v !== undefined && f !== 'updatedAt' &&
            (!employee || owned.has(f)) && !(f === validity && informationalFallback) && (BASE_ZERO_NORMALIZABLE_FIELDS.includes(f) && v === 0 && current[f] !== 0 || !unchanged(f, v))));
    return { ...normalized, input: patch(normalized.input), maintenance: { ...maintenance,
        employeeChanges: patch(maintenance.employeeChanges, true),
        historyChanges: patch(maintenance.submittedHistoryChanges || maintenance.historyChanges),
        submittedHistoryChanges: patch(maintenance.submittedHistoryChanges || maintenance.historyChanges),
        // Identity and row selection are derived from fresh persisted state.
        identity: undefined, originalHistoryId: null, correctableIdentityFields: [],
        submittedProfileFields: Object.keys(patch(normalized.input)) } };
}
module.exports = { normalizeEmployeeMaintenanceIntent };
