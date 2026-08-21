'use strict';

// Pure presentation projection. It coordinates existing authoritative resolvers and never writes.

const { dateKeyUtc } = require('../../utils/date/mondaySundayWeek');
const { isPossibleLeave } = require('./apasxoliseisLeaveProvenanceService');
const {
    deriveStoredStage1Decisions,
    resolverRowsFromStoredDecisions
} = require('./apasxoliseisWeeklyHrWorkflowProjectionService');
const {
    buildStage1Fingerprint,
    resolveStage1Status
} = require('./apasxoliseisStage1FingerprintService');
const {
    NEXT_STAGE,
    resolveWeeklyHrWorkflow
} = require('./apasxoliseisWeeklyHrWorkflowResolverService');
const {
    analyzeWeeklyRepoTransferForEmploymentContract
} = require('./apasxoliseisWeeklyRepoTransferSinglePairService');
const {
    analyzeWeeklySixthSeventhDay
} = require('./apasxoliseisWeeklySixthSeventhDayPolicyService');
const { resolveDailyActualWorkFacts } = require('./apasxoliseisDailyActualWorkFactsService');
const {
    isValidPersistedApprovedOrphanResolution
} = require('./apasxoliseisOrphanCardResolutionService');
const { normalizeEmploymentType } = require('./apasxoliseisReviewEmploymentProfileService');
const { buildStage2ResolutionFingerprint,
    buildStage3InputFingerprint } = require('./apasxoliseisStage3FingerprintService');
const { deriveStage1PeriodSlice, buildStage1PeriodSliceFingerprints,
    findStage1PeriodSlice, resolveStage1PeriodSliceStatus } = require(
    './apasxoliseisStage1PeriodSliceService'
);

const BUSINESS_STATUS = Object.freeze({
    COMPLETED: 'COMPLETED',
    OPEN: 'OPEN',
    BLOCKED: 'BLOCKED',
    STALE: 'STALE'
});
const PRESENTATION_STATUS = Object.freeze({
    COMPLETED: 'COMPLETED',
    ACTIVE: 'ACTIVE',
    OPEN: 'OPEN',
    BLOCKED: 'BLOCKED',
    STALE: 'STALE',
    LOCKED: 'LOCKED'
});

function unique(values = []) {
    return [...new Set(values.filter(Boolean))];
}

function possibleLeaveDates(rows = []) {
    return unique(rows.filter(isPossibleLeave)
        .map((row) => dateKeyUtc(row?.hmeromhnia))).sort();
}

function stageResult(stage, values = {}) {
    return Object.freeze({ stage, business_status: BUSINESS_STATUS.COMPLETED,
        presentation_status: PRESENTATION_STATUS.COMPLETED, pending_count: 0,
        pending_dates: Object.freeze([]), pending_reasons: Object.freeze([]),
        blockers: Object.freeze([]), ...values });
}

function resolveStage3ActionableDates({
    rawRemainingDates = [],
    stage2ResolvedDates = [],
    canonicallyResolvedDates = []
} = {}) {
    const raw = unique(rawRemainingDates).sort();
    const resolved = new Set(unique([
        ...stage2ResolvedDates,
        ...canonicallyResolvedDates
    ]));
    return Object.freeze({ raw: Object.freeze(raw),
        resolved_before_stage3: Object.freeze(raw.filter((date) => resolved.has(date))),
        actionable: Object.freeze(raw.filter((date) => !resolved.has(date))) });
}

const ACTIONABLE_REPO_TRANSFER_SELECTION_REASONS = new Set([
    'MULTIPLE_SOURCE_CANDIDATES',
    'MULTIPLE_TARGET_CANDIDATES'
]);

function resolveStage2Actionability(repoTransfer = {}) {
    const reasons = unique(repoTransfer.reasons || []);
    const hasTransferablePair = repoTransfer.eligibility_status === 'ELIGIBLE' &&
        Boolean(repoTransfer.source?.hmeromhnia) && Boolean(repoTransfer.target?.hmeromhnia) &&
        Boolean(repoTransfer.semantic_proposal);
    const hasBoundedSelection = reasons.some((reason) =>
        ACTIONABLE_REPO_TRANSFER_SELECTION_REASONS.has(reason));
    return Object.freeze({ actionable: hasTransferablePair || hasBoundedSelection,
        has_transferable_pair: hasTransferablePair,
        has_bounded_selection: hasBoundedSelection,
        reasons: Object.freeze(reasons) });
}

function resolveSafeNonFullNonWorkDates({
    rows = [], candidateDates = [], effectiveProfile = {}, effectiveProfilesByDate = {}
} = {}) {
    return unique(candidateDates).filter((date) => {
        const row = rows.find((candidate) => dateKeyUtc(candidate?.hmeromhnia) === date);
        const dailyProfile = effectiveProfilesByDate?.[date] || effectiveProfile;
        const employmentType = normalizeEmploymentType(
            dailyProfile?.kathestos_apasxolhshs ?? dailyProfile?.typos_apasxolhshs
        );
        const facts = resolveDailyActualWorkFacts(row || {});
        return ['1', '2'].includes(employmentType) &&
            facts.countsAsActualWorkDay !== true && Number(facts.cardHours || 0) === 0 &&
            !(facts.completeCardPairNumbers || []).length &&
            !(facts.unresolvedCardPairNumbers || []).length &&
            !(facts.reasons || []).length;
    });
}

function buildStage1NoClassificationPreviewItems({
    rows = [], possibleDates = [], effectiveProfile = {}, effectiveProfilesByDate = {},
    repoTransfer = {}, stage2Actionability = {}, stage2ResolvedDates = []
} = {}) {
    const nonFullDates = new Set(resolveSafeNonFullNonWorkDates({ rows,
        candidateDates: possibleDates, effectiveProfile, effectiveProfilesByDate }));
    const resolvedRepoDates = new Set(stage2ResolvedDates);
    const sourceDate = dateKeyUtc(repoTransfer.source?.hmeromhnia);
    const targetDate = dateKeyUtc(repoTransfer.target?.hmeromhnia);
    const hasSafePair = stage2Actionability.has_transferable_pair === true;
    const reasons = unique(repoTransfer.reasons || []);

    return Object.freeze(unique(possibleDates).sort().map((date) => {
        if (nonFullDates.has(date)) return Object.freeze({ date, safe: true,
            classification: 'NON_WORK', source_date: null, reasons: Object.freeze([]) });
        if (resolvedRepoDates.has(date) || (hasSafePair && targetDate === date)) {
            return Object.freeze({ date, safe: true, classification: 'REST_REPO',
                source_date: sourceDate || null, reasons: Object.freeze([]) });
        }
        return Object.freeze({ date, safe: false, classification: null, source_date: null,
            requires_further_review: reasons.length > 0 ||
                stage2Actionability.has_bounded_selection === true,
            reasons: Object.freeze(reasons) });
    }));
}

function applySequentialPresentation(stages) {
    const ordered = ['stage1', 'stage2', 'stage3', 'stage4'];
    const firstUnresolvedIndex = ordered.findIndex((key) =>
        stages[key].business_status !== BUSINESS_STATUS.COMPLETED);
    return Object.fromEntries(ordered.map((key, index) => {
        const stage = stages[key];
        let presentationStatus = PRESENTATION_STATUS.COMPLETED;
        if (firstUnresolvedIndex >= 0) {
            if (index > firstUnresolvedIndex) presentationStatus = PRESENTATION_STATUS.LOCKED;
            else if (index === firstUnresolvedIndex) {
                presentationStatus = stage.business_status === BUSINESS_STATUS.BLOCKED
                    ? PRESENTATION_STATUS.BLOCKED
                    : stage.business_status === BUSINESS_STATUS.STALE
                        ? PRESENTATION_STATUS.STALE
                        : PRESENTATION_STATUS.ACTIVE;
            }
        }
        return [key, Object.freeze({ ...stage, presentation_status: presentationStatus,
            enabled: presentationStatus !== PRESENTATION_STATUS.LOCKED,
            open_by_default: index === firstUnresolvedIndex })];
    }));
}

function isSingleDayEmploymentWithoutReviewableActivity(rows = [], employmentDateScope = null) {
    if (employmentDateScope?.employment_owned_dates?.length !== 1 || rows.length !== 1) return false;
    const row = rows[0];
    const facts = resolveDailyActualWorkFacts(row);
    const hasPositiveClassification = row.adeia_apologistika === true ||
        row.astheneia_apologistika === true || row.apousia_apologistika === true ||
        ['ΑΝ', 'ΜΕ'].includes(String(row.kathgoria_ergasias_apologistika || '').trim()) ||
        (String(row.kathgoria_adeias_apologistika || '').trim() &&
            String(row.kathgoria_adeias_apologistika || '').trim() !== 'POSSIBLE_LEAVE');
    return facts.countsAsActualWorkDay !== true && Number(facts.cardHours || 0) === 0 &&
        !(facts.completeCardPairNumbers || []).length &&
        !(facts.unresolvedCardPairNumbers || []).length &&
        !(facts.reasons || []).length && !hasPositiveClassification;
}

function buildWeeklyHrLifecycleProjection({
    weekRows = [],
    effectiveProfile = {},
    effectiveProfilesByDate = {},
    persistedStage1State = null,
    persistedStage3State = null,
    scope = {},
    periodScope = null,
    employmentDateScope = null,
    companyPolicyRules = []
} = {}) {
    const rows = Array.isArray(weekRows) ? weekRows : [];
    const fingerprint = buildStage1Fingerprint(rows).fingerprint;
    const periodSlice = periodScope ? deriveStage1PeriodSlice({ weekRows: rows,
        week_start: scope.week_start, week_end: scope.week_end,
        period_start: periodScope.period_start, period_end: periodScope.period_end,
        employment_date_scope: employmentDateScope }) : null;
    const sliceFingerprints = periodSlice
        ? buildStage1PeriodSliceFingerprints({ weekRows: rows, slice: periodSlice }) : null;
    const persistedSlice = periodSlice ? findStage1PeriodSlice(persistedStage1State,
        periodSlice.period_start, periodSlice.period_end) : null;
    const persistedStatus = periodSlice ? resolveStage1PeriodSliceStatus({
        current_context_fingerprint: sliceFingerprints.context_fingerprint,
        current_completion_fingerprint: sliceFingerprints.completion_fingerprint,
        persisted_slice: persistedSlice
    }) : resolveStage1Status({ current_fingerprint: fingerprint,
        persisted_stage1_state: persistedStage1State });
    const persistenceState = persistedStage1State ? 'PRESENT' : 'NO_STATE';
    if (isSingleDayEmploymentWithoutReviewableActivity(rows, employmentDateScope)) {
        const stages = Object.freeze(Object.fromEntries(['stage1', 'stage2', 'stage3', 'stage4']
            .map((key, index) => [key, stageResult(`STAGE${index + 1}`)])));
        return Object.freeze({ projection_version: 'weekly-hr-derived-lifecycle:v1',
            read_only: true, persisted_stage1_status: BUSINESS_STATUS.COMPLETED,
            stage1_persistence_state: persistenceState, current_stage: null,
            total_pending_count: 0, requires_hr_action: false,
            employment_date_scope: employmentDateScope,
            stage1_no_classification_preview_items: Object.freeze([]), stages });
    }
    const decisions = deriveStoredStage1Decisions(rows);
    const actionableDateSet = periodSlice ? new Set(periodSlice.actionable_dates)
        : Array.isArray(employmentDateScope?.authoritative_date_set)
            ? new Set(employmentDateScope.authoritative_date_set) : null;
    const expectedDateKeys = employmentDateScope?.employment_owned_dates || null;
    const fullNaturalWeek = employmentDateScope?.is_full_natural_week !== false;
    const weekEndKey = dateKeyUtc(scope.week_end || rows.at(-1)?.hmeromhnia);
    const periodEndKey = dateKeyUtc(periodScope?.period_end);
    const trailingPartialWeek = Boolean(periodSlice && weekEndKey && periodEndKey &&
        weekEndKey > periodEndKey);
    const trailingPartialWeekPresentation = trailingPartialWeek ? Object.freeze({
        active: true,
        title: 'ΜΕΡΙΚΗ ΕΒΔΟΜΑΔΑ ΠΕΡΙΟΔΟΥ',
        message: `Για την τρέχουσα περίοδο εξετάζονται μόνο οι ημέρες ${periodSlice.actionable_dates
            .map((item) => item.split('-').reverse().join('/')).join('–')}. ` +
            'Ο πλήρης εβδομαδιαίος έλεγχος θα ολοκληρωθεί στην επόμενη περίοδο.',
        actionable_dates: Object.freeze([...periodSlice.actionable_dates]),
        deferred_weekly_checks: Object.freeze([
            'Μεταφορά ρεπό', 'Τελικός εβδομαδιαίος έλεγχος', '6η ημέρα', '7η ημέρα',
            'Λοιπές εβδομαδιαίες παραβάσεις'
        ])
    }) : null;
    const stage1Workflow = resolveWeeklyHrWorkflow({
        weekRows: rows,
        effectiveProfile,
        effectiveProfilesByDate,
        leave_classification_completed: false,
        expected_date_keys: expectedDateKeys
    });
    const stage1PendingDates = possibleLeaveDates(rows)
        .filter((date) => !actionableDateSet || actionableDateSet.has(date));
    const stage1Blockers = unique(stage1Workflow.blocking_reasons || []);
    const stage1BusinessStatus = persistedStatus === BUSINESS_STATUS.STALE
        ? BUSINESS_STATUS.STALE
        : stage1Blockers.length
            ? BUSINESS_STATUS.BLOCKED
            : persistedStatus === BUSINESS_STATUS.COMPLETED
                ? BUSINESS_STATUS.COMPLETED
            : stage1PendingDates.length
                ? BUSINESS_STATUS.OPEN
                : BUSINESS_STATUS.COMPLETED;
    const activeStage1PendingDates = [BUSINESS_STATUS.OPEN, BUSINESS_STATUS.BLOCKED]
        .includes(stage1BusinessStatus)
        ? stage1PendingDates : [];
    const stage1 = stageResult('STAGE1', {
        business_status: stage1BusinessStatus,
        persisted_status: persistedStatus,
        persistence_state: persistenceState,
        current_fingerprint: fingerprint,
        current_context_fingerprint: periodSlice ? sliceFingerprints.context_fingerprint : fingerprint,
        current_completion_fingerprint: periodSlice
            ? sliceFingerprints.completion_fingerprint : fingerprint,
        attestation_scope: periodSlice ? 'PERIOD_SLICE' : 'WEEKLY',
        period_slice: periodSlice ? Object.freeze({ ...periodSlice,
            persisted_status: persistedSlice?.status || 'OPEN',
            completion_fingerprint: persistedSlice?.completion_fingerprint || '',
            effective_fingerprint: persistedSlice?.effective_fingerprint || '',
            version: Number(persistedSlice?.version || 0) }) : null,
        pending_count: activeStage1PendingDates.length,
        pending_dates: Object.freeze(activeStage1PendingDates),
        reviewed_possible_leave_dates: persistedStatus === BUSINESS_STATUS.COMPLETED
            ? Object.freeze(stage1PendingDates) : Object.freeze([]),
        pending_reasons: Object.freeze(unique([
            ...(activeStage1PendingDates.length
                ? ['POSSIBLE_LEAVE_REQUIRES_HR_CLASSIFICATION'] : []),
            ...stage1Blockers
        ])),
        blockers: Object.freeze(stage1Blockers)
    });

    const stage1ResolvedRows = resolverRowsFromStoredDecisions(rows, decisions);
    const afterStage1 = resolveWeeklyHrWorkflow({
        weekRows: stage1ResolvedRows,
        effectiveProfile,
        effectiveProfilesByDate,
        leave_classification_completed: true,
        expected_date_keys: expectedDateKeys,
        ...decisions
    });
    const repoTransfer = fullNaturalWeek && !trailingPartialWeek
        ? analyzeWeeklyRepoTransferForEmploymentContract({
        weekRows: rows,
        employmentProfile: effectiveProfile
    }) : Object.freeze({ eligibility_status: 'NOT_APPLICABLE',
        reasons: Object.freeze([trailingPartialWeek
            ? 'TRAILING_PARTIAL_PERIOD_WEEK_DEFERRED'
            : 'PARTIAL_EMPLOYMENT_SLICE_WEEKLY_REPO_TRANSFER_NOT_APPLICABLE']),
        source: null, target: null, semantic_proposal: null });
    const workflowRequestedStage2 =
        afterStage1.next_required_hr_stage === NEXT_STAGE.REPO_RESOLUTION;
    const stage2Actionability = resolveStage2Actionability(repoTransfer);
    const rawStage2CandidateDates = stage2Actionability.actionable ? unique([
        repoTransfer.source?.hmeromhnia,
        repoTransfer.target?.hmeromhnia
    ]).sort() : [];
    const stage2CandidateDates = rawStage2CandidateDates.filter((date) =>
        !actionableDateSet || actionableDateSet.has(date));
    const stage2ActionableForScope = stage2Actionability.actionable &&
        (!actionableDateSet || stage2CandidateDates.length > 0);
    const repoReasons = unique(repoTransfer.reasons || []);
    // Candidate exclusions and repo deficits are diagnostics. A Stage-2 blocker
    // exists only in the context of an otherwise actionable transfer contract.
    const stage2Blockers = stage2ActionableForScope &&
        repoTransfer.eligibility_status === 'INVALID_INPUT' ? repoReasons : [];
    const stage2PendingCount = stage2ActionableForScope ? 1 : 0;
    const stage2 = stageResult('STAGE2', {
        business_status: stage2Blockers.length
            ? BUSINESS_STATUS.BLOCKED
            : stage2ActionableForScope ? BUSINESS_STATUS.OPEN : BUSINESS_STATUS.COMPLETED,
        pending_count: stage2PendingCount,
        pending_dates: Object.freeze(stage2CandidateDates),
        pending_reasons: Object.freeze(stage2ActionableForScope ? unique([
            'REPO_TRANSFER_DECISION_REQUIRED', ...repoReasons
        ]) : []),
        blockers: Object.freeze(stage2Blockers),
        stage2_applicability: stage2ActionableForScope
            ? 'ACTIONABLE' : 'NOT_APPLICABLE',
        workflow_requested_stage2: workflowRequestedStage2,
        has_transferable_pair: stage2Actionability.has_transferable_pair,
        has_bounded_selection: stage2Actionability.has_bounded_selection,
        repo_transfer_status: repoTransfer.eligibility_status,
        repo_transfer_reasons: Object.freeze([...(repoTransfer.reasons || [])]),
        unresolved_repo_count: afterStage1.unresolved_repo_count,
        weekly_review_deferred: trailingPartialWeek,
        deferment: trailingPartialWeekPresentation
    });

    const stage2ResolvedDates = trailingPartialWeek ? [] : unique(
        (afterStage1.possible_leave_days || []).filter((date) =>
        !(afterStage1.remaining_possible_leave_days || []).includes(date) &&
        !(afterStage1.confirmed_leave_days || []).includes(date) &&
        !(afterStage1.confirmed_sickness_days || []).includes(date) &&
        !(afterStage1.confirmed_absence_days || []).includes(date)));
    const reviewedWithoutPositiveClassification = persistedStatus === BUSINESS_STATUS.COMPLETED;
    const nonFullResolvedDates = reviewedWithoutPositiveClassification
        ? resolveSafeNonFullNonWorkDates({ rows,
            candidateDates: afterStage1.remaining_possible_leave_days || [],
            effectiveProfile, effectiveProfilesByDate }) : [];
    const stage2AutomaticResolvedDates = unique([
        ...stage2ResolvedDates,
        ...nonFullResolvedDates
    ]).sort();
    const stage2AutomaticResolutionItems = stage2AutomaticResolvedDates.map((date) =>
        Object.freeze({ date,
            classification: nonFullResolvedDates.includes(date) ? 'NON_WORK' : 'REST_REPO',
            reason: nonFullResolvedDates.includes(date)
                ? 'STAGE1_REVIEWED_NON_FULL_WITHOUT_ACTUAL_WORK'
                : 'DETERMINISTIC_STAGE2_REPO_RESOLUTION' }));
    const stage3Dates = resolveStage3ActionableDates({
        rawRemainingDates: afterStage1.remaining_possible_leave_days || [],
        stage2ResolvedDates: stage2AutomaticResolvedDates
    });
    const rawRemainingDates = stage3Dates.raw;
    const resolvedBeforeStage3Dates = stage3Dates.resolved_before_stage3;
    const remainingDates = stage3Dates.actionable
        .filter((date) => !actionableDateSet || actionableDateSet.has(date));
    const weeklyResolutionCandidateDates = unique([
        ...(afterStage1.direct_repo_candidates || []).map((item) => item.date),
        ...(afterStage1.repo_transfer_candidates || []).map((item) => item.target_date)
    ]);
    const reviewedPossibleLeaveDateSet = new Set(stage1.reviewed_possible_leave_dates || []);
    const stage1PendingDateSet = new Set(stage1.pending_dates || []);
    const stage3PendingDateSet = new Set(remainingDates);
    const unclassifiedPossibleLeaveDateSet = new Set(
        afterStage1.unclassified_possible_leave_days || []);
    const deferredWeeklyDates = trailingPartialWeek
        ? weeklyResolutionCandidateDates.filter((date) =>
            (!actionableDateSet || actionableDateSet.has(date)) &&
            unclassifiedPossibleLeaveDateSet.has(date) &&
            reviewedPossibleLeaveDateSet.has(date) &&
            !stage1PendingDateSet.has(date) && !stage3PendingDateSet.has(date))
        : [];
    const stage2Fingerprint = buildStage2ResolutionFingerprint({
        status: stage2.business_status,
        resolution: stage2.stage2_applicability,
        resolved_dates: stage2AutomaticResolvedDates,
        reasons: stage2.repo_transfer_reasons
    });
    const stage3Scope = { team: scope.team || rows[0]?.team,
        company_kod: scope.company_kod || rows[0]?.company_kod,
        ypokatasthma: scope.ypokatasthma || rows[0]?.ypokatasthma,
        employee_id: scope.employee_id || rows[0]?.employee_id,
        employee_kodikos: scope.employee_kodikos || rows[0]?.kodikos,
        week_start: scope.week_start || afterStage1.week_start,
        week_end: scope.week_end || afterStage1.week_end };
    const stage3PendingItems = remainingDates.map((date) => {
        const row = rows.find((candidate) => dateKeyUtc(candidate?.hmeromhnia) === date) || {};
        const dailyProfile = effectiveProfilesByDate?.[date] || effectiveProfile;
        const actualFacts = resolveDailyActualWorkFacts(row);
        const employmentType = normalizeEmploymentType(
            dailyProfile?.kathestos_apasxolhshs ?? dailyProfile?.typos_apasxolhshs
        );
        const context = { scope: stage3Scope, row, dailyProfile, actualFacts,
            isResidual: true, remaining_dates: remainingDates,
            stage2: { fingerprint: stage2Fingerprint, status: stage2.business_status,
                resolution: stage2.stage2_applicability,
                resolved_dates: stage2AutomaticResolvedDates },
            upstream: { stage1_attestation_scope: periodSlice ? 'PERIOD_SLICE' : 'WEEKLY',
                stage1_period_start: periodSlice?.period_start || '',
                stage1_period_end: periodSlice?.period_end || '',
                stage1_current_fingerprint: periodSlice
                    ? sliceFingerprints.completion_fingerprint : fingerprint,
                stage1_context_fingerprint: periodSlice
                    ? sliceFingerprints.context_fingerprint : fingerprint,
                stage1_completion_fingerprint: String(periodSlice
                    ? persistedSlice?.completion_fingerprint || ''
                    : persistedStage1State?.completion_fingerprint || ''),
                stage1_effective_fingerprint: String(periodSlice
                    ? persistedSlice?.effective_fingerprint || persistedSlice?.completion_fingerprint || ''
                    : persistedStage1State?.effective_fingerprint ||
                        persistedStage1State?.completion_fingerprint || ''),
                stage1_version: Number(periodSlice
                    ? persistedSlice?.version || 0 : persistedStage1State?.version || 0),
                stage2_fingerprint: stage2Fingerprint,
                stage2_version: 0 } };
        return Object.freeze({ row_id: String(row?._id || ''), date,
            employment_type: employmentType,
            employment_label: employmentType === '0' ? 'Πλήρης' : employmentType === '1'
                ? 'Μερική' : employmentType === '2' ? 'Εκ περιτροπής / Μερική' : 'Άγνωστο',
            declared_hours: Number(actualFacts.declaredWorkHours || 0),
            declared_intervals: Object.freeze([1, 2, 3].map((index) => ({
                start: String(row?.[`apo_ora_0${index}`] || ''),
                end: String(row?.[`eos_ora_0${index}`] || '')
            })).filter((interval) => interval.start || interval.end)),
            actual_work_hours: Number(actualFacts.actualWorkHours || 0),
            actual_work_status: actualFacts.cardVerificationStatus,
            allowed_classifications: Object.freeze(employmentType === '0'
                ? ['LEAVE', 'SICKNESS', 'ABSENCE']
                : ['1', '2'].includes(employmentType)
                    ? ['LEAVE', 'SICKNESS', 'ABSENCE', 'NON_WORK'] : []),
            input_fingerprint: buildStage3InputFingerprint(context).fingerprint,
            expected_stage3_version: Number(persistedStage3State?.version || 0),
            stage2_fingerprint: stage2Fingerprint
        });
    });
    const stage3 = stageResult('STAGE3', {
        business_status: remainingDates.length
            ? BUSINESS_STATUS.OPEN : BUSINESS_STATUS.COMPLETED,
        pending_count: remainingDates.length,
        remaining_possible_leave_count: remainingDates.length,
        raw_remaining_possible_leave_count: rawRemainingDates.length,
        raw_remaining_possible_leave_dates: Object.freeze(rawRemainingDates),
        resolved_before_stage3_dates: Object.freeze(resolvedBeforeStage3Dates),
        pending_dates: Object.freeze(remainingDates),
        pending_items: Object.freeze(stage3PendingItems),
        stage2_fingerprint: stage2Fingerprint,
        stage2_resolved_dates: Object.freeze(stage2AutomaticResolvedDates),
        stage2_repo_resolved_dates: Object.freeze(stage2ResolvedDates),
        stage2_automatic_resolved_dates: Object.freeze(stage2AutomaticResolvedDates),
        stage2_automatic_resolution_items: Object.freeze(stage2AutomaticResolutionItems),
        stage2_non_full_non_work_dates: Object.freeze(nonFullResolvedDates),
        stage2_status: stage2.business_status,
        stage2_resolution: stage2.stage2_applicability,
        pending_reasons: Object.freeze(remainingDates.length
            ? ['REMAINING_POSSIBLE_LEAVE_REVIEW_REQUIRED'] : [])
    });

    const finalAnalysisProfile = effectiveProfilesByDate &&
        Object.keys(effectiveProfilesByDate).length > 0
        ? { ...effectiveProfile,
            date_effective_profiles_by_date: effectiveProfilesByDate }
        : effectiveProfile;
    const finalAnalysis = trailingPartialWeek ? null : analyzeWeeklySixthSeventhDay({
        weekRows: rows,
        effectiveProfile: finalAnalysisProfile,
        expectedDateKeys,
        companyKod: scope.company_kod || rows[0]?.company_kod || '',
        companyPolicyRules,
        isCalculatedWorkHoursAuthoritativeForRow: (row) =>
            isValidPersistedApprovedOrphanResolution(row) &&
            Number(row.ores_ergasias_apologistika) > 0
    });
    const finalBlockers = finalAnalysis?.status === 'NEEDS_HR_DECISION'
        ? unique(finalAnalysis.reasons || []) : [];
    const stage4 = stageResult('STAGE4', {
        business_status: finalBlockers.length
            ? BUSINESS_STATUS.BLOCKED : BUSINESS_STATUS.COMPLETED,
        pending_count: finalBlockers.length,
        pending_reasons: Object.freeze(finalBlockers),
        blockers: Object.freeze(finalBlockers),
        final_weekly_analysis_available: !trailingPartialWeek && finalBlockers.length === 0,
        final_weekly_analysis: finalAnalysis,
        weekly_review_deferred: trailingPartialWeek,
        deferment: trailingPartialWeekPresentation
    });

    const stages = applySequentialPresentation({ stage1, stage2, stage3, stage4 });
    stages.stage4 = Object.freeze({ ...stages.stage4,
        final_weekly_analysis_available:
            !trailingPartialWeek &&
            stages.stage4.presentation_status !== PRESENTATION_STATUS.LOCKED &&
            finalBlockers.length === 0 });
    const activeStage = Object.values(stages).find((stage) => stage.open_by_default) || null;
    const totalPending = Number(activeStage?.pending_count || 0);
    const stage1NoClassificationPreviewItems = buildStage1NoClassificationPreviewItems({
        rows, possibleDates: stage1PendingDates, effectiveProfile, effectiveProfilesByDate,
        repoTransfer, stage2Actionability, stage2ResolvedDates
    });
    return Object.freeze({
        projection_version: 'weekly-hr-derived-lifecycle:v1',
        read_only: true,
        persisted_stage1_status: persistedStatus,
        stage1_persistence_state: persistenceState,
        current_stage: activeStage?.stage || null,
        total_pending_count: totalPending,
        requires_hr_action: Boolean(activeStage),
        deferred_weekly_dates: Object.freeze(deferredWeeklyDates),
        trailing_partial_week: trailingPartialWeekPresentation
            ? Object.freeze({ ...trailingPartialWeekPresentation,
                deferred_weekly_dates: Object.freeze(deferredWeeklyDates) }) : null,
        employment_date_scope: employmentDateScope,
        stage1_no_classification_preview_items: stage1NoClassificationPreviewItems,
        stages: Object.freeze(stages)
    });
}

module.exports = {
    BUSINESS_STATUS,
    PRESENTATION_STATUS,
    applySequentialPresentation,
    resolveStage3ActionableDates,
    resolveSafeNonFullNonWorkDates,
    buildStage1NoClassificationPreviewItems,
    isSingleDayEmploymentWithoutReviewableActivity,
    buildWeeklyHrLifecycleProjection
};
