'use strict';

const mongoose = require('mongoose');
const crypto = require('crypto');
const PeriodControlModel = require('../../models/apasxoliseisPeriodControl');
const FrozenModel = require('../../models/apasxoliseisPeriodFrozenSnapshot');
const CorrectiveModel = require('../../models/apasxoliseisPeriodCorrectiveCase');
const LifecycleAuditModel = require('../../models/apasxoliseisPeriodLifecycleAudit');
const { assertCriticalEmploymentDecisionRole } = require('./apasxoliseisCriticalActionAuthorizationService');
const { normalizeScope, calculatePeriodDeadline, isPastDeadline, periodError } = require('./apasxoliseisPeriodControlService');
const { buildEmploymentPeriodFrozenSnapshot } = require('./apasxoliseisPeriodFrozenSnapshotService');
const { buildCorrectiveDelta, correctionSubmissionCapability,
    normalizeCorrectionCommands, reconstructCorrectedHistoricalResult } = require('./apasxoliseisPeriodCorrectiveService');
const { assertPeriodLifecycleIndexesReady } = require('./apasxoliseisPeriodLifecycleIndexGuardService');

function actor(session = {}) {
    const role = assertCriticalEmploymentDecisionRole(session); const id = String(session.userId || '').trim();
    if (!mongoose.isValidObjectId(id)) throw periodError('NOT_AUTHORIZED', 403, 'Μη έγκυρη ενεργή συνεδρία.');
    return { user_id: id, user_name: String(session.userName || session.username || id).trim(), role };
}
function requiredText(value, code, message) { const clean = String(value || '').trim(); if (!clean) throw periodError(code, 400, message); return clean; }
async function transaction(work) { const session = await mongoose.startSession(); try { let result;
    await session.withTransaction(async () => { result = await work(session); }); return result; } finally { await session.endSession(); } }
function athensDateKey(value) {
    const date = new Date(value); if (Number.isNaN(date.getTime())) throw periodError('INVALID_SUBMISSION_DATE', 409, 'Μη έγκυρη ημερομηνία υποβολής.');
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Athens', year: 'numeric', month: '2-digit', day: '2-digit' })
        .formatToParts(date).reduce((out, part) => { if (part.type !== 'literal') out[part.type] = part.value; return out; }, {});
    return `${parts.year}-${parts.month}-${parts.day}`;
}
function submissionTimeliness({ submittedAt, deadline }) { return athensDateKey(submittedAt) <= String(deadline).slice(0, 10) ? 'TIMELY' : 'LATE'; }
function authoritativeSubmissionPeriod(submission = {}) {
    const payload = submission.request_payload || {};
    const start = submission.employment_period_start || payload.period_start || payload.apo_hmeromhnia || payload.date_from;
    const end = submission.employment_period_end || payload.period_end || payload.eos_hmeromhnia || payload.date_to;
    const key = (value) => { if (!value) return ''; if (/^\d{4}-\d{2}-\d{2}/.test(String(value))) return String(value).slice(0, 10);
        const date = new Date(value); return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10); };
    return start && end ? { start: key(start), end: key(end) } : null;
}

async function finalizeEmploymentPeriod({ session: userSession, scope: input, reason, requestId, snapshotInput, now = new Date(),
    periodControlModel = PeriodControlModel, frozenModel = FrozenModel, auditModel = LifecycleAuditModel,
    indexGuard = assertPeriodLifecycleIndexesReady, transactionRunner = transaction }) {
    const scope = normalizeScope(input); const by = actor(userSession); const cleanReason = requiredText(reason,
        'PERIOD_FINALIZE_REASON_REQUIRED', 'Απαιτείται αιτιολογία οριστικοποίησης.');
    const cleanRequestId = requiredText(requestId, 'INVALID_PERIOD_FINALIZE_REQUEST_ID', 'Μη έγκυρο αναγνωριστικό αιτήματος.');
    if (typeof indexGuard === 'function') await indexGuard();
    const built = buildEmploymentPeriodFrozenSnapshot({ ...snapshotInput, scope });
    return transactionRunner(async (dbSession) => {
        const existing = await frozenModel.findOne({ team: scope.team, company_kod: scope.company_kod, request_id: cleanRequestId }).session(dbSession).lean();
        if (existing) return { idempotent: true, snapshot: existing };
        const control = await periodControlModel.findOne({ ...scope }).session(dbSession).lean();
        if (!control || control.status !== 'LOCKED') throw periodError('PERIOD_FINALIZE_REQUIRES_LOCKED', 409, 'Η περίοδος πρέπει πρώτα να κλειδωθεί.');
        if (control.active_calculation_id) throw periodError('PERIOD_CONTROL_CALCULATION_IN_PROGRESS', 409, 'Δεν είναι δυνατή η οριστικοποίηση όσο εκτελείται Υπολογισμός Απασχολήσεων.');
        if (control.frozen_snapshot_id) throw periodError('PERIOD_ALREADY_FINALIZED', 409, 'Η περίοδος έχει ήδη οριστικοποιηθεί.');
        const documents = await frozenModel.create([{ ...scope, ...built, frozen_snapshot: built.snapshot,
            finalized_at: now, finalized_by_user_id: by.user_id, finalized_by_user_name: by.user_name,
            finalized_by_user_role: by.role, finalize_reason: cleanReason, request_id: cleanRequestId, created_at: now }], { session: dbSession });
        const frozen = documents[0];
        const updated = await periodControlModel.findOneAndUpdate({ ...scope, status: 'LOCKED', version: control.version,
            active_calculation_id: { $in: ['', null] }, frozen_snapshot_id: null }, { $set: {
            status: 'FINALIZED', frozen_snapshot_id: frozen._id,
            frozen_snapshot_fingerprint: built.frozen_snapshot_fingerprint, finalized_at: now,
            finalized_by_user_id: by.user_id, finalized_by_user_name: by.user_name,
            finalized_by_user_role: by.role, finalize_reason: cleanReason, updated_at: now,
            version: Number(control.version) + 1
        } }, { new: true, runValidators: true, session: dbSession });
        if (!updated) throw periodError('PERIOD_CONTROL_STATE_CONFLICT', 409, 'Η κατάσταση της περιόδου άλλαξε.');
        await auditModel.create([{ ...scope, event_type: 'FINALIZE', actor_user_id: by.user_id,
            actor_user_name: by.user_name, actor_user_role: by.role, reason: cleanReason,
            reference_id: String(frozen._id), details: { fingerprint: built.frozen_snapshot_fingerprint }, occurred_at: now }], { session: dbSession });
        return { idempotent: false, snapshot: frozen, control: updated };
    });
}

async function linkEmploymentPeriodSubmission({ session: userSession, scope: input, reason, submissionId, now = new Date(),
    submissionModel, periodControlModel = PeriodControlModel, auditModel = LifecycleAuditModel,
    transactionRunner = transaction }) {
    const scope = normalizeScope(input); const by = actor(userSession); const cleanReason = requiredText(reason,
        'PERIOD_SUBMISSION_REASON_REQUIRED', 'Απαιτείται αιτιολογία σύνδεσης υποβολής.');
    if (!mongoose.isValidObjectId(String(submissionId || ''))) throw periodError('INVALID_SUBMISSION_REFERENCE', 400, 'Μη έγκυρη αναφορά υποβολής.');
    const submission = await submissionModel.findOne({ _id: submissionId, team: scope.team,
        companykod_object: scope.company_kod, ypokatasthma_kodikos: scope.ypokatasthma,
        employment_period_start: scope.period_start, employment_period_end: scope.period_end,
        submission_code: 'WTODayilyA', submission_id: { $type: 'number', $gt: 0 },
        submission_status: 'SUCCESS', is_final: true, document_status: 'ACTIVE' }).lean();
    if (!submission?.submit_date || !submission?.protocol) throw periodError('SUBMISSION_NOT_AUTHORITATIVE', 409, 'Η υποβολή δεν διαθέτει έγκυρη ημερομηνία και πρωτόκολλο.');
    const submissionPeriod = authoritativeSubmissionPeriod(submission);
    if (!submissionPeriod || submissionPeriod.start !== scope.period_start.toISOString().slice(0, 10) ||
        submissionPeriod.end !== scope.period_end.toISOString().slice(0, 10)) {
        throw periodError('SUBMISSION_PERIOD_SCOPE_MISMATCH', 409, 'Η υποβολή δεν ανήκει στην ενεργή περίοδο.');
    }
    const timeliness = submissionTimeliness({ submittedAt: submission.submit_date, deadline: calculatePeriodDeadline(scope.period_end) });
    return transactionRunner(async (dbSession) => {
        const updated = await periodControlModel.findOneAndUpdate({ ...scope, status: 'FINALIZED' }, { $set: {
            submitted_at: submission.submit_date, submission_reference: submission._id,
            submission_protocol: submission.protocol, submission_status: submission.submission_status,
            submission_timeliness: timeliness, updated_at: now
        } }, { new: true, session: dbSession });
        if (!updated) throw periodError('PERIOD_NOT_FINALIZED', 409, 'Η περίοδος δεν είναι οριστικοποιημένη.');
        await auditModel.create([{ ...scope, event_type: 'SUBMISSION_LINK', actor_user_id: by.user_id,
            actor_user_name: by.user_name, actor_user_role: by.role, reason: cleanReason,
            reference_id: String(submission._id), details: { protocol: submission.protocol, timeliness }, occurred_at: now }], { session: dbSession });
        return updated;
    });
}

async function openCorrectiveCase({ session: userSession, scope: input, reason, caseId = crypto.randomUUID(), now = new Date(),
    periodControlModel = PeriodControlModel, correctiveModel = CorrectiveModel, auditModel = LifecycleAuditModel,
    indexGuard = assertPeriodLifecycleIndexesReady, transactionRunner = transaction }) {
    const scope = normalizeScope(input); const by = actor(userSession); const cleanReason = requiredText(reason,
        'CORRECTIVE_REASON_REQUIRED', 'Απαιτείται αιτιολογία διορθωτικής μισθοδοσίας.');
    if (typeof indexGuard === 'function') await indexGuard();
    return transactionRunner(async (dbSession) => {
        const control = await periodControlModel.findOne({ ...scope, status: 'FINALIZED' }).session(dbSession).lean();
        if (!control?.frozen_snapshot_id || !control?.frozen_snapshot_fingerprint) throw periodError('CORRECTIVE_BASELINE_REQUIRED', 409, 'Δεν υπάρχει οριστικοποιημένο ιστορικό αποτέλεσμα.');
        try {
            const documents = await correctiveModel.create([{ ...scope, case_id: caseId, reason: cleanReason,
                opened_at: now, opened_by_user_id: by.user_id, opened_by_user_name: by.user_name,
                opened_by_user_role: by.role, baseline_fingerprint: control.frozen_snapshot_fingerprint,
                baseline_snapshot_reference: control.frozen_snapshot_id, status: 'ACTIVE', created_at: now, updated_at: now }], { session: dbSession });
            await auditModel.create([{ ...scope, event_type: 'CORRECTIVE_OPEN', actor_user_id: by.user_id,
                actor_user_name: by.user_name, actor_user_role: by.role, reason: cleanReason,
                reference_id: caseId, details: { baseline_fingerprint: control.frozen_snapshot_fingerprint }, occurred_at: now }], { session: dbSession });
            return documents[0];
        } catch (error) { if (error?.code === 11000) throw periodError('CORRECTIVE_CASE_ALREADY_ACTIVE', 409, 'Υπάρχει ήδη ενεργή διορθωτική μισθοδοσία.'); throw error; }
    });
}

function buildCorrectiveResult({ baselineSnapshot, correctedRows, correctedContext, correctedDeviations = [],
    requiresNewSubmission, deadline, now = new Date() }) {
    const deltaResult = buildCorrectiveDelta({ baselineRows: baselineSnapshot?.daily_results || [], correctedRows,
        payrollResults: baselineSnapshot?.payroll_results || [] });
    const correctedResult = { daily_results: correctedRows, deviations: correctedDeviations };
    const correctedResultFingerprint = crypto.createHash('sha256').update(JSON.stringify(
        require('./apasxoliseisPeriodFrozenSnapshotService').canonicalize(correctedResult))).digest('hex');
    return Object.freeze({ corrected_context: correctedContext, corrected_result: correctedResult,
        corrective_delta: deltaResult.delta, corrective_delta_fingerprint: deltaResult.fingerprint,
        corrected_result_fingerprint: correctedResultFingerprint,
        ...correctionSubmissionCapability({ requiresNewSubmission, deadline, now, isPastDeadline }) });
}

async function saveCorrectiveResult({ session: userSession, scope: input, caseId, reason,
    corrections, requestId, requiresNewSubmission = false, now = new Date(),
    runAuthoritativeWeek,
    correctiveModel = CorrectiveModel, frozenModel = FrozenModel,
    auditModel = LifecycleAuditModel, transactionRunner = transaction }) {
    const scope = normalizeScope(input); const by = actor(userSession); const cleanReason = requiredText(reason,
        'CORRECTIVE_CALCULATION_REASON_REQUIRED', 'Απαιτείται αιτιολογία διορθωτικού υπολογισμού.');
    const cleanRequestId = requiredText(requestId, 'INVALID_CORRECTIVE_REQUEST_ID', 'Μη έγκυρο αναγνωριστικό διορθωτικού αιτήματος.');
    const normalizedCommands = normalizeCorrectionCommands({ corrections });
    return transactionRunner(async (dbSession) => {
        const correctiveCase = await correctiveModel.findOne({ ...scope, case_id: caseId, status: 'ACTIVE' })
            .session(dbSession).lean();
        if (!correctiveCase) throw periodError('CORRECTIVE_CASE_NOT_ACTIVE', 409, 'Η διορθωτική υπόθεση δεν είναι ενεργή.');
        const baseline = await frozenModel.findOne({ _id: correctiveCase.baseline_snapshot_reference, ...scope,
            frozen_snapshot_fingerprint: correctiveCase.baseline_fingerprint }).session(dbSession).lean();
        if (!baseline?.frozen_snapshot) throw periodError('CORRECTIVE_BASELINE_MISMATCH', 409,
            'Το παγωμένο ιστορικό αποτέλεσμα δεν συμφωνεί με τη διορθωτική υπόθεση.');
        const reconstructed = reconstructCorrectedHistoricalResult({ baselineSnapshot: baseline.frozen_snapshot,
            commands: normalizedCommands, runAuthoritativeWeek });
        const calculationCommandFingerprint = crypto.createHash('sha256').update(JSON.stringify({
            corrections: normalizedCommands, requires_new_submission: requiresNewSubmission === true
        })).digest('hex');
        if (correctiveCase.last_calculation_request_id === cleanRequestId) {
            if (correctiveCase.last_calculation_command_fingerprint !== calculationCommandFingerprint) {
                throw periodError('CORRECTIVE_REQUEST_ID_CONFLICT', 409, 'Το αναγνωριστικό αιτήματος έχει χρησιμοποιηθεί για διαφορετική διόρθωση.');
            }
            return { record: correctiveCase, idempotent: true };
        }
        const built = buildCorrectiveResult({ baselineSnapshot: baseline.frozen_snapshot,
            correctedRows: reconstructed.correctedRows, correctedContext: reconstructed.correctedContext,
            correctedDeviations: reconstructed.correctedDeviations,
            requiresNewSubmission, deadline: calculatePeriodDeadline(scope.period_end), now });
        const updated = await correctiveModel.findOneAndUpdate({ ...scope, case_id: caseId, status: 'ACTIVE',
            result_version: Number(correctiveCase.result_version || 0) },
            { $set: { ...built, calculated_at: now, updated_at: now,
                last_calculation_request_id: cleanRequestId,
                last_calculation_command_fingerprint: calculationCommandFingerprint },
            $inc: { result_version: 1 } }, { new: true, session: dbSession });
        if (!updated) throw periodError('CORRECTIVE_CALCULATION_CONFLICT', 409, 'Η διορθωτική υπόθεση άλλαξε ταυτόχρονα.');
        await auditModel.create([{ ...scope, event_type: 'CORRECTIVE_CALCULATION', actor_user_id: by.user_id,
            actor_user_name: by.user_name, actor_user_role: by.role, reason: cleanReason, reference_id: caseId,
            details: { corrected_result_fingerprint: built.corrected_result_fingerprint }, occurred_at: now },
        { ...scope, event_type: 'SUBMISSION_NEEDED_DETERMINATION', actor_user_id: by.user_id,
            actor_user_name: by.user_name, actor_user_role: by.role, reason: cleanReason, reference_id: caseId,
            details: { requires_new_submission: built.requires_new_submission,
                can_submit_correction: built.can_submit_correction }, occurred_at: now }], { session: dbSession });
        return { record: updated, idempotent: false };
    });
}

async function closeCorrectiveCase({ session: userSession, scope: input, caseId, reason, now = new Date(),
    correctiveModel = CorrectiveModel, auditModel = LifecycleAuditModel, transactionRunner = transaction }) {
    const scope = normalizeScope(input); const by = actor(userSession); const cleanReason = requiredText(reason,
        'CORRECTIVE_CLOSE_REASON_REQUIRED', 'Απαιτείται αιτιολογία κλεισίματος διορθωτικής υπόθεσης.');
    return transactionRunner(async (dbSession) => {
        const current = await correctiveModel.findOne({ ...scope, case_id: caseId, status: 'ACTIVE' }).session(dbSession).lean();
        if (!current?.corrected_result_fingerprint || !current?.corrective_delta_fingerprint || !current?.corrective_delta) throw periodError(
            'CORRECTIVE_CASE_NOT_CLOSABLE', 409, 'Η διορθωτική υπόθεση δεν διαθέτει αποθηκευμένο αποτέλεσμα.');
        const updated = await correctiveModel.findOneAndUpdate({ ...scope, case_id: caseId, status: 'ACTIVE',
            result_version: current.result_version, corrected_result_fingerprint: current.corrected_result_fingerprint }, { $set: { status: 'CLOSED', closed_at: now,
            closed_by_user_id: by.user_id, updated_at: now } }, { new: true, session: dbSession });
        if (!updated) throw periodError('CORRECTIVE_CASE_NOT_CLOSABLE', 409, 'Η διορθωτική υπόθεση δεν μπορεί να κλείσει.');
        await auditModel.create([{ ...scope, event_type: 'CORRECTIVE_CLOSE', actor_user_id: by.user_id,
            actor_user_name: by.user_name, actor_user_role: by.role, reason: cleanReason,
            reference_id: caseId, details: {}, occurred_at: now }], { session: dbSession });
        return updated;
    });
}

module.exports = { athensDateKey, submissionTimeliness, authoritativeSubmissionPeriod, finalizeEmploymentPeriod,
    linkEmploymentPeriodSubmission, openCorrectiveCase, buildCorrectiveResult,
    saveCorrectiveResult, closeCorrectiveCase };
