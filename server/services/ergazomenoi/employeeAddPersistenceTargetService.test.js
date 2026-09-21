'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resolveEmployeeAddPersistenceTarget: resolve } = require('./employeeAddPersistenceTargetService');
const scope = { team: 'team', company_kod: 'company' };
const hire = '2026-09-21';
const id = '507f1f77bcf86cd799439011';
const employee = { _id: id, ...scope, kodikos: '0004', afm: '123456789', amka: '12345678901',
    energos: true, archived: false, hmeromhnia_proslhpshs: hire };
const history = { _id: '507f1f77bcf86cd799439012', ...scope, kodikos: '0004',
    afora_proslhpsh: true, hmeromhnia_proslhpshs: hire };
function fixture(employees = [employee], rows = [history]) {
    let writes = 0;
    const employeeModel = {
        find: async filter => employees.filter(e => e.team === filter.team &&
            e.company_kod === filter.company_kod && new RegExp(filter.afm.$regex).test(e.afm)),
        findOne: async filter => employees.find(e => e.team === filter.team &&
            e.company_kod === filter.company_kod && String(e._id) === String(filter._id)) || null
    };
    const historyModel = { find: async filter => rows.filter(r => r.team === filter.team &&
        r.company_kod === filter.company_kod && r.kodikos === filter.kodikos) };
    return { employeeModel, historyModel, writes: () => writes };
}
const request = (db, extra = {}) => resolve({ ...db, scope,
    formData: { afm_ergazomenoyHidden: ' 123456789 ', amka_ergazomenoyHidden: '12345678901',
        hmeromhnia_proslhpshs: hire, ...extra.formData }, existingEmployeeId: extra.hint });
async function rejected(db, extra, reason) {
    await assert.rejects(request(db, extra), e => e.statusCode === 409 && e.code === reason);
    assert.equal(db.writes(), 0);
}
test('new employee, normalized AFM and other company', async () => {
    assert.equal((await request(fixture([]))).action, 'CREATE_NEW');
    assert.equal((await request(fixture([{ ...employee, company_kod: 'other' }]))).action, 'CREATE_NEW');
});
test('retry selects exact employee and hire row', async () => {
    const result = await request(fixture(), { hint: id });
    assert.equal(result.action, 'CORRECT_EXISTING');
    assert.equal(result.employee._id, id);
    assert.equal(result.employee.kodikos, '0004');
    assert.equal(result.history._id, history._id);
});
test('conflicting AMKA and different hire date reject before writes', async () => {
    await rejected(fixture(), { formData: { amka_ergazomenoyHidden: '99999999999' } },
        'EMPLOYEE_ADD_IDENTITY_CONFLICT');
    await rejected(fixture(), { formData: { hmeromhnia_proslhpshs: '2026-09-22' } },
        'EMPLOYEE_ADD_HIRE_DATE_CONFLICT');
});
test('inactive, departed and archived relationships require rehire', async () => {
    for (const patch of [{ energos: false }, { hmeromhnia_apoxorhshs: '2026-09-22' }, { archived: true }])
        await rejected(fixture([{ ...employee, ...patch }]), {}, 'EMPLOYEE_ADD_REQUIRES_REHIRE');
});
test('same-company duplicates and ambiguous history reject', async () => {
    await rejected(fixture([employee, { ...employee, _id: '507f1f77bcf86cd799439013' }]), {},
        'EMPLOYEE_ADD_AFM_AMBIGUOUS');
    await rejected(fixture([employee], [history, { ...history, _id: '507f1f77bcf86cd799439014' }]), {},
        'EMPLOYEE_ADD_RETRY_HISTORY_AMBIGUOUS');
});
test('foreign, mismatched and invalid retry hints reject', async () => {
    await rejected(fixture([{ ...employee, _id: '507f1f77bcf86cd799439013', company_kod: 'other' }]),
        { hint: '507f1f77bcf86cd799439013' }, 'EMPLOYEE_ADD_IDENTITY_CONFLICT');
    await rejected(fixture([{ ...employee, _id: id, afm: '987654321' }]), { hint: id },
        'EMPLOYEE_ADD_IDENTITY_CONFLICT');
    await rejected(fixture(), { hint: 'invalid' }, 'EMPLOYEE_ADD_IDENTITY_CONFLICT');
});
