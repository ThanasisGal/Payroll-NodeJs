'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PASSIVE_LENDING_DEFAULTS: defaults, normalizeEmployeeNormalSaveRequest: normalize } =
    require('./employeeNormalSaveNormalization');
const M = require('./employmentProfileMaintenance');
const W = require('../../services/ergazomenoi/employeeEmploymentProfileWriter');
const { fixture, store } = require('../../../test/fixtures/employeeProfileTransactionStore');
const request = (changes, submitted = changes) => ({ input: {}, maintenance: {
    employeeChanges: changes, submittedEmployeeFields: Object.keys(changes),
    submittedFormValues: submitted, historyChanges: {}, submittedHistoryChanges: {}
} });

test('only the four proven lending defaults have a passive policy; no client flags are consulted', () => {
    assert.deepEqual(Object.keys(defaults), ['afm_daneizontos_ergodoth',
        'afm_daneizomenoy_ergodoth', 'typos_ergodoth_daneismoy', 'kodikos_ergazomenoy_alloy_ergodoth']);
    const other = { typos_daneismoy: '', hmnia_enarxhs_daneismoy: null,
        hmnia_lhxhs_daneismoy: null, unrelated: false };
    const value = request({ ...defaults, ...other, afora_daneismo_ergazomenoy: false });
    const before = structuredClone(value);
    assert.deepEqual(normalize(value, {}).maintenance.employeeChanges,
        { ...other, afora_daneismo_ergazomenoy: false });
    assert.deepEqual(value, before, 'normalization must not mutate the submitted request');
});

for (const flag of [false, undefined]) test(`A/B/G: clean non-lending Save preserves absent dependents, flag=${flag}`, async () => {
    const f = fixture();
    if (flag === false) f.employee.afora_daneismo_ergazomenoy = false;
    const changes = { ...defaults, afora_daneismo_ergazomenoy: false, parathrhseis: 'legitimate edit' };
    const normalized = normalize(request(changes), f.employee);
    for (const field of Object.keys(defaults)) {
        assert.equal(Object.hasOwn(normalized.maintenance.employeeChanges, field), false);
        assert.equal(normalized.maintenance.submittedEmployeeFields.includes(field), false);
    }
    // A missing legacy flag still follows the existing submitted false policy.
    assert.equal(normalized.maintenance.employeeChanges.afora_daneismo_ergazomenoy, false);
    const db = store([f]);
    await W.writeEmployeeEmploymentProfile({ ...db.deps, ...request(changes),
        scope: { team: f.employee.team, company_kod: f.employee.company_kod, kodikos: f.employee.kodikos },
        employeeId: f.employee._id, effectiveFrom: '2026-03-01' });
    const after = db.state().employees[0];
    for (const field of Object.keys(defaults)) assert.equal(Object.hasOwn(after, field), false, field);
    assert.equal(after.parathrhseis, 'legitimate edit');
});

for (const [name, before, submitted] of [
    ['C: false to true', false, { afora_daneismo_ergazomenoy: true,
        afm_daneizontos_ergodoth: '123456789', afm_daneizomenoy_ergodoth: '987654321',
        typos_ergodoth_daneismoy: true, kodikos_ergazomenoy_alloy_ergodoth: '0020' }],
    ['D: true to false cleanup', true, { afora_daneismo_ergazomenoy: false, ...defaults }],
    ['E: already lending edit', true, { afora_daneismo_ergazomenoy: true,
        ...defaults, kodikos_ergazomenoy_alloy_ergodoth: '0021' }]
]) test(`${name} retains authoritative values through the writer`, async () => {
    const f = fixture();
    Object.assign(f.employee, { afora_daneismo_ergazomenoy: before,
        kodikos_ergazomenoy_alloy_ergodoth: '0019' });
    assert.deepEqual(normalize(request(submitted), f.employee).maintenance.employeeChanges, submitted);
    const db = store([f]);
    await W.writeEmployeeEmploymentProfile({ ...db.deps, ...request(submitted),
        scope: { team: f.employee.team, company_kod: f.employee.company_kod, kodikos: f.employee.kodikos },
        employeeId: f.employee._id, effectiveFrom: '2026-03-01' });
    for (const [field, value] of Object.entries(submitted)) assert.equal(db.state().employees[0][field], value);
});

test('F: forged non-neutral raw values are never disguised as passive by controller cleanup', () => {
    for (const [field, neutral] of Object.entries(defaults)) {
        const forged = typeof neutral === 'boolean' ? [true, 'false', 0, null] : ['123456789', ' ', false, null];
        for (const value of forged) {
            const mapped = { afora_daneismo_ergazomenoy: false, [field]: neutral };
            const raw = { ...mapped, [field]: value, readonly: true, disabled: true, derived: true, untouched: true };
            assert.equal(Object.hasOwn(normalize(request(mapped, raw), {}).maintenance.employeeChanges, field), true);
        }
    }
    // Non-neutral stored data also retains the existing cleanup intent.
    assert.equal(normalize(request({ ...defaults }), { afm_daneizontos_ergodoth: '123456789' })
        .maintenance.employeeChanges.afm_daneizontos_ergodoth, '');
});

test('derived echoes are omitted from Employee and History; base zero normalization remains distinct and narrow', () => {
    const changes = Object.fromEntries(M.AUTO_DERIVED_READONLY_FIELDS.map(field => [field, 5]));
    const value = request(changes);
    value.maintenance.historyChanges = changes;
    value.maintenance.submittedHistoryChanges = changes;
    const actual = normalize(value, { synolo_proyphresias_se_mhnes: 3 });
    assert.deepEqual(actual.maintenance.employeeChanges, {});
    assert.deepEqual(actual.maintenance.historyChanges, {});
    assert.deepEqual(actual.maintenance.submittedHistoryChanges, {});
    assert.deepEqual(M.BASE_ZERO_NORMALIZABLE_FIELDS,
        ['proyphresia_se_eth', 'proyphresia_se_mhnes', 'proyphresia_adeias_se_eth']);
    const zeros = Object.fromEntries(M.BASE_ZERO_NORMALIZABLE_FIELDS.map(field => [field, 0]));
    assert.deepEqual(normalize(request(zeros), {}).maintenance.employeeChanges, zeros);
});

test('tax representation uses the existing canonical comparison; genuine tax changes remain authoritative', () => {
    const current = { forologikh_klimaka: '20260200 - existing description' };
    assert.equal(M.departureMaintenanceValuesEqual('forologikh_klimaka', current.forologikh_klimaka, '0200'), true);
    assert.deepEqual(normalize(request({ forologikh_klimaka: '0200' }), current).maintenance.employeeChanges, {});
    assert.equal(normalize(request({ forologikh_klimaka: '0300' }), current).maintenance.employeeChanges.forologikh_klimaka, '0300');
});

test('EFKA aliases have no false/null equivalence: explicit null and forged values cannot obtain passive treatment', () => {
    for (const field of ['meiosh_eisforon_mhteron', 'meiosh_eisforon_ergazomenon', 'epidothsh_eisforon_ergodoth']) {
        for (const value of [null, 'false', 0, 'forged']) {
            const actual = normalize(request({ [field]: value }, { mhteres: false,
                [field]: value, untouched: true, disabled: true }), { [field]: false });
            assert.equal(Object.hasOwn(actual.maintenance.employeeChanges, field), true);
            assert.equal(actual.maintenance.employeeChanges[field], value);
            assert.equal(M.departureMaintenanceValuesEqual(field, false, null), false);
        }
    }
});

for (const [before, after] of [[false, true], [true, false]]) {
    test(`EFKA explicit mother reduction transition ${before} -> ${after} remains a business write`, async () => {
        const f = fixture(); f.employee.meiosh_eisforon_mhteron = before;
        const db = store([f]), changes = { meiosh_eisforon_mhteron: after };
        await W.writeEmployeeEmploymentProfile({ ...db.deps, ...request(changes),
            scope: { team: f.employee.team, company_kod: f.employee.company_kod, kodikos: f.employee.kodikos },
            employeeId: f.employee._id, effectiveFrom: '2026-03-01' });
        assert.equal(db.state().employees[0].meiosh_eisforon_mhteron, after);
    });
}
