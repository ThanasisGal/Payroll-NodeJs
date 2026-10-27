'use strict';
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const { canonicalize } = require('./apasxoliseisPeriodFrozenSnapshotService');
const { normalizeScope } = require('./apasxoliseisPeriodControlService');
const { assertCriticalEmploymentDecisionRole } = require('./apasxoliseisCriticalActionAuthorizationService');
const { baselineFingerprint, buildRevisionPreview } = require('./wtoDailySubmissionRevisionService');
const { assertWtoDailyPayloadIntervals } = require('./accountingIntervalValidationService');
const { assertWtoDailyControlPayloadParity } = require('./wtoDailySubmissionProjectionService');
const hash = value => crypto.createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
// Canonicalization belongs to fingerprints only: ERGANI validates field order.
const clone = value => JSON.parse(JSON.stringify(value));
function explicitRejection(attempt) {
    const result = attempt?.result;
    if (attempt?.status !== 'REJECTED' || !attempt.completed_at || result?.outcome !== 'REJECTED' ||
        result.protocol || result.id || !result.error) return false;
    if (result.http_status === 400 && result.failure_stage === 'submission' && result.response_received === true) return true;
    // Legacy attempts did not persist HTTP metadata. Accept only the exact
    // stored XSD rejection, mirrored in the original ERGANI response.
    return result.http_status == null && result.raw?.message === result.error &&
        /Το αρχείο δεν είναι έγκυρο βάσει του σχετικού xsd\./.test(result.error) &&
        /The element 'WTO' has invalid child element 'Ergazomenoi'/.test(result.error) &&
        /expected: 'f_aa_pararthmatos'/.test(result.error);
}
async function attemptsFor(store, scope, revisionId, dbSession = null) {
    return store.transmission.find({ ...scope, revision_id: revisionId }).session(dbSession).lean();
}
function latestAttempt(attempts, revisionId) {
    if (!attempts.length) return null;
    let current = attempts.find(item => item._id === revisionId);
    const visited = new Set();
    while (current && !visited.has(current._id)) {
        visited.add(current._id);
        const children = attempts.filter(item => item.previous_attempt_id === current._id);
        if (!children.length) return visited.size === attempts.length ? current : null;
        if (children.length !== 1) return null;
        current = children[0];
    }
    return null;
}
function fail(code, explanation, saved = false) {
    throw Object.assign(new Error(`${explanation} 1. Ελέγξτε την κατάσταση της προηγούμενης απόπειρας στο ΕΡΓΑΝΗ. ` +
        '2. Ζητήστε επιβεβαίωση από τον υπεύθυνο πριν επιχειρήσετε νέα ενέργεια. ' +
        (saved ? 'Η απόπειρα έχει καταγραφεί και δεν θα επαναληφθεί αυτόματα. ' : 'Δεν αποθηκεύτηκε αλλαγή από αυτή την ενέργεια. Δεν στάλθηκε υποβολή. ') +
        `Κωδικός αναφοράς: ${code}.`), { code, statusCode: 409 });
}
function authorize(options) {
    assertCriticalEmploymentDecisionRole(options.session);
    const scope = normalizeScope(options.scope);
    if (!mongoose.isValidObjectId(options.session?.userId) || scope.team !== String(options.session.userTeam) ||
        scope.company_kod !== String(options.session.companyInUse)) fail('WTODAILY_REVISION_SCOPE_FORBIDDEN', 'Η έκδοση δεν ανήκει στην ενεργή εταιρεία.');
    return scope;
}
function storage(options) {
    return { period: options.periodModel || require('../../models/apasxoliseisPeriodControl'),
        frozen: options.frozenModel || require('../../models/apasxoliseisPeriodFrozenSnapshot'),
        revision: options.revisionModel || require('../../models/wtoDailySubmissionRevision'),
        transmission: options.transmissionModel || require('../../models/wtoDailyRevisionTransmission'),
        source: options.submissionModel || require('../../models/ergazomenoi').ErgazomenoiErganhModel };
}
async function transaction(work) {
    const session = await mongoose.startSession();
    try { let result; await session.withTransaction(async () => { result = await work(session); },
        { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } }); return result; }
    finally { await session.endSession(); }
}
async function readApproved({ scope, store, dbSession }) {
    const control = await store.period.findOne(scope).session(dbSession || null).lean();
    if (control?.status !== 'FINALIZED' || control.active_calculation_id) fail('WTODAILY_REVISION_FINALIZED_REQUIRED', 'Η περίοδος δεν έχει διαθέσιμο οριστικοποιημένο αποτέλεσμα.');
    const revision = await store.revision.findOne({ ...scope, baseline_snapshot_id: control.frozen_snapshot_id }).session(dbSession || null).lean();
    if (!revision) return { control, revision: null };
    const document = await store.frozen.findOne({ ...scope, _id: control.frozen_snapshot_id }).session(dbSession || null).lean();
    if (!document || baselineFingerprint(document.frozen_snapshot) !== revision.baseline_fingerprint ||
        hash(document.frozen_snapshot) !== revision.baseline_content_fingerprint) fail('WTODAILY_REVISION_BASELINE_INVALID', 'Το αρχικό αποτέλεσμα δεν συμφωνεί με την εγκεκριμένη έκδοση.');
    const corrections = revision.corrections.filter(row => !row.automatic).map(row => ({
        row_id: row.row_id, date: row.date, intervals: row.confirmed_intervals,
        ...(row.keep_pair === undefined ? {} : { keep_pair: row.keep_pair }), confirmed_actual_hours: row.confirmed_actual_hours }));
    const sourceSubmission = revision.source_submission_id ? await store.source.findOne({ _id: revision.source_submission_id,
        team: scope.team, companykod_object: scope.company_kod }).session(dbSession || null).lean() : null;
    const rebuilt = buildRevisionPreview({ scope, control, document, command: { reason: revision.reason, corrections, ...(revision.source_submission_id ? { source_submission_id: String(revision.source_submission_id) } : {}) }, sourceSubmission,
        session: { userId: revision.approval.user_id } });
    if (rebuilt.preview_fingerprint !== revision.preview_fingerprint || hash(rebuilt.payload) !== hash(revision.payload) ||
        hash(rebuilt.control_report) !== hash(revision.control_report)) fail('WTODAILY_REVISION_INTEGRITY_FAILED', 'Οι εγκεκριμένες ώρες δεν επιβεβαιώθηκαν.');
    assertWtoDailyPayloadIntervals(revision.payload);
    assertWtoDailyControlPayloadParity(revision.control_report.canonicalRows, revision.payload);
    return { control, revision, document };
}
async function currentApprovedRevision(options) {
    const scope = authorize(options); const store = storage(options);
    const result = await readApproved({ scope, store });
    const attempts = result.revision ? await attemptsFor(store, scope, result.revision._id) : [];
    const transmission = result.revision ? latestAttempt(attempts, result.revision._id) || attempts[0] || null : null;
    const retryAllowed = Boolean(transmission && latestAttempt(attempts, result.revision._id) &&
        attempts.every(explicitRejection));
    const previous = !result.revision ? await store.source.findOne({ team: scope.team, companykod_object: scope.company_kod,
        ypokatasthma_kodikos: scope.ypokatasthma, employment_period_start: scope.period_start,
        employment_period_end: scope.period_end, submission_code: 'WTODailyA', environment: process.env.ERGANI_ENV || 'trial', submission_status: 'FAILED'
    }).sort({ createdAt: -1 }).lean() : null;
    return { revision: result.revision, transmission, retry_allowed: retryAllowed, send_enabled: options.releaseEnabled === true,
        ...(previous ? { failed_source: { source_submission_id: String(previous._id),
            submission_outcome: previous.reconciliation_required === true ? 'UNKNOWN' : 'REJECTED' } } : {}) };
}
async function submitApprovedRevision(options) {
    const scope = authorize(options); const command = options.command || {}; const store = storage(options);
    const allowed = ['ypokatasthma', 'revision_id', 'expected_preview_fingerprint', 'request_id', 'approve_submission',
        'previous_attempt_not_accepted', 'previous_attempt_evidence', 'reviewed_entire_payload', 'boundary_reviewed', 'previous_attempt_id'];
    if (Object.keys(command).some(key => !allowed.includes(key)) || !/^[a-f0-9]{64}$/.test(command.revision_id || '') ||
        !/^[a-f0-9]{64}$/.test(command.expected_preview_fingerprint || '') ||
        command.previous_attempt_id !== undefined && !/^[a-f0-9]{64}$/.test(command.previous_attempt_id) ||
        command.approve_submission !== true || command.previous_attempt_not_accepted !== true ||
        command.reviewed_entire_payload !== true || command.boundary_reviewed !== true ||
        !String(command.previous_attempt_evidence || '').trim() || String(command.previous_attempt_evidence).length > 2000 ||
        !String(command.request_id || '').trim() || String(command.request_id).length > 200) {
        fail('WTODAILY_REVISION_SUBMISSION_APPROVAL_REQUIRED', 'Απαιτούνται χωριστή έγκριση αποστολής, έλεγχος όλης της περιόδου και επιβεβαίωση ότι η προηγούμενη απόπειρα δεν έγινε δεκτή.');
    }
    if (options.releaseEnabled !== true) fail('WTODAILY_REVISION_SUBMISSION_DISABLED', 'Η πραγματική αποστολή δεν έχει εξουσιοδοτηθεί μετά τους υποχρεωτικούς ελέγχους.');
    if (typeof options.preflight !== 'function' || typeof options.send !== 'function' || typeof options.recordSuccess !== 'function') {
        fail('WTODAILY_REVISION_SUBMISSION_UNAVAILABLE', 'Η ασφαλής διαδικασία αποστολής δεν είναι διαθέσιμη.');
    }
    try { const indexes = await store.transmission.collection.indexes();
        if (!indexes.some(index => index.name === '_id_' && index.key?._id === 1)) throw new Error('missing collection');
    } catch { fail('WTODAILY_REVISION_TRANSMISSION_STORAGE_NOT_READY', 'Η ασφαλής καταγραφή αποστολής δεν είναι διαθέσιμη.'); }
    const run = options.transactionRunner || transaction;
    let claim;
    try { claim = await run(async dbSession => {
        const approved = await readApproved({ scope, store, dbSession });
        const revision = approved.revision;
        if (!revision || revision._id !== command.revision_id || revision.preview_fingerprint !== command.expected_preview_fingerprint) {
            fail('WTODAILY_REVISION_PREVIEW_STALE', 'Η επιλεγμένη έκδοση διαφέρει από την εγκεκριμένη προεπισκόπηση.');
        }
        const attempts = await attemptsFor(store, scope, revision._id, dbSession);
        const existing = latestAttempt(attempts, revision._id);
        if (existing?.status === 'SUCCESS') return { existing };
        if (attempts.length && (!existing || !attempts.every(explicitRejection) ||
            command.previous_attempt_id !== existing._id || attempts.some(item => item.request_id === command.request_id) ||
            attempts.some(item => item.payload_fingerprint !== hash(revision.payload)))) {
            fail('WTODAILY_REVISION_ATTEMPT_BLOCKED', 'Η προηγούμενη απόπειρα δεν επιτρέπει αυτή τη νέα αποστολή. Απαιτείται τεκμηριωμένη απόρριψη και χωριστή έγκριση.', true);
        }
        if (!attempts.length && command.previous_attempt_id) fail('WTODAILY_REVISION_ATTEMPT_BLOCKED', 'Η προηγούμενη απόπειρα δεν επιβεβαιώθηκε.');
        const accepted = await store.source.findOne({ team: scope.team, companykod_object: scope.company_kod,
            ypokatasthma_kodikos: scope.ypokatasthma, employment_period_start: scope.period_start,
            employment_period_end: scope.period_end, submission_code: 'WTODailyA', submission_status: 'SUCCESS',
            is_final: true, document_status: 'ACTIVE' }).session(dbSession).lean();
        if (accepted) fail('WTODAILY_REVISION_PREVIOUS_SUCCESS', 'Υπάρχει ήδη επιτυχής υποβολή για την περίοδο.');
        // One successor per predecessor, independent of request IDs. The unique
        // _id and period fence serialize concurrent approvals without new indexes.
        const attemptId = existing ? hash({ revision_id: revision._id, previous_attempt_id: existing._id }) : revision._id;
        await options.preflight({ ...approved, scope, dbSession });
        const fenced = await store.period.updateOne({ ...scope, status: 'FINALIZED', version: approved.control.version,
            frozen_snapshot_id: approved.control.frozen_snapshot_id, frozen_snapshot_fingerprint: revision.baseline_fingerprint,
            write_fence_version: approved.control.write_fence_version }, { $inc: { write_fence_version: 1 } }, { session: dbSession });
        if (fenced.matchedCount !== 1) fail('WTODAILY_REVISION_CONCURRENT_CHANGE', 'Η κατάσταση της περιόδου άλλαξε ταυτόχρονα.');
        const [attempt] = await store.transmission.create([{ _id: attemptId, ...scope, revision_id: revision._id,
            ...(existing ? { previous_attempt_id: existing._id } : {}),
            payload_fingerprint: hash(revision.payload), request_id: command.request_id, status: 'SENDING', created_at: new Date(),
            approval: { user_id: String(options.session.userId), role: options.session.userRole,
                previous_attempt_not_accepted: true, previous_attempt_evidence: command.previous_attempt_evidence.trim(),
                reviewed_entire_payload: true, boundary_reviewed: true, approved_at: new Date() } }], { session: dbSession });
        return { revision, attempt, approved };
    }); } catch (error) {
        if (error.code === 11000) fail('WTODAILY_REVISION_ATTEMPT_BLOCKED', 'Μία άλλη ενέργεια έχει ήδη δεσμεύσει την αποστολή.', true);
        throw error;
    }
    if (claim.existing) return { success: true, idempotent: true, transmission: claim.existing };
    // The external side effect is deliberately outside withTransaction: driver
    // transaction retries must never repeat an ERGANI request.
    let result;
    try {
        await options.preflight({ ...claim.approved, scope });
        assertWtoDailyPayloadIntervals(claim.revision.payload);
        result = await options.send(clone(claim.revision.payload));
    } catch { result = { success: false, outcome: 'UNKNOWN' }; }
    const complete = Boolean(result?.success === true && result.protocol && result.id && result.submitDate);
    const status = complete ? 'SUCCESS' : result?.outcome === 'REJECTED' ? 'REJECTED' : 'UNKNOWN';
    const safeResult = { protocol: result?.protocol || null, id: result?.id || null, submitDate: result?.submitDate || null,
        outcome: status, error: result?.error || null, raw: result?.raw || null,
        http_status: result?.httpStatus || null, response_received: result?.responseReceived === true,
        failure_stage: result?.failureStage || null };
    try {
        return await run(async dbSession => {
            const log = complete ? await options.recordSuccess({ scope, revision: claim.revision, result, dbSession,
                requestId: command.request_id }) : null;
            const update = await store.transmission.updateOne({ _id: claim.attempt._id, ...scope, status: 'SENDING' },
                { $set: { status, result: safeResult, completed_at: new Date(), ...(log ? { erganh_log_id: log._id } : {}) } }, { session: dbSession });
            if (update.matchedCount !== 1) throw new Error('transmission state changed');
            return { success: complete, idempotent: false, transmission: { _id: claim.attempt._id, status, result: safeResult, erganh_log_id: log?._id },
                reconciliation_required: status === 'UNKNOWN' };
        });
    } catch {
        // SENDING remains a durable barrier even if result persistence fails.
        return { success: false, reconciliation_required: true, transmission: { status: 'UNKNOWN', result: safeResult } };
    }
}
async function assertPreviousAttemptResolved({ scope, submissionModel = require('../../models/ergazomenoi').ErgazomenoiErganhModel }) {
    const unknown = await submissionModel.findOne({ team: scope.team, companykod_object: scope.company_kod,
        ypokatasthma_kodikos: scope.ypokatasthma, employment_period_start: scope.period_start,
        employment_period_end: scope.period_end, submission_code: 'WTODailyA', environment: process.env.ERGANI_ENV || 'trial', reconciliation_required: true }).lean();
    if (unknown) fail('WTODAILY_PREVIOUS_ATTEMPT_UNKNOWN', 'Η προηγούμενη αποστολή έχει άγνωστη κατάσταση. Απαιτείται επιβεβαιωμένη συμφωνία πριν επιτραπεί νέα υποβολή.');
}
module.exports = { explicitRejection, currentApprovedRevision, submitApprovedRevision, readApproved, assertPreviousAttemptResolved };
