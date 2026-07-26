'use strict';

const assert = require('assert');
const { CompaniesModel } = require('../models/companies');
const { ErgazomenoiModel } = require('../models/ergazomenoi');
const scope = require('./programmataAccessScope');

function response() {
    return {
        statusCode: 200,
        body: null,
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; }
    };
}

function companyResult(company) {
    return { select() { return this; }, lean: async () => company };
}

function employeeResult(rows) {
    return { select() { return this; }, lean: async () => rows };
}

(async () => {
    assert.throws(() => scope.employeeCode({}), /Programmata access denied/);
    assert.throws(() => scope.employeeCodes([]), /Programmata access denied/);
    assert.throws(() => scope.employeeCodes(new Array(501).fill('1')), /Programmata access denied/);
    assert.deepStrictEqual(scope.employeeCodes([' 001 ', '001', '002']), ['001', '002']);
    assert.throws(() => scope.dateRange('2026-02-30', '2026-03-01'));
    assert.throws(() => scope.dateRange('2026-03-02', '2026-03-01'));

    const originalCompanyFindById = CompaniesModel.findById;
    const originalEmployeeFind = ErgazomenoiModel.find;
    try {
        CompaniesModel.findById = () =>
            companyResult({ _id: '507f1f77bcf86cd799439011', team: 'TEAM1', kod: 'C1' });
        ErgazomenoiModel.find = () => employeeResult([{ kodikos: '001' }]);

        const req = {
            session: { userId: '7' },
            authenticatedUserTeam: 'TEAM1',
            params: {
                selectedTeam: ' team1 ',
                selectedCompany: '507f1f77bcf86cd799439011',
                selectedKodikos: '001'
            }
        };
        let next = 0;
        await scope.authorizeEmployee(req, response(), () => next++);
        assert.strictEqual(next, 1);
        assert.ok(Object.isFrozen(req.programmataAccessScope));
        assert.strictEqual(req.programmataAccessScope.effectiveTeam, 'TEAM1');
        assert.strictEqual(req.programmataAccessScope.employeeCode, '001');

        const crossTeam = {
            ...req,
            authenticatedUserTeam: 'TEAM2',
            programmataAccessScope: undefined
        };
        const denied = response();
        await scope.authorizeEmployee(crossTeam, denied, () => assert.fail('next called'));
        assert.strictEqual(denied.statusCode, 404);

        const tha = {
            ...req,
            authenticatedUserTeam: 'THA',
            programmataAccessScope: undefined
        };
        let thaNext = 0;
        await scope.authorizeEmployee(tha, response(), () => thaNext++);
        assert.strictEqual(thaNext, 1);

        ErgazomenoiModel.find = () => employeeResult([]);
        const foreignEmployee = response();
        await scope.authorizeEmployee(req, foreignEmployee, () => assert.fail('next called'));
        assert.strictEqual(foreignEmployee.statusCode, 404);
    } finally {
        CompaniesModel.findById = originalCompanyFindById;
        ErgazomenoiModel.find = originalEmployeeFind;
    }
    console.log('PASS programmata canonical company/team/employee/date scope');
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
