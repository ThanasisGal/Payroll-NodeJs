'use strict';
const crypto = require('node:crypto');

const isTemporaryEmployee = employee => employee?.oristikh_enhmerosh === false;
function saveStateError(code, statusCode = 409) {
    return Object.assign(new Error(code), { code, statusCode });
}
// Reserve one Employee identity for each newly allocated company business code.
// Concurrent Add requests cannot create two employees owning the same code.
function employeeCreationId(scope) {
    return crypto.createHash('sha256').update(JSON.stringify([
        scope.team, scope.company_kod, scope.kodikos, 'employee-create:v1'
    ])).digest('hex').slice(0, 24);
}
function employeeStateToken(employee) {
    employee = employee?.toObject ? employee.toObject() : employee;
    const normalize = value => {
        if (value instanceof Date) return value.toISOString();
        if (value?.toHexString) return value.toHexString();
        if (Array.isArray(value)) return value.map(normalize);
        if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort()
            .filter(key => !['employee_profile_mutation_sequence'].includes(key) && value[key] !== undefined)
            .map(key => [key, normalize(value[key])]));
        return value;
    };
    return crypto.createHash('sha256').update(JSON.stringify(normalize(employee))).digest('hex');
}
function assertEmployeeState(employee, expected, required = false) {
    if (expected === undefined && !required) return;
    if (typeof expected !== 'string' || expected !== employeeStateToken(employee)) {
        throw saveStateError('EMPLOYEE_SAVE_STATE_STALE');
    }
}
function employeeSaveMode(body = {}) {
    if (!body || typeof body !== 'object' || Array.isArray(body) ||
        (body.formData != null && (typeof body.formData !== 'object' || Array.isArray(body.formData)))) {
        throw saveStateError('EMPLOYEE_SAVE_INVALID_MODE', 400);
    }
    const mode = body.saveMode ?? 'final';
    if (!['temporary', 'final'].includes(mode) ||
        Object.hasOwn(body, 'oristikh_enhmerosh') || Object.hasOwn(body.formData || {}, 'oristikh_enhmerosh') ||
        (mode === 'temporary' && (body.rehireIntent === true || body.reconstruction || body.resolution || body.updates?.length))) {
        throw saveStateError('EMPLOYEE_SAVE_INVALID_MODE', 400);
    }
    return mode;
}
function sendEmployeeSaveStateError(res, error) {
    if (!String(error?.code || '').startsWith('EMPLOYEE_SAVE_')) return false;
    const explanations = {
        EMPLOYEE_SAVE_COMMIT_UNCERTAIN: 'Δεν επιβεβαιώθηκε το αποτέλεσμα της αποθήκευσης. Ενδέχεται να έχουν αποθηκευτεί τα στοιχεία.',
        EMPLOYEE_SAVE_NOT_FOUND: 'Ο εργαζόμενος δεν βρέθηκε στη διαθέσιμη εταιρεία και ομάδα. Η ενέργεια σταμάτησε για να προστατευθούν τα στοιχεία.',
        EMPLOYEE_SAVE_COMPANY_FORBIDDEN: 'Η εταιρεία δεν είναι διαθέσιμη στην ομάδα σας. Η αποθήκευση σταμάτησε για να προστατευθούν τα στοιχεία της.',
        EMPLOYEE_SAVE_STATE_STALE: 'Τα στοιχεία άλλαξαν μετά το άνοιγμα της φόρμας. Η αποθήκευση σταμάτησε για να διατηρηθούν οι νεότερες αλλαγές.',
        EMPLOYEE_SAVE_ALREADY_FINAL: 'Ο εργαζόμενος έχει ήδη οριστικοποιηθεί. Δεν επιτρέπεται προσωρινή αποθήκευση ή δεύτερη οριστικοποίηση από παλαιά φόρμα.',
        EMPLOYEE_SAVE_HIRE_LOCKED: 'Ο εργαζόμενος έχει οριστικοποιηθεί και η ημερομηνία πρόσληψης είναι κλειδωμένη.',
        EMPLOYEE_SAVE_DRAFT_REQUIRED: 'Η ενέργεια προϋποθέτει οριστικοποιημένη πρόσληψη. Ο εργαζόμενος είναι προσωρινά αποθηκευμένος.',
        EMPLOYEE_SAVE_INVALID_MODE: 'Δεν αναγνωρίστηκε έγκυρη επιλογή αποθήκευσης.',
        EMPLOYEE_SAVE_INVALID_DATA: 'Τα στοιχεία του εργαζομένου δεν είναι πλήρη ή περιλαμβάνουν μη έγκυρες τιμές.',
        EMPLOYEE_SAVE_DRAFT_HISTORY_EXISTS: 'Βρέθηκαν επιχειρησιακές εγγραφές για τον προσωρινό εργαζόμενο. Η οριστικοποίηση σταμάτησε για να ελεγχθεί η συμφωνία των στοιχείων.',
        EMPLOYEE_SAVE_FAILED: 'Η αποθήκευση δεν ολοκληρώθηκε επειδή απέτυχε ένας από τους απαραίτητους ελέγχους ή ενημερώσεις.'
    };
    const outcome = error.code === 'EMPLOYEE_SAVE_COMMIT_UNCERTAIN' ? '' : ' Δεν αποθηκεύτηκε καμία αλλαγή.';
    const message = `${explanations[error.code] || explanations.EMPLOYEE_SAVE_FAILED}${outcome}\n` +
        '1. Ανοίξτε ξανά τον εργαζόμενο από τη Συντήρηση Εργαζομένων.\n' +
        '2. Ελέγξτε τα στοιχεία και την κατάσταση αποθήκευσης πριν δοκιμάσετε ξανά.\n' +
        `3. Αν το πρόβλημα παραμένει, επικοινωνήστε με την τεχνική υποστήριξη.\nΚωδικός αναφοράς: ${error.code}`;
    res.status(error.statusCode || 409).json({ success: false, reason: error.code, message, errorMessage: message });
    return true;
}
module.exports = { isTemporaryEmployee, employeeCreationId, employeeStateToken, assertEmployeeState,
    employeeSaveMode, saveStateError, sendEmployeeSaveStateError };

// Pending documents stay exclusively in Employee BSON; temporary saves must
// never invoke storage services. Only declared PDF slots are accepted.
function draftAttachmentFields(formData = {}) {
    const fields = ['bibliario_anhlikoy_base64', 'arxeio_nomimopoihtikon_eggrafon_base64',
        'arxeio_apodoxhs_oysiodon_oron_base64', 'arxeio_apodoxhs_oron_atomikhs_symbashs_base64',
        'arxeio_symbashs_daneismoy_base64'];
    const result = {};
    for (const field of fields) {
        const value = formData[field];
        if (value == null || value === '') continue;
        if (typeof value !== 'string' || value.length > 8 * 1024 * 1024 ||
            !/^data:application\/pdf;base64,JVBERi0[A-Za-z0-9+/=\s]*$/.test(value)) {
            throw saveStateError('EMPLOYEE_SAVE_INVALID_DATA', 400);
        }
        result[field] = value;
    }
    return result;
}
module.exports.draftAttachmentFields = draftAttachmentFields;
