const CANONICAL_ALL_TEAMS_CODE = 'THA';
const MAX_TEAM_LENGTH = 64;
const VALID_TEAM_PATTERN = /^[A-Z0-9][A-Z0-9_-]*$/;

function normalizeUserTeam(value) {
    return typeof value === 'string' ? value.trim().toUpperCase() : '';
}

function isValidUserTeam(value) {
    const normalized = normalizeUserTeam(value);
    return normalized.length > 0 &&
        normalized.length <= MAX_TEAM_LENGTH &&
        VALID_TEAM_PATTERN.test(normalized);
}

function teamScopeError(message = 'Δεν υπάρχει έγκυρο team scope') {
    return Object.assign(new Error(message), {
        status: 403,
        code: 'INVALID_TEAM_SCOPE'
    });
}

function normalizeRequiredUserTeam(value) {
    const normalized = normalizeUserTeam(value);
    if (!isValidUserTeam(normalized)) throw teamScopeError();
    return normalized;
}

function canManageAllUserTeams(sessionTeam) {
    return normalizeUserTeam(sessionTeam) === CANONICAL_ALL_TEAMS_CODE;
}

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildManagedUserFilter(sessionTeam) {
    const normalized = normalizeRequiredUserTeam(sessionTeam);
    if (normalized === CANONICAL_ALL_TEAMS_CODE) return {};

    // Το schema ιστορικά έκανε trim αλλά όχι uppercase. Το regex παράγεται μόνο
    // από validated server-side canonical team και καλύπτει legacy casing/spaces.
    return {
        team: new RegExp(`^\\s*${escapeRegExp(normalized)}\\s*$`, 'i')
    };
}

function buildManagedUserIdentityFilter(sessionTeam, userId) {
    return { _id: userId, ...buildManagedUserFilter(sessionTeam) };
}

function assertUserWithinManagedTeamScope(sessionTeam, user) {
    if (!user || !isValidUserTeam(user.team)) {
        throw Object.assign(new Error('Ο χρήστης δεν βρέθηκε'), {
            status: 404,
            code: 'USER_NOT_FOUND'
        });
    }
    const sessionTeamNormalized = normalizeRequiredUserTeam(sessionTeam);
    if (
        sessionTeamNormalized !== CANONICAL_ALL_TEAMS_CODE &&
        normalizeUserTeam(user.team) !== sessionTeamNormalized
    ) {
        throw Object.assign(new Error('Ο χρήστης δεν βρέθηκε'), {
            status: 404,
            code: 'USER_NOT_FOUND'
        });
    }
    return user;
}

module.exports = {
    CANONICAL_ALL_TEAMS_CODE,
    normalizeUserTeam,
    isValidUserTeam,
    normalizeRequiredUserTeam,
    canManageAllUserTeams,
    buildManagedUserFilter,
    buildManagedUserIdentityFilter,
    assertUserWithinManagedTeamScope,
    teamScopeError
};
