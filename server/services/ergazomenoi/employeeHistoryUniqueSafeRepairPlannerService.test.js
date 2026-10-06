'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { canonicalizeEmployeeHistory } = require('./employeeHistoryCanonicalizationService');
const { REDUNDANT_STATUS_FIELD, REDUNDANT_SURVIVOR_FIELD, REDUNDANT_REFERENCED } =
    require('../../utils/ergazomenoi/employmentHistoryCanonicalStatus');
const { PLAN_STATUSES, PLAN_KINDS, planEmployeeHistoryUniqueSafeRepair } =
    require('./employeeHistoryUniqueSafeRepairPlannerService');
const { shapeALifecycleFixture, shapeBCorrectedProfileFixture } =
    require('./fixtures/uniqueSafeEmployeeHistoryRepairFixtures');

function plan(fixture) {
    return planEmployeeHistoryUniqueSafeRepair({ ...fixture });
}

test('Shape A is a generic unique lifecycle-flag repair with no deletion or current patch', () => {
    const fixture = shapeALifecycleFixture();
    const before = structuredClone(fixture);
    const result = plan(fixture);
    assert.equal(result.status, PLAN_STATUSES.APPLICABLE);
    assert.equal(result.planKind, PLAN_KINDS.LIFECYCLE_FLAG_RECLASSIFICATION);
    assert.deepEqual(result.currentPatch, {});
    assert.deepEqual(result.physicalDeleteIds, []);
    assert.deepEqual(result.insertedRows, []);
    assert.deepEqual(result.changedHistoryIds,
        ['shape-a-departure', 'shape-a-profile'].sort());
    assert.ok(result.changedHistoryIds.every(id =>
        result.historyPatches[id].afora_proslhpsh === false));
    assert.equal(result.hypotheticalCanonicalResult.status, 'CLEAN');
    assert.equal(result.secondCanonicalResult.status, 'CLEAN');
    assert.match(result.planFingerprint, /^[a-f0-9]{64}$/);
    assert.deepEqual(fixture, before);
});

test('Shape A repeated planning is a clean no-op and preserves every stable identity', () => {
    const fixture = shapeALifecycleFixture();
    const first = plan(fixture);
    const second = planEmployeeHistoryUniqueSafeRepair({ ...fixture,
        completeHistoryRows: first.desiredHistoryRows });
    assert.equal(second.status, PLAN_STATUSES.NOT_APPLICABLE);
    assert.equal(second.reason, 'ALREADY_CLEAN');
    assert.equal(second.noOp, true);
    assert.deepEqual(first.desiredHistoryRows.map(row => String(row._id)).sort(),
        fixture.completeHistoryRows.map(row => String(row._id)).sort());
});

test('Shape B retires the older referenced profile, preserves IDs and applies only corroborated facts', () => {
    const fixture = shapeBCorrectedProfileFixture();
    const before = structuredClone(fixture);
    const result = plan(fixture);
    assert.equal(result.status, PLAN_STATUSES.APPLICABLE);
    assert.equal(result.planKind, PLAN_KINDS.CORRECTED_SAME_DATE_REFERENCED_PROFILE);
    assert.deepEqual(result.physicalDeleteIds, []);
    assert.deepEqual(result.insertedRows, []);
    assert.equal(result.referenceClass, 'PROVENANCE_ONLY');
    const byId = new Map(result.desiredHistoryRows.map(row => [String(row._id), row]));
    assert.equal(byId.get('shape-b-older')[REDUNDANT_STATUS_FIELD], REDUNDANT_REFERENCED);
    assert.equal(byId.get('shape-b-older')[REDUNDANT_SURVIVOR_FIELD], 'shape-b-survivor');
    assert.equal(byId.get('shape-b-survivor').krathsh_01, '0109');
    assert.equal(byId.get('shape-b-survivor').krathsh_03, '0023');
    assert.equal(byId.get('shape-b-survivor').krathsh_05, '2694');
    assert.equal(new Date(byId.get('shape-b-survivor')
        .hmeromhnia_isxyos_oron_ergasias_eos).toISOString().slice(0, 10), '2026-06-01');
    assert.equal(new Date(result.currentPatch.hmeromhnia_isxyos_oron_ergasias_eos)
        .toISOString().slice(0, 10), '2026-06-01');
    assert.equal(result.hypotheticalCanonicalResult.status, 'CLEAN');
    assert.equal(result.secondCanonicalResult.status, 'CLEAN');
    assert.deepEqual(result.desiredHistoryRows.map(row => String(row._id)).sort(),
        fixture.completeHistoryRows.map(row => String(row._id)).sort());
    assert.deepEqual(fixture, before);
});

test('Shape B accepts later same-period terminal evidence without inventing a schema marker', () => {
    const fixture = shapeBCorrectedProfileFixture();
    const terminal = fixture.completeHistoryRows.find(row => row._id === 'shape-b-departure');
    assert.equal(Object.hasOwn(terminal, 'employment_profile_schema_version'), false);
    assert.equal(plan(fixture).status, PLAN_STATUSES.APPLICABLE);
});

test('Shape B repeated planning is clean and produces no further diff', () => {
    const fixture = shapeBCorrectedProfileFixture();
    const first = plan(fixture);
    const repairedCurrent = { ...fixture.currentEmployee, ...first.currentPatch };
    const canonical = canonicalizeEmployeeHistory({ scope: fixture.scope,
        currentEmployee: repairedCurrent, historyRows: first.desiredHistoryRows });
    assert.equal(canonical.status, 'CLEAN');
    assert.deepEqual(canonical.rowsToUpdate, []);
    assert.deepEqual(canonical.rowsToDelete, []);
    const second = planEmployeeHistoryUniqueSafeRepair({ ...fixture,
        currentEmployee: repairedCurrent, completeHistoryRows: first.desiredHistoryRows });
    assert.equal(second.status, PLAN_STATUSES.NOT_APPLICABLE);
    assert.equal(second.reason, 'ALREADY_CLEAN');
    assert.equal(second.noOp, true);
});

test('Shape A fails closed for a second hire anchor or more than one employment cycle', () => {
    const duplicateAnchor = shapeALifecycleFixture();
    duplicateAnchor.completeHistoryRows[1].hmeromhnia_allaghs_orarioy_apo = '2026-04-24';
    duplicateAnchor.completeHistoryRows[1].hmeromhnia_isxyos_oron_ergasias_apo = '2026-04-24';
    assert.equal(plan(duplicateAnchor).status, PLAN_STATUSES.BLOCKED);

    const multipleCycles = shapeALifecycleFixture();
    multipleCycles.completeHistoryRows.push({ ...multipleCycles.completeHistoryRows[0],
        _id: 'second-cycle', aa_eggrafhs: '0004',
        hmeromhnia_proslhpshs: '2026-10-01', hmeromhnia_allaghs_symbashs: '2026-10-01',
        hmeromhnia_allaghs_orarioy_apo: '2026-10-01' });
    multipleCycles.protectedReferenceSummary['second-cycle'] = [];
    assert.notEqual(plan(multipleCycles).status, PLAN_STATUSES.APPLICABLE);
});

test('Shape B is not offered when the current/terminal evidence does not uniquely choose one profile', () => {
    const fixture = shapeBCorrectedProfileFixture();
    fixture.currentEmployee.krathsh_01 = '0999';
    fixture.completeHistoryRows[2].krathsh_01 = '0999';
    const result = plan(fixture);
    assert.equal(result.status, PLAN_STATUSES.BLOCKED);
    assert.equal(result.reason, 'SURVIVOR_NOT_UNIQUELY_CORROBORATED');
});

test('Shape B is not offered when the selected profile is not the later correction', () => {
    const fixture = shapeBCorrectedProfileFixture();
    fixture.completeHistoryRows[0].krathsh_01 = '0109';
    fixture.completeHistoryRows[1].krathsh_01 = '0111';
    const result = plan(fixture);
    assert.equal(result.status, PLAN_STATUSES.BLOCKED);
    assert.equal(result.reason, 'CORROBORATED_PROFILE_NOT_LATER_CORRECTION');
});

test('provenance is allowed but missing, live or unknown reference state fails closed', () => {
    const missing = shapeBCorrectedProfileFixture();
    delete missing.protectedReferenceSummary['shape-b-older'];
    assert.equal(plan(missing).reason, 'REFERENCE_STATE_NOT_LOADED');

    const live = shapeBCorrectedProfileFixture();
    const liveResult = planEmployeeHistoryUniqueSafeRepair({ ...live,
        referencePartitioner: references => ({ frozenProvenance: [],
            liveDereference: references }) });
    assert.equal(liveResult.status, PLAN_STATUSES.BLOCKED);
    assert.equal(liveResult.reason, 'LIVE_REFERENCE_BLOCKS_REPAIR');

    const unknown = shapeBCorrectedProfileFixture();
    const unknownResult = planEmployeeHistoryUniqueSafeRepair({ ...unknown,
        referencePartitioner: () => { throw new Error('unknown'); } });
    assert.equal(unknownResult.status, PLAN_STATUSES.BLOCKED);
    assert.equal(unknownResult.reason, 'REFERENCE_SEMANTICS_UNKNOWN');
});

test('unrelated lifecycle, overlap and profile ambiguities remain outside PR E', () => {
    for (const reason of ['EMPLOYMENT_CYCLE_OVERLAP', 'OVERLAPPING_GENUINE_PERIODS',
        'EMPLOYMENT_CYCLE_OPEN_BEFORE_NEXT_HIRE', 'PROFILE_EVENT_AFTER_DEPARTURE']) {
        const fixture = shapeBCorrectedProfileFixture();
        const result = planEmployeeHistoryUniqueSafeRepair({ ...fixture,
            canonicalResult: { status: 'TRUE_AMBIGUITY', rowsToUpdate: [], rowsToDelete: [],
                rowsToInsert: [], diagnostics: { reason, historyIds: [] } } });
        assert.equal(result.status, PLAN_STATUSES.NOT_APPLICABLE, reason);
    }
});

test('same-date multiple-business-plan shape remains blocked rather than selecting by row order', () => {
    const fixture = shapeBCorrectedProfileFixture();
    fixture.currentEmployee.krathsh_01 = '0109';
    fixture.completeHistoryRows[2].krathsh_01 = '0111';
    const result = plan(fixture);
    assert.equal(result.status, PLAN_STATUSES.BLOCKED);
    assert.equal(result.reason, 'CURRENT_AND_TERMINAL_PROFILE_NOT_CORROBORATED');
});

test('a later departure from another effective period cannot corroborate same-date candidates', () => {
    const fixture = shapeBCorrectedProfileFixture();
    const terminal = fixture.completeHistoryRows.find(row => row._id === 'shape-b-departure');
    terminal.hmeromhnia_isxyos_oron_ergasias_apo = '2026-05-31';
    terminal.hmeromhnia_allaghs_orarioy_apo = '2026-05-31';
    const result = plan(fixture);
    assert.equal(result.status, PLAN_STATUSES.BLOCKED);
    assert.equal(result.reason, 'UNIQUE_TERMINAL_PROFILE_EVIDENCE_REQUIRED');
});
