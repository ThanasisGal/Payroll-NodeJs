const assert = require('assert');
const mongoose = require('mongoose');
const UserModel = require('../models/userModel');
const { UserPrivilegesModel } = require('../models/privileges');
const UserPrivilegeFormCatalogModel = require('../models/userPrivilegeFormCatalog');

for (const [modulePath, exports] of [
    ['../../config/emailConfig', { sendMail: async () => ({}) }],
    ['../utils/logger', { error() {}, warn() {}, info() {}, debug() {} }],
    ['../../config/sessionOpts', { sessionOpts: {}, isProd: false }]
]) {
    const resolved = require.resolve(modulePath);
    require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports };
}

const userController = require('./userController');
const userPrivilegesController = require('./userPrivilegesController');

const IDS = {
    THA: '000000000000000000000001',
    TEAM1: '000000000000000000000002',
    TEAM2: '000000000000000000000003'
};
const users = [
    { _id: IDS.THA, kod: '1', firstName: 'Admin', lastName: 'THA', email: 'tha@example.invalid', team: 'THA', privileges: 'A', situation: 'A' },
    { _id: IDS.TEAM1, kod: '2', firstName: 'Match', lastName: 'One', email: 'match1@example.invalid', team: 'team1', privileges: 'S', situation: 'A' },
    { _id: IDS.TEAM2, kod: '3', firstName: 'Match', lastName: 'Two', email: 'match2@example.invalid', team: ' TEAM2 ', privileges: 'HR', situation: 'A' }
];

function matches(filter, user) {
    if (!filter || Object.keys(filter).length === 0) return true;
    if (filter._id && String(filter._id) !== String(user._id)) return false;
    if (filter.team instanceof RegExp && !filter.team.test(user.team)) return false;
    if (Array.isArray(filter.$or)) {
        const matchesSearch = filter.$or.some((condition) => Object.entries(condition).some(([field, rule]) => {
            if (!(rule?.$regex instanceof RegExp)) return false;
            return rule.$regex.test(String(user[field] || ''));
        }));
        if (!matchesSearch) return false;
    }
    return true;
}

function response() {
    return {
        statusCode: 200,
        payload: null,
        rendered: null,
        redirects: [],
        flashes: [],
        status(code) { this.statusCode = code; return this; },
        send(value) { this.payload = value; return this; },
        json(value) { this.payload = value; return this; },
        render(view, locals) { this.rendered = { view, locals }; return this; },
        redirect(url) { this.redirects.push(url); return this; },
        async flash(type, message) { this.flashes.push({ type, message }); }
    };
}

function findQuery(rows) {
    let selected = rows;
    return {
        select() { return this; },
        sort() { return this; },
        skip(count) { selected = selected.slice(count); return this; },
        limit(count) { selected = selected.slice(0, count); return this; },
        lean() { return Promise.resolve(selected); },
        then(resolve, reject) { return Promise.resolve(selected).then(resolve, reject); }
    };
}

async function withUserModelStubs(stubs, fn) {
    const originals = {};
    for (const [name, replacement] of Object.entries(stubs)) {
        originals[name] = UserModel[name];
        UserModel[name] = replacement;
    }
    try {
        await fn();
    } finally {
        for (const [name, original] of Object.entries(originals)) UserModel[name] = original;
    }
}

async function testAdminListScope() {
    const previousEggrafes = process.env.EGGRAFES;
    process.env.EGGRAFES = '2';
    let countFilter;
    let aggregateStages;
    try {
        await withUserModelStubs({
            countDocuments: async (filter) => {
                countFilter = filter;
                return users.filter((user) => matches(filter, user)).length;
            },
            aggregate: (stages) => {
                aggregateStages = stages;
                const rows = users.filter((user) => matches(stages[0].$match, user));
                return { skip() { return this; }, limit() { return this; }, exec: async () => rows };
            }
        }, async () => {
            const tha = response();
            await userController.adminHomepage({ session: { userTeam: ' tha ' }, query: {} }, tha);
            assert.deepStrictEqual(countFilter, {});
            assert.deepStrictEqual(aggregateStages[0], { $match: {} });
            assert.deepStrictEqual(tha.rendered.locals.users.map((user) => user.team), ['THA', 'team1', ' TEAM2 ']);
            assert.strictEqual(tha.rendered.locals.pages, 2);

            const team1 = response();
            await userController.adminHomepage({ session: { userTeam: 'team1' }, query: {} }, team1);
            assert.ok(countFilter.team instanceof RegExp);
            assert.ok(aggregateStages[0].$match.team instanceof RegExp);
            assert.deepStrictEqual(team1.rendered.locals.users.map((user) => user.team), ['team1']);
            assert.strictEqual(team1.rendered.locals.pages, 1);

            const invalid = response();
            await userController.adminHomepage({ session: {}, query: {} }, invalid);
            assert.strictEqual(invalid.statusCode, 403);
        });
    } finally {
        if (previousEggrafes === undefined) delete process.env.EGGRAFES;
        else process.env.EGGRAFES = previousEggrafes;
    }
}

async function testSearchScope() {
    const previousEggrafes = process.env.EGGRAFES;
    process.env.EGGRAFES = '10';
    let countFilter;
    try {
        await withUserModelStubs({
            countDocuments: async (filter) => {
                countFilter = filter;
                return users.filter((user) => matches(filter, user)).length;
            },
            find: (filter) => findQuery(users.filter((user) => matches(filter, user)))
        }, async () => {
            const req = { session: { userTeam: 'TEAM1' }, body: { searchTerm: 'Match' }, query: {} };
            const res = response();
            await userController.searchPostUser(req, res);
            assert.ok(countFilter.team instanceof RegExp);
            assert.deepStrictEqual(res.rendered.locals.user.map((user) => user.team), ['team1']);
            assert.strictEqual(res.rendered.locals.pages, 1);
            assert.strictEqual(req.session.adminUserSearchTerm, 'Match');
        });
    } finally {
        if (previousEggrafes === undefined) delete process.env.EGGRAFES;
        else process.env.EGGRAFES = previousEggrafes;
    }
}

async function testDirectObjectScope() {
    await withUserModelStubs({
        findOne: (filter) => {
            const found = users.find((user) => matches(filter, user)) || null;
            const query = findQuery(found ? [found] : []);
            query.then = (resolve, reject) => Promise.resolve(found).then(resolve, reject);
            query.lean = () => Promise.resolve(found);
            return query;
        },
        deleteOne: async (filter) => ({ deletedCount: users.some((user) => matches(filter, user)) ? 1 : 0 })
    }, async () => {
        for (const method of ['viewUser', 'editUser', 'checkAndDeletePostUser']) {
            const denied = response();
            await userController[method](
                { session: { userTeam: 'TEAM1' }, params: { id: IDS.TEAM2 } },
                denied
            );
            assert.strictEqual(denied.statusCode, 404, method);
        }
        const deniedDelete = response();
        await userController.deletePostUser(
            { session: { userTeam: 'TEAM1' }, params: { id: IDS.TEAM2 } },
            deniedDelete
        );
        assert.strictEqual(deniedDelete.statusCode, 404);

        const allowed = response();
        await userController.viewUser(
            { session: { userTeam: 'THA' }, params: { id: IDS.TEAM2 } },
            allowed
        );
        assert.strictEqual(allowed.rendered.locals.users.team, ' TEAM2 ');
    });
}

async function testCreateAndEditTeamTampering() {
    const originalFindOne = UserModel.findOne;
    const originalCreate = UserModel.create;
    const originalFindOneAndUpdate = UserModel.findOneAndUpdate;
    const created = [];
    const updates = [];
    try {
        UserModel.findOne = (filter) => {
            if (Object.keys(filter).length === 0) return { sort: () => ({ lean: async () => null }) };
            const found = users.find((user) => matches(filter, user)) || null;
            return { select: () => ({ lean: async () => found }) };
        };
        UserModel.create = async (document) => { created.push(document.toObject()); return document; };
        UserModel.findOneAndUpdate = async (filter, update) => {
            updates.push({ filter, update });
            return users.find((user) => matches(filter, user)) || null;
        };
        const body = {
            firstName: 'New', lastName: 'User', email: 'new@example.invalid', password: 'secret',
            tel: '', team: 'TEAM2', radioRoles: 'S', radioStatus: 'A', details: ''
        };
        await userController.postUser({ session: { userTeam: 'TEAM1' }, body }, response());
        assert.strictEqual(created[0].team, 'TEAM1');

        await userController.postUser({ session: { userTeam: 'THA' }, body }, response());
        assert.strictEqual(created[1].team, 'TEAM2');

        const editRes = response();
        await userController.editPostUser(
            { session: { userTeam: 'TEAM1' }, params: { id: IDS.TEAM1 }, body },
            editRes
        );
        assert.strictEqual(updates[0].update.team, 'TEAM1');

        const foreignEdit = response();
        await userController.editPostUser(
            { session: { userTeam: 'TEAM1' }, params: { id: IDS.TEAM2 }, body },
            foreignEdit
        );
        assert.strictEqual(foreignEdit.statusCode, 404);
    } finally {
        UserModel.findOne = originalFindOne;
        UserModel.create = originalCreate;
        UserModel.findOneAndUpdate = originalFindOneAndUpdate;
    }
}

async function testPrivilegesDropdownScope() {
    await withUserModelStubs({
        find: (filter) => findQuery(users.filter((user) => matches(filter, user)))
    }, async () => {
        const tha = response();
        await userPrivilegesController.listUsers({ session: { userTeam: 'THA' } }, tha);
        assert.strictEqual(tha.payload.items.length, 3);
        assert.deepStrictEqual(Object.keys(tha.payload.items[0]).sort(), ['active', 'label', 'role', 'roleLabel', 'value']);

        const team1 = response();
        await userPrivilegesController.listUsers({ session: { userTeam: 'team1' } }, team1);
        assert.strictEqual(team1.payload.items.length, 1);
        assert.ok(!JSON.stringify(team1.payload).includes('match2@example.invalid'));

        const invalid = response();
        await userPrivilegesController.listUsers({ session: {} }, invalid);
        assert.strictEqual(invalid.statusCode, 403);
        assert.strictEqual(invalid.payload.code, 'INVALID_TEAM_SCOPE');
    });
}

async function testPrivilegesDirectScope() {
    const originalFindOne = UserModel.findOne;
    const originalPrivilegeFind = UserPrivilegesModel.find;
    const originalCatalogFind = UserPrivilegeFormCatalogModel.find;
    const originalStartSession = mongoose.connection.startSession;
    let privilegeReads = 0;
    let transactionEnds = 0;
    try {
        UserModel.findOne = (filter) => {
            const found = users.find((user) => matches(filter, user)) || null;
            return {
                select() { return this; },
                session() { return this; },
                lean: async () => found
            };
        };
        UserPrivilegesModel.find = () => {
            privilegeReads += 1;
            return { select: () => ({ lean: async () => [] }) };
        };
        UserPrivilegeFormCatalogModel.find = () => ({
            select() { return this; },
            sort() { return this; },
            lean: async () => [{
                form: 'Companies',
                formLabel: 'Γενικά Στοιχεία',
                sidebarOrder: 0
            }]
        });

        const deniedGet = response();
        await userPrivilegesController.getPrivileges(
            { session: { userTeam: 'TEAM1' }, params: { userId: IDS.TEAM2 } },
            deniedGet
        );
        assert.strictEqual(deniedGet.statusCode, 404);
        assert.strictEqual(privilegeReads, 0);

        const allowedGet = response();
        await userPrivilegesController.getPrivileges(
            { session: { userTeam: 'THA' }, params: { userId: IDS.TEAM2 } },
            allowedGet
        );
        assert.strictEqual(allowedGet.statusCode, 200);
        assert.strictEqual(privilegeReads, 1);

        mongoose.connection.startSession = async () => ({
            async withTransaction(fn) { await fn(); },
            async endSession() { transactionEnds += 1; }
        });
        const deniedPut = response();
        await userPrivilegesController.updatePrivileges(
            {
                session: { userTeam: 'TEAM1' },
                params: { userId: IDS.TEAM2 },
                body: { rows: [] }
            },
            deniedPut
        );
        assert.strictEqual(deniedPut.statusCode, 404);
        assert.strictEqual(privilegeReads, 1);
        assert.strictEqual(transactionEnds, 1);
    } finally {
        UserModel.findOne = originalFindOne;
        UserPrivilegesModel.find = originalPrivilegeFind;
        UserPrivilegeFormCatalogModel.find = originalCatalogFind;
        mongoose.connection.startSession = originalStartSession;
    }
}

(async () => {
    assert.strictEqual(mongoose.isValidObjectId(IDS.TEAM1), true);
    await testAdminListScope();
    console.log('PASS admin list count, pagination and team scope');
    await testSearchScope();
    console.log('PASS admin search count, pagination and team scope');
    await testDirectObjectScope();
    console.log('PASS direct view/edit/delete team scope');
    await testCreateAndEditTeamTampering();
    console.log('PASS create/edit ignore non-THA team tampering and allow validated THA input');
    await testPrivilegesDropdownScope();
    console.log('PASS user privileges dropdown team scope and safe projection');
    await testPrivilegesDirectScope();
    console.log('PASS user privileges GET/PUT reject cross-team ObjectIds before privilege reads/writes');
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
