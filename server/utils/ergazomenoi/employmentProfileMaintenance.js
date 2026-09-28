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
function submittedEmployeeMaintenanceFields(mapped, data) {
    const aliases = {
        eponymo: ['eponymoHidden'], onoma: ['onomaHidden'],
        afm: ['afm_ergazomenoyHidden'], amka: ['amka_ergazomenoyHidden'],
        afora_kataggelia_me_proeidopoihsh: ['kataggelia_me_proeidopoihsh'],
        hmeromhnia_koinopoihshs_kataggelias: ['hmnia_koinopoihshs_kataggelias'],
        logos_peratosis: ['logos_peratoshs_stathera'],
        parathrhseis_peratosis: ['parathrhseis_peratoshs'],
        efarmostea_sse_parathrhseis: ['parathrhseis_efarmosteas_sse'],
        kpk_efka_basei_symbashs: ['tmp_kpk_efka_stathera'],
        hmeromhnia_isxyos_oron_ergasias_apo: ['hmeromhnia_allaghs_orarioy_apo'],
        typos_ebdomadas: ['hmeres_ergasias_ebdomadas']
    };
    return Object.keys(mapped).filter(field => field === 'updatedAt' ||
        [field, `${field}Hidden`, `${field}_stathera`, `${field}_edit`,
            ...(aliases[field] || [])].some(source => Object.hasOwn(data, source)));
}
function isEmploymentProfileError(error) {
    const code = String(error?.code || '');
    return error?.code === 'INVALID_EMPLOYMENT_PROFILE' ||
        code.startsWith('EMPLOYEE_PROFILE_') ||
        code.startsWith('EMPLOYEE_HISTORY_') ||
        code.startsWith('EMPLOYEE_OPEN_CYCLE_') ||
        code.startsWith('EMPLOYMENT_CYCLE_') ||
        code.startsWith('CONFLICT_') ||
        ['HIRE_DATE_REQUIRES_CONTROLLED_LIFECYCLE', 'LEGACY_FACTS_REQUIRED',
            'NEW_VERSION_NOT_FUTURE'].includes(code);
}
function profileError(res, error) {
    const messages = {
        EMPLOYEE_DEPARTURE_INVALID_DATE: 'Η ημερομηνία αποχώρησης δεν είναι έγκυρη. Δεν αποθηκεύτηκε καμία αλλαγή.',
        EMPLOYEE_DEPARTURE_BEFORE_HIRE: 'Η αποχώρηση δεν μπορεί να προηγείται της πρόσληψης. Δεν αποθηκεύτηκε καμία αλλαγή.',
        EMPLOYEE_DEPARTURE_CURRENT_CYCLE_MISMATCH: 'Η τρέχουσα εργασιακή σχέση δεν συμφωνεί με το ιστορικό. Απαιτείται έλεγχος πριν από την αποχώρηση.',
        EMPLOYEE_DEPARTURE_HISTORY_REQUIRED: 'Δεν βρέθηκε ασφαλής εγγραφή του τρέχοντος ιστορικού για την αποχώρηση.',
        EMPLOYEE_DEPARTURE_CONFLICT: 'Η ημερομηνία αποχώρησης συγκρούεται με την υπάρχουσα σχέση ή μεταγενέστερη μεταβολή. Δεν αποθηκεύτηκε καμία αλλαγή.',
        EMPLOYEE_DEPARTURE_PROFILE_CHANGE_REQUIRES_SEPARATE_SAVE: 'Η ίδια υποβολή αλλάζει χρονικά όρια ή στοιχεία προφίλ που απαιτούν χωριστή μεταβολή. Αποθηκεύστε πρώτα αυτή τη μεταβολή και έπειτα την αποχώρηση.',
        EMPLOYEE_DEPARTURE_CANCELLATION_SEPARATE_SAVE_REQUIRED: 'Η ακύρωση αποχώρησης πρέπει να αποθηκευτεί χωριστά από άλλες αλλαγές στοιχείων εργαζομένου. Δεν αποθηκεύτηκε καμία αλλαγή.',
        EMPLOYEE_DEPARTURE_CANCELLATION_PROVENANCE_REQUIRED: 'Δεν υπάρχουν ασφαλή στοιχεία για την επαναφορά των ορίων που ίσχυαν πριν από την αποχώρηση. Δεν αποθηκεύτηκε καμία αλλαγή.',
        EMPLOYEE_PROFILE_DELETE_IDENTITY_MISMATCH: 'Η συγκεκριμένη εγγραφή ιστορικού προς διαγραφή δεν βρέθηκε. Δεν αποθηκεύτηκε καμία αλλαγή.',
        EMPLOYEE_PROFILE_DELETE_CURRENT_VERSION_UNSUPPORTED: 'Η διαγραφή αφαιρεί το ισχύον πλήρες ιστορικό του εργαζομένου χωρίς ασφαλή αντικατάσταση. Δεν γίνεται αυτόματη επαναφορά σε προηγούμενη περίοδο. Δεν αποθηκεύτηκε καμία αλλαγή.',
        EMPLOYEE_PROFILE_RETROSPECTIVE_BOUNDARY_UNSUPPORTED: 'Δεν υποστηρίζεται αναδρομική αλλαγή ορίων περιόδου ή μετακίνηση ορίων ελλιπούς ιστορικού. Δεν αποθηκεύτηκε καμία αλλαγή.',
        EMPLOYEE_PROFILE_NON_APPEND_CHANGE: 'Δεν υποστηρίζεται αναδρομική εισαγωγή νέας μεταβολής πριν ή στην ημερομηνία υπάρχοντος ιστορικού. Για διόρθωση διατηρήστε την ακριβή ταυτότητα της υπάρχουσας περιόδου.',
        EMPLOYEE_PROFILE_HISTORY_OVERLAP: 'Το ιστορικό περιέχει περισσότερες από μία επικαλυπτόμενες ενεργές περιόδους. Η μεταβολή δεν αποθηκεύτηκε. Απαιτείται έλεγχος του ιστορικού.',
        EMPLOYEE_PROFILE_TRANSACTIONS_UNAVAILABLE: 'Η αποθήκευση εργαζομένου και ιστορικού απαιτεί διαθέσιμες συναλλαγές. Δεν αποθηκεύτηκε η μεταβολή.',
        EMPLOYEE_PROFILE_LEGACY_CORRECTION_REQUIRES_FACTS: 'Η διόρθωση παλαιού ελλιπούς ιστορικού απαιτεί ρητά όλα τα στοιχεία της περιόδου.',
        EMPLOYEE_PROFILE_CORRECTION_IDENTITY_MISMATCH: 'Η διόρθωση απαιτεί την ακριβή υπάρχουσα εγγραφή και αμετάβλητες ημερομηνίες περιόδου. Δεν αποθηκεύτηκε η μεταβολή.',
        EMPLOYEE_PROFILE_HIRE_DATE_CHANGE_REQUIRES_REHIRE: 'Η ημερομηνία πρόσληψης δεν αλλάζει από απλή μεταβολή ιστορικού. Νέα εργασιακή σχέση καταχωρίζεται μόνο μέσω της επαναπρόσληψης.',
        EMPLOYEE_OPEN_CYCLE_DEPARTURE_REQUIRED_BEFORE_HIRE_CHANGE: 'Δεν επιτρέπεται αλλαγή ή νέα καταχώριση πρόσληψης όσο η τρέχουσα εργασιακή σχέση δεν έχει ημερομηνία αποχώρησης. Καταχωρήστε πρώτα την αποχώρηση και στη συνέχεια χρησιμοποιήστε τη διαδικασία Επαναπρόσληψης.',
        EMPLOYEE_PROFILE_HIRE_DATE_CHANGE_REQUIRES_LIFECYCLE_REPAIR: 'Η ημερομηνία πρόσληψης υπάρχουσας ιστορικής εγγραφής δεν αλλάζει από τον απλό editor. Απαιτείται ελεγχόμενη διόρθωση του ιστορικού.',
        EMPLOYEE_HISTORY_MANUAL_REVIEW_REQUIRED: 'Βρέθηκαν ασυνεπείς παλαιότερες εγγραφές ιστορικού και η αλλαγή δεν μπορεί να αποθηκευτεί με ασφάλεια. Δεν έγινε καμία αλλαγή. Επικοινωνήστε με τον διαχειριστή για έλεγχο του ιστορικού.',
        EMPLOYEE_HISTORY_REFERENCED_CLEANUP_REQUIRED: 'Βρέθηκαν παλαιότερες εγγραφές ιστορικού που χρησιμοποιούνται από άλλες καταχωρίσεις και δεν μπορούν να αφαιρεθούν αυτόματα. Δεν έγινε καμία αλλαγή. Επικοινωνήστε με τον διαχειριστή για έλεγχο του ιστορικού.',
        EMPLOYEE_HISTORY_REFERENCED_DELETE_FORBIDDEN: 'Η εγγραφή ιστορικού χρησιμοποιείται ήδη από υπολογισμούς ή αποθηκευμένα στοιχεία και δεν μπορεί να διαγραφεί. Δεν έγινε καμία αλλαγή.',
        EMPLOYEE_HISTORY_REFERENCED_UPDATE_REQUIRES_REPLACEMENT: 'Η εγγραφή ιστορικού χρησιμοποιείται από άλλη καταχώριση που εξαρτάται από τα ζωντανά στοιχεία της και δεν μπορεί να διορθωθεί επιτόπου. Δεν έγινε καμία αλλαγή.',
        EMPLOYEE_HISTORY_REFERENCE_CHECK_FAILED: 'Δεν ήταν δυνατό να επιβεβαιωθεί με ασφάλεια ότι οι παλαιότερες εγγραφές ιστορικού μπορούν να διορθωθούν. Δεν έγινε καμία αλλαγή.',
        EMPLOYEE_HISTORY_AUDIT_COLLECTION_MISSING: 'Η ασφαλής καταγραφή της διόρθωσης ιστορικού δεν έχει εγκατασταθεί. Δεν έγινε καμία αλλαγή. Επικοινωνήστε με τον διαχειριστή.',
        EMPLOYEE_HISTORY_AUDIT_COLLECTION_CHECK_FAILED: 'Δεν ήταν δυνατό να επιβεβαιωθεί η ασφαλής καταγραφή της διόρθωσης ιστορικού. Δεν έγινε καμία αλλαγή.',
        EMPLOYMENT_CYCLE_OPEN_BEFORE_NEXT_HIRE: 'Το ιστορικό περιέχει παλαιότερη ανοικτή εργασιακή σχέση πριν από νεότερη πρόσληψη. Απαιτείται έλεγχος του ιστορικού.',
        EMPLOYMENT_CYCLE_OVERLAP: 'Το ιστορικό περιέχει επικαλυπτόμενες εργασιακές σχέσεις. Απαιτείται έλεγχος του ιστορικού.',
        EMPLOYMENT_CYCLE_DEPARTURE_BEFORE_HIRE: 'Το ιστορικό περιέχει αποχώρηση πριν από την αντίστοιχη πρόσληψη. Απαιτείται έλεγχος του ιστορικού.',
        MISSING_OR_INVALID_SIXTH_DAY_PREMIUM_RATE: 'Η προσαύξηση 6ης ημέρας του ιστορικού πρέπει να είναι μη αρνητικός αριθμός.',
        EMPLOYEE_PROFILE_AMBIGUOUS_IDENTITY: 'Βρέθηκαν πολλαπλές εγγραφές με την ίδια ιστορική ταυτότητα. Δεν αποθηκεύτηκε η μεταβολή.',
        CONFLICT_OVERLAP: 'Η αλλαγή ορίων επικαλύπτεται με άλλη περίοδο ιστορικού. Διορθώστε τις ημερομηνίες και δοκιμάστε ξανά.',
        CONFLICT_AMBIGUOUS_TARGET: 'Βρέθηκαν περισσότερες από μία ασυνεπείς εγγραφές ιστορικού και δεν ήταν δυνατό να προσδιοριστεί με ασφάλεια η σωστή περίοδος. Δεν έγινε καμία αλλαγή. Επιλέξτε τη συγκεκριμένη περίοδο από το Ιστορικό.',
        CONFLICT_INCONSISTENT_HISTORY: 'Βρέθηκαν περισσότερες από μία ασυνεπείς εγγραφές ιστορικού και δεν ήταν δυνατό να προσδιοριστεί με ασφάλεια η σωστή περίοδος. Δεν έγινε καμία αλλαγή. Επιλέξτε τη συγκεκριμένη περίοδο από το Ιστορικό.',
        CONFLICT_STALE: 'Τα δεδομένα άλλαξαν από άλλο χρήστη. Ανανεώστε τη φόρμα και δοκιμάστε ξανά.',
        HIRE_DATE_REQUIRES_CONTROLLED_LIFECYCLE: 'Η αλλαγή ημερομηνίας πρόσληψης απαιτεί ελεγχόμενη ενέργεια κύκλου απασχόλησης και δεν εκτελείται από την απλή συντήρηση.',
        LEGACY_FACTS_REQUIRED: 'Η παλαιά εγγραφή δεν περιέχει αρκετά στοιχεία για ασφαλή διόρθωση. Συμπληρώστε ρητά τα στοιχεία της περιόδου.',
        NEW_VERSION_NOT_FUTURE: 'Η νέα μεταβολή πρέπει να αρχίζει μετά την τελευταία περίοδο του ίδιου κύκλου απασχόλησης.'
    };
    const message = error.code === 'INVALID_EMPLOYMENT_PROFILE'
        ? `Μη έγκυρα στοιχεία εργασίας (${error.field}): ${error.message}`
        : messages[error.code] || 'Η αποθήκευση εργαζομένου και ιστορικού απέτυχε. Δεν αποθηκεύτηκε η μεταβολή.';
    return res.status(error.statusCode || 500).json({ success: false, reason: error.code || 'EMPLOYEE_PROFILE_SAVE_FAILED',
        field: error.field, operation: error.operation || 'EMPLOYEE_MAINTENANCE', message, errorMessage: message });
}
module.exports = { profileInput, profileError, isEmploymentProfileError, historyEditorChanges,
    submittedEmployeeMaintenanceFields };
