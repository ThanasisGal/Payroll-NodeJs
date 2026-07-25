const assert = require('assert');
const { UserPrivilegesModel } = require('../models/privileges');
const requireUserPrivilegeForm = require('./requireUserPrivilegeForm');

function response() {
    return { statusCode: 200, body: '', status(code) { this.statusCode = code; return this; }, send(body) { this.body = body; return this; } };
}

(async () => {
    const originalFindOne = UserPrivilegesModel.findOne;
    try {
        const middleware = requireUserPrivilegeForm('Companies');
        const unauthorized = response();
        await middleware({ session: {} }, unauthorized, () => assert.fail('must not call next'));
        assert.strictEqual(unauthorized.statusCode, 401);

        for (const [privileges, expectedNext, expectedStatus] of [
            [{ read: true, admin: false }, 1, 200],
            [{ read: false, admin: true }, 1, 200],
            [{ read: false, admin: false }, 0, 403],
            [null, 0, 403]
        ]) {
            let query;
            let projection;
            UserPrivilegesModel.findOne = (received) => {
                query = received;
                return { select(value) { projection = value; return this; }, lean: async () => privileges ? { privileges } : null };
            };
            const res = response();
            let next = 0;
            await middleware({ session: { userId: 42 }, params: { userId: 'attacker' } }, res, () => { next += 1; });
            assert.deepStrictEqual(query, { userId: '42', form: 'Companies' });
            assert.strictEqual(projection, '_id privileges.admin privileges.read');
            assert.strictEqual(next, expectedNext);
            assert.strictEqual(res.statusCode, expectedStatus);
        }
        console.log('PASS canonical form authorization middleware (session, read/admin, deny)');
    } finally {
        UserPrivilegesModel.findOne = originalFindOne;
    }
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
