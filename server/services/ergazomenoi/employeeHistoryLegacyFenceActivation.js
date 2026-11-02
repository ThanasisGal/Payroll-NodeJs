'use strict';
// Captured once at startup; neither settlement nor recovery enables this action.
const enabledAtStartup = process.env.PAYROLL_EMPLOYEE_HISTORY_LEGACY_FENCE_ENABLED === 'true';
let active;
function initialize({ server }) {
    if (!enabledAtStartup || active || !server.listening || [5000, 5025].includes(server.address()?.port) ||
        process.argv.some(value => value.startsWith('--employee-history-settlement-'))) return false;
    const connection = require('mongoose').connection;
    const models = require('../../models/ergazomenoi');
    const deps = { connection, employeeModel: models.ErgazomenoiModel, historyModel: models.IstorikoProslhpseonAllagonModel,
        auditModel: require('../../models/employeeHistoryRepairAudit'), companyModel: require('../../models/companies').CompaniesModel,
        userModel: require('../../models/userModel'), privilegeModel: require('../../models/privileges').UserPrivilegesModel };
    const context = { legacyFenceEnabled: true, deps, async referenceSummary(rows, session) {
        const result = {};
        for (const row of rows) result[String(row._id)] = await require('./employeeHistoryReferenceAuditService')
            .findHistoryIdReferences({ connection, historyIds: [String(row._id)], session });
        return result;
    } };
    active = { server, context };
    server.once('close', () => { if (active?.server === server) active = null; });
    return true;
}
function contextFor(req) {
    return active?.server.listening && req.socket?.server === active.server ? active.context : null;
}
module.exports = { initialize, contextFor };
