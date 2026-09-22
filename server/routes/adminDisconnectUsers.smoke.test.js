'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const express = require('express');
const UserModel = require('../models/userModel');
const UsageLogModel = require('../models/usageLog');
const { requireAdminOrSupervisorRole } = require('../middlewares/requireAdminRole');
const controller = require('../controllers/disconnectUsersController');

const actor = '65809f8f971f6f52a8408e7a';
const target = '65809f8f971f6f52a8408e7b';
const other = '65809f8f971f6f52a8408e7c';

test('local HTTP GET and POST use real controller with fake sessions only', async () => {
    const originals = { findById: UserModel.findById, find: UserModel.find,
        findOne: UserModel.findOne, usageFind: UsageLogModel.find };
    const sessions = { actorSid: { userId: actor }, first: { userId: target },
        second: { userId: target }, otherSid: { userId: other } };
    const store = {
        all(callback) { callback(null, { ...sessions }); },
        get(sid, callback) { callback(null, sessions[sid] || null); },
        destroy(sid, callback) { delete sessions[sid]; callback(null); }
    };
    let role = 'A';
    UserModel.findById = () => ({ select() { return this; }, lean: async () =>
        ({ _id: actor, privileges: role, situation: 'A', team: 'THA' }) });
    UserModel.find = () => ({ select() { return this; }, lean: async () => [
        { _id: target, kod: '0022', firstName: 'Target', lastName: 'User',
            email: 'target@example.invalid', team: 'THA' },
        { _id: other, firstName: 'Other', lastName: 'User',
            email: 'other@example.invalid', team: 'THA' }
    ] });
    UserModel.findOne = (filter) => ({ select() { return this; }, lean: async () =>
        String(filter._id) === target ? { _id: target, team: 'THA' } : null });
    UsageLogModel.find = () => ({ select() { return this; }, lean: async () => [] });

    const app = express();
    app.set('view engine', 'ejs');
    app.set('views', path.resolve(__dirname, '../../views'));
    app.use(express.json());
    app.use((req, res, next) => {
        req.session = { userId: actor, userTeam: 'THA' };
        req.sessionStore = store;
        res.locals.csrfToken = 'smoke-csrf';
        res.locals.script = (key) => `https://cdn.example.invalid/static/min.js/${key}.js`;
        next();
    });
    app.get('/admin/disconnect-users', requireAdminOrSupervisorRole, controller.renderPage);
    app.post('/admin/disconnect-users', requireAdminOrSupervisorRole, controller.disconnectUser);
    const server = app.listen(0, '127.0.0.1');
    try {
        await new Promise((resolve) => server.once('listening', resolve));
        const base = `http://127.0.0.1:${server.address().port}`;
        for (const currentRole of ['A', 'S', 'HR', 'C', 'U', 'V']) {
            role = currentRole;
            const response = await fetch(`${base}/admin/disconnect-users`);
            assert.equal(response.status, ['A', 'S'].includes(role) ? 200 : 403, role);
            if (response.status === 200) {
                const html = await response.text();
                assert.match(html, /static\/min\.js\/admin\/disconnectUsers\.js/);
                assert.match(html, /name="_csrf" value="smoke-csrf"/);
                assert.match(html, /<select[^>]+id="disconnectUsersTarget"/);
                assert.match(html, /id="disconnectUsersSubmit"/);
                assert.match(html, /<a href="\/mainapp"[^>]*>Επιστροφή<\/a>/);
                assert.doesNotMatch(html, /<a href="\/admin"[^>]*>Επιστροφή<\/a>/);
                assert.doesNotMatch(html, new RegExp(`value="${actor}"`));
            }
        }
        role = 'A';
        const response = await fetch(`${base}/admin/disconnect-users`, { method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': 'smoke-csrf' },
            body: JSON.stringify({ userId: target }) });
        const payload = await response.json();
        assert.equal(response.status, 200);
        assert.equal(payload.success, true);
        assert.equal(payload.destroyedSessions, 2);
        assert.ok(sessions.actorSid && sessions.otherSid);
        assert.equal(sessions.first, undefined);
        assert.equal(sessions.second, undefined);
        assert.deepEqual(Object.keys(payload).sort(), ['destroyedSessions', 'message', 'success']);
        assert.doesNotMatch(JSON.stringify(payload), /sid|cookie|secret|sessionId|userId/i);
    } finally {
        await new Promise((resolve) => server.close(resolve));
        UserModel.findById = originals.findById;
        UserModel.find = originals.find;
        UserModel.findOne = originals.findOne;
        UsageLogModel.find = originals.usageFind;
    }
});
