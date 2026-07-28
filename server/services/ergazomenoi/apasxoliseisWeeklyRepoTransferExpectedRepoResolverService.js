// Pure resolver for the expected weekly repo count used by every repo-transfer stage.

const REPO_RESOLUTION_SOURCE = Object.freeze({
    SIX_SCHEDULED_WORK_DAYS: 'SIX_SCHEDULED_WORK_DAYS',
    EXPLICIT_MHNIAIA_REPO: 'EXPLICIT_MHNIAIA_REPO',
    WEEKLY_WORKDAYS_FALLBACK: 'WEEKLY_WORKDAYS_FALLBACK'
});

const REPO_RESOLUTION_REASON = Object.freeze({
    INVALID_EXPLICIT_MHNIAIA_REPO: 'INVALID_EXPLICIT_MHNIAIA_REPO',
    INVALID_EFFECTIVE_WEEKLY_WORKDAYS: 'INVALID_EFFECTIVE_WEEKLY_WORKDAYS'
});

const DECLARED_INTERVAL_FIELDS = Object.freeze([
    ['apo_ora_01', 'eos_ora_01'],
    ['apo_ora_02', 'eos_ora_02'],
    ['apo_ora_03', 'eos_ora_03']
]);

function finitePositive(value) {
    if (value === null || value === undefined || String(value).trim() === '') return false;
    const number = Number(String(value).replace(',', '.').trim());
    return Number.isFinite(number) && number > 0;
}

function minutes(value) {
    if (typeof value !== 'string') return null;
    const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    return hour <= 23 && minute <= 59 ? hour * 60 + minute : null;
}

function hasCompleteNonZeroDeclaredInterval(row = {}) {
    return DECLARED_INTERVAL_FIELDS.some(([startField, endField]) => {
        const start = minutes(row[startField]);
        const end = minutes(row[endField]);
        return start !== null && end !== null && start !== end;
    });
}

function isScheduledWorkDay(row = {}) {
    return String(row.kathgoria_ergasias || '').trim() === 'ΕΡΓ' &&
        (finitePositive(row.ores_ergasias) || hasCompleteNonZeroDeclaredInterval(row));
}

function scheduledWorkDays(weekRows = []) {
    return new Set(
        (Array.isArray(weekRows) ? weekRows : [])
            .filter(isScheduledWorkDay)
            .map((row) => {
                const date = new Date(row?.hmeromhnia);
                return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
            })
            .filter(Boolean)
    ).size;
}

function profileInteger(value) {
    if (value === null || value === undefined || String(value).trim() === '') return null;
    if (!['string', 'number'].includes(typeof value)) return NaN;
    const number = Number(String(value).replace(',', '.').trim());
    return Number.isSafeInteger(number) ? number : NaN;
}

function resolved(expectedRepo, source, scheduledDays, effectiveWeeklyWorkdays) {
    return Object.freeze({
        ok: true,
        reason: null,
        effectiveExpectedWeeklyRepo: expectedRepo,
        repoResolutionSource: source,
        scheduledWorkDays: scheduledDays,
        effectiveWeeklyWorkdays
    });
}

function diagnostic(reason, scheduledDays, effectiveWeeklyWorkdays = null) {
    return Object.freeze({
        ok: false,
        reason,
        effectiveExpectedWeeklyRepo: null,
        repoResolutionSource: null,
        scheduledWorkDays: scheduledDays,
        effectiveWeeklyWorkdays
    });
}

function resolveEffectiveExpectedWeeklyRepo({ weekRows = [], effectiveProfile = {} } = {}) {
    const scheduledDays = scheduledWorkDays(weekRows);
    if (scheduledDays >= 6) {
        return resolved(1, REPO_RESOLUTION_SOURCE.SIX_SCHEDULED_WORK_DAYS, scheduledDays, 6);
    }

    const explicitRepo = profileInteger(effectiveProfile.mhniaia_repo);
    if (Number.isSafeInteger(explicitRepo) && explicitRepo > 0) {
        return explicitRepo <= 6
            ? resolved(
                  explicitRepo,
                  REPO_RESOLUTION_SOURCE.EXPLICIT_MHNIAIA_REPO,
                  scheduledDays,
                  profileInteger(effectiveProfile.hmeres_ergasias_ebdomadas)
              )
            : diagnostic(REPO_RESOLUTION_REASON.INVALID_EXPLICIT_MHNIAIA_REPO, scheduledDays);
    }
    if (explicitRepo !== null && explicitRepo !== 0) {
        return diagnostic(REPO_RESOLUTION_REASON.INVALID_EXPLICIT_MHNIAIA_REPO, scheduledDays);
    }

    const workdays = profileInteger(effectiveProfile.hmeres_ergasias_ebdomadas);
    if (workdays === 5 || workdays === 6) {
        return resolved(
            workdays === 5 ? 2 : 1,
            REPO_RESOLUTION_SOURCE.WEEKLY_WORKDAYS_FALLBACK,
            scheduledDays,
            workdays
        );
    }
    return diagnostic(
        REPO_RESOLUTION_REASON.INVALID_EFFECTIVE_WEEKLY_WORKDAYS,
        scheduledDays,
        Number.isSafeInteger(workdays) ? workdays : null
    );
}

module.exports = {
    REPO_RESOLUTION_SOURCE,
    REPO_RESOLUTION_REASON,
    isScheduledWorkDay,
    scheduledWorkDays,
    resolveEffectiveExpectedWeeklyRepo
};
