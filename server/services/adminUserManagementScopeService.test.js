'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const UserModel = require('../models/userModel');
const { buildAdminManagedUserFilter, buildAdminManagedUserIdentityFilter,
    assertAdminCanManageTarget, getAssignableRolesForActor } =
    require('./adminUserManagementScopeService');

const actorId = '65809f8f971f6f52a8408e7a';
const targetId = '65809f8f971f6f52a8408e7b';

test('Supervisor manages only lower roles on its own normalized team and never self', () => {
    const actor = { userId: actorId, role: 'S', team: 'TEAM1' };
    for (const role of ['HR', 'C', 'U', 'V']) {
        assert.doesNotThrow(() => assertAdminCanManageTarget(actor,
            { _id: targetId, team: ' team1 ', privileges: role }));
        assert.throws(() => assertAdminCanManageTarget(actor,
            { _id: targetId, team: 'TEAM2', privileges: role }), { status: 404 });
    }
    for (const role of ['A', 'S']) {
        assert.throws(() => assertAdminCanManageTarget(actor,
            { _id: targetId, team: 'TEAM1', privileges: role }), { status: 404 });
    }
    assert.throws(() => assertAdminCanManageTarget(actor,
        { _id: actorId, team: 'TEAM1', privileges: 'HR' }), { status: 404 });
    assert.throws(() => buildAdminManagedUserIdentityFilter(actor, actorId), { status: 404 });
});

test('THA Supervisor cannot manage other teams, while THA Admin can manage every role and team', () => {
    const supervisor = { userId: actorId, role: 'S', team: 'THA' };
    const admin = { userId: actorId, role: 'A', team: 'THA' };
    assert.throws(() => assertAdminCanManageTarget(supervisor,
        { _id: targetId, team: 'OTHER', privileges: 'HR' }), { status: 404 });
    assert.deepEqual(buildAdminManagedUserFilter(admin), {});
    for (const role of ['A', 'S', 'HR', 'C', 'U', 'V']) {
        assert.doesNotThrow(() => assertAdminCanManageTarget(admin,
            { _id: targetId, team: 'OTHER', privileges: role }));
    }
    assert.throws(() => assertAdminCanManageTarget({ ...admin, team: 'TEAM1' },
        { _id: targetId, team: 'OTHER', privileges: 'HR' }), { status: 404 });
});

test('Supervisor query operators survive sanitizeFilter and cast with the real UserModel', () => {
    const previous = mongoose.get('sanitizeFilter');
    try {
        mongoose.set('sanitizeFilter', true);
        const actor = { userId: actorId, role: 'S', team: 'TEAM1' };
        for (const filter of [buildAdminManagedUserFilter(actor),
            buildAdminManagedUserIdentityFilter(actor, targetId)]) {
            const query = UserModel.find(filter);
            mongoose.sanitizeFilter(query.getFilter());
            assert.doesNotThrow(() => query.cast(UserModel));
        }
    } finally {
        mongoose.set('sanitizeFilter', previous);
    }
});

test('Supervisor role choices exclude A/S and retain legacy U only when editing U', () => {
    const actor = { userId: actorId, role: 'S', team: 'TEAM1' };
    assert.deepEqual(getAssignableRolesForActor(actor).map((item) => item.value), ['HR', 'C', 'V']);
    assert.deepEqual(getAssignableRolesForActor(actor, 'U').map((item) => item.value), ['HR', 'C', 'V', 'U']);
    assert.ok(getAssignableRolesForActor({ ...actor, role: 'A' })
        .some((item) => item.value === 'A'));
});
