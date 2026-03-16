'use strict';

/**
 * Φιλικά μηνύματα σφαλμάτων για τον χρήστη
 */
const USER_FRIENDLY_ERRORS = {
    TIMEOUT: 'Η σύνδεση με τον ΕΦΚΑ άργησε πολύ να ανταποκριθεί. Παρακαλώ δοκιμάστε ξανά σε λίγο.',
    SELECTOR_NOT_FOUND:
        'Δεν βρέθηκε το αναμενόμενο στοιχείο στη σελίδα του ΕΦΚΑ. Πιθανόν η σελίδα άλλαξε ή δεν φορτώθηκε σωστά.',
    SESSION_CLOSED:
        'Η σύνδεση με τον ΕΦΚΑ έκλεισε απροσδόκητα. Παρακαλώ ξεκινήστε ξανά τη διαδικασία.',
    NETWORK_ERROR: 'Αποτυχία σύνδεσης με τον ΕΦΚΑ. Παρακαλώ ελέγξτε τη σύνδεσή σας στο διαδίκτυο.',
    MISSING_CREDENTIALS:
        'Λείπουν απαραίτητα στοιχεία (ΑΜΕ ή ΑΜΚΑ). Παρακαλώ συμπληρώστε όλα τα πεδία.',
    NO_RESULTS: 'Δεν βρέθηκαν αποτελέσματα με τα στοιχεία που δώσατε.',
    DEFAULT: 'Παρουσιάστηκε πρόβλημα κατά τη σύνδεση με τον ΕΦΚΑ. Παρακαλώ δοκιμάστε ξανά.'
};

/**
 * Μετατρέπει τεχνικά σφάλματα σε κατανοητά μηνύματα για τον χρήστη
 * @param {Error|string} error - Το σφάλμα που προέκυψε
 * @returns {string} Φιλικό μήνυμα για τον χρήστη
 */
function getUserFriendlyError(error) {
    const errMsg = error?.message || String(error);

    // Timeout errors
    if (errMsg.includes('Timeout') && errMsg.includes('exceeded')) {
        return USER_FRIENDLY_ERRORS.TIMEOUT;
    }

    // Selector not found
    if (errMsg.includes('waitForSelector') || errMsg.includes('locator')) {
        return USER_FRIENDLY_ERRORS.SELECTOR_NOT_FOUND;
    }

    // Session/Page closed
    if (
        errMsg.includes('Session') ||
        errMsg.includes('page closed') ||
        errMsg.includes('Invalid/expired sessionId')
    ) {
        return USER_FRIENDLY_ERRORS.SESSION_CLOSED;
    }

    // Navigation errors
    if (errMsg.includes('Navigation') || errMsg.includes('net::')) {
        return USER_FRIENDLY_ERRORS.NETWORK_ERROR;
    }

    // Missing credentials
    if (errMsg.includes('Missing') && (errMsg.includes('AME') || errMsg.includes('AMKA'))) {
        return USER_FRIENDLY_ERRORS.MISSING_CREDENTIALS;
    }

    // No results found - αυτά είναι ήδη φιλικά
    if (errMsg.includes('0 αποτελέσματα') || errMsg.includes('Δεν βρέθηκαν')) {
        return errMsg;
    }

    // Default fallback
    return USER_FRIENDLY_ERRORS.DEFAULT;
}

module.exports = {
    USER_FRIENDLY_ERRORS,
    getUserFriendlyError
};
