'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const { buildEmployeeDepartureTransition: transition } = require('./employeeDepartureLifecycleTransitionService');
const { fixture } = require('../../../test/fixtures/employeeProfileTransactionStore');
const date = '2026-10-04';
const run = (value, build = transition) => build({ currentEmployee: value.employee,
    history: value.history, departureDate: date });

test('explicit legacy validity survives false event flag without inventing V1 provenance', () => {
    const value = fixture();
    value.history = [value.history[2]];
    const row = value.history[0];
    delete row.employment_profile_schema_version;
    row.afora_allagh_oron_ergasias = false;
    const before = structuredClone(value);
    assert.equal(run(value).latestProfileRow._id, row._id);
    assert.deepEqual(value, before);
});

test('profile selection follows explicit validity independently of ids, numbering and array order', () => {
    const value = fixture();
    value.history.reverse();
    value.history[0].aa_eggrafhs = '0000';
    value.history[0].createdAt = new Date('2000-01-01');
    assert.equal(run(value).latestProfileRow._id, value.history[0]._id);
});

for (const end of [null, '2026-10-15', '2026-10-04', '2026-09-30']) {
    test(`Employee and selected profile end clamp only if open/later: ${end}`, () => {
        const value = fixture();
        value.history = [value.history[2]];
        value.history[0].hmeromhnia_isxyos_oron_ergasias_eos = end;
        value.employee.hmeromhnia_isxyos_oron_ergasias_eos = end;
        const result = run(value);
        assert.equal(result.clampEmployeeEnd, !end || end > date);
        assert.equal(Boolean(result.clampProfileEnd), !end || end > date);
    });
}

for (const start of [undefined, null, '']) {
    test(`false legacy event flag with missing explicit validity cannot use schedule dates: ${start}`, () => {
        const value = fixture();
        value.history = [value.history[2]];
        Object.assign(value.history[0], { afora_allagh_oron_ergasias: false,
            hmeromhnia_isxyos_oron_ergasias_apo: start, hmeromhnia_allaghs_orarioy_apo: '2026-03-01' });
        if (start === undefined) delete value.history[0].hmeromhnia_isxyos_oron_ergasias_apo;
        assert.throws(() => run(value), { code: 'EMPLOYEE_DEPARTURE_HISTORY_REQUIRED' });
    });
}

test('two competing latest profiles fail closed, including when numbering differs', () => {
    const value = fixture();
    value.history.push({ ...value.history[2], _id: 'competing-profile', aa_eggrafhs: '9999' });
    assert.throws(() => run(value), { code: 'EMPLOYEE_DEPARTURE_HISTORY_REQUIRED' });
});

test('missing cycle reference fails closed before any selection', () => {
    // A resolver boundary returning a nonexistent id must never silently lose it.
    const filename = require.resolve('./employeeDepartureLifecycleTransitionService');
    const isolated = new Module(filename, module);
    isolated.filename = filename;
    isolated.paths = Module._nodeModulePaths(path.dirname(filename));
    const originalRequire = isolated.require.bind(isolated);
    isolated.require = id => id === './employeeEmploymentCycleResolverService'
        ? { buildEmploymentCycles: () => [{ is_current_cycle: true, hire_date: '2026-01-01',
            departure_date: null, history_ids: ['missing-row'] }] } : originalRequire(id);
    isolated._compile(fs.readFileSync(filename, 'utf8'), filename);
    assert.throws(() => run(fixture(), isolated.exports.buildEmployeeDepartureTransition),
        { code: 'EMPLOYEE_DEPARTURE_HISTORY_REQUIRED' });
});

test('real future explicit work terms reject even with false legacy flag and incomplete V1', () => {
    const value = fixture();
    Object.assign(value.history[2], { afora_allagh_oron_ergasias: false,
        employment_profile_schema_version: undefined, hmeromhnia_isxyos_oron_ergasias_apo: '2026-10-05' });
    assert.throws(() => run(value), { code: 'EMPLOYEE_DEPARTURE_CONFLICT' });
});
