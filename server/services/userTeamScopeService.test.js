const assert = require('assert');
const {
    CANONICAL_ALL_TEAMS_CODE,
    normalizeUserTeam,
    isValidUserTeam,
    normalizeRequiredUserTeam,
    canManageAllUserTeams,
    buildManagedUserFilter,
    assertUserWithinManagedTeamScope
} = require('./userTeamScopeService');

assert.strictEqual(CANONICAL_ALL_TEAMS_CODE, 'THA');
assert.strictEqual(normalizeUserTeam(' tha '), 'THA');
assert.strictEqual(normalizeUserTeam('team1'), 'TEAM1');
assert.strictEqual(normalizeUserTeam(' TEAM2 '), 'TEAM2');
for (const value of [null, undefined, 1, {}, [], '']) assert.strictEqual(normalizeUserTeam(value), '');

for (const value of ['THA', 'TEAM1', 'team-a', ' BLG_2 ']) assert.strictEqual(isValidUserTeam(value), true);
for (const value of ['', '   ', '$ne', 'TEAM 1', '.', {}, 42]) assert.strictEqual(isValidUserTeam(value), false);
assert.strictEqual(canManageAllUserTeams(' tha '), true);
assert.strictEqual(canManageAllUserTeams('THA2'), false);

assert.deepStrictEqual(buildManagedUserFilter('THA'), {});
const team1Filter = buildManagedUserFilter(' team1 ');
assert.ok(team1Filter.team instanceof RegExp);
assert.strictEqual(team1Filter.team.test('TEAM1'), true);
assert.strictEqual(team1Filter.team.test(' team1 '), true);
assert.strictEqual(team1Filter.team.test('TEAM2'), false);
for (const invalid of ['', '   ', null, '$ne']) {
    assert.throws(() => buildManagedUserFilter(invalid), (error) => error.code === 'INVALID_TEAM_SCOPE');
}

assert.strictEqual(assertUserWithinManagedTeamScope('THA', { team: 'TEAM2' }).team, 'TEAM2');
assert.strictEqual(assertUserWithinManagedTeamScope('team1', { team: ' TEAM1 ' }).team, ' TEAM1 ');
assert.throws(
    () => assertUserWithinManagedTeamScope('TEAM1', { team: 'TEAM2' }),
    (error) => error.code === 'USER_NOT_FOUND' && error.status === 404
);
assert.throws(() => normalizeRequiredUserTeam({}), (error) => error.code === 'INVALID_TEAM_SCOPE');

console.log('PASS central managed-user team scope normalization and fail-closed contract');
