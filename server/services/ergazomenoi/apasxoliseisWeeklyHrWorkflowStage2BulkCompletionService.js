'use strict';

const crypto = require('crypto');
const { dateKeyUtc } = require('../../utils/date/mondaySundayWeek');
const { assertCriticalEmploymentDecisionRole } = require(
    './apasxoliseisCriticalActionAuthorizationService'
);
const { buildWeeklyHrStage2BulkPreview, identityKey } = require(
    './apasxoliseisWeeklyHrStage2BulkPreviewService'
);

const WRITE_CHUNK_SIZE = 100;
const REQUEST_PATTERN = /^[A-Za-z0-9][A-Za-z0-9:._-]{7,99}$/;
function fail(code, message, statusCode = 400) {
    throw Object.assign(new Error(message), { code, statusCode });
}
function childRequestId(bulkRequestId, scope) {
    const employee = String(scope.employee_id || '').replace(/[^A-Za-z0-9._-]/g, '_');
    const week = String(scope.week_start || '').slice(0, 10);
    const suffix = `${bulkRequestId}:${employee}:${week}`;
    if (REQUEST_PATTERN.test(suffix) && suffix.length <= 100) return suffix;
    return `stage2-bulk:${crypto.createHash('sha256').update(suffix).digest('hex')}`;
}
function statusFor(error) {
    if (['STAGE2_INPUT_CHANGED', 'STAGE2_VERSION_CONFLICT', 'DAILY_REVIEW_INPUT_CHANGED',
        'PERIOD_CONTROL_STATE_CONFLICT'].includes(error?.code)) return 'STALE';
    return 'FAILED';
}

async function completeWeeklyHrWorkflowStage2Bulk({ period_start, period_end, ypokatasthma,
    bulk_request_id, reason_or_notes, expected_preview_fingerprint, actor,
    loadPreparedContexts, completePreparedScope, commonGuard = async () => {},
    chunk_size = WRITE_CHUNK_SIZE } = {}) {
    assertCriticalEmploymentDecisionRole({ userRole: actor?.role });
    const requestId = String(bulk_request_id || '').trim();
    const reason = String(reason_or_notes || '').trim();
    if (!REQUEST_PATTERN.test(requestId)) fail('INVALID_BULK_REQUEST_ID',
        'Μη έγκυρο αναγνωριστικό μαζικής εντολής.');
    if (!reason || reason.length > 2000) fail('STAGE2_REASON_REQUIRED',
        'Απαιτείται κοινή αιτιολογία έως 2000 χαρακτήρες.');
    if (!/^[a-f0-9]{64}$/.test(String(expected_preview_fingerprint || ''))) {
        fail('INVALID_STAGE2_BULK_PREVIEW_FINGERPRINT', 'Μη έγκυρο fingerprint προεπισκόπησης.');
    }
    if (typeof loadPreparedContexts !== 'function' || typeof completePreparedScope !== 'function') {
        fail('STAGE2_BULK_SAFE_COMMAND_UNAVAILABLE',
            'Δεν είναι διαθέσιμη ασφαλής μαζική ολοκλήρωση Stage 2.', 503);
    }
    await commonGuard({ period_start, period_end, ypokatasthma, actor });
    const contexts = await loadPreparedContexts({ period_start, period_end, ypokatasthma });
    const preview = buildWeeklyHrStage2BulkPreview({ contexts });
    if (preview.preview_fingerprint !== expected_preview_fingerprint) {
        fail('STAGE2_BULK_PREVIEW_CHANGED',
            'Η προεπισκόπηση Stage 2 άλλαξε. Απαιτείται νέα φόρτωση.', 409);
    }
    const byIdentity = new Map(contexts.map((context) => [identityKey({
        employee_id: String(context.scope?.employee_id || ''),
        week_start: dateKeyUtc(context.scope?.week_start),
        week_end: dateKeyUtc(context.scope?.week_end)
    }), context]));
    const results = [];
    const size = Math.max(1, Math.min(200, Number(chunk_size) || WRITE_CHUNK_SIZE));
    for (let offset = 0; offset < preview.safe_scope_ids.length; offset += size) {
        const chunk = preview.safe_scope_ids.slice(offset, offset + size);
        for (const scope of chunk) {
            const context = byIdentity.get(identityKey(scope));
            try {
                const result = await completePreparedScope({ context, actor,
                    reason_or_notes: reason, request_id: childRequestId(requestId, scope),
                    expected_scope_fingerprint: scope.scope_fingerprint });
                results.push({ scope, status: result?.idempotent === true
                    ? 'ALREADY_COMPLETED' : 'APPLIED' });
            } catch (error) {
                results.push({ scope, status: statusFor(error),
                    code: String(error?.code || 'STAGE2_BULK_SCOPE_FAILED') });
            }
        }
    }
    const count = (status) => results.filter((item) => item.status === status).length;
    return { total_scopes: preview.total_scopes, applied: count('APPLIED'),
        already_completed: preview.already_resolved_count + count('ALREADY_COMPLETED'),
        skipped_manual: preview.manual_exception_count, stale: count('STALE'),
        failed: count('FAILED'), preview_fingerprint: preview.preview_fingerprint, results };
}

module.exports = { WRITE_CHUNK_SIZE, childRequestId,
    completeWeeklyHrWorkflowStage2Bulk };
