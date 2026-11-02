'use strict';
const enabledAtStartup = process.env.PAYROLL_EMPLOYEE_HISTORY_SETTLEMENT_ENABLED === 'true';
const contexts = new WeakMap();
// Independent startup switch; normal settlement never enables recovery.
const recoveryEnabledAtStartup = process.env.PAYROLL_EMPLOYEE_HISTORY_SETTLEMENT_RECOVERY_ENABLED === 'true';
let active = null;

function uncertain(reason) { return require('./employeeHistorySettlementProtocol').blocked(reason); }

// Append-only receipt in the EXISTING audit collection. Its deterministic _id
// uses MongoDB's existing unique primary key across processes and hosts.
// It deliberately survives an aborted/uncertain business transaction. A new
// request may only recognize the final audit, never reapply this fingerprint.
async function claimNormalSettlementAttempt({ auditModel, scope, employeeId, actorUserId,
    fingerprint, claimId, currentEmployee, completeHistoryRows, protocol }) {
    const identity = { scope, employeeId, actorUserId, fingerprint };
    const P = require('./employeeHistorySettlementProtocol');
    protocol ||= P.binding({ scope, employeeId, actorUserId, fingerprint });
    const id = protocol.attemptId;
    const record = { _id: id, employeeScope: { ...scope, employee_id: employeeId },
        repairedAt: new Date(), currentBefore: currentEmployee, historyBefore: completeHistoryRows,
        historyAfter: completeHistoryRows, survivingHistoryIds: completeHistoryRows.map(row => String(row._id)),
        deletedLegacyHistoryIds: [], mutationSource: 'EMPLOYEE_HISTORY_SETTLEMENT_ATTEMPT',
        diagnostics: { ...identity, claimId, protocol } };
    try {
        const created = await auditModel.create([record], { session: null, writeConcern: { w: 'majority' } });
        if (created?.length !== 1 || String(created[0]?._id) !== id) throw uncertain('ATTEMPT_PERSISTENCE_FAILED');
    } catch (error) {
        if (error.code !== 11000) throw uncertain();
        let existing;
        try { existing = await auditModel.findById(id).session(null).read('primary').readConcern('majority').lean(); }
        catch { throw uncertain(); }
        // Only the driver's retry of this SAME invocation may reuse the claim.
        if (!existing || existing.mutationSource !== record.mutationSource ||
            existing.diagnostics?.claimId !== claimId ||
            existing.diagnostics?.fingerprint !== fingerprint ||
            !require('./employeeHistoryAutomaticReconstructionApplyContract').equal(existing.diagnostics?.protocol, protocol))
            throw uncertain(existing?.diagnostics?.protocol?.version === P.VERSION ? 'ATTEMPT_OWNED' : 'LEGACY_UNRESOLVED');
    }
}

function initializeEmployeeHistorySettlementNormal({ server }) {
    if (!enabledAtStartup || active || !server.listening || server.address()?.port === 5025 ||
        process.argv.some(arg => arg.startsWith('--employee-history-settlement-'))) return false;
    const mongoose = require('mongoose');
    const { ErgazomenoiModel: employeeModel, IstorikoProslhpseonAllagonModel: historyModel } = require('../../models/ergazomenoi');
    const auditModel = require('../../models/employeeHistoryRepairAudit');
    const referenceChecker = require('./employeeHistoryReferenceAuditService').findHistoryIdReferences;
    const handle = Object.freeze({});
    const context = { mode: 'NORMAL', recoveryEnabled: recoveryEnabledAtStartup, get executionEnabled() { return server.listening; }, deps: {
        connection: mongoose.connection, employeeModel, historyModel, auditModel,
        companyModel: require('../../models/companies').CompaniesModel,
        userModel: require('../../models/userModel'), privilegeModel: require('../../models/privileges').UserPrivilegesModel,
        referenceChecker, capabilityProbe: require('./employeeEmploymentProfileWriter').transactionCapability,
        auditCollectionChecker: require('./employeeHistoryRepairAuditSetupService').employeeHistoryRepairAuditCollectionExists
    },
    readAudits: (session, { scope, employeeId }) => auditModel.find({
        'employeeScope.team': scope.team, 'employeeScope.company_kod': scope.company_kod,
        'employeeScope.kodikos': scope.kodikos, 'employeeScope.employee_id': employeeId,
        mutationSource: 'EMPLOYEE_HISTORY_SETTLEMENT'
    }).session(session).sort({ _id: 1 }).lean(),
    async referenceSummary(rows, session) {
        const result = {};
        for (const row of rows) result[String(row._id)] = await referenceChecker({
            connection: mongoose.connection, historyIds: [String(row._id)], session });
        return result;
    },
    async claimExecution(input) {
        if (!server.listening) throw uncertain();
        if (!await context.deps.auditCollectionChecker({ connection: mongoose.connection })) throw uncertain();
        return require('./employeeHistorySettlementProtocol').claim({ auditModel, input, session: input.session,
            claimAttempt: args => claimNormalSettlementAttempt({ ...args, auditModel }) });
    } };
    contexts.set(handle, context);
    active = { server, handle };
    server.once('close', () => { contexts.delete(handle); if (active?.handle === handle) active = null; });
    return true;
}
function getEmployeeHistorySettlementNormalHandle(req) {
    return active?.server.listening && req.socket?.server === active.server ? active.handle : null;
}
function issueRecoveryHandle(baseHandle, protocol) {
    const base = contexts.get(baseHandle);
    if (!base?.recoveryEnabled || !base.executionEnabled) throw uncertain('RECOVERY_DISABLED');
    const handle = Object.freeze({});
    contexts.set(handle, { ...base, async claimExecution(input) {
        if (!base.executionEnabled) throw uncertain('EXECUTION_DISABLED');
        return require('./employeeHistorySettlementProtocol').claim({ auditModel: base.deps.auditModel, input,
            session: input.session, protocol, claimAttempt: args => claimNormalSettlementAttempt({ ...args, auditModel: base.deps.auditModel }) });
    } });
    return handle;
}
async function normalPreviewEnabled(req) {
    const handle = getEmployeeHistorySettlementNormalHandle(req);
    if (!handle) return false;
    const d = contexts.get(handle).deps;
    const access = await require('./employeeHistoryAuthorizationService').getEmployeeHistoryAccess(req.session?.userId, { userModel: d.userModel });
    if (access.mode !== 'ADMIN_FULL') return false;
    const permission = await d.privilegeModel.findOne({ userId: String(req.session.userId), form: 'Ergazomenoi' }).lean();
    return permission?.privileges?.admin === true || permission?.privileges?.update === true;
}
function normalSettlementContext(handle) { return handle && contexts.get(handle); }
module.exports = { initializeEmployeeHistorySettlementNormal, getEmployeeHistorySettlementNormalHandle,
    normalSettlementContext, normalPreviewEnabled, claimNormalSettlementAttempt, issueRecoveryHandle };
