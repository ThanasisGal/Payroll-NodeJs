const assert = require('assert');
const UserModel = require('../models/userModel');
const { UserPrivilegesModel } = require('../models/privileges');
const {
    requireUserPrivilegeAction,
    requireUserPrivilegeAnyAction,
    ALLOWED_PRIVILEGE_ACTIONS
} = require('./requireUserPrivilegeForm');

function response() {
    return {
        statusCode: 200,
        body: '',
        status(code) { this.statusCode = code; return this; },
        send(body) { this.body = body; return this; }
    };
}

(async () => {
    assert.deepStrictEqual(
        [...ALLOWED_PRIVILEGE_ACTIONS],
        ['admin', 'create', 'read', 'update', 'delete', 'print', 'export']
    );
    assert.throws(() => requireUserPrivilegeAction('', 'create'), TypeError);
    assert.throws(() => requireUserPrivilegeAction('Companies', '__proto__'), TypeError);
    assert.throws(() => requireUserPrivilegeAnyAction('Companies', []), TypeError);
    assert.throws(() => requireUserPrivilegeAnyAction('Companies', ['constructor']), TypeError);

    const originalUserFindById = UserModel.findById;
    const originalPrivilegeFindOne = UserPrivilegesModel.findOne;
    try {
        const middleware = requireUserPrivilegeAction('Companies', 'create');
        const unauthenticated = response();
        await middleware({ session: {} }, unauthenticated, () => assert.fail('next called'));
        assert.strictEqual(unauthenticated.statusCode, 401);

        for (const scenario of [
            { user: null, privilege: { create: true }, status: 403, next: 0 },
            { user: { situation: 'I', team: 'TEAM1' }, privilege: { create: true }, status: 403, next: 0 },
            { user: { situation: 'A', team: 'TEAM1' }, privilege: null, status: 403, next: 0 },
            { user: { situation: 'A', team: 'TEAM1' }, privilege: { read: true }, status: 403, next: 0 },
            { user: { situation: 'A', team: 'TEAM1' }, privilege: { create: true }, status: 200, next: 1 },
            { user: { situation: ' a ', team: 'THA' }, privilege: { admin: true }, status: 200, next: 1 }
        ]) {
            let privilegeQuery;
            UserModel.findById = () => ({
                select() { return this; },
                lean: async () => scenario.user
            });
            UserPrivilegesModel.findOne = (query) => ({
                select() { privilegeQuery = query; return this; },
                lean: async () => scenario.privilege ? { privileges: scenario.privilege } : null
            });
            const res = response();
            let next = 0;
            await middleware({ session: { userId: 42 } }, res, () => { next++; });
            assert.deepStrictEqual(privilegeQuery, scenario.user &&
                String(scenario.user.situation).trim().toUpperCase() === 'A'
                ? { userId: '42', form: 'Companies' }
                : undefined);
            assert.strictEqual(res.statusCode, scenario.status);
            assert.strictEqual(next, scenario.next);
        }

        UserModel.findById = () => { throw new Error('database detail'); };
        const internal = response();
        await middleware({ session: { userId: '42' } }, internal, () => assert.fail('next called'));
        assert.strictEqual(internal.statusCode, 500);
        assert.ok(!internal.body.includes('database detail'));

        let userLookups = 0;
        let privilegeLookups = 0;
        UserModel.findById = () => {
            userLookups++;
            return {
                select() { return this; },
                lean: async () => ({ situation: 'A', team: 'TEAM1' })
            };
        };
        UserPrivilegesModel.findOne = () => {
            privilegeLookups++;
            return {
                select() { return this; },
                lean: async () => ({ privileges: { update: true } })
            };
        };
        const anyAction = requireUserPrivilegeAnyAction(
            'SynthrhshProgrammatosErgasias',
            ['create', 'update', 'update']
        );
        let anyNext = 0;
        await anyAction({ session: { userId: 7 } }, response(), () => anyNext++);
        assert.strictEqual(anyNext, 1);
        assert.strictEqual(userLookups, 1);
        assert.strictEqual(privilegeLookups, 1);

        for (const privileges of [{ create: true }, { admin: true }]) {
            UserPrivilegesModel.findOne = () => ({
                select() { return this; },
                lean: async () => ({ privileges })
            });
            let allowed = 0;
            await anyAction({ session: { userId: 7 } }, response(), () => allowed++);
            assert.strictEqual(allowed, 1);
        }

        UserPrivilegesModel.findOne = () => ({
            select() { return this; },
            lean: async () => ({ privileges: { read: true } })
        });
        const deniedCopy = response();
        await anyAction({ session: { userId: 7 } }, deniedCopy, () => assert.fail('next called'));
        assert.strictEqual(deniedCopy.statusCode, 403);
    } finally {
        UserModel.findById = originalUserFindById;
        UserPrivilegesModel.findOne = originalPrivilegeFindOne;
    }
    console.log('PASS action privilege middleware active-user and fail-closed contract');
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
