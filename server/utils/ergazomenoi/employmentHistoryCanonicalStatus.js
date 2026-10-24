'use strict';

const REDUNDANT_STATUS_FIELD = 'employment_history_canonical_status';
const REDUNDANT_SURVIVOR_FIELD = 'employment_history_canonical_survivor_id';
const REDUNDANT_REFERENCED = 'REDUNDANT_REFERENCED';
const WITHDRAWN_ERRONEOUS = 'WITHDRAWN_ERRONEOUS';

function isInactiveHistoryRow(row = {}) {
    return isPersistedReferencedRedundant(row) ||
        row?.[REDUNDANT_STATUS_FIELD] === WITHDRAWN_ERRONEOUS;
}

function isPersistedReferencedRedundant(row = {}) {
    return row?.[REDUNDANT_STATUS_FIELD] === REDUNDANT_REFERENCED;
}

function semanticHistoryRows(rows = []) {
    return (Array.isArray(rows) ? rows : []).filter(row => !isInactiveHistoryRow(row));
}

module.exports = { REDUNDANT_STATUS_FIELD, REDUNDANT_SURVIVOR_FIELD,
    REDUNDANT_REFERENCED, WITHDRAWN_ERRONEOUS, isInactiveHistoryRow,
    isPersistedReferencedRedundant, semanticHistoryRows };
