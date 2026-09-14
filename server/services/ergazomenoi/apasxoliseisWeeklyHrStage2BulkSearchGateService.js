'use strict';

async function loadWeeklyHrStage2BulkSearchPresentation({ finalizedReadOnly = false,
    loadWritablePresentation } = {}) {
    if (finalizedReadOnly) return null;
    if (typeof loadWritablePresentation !== 'function') {
        throw new TypeError('loadWritablePresentation must be a function.');
    }
    return loadWritablePresentation();
}

module.exports = { loadWeeklyHrStage2BulkSearchPresentation };
