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

const POLICY_VERSION = 'weekly-repo-deviation-preview:monday-sunday:v2';
const SOURCE_VERSION = 'raw-prodhlomena-oraria-daily-rows:v1';
const STATUS = Object.freeze({
    READY: 'READY',
    OPEN_WEEK_PENDING_COMPLETION: 'OPEN_WEEK_PENDING_COMPLETION',
    NEEDS_HR_DECISION: 'NEEDS_HR_DECISION'
});

function finiteZero(value) {
    const parsed = Number(String(value ?? 0).replace(',', '.'));
    return Number.isFinite(parsed) && Math.abs(parsed) < 0.000001;
}

function employeeKey(row = {}) {
    return `${String(row.ypokatasthma || '').trim()}|${String(row.kodikos || '').trim()}`;
}

function attachSixthDayPresentationToRows(rows = [], deviations = []) {
    const sixthDayByEmployeeAndDate = new Map();
    for (const deviation of Array.isArray(deviations) ? deviations : []) {
        const deviationEmployeeKey = employeeKey(deviation);
        const sixthDayDate = dateKeyUtc(deviation?.sixth_day_date);
        if (!deviationEmployeeKey || !sixthDayDate) continue;

        sixthDayByEmployeeAndDate.set(`${deviationEmployeeKey}|${sixthDayDate}`, {
            rate: deviation.sixth_day_premium_rate ?? null,
            status: deviation.sixth_seventh_day_status || ''
        });
    }

    return (Array.isArray(rows) ? rows : []).map((row) => {
        const sixthDay = sixthDayByEmployeeAndDate.get(
            `${employeeKey(row)}|${dateKeyUtc(row?.hmeromhnia)}`
        );

        return {
            ...row,
            is_sixth_day: Boolean(sixthDay),
            sixth_day_premium_rate: sixthDay?.rate ?? null,
            sixth_day_policy_status: sixthDay?.status || ''
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
        const profileReason =
            weeklyProfile.repoResolutionReason || expectedRepoResolution.reason || null;
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
            const dailyFacts = uniqueRows.map((row) => resolveDailyActualWorkFacts(row));
            const sixthSeventhDay = analyzeWeeklySixthSeventhDay({
                weekRows: uniqueRows,
                effectiveProfile
            });
            const repoTransfer = analyzeWeeklyRepoTransferForEmploymentContract({
                weekRows: uniqueRows,
                employmentProfile: effectiveProfile,
                holidayByDateKey,
                existingAuditCountByRowKey
            });
            const resolution = repoTransfer.weekly_resolution;
            const actualWorkdays = dailyFacts.filter(
                (facts) => facts.countsAsActualWorkDay
            ).length;
            const sixthSeventhDayNeedsDecision =
                sixthSeventhDay.status === 'NEEDS_HR_DECISION';
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
                        ? sixthSeventhDay.reasons || []
                        : []),
                    ...repoStateReasons
                ])],
                expected_repo: expectedRepo,
                actual_repo: actualRepo,
                missing_repo: Math.max(Number(expectedRepo || 0) - Number(actualRepo), 0),
                resolved_repo: resolution?.resolved_repo ?? actualRepo,
                // Η ταξινόμηση 6ης/7ης ημέρας είναι ανεξάρτητη από το αν
                // υπάρχει ασφαλές ζεύγος μεταφοράς ρεπό. Το αποτέλεσμα της
                // μεταφοράς δεν επιτρέπεται να μηδενίζει την άμεση πολιτική.
                actual_workdays: actualWorkdays,
                sixth_day_count: sixthSeventhDay.sixthDay ? 1 : 0,
                seventh_day_count: sixthSeventhDay.seventhDay ? 1 : 0,
                sixth_day_date: sixthSeventhDay.sixthDay?.hmeromhnia || null,
                sixth_day_premium_rate:
                    sixthSeventhDay.sixthDay?.premiumRate ?? null,
                seventh_day_date: sixthSeventhDay.seventhDay?.hmeromhnia || null,
                sixth_seventh_day_status: sixthSeventhDay.status,
                sixth_seventh_day_reasons: [...(sixthSeventhDay.reasons || [])],
                repo_transfer_status: repoTransfer.eligibility_status,
                repo_transfer_reasons: [...(repoTransfer.reasons || [])],
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

module.exports = {
    POLICY_VERSION,
    SOURCE_VERSION,
    STATUS,
    normalizeLegacyDeviation,
    attachSixthDayPresentationToRows,
    buildWeeklyRepoDeviationPreview
};
