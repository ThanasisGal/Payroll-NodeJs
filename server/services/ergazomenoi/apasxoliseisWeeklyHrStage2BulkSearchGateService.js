'use strict';

async function loadWeeklyHrStage2BulkSearchPresentation({ finalizedReadOnly = false,
    reconstructionRequiredReadOnly = false,
    loadWritablePresentation } = {}) {
    if (finalizedReadOnly || reconstructionRequiredReadOnly) return null;
    if (typeof loadWritablePresentation !== 'function') {
        throw new TypeError('loadWritablePresentation must be a function.');
    }
    return loadWritablePresentation();
}

module.exports = { loadWeeklyHrStage2BulkSearchPresentation };
