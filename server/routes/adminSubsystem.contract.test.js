'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ejs = require('ejs');
const vm = require('node:vm');
const { isAdminOrSupervisorRole } = require('../constants/userRoles');
const { requireAdminOrSupervisorRole } = require('../middlewares/requireAdminRole');
const UserModel = require('../models/userModel');
const disconnectUsersController = require('../controllers/disconnectUsersController');

const root = path.resolve(__dirname, '../..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('every declared Admin route uses the database-backed A/S middleware', () => {
    const userRoutes = read('server/routes/usersRoute.js');
    const adminRoutes = read('server/routes/adminRoutes.js');
    const routeFiles = fs.readdirSync(path.join(root, 'server/routes')).filter((name) => name.endsWith('.js'));
    for (const name of routeFiles) {
        if (name === 'usersRoute.js' || name === 'adminRoutes.js') continue;
        assert.doesNotMatch(read(`server/routes/${name}`), /router\.(?:get|post|put|patch|delete)\(\s*['"]\/admin(?:\/|['"])/,
            `Admin route in unreviewed file ${name}`);
    }
    const declared = [...userRoutes.matchAll(/router\.(?:get|post|put|patch|delete)\(\s*['"](\/admin(?:\/[^'"]*)?)['"]\s*,\s*([^,\s)]+)/g)];
    assert.ok(declared.length >= 20);
    for (const match of declared) assert.equal(match[2], 'requireAdminOrSupervisorRole', match[1]);
    const mounted = [...adminRoutes.matchAll(/router\.(?:get|post|put|patch|delete)\(\s*['"]([^'"]+)['"]\s*,\s*([^,\s)]+)/g)];
    assert.equal(mounted.length, 2);
    for (const match of mounted) assert.equal(match[2], 'requireAdminOrSupervisorRole', match[1]);
    assert.match(read('app.js'), /app\.use\('\/api\/admin', adminRoutes\)/);
    assert.match(userRoutes, /router\.post\('\/admin\/dhmioyrgia-arxeion-neas-xrhshs', requireAdminOrSupervisorRole,/);
    assert.match(adminRoutes, /requireAdminOrSupervisorRole,\s*uploadTextTemplate\.array/);
});

test('sidebar renders every Admin item authorized only for A and S', () => {
    const source = read('views/partials/sidebar.ejs');
    const hrefs = ['/admin', '/admin/user-privileges', '/admin/disconnect-users',
        '/api/admin/aws_s3', '/admin/active-sessions', '/admin/usage-report'];
    for (const role of ['A', 'S', 'HR', 'C', 'U', 'V']) {
        const html = ejs.render(source, { userRole: role, isAdminOrSupervisorRole,
            NODE_ENV: 'test', nonce: 'test', userId: '', script: () => '/test.js' });
        for (const href of hrefs) {
            const tag = [...html.matchAll(/<a\b[^>]*>/g)].map((match) => match[0])
                .find((value) => value.includes(`href="${href}"`));
            if (['A', 'S'].includes(role)) {
                assert.ok(tag, `${role} missing ${href}`);
                assert.match(tag, /data-sidebar-authorized="true"/);
            } else if (tag) {
                assert.match(tag, /data-sidebar-authorized="false"/, `${role} authorized ${href}`);
            }
        }
        if (!['A', 'S'].includes(role)) {
            assert.doesNotMatch(html, /href="\/admin\/disconnect-users"/);
            assert.doesNotMatch(html, /href="\/admin\/user-privileges"/);
        }
    }
    assert.ok(source.indexOf('id="li111"') < source.indexOf('id="li112"'));
    assert.ok(source.indexOf('id="li112"') < source.indexOf('id="li113"'));
});

test('A and S can open the disconnect form; HR, C, U and V receive 403', async () => {
    const original = UserModel.findById;
    try {
        for (const role of ['A', 'S', 'HR', 'C', 'U', 'V']) {
            UserModel.findById = () => ({ select() { return this; }, lean: async () =>
                ({ _id: '65809f8f971f6f52a8408e7a', privileges: role, situation: 'A', team: 'THA' }) });
            const req = { session: { userId: '65809f8f971f6f52a8408e7a', userTeam: 'THA' },
                sessionStore: { all(callback) { callback(null, {}); }, get() {}, destroy() {} } };
            const res = { statusCode: 200, status(code) { this.statusCode = code; return this; },
                send(message) { this.message = message; return this; },
                render(view, locals) { this.view = view; this.locals = locals; return this; } };
            let authorized = false;
            await requireAdminOrSupervisorRole(req, res, () => { authorized = true; });
            if (authorized) await disconnectUsersController.renderPage(req, res);
            if (['A', 'S'].includes(role)) {
                assert.equal(res.view, 'admin/disconnectUsers');
                assert.deepEqual(res.locals.users, []);
            } else {
                assert.equal(res.statusCode, 403, role);
                assert.equal(res.view, undefined);
            }
        }
    } finally {
        UserModel.findById = original;
    }
});

test('new form, CSRF and socket notification contracts are present', () => {
    const view = read('views/admin/disconnectUsers.ejs');
    ejs.compile(view, { filename: path.join(root, 'views/admin/disconnectUsers.ejs') });
    assert.match(view, /name="_csrf" value="<%= csrfToken %>"/);
    assert.match(view, /Δεν υπάρχουν άλλοι ενεργοί χρήστες/);
    assert.match(read('public/js/admin/disconnectUsers.js'), /X-CSRF-Token/);
    const layout = read('views/layouts/main.ejs');
    assert.match(layout, /socket\.on\('admin:force-logout'/);
    assert.match(layout, /window\.location\.replace\('\/login'\)/);
    const app = read('app.js');
    assert.match(app, /if \(\['GET', 'HEAD', 'OPTIONS'\]\.includes\(req\.method\)\)/);
    assert.match(app, /if \(!validateSimpleCsrfToken\(req\)\)/);
});

test('force-logout listener redirects even without Swal or when notification throws', () => {
    const layout = read('views/layouts/main.ejs');
    const listener = layout.match(/socket\.on\('admin:force-logout', function \(\) \{[\s\S]*?^\s{16}\}\);/m);
    assert.ok(listener, 'force-logout listener missing');
    for (const mode of ['missing', 'throws', 'works']) {
        const scheduled = [], redirects = [], notices = [];
        const window = {
            hideLoader() {},
            setTimeout(callback, milliseconds) { scheduled.push({ callback, milliseconds }); },
            location: { replace(path) { redirects.push(path); } },
            ...(mode === 'missing' ? {} : { Swal: {
                close() {},
                fire(options) { notices.push(options); if (mode === 'throws') throw new Error('Swal unavailable');
                    return Promise.resolve(); }
            } })
        };
        let handler;
        vm.runInNewContext(listener[0], { socket: { on(event, callback) { handler = callback; } },
            window, console: { warn() {} } });
        handler();
        assert.equal(scheduled.length, 1, mode);
        assert.equal(scheduled[0].milliseconds, 900, mode);
        scheduled[0].callback();
        assert.deepEqual(redirects, ['/login'], mode);
        if (mode === 'works') {
            assert.equal(notices[0].allowEscapeKey, false);
            assert.equal(notices[0].allowOutsideClick, false);
            assert.equal(notices[0].showConfirmButton, false);
        }
    }
});
