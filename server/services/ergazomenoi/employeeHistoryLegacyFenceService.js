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
    const references = await context.referenceSummary(history, session);
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
    let confirmed;
    try { await W.inProfileTransaction(connection, W.transactionCapability, async session => {
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
        const references = await context.referenceSummary(history, session);
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
        assert.ok(A.equal(references, await context.referenceSummary(history, session)));
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
module.exports = { fenceLegacyApproval, previewLegacyApproval, blocked, SOURCE, SEQUENCE };
