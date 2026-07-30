const assert = require('assert');
const mongoose = require('mongoose');
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

    const scopedCompanyFindById = CompaniesModel.findById;
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

        result = await run(authorizeCompanyUpdate, {
            session: { userId: USER_ID, userTeam: 'TEAM1' },
            authenticatedUserTeam: 'TEAM1',
            params: { companyId: COMPANY_ID },
            body: { selectedUsers: [] }
        });
        assert.strictEqual(result.res.statusCode, 400);
        assert.deepStrictEqual(result.res.payload, {
            success: false,
            code: 'COMPANY_USERS_REQUIRED',
            message: 'Πρέπει να επιλεγεί τουλάχιστον ένας χρήστης στη σελίδα «Διάφορα».'
        });

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
        CompaniesModel.findById = scopedCompanyFindById;
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

    const stubbedUserFind = UserModel.find;
    const originalCompanyFindById = CompaniesModel.findById;
    const previousSanitizeFilter = mongoose.get('sanitizeFilter');
    try {
        let company = { _id: COMPANY_ID, team: 'THA', kod: '0004' };
        let selectedUserRows = [
            { _id: USER_ID, team: 'TEAM1' },
            { _id: OTHER_ID, team: 'TEAM2' }
        ];
        let userQueries = 0;
        let capturedFilter;
        CompaniesModel.findById = () => queryResult(company);
        UserModel.find = (filter) => {
            userQueries += 1;
            capturedFilter = filter;
            const requested = new Set(filter._id.$in.map(String));
            const rows = selectedUserRows.filter((user) => {
                if (!requested.has(String(user._id))) return false;
                return !filter.team || filter.team.test(user.team);
            });
            return {
                select() { return this; },
                lean: async () => rows.map(({ _id }) => ({ _id }))
            };
        };

        mongoose.set('sanitizeFilter', true);
        result = await run(authorizeCompanyUpdate, {
            session: { userId: USER_ID, userTeam: 'THA' },
            authenticatedUserTeam: 'THA',
            params: { companyId: COMPANY_ID },
            body: { selectedUsers: [USER_ID, OTHER_ID] }
        });
        assert.strictEqual(result.next, 1);
        assert.strictEqual(result.res.statusCode, 200);
        assert.strictEqual(capturedFilter.team, undefined);
        assert.ok(capturedFilter._id.$in.every((id) => id instanceof mongoose.Types.ObjectId));

        UserModel.find = originalUserFind;
        const trustedQuery = UserModel.find(capturedFilter);
        mongoose.sanitizeFilter(trustedQuery.getFilter());
        assert.doesNotThrow(() => trustedQuery.cast());
        UserModel.find = (filter) => {
            userQueries += 1;
            capturedFilter = filter;
            const requested = new Set(filter._id.$in.map(String));
            const rows = selectedUserRows.filter((user) =>
                requested.has(String(user._id)) && (!filter.team || filter.team.test(user.team))
            );
            return {
                select() { return this; },
                lean: async () => rows.map(({ _id }) => ({ _id }))
            };
        };

        company = { _id: COMPANY_ID, team: 'TEAM1', kod: '0004' };
        selectedUserRows = [
            { _id: USER_ID, team: ' team1 ' },
            { _id: OTHER_ID, team: 'TEAM1' }
        ];
        result = await run(authorizeCompanyUpdate, {
            session: { userId: USER_ID, userTeam: 'TEAM1' },
            authenticatedUserTeam: 'TEAM1',
            params: { companyId: COMPANY_ID },
            body: { selectedUsers: [USER_ID, OTHER_ID] }
        });
        assert.strictEqual(result.next, 1);
        assert.ok(capturedFilter.team instanceof RegExp);

        selectedUserRows = [
            { _id: USER_ID, team: 'TEAM1' },
            { _id: OTHER_ID, team: 'TEAM2' }
        ];
        result = await run(authorizeCompanyUpdate, {
            session: { userId: USER_ID, userTeam: 'TEAM1' },
            authenticatedUserTeam: 'TEAM1',
            params: { companyId: COMPANY_ID },
            body: { selectedUsers: [USER_ID, OTHER_ID] }
        });
        assert.strictEqual(result.next, 0);
        assert.strictEqual(result.res.statusCode, 404);

        selectedUserRows = [{ _id: USER_ID, team: 'TEAM1' }];
        result = await run(authorizeCompanyUpdate, {
            session: { userId: USER_ID, userTeam: 'TEAM1' },
            authenticatedUserTeam: 'TEAM1',
            params: { companyId: COMPANY_ID },
            body: { selectedUsers: [USER_ID, OTHER_ID] }
        });
        assert.strictEqual(result.next, 0);
        assert.strictEqual(result.res.statusCode, 404);

        const queriesBeforeInvalidId = userQueries;
        result = await run(authorizeCompanyUpdate, {
            session: { userId: USER_ID, userTeam: 'TEAM1' },
            authenticatedUserTeam: 'TEAM1',
            params: { companyId: COMPANY_ID },
            body: { selectedUsers: ['invalid-object-id'] }
        });
        assert.strictEqual(result.res.statusCode, 400);
        assert.strictEqual(userQueries, queriesBeforeInvalidId);

        const logs = [];
        const originalConsoleError = console.error;
        UserModel.find = () => {
            throw Object.assign(new Error('private user query detail'), { code: 'DB_FAILURE' });
        };
        console.error = (...args) => logs.push(args);
        try {
            result = await run(authorizeCompanyUpdate, {
                session: { userId: USER_ID, userTeam: 'TEAM1' },
                authenticatedUserTeam: 'TEAM1',
                params: { companyId: COMPANY_ID },
                body: { selectedUsers: [USER_ID] }
            });
            assert.strictEqual(result.res.statusCode, 500);
            assert.deepStrictEqual(result.res.payload, {
                success: false,
                code: 'COMPANY_ACCESS_CHECK_FAILED',
                message: 'Αποτυχία ελέγχου πρόσβασης στην εταιρεία.'
            });
            assert.ok(logs.some((entry) =>
                entry[0] === '[COMPANY_ACCESS]' &&
                entry[1]?.stage === 'SELECTED_USERS_SCOPE_LOOKUP' &&
                entry[1]?.code === 'DB_FAILURE'
            ));
        } finally {
            console.error = originalConsoleError;
        }
    } finally {
        mongoose.set('sanitizeFilter', previousSanitizeFilter);
        UserModel.find = stubbedUserFind;
        CompaniesModel.findById = originalCompanyFindById;
    }

    console.log('PASS company write canonical team/company/input scope contract');
    } finally {
        UserModel.find = originalUserFind;
    }
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
