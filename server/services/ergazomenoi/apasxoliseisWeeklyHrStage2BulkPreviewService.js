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
function preparedSafePair(context = {}) {
    const stage2 = context.lifecycle?.stages?.stage2 || {};
    const record = context.preparedStage2Record;
    const proposal = record?.current_proposal || {};
    const command = proposal.command || {};
    const fingerprint = text(record?.current_proposal_fingerprint);
    const exactPair = stage2.has_transferable_pair === true &&
        stage2.has_bounded_selection === true && Number(stage2.pending_count || 0) === 1 &&
        (stage2.pending_items || []).length === 1;
    const commandComplete = command.proposal_id && command.expected_source_id &&
        command.expected_target_id && command.expected_source_id !== command.expected_target_id &&
        command.expected_proposal_version && command.expected_choice_code;
    const guardsReady = record?.runtime_enabled === true && record?.index_ready === true &&
        context.period_writable === true;
    const unresolved = !record?.current_execution &&
        !['APPLIED', 'ALREADY_APPLIED'].includes(record?.apply_state);
    if (!exactPair || !commandComplete || !/^[a-f0-9]{64}$/.test(fingerprint) ||
        !guardsReady || !unresolved || (stage2.blockers || []).length) return null;
    return { command: { ...command }, proposal_fingerprint: fingerprint,
        decision_id: record?.current_decision?.decision_code === 'APPROVE_PROPOSAL'
            ? text(record.current_decision.id) : '',
        decision_required: record?.current_decision?.decision_code !== 'APPROVE_PROPOSAL' };
}

function buildWeeklyHrStage2BulkPreview({ contexts = [], exception_page = 1,
    exception_page_size = EXCEPTION_PAGE_SIZE } = {}) {
    if (!Array.isArray(contexts)) throw new TypeError('contexts must be an array.');
    const safe = []; const resolved = []; const exceptions = [];
    let safePairCount = 0; let safeAutomaticCount = 0;
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
            const pair = preparedSafePair(context);
            if (pair) {
                safePairCount++;
                safe.push({ ...identity, bulk_kind: 'SAFE_PAIR_TRANSFER',
                    scope_fingerprint: crypto.createHash('sha256').update(stableStringify({
                        contract: 'weekly-hr-stage2-safe-pair:v1', identity,
                        proposal_fingerprint: pair.proposal_fingerprint,
                        stage1_fingerprint: text(context.upstream?.stage1_current_fingerprint),
                        stage1_version: Number(context.workflowState?.stage1?.version || 0)
                    })).digest('hex'), pair });
            } else exceptions.push(exceptionSummary(context,
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
            safeAutomaticCount++;
            safe.push({ ...identity, bulk_kind: 'SAFE_AUTOMATIC_MATERIALIZATION',
                scope_fingerprint: scopeFingerprint(context, items) });
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
        safe_pair_count: safePairCount, safe_automatic_count: safeAutomaticCount,
        already_resolved_count: resolved.length, manual_exception_count: exceptions.length,
        safe_scope_ids: safe, preview_fingerprint: previewFingerprint,
        exceptions: exceptions.slice(offset, offset + pageSize),
        exception_page: page, exception_page_size: pageSize,
        exception_page_count: Math.max(1, Math.ceil(exceptions.length / pageSize)),
        _all_exceptions: exceptions };
}

function publicWeeklyHrStage2BulkPreview(preview = {}) {
    const { safe_scope_ids: _privateSafeScopeIds,
        _all_exceptions: _privateAllExceptions, ...publicPreview } = preview;
    return publicPreview;
}

module.exports = { EXCEPTION_PAGE_SIZE, scopeIdentity, identityKey, preparedSafePair,
    buildWeeklyHrStage2BulkPreview, publicWeeklyHrStage2BulkPreview };
