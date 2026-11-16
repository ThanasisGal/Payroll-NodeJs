'use strict';
const P = require('../../services/ergazomenoi/employeeHistoryApprovedProposalContract');
const reasons = {
    DISABLED: 'Η πραγματική εφαρμογή δεν έχει ενεργοποιηθεί για αυτή την εγκατάσταση.',
    AUTHENTICATION: 'Απαιτείται ενεργή σύνδεση.', SCOPE: 'Δεν επιβεβαιώθηκε η σωστή εταιρεία και ο εργαζόμενος.',
    RIGHTS: 'Δεν επιβεβαιώθηκαν τα απαιτούμενα δικαιώματα.',
    APPROVAL: 'Η επιβεβαίωση δεν συμφωνεί με τις συγκεκριμένες αλλαγές και τη συνεδρία σας.',
    STALE: 'Τα αρχικά στοιχεία, η περίπτωση ή οι διαθέσιμες επιλογές άλλαξαν μετά την προεπισκόπηση.',
    EXPIRED: 'Η προεπισκόπηση έχει λήξει και χρειάζεται νέος έλεγχος.', CASE: 'Δεν επιβεβαιώθηκε μία συγκεκριμένη επεξεργάσιμη περίπτωση.',
    EVIDENCE: 'Λείπει το τεκμήριο ή η δήλωση ότι τα προτεινόμενα στοιχεία είναι τεκμηριωμένα.',
    INCOMPLETE: 'Η προτεινόμενη εγγραφή δεν περιέχει όλα τα απαιτούμενα έγκυρα στοιχεία.',
    VALUE: 'Κάποια προτεινόμενη τιμή ή συνδυασμός όρων δεν επιτρέπεται.',
    BREAK_SCOPE: 'Δεν επιβεβαιώθηκε ασφαλής ισχύς του διαλείμματος αποκλειστικά στην εξεταζόμενη περίοδο.',
    PROFILE_CERTIFICATION_REQUIRED: 'Η παλαιά εγγραφή χρειάζεται χωριστή ελεγχόμενη πιστοποίηση πριν δεχθεί αυτή την εγκεκριμένη ρύθμιση εργασίας.',
    LIFECYCLE: 'Η αλλαγή αφορά πρόσληψη, αποχώρηση ή προστατευμένη ιστορική ταυτότητα και χρειάζεται την ειδική διαδικασία.',
    DATES: 'Οι ημερομηνίες δεν συμφωνούν με την καταγεγραμμένη εργασιακή σχέση.',
    WORK_TERMS: 'Οι προτεινόμενες ημέρες, ώρες ή άλλοι όροι δεν συμφωνούν μεταξύ τους.',
    COVERAGE: 'Η προτεινόμενη περίοδος επικαλύπτει άλλη ιστορική εγγραφή.',
    COVERAGE_GAP: 'Η αλλαγή αφήνει νέο ακάλυπτο διάστημα στο Ιστορικό.',
    REFERENCE: 'Η συγκεκριμένη περίπτωση συνδέεται με προστατευμένες καταχωρίσεις.',
    PERIOD_PROTECTED: 'Το επηρεαζόμενο διάστημα περιλαμβάνει κλειδωμένη ή οριστικοποιημένη περίοδο.',
    PERIOD_BUSY: 'Εκτελείται υπολογισμός σε επηρεαζόμενη περίοδο.',
    PROTECTION_UNKNOWN: 'Δεν επιβεβαιώθηκαν υφιστάμενες ανοικτές περίοδοι για ολόκληρο το επηρεαζόμενο διάστημα. Δεν ορίστηκε αυθαίρετη ημερομηνία λήξης.',
    AUDIT_UNAVAILABLE: 'Δεν είναι διαθέσιμη η υποχρεωτική ασφαλής καταγραφή της ενέργειας.',
    TRANSACTIONS_UNAVAILABLE: 'Δεν επιβεβαιώθηκε η απαραίτητη υποδομή ασφαλούς αποθήκευσης της εγκατάστασης.',
    NO_CHANGES: 'Δεν προέκυψε συγκεκριμένη αλλαγή για καταχώριση.', REQUEST: 'Το αίτημα δεν αναγνωρίστηκε.',
    DRAFT: 'Ο εργαζόμενος δεν έχει οριστικοποιημένα αρχικά στοιχεία.'
};
function sendFailure(res, error, phase) {
    const changed = error.saved === true;
    const known = Boolean(reasons[error.reason]) || ['BOUNDARY', 'VERIFICATION', 'INSERT_FAILED', 'AUDIT_FAILED'].includes(error.reason);
    const uncertain = !changed && (phase === 'reconcile' || error.reason === 'COMMIT_UNCERTAIN' || phase !== 'preview' && !known && error.statusCode !== 403);
    const reason = error.reason || (error.statusCode === 403 ? 'RIGHTS' : 'TRANSACTION_FAILED');
    const code = `${P.OPERATION}_${reason}`;
    const action = phase === 'preview' ? 'Η προεπισκόπηση των ΜΕΤΑ' : phase === 'reconcile' ? 'Ο έλεγχος αποτελέσματος της εφαρμογής' : 'Η εφαρμογή των ΜΕΤΑ';
    const state = changed ? 'Η αρχική εγκεκριμένη ενέργεια καταγράφηκε, αλλά τα αποθηκευμένα στοιχεία έχουν μεταβληθεί έκτοτε. Αυτός ο έλεγχος δεν αποθήκευσε νέα αλλαγή.' :
        uncertain ? 'Δεν επιβεβαιώθηκε αν ολοκληρώθηκε η προηγούμενη αποθήκευση. Δεν επιτρέπεται να θεωρηθεί ούτε επιτυχία ούτε ακύρωση.' :
            `${reasons[reason] || 'Δεν ολοκληρώθηκε ο ασφαλής έλεγχος της συγκεκριμένης αλλαγής.'} Δεν αποθηκεύτηκε καμία αλλαγή.`;
    res.set('Cache-Control', 'no-store');
    return res.status(uncertain ? 503 : error.statusCode || 409).json({ success: false, saved: changed ? true : uncertain ? null : false,
        outcome: changed ? 'COMMITTED_STATE_CHANGED' : uncertain ? 'UNKNOWN' : 'REJECTED', executionEnabled: false, code,
        message: `${action} σταμάτησε. ${state} Οι τοπικές συμπληρώσεις διατηρούνται.\n` +
            (uncertain ? '1. Μην επαναλάβετε την εφαρμογή και διατηρήστε την καρτέλα ανοικτή.\n2. Πατήστε «Έλεγχος αποτελέσματος» ή ζητήστε αναγνωστικό έλεγχο από τον διαχειριστή.' :
                '1. Ελέγξτε την περίπτωση, τις ημερομηνίες, τα τεκμήρια και τις αναφερόμενες εκκρεμότητες.\n2. Δημιουργήστε νέα προεπισκόπηση αφού διορθωθεί το εμπόδιο ή ζητήστε έλεγχο από διαχειριστή.') +
            `\nΚωδικός αναφοράς: ${code}.` });
}
function createEmployeeHistoryApprovedProposalController({ service = require('../../services/ergazomenoi/employeeHistoryApprovedProposalService')
    .createEmployeeHistoryApprovedProposalService() } = {}) {
    const action = phase => async (req, res) => {
        res.set('Cache-Control', 'no-store');
        try {
            const result = await service[phase](req, req.body);
            return res.json({ ...result, message: phase === 'preview' ?
                'Ο έλεγχος ολοκληρώθηκε. Ελέγξτε τις ακριβείς αλλαγές και το τεκμήριο. Δεν αποθηκεύτηκε καμία αλλαγή και δεν έχει δοθεί επιχειρησιακή έγκριση.' :
                'Η εγκεκριμένη αλλαγή και η ασφαλής καταγραφή της επιβεβαιώθηκαν στην αποθηκευμένη κατάσταση. Το Ιστορικό παραμένει προς έλεγχο· άλλες εκκρεμότητες δεν διορθώθηκαν.' });
        } catch (error) { return sendFailure(res, error, phase); }
    };
    return { preview: action('preview'), apply: action('apply'), reconcile: action('reconcile') };
}
module.exports = { createEmployeeHistoryApprovedProposalController, sendFailure };
