'use strict';
const C = require('./employmentProfileContract');

// Extract facts from the existing Add/Edit payload. No client-owned version stamps.
function profileInput(formData, mode) {
    const input = Object.fromEntries(C.FACT_FIELDS.filter(field =>
        ![C.SCHEMA_VERSION, C.TYPE_VERSION].includes(field) &&
        Object.hasOwn(formData, field) && formData[field] !== undefined).map(field => [field, formData[field]]));
    const arrival = `evelikth_proselefsh_${mode}`;
    if (!Object.hasOwn(input, 'evelikth_proselefsh') && formData[arrival] !== undefined) input.evelikth_proselefsh = formData[arrival];
    return input;
}
// The history table sends six dates, not a full employee form. Preserve omitted
// work terms; derived canonical fields are included only when their source was sent.
function historyEditorChanges(mapped, data) {
    const fields = new Set(Object.keys(data));
    if (['kathestos_apasxolhshs', 'kathestos_apasxolhshs_stathera', 'typos_apasxolhshs'].some(key => fields.has(key))) {
        fields.add('kathestos_apasxolhshs'); fields.add('typos_apasxolhshs');
    }
    if (fields.has('hmeres_ergasias_ebdomadas')) fields.add('typos_ebdomadas');
    return Object.fromEntries(Object.entries(mapped).filter(([field]) => fields.has(field)));
}
function isEmploymentProfileError(error) {
    return error?.code === 'INVALID_EMPLOYMENT_PROFILE' || String(error?.code || '').startsWith('EMPLOYEE_PROFILE_');
}
function profileError(res, error) {
    const messages = {
        EMPLOYEE_PROFILE_DELETE_IDENTITY_MISMATCH: 'Η συγκεκριμένη εγγραφή ιστορικού προς διαγραφή δεν βρέθηκε. Δεν αποθηκεύτηκε καμία αλλαγή.',
        EMPLOYEE_PROFILE_DELETE_CURRENT_VERSION_UNSUPPORTED: 'Η διαγραφή αφαιρεί το ισχύον πλήρες ιστορικό του εργαζομένου χωρίς ασφαλή αντικατάσταση. Δεν γίνεται αυτόματη επαναφορά σε προηγούμενη περίοδο. Δεν αποθηκεύτηκε καμία αλλαγή.',
        EMPLOYEE_PROFILE_RETROSPECTIVE_BOUNDARY_UNSUPPORTED: 'Δεν υποστηρίζεται αναδρομική αλλαγή ορίων περιόδου ή μετακίνηση ορίων ελλιπούς ιστορικού. Δεν αποθηκεύτηκε καμία αλλαγή.',
        EMPLOYEE_PROFILE_NON_APPEND_CHANGE: 'Δεν υποστηρίζεται αναδρομική εισαγωγή νέας μεταβολής πριν ή στην ημερομηνία υπάρχοντος ιστορικού. Για διόρθωση διατηρήστε την ακριβή ταυτότητα της υπάρχουσας περιόδου.',
        EMPLOYEE_PROFILE_TRANSACTIONS_UNAVAILABLE: 'Η αποθήκευση εργαζομένου και ιστορικού απαιτεί διαθέσιμες συναλλαγές. Δεν αποθηκεύτηκε η μεταβολή.',
        EMPLOYEE_PROFILE_LEGACY_CORRECTION_REQUIRES_FACTS: 'Η διόρθωση παλαιού ελλιπούς ιστορικού απαιτεί ρητά όλα τα στοιχεία της περιόδου.',
        EMPLOYEE_PROFILE_CORRECTION_IDENTITY_MISMATCH: 'Η διόρθωση απαιτεί την ακριβή υπάρχουσα εγγραφή και αμετάβλητες ημερομηνίες περιόδου. Δεν αποθηκεύτηκε η μεταβολή.',
        MISSING_OR_INVALID_SIXTH_DAY_PREMIUM_RATE: 'Η προσαύξηση 6ης ημέρας του ιστορικού πρέπει να είναι μη αρνητικός αριθμός.',
        EMPLOYEE_PROFILE_AMBIGUOUS_IDENTITY: 'Βρέθηκαν πολλαπλές εγγραφές με την ίδια ιστορική ταυτότητα. Δεν αποθηκεύτηκε η μεταβολή.'
    };
    const message = error.code === 'INVALID_EMPLOYMENT_PROFILE'
        ? `Μη έγκυρα στοιχεία εργασίας (${error.field}): ${error.message}`
        : messages[error.code] || 'Η αποθήκευση εργαζομένου και ιστορικού απέτυχε. Δεν αποθηκεύτηκε η μεταβολή.';
    return res.status(error.statusCode || 500).json({ success: false, reason: error.code || 'EMPLOYEE_PROFILE_SAVE_FAILED',
        field: error.field, message, errorMessage: message });
}
module.exports = { profileInput, profileError, isEmploymentProfileError, historyEditorChanges };
