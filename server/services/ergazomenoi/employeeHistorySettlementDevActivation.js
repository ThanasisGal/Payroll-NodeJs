'use strict';
const fs = require('node:fs');
const path = require('node:path');
const contexts = new WeakMap();
let active = null;
const FLAG = '--employee-history-settlement-dev=';
function eligible({ environment, argv, root, cwd, port, ci }) {
    if (environment !== 'development' || ci || port !== 5000 || root !== cwd || root !== '/home/thanasis/Projects/Payroll-NodeJs') return false;
    if (!Array.isArray(argv) || !argv.every(value => typeof value === 'string') || typeof argv[1] !== 'string' || path.resolve(root, argv[1]) !== path.join(root, 'app.js')) return false;
    const flags = argv.filter(value => value.startsWith('--employee-history-settlement-dev'));
    return flags.length === 1 && flags[0] === `${FLAG}${root}:5000`;
}
function initializeEmployeeHistorySettlementDev({ server, appRoot }) {
    // Only the actual listening server can issue a runtime capability. Nothing
    // reads an activation setting from HTTP, .env, headers or browser state.
    const root = fs.realpathSync(appRoot), cwd = fs.realpathSync(process.cwd());
    const permitted = () => eligible({ environment: process.env.NODE_ENV, argv: process.argv,
        root, cwd: fs.realpathSync(process.cwd()), port: server.address()?.port,
        ci: Boolean(process.env.CI || process.env.GITHUB_ACTIONS) }) && cwd === root && server.listening && ['127.0.0.1','::1'].includes(server.address()?.address);
    if (active || !permitted()) return false;
    const mongoose = require('mongoose');
    const { ErgazomenoiModel: employeeModel, IstorikoProslhpseonAllagonModel: historyModel } = require('../../models/ergazomenoi');
    const companyModel = require('../../models/companies').CompaniesModel;
    const auditModel = require('../../models/employeeHistoryRepairAudit');
    const referenceChecker = require('./employeeHistoryReferenceAuditService').findHistoryIdReferences;
    const handle = Object.freeze({});
    const context = { mode: 'CONTROLLED_DEV', deps: {
        connection: mongoose.connection, employeeModel, historyModel, auditModel, companyModel,
        userModel: require('../../models/userModel'), privilegeModel: require('../../models/privileges').UserPrivilegesModel,
        referenceChecker, capabilityProbe: require('./employeeEmploymentProfileWriter').transactionCapability,
        auditCollectionChecker: require('./employeeHistoryRepairAuditSetupService').employeeHistoryRepairAuditCollectionExists
    }, readAudits: (session, { scope, employeeId }) => auditModel.find({
        'employeeScope.team': scope.team, 'employeeScope.company_kod': scope.company_kod,
        'employeeScope.kodikos': scope.kodikos, 'employeeScope.employee_id': employeeId
    }).session(session).sort({ _id: 1 }).lean(),
    async referenceSummary(rows, session) {
        const result = {};
        for (const row of rows) result[String(row._id)] = await referenceChecker({ connection: mongoose.connection,
            historyIds: [String(row._id)], session });
        return result;
    } };
    contexts.set(handle, { context, permitted }); active = { handle, server, permitted };
    server.once('close', () => { active = null; contexts.delete(handle); });
    return true;
}
function runtimeSettlementContext(handle) {
    const value = handle && contexts.get(handle);
    return value?.permitted() ? value.context : null;
}
function getEmployeeHistorySettlementDevHandle(req) {
    return active?.permitted() && req.socket?.server === active.server && req.socket.localPort === 5000 ? active.handle : null;
}
function settlementContext(handle) {
    return runtimeSettlementContext(handle) || require('../../../test/fixtures/employeeHistorySettlementSyntheticStore').syntheticSettlementContext(handle);
}
module.exports = { eligible, initializeEmployeeHistorySettlementDev, runtimeSettlementContext,
    getEmployeeHistorySettlementDevHandle, settlementContext };
