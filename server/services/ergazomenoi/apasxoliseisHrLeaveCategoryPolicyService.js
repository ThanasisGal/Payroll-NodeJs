'use strict';

const INTERNAL_POSSIBLE_LEAVE_CATEGORY = 'POSSIBLE_LEAVE';
const INTERNAL_POSSIBLE_LEAVE_DESCRIPTION = 'ΠΙΘΑΝΗ ΑΔΕΙΑ';

function normalizedText(value) {
    return String(value || '').trim().toUpperCase();
}

function isInternalPossibleLeaveCategory(value, description = '') {
    return normalizedText(value) === INTERNAL_POSSIBLE_LEAVE_CATEGORY ||
        normalizedText(description) === INTERNAL_POSSIBLE_LEAVE_DESCRIPTION;
}

function assertHrSelectableLeaveCategory(value) {
    if (!isInternalPossibleLeaveCategory(value)) return;
    const error = new Error('Η ΠΙΘΑΝΗ ΑΔΕΙΑ δεν αποτελεί επιλέξιμη τελική κατηγορία άδειας.');
    error.code = 'POSSIBLE_LEAVE_NOT_HR_SELECTABLE';
    error.statusCode = 400;
    throw error;
}

function buildHrSelectableLeaveCategoryQuery() {
    return {
        $nor: [
            { kodikos: INTERNAL_POSSIBLE_LEAVE_CATEGORY },
            { perigrafh: /^\s*ΠΙΘΑΝΗ ΑΔΕΙΑ\s*$/i }
        ]
    };
}

module.exports = {
    INTERNAL_POSSIBLE_LEAVE_CATEGORY,
    INTERNAL_POSSIBLE_LEAVE_DESCRIPTION,
    isInternalPossibleLeaveCategory,
    assertHrSelectableLeaveCategory,
    buildHrSelectableLeaveCategoryQuery
};
