'use strict';

const crypto = require('crypto');
const mongoose = require('mongoose');
const AuditModel = require('../../models/apasxoliseisWeeklyHrWorkflowAudit');
const { stableStringify, buildStage3InputFingerprint } = require(
    './apasxoliseisStage3FingerprintService'
);
const { assertCriticalEmploymentDecisionRole } = require(
    './apasxoliseisCriticalActionAuthorizationService'
);
const { normalizeStage3BulkPreviewCommand,
    buildWeeklyHrStage3BulkPreview } = require('./apasxoliseisWeeklyHrStage3BulkPreviewService');

const APPLY_FIELDS = new Set([
    'ypokatasthma', 'period_start', 'period_end', 'final_classification', 'leave_category',
    'items', 'bulk_request_id', 'expected_preview_fingerprint', 'reason_or_notes'
]);
const REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9:._-]{7,99}$/;

function fail(code, message, statusCode = 400, details = {}) {
    throw Object.assign(new Error(message), { code, statusCode, ...details });
}
function text(value) { return String(value ?? '').trim(); }
function normalizeActor(rawActor = {}) {
    const role = assertCriticalEmploymentDecisionRole({ userRole: rawActor.role });
    const actorId = text(rawActor.user_id || rawActor.userId);
    if (!mongoose.isValidObjectId(actorId)) fail('INVALID_STAGE3_ACTOR',
        'Μη έγκυρα στοιχεία χρήστη.');
    const actor = { user_id: new mongoose.Types.ObjectId(actorId),
        user_name: text(rawActor.user_name || rawActor.userName), role };
    if (!actor.user_name) fail('INVALID_STAGE3_ACTOR', 'Μη έγκυρα στοιχεία χρήστη.');
    return actor;
}
function normalizeStage3BulkApplyCommand(raw = {}) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) ||
        Object.keys(raw).some((field) => !APPLY_FIELDS.has(field))) {
        fail('STAGE3_BULK_APPLY_FIELDS_NOT_ALLOWED',
            'Το αίτημα μαζικής εφαρμογής Stage 3 περιέχει μη επιτρεπτά πεδία.');
    }
    const preview = normalizeStage3BulkPreviewCommand({ ypokatasthma: raw.ypokatasthma,
        period_start: raw.period_start, period_end: raw.period_end,
        final_classification: raw.final_classification, leave_category: raw.leave_category,
        items: raw.items });
    const malformedItem = preview.items.find((item) => item.input_error);
    if (malformedItem) throw malformedItem.input_error;
    const bulkRequestId = text(raw.bulk_request_id);
    if (!REQUEST_ID_PATTERN.test(bulkRequestId)) fail('INVALID_STAGE3_BULK_REQUEST_ID',
        'Μη έγκυρο bulk_request_id.');
    const expectedPreviewFingerprint = text(raw.expected_preview_fingerprint).toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(expectedPreviewFingerprint)) fail(
        'INVALID_STAGE3_BULK_PREVIEW_FINGERPRINT', 'Μη έγκυρο preview fingerprint.');
    const reason = text(raw.reason_or_notes);
    if (!reason || reason.length > 2000) fail('STAGE3_REASON_REQUIRED',
        'Η αιτιολογία είναι υποχρεωτική και έως 2000 χαρακτήρες.');
    return Object.freeze({ ...preview, bulk_request_id: bulkRequestId,
        expected_preview_fingerprint: expectedPreviewFingerprint, reason_or_notes: reason });
}
function previewCommand(command) {
    return { ypokatasthma: command.ypokatasthma, period_start: command.period_start,
        period_end: command.period_end, final_classification: command.final_classification,
        leave_category: command.leave_category, items: command.items };
}
function semanticCommand(command, requestScope, actor = {}) {
    return { contract: 'weekly-hr-stage3-bulk-apply:v1',
        scope: { team: text(requestScope.team), company_kod: text(requestScope.company_kod),
            ypokatasthma: command.ypokatasthma, period_start: command.period_start,
            period_end: command.period_end }, final_classification: command.final_classification,
        leave_category: command.leave_category, reason_or_notes: command.reason_or_notes,
        actor: { id: text(actor.user_id || actor.userId), name: text(actor.user_name || actor.userName),
            role: text(actor.role) }, items: command.items.map((item) => ({
            employee_id: item.employee_id, week_start: item.week_start,
            week_end: item.week_end, row_id: item.row_id, decision_date: item.decision_date,
            expected_input_fingerprint: item.expected_input_fingerprint,
            expected_stage3_version: item.expected_stage3_version
        })).sort(compareItems) };
}
function compareItems(a, b) {
    return `${a.employee_id}|${a.week_start}|${a.decision_date}|${a.row_id}`
        .localeCompare(`${b.employee_id}|${b.week_start}|${b.decision_date}|${b.row_id}`);
}
function bulkCommandIdentity(command, requestScope, actor) {
    return crypto.createHash('sha256').update(stableStringify(
        semanticCommand(command, requestScope, actor))).digest('hex');
}
function childRequestId(bulkRequestId, item) {
    const itemMaterial = `${item.employee_id}|${item.week_start}|${item.week_end}|${item.decision_date}|${item.row_id}`;
    return `${bulkRequestPrefix(bulkRequestId)}${crypto.createHash('sha256')
        .update(itemMaterial).digest('hex')}`;
}
function bulkRequestPrefix(bulkRequestId) {
    return `stage3-bulk:${crypto.createHash('sha256').update(bulkRequestId)
        .digest('hex').slice(0, 16)}:`;
}
function childCommandIdentity(batchIdentity, item) {
    return crypto.createHash('sha256').update(stableStringify({
        contract: 'weekly-hr-stage3-bulk-child:v1', batch_identity: batchIdentity,
        employee_id: item.employee_id, week_start: item.week_start, week_end: item.week_end,
        decision_date: item.decision_date, row_id: item.row_id
    })).digest('hex');
}
async function lean(query, session) {
    const scoped = session && query?.session ? query.session(session) : query;
    return scoped?.lean ? scoped.lean() : scoped;
}
function invalidBatch(preview) {
    fail('STAGE3_BULK_VALIDATION_FAILED',
        'Ορισμένες επιλεγμένες εγγραφές χρειάζονται νέο έλεγχο.', 409,
        { applied_count: 0, invalid_items: preview.invalid_items || [] });
}
function expectedChildrenFor(command, requestScope, actor) {
    const ordered = [...command.items].sort(compareItems);
    const batchIdentity = bulkCommandIdentity(command, requestScope, actor);
    return ordered.map((item) => ({ item,
        request_id: childRequestId(command.bulk_request_id, item),
        command_identity: childCommandIdentity(batchIdentity, item) }));
}
function idempotentResult(expectedChildren, prior) {
    if (!prior.length) return null;
    if (prior.length !== expectedChildren.length) fail('STAGE3_BULK_PARTIAL_IDEMPOTENCY_CONFLICT',
        'Βρέθηκε ασυνεπής προηγούμενη μαζική εντολή Stage 3.', 409,
        { applied_count: 0 });
    const byRequest = new Map(prior.map((audit) => [audit.request_id, audit]));
    if (expectedChildren.some((entry) =>
        byRequest.get(entry.request_id)?.command_identity !== entry.command_identity)) {
        fail('STAGE3_BULK_REQUEST_ID_CONFLICT',
            'Το bulk_request_id έχει χρησιμοποιηθεί για διαφορετική εντολή.', 409,
            { applied_count: 0 });
    }
    return { applied_count: expectedChildren.length,
        employee_count: new Set(expectedChildren.map(({ item }) => item.employee_id)).size,
        completed_week_count: prior.filter((audit) =>
            audit.after_stage?.status === 'COMPLETED').length,
        remaining_stage3_count: 0, idempotent: true,
        results: expectedChildren.map(({ item, request_id }) => {
            const audit = byRequest.get(request_id);
            return { row_id: item.row_id, decision_date: item.decision_date,
                status: 'ALREADY_APPLIED', stage3_version: audit.stage_version };
        }) };
}
async function inspectStage3BulkIdempotency({ command: rawCommand, requestScope = {},
    actor: rawActor, auditModel = AuditModel, session = null } = {}) {
    const command = normalizeStage3BulkApplyCommand(rawCommand);
    const actor = normalizeActor(rawActor);
    const expectedChildren = expectedChildrenFor(command, requestScope, actor);
    const prior = await lean(auditModel.find({ team: requestScope.team,
        company_kod: requestScope.company_kod,
        request_id: { $regex: `^${bulkRequestPrefix(command.bulk_request_id)}` } }), session) || [];
    return idempotentResult(expectedChildren, prior);
}
async function applyWeeklyHrStage3Bulk({ command: rawCommand, requestScope = {}, actor: rawActor,
    runAtomic, loadAuthoritativeContext, resolveOne, auditModel = AuditModel } = {}) {
    const command = normalizeStage3BulkApplyCommand(rawCommand);
    const actor = normalizeActor(rawActor);
    if (typeof runAtomic !== 'function' || typeof loadAuthoritativeContext !== 'function' ||
        typeof resolveOne !== 'function') fail('STAGE3_BULK_SAFE_COMMAND_UNAVAILABLE',
        'Δεν είναι διαθέσιμη η ασφαλής μαζική εφαρμογή Stage 3.', 503);
    const ordered = [...command.items].sort(compareItems);
    return runAtomic(async (envelope) => {
        const session = envelope?.session || envelope;
        const expectedChildren = expectedChildrenFor(command, requestScope, actor);
        const priorResult = await inspectStage3BulkIdempotency({ command, requestScope,
            actor, auditModel, session });
        if (priorResult) return priorResult;
        const preview = await buildWeeklyHrStage3BulkPreview({ command: previewCommand(command),
            requestScope, loadAuthoritativeContext: (item) =>
                loadAuthoritativeContext(item, command, { session }) });
        if (!preview.can_apply) invalidBatch(preview);
        if (preview.preview_fingerprint !== command.expected_preview_fingerprint) {
            fail('STAGE3_BULK_PREVIEW_STALE',
                'Τα στοιχεία άλλαξαν μετά την προεπισκόπηση. Κάντε νέα προεπισκόπηση.', 409,
                { applied_count: 0, invalid_items: [] });
        }

        const results = []; const finalWeeks = new Map();
        for (const entry of expectedChildren) {
            const current = await loadAuthoritativeContext(entry.item, command, { session });
            const result = await resolveOne({ item: entry.item, command, current, actor,
                request_id: entry.request_id, command_identity: entry.command_identity,
                expected_input_fingerprint: buildStage3InputFingerprint(current).fingerprint,
                expected_stage3_version: Number(current.upstream?.stage3_version || 0),
                envelope });
            const weekKey = `${entry.item.employee_id}|${entry.item.week_start}|${entry.item.week_end}`;
            finalWeeks.set(weekKey, result);
            results.push({ row_id: entry.item.row_id, decision_date: entry.item.decision_date,
                status: 'APPLIED', stage3_version: result.stage3_version });
        }
        return { applied_count: results.length,
            employee_count: new Set(ordered.map((item) => item.employee_id)).size,
            completed_week_count: [...finalWeeks.values()].filter((result) =>
                result.stage3_status === 'COMPLETED').length,
            remaining_stage3_count: [...finalWeeks.values()].reduce((sum, result) =>
                sum + Number(result.remaining_count || 0), 0), idempotent: false, results };
    });
}

module.exports = { APPLY_FIELDS, normalizeStage3BulkApplyCommand, previewCommand, compareItems,
    bulkCommandIdentity, bulkRequestPrefix, childRequestId, childCommandIdentity,
    inspectStage3BulkIdempotency, applyWeeklyHrStage3Bulk };
