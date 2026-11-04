'use strict';
const { AsyncLocalStorage } = require('node:async_hooks');
const { createRequire } = require('node:module');
const A = require('./employeeHistoryAutomaticReconstructionApplyContract');
const SOURCE = 'EMPLOYEE_HISTORY_LEGACY_APPROVAL_FENCE';
const SEQUENCE = 'employee_profile_mutation_sequence';
const reads = new Set(['hello', 'ismaster', 'isMaster', 'saslStart', 'saslContinue', 'authenticate',
    'find', 'getMore', 'killCursors', 'endSessions', 'ping', 'abortTransaction']);
function denied() { throw Object.assign(Error('RECOVERY_WRITE_COMMAND_REJECTED'), { reason: 'RECOVERY_WRITE_COMMAND_REJECTED' }); }
function installRecoveryWriteGuard(mongoose) {
    const { Connection } = createRequire(require.resolve('mongoose'))('mongodb/lib/cmap/connection');
    const original = Connection.prototype.command, access = new AsyncLocalStorage();
    function finished(state, plan) {
        return state.employee === 1 && state.audit === 1 && plan.history.every(row => state.history.get(String(row._id)) === 2);
    }
    Connection.prototype.command = function(namespace, command, options = {}) {
        const name = Object.keys(command)[0], grant = access.getStore(), session = options.session;
        if (name === 'commitTransaction') {
            const state = grant?.transactions.get(session?.transaction);
            if (state && !finished(state, grant.plan)) denied();
        } else if (!reads.has(name)) {
            if (!grant || namespace.db !== grant.plan.database || session?.client !== grant.client ||
                !session.inTransaction() || !session.transaction) denied();
            const plan = grant.plan;
            let state = grant.transactions.get(session.transaction);
            if (!state) { state = { employee: 0, history: new Map(), audit: 0 }; grant.transactions.set(session.transaction, state); }
            if (name === 'update') {
                const operation = command.updates?.[0];
                if (command.updates?.length !== 1 || (operation.multi !== undefined && operation.multi !== false) ||
                    (operation.upsert !== undefined && operation.upsert !== false) || state.audit) denied();
                if (command.update === plan.employeeCollection) {
                    if (state.employee || !A.equal(operation.q, { ...plan.scope, _id: plan.current._id }) ||
                        !A.equal(operation.u, { $inc: { [SEQUENCE]: 1 } })) denied();
                    state.employee = 1;
                } else if (command.update === plan.historyCollection) {
                    const row = plan.history.find(item => String(item._id) === String(operation.q?._id));
                    if (!state.employee || !row || !A.equal(operation.q, { ...plan.scope, _id: row._id })) denied();
                    const step = state.history.get(String(row._id)) || 0;
                    const expected = step === 0 ? { $inc: { history_reference_fence: 1 } } :
                        Object.hasOwn(row, 'history_reference_fence') ? { $set: { history_reference_fence: row.history_reference_fence } } :
                            { $unset: { history_reference_fence: 1 } };
                    if (step >= 2 || !A.equal(operation.u, expected)) denied();
                    state.history.set(String(row._id), step + 1);
                } else denied();
            } else if (name === 'insert') {
                const row = command.documents?.[0];
                if (command.insert !== plan.auditCollection || command.documents?.length !== 1 || state.audit ||
                    !state.employee || !plan.history.every(item => state.history.get(String(item._id)) === 2) ||
                    !(row?.repairedAt instanceof Date) || !Number.isFinite(row.repairedAt.getTime()) || Math.abs(Date.now() - row.repairedAt.getTime()) > 120000) denied();
                const { repairedAt, ...evidence } = row;
                if (!A.equal(evidence, plan.finalAudit)) denied();
                state.audit = 1;
            } else denied();
        }
        // Validation runs before the driver prepares/serializes/sends anything.
        // Transaction ownership comes from options.session, never autocommit.
        return original.apply(this, arguments);
    };
    return Object.freeze({
        run(plan, work) { return access.run({ plan, client: mongoose.connection.getClient(), transactions: new WeakMap() }, work); },
        restore() { Connection.prototype.command = original; }
    });
}
async function buildRecoveryWritePlan({ connection, context, binding, auditId }) {
    const d = context.deps;
    const reservation = await d.auditModel.findById(binding.reservationId).read('primary').readConcern('majority').lean();
    const legacy = await d.auditModel.findById(binding.legacyAttemptId).read('primary').readConcern('majority').lean();
    if (!reservation || reservation.diagnostics.executionId !== binding.executionId) denied();
    const current = reservation.currentBefore, history = A.ordered(reservation.historyBefore);
    const references = await require('./employeeHistoryLegacyFenceService').legacyFenceReferenceSummary(connection, history);
    const previous = current[SEQUENCE] ?? null;
    return { database: connection.name, scope: binding.scope, current, history,
        employeeCollection: d.employeeModel.collection.name, historyCollection: d.historyModel.collection.name,
        auditCollection: d.auditModel.collection.name,
        finalAudit: { _id: new (require('mongoose').Types.ObjectId)(auditId),
            employeeScope: { ...binding.scope, employee_id: current._id }, currentBefore: current,
            historyBefore: history, historyAfter: history, survivingHistoryIds: history.map(row => String(row._id)),
            deletedLegacyHistoryIds: [], mutationSource: SOURCE,
            diagnostics: { legacyAttemptId: binding.legacyAttemptId, fingerprint: binding.fingerprint,
                actorUserId: binding.actorUserId, previousSequence: previous, sequence: (previous || 0) + 1,
                requiresNewIndependentApproval: true, executionId: binding.executionId,
                approvalFingerprint: reservation.diagnostics.approvalFingerprint,
                historyHash: A.hash(history), referencesHash: A.hash(references), legacyHash: A.hash(legacy) } }
    };
}
module.exports = { installRecoveryWriteGuard, buildRecoveryWritePlan };
