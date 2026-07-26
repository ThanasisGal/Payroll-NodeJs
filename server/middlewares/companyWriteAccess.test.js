const assert = require('assert');
const { CompaniesModel, AntistoixiseisModel } = require('../models/companies');
const UserModel = require('../models/userModel');
const {
    authorizeCompanyCreate,
    authorizeCompanyUpdate,
    authorizeCompanyChildCreate,
    validateYpokatasthmaCreate,
    validatePasswordCreate,
    authorizeAntistoixishUpdate
} = require('./companyWriteAccess');

const COMPANY_ID = '507f1f77bcf86cd799439011';
const OTHER_ID = '507f191e810c19729de860ea';
const USER_ID = '507f1f77bcf86cd799439012';

function response() {
    return {
        statusCode: 200,
        payload: null,
        status(code) { this.statusCode = code; return this; },
        json(payload) { this.payload = payload; return this; }
    };
}

async function run(middleware, req) {
    const res = response();
    let next = 0;
    await middleware(req, res, () => { next++; });
    return { res, next };
}

function queryResult(value) {
    return {
        select() { return this; },
        lean: async () => value
    };
}

(async () => {
    const originalUserFind = UserModel.find;
    UserModel.find = ({ _id }) => ({
        select() { return this; },
        lean: async () => _id.$in.map((id) => ({ _id: id }))
    });
    try {
    const validCompanyBody = {
        companyTeam: 'TEAM1',
        eponymia: 'Company',
        afm: '123456789',
        selectedUsers: [USER_ID]
    };

    let result = await run(authorizeCompanyCreate, {
        session: { userId: USER_ID, userTeam: ' TEAM1 ' },
        authenticatedUserTeam: 'TEAM1',
        body: { ...validCompanyBody }
    });
    assert.strictEqual(result.next, 1);
    assert.strictEqual(result.res.statusCode, 200);
    assert.strictEqual(result.next && Object.isFrozen(
        (await (async () => {
            const req = {
                session: { userId: USER_ID, userTeam: 'TEAM1' },
                authenticatedUserTeam: 'TEAM1',
                body: { ...validCompanyBody }
            };
            await authorizeCompanyCreate(req, response(), () => {});
            return req.companyAccessScope;
        })())
    ), true);

    for (const body of [
        { ...validCompanyBody, companyTeam: 'TEAM2' },
        { ...validCompanyBody, selectedUsers: { $ne: null } },
        { ...validCompanyBody, eponymia: { $gt: '' } }
    ]) {
        result = await run(authorizeCompanyCreate, {
            session: { userId: USER_ID, userTeam: 'TEAM1' },
            authenticatedUserTeam: 'TEAM1',
            body
        });
        assert.strictEqual(result.next, 0);
        assert.ok([400, 403].includes(result.res.statusCode));
    }

    result = await run(authorizeCompanyCreate, {
        session: { userId: USER_ID, userTeam: 'THA' },
        authenticatedUserTeam: 'THA',
        body: { ...validCompanyBody, companyTeam: ' team2 ' }
    });
    assert.strictEqual(result.next, 1);

    result = await run(authorizeCompanyCreate, {
        session: { userId: USER_ID, userTeam: 'THA' },
        authenticatedUserTeam: 'THA',
        body: { ...validCompanyBody, companyTeam: '$ne' }
    });
    assert.strictEqual(result.res.statusCode, 403);

    const originalCompanyFindById = CompaniesModel.findById;
    const originalAntistoixFindById = AntistoixiseisModel.findById;
    try {
        CompaniesModel.findById = () => queryResult({
            _id: COMPANY_ID,
            team: 'TEAM1',
            kod: '0007'
        });

        const childReq = {
            session: { userId: USER_ID, userTeam: 'TEAM1', companyInUse: COMPANY_ID },
            authenticatedUserTeam: 'TEAM1',
            body: { companyId: COMPANY_ID, companyTeam: 'TEAM1', companyKodikos: '0007' }
        };
        result = await run(authorizeCompanyChildCreate, childReq);
        assert.strictEqual(result.next, 1);
        assert.deepStrictEqual(childReq.companyAccessScope, {
            userId: USER_ID,
            sessionTeam: 'TEAM1',
            effectiveTeam: 'TEAM1',
            companyTeamFilter: 'TEAM1',
            companyId: COMPANY_ID,
            companyKod: '0007'
        });

        result = await run(authorizeCompanyChildCreate, {
            session: { userId: USER_ID, userTeam: 'TEAM1', companyInUse: COMPANY_ID },
            authenticatedUserTeam: 'TEAM1',
            body: { companyId: OTHER_ID }
        });
        assert.strictEqual(result.res.statusCode, 403);

        result = await run(authorizeCompanyUpdate, {
            session: { userId: USER_ID, userTeam: 'TEAM2' },
            authenticatedUserTeam: 'TEAM2',
            params: { companyId: COMPANY_ID },
            body: { selectedUsers: [USER_ID] }
        });
        assert.strictEqual(result.res.statusCode, 404);

        result = await run(authorizeCompanyUpdate, {
            session: { userId: USER_ID, userTeam: 'TEAM1' },
            authenticatedUserTeam: 'TEAM1',
            params: { companyId: 'not-an-id' },
            body: { selectedUsers: [USER_ID] }
        });
        assert.strictEqual(result.res.statusCode, 400);

        AntistoixiseisModel.findById = () => queryResult({
            _id: OTHER_ID,
            companyId: COMPANY_ID,
            team: 'TEAM1'
        });
        const antistoixReq = {
            session: { userId: USER_ID, userTeam: 'TEAM1' },
            authenticatedUserTeam: 'TEAM1',
            params: { antistoixishId: OTHER_ID },
            body: { kpk: '101' }
        };
        result = await run(authorizeAntistoixishUpdate, antistoixReq);
        assert.strictEqual(result.next, 1);
        assert.strictEqual(antistoixReq.companyAccessScope.resourceId, OTHER_ID);
    } finally {
        CompaniesModel.findById = originalCompanyFindById;
        AntistoixiseisModel.findById = originalAntistoixFindById;
    }

    result = await run(validateYpokatasthmaCreate, { body: { perigrafh: { $ne: '' } } });
    assert.strictEqual(result.res.statusCode, 400);
    result = await run(validatePasswordCreate, {
        body: { Kodikos: '0002', perigrafh: 'ERGANI', username: ['secret'], password: 'x' }
    });
    assert.strictEqual(result.res.statusCode, 400);
    result = await run(validatePasswordCreate, {
        body: { Kodikos: '0002', perigrafh: 'ERGANI', username: 'user', password: 'secret' }
    });
    assert.strictEqual(result.next, 1);
    assert.ok(!JSON.stringify(result.res.payload).includes('secret'));

    console.log('PASS company write canonical team/company/input scope contract');
    } finally {
        UserModel.find = originalUserFind;
    }
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
