const assert = require('assert');
const fs = require('fs');
const path = require('path');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const ejs = require('ejs');
const {
    USER_ROLE_CODES,
    normalizeUserRole,
    isAllowedUserRole,
    isAdminUserRole,
    getUserRoleLabel,
    getSelectableAdminUserRoles,
    getUserRoleOptionsForCurrentValue,
    getUserRoleBadgeClass
} = require('../constants/userRoles');
const UserModel = require('../models/userModel');
const { SidebarStatusModel } = require('../models/privileges');

const sideEffectModuleStubs = [
    ['../../config/emailConfig', { sendMail: async () => ({}) }],
    ['../utils/logger', { error() {}, warn() {}, info() {}, debug() {} }],
    ['../../config/sessionOpts', { sessionOpts: {}, isProd: false }]
];
const previousCacheEntries = new Map();
for (const [modulePath, exports] of sideEffectModuleStubs) {
    const resolved = require.resolve(modulePath);
    previousCacheEntries.set(resolved, require.cache[resolved]);
    require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports };
}

const userController = require('./userController');
const requireAdminRole = require('../middlewares/requireAdminRole');

const tests = [];
function test(name, fn) {
    tests.push({ name, fn });
}

function responseStub() {
    return {
        statusCode: 200,
        redirects: [],
        renders: [],
        flashes: [],
        sent: [],
        status(code) { this.statusCode = code; return this; },
        redirect(url) { this.redirects.push(url); return this; },
        render(view, locals) { this.renders.push({ view, locals }); return this; },
        send(message) { this.sent.push(message); return this; },
        async flash(type, message) { this.flashes.push({ type, message }); }
    };
}

function userBody(role) {
    return {
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.invalid',
        password: 'unchanged-test-value',
        tel: '',
        team: 'TEST',
        radioRoles: role,
        radioStatus: 'A',
        details: ''
    };
}

function renderView(relativePath, locals) {
    const filename = path.join(repositoryRoot, 'views', relativePath);
    return ejs.render(fs.readFileSync(filename, 'utf8'), locals, { filename });
}

function duplicateIds(html) {
    const ids = [...String(html).matchAll(/\sid=["']([^"']+)["']/g)].map((match) => match[1]);
    return [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
}

test('role constants and normalization', () => {
    assert.deepStrictEqual([...USER_ROLE_CODES], ['A', 'S', 'HR', 'C', 'U', 'V']);
    assert.strictEqual(normalizeUserRole(' hr '), 'HR');
    assert.strictEqual(isAllowedUserRole(' s '), true);
    assert.strictEqual(isAllowedUserRole('invalid'), false);
    assert.strictEqual(getUserRoleLabel('S'), 'Supervisor');
    assert.strictEqual(getUserRoleLabel('HR'), 'HR');
    USER_ROLE_CODES.forEach((role) => assert.strictEqual(isAdminUserRole(role), role === 'A'));
});

test('non-string role input shapes are rejected', () => {
    const invalidValues = [
        undefined,
        null,
        '',
        '   ',
        ['A'],
        ['A', 'HR'],
        { role: 'A' },
        { toString() { return 'A'; } }
    ];
    invalidValues.forEach((value) => {
        assert.strictEqual(normalizeUserRole(value), '');
        assert.strictEqual(isAllowedUserRole(value), false);
    });
});

test('selectable and legacy edit options', () => {
    assert.deepStrictEqual(getSelectableAdminUserRoles().map((option) => option.value), ['A', 'S', 'HR', 'C', 'V']);
    assert.ok(getUserRoleOptionsForCurrentValue('U').some((option) => option.value === 'U'));
    assert.ok(!getSelectableAdminUserRoles().some((option) => option.value === 'U'));
});

test('UserModel validates and normalizes privileges without a database', async () => {
    const schemaPath = UserModel.schema.path('privileges');
    assert.strictEqual(schemaPath.options.required, true);
    assert.deepStrictEqual(schemaPath.options.enum, USER_ROLE_CODES);
    const valid = new UserModel({ firstName: 'A', lastName: 'B', email: 'a@example.invalid', password: 'x', team: 'T', privileges: ' hr ', situation: 'A' });
    await valid.validate();
    assert.strictEqual(valid.privileges, 'HR');
    const invalid = new UserModel({ firstName: 'A', lastName: 'B', email: 'a@example.invalid', password: 'x', team: 'T', privileges: 'invalid', situation: 'A' });
    await assert.rejects(invalid.validate(), /privileges/);
});

test('SidebarStatusModel has independent false-default role fields', () => {
    for (const field of ['situation_S', 'situation_HR']) {
        const schemaPath = SidebarStatusModel.schema.path(field);
        assert.ok(schemaPath);
        assert.strictEqual(schemaPath.options.default, false);
    }
});

test('controller create synchronizes privileges and isAdmin', async () => {
    const originalFindOne = UserModel.findOne;
    const originalCreate = UserModel.create;
    const writes = [];
    try {
        UserModel.findOne = () => ({ sort: () => ({ lean: async () => null }) });
        UserModel.create = async (document) => { writes.push(document.toObject()); };
        for (const [role, expectedAdmin] of [
            ['A', true], ['S', false], ['HR', false], ['C', false], ['U', false], ['V', false]
        ]) {
            const res = responseStub();
            const writesBefore = writes.length;
            await userController.postUser({ body: userBody(` ${role.toLowerCase()} `) }, res);
            const write = writes.at(-1);
            assert.strictEqual(writes.length, writesBefore + 1);
            assert.strictEqual(write.privileges, role);
            assert.strictEqual(write.isAdmin, expectedAdmin);
            assert.deepStrictEqual(res.redirects, ['/admin']);
            assert.ok(res.flashes.some((flash) => flash.type === 'success'));
            assert.strictEqual(res.renders.length, 0);
        }
    } finally {
        UserModel.findOne = originalFindOne;
        UserModel.create = originalCreate;
    }
});

test('controller create and edit reject invalid shapes before model access', async () => {
    const originalFindOne = UserModel.findOne;
    const originalCreate = UserModel.create;
    const originalUpdate = UserModel.findByIdAndUpdate;
    let accesses = 0;
    try {
        UserModel.findOne = () => { accesses++; };
        UserModel.create = async () => { accesses++; };
        UserModel.findByIdAndUpdate = async () => { accesses++; };
        const invalidValues = [undefined, '', '   ', ['A'], ['A', 'HR'], { role: 'A' }, { toString() { return 'A'; } }];
        for (const value of invalidValues) {
            const createRes = responseStub();
            await userController.postUser({ body: userBody(value) }, createRes);
            assert.strictEqual(createRes.statusCode, 400);
            assert.deepStrictEqual(createRes.redirects, ['/admin/add']);

            const editRes = responseStub();
            await userController.editPostUser({ params: { id: 'user-id' }, body: userBody(value) }, editRes);
            assert.strictEqual(editRes.statusCode, 400);
            assert.deepStrictEqual(editRes.redirects, ['/admin/edit/user-id']);
        }
        assert.strictEqual(accesses, 0);
    } finally {
        UserModel.findOne = originalFindOne;
        UserModel.create = originalCreate;
        UserModel.findByIdAndUpdate = originalUpdate;
    }
});

test('controller edit synchronizes role/admin and enables validators', async () => {
    const originalUpdate = UserModel.findByIdAndUpdate;
    const updates = [];
    try {
        UserModel.findByIdAndUpdate = async (id, update, options) => {
            updates.push({ id, update, options });
            return { _id: id };
        };
        for (const [from, to, expectedAdmin] of [
            ['A', 'HR', false], ['HR', 'A', true], ['A', 'S', false], ['C', 'U', false], ['V', 'C', false]
        ]) {
            const res = responseStub();
            await userController.editPostUser({ params: { id: `user-${from}-${to}` }, body: userBody(to) }, res);
            const write = updates.at(-1);
            assert.strictEqual(write.update.privileges, to);
            assert.strictEqual(write.update.isAdmin, expectedAdmin);
            assert.strictEqual(write.options.runValidators, true);
            assert.deepStrictEqual(res.redirects, ['/admin']);
            assert.ok(res.flashes.some((flash) => flash.type === 'info'));
        }
    } finally {
        UserModel.findByIdAndUpdate = originalUpdate;
    }
});

test('controller edit handles null update and thrown errors safely', async () => {
    const originalUpdate = UserModel.findByIdAndUpdate;
    try {
        UserModel.findByIdAndUpdate = async () => null;
        const missingRes = responseStub();
        await userController.editPostUser({ params: { id: 'missing' }, body: userBody('HR') }, missingRes);
        assert.deepStrictEqual(missingRes.redirects, ['/admin']);
        assert.ok(missingRes.flashes.some((flash) => flash.message === 'Δεν βρέθηκε ο χρήστης προς ενημέρωση'));
        assert.ok(!missingRes.flashes.some((flash) => flash.message === 'Επιτυχής Ενημέρωση'));

        UserModel.findByIdAndUpdate = async () => { throw new Error('raw database detail'); };
        const errorRes = responseStub();
        await userController.editPostUser({ params: { id: 'error' }, body: userBody('S') }, errorRes);
        assert.deepStrictEqual(errorRes.redirects, ['/admin']);
        assert.ok(errorRes.flashes.some((flash) => flash.message === 'Δεν ήταν δυνατή η ενημέρωση του χρήστη'));
        assert.ok(!errorRes.flashes.some((flash) => flash.message.includes('raw database detail')));
    } finally {
        UserModel.findByIdAndUpdate = originalUpdate;
    }
});

test('fetchPermissions selects S and HR independently with safe false defaults', async () => {
    const originalFind = SidebarStatusModel.find;
    let projection;
    try {
        SidebarStatusModel.find = (query, selected) => {
            projection = selected;
            return { sort: () => ({ lean: async () => [{ li_Id: 'li1', situation_S: true }, { li_Id: 'li2' }] }) };
        };
        assert.deepStrictEqual(await userController.fetchPermissions('user-id', ' s '), { li1: true, li2: false });
        SidebarStatusModel.find = () => ({ sort: () => ({ lean: async () => [{ li_Id: 'li1', situation_HR: true, situation_C: false }] }) });
        assert.deepStrictEqual(await userController.fetchPermissions('user-id', 'HR'), { li1: true });
        assert.strictEqual(projection.situation_S, 1);
        assert.strictEqual(projection.situation_HR, 1);
    } finally {
        SidebarStatusModel.find = originalFind;
    }
});

test('requireAdminRole authorizes only active database-backed A users', async () => {
    const originalFindById = UserModel.findById;
    const cases = [
        { name: 'missing user', user: null, status: 403 },
        { name: 'active A', user: { privileges: 'A', situation: 'A' }, next: 1 },
        { name: 'inactive A', user: { privileges: 'A', situation: 'I' }, status: 403 },
        { name: 'active S', user: { privileges: 'S', situation: 'A', isAdmin: true }, status: 403 },
        { name: 'active HR', user: { privileges: 'HR', situation: 'A' }, status: 403 },
        { name: 'active C', user: { privileges: 'C', situation: 'A' }, status: 403 },
        { name: 'active U', user: { privileges: 'U', situation: 'A' }, status: 403 },
        { name: 'active V', user: { privileges: 'V', situation: 'A' }, status: 403 }
    ];
    try {
        const noSessionRes = responseStub();
        let noSessionNext = 0;
        await requireAdminRole({}, noSessionRes, () => { noSessionNext++; });
        assert.deepStrictEqual(noSessionRes.redirects, ['/login']);
        assert.strictEqual(noSessionNext, 0);

        for (const scenario of cases) {
            let selectedFields = '';
            UserModel.findById = () => ({
                select(fields) {
                    selectedFields = fields;
                    return this;
                },
                lean: async () => scenario.user
            });
            const res = responseStub();
            let nextCalls = 0;
            await requireAdminRole(
                { session: { userId: 'user-id', userRole: 'A', isAdmin: true } },
                res,
                () => { nextCalls++; }
            );
            assert.strictEqual(selectedFields, 'privileges situation', scenario.name);
            assert.strictEqual(nextCalls, scenario.next || 0, scenario.name);
            if (scenario.status) assert.strictEqual(res.statusCode, scenario.status, scenario.name);
        }

        UserModel.findById = () => ({ select() { return this; }, lean: async () => { throw new Error('db'); } });
        const errorRes = responseStub();
        let errorNext = 0;
        await requireAdminRole({ session: { userId: 'user-id' } }, errorRes, () => { errorNext++; });
        assert.strictEqual(errorRes.statusCode, 500);
        assert.deepStrictEqual(errorRes.sent, ['Σφάλμα ελέγχου πρόσβασης']);
        assert.strictEqual(errorNext, 0);
    } finally {
        UserModel.findById = originalFindById;
    }
});

test('user-management routes require the admin middleware', () => {
    const routeSource = fs.readFileSync(path.join(repositoryRoot, 'server', 'routes', 'usersRoute.js'), 'utf8');
    const contracts = [
        ["router.get('/admin'", 'adminHomepage'],
        ["router.get('/admin/add'", 'addUser'],
        ["router.post('/admin/add'", 'postUser'],
        ["router.get('/admin/view/:id'", 'viewUser'],
        ["router.get('/admin/edit/:id'", 'editUser'],
        ["router.put('/admin/edit/:id'", 'editPostUser'],
        ["router.delete('/admin/edit/:id'", 'deletePostUser'],
        ["router.get('/admin/delete/:id'", 'checkAndDeletePostUser'],
        ["router.post('/admin/search'", 'searchPostUser'],
        ["router.get('/admin/search'", 'searchGetUser']
    ];
    for (const [prefix, handler] of contracts) {
        assert.ok(
            routeSource.includes(`${prefix}, requireAdminRole, userController.${handler});`),
            `${prefix} must use requireAdminRole`
        );
    }
    assert.ok(routeSource.includes("router.get('/admin/active-sessions', checkAuth, userController.activeSessionsPage);"));
});

test('add EJS renders selectable roles, unique IDs, and CSRF', () => {
    const html = renderView('users/add.ejs', { userRoleOptions: getSelectableAdminUserRoles(), csrfToken: 'csrf-test' });
    for (const role of ['A', 'S', 'HR', 'C', 'V']) assert.ok(html.includes(`id="role-${role}"`));
    assert.ok(!html.includes('id="role-U"'));
    assert.ok(html.includes('name="_csrf"'));
    assert.deepStrictEqual(duplicateIds(html), []);
});

test('edit EJS renders S, HR, and legacy U correctly', () => {
    for (const role of ['S', 'HR', 'U']) {
        const users = { id: 'id', _id: 'id', firstName: 'Test', lastName: 'User', email: 'test@example.invalid', password: 'x', tel: '', team: 'T', privileges: role, situation: 'A', details: '<note>', updatedAt: new Date(0) };
        const html = renderView('users/edit.ejs', { users, normalizedUserRole: role, userRoleOptions: getUserRoleOptionsForCurrentValue(role), csrfToken: 'csrf-test' });
        assert.ok(new RegExp(`id="role-${role}"[\\s\\S]*?checked`).test(html));
        assert.ok(html.includes('id="editUserForm"'));
        assert.ok(html.includes('form="editUserForm"'));
        assert.ok(html.includes('name="_csrf"'));
        assert.ok(html.includes('&lt;note&gt;'));
        assert.deepStrictEqual(duplicateIds(html), []);
    }
});

test('view EJS uses human role labels and direct escaped details', () => {
    for (const role of ['S', 'HR']) {
        const users = { _id: 'id', firstName: 'Test', lastName: 'User', email: 'test@example.invalid', password: 'x', tel: '', team: 'T', privileges: role, situation: 'A', details: '<note>' };
        const html = renderView('users/view.ejs', { users, getUserRoleLabel });
        assert.ok(html.includes(`value="${getUserRoleLabel(role)}"`));
        assert.ok(html.includes('&lt;note&gt;'));
        assert.ok(!html.includes('document.getElementById("details")'));
    }
});

test('index and search render role labels and working pagination', () => {
    const user = { _id: 'id', kod: '1', firstName: 'Test', lastName: 'User', email: 'test@example.invalid', tel: '', team: 'T', privileges: 'S', situation: 'A' };
    const hrUser = { ...user, _id: 'id-hr', kod: '2', privileges: 'HR' };
    const common = { getUserRoleLabel, current: 1, pages: 1, csrfToken: 'csrf-test' };
    const indexHtml = renderView('index.ejs', { ...common, users: [user, hrUser] });
    assert.ok(indexHtml.includes('Ρόλος'));
    assert.ok(indexHtml.includes('Supervisor'));
    const searchHtml = renderView('search.ejs', {
        ...common,
        current: 2,
        pages: 3,
        user: [user, hrUser],
        users: user
    });
    assert.ok(searchHtml.includes('Ρόλος'));
    assert.ok(searchHtml.includes('Supervisor'));
    assert.ok(searchHtml.includes('HR'));
    assert.ok(searchHtml.includes('/admin/search/?page=3'));
});

test('active sessions EJS renders supplied S and HR labels', () => {
    const activeUsers = ['S', 'HR'].map((role) => ({ userId: role, firstName: role, lastName: 'User', email: '', tel: '', team: '', privileges: role, roleLabel: getUserRoleLabel(role), roleBadgeClass: getUserRoleBadgeClass(role), expires: new Date(0) }));
    const html = renderView('admin/activeSessions.ejs', { activeUsers, currentUserId: 'none', nonce: 'nonce-test', csrfToken: 'csrf-test' });
    assert.ok(html.includes('Supervisor'));
    assert.ok(html.includes('>HR<'));
    assert.ok(!html.includes('<span class="badge bg-secondary">Visitor</span>'));
});

test('role EJS contains no inline role event handlers or repeated role branches', () => {
    const files = ['users/add.ejs', 'users/edit.ejs', 'users/view.ejs'];
    const combined = files.map((file) => fs.readFileSync(path.join(repositoryRoot, 'views', file), 'utf8')).join('\n');
    assert.ok(!/on(?:click|change|submit|input)\s*=/i.test(combined));
    assert.ok(!/users\.privileges\s*==\s*['"](?:A|C|V)['"]/.test(combined));
});

(async () => {
    try {
        for (const { name, fn } of tests) {
            await fn();
            console.log(`PASS ${name}`);
        }
        console.log(`PASS user roles contract (${tests.length} tests)`);
    } finally {
        for (const [resolved, previousEntry] of previousCacheEntries) {
            if (previousEntry) require.cache[resolved] = previousEntry;
            else delete require.cache[resolved];
        }
    }
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
