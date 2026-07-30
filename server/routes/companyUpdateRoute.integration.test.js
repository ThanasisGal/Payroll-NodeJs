const assert = require('assert');
const mongoose = require('mongoose');
const UserModel = require('../models/userModel');
const { CompaniesModel } = require('../models/companies');
const { UserPrivilegesModel } = require('../models/privileges');
const {
    requireUserPrivilegeAction
} = require('../middlewares/requireUserPrivilegeForm');
const {
    authorizeCompanyUpdate
} = require('../middlewares/companyWriteAccess');

const ACTOR_ID = '507f191e810c19729de860ea';
const SELECTED_ID = '507f191e810c19729de860eb';
const COMPANY_ID = '507f1f77bcf86cd799439011';

function queryResult(value) {
    return {
        select() {
            return this;
        },
        lean: async () => value
    };
}

function response() {
    return {
        statusCode: 200,
        payload: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        send(payload) {
            this.payload = payload;
            return this;
        },
        json(payload) {
            this.payload = payload;
            return this;
        }
    };
}

(async () => {
    const originalFindById = UserModel.findById;
    const originalFind = UserModel.find;
    const originalPrivilegeFindOne = UserPrivilegesModel.findOne;
    const originalCompanyFindById = CompaniesModel.findById;
    const previousSanitizeFilter = mongoose.get('sanitizeFilter');
    try {
        mongoose.set('sanitizeFilter', true);
        UserModel.findById = () =>
            queryResult({ _id: ACTOR_ID, situation: 'A', team: 'THA' });
        UserPrivilegesModel.findOne = () =>
            queryResult({ privileges: { update: true } });
        CompaniesModel.findById = () =>
            queryResult({ _id: COMPANY_ID, team: 'THA', kod: '0004' });
        UserModel.find = (filter) => {
            assert.strictEqual(filter.team, undefined);
            assert.ok(filter._id.$in.every((id) => id instanceof mongoose.Types.ObjectId));
            return queryResult(filter._id.$in.map((id) => ({ _id: id })));
        };

        const req = {
            session: { userId: ACTOR_ID, userTeam: 'THA' },
            params: { companyId: COMPANY_ID },
            body: { selectedUsers: [SELECTED_ID] }
        };
        const res = response();
        let controllerCalls = 0;
        const privilegeMiddleware = requireUserPrivilegeAction('Companies', 'update');
        await privilegeMiddleware(req, res, async () => {
            assert.strictEqual(req.authenticatedUserTeam, 'THA');
            await authorizeCompanyUpdate(req, res, () => {
                controllerCalls += 1;
                assert.strictEqual(req.companyAccessScope.companyId, COMPANY_ID);
                assert.strictEqual(req.companyAccessScope.effectiveTeam, 'THA');
            });
        });

        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(controllerCalls, 1);
    } finally {
        mongoose.set('sanitizeFilter', previousSanitizeFilter);
        UserModel.findById = originalFindById;
        UserModel.find = originalFind;
        UserPrivilegesModel.findOne = originalPrivilegeFindOne;
        CompaniesModel.findById = originalCompanyFindById;
    }

    console.log('PASS company update privilege, access scope and controller route chain');
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
