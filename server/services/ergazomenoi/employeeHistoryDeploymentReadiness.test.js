'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { classifyEmployeeHistory } = require('./employeeHistoryPopulationReadinessService');
const { buildReal0002SanitizedHistoryFixture } = require('./fixtures/real0002SanitizedHistoryFixture');

test('legacy coverage remains pending while independently preserved maintenance is deployment-safe', async () => {
    const f = buildReal0002SanitizedHistoryFixture(), before = structuredClone(f);
    const r = await classifyEmployeeHistory({ currentEmployee: f.currentEmployee,
        historyRows: f.history, connection: {}, referenceChecker: async () => [] });
    assert.equal(r.reason, 'HISTORY_COVERAGE_MISSING');
    assert.equal(r.deploymentBlocker, false);
    assert.equal(r.independentMaintenanceAllowed, true);
    assert.equal(r.historyMutationAllowed, false);
    assert.equal(r.historyStatus, 'LEGACY_REVIEW_REQUIRED');
    assert.deepEqual(f, before);
});

function targetFixture(departure = false) {
    const scope = { team: 'TEST', company_kod: 'company', kodikos: 'target' };
    const hire = departure ? '2025-01-01' : '2024-01-01', start = '2025-01-01';
    const row = { ...require('../../../test/fixtures/employeeCompleteProfileFixture').completeSyntheticEmploymentTerms(), ...scope, _id: '507f1f77bcf86cd799439111', aa_eggrafhs: '0001',
        hmeromhnia_proslhpshs: hire, hmeromhnia_allaghs_symbashs: start,
        hmeromhnia_allaghs_orarioy_apo: start, hmeromhnia_allaghs_orarioy_eos: "2025-01-07",
        hmeromhnia_isxyos_oron_ergasias_apo: start,
        hmeromhnia_isxyos_oron_ergasias_eos: departure ? '2025-02-01' : null,
        hmeromhnia_apoxorhshs: null, afora_allagh_oron_ergasias: true,
        afora_proslhpsh: false, employment_profile_source: 'ERGOMENOI_CONTROLLER',
        hmeres_ergasias_ebdomadas: 5, ores_ergasias_ebdomadas: 40,
        mo_oron_hmerhsias_ergasias: 8 };
    const second = { ...row, _id: '507f1f77bcf86cd799439112', aa_eggrafhs: '0002',
        afora_allagh_oron_ergasias: departure, afora_proslhpsh: false,
        ...(departure ? { hmeromhnia_apoxorhshs: '2025-02-01' } : {}) };
    return { currentEmployee: { ...second, _id: '507f1f77bcf86cd799439110',
        energos: !departure, ...(!departure ? { employment_import_provenance: {
            version: 1, source: 'PREVIOUS_PAYROLL_APPLICATION', status: 'VERIFIED',
            hireDate: hire, trackingStartDate: start, verifiedBy: 'synthetic-admin',
            verifiedAt: new Date('2025-01-01'), auditId: '507f1f77bcf86cd799439190' } } : {}), ...(departure ? { hmeromhnia_isxyos_oron_ergasias_apo: '2025-01-20' } : {}) },
        historyRows: [row, second] };
}
for (const departure of [false, true]) test('non-unique legacy target is not an application failure: ' + departure, async () => {
    const f = targetFixture(departure), before = structuredClone(f);
    const r = await classifyEmployeeHistory({ ...f, connection: {}, referenceChecker: async () => [] });
    assert.equal(r.classification, 'LEGACY_TARGET_SELECTION_REQUIRED', JSON.stringify(r.canonical?.diagnostics));
    assert.equal(r.reason, 'CONFLICT_AMBIGUOUS_TARGET');
    assert.equal(r.deploymentBlocker, false);
    assert.equal(r.historyMutationAllowed, false);
    assert.deepEqual(f, before);
});

test('scope corruption remains a deployment blocker', async () => {
    const f = targetFixture();
    f.historyRows[0].company_kod = 'wrong-company';
    const r = await classifyEmployeeHistory({ ...f, connection: {}, referenceChecker: async () => [] });
    assert.equal(r.deploymentBlocker, true);
    assert.equal(r.independentMaintenanceAllowed, false);
});

module.exports = { targetFixture };

for (const departure of [false, true]) test('actual writer preserves legacy target ambiguity and rejects new historical changes: ' + departure, async () => {
    const f = targetFixture(departure);
    const { store } = require('../../../test/fixtures/employeeProfileTransactionStore');
    const db = store([{ employee: f.currentEmployee, history: f.historyRows }]);
    const W = require('./employeeEmploymentProfileWriter');
    const before = db.state();
    const query = value => ({ select() { return this; }, session() { return this; }, lean: async () => value });
    const run = changes => W.writeEmployeeMaintenance({ ...db.deps,
        expectedEmployeeStateToken: require('../../utils/ergazomenoi/employeeSaveState').employeeStateToken(db.state().employees[0]),
        scope: Object.fromEntries(['team', 'company_kod', 'kodikos'].map(k => [k, f.currentEmployee[k]])),
        employeeId: f.currentEmployee._id, actorUserId: 'synthetic',
        userModel: { findById: () => query({ team: 'TEST', situation: 'A' }) },
        privilegeModel: { findOne: () => query({ privileges: { update: true } }) },
        input: {}, maintenance: { employeeChanges: changes, submittedEmployeeFields: Object.keys(changes),
            historyChanges: {}, submittedProfileFields: [], submittedFormValues: changes } });
    for (const method of ['create', 'updateOne', 'updateMany', 'deleteOne', 'deleteMany', 'bulkWrite'])
        db.deps.historyModel[method] = () => { throw new Error('HISTORY_WRITE_FORBIDDEN'); };
    await assert.rejects(run({ pragmatikosMisthos: 2200 }), { code: 'EMPLOYEE_SAVE_LEGACY_HISTORY_READ_ONLY' });
    assert.deepEqual(db.state(), before);
    const saved = await run({ email: 'readiness@example.invalid' });
    assert.equal(saved.employee.email, 'readiness@example.invalid');
    assert.equal(saved.historyUpdated, false);
    assert.notEqual(saved.historyStatus, 'CLEAN');
    assert.deepEqual(db.state().history, before.history);
    assert.deepEqual(db.state().audits, before.audits);
});

test('an unverified MANAGEMENT_RESOLVED label never certifies legacy history CLEAN', async () => {
    const f = targetFixture(false);
    f.currentEmployee.historyStatus = 'MANAGEMENT_RESOLVED';
    f.currentEmployee.managementResolved = true;
    const r = await classifyEmployeeHistory({ ...f, connection: {}, referenceChecker: async () => [] });
    assert.equal(r.historyStatus, 'LEGACY_REVIEW_REQUIRED');
    assert.equal(r.historyMutationAllowed, false);
});
