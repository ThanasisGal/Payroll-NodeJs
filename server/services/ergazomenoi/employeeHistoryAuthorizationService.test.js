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
