'use strict';

const REASON_CODE = 'PERIOD_HAS_PENDING_HR_ACTIONS';

function positiveInteger(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? Math.trunc(number) : 0;
}

function projectionRequiresHrAction(projection = {}) {
    if (projection.requires_hr_action === true || positiveInteger(projection.total_pending_count) > 0) return true;
    return Object.values(projection.stages || {}).some((stage) =>
        ['OPEN', 'BLOCKED', 'STALE'].includes(String(stage?.business_status || '')) &&
        positiveInteger(stage?.pending_count) > 0);
}

function buildPeriodHrReadiness({ employeeCodes = [], weeklyProjections = [] } = {}) {
    const employees = new Set(employeeCodes.map((value) => String(value || '').trim()).filter(Boolean));
    const pendingCases = [];
    let totalPendingCount = 0;
    let requiresHrActionCount = 0;
    for (const item of weeklyProjections) {
        const projection = item?.lifecycle_projection || item || {};
        const pendingCount = positiveInteger(projection.total_pending_count);
        const requiresAction = projectionRequiresHrAction(projection);
        totalPendingCount += pendingCount;
        if (!requiresAction) continue;
        requiresHrActionCount += 1;
        pendingCases.push(Object.freeze({
            employee_kodikos: String(item?.scope?.employee_kodikos || item?.employee_kodikos || '').trim(),
            week_start: String(item?.scope?.week_start || item?.week_start || '').slice(0, 10),
            week_end: String(item?.scope?.week_end || item?.week_end || '').slice(0, 10),
            current_stage: projection.current_stage || null,
            pending_count: pendingCount
        }));
    }
    return Object.freeze({ ready: pendingCases.length === 0,
        reason_code: pendingCases.length ? REASON_CODE : null,
        employees_count: employees.size,
        employees_with_weekly_projections_count: new Set(weeklyProjections.map((item) =>
            String(item?.scope?.employee_kodikos || item?.employee_kodikos || '').trim()).filter(Boolean)).size,
        weekly_projections_count: weeklyProjections.length,
        total_pending_count: totalPendingCount,
        requires_hr_action_count: requiresHrActionCount,
        pending_cases: Object.freeze(pendingCases) });
}

function assertPeriodHrReady(readiness, action = '') {
    if (readiness?.ready !== false) return readiness;
    const count = positiveInteger(readiness.total_pending_count);
    const actionMessage = action === 'FINALIZE' ? 'Η περίοδος δεν μπορεί να οριστικοποιηθεί.'
        : action === 'LOCK' ? 'Η περίοδος δεν μπορεί να κλειδωθεί.'
            : 'Η περίοδος δεν μπορεί να μεταβληθεί.';
    const error = new Error(count ? `${actionMessage} Υπάρχουν ${count} εκκρεμότητες ελέγχου εργαζομένων.`
        : `${actionMessage} Υπάρχουν εκκρεμότητες ελέγχου εργαζομένων.`);
    error.code = REASON_CODE; error.statusCode = 409; error.period_hr_readiness = readiness;
    throw error;
}

async function collectPeriodWideUiProjections({ loadPage, pageSize = 100 } = {}) {
    if (typeof loadPage !== 'function') throw new TypeError('Period-wide page loader is required.');
    const employeeCodes = [];
    const weeklyProjections = [];
    const rows = [];
    let page = 1;
    let totalPages = 1;
    do {
        const payload = await loadPage({ page, limit: pageSize });
        if (!payload?.success) throw new Error(payload?.message || 'Η period-wide projection απέτυχε.');
        employeeCodes.push(...(payload.employeeCodes || []));
        weeklyProjections.push(...(payload.weekly_hr_projections || []));
        rows.push(...(payload.rows || []));
        totalPages = Math.max(Number(payload.totalPages || 1), 1);
        page += 1;
    } while (page <= totalPages);
    return Object.freeze({ employeeCodes: Object.freeze(employeeCodes),
        weeklyProjections: Object.freeze(weeklyProjections), rows: Object.freeze(rows) });
}

module.exports = { REASON_CODE, projectionRequiresHrAction, buildPeriodHrReadiness, assertPeriodHrReady,
    collectPeriodWideUiProjections };
