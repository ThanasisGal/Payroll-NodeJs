'use strict';
const A = require('./employeeHistoryAutomaticReconstructionApplyContract');
const VERSION = 'employee-departure-automatic-reconstruction:v1';
const OPERATION = 'FIRST_DEPARTURE';
const REQUIRED = A.PREFIX + 'REQUIRED_FOR_DEPARTURE';
const BLOCKED = A.PREFIX + 'DEPARTURE_BLOCKED';
const NEXT_ACTION = 'APPROVE_HISTORY_RECONSTRUCTION_AND_CONTINUE_DEPARTURE';

// The real Edit form renders missing legacy notice fields as false/0 and an
// empty validity input. The controller derives a validity date from the schedule
// even when that input was empty. These exact echoes carry no new business intent;
// explicit dates, non-neutral notice values and changed schedule dates still pass
// through the existing mixed-change guards. Never persist the synthesized echoes.
function normalizeFirstDepartureRequest(request, current) {
    const maintenance = request.maintenance;
    const form = maintenance?.submittedFormValues;
    if (!maintenance || !form || current.hmeromhnia_apoxorhshs) return request;
    const equal = require('../../utils/ergazomenoi/employmentProfileMaintenance').departureMaintenanceValuesEqual;
    const empty = value => value == null || value === '';
    const omitted = new Set();
    for (const [field, source, neutral] of [
        ['afora_kataggelia_me_proeidopoihsh', 'kataggelia_me_proeidopoihsh', false],
        ['mhnes_proeidopoihshs', 'mhnes_proeidopoihshs', 0]
    ]) {
        if (current[field] == null && Object.hasOwn(form, source) && form[source] === neutral &&
            maintenance.employeeChanges?.[field] === neutral) omitted.add(field);
    }
    const validity = 'hmeromhnia_isxyos_oron_ergasias_apo';
    const schedule = 'hmeromhnia_allaghs_orarioy_apo';
    if (empty(current[validity]) && empty(form[validity]) && Object.hasOwn(form, schedule) &&
        equal(schedule, form[schedule], current[schedule]) &&
        equal(validity, maintenance.employeeChanges?.[validity], form[schedule])) omitted.add(validity);
    // The History mapper also derives aliases that may be absent in both
    // legacy documents. Preserve their absence when they merely restate the
    // persisted employment type/workdays; reconstruction owns any actual fill.
    const { semanticEmploymentProfilePatch } = require('../../utils/ergazomenoi/employmentProfileTransition');
    for (const [field, source] of [['typos_apasxolhshs', 'kathestos_apasxolhshs'],
        ['typos_ebdomadas', 'hmeres_ergasias_ebdomadas']]) {
        const value = maintenance.submittedHistoryChanges?.[field];
        if (current[field] == null && !empty(current[source]) && value !== undefined &&
            !Object.keys(semanticEmploymentProfilePatch(current, { historyChanges: { [field]: value } })).length) {
            omitted.add(field);
        }
    }
    if (!omitted.size) return request;
    const patch = value => value && Object.fromEntries(Object.entries(value).filter(([field]) => !omitted.has(field)));
    return { ...request, input: patch(request.input), maintenance: { ...maintenance,
        employeeChanges: patch(maintenance.employeeChanges), historyChanges: patch(maintenance.historyChanges),
        submittedHistoryChanges: patch(maintenance.submittedHistoryChanges), identity: patch(maintenance.identity),
        submittedEmployeeFields: maintenance.submittedEmployeeFields?.filter(field => !omitted.has(field)) } };
}

// Unlike the standalone reconstruction token, approval of departure binds all
// persisted fields (including informational dates and technical History fences).
// Only our own Employee serialization increment is excluded.
function previewToken({ scope, current, history, plan, request, actorUserId }) {
    const { employee_profile_mutation_sequence, ...employee } = current;
    return A.hash({ version: VERSION, operation: OPERATION, scope, employee,
        history: A.ordered(history), plan, request, actor: String(actorUserId) });
}
function manualReview(cause) {
    const error = A.failure('DEPARTURE_BLOCKED', 200);
    error.departureCause = cause?.code || cause;
    return error;
}
function sendDepartureReconstructionAction(res, error) {
    if (error?.code === REQUIRED) {
        res.status(200).json({ success: false, actionRequired: true, reason: REQUIRED,
            operation: OPERATION, reconstructionPreview: error.reconstructionPreview,
            previewToken: error.previewToken, nextAction: { type: NEXT_ACTION } });
        return true;
    }
    if (error?.code !== BLOCKED) return false;
    res.status(200).json({ success: false, actionRequired: true, reason: BLOCKED,
        operation: OPERATION, nextAction: { type: 'OPEN_EMPLOYEE_HISTORY_TAB' },
        message: 'Η αποχώρηση δεν μπορεί να ολοκληρωθεί αυτόματα. Ελέγξτε το Ιστορικό. ' +
            'Η εφαρμογή δεν βρήκε ασφαλή τρόπο να τακτοποιήσει το Ιστορικό και να ολοκληρώσει την αποχώρηση. ' +
            'Δεν αποθηκεύτηκε καμία αλλαγή.\n1. Ελέγξτε το «Ιστορικό Προσλήψεων/Αλλαγών»· οι αλλαγές σας παραμένουν στη φόρμα.\n' +
            '2. Χρησιμοποιήστε «Έλεγχος & Αυτόματη Τακτοποίηση», αν είναι διαθέσιμο, ή ζητήστε έλεγχο από διαχειριστή.\n' +
            'Κωδικός αναφοράς: ' + BLOCKED + '.' });
    return true;
}
module.exports = { VERSION, OPERATION, REQUIRED, BLOCKED, NEXT_ACTION, normalizeFirstDepartureRequest, previewToken, manualReview,
    sendDepartureReconstructionAction };
