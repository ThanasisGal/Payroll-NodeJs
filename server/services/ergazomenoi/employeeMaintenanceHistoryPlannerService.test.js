'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { STATES } = require('./employeeEmploymentProfileMutationResolverService');
const { buildEmployeeMaintenanceIdentity, planEmployeeMaintenanceHistory } =
    require('./employeeMaintenanceHistoryPlannerService');
const { REAL_0002_IDS, buildReal0002SanitizedHistoryFixture } =
    require('./fixtures/real0002SanitizedHistoryFixture');

test('real Save and readiness import and call the same pure maintenance planner', () => {
    const writer = fs.readFileSync(path.join(__dirname,
        'employeeEmploymentProfileWriter.js'), 'utf8');
    const readiness = fs.readFileSync(path.join(__dirname,
        'employeeHistoryPopulationReadinessService.js'), 'utf8');
    const controller = fs.readFileSync(path.join(__dirname, '..', '..', 'controllers',
        'ergazomenoi', 'ergazomenoiController.js'), 'utf8');
    assert.match(writer, /planEmployeeMaintenanceHistory\(mutationRequest\)/);
    assert.match(readiness, /planEmployeeMaintenanceHistory\(\{ scope, currentEmployee,/);
    assert.match(controller, /buildEmployeeMaintenanceIdentity\(formData\)/);
    assert.doesNotMatch(controller, /function getIstorikoDateIdentity/);
});

test('readiness default input is identical to an unchanged real Employee Maintenance Save', () => {
    const fixture = buildReal0002SanitizedHistoryFixture();
    const submittedState = {
        effectiveFrom: fixture.currentEmployee.hmeromhnia_isxyos_oron_ergasias_apo,
        identity: buildEmployeeMaintenanceIdentity(fixture.currentEmployee),
        employeePatch: {},
        historyPatch: {}
    };
    const realSavePlan = planEmployeeMaintenanceHistory({ scope: fixture.scope,
        currentEmployee: fixture.currentEmployee, historyRows: fixture.history,
        submittedState });
    const readinessPlan = planEmployeeMaintenanceHistory({ scope: fixture.scope,
        currentEmployee: fixture.currentEmployee, historyRows: fixture.history,
        submittedState: { employeePatch: {}, historyPatch: {} } });
    assert.deepEqual(readinessPlan, realSavePlan);
    assert.equal(readinessPlan.state, STATES.NO_HISTORY_CHANGE);
    assert.equal(readinessPlan.targetHistoryId, REAL_0002_IDS.CURRENT_PROFILE);
    assert.deepEqual(readinessPlan.rowsToUpdate, [{
        historyId: REAL_0002_IDS.OLD_PROFILE,
        patch: { hmeromhnia_isxyos_oron_ergasias_eos: new Date('2026-07-31T00:00:00.000Z') }
    }]);
});

test('complete current identity resolves copied-profile departure events deterministically', () => {
    for (let index = 0; index < 4; index += 1) {
        const scope = { team: 'SAMPLE', company_kod: `company-${index}`,
            kodikos: String(index + 1).padStart(4, '0') };
        const hire = `202${index}-01-01`;
        const departure = `202${index}-07-31`;
        const common = { ...scope, hmeromhnia_proslhpshs: hire,
            hmeromhnia_allaghs_symbashs: hire,
            hmeromhnia_allaghs_orarioy_apo: hire,
            hmeromhnia_allaghs_orarioy_eos: null,
            hmeromhnia_isxyos_oron_ergasias_apo: hire,
            hmeromhnia_isxyos_oron_ergasias_eos: departure,
            hmeromhnia_lhxhs_symbashs: departure,
            afora_allagh_oron_ergasias: true,
            hmeres_ergasias_ebdomadas: 5,
            ores_ergasias_ebdomadas: 40,
            mo_oron_hmerhsias_ergasias: 8 };
        const profile = { _id: `profile-${index}`, ...common,
            aa_eggrafhs: '0001', hmeromhnia_apoxorhshs: null };
        const departureEvent = { _id: `departure-${index}`, ...common,
            aa_eggrafhs: '0002', hmeromhnia_apoxorhshs: departure };
        const currentEmployee = { ...departureEvent, _id: `employee-${index}` };
        const plan = planEmployeeMaintenanceHistory({ scope, currentEmployee,
            historyRows: [profile, departureEvent],
            submittedState: { employeePatch: {}, historyPatch: {} } });
        assert.notEqual(plan.state, STATES.CONFLICT, `${scope.company_kod}/${scope.kodikos}`);
        assert.equal(plan.targetHistoryId, departureEvent._id);
    }
});
