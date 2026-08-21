const {
    dateKeyUtc,
    addDaysUtc,
    startOfWeekMondayUtc,
    endOfWeekSundayUtc
} = require('../../utils/date/mondaySundayWeek');
const {
    resolveDailyActualWorkFacts
} = require('./apasxoliseisDailyActualWorkFactsService');
const {
    analyzeWeeklySixthSeventhDay
} = require('./apasxoliseisWeeklySixthSeventhDayPolicyService');
const {
    analyzeWeeklyRepoTransferForEmploymentContract
} = require('./apasxoliseisWeeklyRepoTransferSinglePairService');
const {
    resolveEffectiveExpectedWeeklyRepo
} = require('./apasxoliseisWeeklyRepoTransferExpectedRepoResolverService');
const {
    MODE: EFFECTIVE_REPO_MODE,
    resolveEffectiveRepoState
} = require('./apasxoliseisEffectiveRepoStateService');
const {
    isValidPersistedApprovedOrphanResolution
} = require('./apasxoliseisOrphanCardResolutionService');

const POLICY_VERSION = 'weekly-repo-deviation-preview:monday-sunday:v2';
const SOURCE_VERSION = 'raw-prodhlomena-oraria-daily-rows:v1';
const STATUS = Object.freeze({
    READY: 'READY',
    OPEN_WEEK_PENDING_COMPLETION: 'OPEN_WEEK_PENDING_COMPLETION',
    NEEDS_HR_DECISION: 'NEEDS_HR_DECISION'
});
const RESOLVED_REPO_TRANSFER_CANDIDATE_REASONS = new Set([
    'SEVEN_ACTUAL_WORK_DAYS_REPO_TRANSFER_FORBIDDEN',
    'TARGET_LOCKED',
    'TARGET_LEAVE_OR_SICKNESS',
    'TARGET_ALREADY_PROCESSED',
    'TARGET_CONFLICTING_REPO_STATE',
    'SOURCE_LOCKED',
    'SOURCE_LEAVE_OR_SICKNESS',
    'SOURCE_INVALID_CARD_EVIDENCE',
    'SOURCE_ALREADY_PROCESSED',
    'TARGET_ZERO_HOURS_WITH_INCOMPLETE_CARD_PAIR'
]);

function finiteZero(value) {
    const parsed = Number(String(value ?? 0).replace(',', '.'));
    return Number.isFinite(parsed) && Math.abs(parsed) < 0.000001;
}

function employeeKey(row = {}) {
    return `${String(row.ypokatasthma || '').trim()}|${String(row.kodikos || '').trim()}`;
}

function attachSixthDayPresentationToRows(rows = [], deviations = []) {
    const sixthDayByEmployeeAndDate = new Map();
    const seventhDayByEmployeeAndDate = new Map();
    for (const deviation of Array.isArray(deviations) ? deviations : []) {
        const deviationEmployeeKey = employeeKey(deviation);
        const sixthDayDate = dateKeyUtc(deviation?.sixth_day_date);
        const seventhDayDate = dateKeyUtc(deviation?.seventh_day_date);
        if (!deviationEmployeeKey) continue;
        if (sixthDayDate) {
            sixthDayByEmployeeAndDate.set(`${deviationEmployeeKey}|${sixthDayDate}`, {
                rate: deviation.sixth_day_premium_rate ?? null,
                status: deviation.sixth_seventh_day_status || ''
            });
        }
        if (
            seventhDayDate &&
            deviation.sixth_seventh_day_status === STATUS.READY &&
            deviation.requires_new_hr_decision !== true
        ) {
            seventhDayByEmployeeAndDate.set(
                `${deviationEmployeeKey}|${seventhDayDate}`,
                { severity: 'SERIOUS_VIOLATION' }
            );
        }
    }

    return (Array.isArray(rows) ? rows : []).map((row) => {
        const sixthDay = sixthDayByEmployeeAndDate.get(
            `${employeeKey(row)}|${dateKeyUtc(row?.hmeromhnia)}`
        );
        const seventhDay = seventhDayByEmployeeAndDate.get(
            `${employeeKey(row)}|${dateKeyUtc(row?.hmeromhnia)}`
        );

        return {
            ...row,
            is_sixth_day: Boolean(sixthDay),
            sixth_day_premium_rate: sixthDay?.rate ?? null,
            sixth_day_policy_status: sixthDay?.status || '',
            is_seventh_day: Boolean(seventhDay),
            seventh_day_severity: seventhDay?.severity || ''
        };
    });
}

function normalizeLegacyDeviation(row = {}) {
    const weekStart = dateKeyUtc(row.week_apo || row.weekStart);
    const weekEnd = dateKeyUtc(row.week_eos || row.weekEnd);
    const mondayStart = weekStart
        ? dateKeyUtc(startOfWeekMondayUtc(weekStart)) === weekStart
        : false;
    const sundayEnd = weekEnd
        ? dateKeyUtc(endOfWeekSundayUtc(weekEnd)) === weekEnd
        : false;
    const isCurrentPolicy =
        row.policyVersion === POLICY_VERSION && mondayStart && sundayEnd;

    return {
        ...row,
        weekStart,
        weekEnd,
        policyVersion: row.policyVersion || null,
        sourceVersion: row.sourceVersion || null,
        is_legacy_policy: !isCurrentPolicy,
        legacy_label: !isCurrentPolicy ? 'Ιστορική εγγραφή παλιάς πολιτικής' : ''
    };
}

function buildWeeklyRepoDeviationPreview({
    rows = [],
    periodStart,
    periodEnd,
    asOfDate,
    resolveWeeklyProfile,
    resolveEmploymentPeriod,
    resolveDailyProfile,
    resolveCanonicalAnalysis,
    isFullTimeProfile,
    holidayByDateKey = new Map(),
    existingAuditCountByRowKey = new Map()
} = {}) {
    const requestedStart = dateKeyUtc(periodStart);
    const requestedEnd = dateKeyUtc(periodEnd);
    const asOfKey = dateKeyUtc(asOfDate);
    if (!requestedStart || !requestedEnd || !asOfKey) {
        return {
            policyVersion: POLICY_VERSION,
            sourceVersion: SOURCE_VERSION,
            status: STATUS.NEEDS_HR_DECISION,
            reasons: ['INVALID_PREVIEW_DATE_CONTEXT'],
            deviations: [],
            pendingWeeks: []
        };
    }

    const rowsByEmployeeWeek = new Map();
    for (const row of rows) {
        const rowDate = dateKeyUtc(row?.hmeromhnia);
        if (!rowDate) continue;
        const weekStart = dateKeyUtc(startOfWeekMondayUtc(rowDate));
        const key = `${employeeKey(row)}|${weekStart}`;
        if (!rowsByEmployeeWeek.has(key)) rowsByEmployeeWeek.set(key, []);
        rowsByEmployeeWeek.get(key).push(row);
    }

    const deviations = [];
    const pendingWeeks = [];
    for (const [key, weekRows] of rowsByEmployeeWeek.entries()) {
        const orderedRows = [...weekRows].sort((a, b) =>
            dateKeyUtc(a.hmeromhnia).localeCompare(dateKeyUtc(b.hmeromhnia))
        );
        const rowByDate = new Map();
        orderedRows.forEach((row) => {
            const key = dateKeyUtc(row.hmeromhnia);
            if (key && !rowByDate.has(key)) rowByDate.set(key, row);
        });
        const uniqueRows = [...rowByDate.values()];
        const first = uniqueRows[0];
        const weekStart = dateKeyUtc(startOfWeekMondayUtc(first.hmeromhnia));
        const weekEnd = dateKeyUtc(endOfWeekSundayUtc(first.hmeromhnia));
        if (weekEnd < requestedStart || weekStart > requestedEnd) continue;

        const base = {
            ypokatasthma: first.ypokatasthma || '',
            kodikos: first.kodikos || '',
            week_apo: weekStart,
            week_eos: weekEnd,
            weekStart,
            weekEnd,
            policyVersion: POLICY_VERSION,
            sourceVersion: SOURCE_VERSION,
            week_definition: 'MONDAY_SUNDAY',
            is_legacy_policy: false
        };

        const employmentPeriod =
            typeof resolveEmploymentPeriod === 'function'
                ? resolveEmploymentPeriod({
                      ypokatasthma: first.ypokatasthma,
                      kodikos: first.kodikos,
                      weekStart,
                      weekEnd
                  }) || {}
                : {};
        const employmentStart = dateKeyUtc(employmentPeriod.employmentStart);
        const employmentEnd = dateKeyUtc(employmentPeriod.employmentEnd);
        if (
            (employmentStart && weekStart < employmentStart) ||
            (employmentEnd && weekEnd > employmentEnd)
        ) {
            // Η πολιτική εβδομαδιαίων ρεπό/6ης/7ης ημέρας δεν εφαρμόζεται
            // σε εβδομάδα που τέμνεται από πρόσληψη ή αποχώρηση.
            continue;
        }

        if (weekEnd > asOfKey) {
            pendingWeeks.push({
                ...base,
                status: STATUS.OPEN_WEEK_PENDING_COMPLETION,
                complete: false,
                is_deviation: false,
                reasons: []
            });
            continue;
        }

        if (uniqueRows.length !== 7) {
            deviations.push({
                ...base,
                status: STATUS.NEEDS_HR_DECISION,
                complete: false,
                is_deviation: false,
                reasons: ['INCOMPLETE_COMPLETED_WEEK_DATA']
            });
            continue;
        }

        const weeklyProfile =
            typeof resolveWeeklyProfile === 'function'
                ? resolveWeeklyProfile({
                      ypokatasthma: first.ypokatasthma,
                      kodikos: first.kodikos,
                      weekStart,
                      weekEnd,
                      weekRows: uniqueRows
                  }) || {}
                : {};
        const effectiveProfile = weeklyProfile.effectiveProfile || {};
        const expectedRepoResolution = resolveEffectiveExpectedWeeklyRepo({
            weekRows: uniqueRows,
            effectiveProfile
        });
        const expectedRepo = expectedRepoResolution.effectiveExpectedWeeklyRepo;
        const reportedProfileReason =
            weeklyProfile.repoResolutionReason || expectedRepoResolution.reason || null;
        const profileReason = reportedProfileReason === 'PROFILE_CHANGED_INSIDE_WEEK' &&
            expectedRepoResolution.ok
            ? null
            : reportedProfileReason;
        const effectiveRepoStates = uniqueRows.map((row) => {
            const dailyProfile =
                typeof resolveDailyProfile === 'function'
                    ? resolveDailyProfile(row) || {}
                    : {};
            const expectedRepoCategory =
                typeof isFullTimeProfile === 'function'
                    ? isFullTimeProfile(dailyProfile) === true
                        ? 'ΑΝ'
                        : 'ΜΕ'
                    : null;
            const state = resolveEffectiveRepoState({
                row,
                mode: EFFECTIVE_REPO_MODE.CURRENT,
                expectedRepoCategory
            });
            const effectiveHours =
                state.provenance === 'APOLOGISTIKA_CURRENT'
                    ? row.ores_ergasias_apologistika
                    : row.ores_ergasias;

            return {
                state,
                countsAsRepo:
                    state.effectiveRepo === true &&
                    finiteZero(effectiveHours) &&
                    finiteZero(row.cards_ores_ergasias)
            };
        });
        const repoStateReasons = [...new Set(
            effectiveRepoStates.flatMap(({ state }) => state.diagnostics || [])
        )];
        const actualRepo = effectiveRepoStates.filter(({ countsAsRepo }) => countsAsRepo).length;

        const hasResolvedExpectedRepo =
            expectedRepo !== null &&
            expectedRepo !== undefined &&
            Number.isFinite(Number(expectedRepo));
        if (
            !hasResolvedExpectedRepo ||
            Number(actualRepo) !== Number(expectedRepo) ||
            repoStateReasons.length > 0
        ) {
            const isCalculatedWorkHoursAuthoritativeForRow = (row) =>
                isValidPersistedApprovedOrphanResolution(row) &&
                Number(row.ores_ergasias_apologistika) > 0;
            const dailyFacts = uniqueRows.map((row) => resolveDailyActualWorkFacts(row, {
                isCalculatedWorkHoursAuthoritativeForRow
            }));
            const sixthSeventhDay = analyzeWeeklySixthSeventhDay({
                weekRows: uniqueRows,
                effectiveProfile,
                isCalculatedWorkHoursAuthoritativeForRow
            });
            const canonicalResolution =
                typeof resolveCanonicalAnalysis === 'function'
                    ? resolveCanonicalAnalysis({
                          base,
                          weekRows: uniqueRows,
                          weeklyProfile,
                          effectiveProfile,
                          automaticAnalysis: sixthSeventhDay
                      }) || null
                    : null;
            const resolvedSixthSeventhDay =
                canonicalResolution?.analysis || sixthSeventhDay;
            const repoTransfer = analyzeWeeklyRepoTransferForEmploymentContract({
                weekRows: uniqueRows,
                employmentProfile: effectiveProfile,
                holidayByDateKey,
                existingAuditCountByRowKey,
                isCalculatedWorkHoursAuthoritativeForRow
            });
            const resolution = repoTransfer.weekly_resolution;
            const projectedSixthSeventhDay = resolution?.sixth_seventh_day;
            const authoritativeSixthSeventhDay =
                canonicalResolution && canonicalResolution.applicability !== 'NOT_FOUND'
                    ? resolvedSixthSeventhDay
                    : projectedSixthSeventhDay?.status
                ? {
                      ...resolvedSixthSeventhDay,
                      status: projectedSixthSeventhDay.status,
                      reasons: [...(projectedSixthSeventhDay.reasons || [])],
                      warnings: [...(projectedSixthSeventhDay.warnings || [])],
                      sixthDay: projectedSixthSeventhDay.sixth_day || null,
                      seventhDay: projectedSixthSeventhDay.seventh_day || null
                  }
                : resolvedSixthSeventhDay;
            const resolvedCanonicalRepoIdentities =
                canonicalResolution?.applicability === 'APPLICABLE' &&
                Array.isArray(authoritativeSixthSeventhDay.canonicalRepoDayIdentities)
                    ? authoritativeSixthSeventhDay.canonicalRepoDayIdentities
                    : [];
            const projectedActualRepo = resolvedCanonicalRepoIdentities.length > 0
                ? resolvedCanonicalRepoIdentities.length
                : actualRepo;
            const actualWorkdays = dailyFacts.filter(
                (facts) => facts.countsAsActualWorkDay
            ).length;
            const sixthSeventhDayNeedsDecision =
                authoritativeSixthSeventhDay.status === 'NEEDS_HR_DECISION';
            const requiresNewHrDecision =
                canonicalResolution?.applicability !== 'APPLICABLE' &&
                sixthSeventhDayNeedsDecision;
            const suppressResolvedCandidateReason =
                authoritativeSixthSeventhDay.status === STATUS.READY &&
                requiresNewHrDecision === false;
            const presentationReasons = [...new Set([
                ...(authoritativeSixthSeventhDay.reasons || []),
                ...(repoTransfer.reasons || []).filter((reason) =>
                    !(suppressResolvedCandidateReason &&
                        RESOLVED_REPO_TRANSFER_CANDIDATE_REASONS.has(reason)))
            ])].filter((reason) =>
                !(
                    canonicalResolution?.applicability === 'APPLICABLE' &&
                    reason === 'CANONICAL_REPO_IDENTITIES_NOT_DETERMINISTIC'
                )
            );
            const repoTransferBlockedTargetCandidates = (
                repoTransfer.semantic_proposal?.blocked_target_candidates ||
                repoTransfer.presentation_context?.blocked_target_candidates || []
            ).map((candidate) => {
                const candidateId = String(candidate.prodhlomena_oraria_id || '').trim();
                const candidateDate = dateKeyUtc(candidate.hmeromhnia);
                const row = uniqueRows.find((item) =>
                    (candidateId && String(item._id || item.id || '').trim() === candidateId) ||
                    dateKeyUtc(item.hmeromhnia) === candidateDate
                ) || {};
                return {
                    ...candidate,
                    apologistika_category: row.kathgoria_ergasias_apologistika || '',
                    repo_apologistika: row.repo_apologistika === true
                };
            });
            deviations.push({
                ...base,
                status:
                    profileReason || sixthSeventhDayNeedsDecision || repoStateReasons.length > 0
                        ? STATUS.NEEDS_HR_DECISION
                        : STATUS.READY,
                complete: true,
                is_deviation: true,
                reasons: [...new Set([
                    ...(profileReason ? [profileReason] : []),
                    ...(sixthSeventhDayNeedsDecision
                        ? authoritativeSixthSeventhDay.reasons || []
                        : []),
                    ...repoStateReasons
                ])],
                expected_repo: expectedRepo,
                actual_repo: projectedActualRepo,
                missing_repo:
                    Math.max(Number(expectedRepo || 0) - Number(projectedActualRepo), 0),
                resolved_repo: resolvedCanonicalRepoIdentities.length > 0
                    ? resolvedCanonicalRepoIdentities.length
                    : resolution?.resolved_repo ?? actualRepo,
                resolved_repo_identities: [...resolvedCanonicalRepoIdentities],
                requires_new_hr_decision: requiresNewHrDecision,
                // Η ταξινόμηση 6ης/7ης ημέρας είναι ανεξάρτητη από το αν
                // υπάρχει ασφαλές ζεύγος μεταφοράς ρεπό. Το αποτέλεσμα της
                // μεταφοράς δεν επιτρέπεται να μηδενίζει την άμεση πολιτική.
                actual_workdays: actualWorkdays,
                sixth_day_count: authoritativeSixthSeventhDay.sixthDay ? 1 : 0,
                seventh_day_count: authoritativeSixthSeventhDay.seventhDay ? 1 : 0,
                sixth_day_date: authoritativeSixthSeventhDay.sixthDay?.hmeromhnia || null,
                sixth_day_premium_rate:
                    authoritativeSixthSeventhDay.sixthDay?.premiumRate ?? null,
                seventh_day_date: authoritativeSixthSeventhDay.seventhDay?.hmeromhnia || null,
                sixth_seventh_day_status: authoritativeSixthSeventhDay.status,
                sixth_seventh_day_reasons: [...(authoritativeSixthSeventhDay.reasons || [])],
                presentation_reasons: presentationReasons,
                canonical_decision_applicability:
                    canonicalResolution?.applicability || 'NOT_FOUND',
                canonical_decision_request_id:
                    canonicalResolution?.decision?.request_id || null,
                repo_transfer_status: repoTransfer.eligibility_status,
                repo_transfer_reasons: [...(repoTransfer.reasons || [])],
                repo_transfer_blocked_target_candidates:
                    repoTransferBlockedTargetCandidates,
                repo_transfer_source_available:
                    !repoTransfer.reasons.includes('NO_SOURCE_CANDIDATE'),
                repo_transfer_target_available:
                    !repoTransfer.reasons.includes('NO_TARGET_CANDIDATE'),
                profile_changed_inside_week:
                    profileReason === 'PROFILE_CHANGED_INSIDE_WEEK',
                deviation_type:
                    profileReason === 'PROFILE_CHANGED_INSIDE_WEEK'
                        ? 'PROFILE_CHANGED_INSIDE_WEEK'
                        : 'WEEKLY_REPO_MISMATCH',
                effective_expected_repo: expectedRepo,
                effective_weekly_workdays:
                    expectedRepoResolution.effectiveWeeklyWorkdays,
                expected_repo_source:
                    expectedRepoResolution.repoResolutionSource,
                effective_typos_apasxolhshs:
                    weeklyProfile.effectiveProfile?.typos_apasxolhshs || '',
                effective_profile_source:
                    weeklyProfile.effectiveProfile?.employment_profile_source ||
                    weeklyProfile.effectiveProfile?.source ||
                    '',
                effective_profile_date: weeklyProfile.effectiveProfileDate || null
            });
        }
    }

    return {
        policyVersion: POLICY_VERSION,
        sourceVersion: SOURCE_VERSION,
        status: STATUS.READY,
        reasons: [],
        deviations,
        pendingWeeks
    };
}

function resolveWeeklyRepoPreviewAsOfDate({
    sessionAppDate,
    periodEnd,
    periodControl = null
} = {}) {
    if (periodControl?.historical_reconstruction_status !== 'COMPLETED') {
        return sessionAppDate;
    }

    const completedAt = dateKeyUtc(periodControl.historical_reconstruction_completed_at);
    const finalContextSunday = dateKeyUtc(endOfWeekSundayUtc(periodEnd));
    if (!finalContextSunday) return completedAt || sessionAppDate;

    // COMPLETED means that the cross-month natural-week dependencies were already
    // available to the historical reconstruction. Never move its deterministic
    // evaluation boundary before that final Sunday.
    return completedAt && completedAt > finalContextSunday
        ? completedAt
        : finalContextSunday;
}

module.exports = {
    POLICY_VERSION,
    SOURCE_VERSION,
    STATUS,
    normalizeLegacyDeviation,
    attachSixthDayPresentationToRows,
    buildWeeklyRepoDeviationPreview,
    resolveWeeklyRepoPreviewAsOfDate
};
