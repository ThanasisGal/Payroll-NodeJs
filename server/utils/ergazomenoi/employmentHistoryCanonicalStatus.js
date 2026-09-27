'use strict';

const REDUNDANT_STATUS_FIELD = 'employment_history_canonical_status';
const REDUNDANT_SURVIVOR_FIELD = 'employment_history_canonical_survivor_id';
const REDUNDANT_REFERENCED = 'REDUNDANT_REFERENCED';

function isPersistedReferencedRedundant(row = {}) {
    return row?.[REDUNDANT_STATUS_FIELD] === REDUNDANT_REFERENCED;
}

function semanticHistoryRows(rows = []) {
    return (Array.isArray(rows) ? rows : []).filter(row => !isPersistedReferencedRedundant(row));
}

module.exports = { REDUNDANT_STATUS_FIELD, REDUNDANT_SURVIVOR_FIELD,
    REDUNDANT_REFERENCED, isPersistedReferencedRedundant, semanticHistoryRows };
