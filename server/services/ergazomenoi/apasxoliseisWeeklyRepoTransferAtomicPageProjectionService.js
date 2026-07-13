// Pure aggregation of complete weekly repo-transfer inputs for one filtered period response.
// This module must stay isolated from persistence, transport, and apply dependencies.

const {
    buildWeeklyRepoTransferSinglePairGroupProjection,
    PROJECTION_STATUS: SINGLE_WEEK_PROJECTION_STATUS
} = require('./apasxoliseisWeeklyRepoTransferSinglePairGroupProjectionService');

const PAGE_PROJECTION_STATUS = Object.freeze({
    READY: 'READY'
});

const MAX_ATOMIC_PERIOD_DAYS = 62;

const INPUT_REASON = Object.freeze({
    DATE_RANGE_REQUIRED: 'ATOMIC_DATE_RANGE_REQUIRED',
    INVALID_ROW: 'INVALID_ATOMIC_ROW_IDENTITY_OR_DATE',
    PARTIAL_WEEK: 'PARTIAL_WEEK_OUTSIDE_FILTER_RANGE',
    DUPLICATE_DATE: 'DUPLICATE_EMPLOYEE_WEEK_DATE',
    INCOMPLETE_WEEK: 'INCOMPLETE_EMPLOYEE_WEEK',
    PROFILE_NOT_RESOLVED: 'EMPLOYMENT_PROFILE_NOT_RESOLVED',
    HOLIDAY_CONTEXT_NOT_RESOLVED: 'ATOMIC_HOLIDAY_CONTEXT_NOT_RESOLVED',
    DATE_RANGE_EXCEEDS_LIMIT: 'ATOMIC_DATE_RANGE_EXCEEDS_LIMIT'
});

function isPlainObject(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

function primitiveString(value, maxLength = 200) {
    if (!['string', 'number', 'bigint', 'boolean'].includes(typeof value)) return null;
    if (typeof value === 'number' && !Number.isFinite(value)) return null;
    const normalized = String(value).trim();
    return normalized ? normalized.slice(0, maxLength) : null;
}

function dateKeyUtc(value) {
    if (!value) return null;
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
        const key = value.trim();
        const parsed = new Date(`${key}T00:00:00.000Z`);
        return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== key
            ? null
            : key;
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function addDaysDateKey(dateKey, days) {
    const date = new Date(`${dateKey}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
}

function sundayDateKey(dateKey) {
    const date = new Date(`${dateKey}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() - date.getUTCDay());
    return date.toISOString().slice(0, 10);
}

function getAtomicPeriodRangeDiagnostic({
    periodStart,
    periodEnd,
    maxDays = MAX_ATOMIC_PERIOD_DAYS
} = {}) {
    const periodStartKey = dateKeyUtc(periodStart);
    const periodEndKey = dateKeyUtc(periodEnd);
    if (!periodStartKey || !periodEndKey || periodStartKey > periodEndKey) {
        return INPUT_REASON.DATE_RANGE_REQUIRED;
    }

    const normalizedMaxDays = Number.isSafeInteger(maxDays) && maxDays > 0
        ? maxDays
        : MAX_ATOMIC_PERIOD_DAYS;
    const start = new Date(`${periodStartKey}T00:00:00.000Z`);
    const end = new Date(`${periodEndKey}T00:00:00.000Z`);
    const inclusiveDays = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;

    return inclusiveDays > normalizedMaxDays ? INPUT_REASON.DATE_RANGE_EXCEEDS_LIMIT : null;
}

function buildCompanyWideUniqueEmployeeByKodikos(employeeRows = []) {
    const candidatesByKodikos = new Map();
    (Array.isArray(employeeRows) ? employeeRows : []).forEach((employee) => {
        const kodikos = primitiveString(employee?.kodikos, 100);
        if (!kodikos) return;
        if (!candidatesByKodikos.has(kodikos)) candidatesByKodikos.set(kodikos, []);
        candidatesByKodikos.get(kodikos).push(employee);
    });

    const uniqueByKodikos = new Map();
    candidatesByKodikos.forEach((candidates, kodikos) => {
        uniqueByKodikos.set(kodikos, candidates.length === 1 ? candidates[0] : null);
    });
    return uniqueByKodikos;
}

function isEmployeeCompatibleWithBranch(employee, ypokatasthma) {
    const employeeBranch = primitiveString(employee?.ypokatasthma, 100);
    const bucketBranch = primitiveString(ypokatasthma, 100);
    return employeeBranch !== null && bucketBranch !== null && employeeBranch === bucketBranch;
}

function deepFreeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.freeze(value);
    Object.keys(value).forEach((key) => deepFreeze(value[key]));
    return value;
}

function clonePlain(value) {
    if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) return value;
    if (Array.isArray(value)) return value.map(clonePlain);
    if (!isPlainObject(value)) throw new TypeError('Atomic projection output must be plain.');

    const clone = {};
    Object.keys(value).forEach((key) => {
        clone[key] = clonePlain(value[key]);
    });
    return clone;
}

function bucketIdentity(row, rowDateKey) {
    const team = primitiveString(row?.team);
    const companyKod = primitiveString(row?.company_kod);
    const ypokatasthma = primitiveString(row?.ypokatasthma, 100);
    const employeeKodikos = primitiveString(row?.kodikos, 100);
    if (!team || !companyKod || !ypokatasthma || !employeeKodikos || !rowDateKey) return null;

    const weekStart = sundayDateKey(rowDateKey);
    return {
        key: JSON.stringify([team, companyKod, ypokatasthma, employeeKodikos, weekStart]),
        team,
        companyKod,
        ypokatasthma,
        employeeKodikos,
        weekStart,
        weekEnd: addDaysDateKey(weekStart, 6)
    };
}

function buildWeeklyRepoTransferAtomicInputs({
    rows = [],
    periodStart = null,
    periodEnd = null,
    resolveEmploymentProfile,
    holidayByDateKey = new Map(),
    existingAuditCountByRowKey = new Map()
} = {}) {
    const weeklyInputs = [];
    const inputReasonCodes = [];

    const rangeDiagnostic = getAtomicPeriodRangeDiagnostic({ periodStart, periodEnd });
    if (rangeDiagnostic) {
        inputReasonCodes.push(rangeDiagnostic);
        return { weeklyInputs, inputReasonCodes };
    }
    const periodStartKey = dateKeyUtc(periodStart);
    const periodEndKey = dateKeyUtc(periodEnd);

    const buckets = new Map();
    (Array.isArray(rows) ? rows : []).forEach((row) => {
        const rowDateKey = dateKeyUtc(row?.hmeromhnia);
        const identity = bucketIdentity(row, rowDateKey);
        if (!identity) {
            inputReasonCodes.push(INPUT_REASON.INVALID_ROW);
            return;
        }
        if (!buckets.has(identity.key)) buckets.set(identity.key, { ...identity, rows: [] });
        buckets.get(identity.key).rows.push({ row, dateKey: rowDateKey });
    });

    [...buckets.values()]
        .sort((left, right) => left.key.localeCompare(right.key))
        .forEach((bucket) => {
            if (bucket.weekStart < periodStartKey || bucket.weekEnd > periodEndKey) {
                inputReasonCodes.push(INPUT_REASON.PARTIAL_WEEK);
                return;
            }

            const dateKeys = bucket.rows.map((entry) => entry.dateKey);
            if (new Set(dateKeys).size !== dateKeys.length) {
                inputReasonCodes.push(INPUT_REASON.DUPLICATE_DATE);
                return;
            }

            const expectedDateKeys = Array.from({ length: 7 }, (_, index) =>
                addDaysDateKey(bucket.weekStart, index)
            );
            if (
                bucket.rows.length !== 7 ||
                expectedDateKeys.some((dateKey) => !dateKeys.includes(dateKey))
            ) {
                inputReasonCodes.push(INPUT_REASON.INCOMPLETE_WEEK);
                return;
            }

            const employmentProfile =
                typeof resolveEmploymentProfile === 'function'
                    ? resolveEmploymentProfile({
                          team: bucket.team,
                          company_kod: bucket.companyKod,
                          ypokatasthma: bucket.ypokatasthma,
                          employee_kodikos: bucket.employeeKodikos,
                          week_start: bucket.weekStart,
                          week_end: bucket.weekEnd
                      })
                    : null;
            if (!isPlainObject(employmentProfile)) {
                inputReasonCodes.push(INPUT_REASON.PROFILE_NOT_RESOLVED);
                return;
            }

            weeklyInputs.push({
                weekRows: bucket.rows
                    .slice()
                    .sort((left, right) => left.dateKey.localeCompare(right.dateKey))
                    .map((entry) => entry.row),
                employmentProfile,
                holidayByDateKey,
                existingAuditCountByRowKey
            });
        });

    return { weeklyInputs, inputReasonCodes };
}

function incrementCounts(target, values) {
    (Array.isArray(values) ? values : []).forEach((value) => {
        if (typeof value !== 'string' || !value) return;
        target[value] = (target[value] || 0) + 1;
    });
}

function sortedCounts(counts) {
    return Object.fromEntries(
        Object.keys(counts)
            .sort()
            .map((key) => [key, counts[key]])
    );
}

function cloneAtomicGroup(group) {
    const cloned = clonePlain(group);
    cloned.representative_item = cloned.items[0];
    return cloned;
}

function validateReadyGroupProjection(projection) {
    if (!Array.isArray(projection?.groups) || projection.groups.length !== 1) return null;
    const group = projection.groups[0];
    if (
        !primitiveString(group?.group_id) ||
        group?.count !== 2 ||
        group?.decision_units_count !== 1 ||
        !Array.isArray(group?.items) ||
        group.items.length !== 2 ||
        group.items[0]?.role !== 'SOURCE_BECOMES_WORK' ||
        group.items[1]?.role !== 'TARGET_BECOMES_REPO' ||
        group?.pair_contract?.approval_supported !== false ||
        group?.pair_contract?.batch_approvable !== false ||
        group?.pair_contract?.runtime_apply_supported !== false
    ) {
        return null;
    }
    return group;
}

function compareGroups(left, right) {
    return (
        String(left.first_date || '').localeCompare(String(right.first_date || '')) ||
        String(left.representative_item?.employee_kodikos || '').localeCompare(
            String(right.representative_item?.employee_kodikos || ''),
            'el',
            { numeric: true, sensitivity: 'base' }
        ) ||
        String(left.group_id || '').localeCompare(String(right.group_id || ''))
    );
}

function buildWeeklyRepoTransferAtomicPageProjection(
    { weeklyInputs = [], inputReasonCodes = [] } = {},
    { singleWeekProjectionBuilder = buildWeeklyRepoTransferSinglePairGroupProjection } = {}
) {
    const reasonCounts = {};
    const warningCounts = {};
    const groupsById = new Map();
    const summary = {
        weeks_evaluated: Array.isArray(weeklyInputs) ? weeklyInputs.length : 0,
        groups_count: 0,
        decision_units_count: 0,
        items_count: 0,
        employees_count: 0,
        ready_count: 0,
        not_available_count: 0,
        invalid_projection_count: 0
    };
    incrementCounts(reasonCounts, inputReasonCodes);

    (Array.isArray(weeklyInputs) ? weeklyInputs : []).forEach((weeklyInput) => {
        const projection = singleWeekProjectionBuilder({
            weekRows: weeklyInput?.weekRows,
            employmentProfile: weeklyInput?.employmentProfile,
            holidayByDateKey: weeklyInput?.holidayByDateKey,
            existingAuditCountByRowKey: weeklyInput?.existingAuditCountByRowKey
        });
        incrementCounts(reasonCounts, projection?.reasons);
        incrementCounts(warningCounts, projection?.warnings);

        if (projection?.projection_status === SINGLE_WEEK_PROJECTION_STATUS.NOT_AVAILABLE) {
            summary.not_available_count++;
            return;
        }
        if (projection?.projection_status === SINGLE_WEEK_PROJECTION_STATUS.INVALID_PROJECTION) {
            summary.invalid_projection_count++;
            return;
        }
        if (projection?.projection_status !== SINGLE_WEEK_PROJECTION_STATUS.READY) {
            summary.invalid_projection_count++;
            incrementCounts(reasonCounts, ['UNKNOWN_ATOMIC_PROJECTION_STATUS']);
            return;
        }

        const group = validateReadyGroupProjection(projection);
        if (!group) {
            summary.invalid_projection_count++;
            incrementCounts(reasonCounts, ['ATOMIC_GROUP_RESULT_INVALID']);
            return;
        }

        if (groupsById.has(group.group_id)) {
            incrementCounts(reasonCounts, ['DUPLICATE_ATOMIC_GROUP_ID']);
            return;
        }
        groupsById.set(group.group_id, cloneAtomicGroup(group));
        summary.ready_count++;
    });

    const groups = [...groupsById.values()].sort(compareGroups);
    const employees = new Set(
        groups
            .map((group) => primitiveString(group.representative_item?.employee_kodikos, 100))
            .filter(Boolean)
    );
    summary.groups_count = groups.length;
    summary.decision_units_count = groups.length;
    summary.items_count = groups.length * 2;
    summary.employees_count = employees.size;

    return deepFreeze({
        version: 1,
        scope: 'filtered_period_complete_weeks',
        projection_status: PAGE_PROJECTION_STATUS.READY,
        summary,
        reason_counts: sortedCounts(reasonCounts),
        warning_counts: sortedCounts(warningCounts),
        groups
    });
}

function composePolicyPreviewResponse({ baseResponse = {}, atomicGroupProjection } = {}) {
    if (!isPlainObject(baseResponse) || !isPlainObject(atomicGroupProjection)) {
        throw new TypeError('Policy preview response composition requires plain objects.');
    }
    return {
        ...baseResponse,
        atomic_group_projection: atomicGroupProjection
    };
}

module.exports = {
    buildWeeklyRepoTransferAtomicInputs,
    buildWeeklyRepoTransferAtomicPageProjection,
    composePolicyPreviewResponse,
    PAGE_PROJECTION_STATUS,
    INPUT_REASON,
    MAX_ATOMIC_PERIOD_DAYS,
    getAtomicPeriodRangeDiagnostic,
    buildCompanyWideUniqueEmployeeByKodikos,
    isEmployeeCompatibleWithBranch
};
