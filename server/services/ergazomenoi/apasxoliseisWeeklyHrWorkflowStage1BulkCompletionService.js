'use strict';

const crypto = require('crypto');
const { assertCriticalEmploymentDecisionRole } = require(
    './apasxoliseisCriticalActionAuthorizationService'
);
const { assertWeeklyHrWorkflowIndexesReady } = require(
    './apasxoliseisWeeklyHrWorkflowIndexGuardService'
);

const BULK_STAGE1_CONCURRENCY = 12;
const BULK_REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9:._-]{7,99}$/;
const ALLOWED_STAGE1_SCOPE_FIELDS = new Set([
    'ypokatasthma', 'employee_id', 'week_start', 'week_end', 'period_start', 'period_end'
]);

function bulkError(code, statusCode, message) {
    return Object.assign(new Error(message), { code, statusCode });
}

function childRequestId(bulkRequestId, scope = {}) {
    const material = [bulkRequestId, scope.employee_id, scope.week_start, scope.week_end,
        scope.period_start || '', scope.period_end || ''].join('|');
    const digest = crypto.createHash('sha256').update(material).digest('hex');
    return `stage1-bulk:${digest}`;
}

function resultStatus(error) {
    if (error?.code === 'STAGE1_COMPLETION_BLOCKED') return 'BLOCKED';
    if (['STAGE1_INPUT_CHANGED', 'STAGE1_VERSION_CONFLICT',
        'PERIOD_CONTROL_STATE_CONFLICT'].includes(error?.code)) return 'STALE_RETRY_REQUIRED';
    return 'FAILED';
}

async function mapWithConcurrency(items, limit, worker) {
    const results = new Array(items.length);
    let nextIndex = 0;
    async function run() {
        while (nextIndex < items.length) {
            const index = nextIndex++;
            results[index] = await worker(items[index], index);
        }
    }
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
    return results;
}

async function completeWeeklyHrWorkflowStage1Bulk({
    scopes = [], reason_or_notes, bulk_request_id, actor,
    completeOne, indexGuard = assertWeeklyHrWorkflowIndexesReady,
    concurrency = BULK_STAGE1_CONCURRENCY
} = {}) {
    assertCriticalEmploymentDecisionRole({ userRole: actor?.role });
    const reason = String(reason_or_notes || '').trim();
    const bulkRequestId = String(bulk_request_id || '').trim();
    if (!reason || reason.length > 2000) throw bulkError('STAGE1_REASON_REQUIRED', 400,
        'Απαιτείται κοινή αιτιολογία έως 2000 χαρακτήρες.');
    if (!BULK_REQUEST_ID_PATTERN.test(bulkRequestId)) throw bulkError(
        'INVALID_BULK_REQUEST_ID', 400, 'Μη έγκυρο αναγνωριστικό μαζικής εντολής.');
    if (!Array.isArray(scopes) || scopes.length === 0) throw bulkError(
        'STAGE1_BULK_SCOPES_REQUIRED', 400, 'Δεν επιλέχθηκαν εβδομάδες.');
    if (typeof completeOne !== 'function') throw new TypeError('completeOne dependency is required.');
    await indexGuard();

    const results = await mapWithConcurrency(scopes, concurrency, async (scope) => {
        const forbiddenFields = Object.keys(scope || {}).filter((field) =>
            !ALLOWED_STAGE1_SCOPE_FIELDS.has(field));
        if (forbiddenFields.length) return { scope: {}, status: 'FAILED',
            code: 'STAGE1_COMPLETION_SCOPE_FIELDS_NOT_ALLOWED',
            message: 'Το αίτημα ολοκλήρωσης Stage 1 περιέχει μη επιτρεπτά πεδία.' };
        const safeScope = { ypokatasthma: String(scope?.ypokatasthma || ''),
            employee_id: String(scope?.employee_id || ''), week_start: String(scope?.week_start || ''),
            week_end: String(scope?.week_end || ''),
            ...(scope?.period_start && scope?.period_end ? {
                period_start: String(scope.period_start), period_end: String(scope.period_end)
            } : {}) };
        try {
            const completion = await completeOne({ scope: safeScope, actor,
                reason_or_notes: reason,
                request_id: childRequestId(bulkRequestId, safeScope) });
            return { scope: safeScope, status: completion?.idempotent === true
                ? 'ALREADY_COMPLETED' : 'COMPLETED', code: null, message: '',
                ...(completion?.authoritative_stage1_payload ? {
                    authoritative_stage1_payload: completion.authoritative_stage1_payload
                } : {}) };
        } catch (error) {
            return { scope: safeScope, status: resultStatus(error),
                code: String(error?.code || 'STAGE1_BULK_ITEM_FAILED'),
                message: error?.statusCode ? String(error.message || '') :
                    'Η ολοκλήρωση της εβδομάδας απέτυχε.' };
        }
    });
    const count = (status) => results.filter((result) => result.status === status).length;
    return { requested_count: results.length, completed_count: count('COMPLETED'),
        already_completed_count: count('ALREADY_COMPLETED'), failed_count:
            count('FAILED') + count('STALE_RETRY_REQUIRED'), blocked_count: count('BLOCKED'), results };
}

module.exports = { BULK_STAGE1_CONCURRENCY, childRequestId, mapWithConcurrency,
    completeWeeklyHrWorkflowStage1Bulk };
