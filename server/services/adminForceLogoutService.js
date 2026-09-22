'use strict';

const mongoose = require('mongoose');
const UserModel = require('../models/userModel');
const UsageLogModel = require('../models/usageLog');
const { buildAdminManagedUserFilter, buildAdminManagedUserIdentityFilter,
    assertAdminCanManageTarget } =
    require('./adminUserManagementScopeService');

function failure(status, message) {
    return Object.assign(new Error(message), { status });
}

function storeCall(store, method, ...args) {
    return new Promise((resolve, reject) => store[method](...args, (error, value) =>
        error ? reject(error) : resolve(value)));
}

async function currentSessions(store) {
    if (!store || typeof store.all !== 'function' || typeof store.get !== 'function' ||
        typeof store.destroy !== 'function') throw new Error('Session store unavailable');
    const listed = await storeCall(store, 'all');
    if (!listed || typeof listed !== 'object') throw new Error('Session enumeration unavailable');
    if (!Array.isArray(listed)) {
        return Object.entries(listed).filter(([, session]) => session?.userId)
            .map(([sid, session]) => ({ sid, userId: String(session.userId) }));
    }
    // connect-mongo all() returns sessions without their IDs. Read only IDs
    // from its own collection, then verify each one through store.get().
    // Session deletion still goes exclusively through store.destroy().
    if (!store.collectionP || store.options?.transformId) throw new Error('Session IDs unavailable');
    const collection = await store.collectionP;
    const ids = await collection.find({
        $or: [{ expires: { $exists: false } }, { expires: { $gt: new Date() } }]
    }, { projection: { _id: 1 } }).toArray();
    const sessions = await Promise.all(ids.map(async ({ _id }) => {
        const sid = String(_id);
        const session = await storeCall(store, 'get', sid);
        return session?.userId ? { sid, userId: String(session.userId) } : null;
    }));
    return sessions.filter(Boolean);
}

function buildActiveManagedUserFilter(actor, ids) {
    const userIds = ids.filter((id) => typeof id === 'string' && /^[a-f\d]{24}$/i.test(id) &&
        mongoose.isValidObjectId(id)).map((id) => new mongoose.Types.ObjectId(id));
    return { ...buildAdminManagedUserFilter(actor),
        _id: mongoose.trusted({ $in: userIds }), situation: 'A' };
}

async function listActiveManagedUsers({ store, actor, userModel = UserModel }) {
    const sessions = await currentSessions(store);
    const counts = new Map();
    for (const session of sessions) {
        if (session.userId.toLowerCase() === actor.userId.toLowerCase() ||
            !/^[a-f\d]{24}$/i.test(session.userId) || !mongoose.isValidObjectId(session.userId)) continue;
        const userId = session.userId.toLowerCase();
        counts.set(userId, (counts.get(userId) || 0) + 1);
    }
    if (!counts.size) return [];
    const users = await userModel.find(buildActiveManagedUserFilter(actor, [...counts.keys()]))
        .select('_id kod firstName lastName email team').lean();
    return users.map((user) => ({
        id: String(user._id),
        name: [user.lastName, user.firstName].filter(Boolean).join(' ').trim(),
        label: [user.kod, [user.lastName, user.firstName].filter(Boolean).join(' ').trim(),
            [user.email, user.team].filter(Boolean).join(' · ')].filter(Boolean).join(' — ') +
            ` — ${counts.get(String(user._id))} ${counts.get(String(user._id)) === 1
                ? 'ενεργή συνεδρία' : 'ενεργές συνεδρίες'}`,
        sessionCount: counts.get(String(user._id))
    })).sort((left, right) => left.label.localeCompare(right.label, 'el'));
}

async function forceLogoutUser({ store, actor, targetId, userModel = UserModel,
    usageModel = UsageLogModel, emit, log, now = () => new Date() }) {
    if (typeof targetId !== 'string' || !/^[a-f\d]{24}$/i.test(targetId) ||
        !mongoose.isValidObjectId(targetId)) throw failure(400, 'Μη έγκυρος χρήστης.');
    if (targetId.toLowerCase() === actor.userId.toLowerCase()) {
        throw failure(400, 'Δεν μπορείτε να αποσυνδέσετε την τρέχουσα συνεδρία σας από αυτή τη φόρμα.');
    }
    const target = await userModel.findOne(buildAdminManagedUserIdentityFilter(actor, targetId))
        .select('_id team privileges').lean();
    if (!target) throw failure(404, 'Ο χρήστης δεν βρέθηκε.');
    assertAdminCanManageTarget(actor, target);
    const sessions = (await currentSessions(store)).filter((session) => session.userId === String(target._id));
    const outcomes = await Promise.allSettled(sessions.map(async (session) => {
        await storeCall(store, 'destroy', session.sid);
        if (await storeCall(store, 'get', session.sid)) throw new Error('Session remains active');
    }));
    const destroyedSessions = outcomes.filter((result) => result.status === 'fulfilled').length;
    if (outcomes.some((result) => result.status === 'rejected')) {
        throw new Error('Session destruction incomplete');
    }
    if ((await currentSessions(store)).some((session) => session.userId === String(target._id))) {
        throw new Error('Target session remains active');
    }
    const timestamp = now();
    try {
        const openLogs = await usageModel.find({ userId: target._id, logoutAt: null })
            .select('_id loginAt').lean();
        for (const entry of openLogs) {
            await usageModel.updateOne({ _id: entry._id, logoutAt: null }, { $set: {
                logoutAt: timestamp,
                lastSeen: timestamp,
                durationMs: Math.max(0, timestamp - new Date(entry.loginAt)),
                closedBy: 'admin_forced_logout'
            } });
        }
    } catch (error) {
        log?.error('Admin force logout UsageLog update failed', { actorId: actor.userId,
            targetId: String(target._id), timestamp: timestamp.toISOString() });
    }
    if (destroyedSessions) {
        try {
            emit?.(String(target._id), 'admin:force-logout', {});
        } catch (error) {
            log?.error('Admin force logout notification failed', { actorId: actor.userId,
                targetId: String(target._id), timestamp: timestamp.toISOString() });
        }
    }
    log?.info('Admin force logout', { actorId: actor.userId, targetId: String(target._id),
        destroyedSessions, timestamp: timestamp.toISOString() });
    return { destroyedSessions, message: destroyedSessions
        ? 'Ο χρήστης αποσυνδέθηκε επιτυχώς.' : 'Ο χρήστης δεν είχε ενεργές συνεδρίες.' };
}

module.exports = { currentSessions, buildActiveManagedUserFilter, listActiveManagedUsers, forceLogoutUser };
