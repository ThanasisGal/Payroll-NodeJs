'use strict';
const guidance = require('../../../public/js/ergazomenoi/programmata/employmentReviewGuidance');
const { dates } = require('./apasxoliseisReviewDiagnosticService');

// Keep machine codes in structured data. Never display error.message, a raw
// request, identifiers of other companies, or an arbitrary diagnostic object.
function reviewErrorResponse(error = {}, fallbackCode = 'UNKNOWN', { readOnly = false } = {}) {
    const validCode = value => typeof value === 'string' && /^[A-Z][A-Z0-9_]{1,100}$/.test(value);
    const code = validCode(error.code) ? error.code : fallbackCode;
    const codes = [...new Set([code, ...(Array.isArray(error.blocking_reasons)
        ? error.blocking_reasons.filter(validCode) : [])])];
    const descriptions = codes.map(reason => {
        const detailDates = (Array.isArray(error.diagnostics) ? error.diagnostics : [])
            .filter(item => item?.code === reason)
            .flatMap(item => Array.isArray(item.dates) ? item.dates : []);
        return { code: reason, ...guidance.describe(reason), dates: dates(detailDates),
            reference: guidance.reference(reason) };
    });
    const steps = [...new Set(descriptions.flatMap(item => item.steps))];
    const state = readOnly ? 'Η ανάγνωση δεν αποθήκευσε επιχειρησιακές αλλαγές.'
        : 'Δεν επιβεβαιώθηκε ολοκλήρωση της ενέργειας. Εκτελέστε νέα «Αναζήτηση» για να ελέγξετε αν αποθηκεύτηκε κάποια αλλαγή πριν επαναλάβετε την ενέργεια.';
    return { success: false, code, guidance: descriptions,
        save_state: readOnly ? 'READ_ONLY' : 'NOT_CONFIRMED',
        message: descriptions.map(item => item.message + ' ' + item.why).join('\n\n') +
            '\n\nΤι να κάνετε:\n' + steps.map((step, index) => `${index + 1}. ${step}`).join('\n') +
            '\n\n' + state + '\nΑναφορά τεχνικής υποστήριξης: ' + guidance.reference(code) };
}
module.exports = { reviewErrorResponse };
