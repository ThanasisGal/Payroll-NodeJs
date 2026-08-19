'use strict';

// Pure, read-only coordinator for the ordered HR review of one natural week.

const {
    dateKeyUtc,
    startOfWeekMondayUtc,
    endOfWeekSundayUtc
} = require('../../utils/date/mondaySundayWeek');
const {
    resolveEffectiveExpectedWeeklyRepo
} = require('./apasxoliseisWeeklyRepoTransferExpectedRepoResolverService');
const {
    sourceEligible,
    targetEligible
} = require('./apasxoliseisPossibleLeaveRepoAutoResolutionService');
const {
    isPossibleLeave
} = require('./apasxoliseisLeaveProvenanceService');
const {
    resolveDailyActualWorkFacts
} = require('./apasxoliseisDailyActualWorkFactsService');
const {
    MODE: EFFECTIVE_REPO_MODE,
    resolveEffectiveRepoState
} = require('./apasxoliseisEffectiveRepoStateService');
const {
    resolveFullTimeFromWorkTerms
} = require('./apasxoliseisReviewEmploymentProfileService');

const NEXT_STAGE = Object.freeze({
    LEAVE_CLASSIFICATION: 'LEAVE_CLASSIFICATION',
    REPO_RESOLUTION: 'REPO_RESOLUTION',
    REMAINING_POSSIBLE_LEAVE_REVIEW: 'REMAINING_POSSIBLE_LEAVE_REVIEW',
    FINAL_WEEKLY_CHECK: 'FINAL_WEEKLY_CHECK',
    BLOCKED: 'BLOCKED'
});

function uniqueDateKeys(values = []) {
    return [...new Set((Array.isArray(values) ? values : [])
        .map(dateKeyUtc).filter(Boolean))].sort();
}

function pairKey(sourceDate, targetDate) {
    return `${sourceDate}->${targetDate}`;
}

function deepFreeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
    return value;
}

function isCanonicalStage2NonWork(row = {}) {
    return row.apologistiko_biblio === true && row.repo_apologistika === false &&
        String(row.kathgoria_ergasias_apologistika || '').trim() === 'ΜΕ';
}

function resolveWeeklyHrWorkflow({
    weekRows = [],
    effectiveProfile = {},
    effectiveProfilesByDate = {},
    profile_changed_inside_week = false,
    leave_classification_completed = false,
    confirmed_leave_dates = [],
    confirmed_sickness_dates = [],
    confirmed_absence_dates = [],
    repo_resolution_completed = false,
    selected_repo_transfers = [],
    remaining_possible_leave_review_completed = false,
    expected_date_keys = null
} = {}) {
    const rows = Array.isArray(weekRows) ? [...weekRows] : [];
    const orderedRows = rows.slice().sort((left, right) =>
        String(dateKeyUtc(left?.hmeromhnia) || '').localeCompare(
            String(dateKeyUtc(right?.hmeromhnia) || '')));
    const dates = orderedRows.map((row) => dateKeyUtc(row?.hmeromhnia));
    const weekStart = dates[0] ? dateKeyUtc(startOfWeekMondayUtc(dates[0])) : null;
    const weekEnd = weekStart ? dateKeyUtc(endOfWeekSundayUtc(weekStart)) : null;
    const naturalWeekDates = weekStart
        ? Array.from({ length: 7 }, (_, index) => {
              const date = new Date(`${weekStart}T00:00:00.000Z`);
              date.setUTCDate(date.getUTCDate() + index);
              return date.toISOString().slice(0, 10);
          })
        : [];
    const expectedDates = Array.isArray(expected_date_keys)
        ? uniqueDateKeys(expected_date_keys) : naturalWeekDates;
    const blockingReasons = [];
    const warnings = [];

    if (orderedRows.length !== expectedDates.length || dates.some((date) => !date) ||
        new Set(dates).size !== expectedDates.length ||
        expectedDates.some((date) => !dates.includes(date))) {
        blockingReasons.push('INCOMPLETE_NATURAL_WEEK');
    }

    const profile = {
        ...(effectiveProfile && typeof effectiveProfile === 'object'
            ? effectiveProfile : {}),
        profile_changed_inside_week:
            profile_changed_inside_week === true ||
            effectiveProfile?.profile_changed_inside_week === true,
        ...(effectiveProfilesByDate && Object.keys(effectiveProfilesByDate).length > 0
            ? { date_effective_profiles_by_date: effectiveProfilesByDate }
            : {})
    };
    const expectedRepoResolution = resolveEffectiveExpectedWeeklyRepo({
        weekRows: orderedRows,
        effectiveProfile: profile
    });
    if (!expectedRepoResolution.ok) {
        if (expectedRepoResolution.reason === 'PROFILE_CHANGED_INSIDE_WEEK') {
            warnings.push(expectedRepoResolution.reason);
        } else {
            blockingReasons.push(expectedRepoResolution.reason);
        }
    }

    const confirmedLeaveDates = uniqueDateKeys(confirmed_leave_dates);
    const confirmedSicknessDates = uniqueDateKeys(confirmed_sickness_dates);
    const confirmedAbsenceDates = uniqueDateKeys(confirmed_absence_dates);
    const classifiedDateGroups = [
        confirmedLeaveDates,
        confirmedSicknessDates,
        confirmedAbsenceDates
    ];
    const classifiedDates = classifiedDateGroups.flat();
    const classifiedDateSet = new Set(classifiedDates);
    const possibleLeaveDays = orderedRows
        .filter((row) => isPossibleLeave(row))
        .map((row) => dateKeyUtc(row.hmeromhnia));
    const possibleLeaveSet = new Set(possibleLeaveDays);
    if (classifiedDateSet.size !== classifiedDates.length) {
        blockingReasons.push('POSSIBLE_LEAVE_CLASSIFICATION_CONFLICT');
    }
    if (classifiedDates.some((date) => !possibleLeaveSet.has(date))) {
        blockingReasons.push('CLASSIFIED_DATE_NOT_POSSIBLE_LEAVE');
    }
    const unclassifiedPossibleLeaveDays = possibleLeaveDays.filter(
        (date) => !classifiedDateSet.has(date)
    );
    const unclassifiedStage2Candidates = unclassifiedPossibleLeaveDays.map((date) => {
        const dailyProfile = effectiveProfilesByDate?.[date] || profile;
        const fullTimeForDate = resolveFullTimeFromWorkTerms(dailyProfile);
        return Object.freeze({ date,
            candidate_kind: fullTimeForDate === false
                ? 'POSSIBLE_LEAVE_RESIDUAL' : 'REST_REPO',
            label: fullTimeForDate === false
                ? 'Προς τελική εξέταση ως ΠΙΘΑΝΗ ΑΔΕΙΑ'
                : 'Προς εξέταση ως ΑΝΑΠΑΥΣΗ / ΡΕΠΟ' });
    });

    const actualFactsByDate = new Map();
    orderedRows.forEach((row) => {
        const date = dateKeyUtc(row.hmeromhnia);
        const facts = resolveDailyActualWorkFacts(row);
        actualFactsByDate.set(date, facts);
        blockingReasons.push(...(facts.reasons || []));
        warnings.push(...(facts.warnings || []));
        if ((facts.warnings || []).includes('INCOMPLETE_CARD_INTERVAL') &&
            facts.cardVerificationStatus !== 'HR_APPROVED_ORPHAN') {
            blockingReasons.push('UNRESOLVED_INCOMPLETE_CARD_EVIDENCE');
        }
    });

    const expectedRepoCount = expectedRepoResolution.effectiveExpectedWeeklyRepo;
    const fullTime = resolveFullTimeFromWorkTerms(profile);
    const expectedRepoCategory = fullTime === null ? null : (fullTime ? 'ΑΝ' : 'ΜΕ');
    const restingRepoDays = orderedRows.filter((row) => {
        const date = dateKeyUtc(row.hmeromhnia);
        if (classifiedDateSet.has(date)) return false;
        // Το canonical NON_WORK του Stage 2 είναι ρητά μη εργασία, όχι repo identity.
        if (isCanonicalStage2NonWork(row)) return false;
        const dailyProfile = effectiveProfilesByDate?.[date] || profile;
        const dailyFullTime = resolveFullTimeFromWorkTerms(dailyProfile);
        const dailyExpectedRepoCategory = dailyFullTime === null
            ? null
            : (dailyFullTime ? 'ΑΝ' : 'ΜΕ');
        const state = resolveEffectiveRepoState({
            row,
            mode: EFFECTIVE_REPO_MODE.CURRENT,
            expectedRepoCategory: dailyExpectedRepoCategory
        });
        if ((state.diagnostics || []).length > 0) {
            blockingReasons.push(...state.diagnostics);
            return false;
        }
        return state.effectiveRepo === true &&
            actualFactsByDate.get(date)?.countsAsActualWorkDay !== true;
    }).map((row) => dateKeyUtc(row.hmeromhnia));

    const workedDeclaredRepoDays = orderedRows.filter((row) => {
        const date = dateKeyUtc(row.hmeromhnia);
        const declaredRepo = row.repo === true ||
            ['ΑΝ', 'ΜΕ'].includes(String(row.kathgoria_ergasias || '').trim());
        return declaredRepo && actualFactsByDate.get(date)?.countsAsActualWorkDay === true;
    }).map((row) => dateKeyUtc(row.hmeromhnia));

    const sourceRows = orderedRows.filter(sourceEligible);
    const targetRows = leave_classification_completed === true
        ? orderedRows.filter((row) =>
              !classifiedDateSet.has(dateKeyUtc(row.hmeromhnia)) &&
              resolveFullTimeFromWorkTerms(
                  effectiveProfilesByDate?.[dateKeyUtc(row.hmeromhnia)] || profile
              ) !== false &&
              targetEligible(row))
        : [];
    // Δηλωμένο ρεπό με πραγματική εργασία είναι πιθανή πηγή μεταφοράς,
    // όχι πραγματοποιημένη ημέρα ανάπαυσης. Μόνο οι ημέρες χωρίς πραγματική
    // εργασία καλύπτουν το συμβατικό πλήθος ανάπαυσης.
    const knownRepoIdentityDays = [...new Set(restingRepoDays)].sort();
    const unresolvedRepoIdentityCountBefore = Number.isSafeInteger(expectedRepoCount)
        ? Math.max(expectedRepoCount - knownRepoIdentityDays.length, 0)
        : null;
    const actualWorkdayCount = [...actualFactsByDate.values()].filter(
        (facts) => facts.countsAsActualWorkDay === true
    ).length;
    const repoTransferAllowed = actualWorkdayCount !== 7;
    const repoTransferProhibitionReason = repoTransferAllowed
        ? null
        : 'SEVEN_ACTUAL_WORK_DAYS_REPO_TRANSFER_FORBIDDEN';
    const directRepoCandidates = [];
    const repoTransferCandidates = [];
    if (leave_classification_completed === true &&
        repoTransferAllowed && unresolvedRepoIdentityCountBefore > 0) {
        if (sourceRows.length === 0) {
            targetRows.forEach((target) => directRepoCandidates.push(Object.freeze({
                date: dateKeyUtc(target.hmeromhnia),
                reason: 'UNCLASSIFIED_POSSIBLE_LEAVE_CAN_FILL_REPO_REQUIREMENT'
            })));
        } else {
            sourceRows.forEach((source) => targetRows.forEach((target) => {
                const sourceDate = dateKeyUtc(source.hmeromhnia);
                const targetDate = dateKeyUtc(target.hmeromhnia);
                if (sourceDate !== targetDate &&
                    sourceDate.slice(0, 7) === targetDate.slice(0, 7)) {
                    repoTransferCandidates.push(Object.freeze({
                        source_date: sourceDate,
                        target_date: targetDate,
                        pair_key: pairKey(sourceDate, targetDate),
                        semantic_only: true,
                        apply_eligibility_not_evaluated: true
                    }));
                }
            }));
        }
    }

    const repoDeficitBefore = unresolvedRepoIdentityCountBefore;
    const candidateKeys = new Set(repoTransferCandidates.map((candidate) => candidate.pair_key));
    const selectedTransfers = (Array.isArray(selected_repo_transfers)
        ? selected_repo_transfers : []).map((transfer) => ({
        source_date: dateKeyUtc(transfer?.source_date),
        target_date: dateKeyUtc(transfer?.target_date)
    })).filter((transfer) => transfer.source_date && transfer.target_date);
    const selectedKeys = selectedTransfers.map((transfer) =>
        pairKey(transfer.source_date, transfer.target_date));
    if (repo_resolution_completed === true &&
        (selectedKeys.some((key) => !candidateKeys.has(key)) ||
            new Set(selectedTransfers.map((item) => item.source_date)).size !== selectedTransfers.length ||
            new Set(selectedTransfers.map((item) => item.target_date)).size !== selectedTransfers.length)) {
        blockingReasons.push('SELECTED_REPO_TRANSFER_NOT_CURRENTLY_VALID');
    }
    const validSelectedCount = repo_resolution_completed === true && blockingReasons.length === 0
        ? Math.min(selectedTransfers.length, repoDeficitBefore || 0)
        : 0;
    const uniqueDirectProposal = repo_resolution_completed !== true &&
        directRepoCandidates.length === 1 ? directRepoCandidates[0] : null;
    const uniqueTransferProposal = repo_resolution_completed !== true &&
        repoTransferCandidates.length === 1 ? repoTransferCandidates[0] : null;
    const proposedTargetDates = [
        uniqueDirectProposal?.date,
        uniqueTransferProposal?.target_date
    ].filter(Boolean);
    const uniquelyProposedCount = Math.min(
        new Set(proposedTargetDates).size,
        repoDeficitBefore || 0
    );
    const repoDeficitAfter = repoDeficitBefore === null ? null : Math.max(
        repoDeficitBefore - (repo_resolution_completed ? validSelectedCount : uniquelyProposedCount),
        0
    );
    const usedTargetDates = new Set(repo_resolution_completed === true
        ? selectedTransfers.map((transfer) => transfer.target_date)
        : proposedTargetDates);
    const knownRepoIdentityDaysAfterProposal = [...new Set([
        ...knownRepoIdentityDays,
        ...usedTargetDates
    ])].sort();
    const restingRepoDaysAfterProposal = [...new Set([
        ...restingRepoDays,
        ...usedTargetDates
    ])].sort();
    const remainingPossibleLeaveDays = possibleLeaveDays.filter((date) =>
        !classifiedDateSet.has(date) && !usedTargetDates.has(date));

    let nextRequiredHrStage = NEXT_STAGE.FINAL_WEEKLY_CHECK;
    if (blockingReasons.length > 0) {
        nextRequiredHrStage = NEXT_STAGE.BLOCKED;
    } else if (possibleLeaveDays.length > 0 && leave_classification_completed !== true) {
        nextRequiredHrStage = NEXT_STAGE.LEAVE_CLASSIFICATION;
    } else if (!repoTransferAllowed) {
        nextRequiredHrStage = NEXT_STAGE.FINAL_WEEKLY_CHECK;
    } else if (leave_classification_completed === true &&
        unclassifiedStage2Candidates.length > 0 && repo_resolution_completed !== true) {
        nextRequiredHrStage = NEXT_STAGE.REPO_RESOLUTION;
    } else if (repo_resolution_completed !== true && repoDeficitBefore > 0) {
        nextRequiredHrStage = NEXT_STAGE.REPO_RESOLUTION;
    } else if (repo_resolution_completed === true && repoDeficitAfter > 0) {
        nextRequiredHrStage = NEXT_STAGE.REPO_RESOLUTION;
    } else if (remainingPossibleLeaveDays.length > 0 &&
        remaining_possible_leave_review_completed !== true) {
        nextRequiredHrStage = NEXT_STAGE.REMAINING_POSSIBLE_LEAVE_REVIEW;
    }

    if (repoTransferCandidates.length > 1 || directRepoCandidates.length > 1) {
        warnings.push('MULTIPLE_EQUIVALENT_REPO_TRANSFER_CANDIDATES');
    }
    if (repoTransferProhibitionReason) warnings.push(repoTransferProhibitionReason);

    return deepFreeze({
        week_start: weekStart,
        week_end: weekEnd,
        contractual_workdays: expectedRepoResolution.effectiveWeeklyWorkdays,
        expected_repo_count: expectedRepoCount,
        current_repo_count: restingRepoDays.length,
        current_repo_days: restingRepoDays,
        resting_repo_days: restingRepoDays,
        resting_repo_count: restingRepoDays.length,
        resting_repo_days_after_proposal: restingRepoDaysAfterProposal,
        resting_repo_count_after_proposal: restingRepoDaysAfterProposal.length,
        worked_declared_repo_days: workedDeclaredRepoDays,
        worked_repo_identity_count: workedDeclaredRepoDays.length,
        known_repo_identity_days: knownRepoIdentityDays,
        known_repo_identity_count: knownRepoIdentityDays.length,
        known_repo_identity_days_after_proposal: knownRepoIdentityDaysAfterProposal,
        known_repo_identity_count_after_proposal: knownRepoIdentityDaysAfterProposal.length,
        possible_leave_days: possibleLeaveDays,
        confirmed_leave_days: confirmedLeaveDates,
        confirmed_sickness_days: confirmedSicknessDates,
        confirmed_absence_days: confirmedAbsenceDates,
        unclassified_possible_leave_days: unclassifiedPossibleLeaveDays,
        unclassified_stage2_candidates: unclassifiedStage2Candidates,
        remaining_possible_leave_days: remainingPossibleLeaveDays,
        direct_repo_candidates: directRepoCandidates,
        repo_transfer_candidates: repoTransferCandidates,
        repo_deficit_before_resolution: repoDeficitBefore,
        repo_deficit_after_proposed_resolution: repoDeficitAfter,
        unresolved_repo_count: repoDeficitAfter,
        unresolved_repo_identity_count_before_resolution:
            unresolvedRepoIdentityCountBefore,
        unresolved_repo_identity_count_after_proposed_resolution: repoDeficitAfter,
        repo_transfer_allowed: repoTransferAllowed,
        repo_transfer_prohibition_reason: repoTransferProhibitionReason,
        leave_classification_completed: leave_classification_completed === true,
        repo_resolution_completed: repo_resolution_completed === true,
        remaining_possible_leave_review_completed:
            remaining_possible_leave_review_completed === true,
        next_required_hr_stage: nextRequiredHrStage,
        blocking_reasons: [...new Set(blockingReasons)],
        warnings: [...new Set(warnings)]
    });
}

module.exports = { NEXT_STAGE, resolveWeeklyHrWorkflow };
