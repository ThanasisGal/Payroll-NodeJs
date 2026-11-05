'use strict';

const C = require('./employmentProfileContract');
const FIELD = 'employment_import_provenance';
const SOURCE = 'PREVIOUS_PAYROLL_APPLICATION';
function day(value) {
    try { return C.calendarDate(value)?.toISOString().slice(0, 10) || null; }
    catch { return null; }
}
const text = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 300;

// Only the dedicated, audited administrator confirmation writes this record.
// Neither timestamps nor the first profile nor the pre-V1 anchor prove import.
function verifiedImport(employee = {}, hire = null) {
    const value = employee?.[FIELD];
    if (!value || value.version !== 1 || value.source !== SOURCE || value.status !== 'VERIFIED' ||
        !day(value.hireDate) || !day(value.trackingStartDate) ||
        day(value.trackingStartDate) <= day(value.hireDate) ||
        hire && day(value.hireDate) !== day(hire) ||
        // Legacy declarations may retain descriptive fields; new declarations require neither.
        (Object.hasOwn(value, 'sourceApplication') && !text(value.sourceApplication)) ||
        (Object.hasOwn(value, 'evidenceReference') && !text(value.evidenceReference)) || !text(value.verifiedBy) ||
        !value.verifiedAt || !Number.isFinite(new Date(value.verifiedAt).getTime()) ||
        !/^[a-f0-9]{24}$/.test(String(value.auditId || ''))) return null;
    return value;
}

function assertNoImportSubmission(...records) {
    if (records.some(record => record && Object.keys(record).some(key =>
        key === FIELD || key.startsWith(`${FIELD}.`) || key.startsWith(`${FIELD}[`)))) {
        const code = 'EMPLOYEE_HISTORY_IMPORT_PROTECTED';
        throw Object.assign(new Error(code), { code, statusCode: 409,
            publicMessage: 'Η δήλωση μεταφοράς δεν αποθηκεύτηκε επειδή χρειάζεται χωριστή επιβεβαίωση διαχειριστή. Δεν αποθηκεύτηκε καμία αλλαγή. 1. Ακυρώστε αυτή την ενέργεια. 2. Ανοίξτε στο Ιστορικό τη «Μεταφορά από προηγούμενη εφαρμογή». Κωδικός αναφοράς: ΙΣΤ-ΜΕΤ-01.' });
    }
}

module.exports = { FIELD, SOURCE, day, text, verifiedImport, assertNoImportSubmission };
