'use strict';
const crypto = require('node:crypto');
const A = require('./employeeHistoryAutomaticReconstructionApplyContract');
const VERSION = 1;
const ATTEMPT = 'EMPLOYEE_HISTORY_SETTLEMENT_ATTEMPT';
const TERMINAL = 'EMPLOYEE_HISTORY_SETTLEMENT_TERMINAL';
const GRANT = 'EMPLOYEE_HISTORY_SETTLEMENT_RECOVERY_GRANT';
const transactionOptions = { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' }, readPreference: 'primary' };
const digest = value => crypto.createHash('sha256').update(value).digest('hex').slice(0, 24);
function rootId({ scope, employeeId, actorUserId, fingerprint }) {
    return digest('settlement-attempt:' + JSON.stringify([scope.team, scope.company_kod, scope.kodikos, employeeId, actorUserId, fingerprint]));
}
function binding(input, generation = 0, root = rootId(input)) {
    return { version: VERSION, rootId: root, generation,
        attemptId: generation === 0 ? root : digest(root + ':attempt:' + generation),
        terminalId: digest(root + ':generation:' + generation), finalAuditId: digest(root + ':final') };
}
function blocked(reason = 'UNRESOLVED') {
    const error = A.failure('COMMIT_UNCERTAIN', 503);
    error.outcome = 'BLOCKED'; error.reason = reason; error.retryWithSameApproval = false;
    error.message = 'Η τακτοποίηση σταμάτησε επειδή δεν επιβεβαιώθηκε ασφαλής ολοκλήρωση ή μόνιμη καταγραφή της προηγούμενης προσπάθειας. Παραμένει άγνωστο αν αποθηκεύτηκαν αλλαγές και δεν επιτρέπεται νέα εφαρμογή.\n1. Κλείστε το παράθυρο.\n2. Ζητήστε από τον διαχειριστή έλεγχο των αποθηκευμένων καταγραφών και νέα ρητή έγκριση αποκατάστασης.\nΚωδικός αναφοράς: ΙΣΤ-ΠΡΩΤ-01.';
    return error;
}
function record(input, id, source, diagnostics) {
    return { _id: id, employeeScope: { ...input.scope, employee_id: input.employeeId }, repairedAt: new Date(),
        currentBefore: input.currentEmployee, historyBefore: input.completeHistoryRows,
        historyAfter: input.completeHistoryRows, survivingHistoryIds: input.completeHistoryRows.map(row => String(row._id)),
        deletedLegacyHistoryIds: [], mutationSource: source, diagnostics };
}
async function read(model, id, session) {
    try { return await model.findById(id).session(session).lean(); }
    catch (error) {
        if (error.hasErrorLabel?.('TransientTransactionError')) throw error;
        throw blocked('EVIDENCE_READ_FAILED');
    }
}
function sameIdentity(row, input) {
    return row && String(row.employeeScope.employee_id) === input.employeeId &&
        ['team', 'company_kod', 'kodikos'].every(key => row.employeeScope[key] === input.scope[key]) &&
        row.diagnostics?.actorUserId === input.actorUserId;
}
async function create(model, document, session) {
    try {
        const rows = await model.create([document], { session });
        if (rows?.length !== 1 || String(rows[0]._id) !== String(document._id)) throw blocked('PERSISTENCE_FAILED');
    } catch (error) {
        if (error.hasErrorLabel?.('TransientTransactionError')) throw error;
        throw blocked('PERSISTENCE_FAILED');
    }
}
// Called on EVERY driver callback, before the employee/history writes. COMMITTED
// is invisible unless the SAME transaction also commits the final audit/history.
async function claim({ auditModel, input, session, claimAttempt, protocol = binding(input) }) {
    if (!session) throw blocked('TRANSACTION_REQUIRED');
    if (protocol.generation > 0) {
        const grant = await read(auditModel, digest(protocol.rootId + ':grant:' + protocol.generation), session);
        if (!sameIdentity(grant, input) || grant.mutationSource !== GRANT ||
            !A.equal(grant.diagnostics.protocol, protocol) || grant.diagnostics.fingerprint !== input.fingerprint)
            throw blocked('GRANT_MISMATCH');
        const predecessor = await read(auditModel, binding(input, protocol.generation - 1, protocol.rootId).terminalId, session);
        if (predecessor?.diagnostics?.outcome !== 'FENCED') throw blocked('PREDECESSOR_NOT_FENCED');
    }
    await claimAttempt({ ...input, session, protocol });
    const terminal = await read(auditModel, protocol.terminalId, session);
    if (terminal) throw blocked(terminal.diagnostics?.outcome || 'TERMINAL_EXISTS');
    await create(auditModel, record(input, protocol.terminalId, TERMINAL,
        { actorUserId: input.actorUserId, fingerprint: input.fingerprint, protocol, outcome: 'COMMITTED' }), session);
    return protocol;
}
async function assertCommitted({ auditModel, audit, session }) {
    const protocol = audit.diagnostics?.protocol;
    if (!protocol) return; // Historical successful audits remain readable; never recover legacy attempts.
    const terminal = await read(auditModel, protocol.terminalId, session);
    if (protocol.version !== VERSION || String(audit._id) !== protocol.finalAuditId ||
        terminal?.mutationSource !== TERMINAL || terminal.diagnostics?.outcome !== 'COMMITTED' ||
        !A.equal(terminal.diagnostics.protocol, protocol) ||
        terminal.diagnostics.fingerprint !== audit.diagnostics.approvalFingerprint ||
        terminal.diagnostics.actorUserId !== audit.diagnostics.actorUserId ||
        String(terminal.employeeScope?.employee_id) !== String(audit.employeeScope.employee_id) ||
        !['team', 'company_kod', 'kodikos'].every(key => terminal.employeeScope?.[key] === audit.employeeScope[key])) throw blocked('COMMIT_EVIDENCE_MISSING');
}
const executionIdPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
function executionBinding(requestId, browserApprovalContext) {
    if (!executionIdPattern.test(requestId || '') || !/^[A-Za-z0-9_-]{43}$/.test(browserApprovalContext || ''))
        throw blocked('EXECUTION_BINDING_REQUIRED');
    return { requestId, browserApprovalContext };
}
// The immutable final audit binds the browser request/session to the actual
// writer invocation. The existing durable attempt independently owns claimId.
// Missing historical evidence stays blocked; never reconstruct it on a read.
async function assertExecution({ auditModel, audit, binding, session }) {
    const saved = audit.diagnostics?.normalExecution, protocol = audit.diagnostics?.protocol;
    if (!saved || !protocol || !executionIdPattern.test(saved.claimId || '') ||
        !A.equal(saved, { version: 1, ...executionBinding(binding.requestId, binding.browserApprovalContext), claimId: saved.claimId }))
        throw blocked('EXECUTION_EVIDENCE_MISMATCH');
    const attempt = await read(auditModel, protocol.attemptId, session);
    if (attempt?.mutationSource !== ATTEMPT || String(attempt.employeeScope?.employee_id) !== String(audit.employeeScope.employee_id) ||
        !['team', 'company_kod', 'kodikos'].every(key => attempt.employeeScope?.[key] === audit.employeeScope[key]) ||
        attempt.diagnostics?.actorUserId !== audit.diagnostics.actorUserId ||
        attempt.diagnostics?.fingerprint !== audit.diagnostics.approvalFingerprint ||
        attempt.diagnostics?.claimId !== saved.claimId || !A.equal(attempt.diagnostics?.protocol, protocol))
        throw blocked('EXECUTION_OWNER_UNCONFIRMED');
}
// No timeout/age based inference. FENCED wins the exact same unique _id as the
// old COMMITTED transaction. One successor grant per predecessor is append-only.
async function fenceAndGrant({ connection, capabilityProbe, auditModel, original, generation, approval,
    confirmed, revalidate }) {
    if (confirmed !== true || !Number.isSafeInteger(generation) || generation < 0 || generation > 1000)
        throw blocked('EXPLICIT_APPROVAL_REQUIRED');
    const predecessor = binding(original, generation, rootId(original));
    const successor = binding(original, generation + 1, predecessor.rootId);
    try {
        return await require('./employeeEmploymentProfileWriter').inProfileTransaction(connection, capabilityProbe, async session => {
            // Includes fresh Admin/update authorization, company scope, complete
            // history, references and the newly confirmed proposal fingerprint.
            const input = await revalidate(session);
            if (!A.equal(input.scope, original.scope) || input.employeeId !== original.employeeId ||
                input.actorUserId !== original.actorUserId || input.fingerprint !== approval.fingerprint || approval.confirmed !== true)
                throw blocked('APPROVAL_MISMATCH');
            const attempt = await read(auditModel, predecessor.attemptId, session);
            if (!sameIdentity(attempt, original) || attempt.mutationSource !== ATTEMPT) throw blocked('ATTEMPT_MISSING');
            if (attempt.diagnostics?.protocol?.version !== VERSION) throw blocked('LEGACY_UNRESOLVED');
            if (!A.equal(attempt.diagnostics.protocol, predecessor)) throw blocked('PROTOCOL_MISMATCH');
            const terminal = await read(auditModel, predecessor.terminalId, session);
            if (terminal?.diagnostics?.outcome === 'COMMITTED') {
                const audit = await read(auditModel, predecessor.finalAuditId, session);
                if (!audit) throw blocked('COMMIT_EVIDENCE_MISSING');
                await assertCommitted({ auditModel, audit, session });
                return { outcome: 'COMMITTED', auditId: String(audit._id), executionEnabled: false };
            }
            if (terminal) throw blocked('ALREADY_FENCED');
            if (await read(auditModel, predecessor.finalAuditId, session)) throw blocked('FINAL_AUDIT_EXISTS');
            await create(auditModel, record(input, predecessor.terminalId, TERMINAL,
                { actorUserId: input.actorUserId, fingerprint: attempt.diagnostics.fingerprint,
                    protocol: predecessor, outcome: 'FENCED' }), session);
            await create(auditModel, record(input, digest(predecessor.rootId + ':grant:' + successor.generation), GRANT,
                { actorUserId: input.actorUserId, fingerprint: input.fingerprint, protocol: successor,
                    predecessor: predecessor.terminalId, adminConfirmed: true }), session);
            return { outcome: 'GRANTED', protocol: successor };
        }, null, transactionOptions);
    } catch (error) {
        if (error.outcome === 'BLOCKED') throw error;
        throw blocked('FENCE_RESULT_UNCERTAIN');
    }
}
module.exports = { VERSION, ATTEMPT, TERMINAL, GRANT, transactionOptions, rootId, binding, blocked, record, claim, assertCommitted, executionBinding, assertExecution, fenceAndGrant };
