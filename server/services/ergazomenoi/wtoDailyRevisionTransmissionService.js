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
const clone = value => JSON.parse(JSON.stringify(canonicalize(value)));
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
        transmission: options.transmissionModel || require('../../models/wtoDailyRevisionTransmission') };
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
    const rebuilt = buildRevisionPreview({ scope, control, document, command: { reason: revision.reason, corrections },
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
    const transmission = result.revision ? await store.transmission.findOne({ _id: result.revision._id, ...scope }).lean() : null;
    return { revision: result.revision, transmission, send_enabled: options.releaseEnabled === true };
}
async function submitApprovedRevision(options) {
    const scope = authorize(options); const command = options.command || {}; const store = storage(options);
    const allowed = ['ypokatasthma', 'revision_id', 'expected_preview_fingerprint', 'request_id', 'approve_submission',
        'previous_attempt_not_accepted', 'previous_attempt_evidence', 'reviewed_entire_payload', 'boundary_reviewed'];
    if (Object.keys(command).some(key => !allowed.includes(key)) || !/^[a-f0-9]{64}$/.test(command.revision_id || '') ||
        !/^[a-f0-9]{64}$/.test(command.expected_preview_fingerprint || '') ||
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
        const existing = await store.transmission.findOne({ _id: revision._id, ...scope }).session(dbSession).lean();
        if (existing) {
            if (existing.status === 'SUCCESS') return { existing };
            fail('WTODAILY_REVISION_ATTEMPT_BLOCKED', 'Υπάρχει ήδη καταγεγραμμένη απόπειρα. Νέα αποστολή αποκλείστηκε για να μη γίνει διπλή υποβολή.', true);
        }
        await options.preflight({ ...approved, scope, dbSession });
        const fenced = await store.period.updateOne({ ...scope, status: 'FINALIZED', version: approved.control.version,
            frozen_snapshot_id: approved.control.frozen_snapshot_id, frozen_snapshot_fingerprint: revision.baseline_fingerprint,
            write_fence_version: approved.control.write_fence_version }, { $inc: { write_fence_version: 1 } }, { session: dbSession });
        if (fenced.matchedCount !== 1) fail('WTODAILY_REVISION_CONCURRENT_CHANGE', 'Η κατάσταση της περιόδου άλλαξε ταυτόχρονα.');
        const [attempt] = await store.transmission.create([{ _id: revision._id, ...scope, revision_id: revision._id,
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
        outcome: status, error: result?.error || null, raw: result?.raw || null };
    try {
        return await run(async dbSession => {
            const log = complete ? await options.recordSuccess({ scope, revision: claim.revision, result, dbSession,
                requestId: command.request_id }) : null;
            const update = await store.transmission.updateOne({ _id: claim.revision._id, ...scope, status: 'SENDING' },
                { $set: { status, result: safeResult, completed_at: new Date(), ...(log ? { erganh_log_id: log._id } : {}) } }, { session: dbSession });
            if (update.matchedCount !== 1) throw new Error('transmission state changed');
            return { success: complete, idempotent: false, transmission: { status, result: safeResult, erganh_log_id: log?._id },
                reconciliation_required: status === 'UNKNOWN' };
        });
    } catch {
        // SENDING remains a durable barrier even if result persistence fails.
        return { success: false, reconciliation_required: true, transmission: { status: 'UNKNOWN', result: safeResult } };
    }
}
module.exports = { currentApprovedRevision, submitApprovedRevision, readApproved };
