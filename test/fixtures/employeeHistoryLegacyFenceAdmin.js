'use strict';
// Review preparation ONLY: no route, CLI, runtime registration or activation flag.
// This procedure can connect exclusively to the existing disposable CI database.
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { assertMongoConnection } = require('./employeeHistorySettlementMongoTarget');
const S = require('../../server/services/ergazomenoi/employeeHistoryAutomaticSettlementPreparationContract');
const A = require('../../server/services/ergazomenoi/employeeHistoryAutomaticReconstructionApplyContract');
const W = require('../../server/services/ergazomenoi/employeeEmploymentProfileWriter');
const SOURCE = 'EMPLOYEE_HISTORY_LEGACY_APPROVAL_FENCE';
const SEQUENCE = 'employee_profile_mutation_sequence';
async function fenceLegacyApproval({ connection, context, scope, employeeId, actorUserId,
    legacyAttemptId, fingerprint, failAudit = false, loseAcknowledgement = false, onWritten }) {
    assertMongoConnection(connection); // Before any database operation; never payrollDB.
    for (const key of ['team', 'company_kod', 'kodikos']) assert.ok(typeof scope[key] === 'string' && scope[key]);
    for (const id of [employeeId, actorUserId, legacyAttemptId]) assert.match(id, /^[a-f0-9]{24}$/);
    assert.match(fingerprint, /^[A-Za-z0-9_-]{43}$/);
    const d = context.deps;
    for (const model of [d.employeeModel, d.historyModel, d.userModel, d.companyModel]) assert.equal(model.db, connection);
    const audit = require('../../server/models/employeeHistoryRepairAudit');
    assert.equal(audit.db, connection);
    const identity = { ...scope, employee_id: employeeId };
    const id = createHash('sha256').update(JSON.stringify([SOURCE, identity, legacyAttemptId, fingerprint])).digest('hex').slice(0, 24);
    let confirmed;
    await W.inProfileTransaction(connection, W.transactionCapability, async session => {
        const current = await d.employeeModel.findOne({ ...scope, _id: employeeId })
            .select('+' + SEQUENCE).session(session).lean();
        assert.ok(current);
        await require('../../server/services/ergazomenoi/employeeMaintenanceAuthorizationService')
            .authorizeEmployeeMaintenance({ actorUserId, scope, employeeId, current, session,
                userModel: d.userModel, privilegeModel: d.privilegeModel });
        const access = await require('../../server/services/ergazomenoi/employeeHistoryAuthorizationService')
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
        const references = await context.referenceSummary(history, session);
        const next = await d.employeeModel.findOne({ ...scope, _id: employeeId }).select('+' + SEQUENCE).session(session).lean();
        const { [SEQUENCE]: oldSequence, ...businessBefore } = current;
        const { [SEQUENCE]: sequence, ...businessAfter } = next;
        assert.equal(sequence, (oldSequence || 0) + 1);
        assert.ok(A.equal(businessBefore, businessAfter));
        await audit.create([{ _id: id, employeeScope: { ...scope, employee_id: current._id },
            currentBefore: current, historyBefore: history, historyAfter: history,
            survivingHistoryIds: history.map(row => String(row._id)), deletedLegacyHistoryIds: [],
            mutationSource: SOURCE, diagnostics: { legacyAttemptId, fingerprint, actorUserId,
                previousSequence: oldSequence ?? null, sequence, requiresNewIndependentApproval: true,
                historyHash: A.hash(history), referencesHash: A.hash(references), legacyHash: A.hash(legacy) }
        }], { session });
        if (failAudit) throw Object.assign(Error('INJECTED_AUDIT_FAILURE'), { code: 'INJECTED_AUDIT_FAILURE' });
        assert.ok(A.equal(history, await d.historyModel.collection.find(scope, { session }).sort({ _id: 1 }).toArray()));
        assert.ok(A.equal(references, await context.referenceSummary(history, session)));
        assert.ok(A.equal(legacy, await audit.findById(legacyAttemptId).session(session).lean()));
        if (onWritten) await onWritten();
        confirmed = { auditId: id, sequence, requiresNewIndependentApproval: true };
    }, null, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' }, readPreference: 'primary' });
    if (loseAcknowledgement) throw Object.assign(Error('COMMIT_RESULT_UNKNOWN'), { code: 'COMMIT_RESULT_UNKNOWN' });
    const saved = await audit.findById(id).read('primary').readConcern('majority').lean();
    assert.equal(saved?.mutationSource, SOURCE);
    assert.equal(saved.diagnostics.sequence, confirmed.sequence);
    return confirmed;
}
module.exports = { fenceLegacyApproval, SOURCE, SEQUENCE, executionEnabled: false };
