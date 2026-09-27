'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
    fixtures
} = require('../../../test/fixtures/employeeDailyRestFixtures');
const browserCore = require('../../../public/js/ergazomenoi/genika/dailyRestValidation');
const {
    EMPLOYEE_SCHEDULE_DAILY_REST_MESSAGE,
    EMPLOYEE_SCHEDULE_DAILY_REST_VIOLATION,
    rejectEmployeeScheduleDailyRest,
    validateEmployeeScheduleDailyRest
} = require('./employeeScheduleDailyRestValidationService');

test('server validation matches the browser core for all shared schedule fixtures', () => {
    for (const fixture of fixtures) {
        const browserViolations = browserCore.collectDailyRestViolations(
            browserCore.scheduleDaysFromFormData(fixture.formData)
        );
        const serverValidation = validateEmployeeScheduleDailyRest(fixture.formData);

        assert.deepEqual(
            serverValidation.violations.map((violation) => violation.restMinutes),
            fixture.expectedRestMinutes,
            fixture.name
        );
        assert.deepEqual(serverValidation.violations, browserViolations, fixture.name);
        assert.equal(serverValidation.valid, fixture.expectedRestMinutes.length === 0);
    }
});

test('daily-rest rejection is deterministic, human-readable and non-500', () => {
    const validation = validateEmployeeScheduleDailyRest(fixtures[0].formData);
    const res = {
        statusCode: 200,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(body) {
            this.body = body;
            return this;
        }
    };

    rejectEmployeeScheduleDailyRest(res, validation);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.reason, EMPLOYEE_SCHEDULE_DAILY_REST_VIOLATION);
    assert.equal(res.body.message, EMPLOYEE_SCHEDULE_DAILY_REST_MESSAGE);
    assert.deepEqual(res.body.violations, [
        {
            previousDate: '2026-09-27',
            currentDate: '2026-09-28',
            restMinutes: 600
        }
    ]);
});
