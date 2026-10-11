'use strict';
const UserModel = require('../../models/userModel');
const { UserPrivilegesModel } = require('../../models/privileges');
const { normalizeRequiredUserTeam, CANONICAL_ALL_TEAMS_CODE } = require('../userTeamScopeService');

// Shared by Employee Maintenance and server-owned automatic reconstruction. Manual History
// endpoints continue to use employeeHistoryAuthorizationService unchanged.
async function authorizeEmployeeMaintenance({ actorUserId, scope, employeeId, current,
    session, userModel = UserModel, privilegeModel = UserPrivilegesModel }) {
    const fail = () => { throw Object.assign(new Error('EMPLOYEE_HISTORY_MANAGEMENT_FORBIDDEN'),
        { code: 'EMPLOYEE_HISTORY_MANAGEMENT_FORBIDDEN', statusCode: 403 }); };
    if (!actorUserId || !current || String(current._id) !== String(employeeId) ||
        !['team', 'company_kod', 'kodikos'].every(f => current[f] === scope[f])) fail();
    const actor = await userModel.findById(actorUserId).select('_id team situation').session(session).lean();
    if (!actor || String(actor.situation).trim().toUpperCase() !== 'A') fail();
    let team;
    try { team = normalizeRequiredUserTeam(actor.team); } catch { fail(); }
    if (team !== scope.team && team !== CANONICAL_ALL_TEAMS_CODE) fail();
    const permission = await privilegeModel.findOne({ userId: String(actorUserId), form: 'Ergazomenoi' })
        .select('privileges.admin privileges.update').session(session).lean();
    if (permission?.privileges?.admin !== true && permission?.privileges?.update !== true) fail();
    // No transferable capability, access-mode override or browser flag escapes
    // this call. Only the trusted planner below can derive subsequent writes.
}
module.exports = { authorizeEmployeeMaintenance };

async function authorizeEmployeeCreation({ actorUserId, scope, session,
    userModel = UserModel, privilegeModel = UserPrivilegesModel }) {
    const fail = () => { throw Object.assign(new Error('EMPLOYEE_HISTORY_MANAGEMENT_FORBIDDEN'),
        { code: 'EMPLOYEE_HISTORY_MANAGEMENT_FORBIDDEN', statusCode: 403 }); };
    if (!actorUserId || !scope?.team || !scope?.company_kod) fail();
    const actor = await userModel.findById(actorUserId).select('_id team situation').session(session).lean();
    if (!actor || String(actor.situation).trim().toUpperCase() !== 'A') fail();
    let team;
    try { team = normalizeRequiredUserTeam(actor.team); } catch { fail(); }
    if (team !== scope.team && team !== CANONICAL_ALL_TEAMS_CODE) fail();
    const permission = await privilegeModel.findOne({ userId: String(actorUserId), form: 'Ergazomenoi' })
        .select('privileges.admin privileges.create').session(session).lean();
    if (permission?.privileges?.admin !== true && permission?.privileges?.create !== true) fail();
}
module.exports.authorizeEmployeeCreation = authorizeEmployeeCreation;

// Same company/team boundary used by company child writes, checked afresh in
// the draft transaction. It does not grant a separate History capability.
async function authorizeEmployeeDraftCompany({ scope, session,
    companyModel = require('../../models/companies').CompaniesModel }) {
    const company = await companyModel.findOne({ _id: scope.company_kod, team: scope.team })
        .select('_id').session(session).lean();
    if (!company) throw require('../../utils/ergazomenoi/employeeSaveState')
        .saveStateError('EMPLOYEE_SAVE_COMPANY_FORBIDDEN', 403);
}
module.exports.authorizeEmployeeDraftCompany = authorizeEmployeeDraftCompany;
