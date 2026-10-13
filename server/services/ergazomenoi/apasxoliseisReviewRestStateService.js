'use strict';

const { isValidDeclaredRest, isValidDeclaredNonWork } = require('./apasxoliseisEffectiveRepoStateService');
const { dateKeyUtc } = require('../../utils/date/mondaySundayWeek');

// Read-only reconciliation. Valid declared rest never requires a retrospective write.
function resolveReviewRestState(row = {}) {
    const date = dateKeyUtc(row.hmeromhnia);
    if (isValidDeclaredRest(row)) return { date, status: 'VALID_DECLARED_REST',
        classification: 'REST_REPO', requires_write: false };
    if (isValidDeclaredNonWork(row)) return { date, status: 'VALID_DECLARED_NON_WORK',
        classification: 'NON_WORK', requires_write: false };
    const category = String(row.kathgoria_ergasias_apologistika_original ??
        row.kathgoria_ergasias_apologistika ?? '').trim();
    const repo = row.repo_apologistika_original ?? row.repo_apologistika;
    const canonical = row.apologistiko_biblio === true &&
        ((category === 'ΑΝ' && repo === true) ||
            (category === 'ΜΕ' && repo === false));
    if (canonical) return { date, status: 'CANONICAL', requires_write: false };
    const incomplete = repo === true || ['ΑΝ', 'ΜΕ'].includes(category) ||
        (row.apologistiko_biblio === true && !category);
    return { date, status: incomplete ? 'REVIEW_REQUIRED' : 'NOT_APPLICABLE',
        requires_write: false };
}

module.exports = { resolveReviewRestState };
