'use strict';

const assert = require('assert/strict');
const {
    CRITICAL_EMPLOYMENT_DECISION_ROLES,
    isCriticalEmploymentDecisionRoleAllowed,
    assertCriticalEmploymentDecisionRole,
    requireCriticalEmploymentDecisionRole
} = require('./apasxoliseisCriticalActionAuthorizationService');

assert.deepEqual(CRITICAL_EMPLOYMENT_DECISION_ROLES, ['A', 'S', 'HR']);
for (const role of ['A', 'S', 'HR']) {
    assert.equal(isCriticalEmploymentDecisionRoleAllowed(role), true);
    assert.equal(assertCriticalEmploymentDecisionRole({ userRole: role }), role);
}
for (const role of ['U', 'C', 'V']) {
    assert.equal(isCriticalEmploymentDecisionRoleAllowed(role), false);
    assert.throws(() => assertCriticalEmploymentDecisionRole({ userRole: role }),
        (error) => error.statusCode === 403);
}
let nextCalled = false;
requireCriticalEmploymentDecisionRole({ session: { userRole: 'HR' } }, {}, () => { nextCalled = true; });
assert.equal(nextCalled, true);
let denied;
requireCriticalEmploymentDecisionRole({ session: { userRole: 'U' } }, {
    status(code) { denied = { code }; return this; },
    json(body) { denied.body = body; return body; }
}, () => assert.fail('denied role reached next'));
assert.equal(denied.code, 403);

console.log('critical employment decision authorization tests passed (6 role contracts)');
