'use strict';
const crypto = require('node:crypto');
const enabledAtStartup = process.env.PAYROLL_EMPLOYEE_HISTORY_SETTLEMENT_ENABLED === 'true';
const contexts = new WeakMap();
let active = null;

function uncertain() {
    const error = require('./employeeHistoryAutomaticReconstructionApplyContract').failure('COMMIT_UNCERTAIN', 503);
    error.message = 'Δεν επιβεβαιώθηκε το αποτέλεσμα προηγούμενης προσπάθειας τακτοποίησης. Παραμένει άγνωστο αν αποθηκεύτηκαν αλλαγές και δεν ξεκίνησε νέα εφαρμογή.\n1. Κλείστε το παράθυρο.\n2. Επικοινωνήστε με τον διαχειριστή για έλεγχο του ήδη καταγεγραμμένου αποτελέσματος.\nΚωδικός αναφοράς: ΙΣΤ-ΑΥΤ-ΚΑΝ-01.';
    return error;
}

// Append-only receipt in the EXISTING audit collection. Its deterministic _id
// uses MongoDB's existing unique primary key across processes and hosts.
// It deliberately survives an aborted/uncertain business transaction. A new
// request may only recognize the final audit, never reapply this fingerprint.
async function claimNormalSettlementAttempt({ auditModel, scope, employeeId, actorUserId,
    fingerprint, claimId, currentEmployee, completeHistoryRows }) {
    const identity = { scope, employeeId, actorUserId, fingerprint };
    const id = crypto.createHash('sha256').update('settlement-attempt:' + JSON.stringify([scope.team, scope.company_kod, scope.kodikos, employeeId, actorUserId, fingerprint])).digest('hex').slice(0, 24);
    const record = { _id: id, employeeScope: { ...scope, employee_id: employeeId },
        repairedAt: new Date(), currentBefore: currentEmployee, historyBefore: completeHistoryRows,
        historyAfter: completeHistoryRows, survivingHistoryIds: completeHistoryRows.map(row => String(row._id)),
        deletedLegacyHistoryIds: [], mutationSource: 'EMPLOYEE_HISTORY_SETTLEMENT_ATTEMPT',
        diagnostics: { ...identity, claimId } };
    try {
        await auditModel.create([record], { session: null, writeConcern: { w: 'majority' } });
    } catch (error) {
        if (error.code !== 11000) throw uncertain();
        let existing;
        try { existing = await auditModel.findById(id).session(null).read('primary').readConcern('majority').lean(); }
        catch { throw uncertain(); }
        // Only the driver's retry of this SAME invocation may reuse the claim.
        if (!existing || existing.mutationSource !== record.mutationSource ||
            existing.diagnostics?.claimId !== claimId ||
            existing.diagnostics?.fingerprint !== fingerprint) throw uncertain();
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
    const context = { mode: 'NORMAL', get executionEnabled() { return server.listening; }, deps: {
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
        await claimNormalSettlementAttempt({ ...input, auditModel });
    } };
    contexts.set(handle, context);
    active = { server, handle };
    server.once('close', () => { contexts.delete(handle); if (active?.handle === handle) active = null; });
    return true;
}
function getEmployeeHistorySettlementNormalHandle(req) {
    return active?.server.listening && req.socket?.server === active.server ? active.handle : null;
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
    normalSettlementContext, normalPreviewEnabled, claimNormalSettlementAttempt };
