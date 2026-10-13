'use strict';

const { dateKeyUtc } = require('../../utils/date/mondaySundayWeek');
const { resolveWeeklyHrWorkflow } = require('./apasxoliseisWeeklyHrWorkflowResolverService');
const { resolveNoWorkDaySemanticForDate } = require('./apasxoliseisReviewEmploymentProfileService');
const { resolveDailyActualWorkFacts } = require('./apasxoliseisDailyActualWorkFactsService');
const { isPossibleLeave } = require('./apasxoliseisLeaveProvenanceService');
const { positiveClassification } = require('./apasxoliseisStage3FingerprintService');

// Shared by lifecycle, preview and transactional human-decision validation.
// Uniqueness and a numeric deficit never attest that a particular date was rest.
function assessWeeklyRestEvidence({ rows = [], effectiveProfile = {},
    effectiveProfilesByDate = {}, expectedDateKeys = null, actionableDates = null,
    companySettings = {}, workflow = null } = {}) {
    const weekly = workflow || resolveWeeklyHrWorkflow({ weekRows: rows,
        effectiveProfile, effectiveProfilesByDate, expected_date_keys: expectedDateKeys,
        actionable_date_keys: actionableDates, companySettings,
        leave_classification_completed: true });
    const candidates = rows.filter(row => {
        const date = dateKeyUtc(row.hmeromhnia);
        const facts = resolveDailyActualWorkFacts(row, { companySettings });
        return (!actionableDates || actionableDates.includes(date)) && isPossibleLeave(row) &&
            !positiveClassification(row) && row.repo_apologistika !== true &&
            row.is_locked !== true && row.manual_override !== true &&
            resolveNoWorkDaySemanticForDate({ date, effectiveProfile,
                effectiveProfilesByDate }).classification === 'REST_REPO' &&
            facts.countsAsActualWorkDay !== true && Number(facts.cardHours || 0) === 0 &&
            !(facts.completeCardPairNumbers || []).length &&
            !(facts.unresolvedCardPairNumbers || []).length && !(facts.reasons || []).length;
    }).map(row => dateKeyUtc(row.hmeromhnia)).sort();
    const missing = weekly.repo_deficit_before_resolution;
    const eligible = Number.isInteger(missing) && missing > 0 &&
        !(weekly.blocking_reasons || []).length && weekly.repo_transfer_allowed === true;
    return { required_count: weekly.expected_repo_count,
        recognized_dates: [...(weekly.resting_repo_days || [])],
        recognized_count: weekly.resting_repo_count,
        missing_count: missing, candidate_dates: candidates,
        confirmable_dates: eligible ? candidates : [],
        reason: missing === null ? 'WEEKLY_REST_TERMS_REVIEW_REQUIRED'
            : missing === 0 ? 'WEEKLY_REST_ALREADY_SATISFIED'
            : candidates.length > missing && eligible ? 'AMBIGUOUS_WEEKLY_REST_DATES'
                : 'UNCONFIRMED_WEEKLY_REST_DATES' };
}

module.exports = { assessWeeklyRestEvidence };
