'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');
const { ErgazomenoiModel } = require('../../models/ergazomenoi');
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
test('AFM selector survives real Ergazomenoi sanitize and cast', async () => {
    const previous = mongoose.get('sanitizeFilter');
    mongoose.set('sanitizeFilter', true);
    try {
        let checked = false;
        const employeeModel = { find(filter) {
            const query = ErgazomenoiModel.find(filter);
            mongoose.sanitizeFilter(query.getFilter());
            assert.doesNotThrow(() => query.cast(ErgazomenoiModel));
            assert.equal(query.getFilter().afm.$regex, '^\\s*123456789\\s*$');
            checked = true;
            return Promise.resolve([]);
        } };
        assert.equal((await request({ employeeModel, historyModel: {} })).action, 'CREATE_NEW');
        assert.equal(checked, true);
    } finally {
        mongoose.set('sanitizeFilter', previous);
    }
});
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
test('safe 409 business messages reach both employee add error dialogs', async () => {
    const conflicts = [
        [fixture([{ ...employee, amka: '99999999999' }]), {}, 'Το ΑΜΚΑ διαφέρει'],
        [fixture([{ ...employee, hmeromhnia_proslhpshs: '2026-09-20' }]), {}, 'Η ημερομηνία πρόσληψης διαφέρει'],
        [fixture([{ ...employee, energos: false }]), {}, 'Χρησιμοποιήστε την επαναπρόσληψη']
    ];
    const sourceRoot = path.resolve(__dirname, '../../../public/js/ergazomenoi/genika');
    for (const name of ['getFieldValues.js', 'putFieldValues.js']) {
        const source = fs.readFileSync(path.join(sourceRoot, name), 'utf8');
        const expression = source.match(/message = (data\?\.message \|\| data\?\.errorMessage \|\| '');/);
        assert.ok(expression, name);
        assert.match(source, /text: String\(message \|\| err\)/);
        const displayed = new Function('data', `return ${expression[1]};`);
        for (const [db, extra, expected] of conflicts) {
            await assert.rejects(request(db, extra), error => {
                assert.equal(error.statusCode, 409);
                assert.match(displayed({ message: error.message }), new RegExp(expected));
                assert.doesNotMatch(displayed({ message: error.message }), /HTTP 409/);
                return true;
            });
        }
    }
});
