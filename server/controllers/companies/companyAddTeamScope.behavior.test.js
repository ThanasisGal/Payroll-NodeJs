'use strict';

const assert = require('assert');
const UserModel = require('../../models/userModel');
const { PerifereiesModel } = require('../../models/stathera_arxeia');
const companiesController = require('./companiesController');

function response() {
    return {
        statusCode: 200,
        payload: null,
        rendered: null,
        status(code) { this.statusCode = code; return this; },
        json(value) { this.payload = value; return this; },
        render(view, locals) { this.rendered = { view, locals }; return this; },
        send(value) { this.payload = value; return this; }
    };
}

(async () => {
    const originalPerifereiesFind = PerifereiesModel.find;
    const originalUserFind = UserModel.find;
    try {
        PerifereiesModel.find = () => ({ sort: async () => [] });

        const thaPage = response();
        await companiesController.addCompanyForm({ session: { userTeam: ' tha ' } }, thaPage);
        assert.strictEqual(thaPage.rendered.view, 'companies/genikastoixeia/add');
        assert.strictEqual(thaPage.rendered.locals.managedTeam, 'THA');
        assert.strictEqual(thaPage.rendered.locals.canManageAllTeams, true);

        const restrictedPage = response();
        await companiesController.addCompanyForm(
            { session: { userTeam: ' blg ' } },
            restrictedPage
        );
        assert.strictEqual(restrictedPage.rendered.locals.managedTeam, 'BLG');
        assert.strictEqual(restrictedPage.rendered.locals.canManageAllTeams, false);

        let capturedFilter;
        let selectedProjection;
        UserModel.find = (filter) => {
            capturedFilter = filter;
            return {
                select(projection) { selectedProjection = projection; return this; },
                lean: async () => [{ _id: 'user-1', lastName: 'Βήτα', firstName: 'Λάμδα', team: 'BLG' }]
            };
        };

        const thaUsers = response();
        await companiesController.getAllUsersByTeam({
            authenticatedUserTeam: 'THA',
            params: { companyTeam: ' blg ' }
        }, thaUsers);
        assert.strictEqual(thaUsers.statusCode, 200);
        assert.ok(capturedFilter.team instanceof RegExp);
        assert.strictEqual(capturedFilter.team.test('BLG'), true);
        assert.strictEqual(capturedFilter.team.test('OTHER'), false);
        assert.strictEqual(selectedProjection, '_id lastName firstName team');
        assert.strictEqual(thaUsers.payload.length, 1);

        const restrictedUsers = response();
        await companiesController.getAllUsersByTeam({
            authenticatedUserTeam: 'BLG',
            params: { companyTeam: 'BLG' }
        }, restrictedUsers);
        assert.strictEqual(restrictedUsers.statusCode, 200);

        capturedFilter = undefined;
        const deniedUsers = response();
        await companiesController.getAllUsersByTeam({
            authenticatedUserTeam: 'BLG',
            params: { companyTeam: 'OTHER' }
        }, deniedUsers);
        assert.strictEqual(deniedUsers.statusCode, 404);
        assert.deepStrictEqual(deniedUsers.payload, []);
        assert.strictEqual(capturedFilter, undefined);

        console.log('PASS company add render context and team-scoped user endpoint');
    } finally {
        PerifereiesModel.find = originalPerifereiesFind;
        UserModel.find = originalUserFind;
    }
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
