'use strict';
// Shared #362 sequence-fence algorithm. Runtime access is issued only by the
// independent startup policy; the fixture retains its exact CI target guard.
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const S = require('./employeeHistoryAutomaticSettlementPreparationContract');
const P = require('./employeeHistorySettlementProtocol');
const U = require('./employeeHistoryCoordinatedSettlementContract');
const A = require('./employeeHistoryAutomaticReconstructionApplyContract');
const W = require('./employeeEmploymentProfileWriter');
const SOURCE = 'EMPLOYEE_HISTORY_LEGACY_APPROVAL_FENCE';
const SEQUENCE = 'employee_profile_mutation_sequence';
function blocked(reason, uncertain = false) {
    const error = Object.assign(Error('Ο αποκλεισμός της παλιάς έγκρισης σταμάτησε επειδή δεν επιβεβαιώθηκαν η εξουσιοδότηση ή τα ακριβή εγκεκριμένα στοιχεία. ' +
        (uncertain ? 'Το αποτέλεσμα αποθήκευσης παραμένει άγνωστο. Μην επαναλάβετε τον αποκλεισμό. ' : 'Δεν αποθηκεύτηκε αποκλεισμός. ') +
        '\n1. Ελέγξτε τη σωστή εταιρεία, ομάδα, εργαζόμενο και παλιά απόπειρα.\n2. Ζητήστε έλεγχο των μόνιμων καταγραφών από τον διαχειριστή.\nΚωδικός αναφοράς: ΙΣΤ-ΠΑΛ-01.'),
    { outcome: 'BLOCKED', reason, code: reason === 'LEGACY_ALREADY_COMMITTED' ? reason : 'EMPLOYEE_HISTORY_LEGACY_FENCE_BLOCKED',
        statusCode: 409, retryWithSameApproval: false });
    return error;
}
function enabled(context) { if (context?.legacyFenceEnabled !== true) throw blocked('DISABLED'); }
const fenceIdentity = ({ scope, employeeId, legacyAttemptId, fingerprint }) => createHash('sha256')
    .update(JSON.stringify([SOURCE, { team: scope.team, company_kod: scope.company_kod, kodikos: scope.kodikos, employee_id: employeeId }, legacyAttemptId, fingerprint])).digest('hex').slice(0, 24);
const reservationIdentity = id => createHash('sha256').update(SOURCE + ':attempt:' + id).digest('hex').slice(0, 24);
// Deterministic representative selection belongs only to Legacy Fence. Other
// reference-audit callers retain their existing default selection policy.
async function legacyFenceReferenceSummary(connection, rows, session) {
    const references = {};
    for (const row of rows) references[String(row._id)] = await require('./employeeHistoryReferenceAuditService')
        .findHistoryIdReferences({ connection, historyIds: [String(row._id)], session, sortById: true });
    return references;
}
async function inspectLegacyApproval(input, session, executionId) {
    const { connection, context, scope, employeeId, actorUserId, legacyAttemptId, fingerprint, businessDecision } = input;
    enabled(context);
    if (!scope || !A.equal(Object.keys(scope).sort(), ['company_kod', 'kodikos', 'team']) ||
        !Object.values(scope).every(value => typeof value === 'string' && value.trim() === value && value.length) ||
        ![employeeId, actorUserId, legacyAttemptId, scope.company_kod].every(value => /^[a-f0-9]{24}$/.test(value || '')) ||
        !/^[A-Za-z0-9_-]{43}$/.test(fingerprint || '')) throw blocked('IDENTITY_REQUIRED');
    const d = context.deps, audit = d.auditModel;
    for (const model of [d.employeeModel, d.historyModel, d.companyModel, d.userModel, d.privilegeModel, audit])
        if (model.db !== connection) throw blocked('CONNECTION_MISMATCH');
    const current = await d.employeeModel.findOne({ ...scope, _id: employeeId }).select('+' + SEQUENCE).session(session).lean();
    await require('./employeeMaintenanceAuthorizationService').authorizeEmployeeMaintenance({ actorUserId, scope, employeeId,
        current, session, userModel: d.userModel, privilegeModel: d.privilegeModel });
    const access = await require('./employeeHistoryAuthorizationService').getEmployeeHistoryAccess(actorUserId, { userModel: d.userModel, session, scope });
    if (access.mode !== 'ADMIN_FULL') throw blocked('ADMIN_REQUIRED');
    const company = await d.companyModel.findOne({ _id: scope.company_kod, team: scope.team }).session(session).lean();
    if (!company) throw blocked('COMPANY_MISMATCH');
    const legacy = await audit.findById(legacyAttemptId).session(session).lean();
    if (!legacy || legacy.mutationSource !== P.ATTEMPT || legacy.diagnostics?.protocol ||
        !A.equal(legacy.employeeScope, { ...scope, employee_id: current._id }) ||
        !A.equal(legacy.diagnostics.scope, scope) || legacy.diagnostics.employeeId !== employeeId ||
        legacy.diagnostics.fingerprint !== fingerprint || P.rootId(legacy.diagnostics) !== legacyAttemptId)
        throw blocked('LEGACY_IDENTITY_MISMATCH');
    const completed = await audit.findOne({ 'employeeScope.employee_id': employeeId, 'employeeScope.team': scope.team,
        'employeeScope.company_kod': scope.company_kod, 'employeeScope.kodikos': scope.kodikos,
        mutationSource: 'EMPLOYEE_HISTORY_SETTLEMENT', 'diagnostics.approvalFingerprint': fingerprint }).session(session).lean();
    if (completed) throw blocked('LEGACY_ALREADY_COMMITTED');
    const id = fenceIdentity(input);
    const prior = await audit.findById(reservationIdentity(id)).session(session).lean();
    if ((executionId && (!prior || prior.mutationSource !== SOURCE + '_ATTEMPT' || prior.diagnostics?.executionId !== executionId)) ||
        (prior && !executionId) ||
        await audit.findById(id).session(session).lean()) throw blocked('ALREADY_REQUESTED');
    const history = await d.historyModel.collection.find(scope, { session }).sort({ _id: 1 }).toArray();
    if (!A.equal(current, legacy.currentBefore) || !A.equal(A.ordered(history), A.ordered(legacy.historyBefore)) ||
        !A.equal(A.ordered(legacy.historyBefore), A.ordered(legacy.historyAfter))) throw blocked('SNAPSHOT_CHANGED');
    const references = await legacyFenceReferenceSummary(connection, history, session);
    const original = { scope, employeeId, actorUserId: legacy.diagnostics.actorUserId,
        currentEmployee: current, completeHistoryRows: history, protectedReferenceSummary: references,
        ...(businessDecision === undefined ? {} : { businessDecision }) };
    const proposal = U.buildCoordinatedSettlementProposal(original);
    if (proposal.status !== 'CLEAN' || proposal.noOp ||
        S.buildEmployeeHistorySettlementApprovalFingerprint({ ...original, proposal }) !== fingerprint) throw blocked('ORIGINAL_APPROVAL_CHANGED');
    return { outcome: 'PREVIEW', scope: S.clone(scope), employeeId, legacyAttemptId, fingerprint,
        company: { id: String(company._id), team: company.team }, sequence: current[SEQUENCE] ?? null,
        approvalFingerprint: A.hash({ purpose: SOURCE, actorUserId, scope, employeeId, legacyAttemptId, fingerprint,
            current, history: A.ordered(history), references, legacy }), requiresNewIndependentApproval: true,
        _snapshot: { current, history } };
}
async function previewLegacyApproval(input) {
    enabled(input.context);
    try { return await W.inProfileTransaction(input.connection, W.transactionCapability,
        session => inspectLegacyApproval(input, session), null, P.transactionOptions); }
    catch (error) { if (error.outcome === 'BLOCKED') throw error; throw blocked('EVIDENCE_NOT_CONFIRMED'); }
}
async function fenceLegacyApproval({ connection, context, scope, employeeId, actorUserId,
    legacyAttemptId, fingerprint, businessDecision, approval }) {
    enabled(context);
    for (const key of ['team', 'company_kod', 'kodikos']) assert.ok(typeof scope[key] === 'string' && scope[key]);
    for (const id of [employeeId, actorUserId, legacyAttemptId]) assert.match(id, /^[a-f0-9]{24}$/);
    assert.match(fingerprint, /^[A-Za-z0-9_-]{43}$/);
    const d = context.deps;
    for (const model of [d.employeeModel, d.historyModel, d.userModel, d.companyModel]) assert.equal(model.db, connection);
    const audit = d.auditModel;
    assert.equal(audit.db, connection);
    const id = fenceIdentity({ scope, employeeId, legacyAttemptId, fingerprint });
    const request = { connection, context, scope, employeeId, actorUserId, legacyAttemptId, fingerprint, businessDecision };
    const reviewed = await previewLegacyApproval(request);
    if (!approval || approval.confirmed !== true || !A.equal(Object.keys(approval).sort(), ['confirmed', 'fingerprint']) ||
        !A.tokenMatches(approval.fingerprint, reviewed.approvalFingerprint)) throw blocked('EXPLICIT_APPROVAL_REQUIRED');
    // Append-only ownership survives uncertain commits. A different HTTP request
    // can never acquire this identity again, including after a server restart.
    const executionId = require('node:crypto').randomUUID();
    const reservationId = reservationIdentity(id);
    try {
        const reserved = await audit.create([{ _id: reservationId, employeeScope: { ...scope, employee_id: employeeId },
            currentBefore: reviewed._snapshot.current, historyBefore: reviewed._snapshot.history,
            historyAfter: reviewed._snapshot.history, survivingHistoryIds: reviewed._snapshot.history.map(row => String(row._id)),
            deletedLegacyHistoryIds: [], mutationSource: SOURCE + '_ATTEMPT',
            diagnostics: { executionId, actorUserId, legacyAttemptId, fingerprint, approvalFingerprint: approval.fingerprint }
        }], { session: null, writeConcern: { w: 'majority' } });
        if (reserved?.length !== 1 || String(reserved[0]._id) !== reservationId) throw blocked('RESERVATION_MISSING', true);
    } catch { throw blocked('FENCE_ATTEMPT_UNCERTAIN', true); }
    return finishReservedApproval(request, reviewed, approval, executionId);
}
// Internal only: all callers must prove either the newly created reservation or
// a separately approved recovery bound to the complete persisted reservation.
async function finishReservedApproval(request, reviewed, approval, executionId, recovery) {
    const { connection, context, scope, employeeId, actorUserId, legacyAttemptId, fingerprint } = request;
    const d = context.deps, audit = d.auditModel, id = fenceIdentity(request);
    let confirmed;
    try { await W.inProfileTransaction(connection, W.transactionCapability, async session => {
        if (recovery) {
            const fresh = await inspectReservationRecovery(request, session);
            if (fresh.outcome !== 'RECOVERABLE' || !A.tokenMatches(fresh.recoveryFingerprint, recovery.fingerprint))
                throw blocked('RECOVERY_EVIDENCE_CHANGED');
        }
        const verified = await inspectLegacyApproval(request, session, executionId);
        if (!A.tokenMatches(verified.approvalFingerprint, approval.fingerprint)) throw blocked('PREVIEW_CHANGED');
        const current = await d.employeeModel.findOne({ ...scope, _id: employeeId })
            .select('+' + SEQUENCE).session(session).lean();
        assert.ok(current);
        await require('./employeeMaintenanceAuthorizationService')
            .authorizeEmployeeMaintenance({ actorUserId, scope, employeeId, current, session,
                userModel: d.userModel, privilegeModel: d.privilegeModel });
        const access = await require('./employeeHistoryAuthorizationService')
            .getEmployeeHistoryAccess(actorUserId, { userModel: d.userModel, session, scope });
        assert.equal(access.mode, 'ADMIN_FULL');
        assert.ok(await d.companyModel.findOne({ _id: scope.company_kod, team: scope.team }).session(session).lean());
        assert.ok(!Object.hasOwn(current, SEQUENCE) || (Number.isSafeInteger(current[SEQUENCE]) && current[SEQUENCE] >= 0 && current[SEQUENCE] < Number.MAX_SAFE_INTEGER));
        // SAME persisted write as #358. A concurrent old holder must finish or
        // abort before this transaction can commit. A retry repeats ALL checks.
        await W.acquireEmployeeMutationFence({ filter: scope, employeeId, employeeModel: d.employeeModel, session });
        const legacy = await audit.findById(legacyAttemptId).session(session).lean();
        assert.ok(legacy && legacy.mutationSource === 'EMPLOYEE_HISTORY_SETTLEMENT_ATTEMPT');
        assert.ok(A.equal(legacy.employeeScope, { ...scope, employee_id: current._id }));
        assert.equal(legacy.diagnostics.fingerprint, fingerprint);
        const completed = await audit.findOne({ 'employeeScope.employee_id': employeeId,
            'employeeScope.team': scope.team, 'employeeScope.company_kod': scope.company_kod,
            'employeeScope.kodikos': scope.kodikos, mutationSource: 'EMPLOYEE_HISTORY_SETTLEMENT',
            'diagnostics.approvalFingerprint': fingerprint }).session(session).lean();
        if (completed) throw Object.assign(Error('LEGACY_ALREADY_COMMITTED'), { code: 'LEGACY_ALREADY_COMMITTED' });
        const history = await d.historyModel.collection.find(scope, { session }).sort({ _id: 1 }).toArray();
        await require('./employeeHistoryReferenceWriteFenceService').claimUnchangedHistoryReferences({
            historyRows: history, scope, historyModel: d.historyModel, session });
        const references = await legacyFenceReferenceSummary(connection, history, session);
        const next = await d.employeeModel.findOne({ ...scope, _id: employeeId }).select('+' + SEQUENCE).session(session).lean();
        const { [SEQUENCE]: oldSequence, ...businessBefore } = current;
        const { [SEQUENCE]: sequence, ...businessAfter } = next;
        assert.equal(sequence, (oldSequence || 0) + 1);
        assert.ok(A.equal(businessBefore, businessAfter));
        const recorded = await audit.create([{ _id: id, employeeScope: { ...scope, employee_id: current._id },
            currentBefore: current, historyBefore: history, historyAfter: history,
            survivingHistoryIds: history.map(row => String(row._id)), deletedLegacyHistoryIds: [],
            mutationSource: SOURCE, diagnostics: { legacyAttemptId, fingerprint, actorUserId,
                previousSequence: oldSequence ?? null, sequence, requiresNewIndependentApproval: true, executionId, approvalFingerprint: approval.fingerprint,
                historyHash: A.hash(history), referencesHash: A.hash(references), legacyHash: A.hash(legacy) }
        }], { session });
        if (recorded?.length !== 1 || String(recorded[0]._id) !== id) throw Error('AUDIT_NOT_PERSISTED');
        assert.ok(A.equal(history, await d.historyModel.collection.find(scope, { session }).sort({ _id: 1 }).toArray()));
        assert.ok(A.equal(references, await legacyFenceReferenceSummary(connection, history, session)));
        assert.ok(A.equal(legacy, await audit.findById(legacyAttemptId).session(session).lean()));
        confirmed = { auditId: id, sequence, requiresNewIndependentApproval: true };
    }, null, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' }, readPreference: 'primary' });
    } catch (error) {
        if (error.outcome === 'BLOCKED') {
            error.message += '\nΑποθηκεύτηκε μόνο η καταγραφή έναρξης του αποκλεισμού. Δεν επιτρέπεται δεύτερη εκτέλεση.';
            throw error;
        }
        throw blocked('FENCE_RESULT_UNCERTAIN', true);
    }
    let saved;
    try { saved = await audit.findById(id).read('primary').readConcern('majority').lean();
    } catch { throw blocked('CONFIRMATION_UNCERTAIN', true); }
    if (saved?.mutationSource !== SOURCE || saved.diagnostics.sequence !== confirmed.sequence ||
        saved.diagnostics.executionId !== executionId || saved.diagnostics.legacyAttemptId !== legacyAttemptId ||
        saved.diagnostics.fingerprint !== fingerprint || saved.diagnostics.approvalFingerprint !== approval.fingerprint ||
        !A.equal(saved.employeeScope, { ...scope, employee_id: reviewed._snapshot.current._id })) throw blocked('CONFIRMATION_UNCERTAIN', true);
    return confirmed;
}
// No HTTP route or startup activation is added for recovery. This explicit
// administrative operation never creates another reservation or execution ID.
async function inspectReservationRecovery(input, session) {
    enabled(input.context);
    const { connection, context, scope, employeeId, actorUserId, legacyAttemptId, fingerprint, reservationId } = input;
    if (!scope || !A.equal(Object.keys(scope).sort(), ['company_kod', 'kodikos', 'team']) ||
        !Object.values(scope).every(value => typeof value === 'string' && value.trim() === value && value.length) ||
        !/^[a-f0-9]{24}$/.test(scope.company_kod || '') || !/^[a-f0-9]{24}$/.test(reservationId || '') ||
        ![employeeId, actorUserId, legacyAttemptId].every(id => /^[a-f0-9]{24}$/.test(id || '')) ||
        !/^[A-Za-z0-9_-]{43}$/.test(fingerprint || '') || reservationId !== reservationIdentity(fenceIdentity(input)))
        throw blocked('RECOVERY_IDENTITY_MISMATCH');
    const d = context.deps, audit = d.auditModel;
    for (const model of [d.employeeModel, d.historyModel, d.companyModel, d.userModel, d.privilegeModel, audit])
        if (model.db !== connection) throw blocked('CONNECTION_MISMATCH');
    const current = await d.employeeModel.findOne({ ...scope, _id: employeeId }).select('+' + SEQUENCE).session(session).lean();
    await require('./employeeMaintenanceAuthorizationService').authorizeEmployeeMaintenance({ actorUserId, scope, employeeId,
        current, session, userModel: d.userModel, privilegeModel: d.privilegeModel });
    const access = await require('./employeeHistoryAuthorizationService').getEmployeeHistoryAccess(actorUserId,
        { userModel: d.userModel, session, scope });
    if (access.mode !== 'ADMIN_FULL') throw blocked('ADMIN_REQUIRED');
    if (!await d.companyModel.findOne({ _id: scope.company_kod, team: scope.team }).session(session).lean())
        throw blocked('COMPANY_MISMATCH');
    const reservation = await audit.findById(reservationId).session(session).lean();
    const z = reservation?.diagnostics;
    if (!reservation || reservation.mutationSource !== SOURCE + '_ATTEMPT' ||
        !A.equal(reservation.employeeScope, { ...scope, employee_id: current._id }) ||
        z?.actorUserId !== actorUserId || z.legacyAttemptId !== legacyAttemptId || z.fingerprint !== fingerprint ||
        typeof z.executionId !== 'string' || !z.executionId || !/^[A-Za-z0-9_-]{43}$/.test(z.approvalFingerprint || '') ||
        !A.equal(reservation.historyBefore, reservation.historyAfter) || reservation.deletedLegacyHistoryIds.length ||
        !A.equal(reservation.survivingHistoryIds, reservation.historyBefore.map(row => String(row._id))))
        throw blocked('RECOVERY_RESERVATION_MISMATCH');
    const final = await audit.findById(fenceIdentity(input)).session(session).lean();
    if (final) {
        const f = final.diagnostics;
        const legacy = await audit.findById(legacyAttemptId).session(session).lean();
        if (final.mutationSource !== SOURCE || !A.equal(final.employeeScope, reservation.employeeScope) ||
            !A.equal(final.currentBefore, reservation.currentBefore) ||
            !A.equal(final.historyBefore, reservation.historyBefore) || !A.equal(final.historyAfter, reservation.historyAfter) ||
            !A.equal(final.survivingHistoryIds, reservation.survivingHistoryIds) || final.deletedLegacyHistoryIds.length ||
            !['executionId', 'actorUserId', 'legacyAttemptId', 'fingerprint', 'approvalFingerprint'].every(key => f?.[key] === z[key]) ||
            f.previousSequence !== (reservation.currentBefore[SEQUENCE] ?? null) ||
            f.sequence !== (reservation.currentBefore[SEQUENCE] || 0) + 1 || f.requiresNewIndependentApproval !== true ||
            f.historyHash !== A.hash(reservation.historyBefore) || f.legacyHash !== A.hash(legacy))
            throw blocked('RECOVERY_COMMIT_EVIDENCE_MISMATCH', true);
        return { outcome: 'COMMITTED', auditId: String(final._id), reservationId, sequence: f.sequence,
            requiresNewIndependentApproval: true };
    }
    const reviewed = await inspectLegacyApproval(input, session, z.executionId);
    if (!A.equal(reviewed._snapshot.current, reservation.currentBefore) ||
        !A.equal(reviewed._snapshot.history, reservation.historyBefore) ||
        !A.tokenMatches(reviewed.approvalFingerprint, z.approvalFingerprint)) throw blocked('RECOVERY_SNAPSHOT_CHANGED');
    return { outcome: 'RECOVERABLE', reservationId, auditId: fenceIdentity(input), sequence: reviewed.sequence,
        recoveryFingerprint: A.hash({ purpose: SOURCE + '_RECOVERY', reservation, approvalFingerprint: reviewed.approvalFingerprint }),
        requiresExplicitRecoveryApproval: true, _reviewed: reviewed, _reservation: reservation };
}
function recoveryFailure(error, readOnly = false) {
    const safe = error.outcome === 'BLOCKED' ? error : blocked('RECOVERY_EVIDENCE_UNCERTAIN', true);
    safe.message = 'Η αποκατάσταση της καταγεγραμμένης προσπάθειας σταμάτησε επειδή δεν επιβεβαιώθηκαν όλα τα στοιχεία ή η ασφαλής ολοκλήρωσή της. ' +
        'Η αρχική καταγραφή έναρξης διατηρείται. ' +
        (readOnly ? 'Δεν αποθηκεύτηκε καμία αλλαγή από αυτόν τον έλεγχο. ' :
            'Παραμένει άγνωστο αν αποθηκεύτηκε νέα ολοκλήρωση και απαιτείται αναγνωστική επιβεβαίωση. ') +
        '\n1. Ζητήστε έλεγχο της συγκεκριμένης καταγραφής έναρξης και της τελικής καταγραφής από τον διαχειριστή.' +
        '\n2. Εξετάστε τα ευρήματα πριν δώσετε ξεχωριστή ρητή έγκριση αποκατάστασης.' +
        '\nΚωδικός αναφοράς: ΙΣΤ-ΠΑΛ-ΑΠΟΚ-01.';
    return safe;
}
async function previewLegacyFenceRecovery(input) {
    enabled(input.context);
    try {
        const { _reviewed, _reservation, ...safe } = await W.inProfileTransaction(input.connection, W.transactionCapability,
            session => inspectReservationRecovery(input, session), null, P.transactionOptions);
        return safe;
    } catch (error) {
        throw recoveryFailure(error, true);
    }
}
async function completeLegacyFenceReservation(input) {
    enabled(input.context);
    let completing = false;
    try {
        const { recoveryApproval } = input;
        // A committed result is reconciled read-only; it never reaches the writer.
        const evidence = await W.inProfileTransaction(input.connection, W.transactionCapability,
            session => inspectReservationRecovery(input, session), null, P.transactionOptions);
        if (evidence.outcome === 'COMMITTED') return evidence;
        if (!recoveryApproval || recoveryApproval.confirmed !== true ||
            !A.equal(Object.keys(recoveryApproval).sort(), ['confirmed', 'fingerprint']) ||
            !A.tokenMatches(recoveryApproval.fingerprint, evidence.recoveryFingerprint))
            throw blocked('EXPLICIT_RECOVERY_APPROVAL_REQUIRED');
        completing = true;
        return await finishReservedApproval(input, evidence._reviewed,
            { confirmed: true, fingerprint: evidence._reservation.diagnostics.approvalFingerprint },
            evidence._reservation.diagnostics.executionId, recoveryApproval);
    } catch (error) {
        throw recoveryFailure(error, !completing);
    }
}

module.exports = { fenceLegacyApproval, previewLegacyApproval, previewLegacyFenceRecovery,
    completeLegacyFenceReservation, legacyFenceReferenceSummary, blocked, SOURCE, SEQUENCE };
