'use strict';
const A = require('./employeeHistoryAutomaticReconstructionApplyContract');
const VERSION = 'employee-history-automatic-reconstruction-save:v1';
function saveToken(stateToken, request, actorUserId) {
    return A.hash({ operation: VERSION, stateToken, request, actor: String(actorUserId) });
}
function validateApproval(reconstruction) {
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
function sendReconstructionSaveError(res, error) {
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
        ? 'Το Ιστορικό άλλαξε μετά την προεπισκόπηση. Δεν αποθηκεύτηκε καμία αλλαγή. Ελέγξτε ξανά τη νέα πρόταση.'
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
module.exports = { VERSION, saveToken, validateApproval, assertCompatiblePlans, sendReconstructionSaveError };
