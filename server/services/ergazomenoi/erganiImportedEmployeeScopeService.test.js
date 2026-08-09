const test = require('node:test');
const assert = require('node:assert/strict');
const {
    AMBIGUOUS_SCOPE_CODE,
    OUTSIDE_SCOPE_CODE,
    assertEmployeeWriteScope,
    indexScopedEmployees,
    loadScopedErganiEmployees
} = require('./erganiImportedEmployeeScopeService');

const scope = { team: 'THA', company_kod: '69e8e92fb198b803164b824a', ypokatasthma: '0000' };
const target = { _id: 'target', afm: '123456789', kodikos: '0001', ...scope };
const other = { _id: 'other', afm: '123456789', kodikos: '9999', team: 'THA', company_kod: '6a43937c651b88e0f3f3024a', ypokatasthma: '0000' };

test('same AFM in target and other company resolves only the authorized employee', () => {
    const result = indexScopedEmployees([other, target], scope);
    assert.equal(result.resolved.get(target.afm), target);
    assert.equal(result.ambiguousAfms.size, 0);
});

test('AFM existing only outside company remains scoped unmatched', () => {
    const result = indexScopedEmployees([other], scope);
    assert.equal(result.resolved.has(other.afm), false);
    assert.throws(() => assertEmployeeWriteScope(other, scope), (error) => error.code === OUTSIDE_SCOPE_CODE);
});

test('multiple candidates inside exact scope fail closed as ambiguous', () => {
    const result = indexScopedEmployees([target, { ...target, _id: 'target-2' }], scope);
    assert.equal(result.resolved.has(target.afm), false);
    assert.equal(result.ambiguousAfms.has(target.afm), true);
    assert.equal(AMBIGUOUS_SCOPE_CODE, 'ERGANI_IMPORTED_EMPLOYEE_AMBIGUOUS_AUTHORIZED_SCOPE');
});

test('batch loader query always contains exact team company branch and AFM set', async () => {
    let query;
    const employeeModel = { find: (value) => { query = value; return { lean: async () => [target] }; } };
    const result = await loadScopedErganiEmployees({ employeeModel, afms: [target.afm], scope });
    assert.equal(query.team, scope.team);
    assert.equal(query.company_kod, scope.company_kod);
    assert.equal(query.ypokatasthma, scope.ypokatasthma);
    assert.deepEqual(query.afm.$in, [target.afm]);
    assert.equal(result.resolved.get(target.afm), target);
});
