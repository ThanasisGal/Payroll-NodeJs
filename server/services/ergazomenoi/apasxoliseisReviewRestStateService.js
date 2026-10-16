'use strict';

const { isValidDeclaredRest, isValidDeclaredNonWork } = require('./apasxoliseisEffectiveRepoStateService');
const { dateKeyUtc } = require('../../utils/date/mondaySundayWeek');
const { resolveDailyActualWorkFacts } = require('./apasxoliseisDailyActualWorkFactsService');

// Read-only reconciliation. Valid declared rest never requires a retrospective write.
function resolveReviewRestState(row = {}) {
    row = { ...row, ...Object.fromEntries(['kathgoria_ergasias',
        'kathgoria_ergasias_apologistika', 'repo_apologistika']
        .filter(field => Object.hasOwn(row, `${field}_original`))
        .map(field => [field, row[`${field}_original`]])) };
    const date = dateKeyUtc(row.hmeromhnia);
    const category = String(row.kathgoria_ergasias_apologistika ?? '').trim();
    const repo = row.repo_apologistika;
    const review = reason_code => ({ date, status: 'REVIEW_REQUIRED',
        reason_code, requires_human_decision: true, requires_write: false });
    if (['ΑΝ', 'ΜΕ'].includes(category)) {
        const facts = resolveDailyActualWorkFacts(row);
        if (facts.countsAsActualWorkDay || facts.cardHours > 0 ||
            facts.hasCompleteCardEvidence || facts.unresolvedCardPairNumbers.length ||
            Number(row.ores_pragmatikhs_ergasias_apologistika || 0) > 0 ||
            Number(row.ores_ergasias_apologistika || 0) > 0) {
            return review('REST_CLASSIFICATION_WORK_CONFLICT');
        }
        if (row.adeia_apologistika === true || row.astheneia_apologistika === true ||
            row.apousia_apologistika === true) return review('REST_CLASSIFICATION_DECISION_CONFLICT');
    }
    if (isValidDeclaredRest(row)) return { date, status: 'VALID_DECLARED_REST',
        classification: 'REST_REPO', requires_write: false };
    const canonical = row.apologistiko_biblio === true &&
        ((category === 'ΑΝ' && repo === true) ||
            (category === 'ΜΕ' && repo === false));
    if (canonical) return { date, status: 'CANONICAL', requires_write: false };
    if (isValidDeclaredNonWork(row)) return { date, status: 'VALID_DECLARED_NON_WORK',
        classification: 'NON_WORK', requires_write: false };
    // Book/participation flags alone never attest that rest was taken. Ordinary
    // worked rows and preserved human participation choices need no Stage-2 action.
    if (['ΑΝ', 'ΜΕ'].includes(category)) return review('REST_CLASSIFICATION_INCOMPLETE');
    return { date, status: 'NOT_APPLICABLE', requires_write: false };
}

module.exports = { resolveReviewRestState };
