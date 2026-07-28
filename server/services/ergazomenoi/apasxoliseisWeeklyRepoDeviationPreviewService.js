const {
    dateKeyUtc,
    addDaysUtc,
    startOfWeekMondayUtc,
    endOfWeekSundayUtc
} = require('../../utils/date/mondaySundayWeek');

const POLICY_VERSION = 'weekly-repo-deviation-preview:monday-sunday:v1';
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

function isDeclaredRepo(row = {}, isFullTimeProfile = () => true) {
    return (
        String(row.kathgoria_ergasias || '').trim() === 'ΑΝ' &&
        finiteZero(row.ores_ergasias) &&
        finiteZero(row.cards_ores_ergasias) &&
        isFullTimeProfile(row) === true
    );
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
    resolveDailyProfile,
    isFullTimeProfile
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
        const expectedRepo = weeklyProfile.expectedWeeklyRepo;
        const profileReason = weeklyProfile.repoResolutionReason || null;
        const actualRepo = uniqueRows.filter((row) => {
            const dailyProfile =
                typeof resolveDailyProfile === 'function'
                    ? resolveDailyProfile(row) || {}
                    : {};
            return isDeclaredRepo(row, () =>
                typeof isFullTimeProfile === 'function'
                    ? isFullTimeProfile(dailyProfile)
                    : true
            );
        }).length;

        if (profileReason || Number(actualRepo) !== Number(expectedRepo)) {
            deviations.push({
                ...base,
                status: profileReason ? STATUS.NEEDS_HR_DECISION : STATUS.READY,
                complete: true,
                is_deviation: true,
                reasons: profileReason ? [profileReason] : [],
                expected_repo: expectedRepo,
                actual_repo: actualRepo,
                profile_changed_inside_week:
                    profileReason === 'PROFILE_CHANGED_INSIDE_WEEK',
                deviation_type:
                    profileReason === 'PROFILE_CHANGED_INSIDE_WEEK'
                        ? 'PROFILE_CHANGED_INSIDE_WEEK'
                        : 'WEEKLY_REPO_MISMATCH',
                effective_mhniaia_repo: expectedRepo,
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
    buildWeeklyRepoDeviationPreview
};
