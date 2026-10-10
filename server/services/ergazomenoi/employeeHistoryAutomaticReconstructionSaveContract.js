'use strict';
const A = require('./employeeHistoryAutomaticReconstructionApplyContract');
const VERSION = 'employee-history-automatic-reconstruction-save:v1';
function saveToken(stateToken, request, actorUserId) {
    return A.hash({ operation: VERSION, stateToken, request, actor: String(actorUserId) });
}
function validateApproval(reconstruction, savePayload) {
    const mutationKeys = ['rowDiffs', 'proposedRows', 'sourceHistoryIds', 'historyPatches', 'selectedHistoryMutations'];
    if ([savePayload, savePayload?.formData].some(value => value &&
        mutationKeys.some(key => Object.hasOwn(value, key)))) throw A.failure('INVALID_REQUEST', 400);
    if (reconstruction == null) return;
    if (!reconstruction || typeof reconstruction !== 'object' || Array.isArray(reconstruction) ||
        Object.keys(reconstruction).some(key => !['previewToken', 'approvalAccepted'].includes(key))) {
        throw A.failure('INVALID_REQUEST', 400);
    }
    if (reconstruction.approvalAccepted !== true) throw A.failure('APPROVAL_REQUIRED', 400);
    if (typeof reconstruction.previewToken !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(reconstruction.previewToken)) {
        throw A.failure('INVALID_REQUEST', 400);
    }
}
// The existing writer has already planned against the reconstructed state.
// A changed reconstruction field must still exist and retain its exact approved
// value. Equality is typed (missing, null, dates and numbers remain distinct).
function assertCompatiblePlans(reconstructionPlan, normalFinalRows) {
    const finalById = new Map(normalFinalRows.map(row => [String(row._id), row]));
    for (const diff of reconstructionPlan.rowDiffs) {
        const final = finalById.get(String(diff.historyId));
        if (!final || !A.equal(final[diff.field], diff.after)) throw A.failure('SAVE_CONFLICT');
    }
}
// Normal Maintenance sends the whole current form. An unchanged current
// value is an echo, not an instruction to undo an approved History repair.
// Only fields actually reconstructed are considered, and genuine current
// deltas remain intact for the existing writer and the overlap guard.
function originalSaveWithoutReconstructionEchoes(request, current, plan, targetAfter) {
    const { departureMaintenanceValuesEqual: equalFormValue } = require('../../utils/ergazomenoi/employmentProfileMaintenance');
    const fields = new Set(plan.rowDiffs.map(diff => diff.field));
    const echo = (field, value) => fields.has(field) && equalFormValue(field, value, current[field]);
    const omitEchoes = patch => Object.fromEntries(Object.entries(patch || {}).filter(([field, value]) => !echo(field, value)));
    const maintenance = request.maintenance;
    if (!maintenance) return request;
    const identity = maintenance.identity && { ...maintenance.identity };
    // Re-anchor only an exact previously selected History row. This changes
    // the identity expectation after repair, never the submitted historical facts.
    if (identity && targetAfter) for (const field of Object.keys(identity)) {
        if (echo(field, identity[field])) identity[field] = targetAfter[field];
    }
    return { ...request, input: omitEchoes(request.input), maintenance: { ...maintenance, identity,
        employeeChanges: omitEchoes(maintenance.employeeChanges),
        historyChanges: omitEchoes(maintenance.historyChanges),
        submittedHistoryChanges: omitEchoes(maintenance.submittedHistoryChanges) } };
}
function sendReconstructionSaveError(res, error) {
    if (require('./employeeDepartureAutomaticReconstructionContract').sendDepartureReconstructionAction(res, error)) return true;
    if (!String(error?.code || '').startsWith(A.PREFIX)) return false;
    if (error.code === A.PREFIX + 'REQUIRED') {
        res.status(200).json({ success: false, actionRequired: true, reason: error.code,
            reconstructionPreview: error.reconstructionPreview, previewToken: error.previewToken,
            nextAction: { type: 'APPROVE_HISTORY_RECONSTRUCTION_AND_CONTINUE_SAVE' } });
        return true;
    }
    const stale = error.code === A.PREFIX + 'STALE';
    const uncertain = error.code === A.PREFIX + 'COMMIT_UNCERTAIN';
    const explanation = stale
        ? 'Τα στοιχεία του εργαζομένου ή του Ιστορικού άλλαξαν μετά την προεπισκόπηση. Η αποθήκευση σταμάτησε για να ελεγχθούν οι νεότερες πληροφορίες. Δεν αποθηκεύτηκε καμία αλλαγή.'
        : uncertain
            ? 'Η εφαρμογή δεν μπόρεσε να επιβεβαιώσει αν ολοκληρώθηκε η αποθήκευση λόγω διακοπής της επικοινωνίας.'
            : error.code === A.PREFIX + 'SAVE_CONFLICT'
                ? 'Οι αλλαγές της φόρμας και η προτεινόμενη τακτοποίηση αλλάζουν διαφορετικά το ίδιο ιστορικό στοιχείο. Η αποθήκευση σταμάτησε για να διατηρηθούν οι σωστές τιμές. Δεν αποθηκεύτηκε καμία αλλαγή.'
                : 'Η αποθήκευση σταμάτησε επειδή δεν επιβεβαιώθηκε η έγκριση ή η ασφαλής τακτοποίηση του Ιστορικού. Δεν αποθηκεύτηκε καμία αλλαγή.';
    const message = explanation + (uncertain
        ? '\n1. Ελέγξτε τα αποθηκευμένα στοιχεία πριν επαναλάβετε την ενέργεια.\n2. Αν χρειάζεται, ζητήστε έλεγχο από διαχειριστή.'
        : '\n1. Κλείστε το μήνυμα· οι αλλαγές σας παραμένουν στη φόρμα.\n2. Ελέγξτε τα στοιχεία και πατήστε ξανά «Αποθήκευση» ή ζητήστε έλεγχο από διαχειριστή.') + '\nΚωδικός αναφοράς: ' + error.code + '.';
    res.status(error.statusCode || 409).json({ success: false, reason: error.code, message });
    return true;
}
module.exports = { VERSION, saveToken, validateApproval, assertCompatiblePlans, originalSaveWithoutReconstructionEchoes, sendReconstructionSaveError };
