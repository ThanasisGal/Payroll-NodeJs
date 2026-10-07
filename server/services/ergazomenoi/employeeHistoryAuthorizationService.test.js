'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const UserModel = require('../../models/userModel');
const {
    canManageEmployeeHistory
} = require('./employeeHistoryAuthorizationService');

function queryFor(user, capture) {
    return {
        select(fields) {
            capture.fields = fields;
            return this;
        },
        async lean() {
            return user;
        }
    };
}

test('employee history management capability requires active Admin in canonical THA team', async () => {
    const originalFindById = UserModel.findById;
    const cases = [
        [{ privileges: 'A', team: 'THA', situation: 'A' }, true],
        [{ privileges: ' a ', team: ' tha ', situation: ' a ' }, true],
        [{ privileges: 'A', team: 'BLG', situation: 'A' }, false],
        [{ privileges: 'HR', team: 'THA', situation: 'A' }, false],
        [{ privileges: 'A', team: 'THA', situation: 'I' }, false],
        [null, false]
    ];

    try {
        for (const [user, expected] of cases) {
            const capture = {};
            UserModel.findById = (userId) => {
                capture.userId = userId;
                return queryFor(user, capture);
            };
            assert.equal(await canManageEmployeeHistory('actual-user-id'), expected);
            assert.equal(capture.userId, 'actual-user-id');
            assert.equal(capture.fields, 'privileges team situation');
        }
        assert.equal(await canManageEmployeeHistory(''), false);
    } finally {
        UserModel.findById = originalFindById;
    }
});

const { ACCESS_MODES, accessForUser, getEmployeeHistoryAccess,
    assertEmployeeHistoryOperationsAuthorized } = require('./employeeHistoryAuthorizationService');
const { userModel } = require('../../../test/fixtures/employeeHistorySupervisor');

// Recovered from the protected archive: team-independent active Supervisor,
// Admin-only broad compatibility, persisted target/anchor and mixed batch checks.
for (const team of ['THA', 'BLG', 'OTHER']) {
    test(`active Supervisor in ${team} receives only row scope`, async () => {
        const access = await getEmployeeHistoryAccess('authenticated-user', {
            userModel: userModel({ privileges: 'S', situation: 'A', team }) });
        assert.equal(access.mode, ACCESS_MODES.SUPERVISOR_PROBLEM_SCOPE);
        assert.equal(await canManageEmployeeHistory('authenticated-user', {
            userModel: userModel({ privileges: 'S', situation: 'A', team }) }), false);
    });
}
for (const [name, user] of [
    ['inactive Supervisor', { privileges: 'S', situation: 'I', team: 'THA' }],
    ['HR', { privileges: 'HR', situation: 'A', team: 'THA' }],
    ['Customer', { privileges: 'C', situation: 'A', team: 'THA' }],
    ['User', { privileges: 'U', situation: 'A', team: 'THA' }],
    ['Visitor', { privileges: 'V', situation: 'A', team: 'THA' }],
    ['invalid', { privileges: '?', situation: 'A', team: 'THA' }],
    ['missing', null], ['non-THA Admin', { privileges: 'A', situation: 'A', team: 'BLG' }]
]) test(`${name} has no History mutation mode`, () => {
    assert.equal(accessForUser(user).mode, ACCESS_MODES.NONE);
});

test('actor query uses authenticated ID and the active transaction, with narrow projection', async () => {
    const session = {}, captures = [];
    await getEmployeeHistoryAccess('session-user-id', { session, userModel: userModel(undefined, value => captures.push(value)) });
    assert.deepEqual(captures, [{ id: 'session-user-id', fields: 'privileges team situation', session }]);
});

test('Admin bypasses unresolved row scope while NONE and empty Supervisor batch fail closed', () => {
    assert.doesNotThrow(() => assertEmployeeHistoryOperationsAuthorized({ accessMode: ACCESS_MODES.ADMIN_FULL }));
    for (const accessMode of [ACCESS_MODES.NONE, ACCESS_MODES.SUPERVISOR_PROBLEM_SCOPE]) {
        assert.throws(() => assertEmployeeHistoryOperationsAuthorized({ accessMode }),
            error => error.statusCode === 403);
    }
});

test('Supervisor scope IDs alone cannot authorize a nonpersisted target or anchor', () => {
    for (const operation of [{ state: 'modified', historyId: 'invented' },
        { state: 'inserted', anchorHistoryId: 'invented' }]) {
        assert.throws(() => assertEmployeeHistoryOperationsAuthorized({
            accessMode: ACCESS_MODES.SUPERVISOR_PROBLEM_SCOPE, operations: [operation],
            originalHistoryRows: [{ _id: 'persisted' }],
            problemScope: { deterministicallyResolved: true, problematicHistoryIds: ['invented'] }
        }), error => error.code === 'EMPLOYEE_HISTORY_SUPERVISOR_SCOPE_FORBIDDEN');
    }
});
