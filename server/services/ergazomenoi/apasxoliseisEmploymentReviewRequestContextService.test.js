'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
    DEFAULT_EMPLOYEE_PAGE_SIZE,
    MAX_EMPLOYEE_PAGE_SIZE,
    paginateEmployeeCodes,
    loadEmploymentReviewRequestContext
} = require('./apasxoliseisEmploymentReviewRequestContextService');

test('employee pagination keeps each employee whole and enforces the safe upper bound', () => {
    const values = Array.from({ length: 205 }, (_, index) => String(index + 1).padStart(4, '0'));
    const page = paginateEmployeeCodes({ values, page: 2, limit: 5000 });
    assert.equal(page.limit, 100);
    assert.equal(page.totalEmployees, 205);
    assert.equal(page.totalPages, 3);
    assert.deepEqual(page.employeeCodes, values.slice(100, 200));
});

test('default pagination keeps 26 employees on one page of 50', () => {
    const values = Array.from({ length: 26 }, (_, index) =>
        String(index + 1).padStart(4, '0'));
    const first = paginateEmployeeCodes({ values, page: 1 });

    assert.equal(DEFAULT_EMPLOYEE_PAGE_SIZE, 50);
    assert.equal(first.limit, 50);
    assert.equal(first.totalEmployees, 26);
    assert.equal(first.totalPages, 1);
    assert.deepEqual(first.employeeCodes, values);
});

test('default pagination splits 51 employees into pages of 50 and 1', () => {
    const values = Array.from({ length: 51 }, (_, index) =>
        String(index + 1).padStart(4, '0'));
    const first = paginateEmployeeCodes({ values, page: 1 });
    const second = paginateEmployeeCodes({ values, page: 2 });

    assert.equal(first.limit, 50);
    assert.equal(first.totalPages, 2);
    assert.deepEqual(first.employeeCodes, values.slice(0, 50));
    assert.equal(second.limit, 50);
    assert.equal(second.totalPages, 2);
    assert.deepEqual(second.employeeCodes, values.slice(50));
    assert.equal(MAX_EMPLOYEE_PAGE_SIZE, 100);
});

test('selected employee overrides pagination and only loads the selected scope', async () => {
    const loaded = [];
    const context = await loadEmploymentReviewRequestContext({
        selectedEmployeeCode: '0031', page: 9, limit: 100,
        employeeCodeLoader: async () => ['0014', '0031', '0025'],
        dailyRowsLoader: async (codes) => {
            loaded.push(['daily', ...codes]);
            return [{ kodikos: codes[0], hmeromhnia: '2026-06-01' }];
        },
        dependencyRowsLoader: async (codes) => {
            loaded.push(['dependency', ...codes]);
            return [{ kodikos: codes[0], hmeromhnia: '2026-06-01' }];
        }
    });
    assert.deepEqual(context.employeeCodes, ['0031']);
    assert.equal(context.limit, 1);
    assert.deepEqual(loaded, [['daily', '0031'], ['dependency', '0031']]);
    assert.equal(context.dailyRowsByEmployeeCode.get('0031').length, 1);
});
