'use strict';

const mongoose = require('mongoose');
const { normalizeUserRole, getSelectableAdminUserRoles,
    getUserRoleOptionsForCurrentValue } = require('../constants/userRoles');
const { normalizeRequiredUserTeam, normalizeUserTeam, buildManagedUserFilter } =
    require('./userTeamScopeService');

const SUPERVISOR_MANAGEABLE_ROLES = Object.freeze(['HR', 'C', 'U', 'V']);
const notFound = () => Object.assign(new Error('Ο χρήστης δεν βρέθηκε'),
    { status: 404, code: 'USER_NOT_FOUND' });

function isSupervisorManageableRole(role) {
    return SUPERVISOR_MANAGEABLE_ROLES.includes(normalizeUserRole(role));
}

function buildAdminManagedUserFilter(actor) {
    const team = normalizeRequiredUserTeam(actor?.team);
    if (actor?.role === 'A') return buildManagedUserFilter(team);
    if (actor?.role !== 'S') throw Object.assign(new Error('Δεν επιτρέπεται'), { status: 403 });
    // All operators are constructed on the server and must survive sanitizeFilter.
    return { team: new RegExp(`^\\s*${team}\\s*$`, 'i'),
        privileges: mongoose.trusted({ $in: [...SUPERVISOR_MANAGEABLE_ROLES] }),
        _id: mongoose.trusted({ $ne: new mongoose.Types.ObjectId(actor.userId) }) };
}

function buildAdminManagedUserIdentityFilter(actor, targetId) {
    if (!mongoose.isValidObjectId(targetId)) throw notFound();
    if (actor?.role === 'S' && String(targetId).toLowerCase() === actor.userId.toLowerCase()) throw notFound();
    const { _id, ...scope } = buildAdminManagedUserFilter(actor);
    return { ...scope, _id: targetId };
}

function assertAdminCanManageTarget(actor, target) {
    if (!target || !target._id) throw notFound();
    const team = normalizeRequiredUserTeam(actor?.team);
    const targetTeam = normalizeUserTeam(target.team);
    if (!targetTeam) throw notFound();
    if (actor?.role === 'A' && (team === 'THA' || team === targetTeam)) return target;
    if (actor?.role === 'S' && team === targetTeam &&
        String(target._id).toLowerCase() !== actor.userId.toLowerCase() &&
        isSupervisorManageableRole(target.privileges)) return target;
    throw notFound();
}

function getAssignableRolesForActor(actor, currentTargetRole) {
    const options = currentTargetRole
        ? getUserRoleOptionsForCurrentValue(currentTargetRole) : getSelectableAdminUserRoles();
    return actor?.role === 'S' ? options.filter((option) =>
        isSupervisorManageableRole(typeof option === 'string' ? option : option.value)) : options;
}

module.exports = { SUPERVISOR_MANAGEABLE_ROLES, isSupervisorManageableRole,
    buildAdminManagedUserFilter, buildAdminManagedUserIdentityFilter,
    assertAdminCanManageTarget, getAssignableRolesForActor };
