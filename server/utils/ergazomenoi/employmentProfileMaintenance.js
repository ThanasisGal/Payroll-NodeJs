'use strict';
const C = require('./employmentProfileContract');

const DEPARTURE_FORM_ECHO_ALIASES = Object.freeze({
    typos_taytothtas: ['taytothta_stathera'],
    yphkoothta: ['yphkoothta_stathera'],
    eidikh_kathgoria_ergazomenoy: ['eidikh_kathgoria_stathera'],
    oikogeneiakh_katastash: ['oikogeneiakh_katastash_stathera'],
    perifereia: ['perifereia_stathera'],
    nomos: ['nomos_stathera'],
    dhmos: ['dhmos_stathera'],
    polh: ['polh_stathera'],
    ekpaideytiko_epipedo: ['ekpaideytiko_epipedo_stathera'],
    kathestos_apasxolhshs: ['kathestos_apasxolhshs_stathera'],
    sxesh_ergasias: ['sxesh_ergasias_stathera'],
    thesh_eythynhs: ['thesh_eythynhs_stathera'],
    apasxolhsh_basei_symbashs: ['apasxolhsh_basei_symbashs_stathera'],
    eidikothta_erganh: ['eidikothta_erganh_stathera'],
    typos_ergazomenon: ['typos_ergazomenon_stathera'],
    ypokatasthma: ['ypokatasthma_stathera'],
    foreas_kyrias_asfalishs: ['foreas_kyrias_asfalishs_stathera'],
    foreas_epikoyrikhs_asfalishs: ['foreas_epikoyrikhs_asfalishs_stathera'],
    symbash: ['symbash_stathera'],
    kathgoria_symbashs: ['kathgoria_symbashs_stathera'],
    eidikothta_symbashs: ['eidikothta_symbashs_stathera']
});
const DEPARTURE_FORM_NEUTRAL_DEFAULTS = Object.freeze({
    corrective_payroll_withholding_rate_percent: 0,
    pososto_prosayxhshs_6hs_hmeras: 0,
    typos_ergodoth_daneismoy: false
});
const DEPARTURE_FORM_JSON_ARRAY_FIELDS = new Set([
    'foreas_epikoyrikhs_asfalishs', 'typos_metabolhs'
]);

function decodeDepartureFormArrayEcho(value) {
    if (Array.isArray(value)) return value.map(item => departureFormComparable(null, item));
    if (typeof value !== 'string') return value;
    try {
        const decoded = JSON.parse(value);
        return Array.isArray(decoded)
            ? decoded.map(item => departureFormComparable(null, item)) : value;
    } catch {
        return value;
    }
}

function departureFormComparable(field, value) {
    if (value instanceof Date) return Number.isNaN(value.getTime())
        ? String(value) : value.toISOString().slice(0, 10);
    if (value === null || value === undefined || value === '') {
        return Object.hasOwn(DEPARTURE_FORM_NEUTRAL_DEFAULTS, field)
            ? DEPARTURE_FORM_NEUTRAL_DEFAULTS[field] : null;
    }
    if (field === 'forologikh_klimaka') {
        const normalized = String(value).trim();
        const match = normalized.match(/^(?:\d{4})?(\d{4})(?:\s*-\s*.*)?$/u);
        return match ? match[1] : normalized;
    }
    if (DEPARTURE_FORM_JSON_ARRAY_FIELDS.has(field)) {
        if (Array.isArray(value) && value.length === 1 && typeof value[0] === 'string') {
            const decoded = decodeDepartureFormArrayEcho(value[0]);
            if (Array.isArray(decoded)) return decoded;
        }
        return decodeDepartureFormArrayEcho(value);
    }
    if (Array.isArray(value)) return value.map(item => departureFormComparable(null, item));
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) return value.slice(0, 10);
    return value;
}

function departureMaintenanceValuesEqual(field, left, right) {
    return JSON.stringify(departureFormComparable(field, left)) ===
        JSON.stringify(departureFormComparable(field, right));
}

function departureMaintenanceFormEchoMatchesCurrent({ field, currentValue, mappedValue,
    formData = {} }) {
    if (departureMaintenanceValuesEqual(field, mappedValue, currentValue)) return true;
    const visible = formData[field];
    const emptyVisible = visible === null || visible === undefined || visible === '' ||
        (Array.isArray(visible) && visible.length === 0);
    if (!Object.hasOwn(formData, field) || !emptyVisible) return false;
    const aliases = DEPARTURE_FORM_ECHO_ALIASES[field] || [`${field}_stathera`];
    return aliases.some(alias => Object.hasOwn(formData, alias) &&
        departureMaintenanceValuesEqual(field, formData[alias], currentValue));
}

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
        code.startsWith('EMPLOYEE_DEPARTURE_') ||
        code.startsWith('EMPLOYEE_OPEN_CYCLE_') ||
        code.startsWith('EMPLOYMENT_CYCLE_') ||
        code.startsWith('CONFLICT_') ||
        ['HIRE_DATE_REQUIRES_CONTROLLED_LIFECYCLE', 'LEGACY_FACTS_REQUIRED',
            'NEW_VERSION_NOT_FUTURE'].includes(code);
}
function sanitizedEmployeeHistoryResolution(value) {
    if (!value || typeof value !== 'object' || value.version !== 1 ||
        value.kind !== 'UNIQUE_SAFE_REPAIR' ||
        !/^[a-f0-9]{64}$/.test(String(value.fingerprint || '')) ||
        !Array.isArray(value.options) || value.options.length !== 1 ||
        value.options[0]?.id !== 'APPLY_UNIQUE_SAFE_PLAN') return null;
    return {
        version: 1,
        kind: 'UNIQUE_SAFE_REPAIR',
        title: String(value.title || ''),
        explanation: String(value.explanation || ''),
        options: [{
            id: 'APPLY_UNIQUE_SAFE_PLAN',
            label: String(value.options[0].label || ''),
            description: String(value.options[0].description || '')
        }],
        fingerprint: String(value.fingerprint)
    };
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
        EMPLOYEE_DEPARTURE_CANCELLATION_REQUIRES_CONTROLLED_FLOW: 'Η αποχώρηση δεν μπορεί να ακυρωθεί από απλή αλλαγή ιστορικού. 1. Ανανεώστε τη φόρμα. 2. Ελέγξτε την αποθηκευμένη πρόσληψη και αποχώρηση. 3. Επαναλάβετε την ακύρωση μόνο αν τα στοιχεία παραμένουν σωστά. Δεν αποθηκεύτηκε καμία αλλαγή. Κωδικός αναφοράς: EMPLOYEE_DEPARTURE_CANCELLATION_REQUIRES_CONTROLLED_FLOW',
        EMPLOYEE_DEPARTURE_DATE_CORRECTION_BLOCKED: 'Η εφαρμογή δεν μπόρεσε να αποδείξει με ασφάλεια ποια εργασιακή σχέση αφορά η νέα ημερομηνία αποχώρησης. 1. Ανανεώστε τη φόρμα. 2. Ελέγξτε την πρόσληψη, την αποχώρηση και τυχόν επαναπρόσληψη. 3. Επαναλάβετε μόνο αν η διόρθωση αφορά τη μοναδική τρέχουσα σχέση. Δεν αποθηκεύτηκε καμία αλλαγή. Κωδικός αναφοράς: EMPLOYEE_DEPARTURE_DATE_CORRECTION_BLOCKED',
        EMPLOYEE_DEPARTURE_DATE_CORRECTION_INVALID_BOUNDARY: 'Η τελική κατάσταση δεν συμφώνησε με την ασφαλή διόρθωση αποχώρησης που υπολογίστηκε. 1. Ανανεώστε τη φόρμα. 2. Ελέγξτε ότι δεν άλλαξαν ενδιάμεσα τα στοιχεία. 3. Επαναλάβετε την αποθήκευση. Δεν αποθηκεύτηκε καμία αλλαγή. Κωδικός αναφοράς: EMPLOYEE_DEPARTURE_DATE_CORRECTION_INVALID_BOUNDARY',
        EMPLOYEE_DEPARTURE_DATE_CORRECTION_STALE: 'Η αποχώρηση ή το ιστορικό άλλαξε αφού ανοίξατε τη φόρμα. 1. Ανανεώστε τη φόρμα. 2. Ελέγξτε τη νεότερη ημερομηνία αποχώρησης. 3. Υποβάλετε ξανά μόνο τη σωστή διόρθωση. Δεν αποθηκεύτηκε καμία αλλαγή. Κωδικός αναφοράς: EMPLOYEE_DEPARTURE_DATE_CORRECTION_STALE',
        EMPLOYEE_DEPARTURE_DEFERRED_AMBIGUITY_INVALID_BOUNDARY: 'Η αποχώρηση θα επηρέαζε παλαιότερη ασάφεια ή διαφορετική εργασιακή περίοδο. 1. Ανανεώστε τη φόρμα. 2. Ελέγξτε την τρέχουσα σχέση απασχόλησης. 3. Ζητήστε έλεγχο ιστορικού αν το πρόβλημα παραμένει. Δεν αποθηκεύτηκε καμία αλλαγή. Κωδικός αναφοράς: EMPLOYEE_DEPARTURE_DEFERRED_AMBIGUITY_INVALID_BOUNDARY',
        EMPLOYEE_HISTORY_INVALID_DEPARTURE_NOT_APPLICABLE: 'Η αποθηκευμένη κατάσταση δεν είναι η μοναδική περίπτωση αποχώρησης πριν από πρόσληψη που μπορεί να διορθωθεί αυτόματα. 1. Ανανεώστε τη φόρμα. 2. Ελέγξτε τις ημερομηνίες πρόσληψης και αποχώρησης. 3. Ζητήστε έλεγχο ιστορικού αν η ασυνέπεια παραμένει. Δεν αποθηκεύτηκε καμία αλλαγή. Κωδικός αναφοράς: EMPLOYEE_HISTORY_INVALID_DEPARTURE_NOT_APPLICABLE',
        EMPLOYEE_HISTORY_INVALID_DEPARTURE_TARGET_MISMATCH: 'Η εφαρμογή δεν βρήκε μία μοναδική ιστορική εγγραφή που να συμφωνεί με την άκυρη αποχώρηση. 1. Ανανεώστε τη φόρμα. 2. Ελέγξτε τις ημερομηνίες της τρέχουσας σχέσης. 3. Μην επαναλάβετε την ακύρωση αν υπάρχουν πολλαπλές πιθανές περίοδοι. Δεν αποθηκεύτηκε καμία αλλαγή. Κωδικός αναφοράς: EMPLOYEE_HISTORY_INVALID_DEPARTURE_TARGET_MISMATCH',
        EMPLOYEE_HISTORY_INVALID_DEPARTURE_COMPETING_DEPARTURE: 'Βρέθηκε δεύτερη πιθανή αποχώρηση για την ίδια εργασιακή σχέση. 1. Ανανεώστε τη φόρμα. 2. Ελέγξτε όλες τις ημερομηνίες του κύκλου. 3. Ζητήστε έλεγχο ιστορικού πριν από νέα προσπάθεια. Δεν αποθηκεύτηκε καμία αλλαγή. Κωδικός αναφοράς: EMPLOYEE_HISTORY_INVALID_DEPARTURE_COMPETING_DEPARTURE',
        EMPLOYEE_HISTORY_INVALID_DEPARTURE_CURRENT_CHANGE_REQUIRED: 'Η ακύρωση θα απαιτούσε και άλλη αλλαγή στην τρέχουσα εργασιακή κατάσταση. 1. Ανανεώστε τη φόρμα. 2. Ελέγξτε την πρόσληψη και την ενεργή κατάσταση. 3. Ζητήστε έλεγχο ιστορικού. Δεν αποθηκεύτηκε καμία αλλαγή. Κωδικός αναφοράς: EMPLOYEE_HISTORY_INVALID_DEPARTURE_CURRENT_CHANGE_REQUIRED',
        EMPLOYEE_HISTORY_INVALID_DEPARTURE_REMAINING_AMBIGUITY: 'Η αφαίρεση της άκυρης αποχώρησης δεν αρκεί για συνεπές ιστορικό. 1. Ανανεώστε τη φόρμα. 2. Ελέγξτε τις υπόλοιπες περιόδους. 3. Ζητήστε έλεγχο ιστορικού πριν από νέα αποθήκευση. Δεν αποθηκεύτηκε καμία αλλαγή. Κωδικός αναφοράς: EMPLOYEE_HISTORY_INVALID_DEPARTURE_REMAINING_AMBIGUITY',
        EMPLOYEE_HISTORY_INVALID_DEPARTURE_CORRECTION_BLOCKED_OTHER: 'Η εφαρμογή δεν μπόρεσε να αποδείξει μία μοναδική ασφαλή διόρθωση της άκυρης αποχώρησης. 1. Ανανεώστε τη φόρμα. 2. Ελέγξτε τις ημερομηνίες. 3. Ζητήστε έλεγχο ιστορικού. Δεν αποθηκεύτηκε καμία αλλαγή. Κωδικός αναφοράς: EMPLOYEE_HISTORY_INVALID_DEPARTURE_CORRECTION_BLOCKED_OTHER',
        EMPLOYEE_HISTORY_INVALID_DEPARTURE_CORRECTION_INVALID_REQUEST: 'Το αίτημα ακύρωσης δεν συμφωνεί με τη νεότερη αποθηκευμένη κατάσταση. 1. Ανανεώστε τη φόρμα. 2. Ελέγξτε την αποχώρηση. 3. Υποβάλετε ξανά μόνο αν εξακολουθεί να χρειάζεται ακύρωση. Δεν αποθηκεύτηκε καμία αλλαγή. Κωδικός αναφοράς: EMPLOYEE_HISTORY_INVALID_DEPARTURE_CORRECTION_INVALID_REQUEST',
        EMPLOYEE_HISTORY_INVALID_DEPARTURE_CORRECTION_INVALID_BOUNDARY: 'Η τελική κατάσταση δεν συμφώνησε με τη μοναδική ασφαλή διόρθωση που υπολογίστηκε. 1. Ανανεώστε τη φόρμα. 2. Ελέγξτε αν άλλαξαν τα στοιχεία. 3. Επαναλάβετε μόνο μετά τον έλεγχο. Δεν αποθηκεύτηκε καμία αλλαγή. Κωδικός αναφοράς: EMPLOYEE_HISTORY_INVALID_DEPARTURE_CORRECTION_INVALID_BOUNDARY',
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
        EMPLOYEE_HISTORY_UNIQUE_SAFE_REPAIR_REQUIRED: 'Η αποθήκευση σταμάτησε επειδή βρέθηκε ασυνέπεια στο ιστορικό που μπορεί να τακτοποιηθεί με ασφάλεια. 1. Επιλέξτε «Ακύρωση» για να μη γίνει καμία ενέργεια. 2. Επιλέξτε «Τακτοποίηση ιστορικού» για να επιβεβαιώσετε τη διόρθωση και την αρχική αποθήκευση. Δεν αποθηκεύτηκε καμία αλλαγή. Κωδικός αναφοράς: EMPLOYEE_HISTORY_UNIQUE_SAFE_REPAIR_REQUIRED',
        EMPLOYEE_HISTORY_UNIQUE_SAFE_REPAIR_STALE: 'Η κατάσταση του εργαζομένου ή του ιστορικού άλλαξε μετά την εμφάνιση της επιβεβαίωσης. 1. Ανανεώστε τη φόρμα. 2. Ελέγξτε τα νεότερα στοιχεία. 3. Πατήστε ξανά Αποθήκευση μόνο αν εξακολουθούν να είναι σωστά. Δεν αποθηκεύτηκε καμία αλλαγή. Κωδικός αναφοράς: EMPLOYEE_HISTORY_UNIQUE_SAFE_REPAIR_STALE',
        EMPLOYEE_HISTORY_UNIQUE_SAFE_REPAIR_INVALID_BOUNDARY: 'Η τελική διόρθωση δεν συμφώνησε με το μοναδικό ασφαλές σχέδιο που είχε επιβεβαιωθεί. 1. Ανανεώστε τη φόρμα. 2. Ελέγξτε το ιστορικό. 3. Επαναλάβετε την αποθήκευση. Δεν αποθηκεύτηκε καμία αλλαγή. Κωδικός αναφοράς: EMPLOYEE_HISTORY_UNIQUE_SAFE_REPAIR_INVALID_BOUNDARY',
        EMPLOYEE_HISTORY_RESOLUTION_INVALID_REQUEST: 'Η επιβεβαίωση τακτοποίησης δεν ήταν έγκυρη. 1. Ανανεώστε τη φόρμα. 2. Πατήστε ξανά Αποθήκευση. 3. Επιβεβαιώστε μόνο την επιλογή που εμφανίζει η εφαρμογή. Δεν αποθηκεύτηκε καμία αλλαγή. Κωδικός αναφοράς: EMPLOYEE_HISTORY_RESOLUTION_INVALID_REQUEST',
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
    const response = { success: false, reason: error.code || 'EMPLOYEE_PROFILE_SAVE_FAILED',
        field: error.field, operation: error.operation || 'EMPLOYEE_MAINTENANCE',
        message, errorMessage: message };
    const resolution = sanitizedEmployeeHistoryResolution(error.resolution);
    if (error.code === 'EMPLOYEE_HISTORY_UNIQUE_SAFE_REPAIR_REQUIRED' &&
        error.resolutionRequired === true && resolution) {
        response.resolutionRequired = true;
        response.resolution = resolution;
    }
    return res.status(error.statusCode || 500).json(response);
}
module.exports = { profileInput, profileError, isEmploymentProfileError, historyEditorChanges,
    submittedEmployeeMaintenanceFields, departureMaintenanceValuesEqual,
    departureMaintenanceFormEchoMatchesCurrent, sanitizedEmployeeHistoryResolution };
