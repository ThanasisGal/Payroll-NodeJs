'use strict';

const {
    isApprovedOrphanResolution
} = require('./apasxoliseisOrphanCardResolutionService');

const APPROVED_ORPHAN_TYPES = new Set(['START_ONLY', 'END_ONLY']);

function isApprovedApologistikoBookOrphan(row = {}) {
    return isApprovedOrphanResolution(row) && APPROVED_ORPHAN_TYPES.has(
        String(row.orphan_card_resolution?.orphan_type || '').trim()
    );
}

function isPredeclaredRepoPreservedInApologistika(row = {}) {
    return row.repo === true && row.repo_apologistika === true &&
        String(row.kathgoria_ergasias_apologistika || '').trim() === 'ΑΝ';
}

function belongsToCanonicalApologistikoBook(row = {}) {
    if (row.apologistiko_biblio !== true) return false;
    if (isApprovedApologistikoBookOrphan(row)) return true;
    return !isPredeclaredRepoPreservedInApologistika(row);
}

function applyPredeclaredRepoBookRule(row = {}, updates = {}) {
    const finalState = { ...row, ...updates };
    if (isApprovedApologistikoBookOrphan(finalState)) {
        return { ...updates, apologistiko_biblio: true };
    }
    if (!isPredeclaredRepoPreservedInApologistika(finalState)) return updates;
    return { ...updates, apologistiko_biblio: false };
}

module.exports = { isApprovedApologistikoBookOrphan,
    isPredeclaredRepoPreservedInApologistika, belongsToCanonicalApologistikoBook,
    applyPredeclaredRepoBookRule };
