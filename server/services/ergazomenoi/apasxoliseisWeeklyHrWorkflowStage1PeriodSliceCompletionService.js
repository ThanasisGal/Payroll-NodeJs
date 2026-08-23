'use strict';

const crypto = require('crypto');
const mongoose = require('mongoose');
const StateModel = require('../../models/apasxoliseisWeeklyHrWorkflowState');
const AuditModel = require('../../models/apasxoliseisWeeklyHrWorkflowAudit');
const { assertCriticalEmploymentDecisionRole } = require(
    './apasxoliseisCriticalActionAuthorizationService'
);
const { resolveWeeklyHrWorkflow } = require('./apasxoliseisWeeklyHrWorkflowResolverService');
const { stableStringify } = require('./apasxoliseisStage3FingerprintService');
const { deriveStage1PeriodSlice, buildStage1PeriodSliceFingerprints,
    findStage1PeriodSlice, periodSliceKey } = require('./apasxoliseisStage1PeriodSliceService');

const ACTION = 'STAGE1_PERIOD_SLICE_COMPLETED';
const WORKFLOW_VERSION = 'weekly-hr-workflow:v1';
const REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9:._-]{7,99}$/;
function fail(code, message, statusCode = 400) {
    throw Object.assign(new Error(message), { code, statusCode });
}
function text(value, max = Infinity) { return String(value ?? '').trim().slice(0, max); }
function actor(value = {}) {
    const role = assertCriticalEmploymentDecisionRole({ userRole: value.role });
    const id = text(value.user_id || value.userId, 50); const name = text(value.user_name, 150);
    if (!mongoose.isValidObjectId(id) || !name) fail('INVALID_STAGE1_ACTOR', 'Μη έγκυρα στοιχεία χρήστη.');
    return { user_id: new mongoose.Types.ObjectId(id), user_name: name, role };
}
function identity({ scope, slice, fingerprint, contextFingerprint, performedBy, reason }) {
    return crypto.createHash('sha256').update(stableStringify({ action: ACTION,
        scope: { team: scope.team, company_kod: scope.company_kod,
            ypokatasthma: scope.ypokatasthma, employee_id: String(scope.employee_id),
            week_start: String(scope.week_start), week_end: String(scope.week_end) },
        period_slice: slice, context_fingerprint: contextFingerprint,
        completion_fingerprint: fingerprint,
        actor: { id: String(performedBy.user_id), name: performedBy.user_name,
            role: performedBy.role }, reason })).digest('hex');
}
function queryLean(query, session) {
    const value = session && query?.session ? query.session(session) : query;
    return value?.lean ? value.lean() : value;
}

async function completeWeeklyHrStage1PeriodSlice({ scope, period_start, period_end,
    weekRows = [], effectiveProfile = {}, effectiveProfilesByDate = {}, actor: rawActor,
    employment_date_scope = null,
    reason_or_notes, request_id, loadFreshWeekRows, transactionRunner,
    stateModel = StateModel, auditModel = AuditModel, now = () => new Date() } = {}) {
    const performedBy = actor(rawActor); const reason = text(reason_or_notes, 2001);
    if (!reason || reason.length > 2000) fail('STAGE1_REASON_REQUIRED', 'Η αιτιολογία είναι υποχρεωτική.');
    const requestId = text(request_id, 101);
    if (!REQUEST_ID_PATTERN.test(requestId)) fail('INVALID_REQUEST_ID', 'Μη έγκυρο request_id.');
    if (typeof loadFreshWeekRows !== 'function' || typeof transactionRunner !== 'function') {
        fail('STAGE1_SAFE_COMMAND_UNAVAILABLE', 'Δεν είναι διαθέσιμη η ασφαλής εντολή.', 503);
    }
    const slice = deriveStage1PeriodSlice({ weekRows, week_start: scope.week_start,
        week_end: scope.week_end, period_start, period_end,
        employment_date_scope });
    const initial = buildStage1PeriodSliceFingerprints({ weekRows, slice });
    const commandIdentity = identity({ scope, slice, fingerprint: initial.completion_fingerprint,
        contextFingerprint: initial.context_fingerprint, performedBy, reason });
    return transactionRunner(async (transactionValue) => {
        const session = transactionValue?.session || transactionValue;
        const prior = await queryLean(auditModel.findOne({ team: scope.team,
            company_kod: scope.company_kod, request_id: requestId }), session);
        if (prior) {
            if (prior.command_identity !== commandIdentity) fail('STAGE1_REQUEST_ID_CONFLICT',
                'Το request_id έχει χρησιμοποιηθεί για διαφορετική εντολή.', 409);
            return { completed: true, idempotent: true,
                fingerprint: prior.slice_completion_fingerprint,
                slice_version: prior.after_stage.version };
        }
        const freshRows = await loadFreshWeekRows({ scope, session });
        const freshSlice = deriveStage1PeriodSlice({ weekRows: freshRows,
            week_start: scope.week_start, week_end: scope.week_end, period_start, period_end,
            employment_date_scope });
        const fresh = buildStage1PeriodSliceFingerprints({ weekRows: freshRows, slice: freshSlice });
        if (fresh.context_fingerprint !== initial.context_fingerprint ||
            fresh.completion_fingerprint !== initial.completion_fingerprint ||
            periodSliceKey(freshSlice) !== periodSliceKey(slice)) fail('STAGE1_INPUT_CHANGED',
            'Τα δεδομένα του τμήματος περιόδου άλλαξαν πριν από την ολοκλήρωση.', 409);
        const workflow = resolveWeeklyHrWorkflow({ weekRows: freshRows, effectiveProfile,
            effectiveProfilesByDate, leave_classification_completed: false,
            expected_date_keys: employment_date_scope?.employment_owned_dates || null });
        if ((workflow.blocking_reasons || []).length) fail('STAGE1_COMPLETION_BLOCKED',
            'Υπάρχει πραγματικό εμπόδιο Σταδίου 1.', 409);
        const stateFilter = { team: scope.team, company_kod: scope.company_kod,
            ypokatasthma: scope.ypokatasthma, employee_id: scope.employee_id,
            week_start: scope.week_start, week_end: scope.week_end };
        const current = await queryLean(stateModel.findOne(stateFilter), session);
        const currentStage1 = current?.stage1 || { status: 'OPEN', completion_fingerprint: '',
            effective_fingerprint: '', version: 1 };
        const previous = findStage1PeriodSlice(currentStage1, period_start, period_end);
        if (previous?.status === 'COMPLETED' && previous.context_fingerprint === fresh.context_fingerprint &&
            String(previous.effective_fingerprint || previous.completion_fingerprint) ===
                fresh.completion_fingerprint) return { completed: true, idempotent: true,
            fingerprint: fresh.completion_fingerprint, slice_version: previous.version };
        const performedAt = now(); const previousVersion = Number(previous?.version || 0);
        const nextSlice = { period_start: new Date(`${slice.period_start}T00:00:00.000Z`),
            period_end: new Date(`${slice.period_end}T00:00:00.000Z`),
            actionable_dates: slice.actionable_dates.map((item) => new Date(`${item}T00:00:00.000Z`)),
            context_only_dates: slice.context_only_dates.map((item) => new Date(`${item}T00:00:00.000Z`)),
            status: 'COMPLETED', context_fingerprint: fresh.context_fingerprint,
            completion_fingerprint: fresh.completion_fingerprint,
            effective_fingerprint: fresh.completion_fingerprint,
            completed_at: performedAt, completed_by_user_id: performedBy.user_id,
            completed_by_user_name: performedBy.user_name,
            completed_by_user_role: performedBy.role, reason_or_notes: reason,
            version: previousVersion + 1 };
        const slices = (currentStage1.period_slices || []).filter((item) =>
            periodSliceKey(item) !== periodSliceKey(slice));
        slices.push(nextSlice);
        const nextStage1 = { ...currentStage1, period_slices: slices,
            version: Number(currentStage1.version || 1) + (current ? 1 : 0) };
        if (!current) {
            await stateModel.create([{ ...stateFilter, employee_kodikos: scope.employee_kodikos,
                workflow_version: WORKFLOW_VERSION, stage1: nextStage1 }], { session });
        } else {
            const updated = await stateModel.updateOne({ ...stateFilter,
                'stage1.version': Number(currentStage1.version || 1) },
            { $set: { stage1: nextStage1 } }, { session });
            if (Number(updated?.matchedCount ?? updated?.n ?? 0) !== 1) fail('STAGE1_VERSION_CONFLICT',
                'Η έκδοση του Σταδίου 1 άλλαξε πριν από την αποθήκευση.', 409);
        }
        const before = { status: previous?.status || 'OPEN',
            completion_fingerprint: String(previous?.completion_fingerprint || ''),
            version: previousVersion };
        const after = { status: 'COMPLETED',
            completion_fingerprint: fresh.completion_fingerprint, version: nextSlice.version };
        await auditModel.create([{ ...scope, workflow_version: WORKFLOW_VERSION,
            stage: 'STAGE1', action: ACTION, stage_version: nextSlice.version,
            input_fingerprint: fresh.completion_fingerprint,
            previous_completion_fingerprint: before.completion_fingerprint,
            new_completion_fingerprint: '', before_stage: before, after_stage: after,
            performed_at: performedAt, performed_by_user_id: performedBy.user_id,
            performed_by_user_name: performedBy.user_name,
            performed_by_user_role: performedBy.role, reason_or_notes: reason,
            request_id: requestId, command_identity: commandIdentity,
            period_start: nextSlice.period_start, period_end: nextSlice.period_end,
            actionable_dates: nextSlice.actionable_dates,
            context_only_dates: nextSlice.context_only_dates,
            context_fingerprint: fresh.context_fingerprint,
            slice_completion_fingerprint: fresh.completion_fingerprint,
            slice_effective_fingerprint: fresh.completion_fingerprint,
            previous_slice_version: previousVersion,
            new_slice_version: nextSlice.version }], { session });
        return { completed: true, idempotent: false,
            fingerprint: fresh.completion_fingerprint, slice_version: nextSlice.version };
    });
}

module.exports = { ACTION, completeWeeklyHrStage1PeriodSlice };
