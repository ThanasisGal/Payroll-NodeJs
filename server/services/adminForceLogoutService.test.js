'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { currentSessions, buildActiveManagedUserFilter, listActiveManagedUsers, forceLogoutUser } = require('./adminForceLogoutService');
const UsageLogModel = require('../models/usageLog');
const UserModel = require('../models/userModel');

const actor = '65809f8f971f6f52a8408e7a';
const target = '65809f8f971f6f52a8408e7b';
const other = '65809f8f971f6f52a8408e7c';

test('active user filter remains castable with real UserModel and sanitizeFilter', () => {
    const previous = mongoose.get('sanitizeFilter');
    try {
        mongoose.set('sanitizeFilter', true);
        const filter = buildActiveManagedUserFilter({ userId: actor, role: 'A', team: 'TEAM' }, [target, 'invalid']);
        assert.equal(filter._id.$in.length, 1);
        assert.ok(filter._id.$in[0] instanceof mongoose.Types.ObjectId);
        const query = UserModel.find(filter);
        mongoose.sanitizeFilter(query.getFilter());
        assert.doesNotThrow(() => query.cast(UserModel));
        assert.equal(String(query.getFilter()._id.$in[0]), target);
    } finally {
        mongoose.set('sanitizeFilter', previous);
    }
});

test('UsageLog accepts the canonical admin force logout reason', () => {
    assert.ok(UsageLogModel.schema.path('closedBy').enumValues.includes('admin_forced_logout'));
});

function store(initial) {
    const sessions = { ...initial };
    const destroyed = [];
    return {
        sessions, destroyed,
        all(callback) { callback(null, { ...sessions }); },
        get(sid, callback) { callback(null, sessions[sid] || null); },
        destroy(sid, callback) { destroyed.push(sid); delete sessions[sid]; callback(null); }
    };
}

function userModel(users) {
    const matches = (user, filter) =>
        (!filter._id || (filter._id.$in
            ? filter._id.$in.some((id) => String(id) === String(user._id))
            : String(filter._id) === String(user._id))) &&
        (!filter.team || filter.team.test(user.team)) &&
        (!filter.privileges || filter.privileges.$in.includes(user.privileges)) &&
        (!filter.situation || user.situation === filter.situation);
    return {
        find(filter) {
            assert.ok(filter._id.$in);
            return { select() { return this; }, lean: async () => users.filter((user) => matches(user, filter)) };
        },
        findOne(filter) {
            return { select() { return this; }, lean: async () => users.find((user) => matches(user, filter)) || null };
        }
    };
}

test('dropdown deduplicates active scoped sessions and excludes actor', async () => {
    const s = store({ a: { userId: actor }, b: { userId: target }, c: { userId: target },
        d: { userId: other }, e: { userId: '65809f8f971f6f52a8408e7d' } });
    const users = [
        { _id: target, firstName: 'N', lastName: 'T', email: 't@example.invalid', kod: '0022', team: 'TEAM', situation: 'A' },
        { _id: other, firstName: 'O', lastName: 'X', email: 'o@example.invalid', team: 'OTHER', situation: 'A' },
        { _id: '65809f8f971f6f52a8408e7d', team: 'TEAM', situation: 'I' }
    ];
    const result = await listActiveManagedUsers({ store: s, actor: { userId: actor, role: 'A', team: 'TEAM' }, userModel: userModel(users) });
    assert.equal(result.length, 1);
    assert.equal(result[0].id, target);
    assert.equal(result[0].sessionCount, 2);
    assert.match(result[0].label, /2 ενεργές συνεδρίες/);
    assert.ok(!JSON.stringify(result).includes('sid'));
    assert.deepEqual(await listActiveManagedUsers({ store: s, actor: { userId: actor, role: 'A', team: 'THA' },
        userModel: userModel(users) }).then((items) => items.map((item) => item.id).sort()), [other, target].sort());
});

test('connect-mongo array enumeration obtains IDs from its store and verifies sessions with get', async () => {
    const s = store({ sid1: { userId: target }, sid2: { userId: other } });
    s.all = (callback) => callback(null, Object.values(s.sessions));
    s.collectionP = Promise.resolve({ find() { return { toArray: async () => [{ _id: 'sid1' }, { _id: 'sid2' }] }; } });
    s.options = {};
    assert.deepEqual(await currentSessions(s), [
        { sid: 'sid1', userId: target }, { sid: 'sid2', userId: other }
    ]);
});

test('force logout destroys only target sessions, closes every open usage log, then emits', async () => {
    const s = store({ actorSid: { userId: actor }, target1: { userId: target },
        target2: { userId: target }, otherSid: { userId: other } });
    const events = [], updates = [], audit = [];
    const logs = [{ _id: 'log1', loginAt: new Date('2026-01-01T00:00:00Z') },
        { _id: 'log2', loginAt: new Date('2026-01-01T01:00:00Z') }];
    const usageModel = {
        find(filter) { assert.equal(filter.userId, target); return { select() { return this; }, lean: async () => logs }; },
        async updateOne(filter, update) { updates.push({ filter, update }); }
    };
    const result = await forceLogoutUser({ store: s, actor: { userId: actor, role: 'A', team: 'TEAM' }, targetId: target,
        userModel: userModel([{ _id: target, team: 'TEAM' }]), usageModel,
        emit: (...args) => events.push(args), log: { info: (...args) => audit.push(args) },
        now: () => new Date('2026-01-01T02:00:00Z') });
    assert.equal(result.destroyedSessions, 2);
    assert.deepEqual(Object.keys(result), ['destroyedSessions', 'message']);
    assert.deepEqual(s.destroyed, ['target1', 'target2']);
    assert.ok(s.sessions.actorSid && s.sessions.otherSid);
    assert.deepEqual(events, [[target, 'admin:force-logout', {}]]);
    assert.equal(updates.length, 2);
    assert.deepEqual(updates.map((item) => item.update.$set.durationMs), [7200000, 3600000]);
    assert.ok(updates.every((item) => item.update.$set.closedBy === 'admin_forced_logout' &&
        item.update.$set.lastSeen instanceof Date && item.update.$set.logoutAt instanceof Date));
    assert.equal(audit[0][1].destroyedSessions, 2);
    assert.ok(!JSON.stringify(audit).includes('target1'));
});

test('zero sessions succeeds without notification and reconciles any open usage log', async () => {
    const events = [];
    const updates = [];
    const result = await forceLogoutUser({ store: store({}), actor: { userId: actor, role: 'A', team: 'TEAM' }, targetId: target,
        userModel: userModel([{ _id: target, team: 'TEAM' }]),
        usageModel: { find() { return { select() { return this; }, lean: async () =>
            [{ _id: 'stale-log', loginAt: new Date('2026-01-01T00:00:00Z') }] }; },
        async updateOne(filter, update) { updates.push({ filter, update }); } },
        emit: (...args) => events.push(args) });
    assert.equal(result.destroyedSessions, 0);
    assert.match(result.message, /δεν είχε ενεργές συνεδρίες/);
    assert.equal(events.length, 0);
    assert.equal(updates.length, 1);
    assert.equal(updates[0].update.$set.closedBy, 'admin_forced_logout');
});

test('invalid, self, unknown and out-of-scope targets fail before destruction', async () => {
    const s = store({ targetSid: { userId: target } });
    const model = userModel([{ _id: target, team: 'OTHER' }]);
    for (const [targetId, status] of [['invalid', 400], [actor, 400], [actor.toUpperCase(), 400], [target, 404]]) {
        await assert.rejects(forceLogoutUser({ store: s, actor: { userId: actor, role: 'A', team: 'TEAM' }, targetId,
            userModel: model }), (error) => error.status === status);
    }
    assert.deepEqual(s.destroyed, []);
});

test('session destruction failure never reports success or emits', async () => {
    const s = store({ one: { userId: target }, two: { userId: target } });
    s.destroy = (sid, callback) => sid === 'two' ? callback(new Error('store failure')) : callback(null);
    const emitted = [];
    await assert.rejects(forceLogoutUser({ store: s, actor: { userId: actor, role: 'A', team: 'TEAM' }, targetId: target,
        userModel: userModel([{ _id: target, team: 'TEAM' }]),
        usageModel: { find() { assert.fail('usage log must wait for complete destruction'); } },
        emit: (...args) => emitted.push(args) }));
    assert.deepEqual(emitted, []);
});

test('UsageLog failure cannot restore already destroyed sessions', async () => {
    const s = store({ one: { userId: target } });
    const result = await forceLogoutUser({ store: s, actor: { userId: actor, role: 'A', team: 'TEAM' }, targetId: target,
        userModel: userModel([{ _id: target, team: 'TEAM' }]),
        usageModel: { find() { throw new Error('audit unavailable'); } },
        log: { error() {}, info() {} } });
    assert.equal(result.destroyedSessions, 1);
    assert.deepEqual(s.destroyed, ['one']);
});

test('Supervisor cannot force logout A/S, self, or another team; THA Admin can target other teams', async () => {
    const s = store({ actorSid: { userId: actor }, targetSid: { userId: target } });
    const user = { _id: target, team: 'OTHER', privileges: 'HR' };
    const model = userModel([user]);
    const supervisor = { userId: actor, role: 'S', team: 'THA' };
    for (const candidate of [user, { ...user, team: 'THA', privileges: 'A' },
        { ...user, team: 'THA', privileges: 'S' }]) {
        await assert.rejects(forceLogoutUser({ store: s, actor: supervisor, targetId: target,
            userModel: userModel([candidate]) }), (error) => error.status === 404);
        assert.deepEqual(s.destroyed, []);
    }
    await assert.rejects(forceLogoutUser({ store: s, actor: supervisor, targetId: actor,
        userModel: model }), (error) => error.status === 400);
    const result = await forceLogoutUser({ store: s,
        actor: { userId: actor, role: 'A', team: 'THA' }, targetId: target,
        userModel: model, usageModel: { find() { return { select() { return this; }, lean: async () => [] }; } } });
    assert.equal(result.destroyedSessions, 1);
    assert.deepEqual(s.destroyed, ['targetSid']);
    assert.ok(s.sessions.actorSid);
});

test('Supervisor sees and disconnects only same-team lower-role sessions', async () => {
    const lower = target;
    const admin = other;
    const otherTeam = '65809f8f971f6f52a8408e7d';
    const s = store({ actorSid: { userId: actor }, lower1: { userId: lower },
        lower2: { userId: lower }, adminSid: { userId: admin },
        foreignSid: { userId: otherTeam } });
    const users = [{ _id: lower, team: 'TEAM', privileges: 'HR', situation: 'A' },
        { _id: admin, team: 'TEAM', privileges: 'A', situation: 'A' },
        { _id: otherTeam, team: 'OTHER', privileges: 'C', situation: 'A' }];
    const supervisor = { userId: actor, role: 'S', team: 'TEAM' };
    const listed = await listActiveManagedUsers({ store: s, actor: supervisor,
        userModel: userModel(users) });
    assert.deepEqual(listed.map((item) => item.id), [lower]);
    assert.equal(listed[0].sessionCount, 2);
    const result = await forceLogoutUser({ store: s, actor: supervisor, targetId: lower,
        userModel: userModel(users), usageModel: {
            find() { return { select() { return this; }, lean: async () => [] }; }
        } });
    assert.equal(result.destroyedSessions, 2);
    assert.deepEqual(s.destroyed, ['lower1', 'lower2']);
    assert.ok(s.sessions.actorSid && s.sessions.adminSid && s.sessions.foreignSid);
});
