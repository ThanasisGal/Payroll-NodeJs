'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
    generatePersistedEmployeeContract
} = require('./persistedEmployeeContractService');

test('automatic Employee Maintenance contract uses the persisted post-save employee', async () => {
    const scope = { _id: 'employee-0002', team: 'TEAM', company_kod: 'COMPANY-0006' };
    const stalePreSaveEmployee = {
        ...scope,
        hmeromhnia_lhxhs_symbashs: '2026-07-30'
    };
    const persistedPostSaveEmployee = {
        ...scope,
        hmeromhnia_lhxhs_symbashs: '2027-07-30'
    };
    let generatedFrom;

    const result = await generatePersistedEmployeeContract({
        employeeModel: {
            async findOne(receivedScope) {
                assert.deepEqual(receivedScope, scope);
                return persistedPostSaveEmployee;
            }
        },
        employeeScope: scope,
        async generateContractPDF(employee) {
            generatedFrom = employee;
            return 'contracts/persisted.pdf';
        },
        userContext: { team: 'TEAM' }
    });

    assert.equal(result, 'contracts/persisted.pdf');
    assert.equal(generatedFrom, persistedPostSaveEmployee);
    assert.notEqual(generatedFrom, stalePreSaveEmployee);
    assert.equal(generatedFrom.hmeromhnia_lhxhs_symbashs, '2027-07-30');
});

test('automatic contract generation fails closed when the scoped persisted employee is missing', async () => {
    await assert.rejects(
        generatePersistedEmployeeContract({
            employeeModel: { async findOne() { return null; } },
            employeeScope: { _id: 'missing' },
            async generateContractPDF() {
                assert.fail('generator must not run without the persisted employee');
            },
            userContext: {}
        }),
        (error) =>
            error.code === 'CONTRACT_PERSISTED_EMPLOYEE_NOT_FOUND' &&
            error.message ===
                'Ο αποθηκευμένος εργαζόμενος δεν βρέθηκε. Δεν δημιουργήθηκε PDF σύμβασης.'
    );
});

test('Employee Maintenance update routes automatic generation through the persisted source', () => {
    const controller = fs.readFileSync(
        path.resolve(__dirname, '../../controllers/ergazomenoi/ergazomenoiController.js'),
        'utf8'
    );
    const start = controller.indexOf('static postErgazomenoiUpdate');
    const end = controller.indexOf('static deleteErgazomenoi', start);
    const updateHandler = controller.slice(start, end);

    assert.match(updateHandler, /generatePersistedEmployeeContract\(\{/);
    assert.match(updateHandler, /employeeModel: ErgazomenoiModel/);
    assert.match(updateHandler, /employeeScope/);
    assert.doesNotMatch(updateHandler, /generateContractPDF\(updatedErgazomenos/);
});
