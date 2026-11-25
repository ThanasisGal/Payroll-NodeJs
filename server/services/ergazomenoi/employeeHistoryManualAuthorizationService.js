'use strict';
// Only the manual Editor/XLSX proposal boundary uses this policy. Automatic
// reconstruction, archive administration and broad ADMIN_FULL remain unchanged.
const { normalizeUserRole } = require('../../constants/userRoles');
const { normalizeRequiredUserTeam } = require('../userTeamScopeService');
const P = require('./employeeHistoryApprovedProposalContract');
const { sectionForField, FORMS } = require('./employeePendingHistorySectionAuthorizationService');

async function record(query, fields, session) {
    query = query.select(fields);
    if (session) query = query.session(session);
    return query.lean();
}
function denied() { throw P.failure('RIGHTS', 403); }
async function authorizeManualEmployeeHistory({ actorUserId, employeeId, scope, current,
    company, userModel, privilegeModel, session = null }) {
    if (!actorUserId || !scope || !current || String(current._id) !== String(employeeId) ||
        !['team', 'company_kod', 'kodikos'].every(field => typeof scope[field] === 'string' &&
            scope[field].trim() && current[field] === scope[field])) denied();
    const user = await record(userModel.findById(actorUserId), 'privileges team situation', session);
    if (!user || String(user.situation || '').trim().toUpperCase() !== 'A' ||
        !['A', 'S', 'HR'].includes(normalizeUserRole(user.privileges))) denied();
    let team;
    try { team = normalizeRequiredUserTeam(user.team); } catch { denied(); }
    // No special all-Groups exception, including THA, at this manual boundary.
    if (team !== scope.team || !company || String(company._id) !== scope.company_kod ||
        company.team !== team || !Array.isArray(company.users) ||
        !company.users.some(id => String(id) === String(actorUserId))) denied();
    const permission = await record(privilegeModel.findOne({ userId: String(actorUserId), form: 'Ergazomenoi' }),
        '_id privileges.admin privileges.update', session);
    if (permission?.privileges?.admin !== true && permission?.privileges?.update !== true) denied();
    return { mode: 'MANUAL_SCOPED', employeeAdmin: permission.privileges.admin === true,
        permissionIds: [String(permission._id)] };
}
async function authorizeManualEmployeeHistoryFields({ access, actorUserId, fields,
    privilegeModel, session = null }) {
    if (access?.mode !== 'MANUAL_SCOPED' || !Array.isArray(fields) ||
        fields.some(field => !P.permittedFields.includes(field))) denied();
    const ids = new Set(access.permissionIds);
    if (!access.employeeAdmin) {
        const sections = new Set(fields.map(field => sectionForField(field)).filter(Boolean));
        for (const section of sections) {
            const permission = await record(privilegeModel.findOne({ userId: String(actorUserId), form: FORMS[section] }),
                '_id privileges.admin privileges.update', session);
            if (permission?.privileges?.admin !== true && permission?.privileges?.update !== true) denied();
            ids.add(String(permission._id));
        }
    }
    return [...ids];
}
module.exports = { authorizeManualEmployeeHistory, authorizeManualEmployeeHistoryFields };
