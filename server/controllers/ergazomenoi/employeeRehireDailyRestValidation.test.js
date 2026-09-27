'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const { profileInput } = require('../../utils/ergazomenoi/employmentProfileMaintenance');
const {
    rejectEmployeeScheduleDailyRest,
    validateEmployeeScheduleDailyRest
} = require('../../services/ergazomenoi/employeeScheduleDailyRestValidationService');
const { twoDaySchedule } = require('../../../test/fixtures/employeeDailyRestFixtures');

const source = fs.readFileSync(
    __dirname + '/employeeRehireController.js',
    'utf8'
);
const { pickRehireChanges } = require('./employeeRehireController');

function response() {
    return {
        code: 200,
        status(code) {
            this.code = code;
            return this;
        },
        json(body) {
            this.body = body;
            return this;
        }
    };
}

function productionHandler(writeEmployeeRehire) {
    const start = source.indexOf('async function postEmployeeRehire(');
    const end = source.indexOf('\nmodule.exports', start);
    assert.ok(start >= 0 && end > start);
    return vm.runInNewContext(`(${source.slice(start, end)})`, {
        objectOrEmpty(value) {
            return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
        },
        pickRehireChanges,
        profileInput,
        rejectEmployeeScheduleDailyRest,
        validateEmployeeScheduleDailyRest,
        requireScopedEmployeeForUpdate: async () => ({
            employee: { _id: 'employee-id' },
            employeeCode: '0001'
        }),
        ErgazomenoiModel: {},
        mongoose: { Types: { ObjectId: function ObjectId() {} } },
        writeEmployeeRehire,
        isExpectedRehireError: () => false,
        rehireMessage: () => '',
        console: { error() {} },
        String,
        Object,
        Array
    });
}

test('rehire controller rejects ten-hour rest before lifecycle/history writer', async () => {
    let writes = 0;
    const handler = productionHandler(async () => {
        writes++;
        return {};
    });
    const req = {
        body: {
            employment: {
                ...twoDaySchedule(
                    [{ start: '14:00', end: '22:00' }],
                    [{ start: '08:00', end: '16:00' }]
                ),
                hmeromhnia_proslhpshs: '2026-09-27'
            },
            profile: { ores_ergasias_ebdomadas: 40 }
        },
        session: { userTeam: 'team', companyInUse: 'company' }
    };
    const res = response();

    await handler(req, res);
    assert.equal(res.code, 400);
    assert.equal(res.body.reason, 'EMPLOYEE_SCHEDULE_DAILY_REST_VIOLATION');
    assert.match(res.body.message, /11 ωρών/);
    assert.equal(writes, 0);
});

test('rehire controller allows exactly eleven hours to reach the lifecycle writer', async () => {
    let writes = 0;
    const handler = productionHandler(async () => {
        writes++;
        return { cycle_no: 2, rehire_date: '2026-09-27' };
    });
    const req = {
        body: {
            formData: {
                ...twoDaySchedule(
                    [{ start: '14:00', end: '22:00' }],
                    [{ start: '09:00', end: '17:00' }]
                ),
                hmeromhnia_proslhpshs: '2026-09-27'
            }
        },
        session: { userTeam: 'team', companyInUse: 'company' }
    };
    const res = response();

    await handler(req, res);
    assert.equal(res.code, 200);
    assert.equal(res.body.success, true);
    assert.equal(writes, 1);
});
