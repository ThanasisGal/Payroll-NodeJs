'use strict';
const A = require('./employeeHistoryAutomaticReconstructionApplyContract');
const VERSION = 'employee-departure-automatic-reconstruction:v1';
const OPERATION = 'FIRST_DEPARTURE';
const REQUIRED = A.PREFIX + 'REQUIRED_FOR_DEPARTURE';
const BLOCKED = A.PREFIX + 'DEPARTURE_BLOCKED';
const NEXT_ACTION = 'APPROVE_HISTORY_RECONSTRUCTION_AND_CONTINUE_DEPARTURE';

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
module.exports = { VERSION, OPERATION, REQUIRED, BLOCKED, NEXT_ACTION, previewToken, manualReview,
    sendDepartureReconstructionAction };
