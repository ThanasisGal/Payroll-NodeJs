'use strict';
function createEmployeeHistoryArchiveController({ service = require('../../services/ergazomenoi/employeeHistoryArchiveService')
    .createEmployeeHistoryArchiveService() } = {}) {
    return async (req, res) => {
        res.set('Cache-Control', 'no-store');
        try {
            return res.json({ ...await service.archive(req, req.body),
                message: 'Η εγγραφή αρχειοθετήθηκε και αφαιρέθηκε από το εμφανιζόμενο Ιστορικό. Οι ιστορικές τιμές, οι όροι εργασίας και τα εξαρτώμενα αρχεία διατηρήθηκαν.' });
        } catch (error) {
            const uncertain = error.code === 'EMPLOYEE_HISTORY_ARCHIVE_COMMIT_UNCERTAIN';
            const code = error.code?.startsWith('EMPLOYEE_HISTORY_ARCHIVE_') ? error.code : 'EMPLOYEE_HISTORY_ARCHIVE_FAILED';
            const reason = error.statusCode === 403 ? 'Δεν επιβεβαιώθηκε δικαίωμα διαγραφής για τον επιλεγμένο εργαζόμενο.' :
                error.statusCode === 409 ? 'Η εγγραφή ή τα στοιχεία ελέγχου άλλαξαν μετά το άνοιγμα της καρτέλας.' :
                    'Δεν ολοκληρώθηκαν όλοι οι απαραίτητοι έλεγχοι.';
            return res.status(error.statusCode || 500).json({ success: false, saved: uncertain ? null : false, code,
                message: 'Η διαγραφή εγγραφής Ιστορικού σταμάτησε. ' + reason +
                    (uncertain ? ' Δεν επιβεβαιώθηκε αν αποθηκεύτηκε η αρχειοθέτηση.' : ' Δεν αποθηκεύτηκε καμία αλλαγή από αυτό το αίτημα.') +
                    '\n1. Ανοίξτε ξανά το Ιστορικό του εργαζομένου και ελέγξτε αν εμφανίζεται η εγγραφή.' +
                    '\n2. Ελέγξτε την επιλεγμένη εταιρεία και την πρόσβασή σας. Αν το πρόβλημα παραμένει, επικοινωνήστε με την τεχνική υποστήριξη.' +
                    '\nΚωδικός αναφοράς: ' + code + '.' });
        }
    };
}
module.exports = { createEmployeeHistoryArchiveController };
