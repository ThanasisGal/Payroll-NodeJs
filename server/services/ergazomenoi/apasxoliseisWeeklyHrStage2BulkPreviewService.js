'use strict';

const crypto = require('crypto');
const { dateKeyUtc } = require('../../utils/date/mondaySundayWeek');
const { stableStringify } = require('./apasxoliseisStage3FingerprintService');
const { normalizeItems, fingerprint: scopeFingerprint } = require(
    './apasxoliseisWeeklyHrWorkflowStage2CompletionService'
);

const EXCEPTION_PAGE_SIZE = 50;

function text(value) { return String(value ?? '').trim(); }
function scopeIdentity(context = {}) {
    const scope = context.scope || {};
    return {
        employee_id: text(scope.employee_id),
        employee_kodikos: text(scope.employee_kodikos),
        week_start: dateKeyUtc(scope.week_start),
        week_end: dateKeyUtc(scope.week_end)
    };
}
function identityKey(identity = {}) {
    return `${identity.employee_id}|${identity.week_start}|${identity.week_end}`;
}
function exceptionSummary(context, code, message) {
    return { ...scopeIdentity(context), code: text(code) || 'STAGE2_MANUAL_REVIEW_REQUIRED',
        message: text(message) || 'Η περίπτωση απαιτεί έλεγχο HR.' };
}

function buildWeeklyHrStage2BulkPreview({ contexts = [], exception_page = 1,
    exception_page_size = EXCEPTION_PAGE_SIZE } = {}) {
    if (!Array.isArray(contexts)) throw new TypeError('contexts must be an array.');
    const safe = []; const resolved = []; const exceptions = [];
    for (const context of contexts) {
        const identity = scopeIdentity(context);
        if (!identity.employee_id || !identity.week_start || !identity.week_end ||
            !context?.lifecycle || !Array.isArray(context?.rows)) {
            exceptions.push(exceptionSummary(context, 'STAGE2_AUTHORITATIVE_CONTEXT_MISSING'));
            continue;
        }
        if (context.workflowState?.stage2?.status === 'COMPLETED') {
            resolved.push(identity); continue;
        }
        const diagnostic = context.stage2StateDiagnostic || context.lifecycle?.stages?.stage2
            ?.diagnostic || context.lifecycle?.stages?.stage2?.blockers?.[0];
        if (diagnostic) {
            exceptions.push(exceptionSummary(context, diagnostic)); continue;
        }
        const lifecycleStage2 = context.lifecycle?.stages?.stage2 || {};
        if (Number(lifecycleStage2.pending_count || 0) > 0 ||
            (lifecycleStage2.pending_items || []).length > 0) {
            exceptions.push(exceptionSummary(context,
                lifecycleStage2.pending_reasons?.[0] || 'REPO_TRANSFER_DECISION_REQUIRED'));
            continue;
        }
        try {
            const items = normalizeItems(context);
            if (!items.length) { resolved.push(identity); continue; }
            if (context.workflowState?.stage1?.status !== 'COMPLETED' ||
                !text(context.upstream?.stage1_current_fingerprint)) {
                exceptions.push(exceptionSummary(context, 'STAGE2_UPSTREAM_STAGE1_STALE'));
                continue;
            }
            safe.push({ ...identity, scope_fingerprint: scopeFingerprint(context, items) });
        } catch (error) {
            exceptions.push(exceptionSummary(context, error.code, error.message));
        }
    }
    safe.sort((a, b) => identityKey(a).localeCompare(identityKey(b)));
    resolved.sort((a, b) => identityKey(a).localeCompare(identityKey(b)));
    exceptions.sort((a, b) => identityKey(a).localeCompare(identityKey(b)));
    const previewFingerprint = crypto.createHash('sha256').update(stableStringify({
        contract: 'weekly-hr-stage2-bulk-preview:v1',
        safe: safe.map(({ employee_id, week_start, week_end, scope_fingerprint }) =>
            ({ employee_id, week_start, week_end, scope_fingerprint })),
        resolved: resolved.map(({ employee_id, week_start, week_end }) =>
            ({ employee_id, week_start, week_end })),
        exceptions: exceptions.map(({ employee_id, week_start, week_end, code }) =>
            ({ employee_id, week_start, week_end, code }))
    })).digest('hex');
    const pageSize = Math.max(1, Math.min(EXCEPTION_PAGE_SIZE,
        Number(exception_page_size) || EXCEPTION_PAGE_SIZE));
    const page = Math.max(1, Number(exception_page) || 1);
    const offset = (page - 1) * pageSize;
    return { total_scopes: contexts.length, safe_bulk_count: safe.length,
        already_resolved_count: resolved.length, manual_exception_count: exceptions.length,
        safe_scope_ids: safe, preview_fingerprint: previewFingerprint,
        exceptions: exceptions.slice(offset, offset + pageSize),
        exception_page: page, exception_page_size: pageSize,
        exception_page_count: Math.max(1, Math.ceil(exceptions.length / pageSize)) };
}

module.exports = { EXCEPTION_PAGE_SIZE, scopeIdentity, identityKey,
    buildWeeklyHrStage2BulkPreview };
