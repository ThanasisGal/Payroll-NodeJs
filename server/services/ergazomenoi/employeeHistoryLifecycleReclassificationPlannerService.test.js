'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { canonicalizeEmployeeHistory } = require('./employeeHistoryCanonicalizationService');
const {
    AMBIGUITY_REASON,
    PLAN_STATUSES,
    eventMap,
    planEmployeeHistoryLifecycleReclassification
} = require('./employeeHistoryLifecycleReclassificationPlannerService');

const scope = { team: 'TEST', company_kod: 'company', kodikos: '0014' };
const ids = Object.freeze({
    hire: 'synthetic-hire', profile1: 'synthetic-profile-1', technical1: 'synthetic-technical-1',
    technical2: 'synthetic-technical-2', profile2: 'synthetic-profile-2',
    departure: 'synthetic-departure'
});
const expectedEvents = Object.freeze({
    [ids.departure]: 'DEPARTURE',
    [ids.hire]: 'HIRE',
    [ids.profile1]: 'PROFILE_CHANGE',
    [ids.profile2]: 'PROFILE_CHANGE',
    [ids.technical1]: 'LEGACY_TECHNICAL',
    [ids.technical2]: 'LEGACY_TECHNICAL'
});

function row(_id, aa, hire, extra = {}) {
    return { _id, ...scope, aa_eggrafhs: aa, hmeromhnia_proslhpshs: hire,
        hmeromhnia_allaghs_symbashs: hire,
        hmeromhnia_isxyos_oron_ergasias_apo: null,
        hmeromhnia_isxyos_oron_ergasias_eos: null,
        afora_proslhpsh: true, afora_allagh_oron_ergasias: false, ...extra };
}

function singleCycleFixture() {
    const hire = '2026-04-25'; const departure = '2026-09-20';
    return {
        currentEmployee: { _id: 'synthetic-employee', ...scope,
            hmeromhnia_proslhpshs: hire, hmeromhnia_apoxorhshs: departure },
        completeHistoryRows: [
            row(ids.hire, '0001', hire, { hmeromhnia_allaghs_orarioy_apo: hire,
                hmeromhnia_allaghs_orarioy_eos: '2026-05-01' }),
            row(ids.profile1, '0002', hire, {
                hmeromhnia_allaghs_orarioy_apo: '2026-05-25',
                hmeromhnia_isxyos_oron_ergasias_apo: '2026-05-25',
                hmeromhnia_isxyos_oron_ergasias_eos: '2026-06-14',
                afora_allagh_oron_ergasias: true }),
            row(ids.technical1, '0003', hire, {
                hmeromhnia_allaghs_orarioy_apo: '2026-06-02' }),
            row(ids.technical2, '0004', hire, {
                hmeromhnia_allaghs_orarioy_apo: '2026-06-14' }),
            row(ids.profile2, '0005', hire, {
                hmeromhnia_allaghs_orarioy_apo: '2026-06-16',
                hmeromhnia_isxyos_oron_ergasias_apo: '2026-06-15',
                hmeromhnia_isxyos_oron_ergasias_eos: departure,
                afora_allagh_oron_ergasias: true }),
            row(ids.departure, '0006', hire, {
                hmeromhnia_allaghs_orarioy_apo: '2026-07-06',
                hmeromhnia_apoxorhshs: departure })
        ]
    };
}

function frozenReferences(rows) {
    return Object.fromEntries(rows.map(item => [String(item._id), [{
        collection: 'Apasxoliseis_Period_Frozen_Snapshots',
        documentId: `frozen-${item._id}`
    }]]));
}

function plan(input = singleCycleFixture(), options = {}) {
    return planEmployeeHistoryLifecycleReclassification({ scope,
        ...input, protectedReferenceSummary: frozenReferences(input.completeHistoryRows),
        ...options });
}

test('generic THA/0014-shaped fixture proves one anchor and five true-to-false patches', () => {
    const result = plan();
    assert.equal(result.canonicalBefore.status, 'TRUE_AMBIGUITY');
    assert.equal(result.canonicalBefore.diagnostics.reason, AMBIGUITY_REASON);
    assert.equal(result.status, PLAN_STATUSES.APPLYABLE);
    assert.deepEqual(result.changedHistoryIds,
        [ids.departure, ids.profile1, ids.profile2, ids.technical1, ids.technical2].sort());
    assert.ok(Object.values(result.historyPatches)
        .every(patch => Object.keys(patch).length === 1 && patch.afora_proslhpsh === false));
    assert.deepEqual(result.currentPatch, {});
    assert.deepEqual(result.physicalDeleteIds, []);
    assert.deepEqual(result.insertedRows, []);
});

test('sanitized fixture produces exact lifecycle events and strict persisted flags', () => {
    const result = plan();
    assert.deepEqual(eventMap(result.canonicalResult), expectedEvents);
    const byId = new Map(result.desiredHistoryRows.map(item => [String(item._id), item]));
    assert.equal(byId.get(ids.hire).afora_proslhpsh, true);
    for (const [id, item] of byId) if (id !== ids.hire) {
        assert.equal(item.afora_proslhpsh, false, id);
    }
    assert.equal(result.canonicalResult.status, 'CLEAN');
    assert.equal(result.canonicalResult.cleanupRequired, false);
    assert.equal(result.diagnostics.secondPassIdempotent, true);
});

test('generic two-cycle rehire fixture preserves one hire anchor per cycle', () => {
    const hireA = '2025-01-01'; const departureA = '2025-06-30'; const hireB = '2025-07-15';
    const input = {
        currentEmployee: { _id: 'employee-rehire', ...scope,
            hmeromhnia_proslhpshs: hireB, hmeromhnia_apoxorhshs: null },
        completeHistoryRows: [
            row('cycle-a-hire', '0001', hireA, { hmeromhnia_allaghs_orarioy_apo: hireA }),
            row('cycle-a-profile', '0002', hireA, { hmeromhnia_allaghs_orarioy_apo: '2025-02-01',
                hmeromhnia_isxyos_oron_ergasias_apo: '2025-02-01',
                hmeromhnia_isxyos_oron_ergasias_eos: departureA,
                afora_allagh_oron_ergasias: true }),
            row('cycle-a-departure', '0003', hireA, {
                hmeromhnia_allaghs_orarioy_apo: '2025-06-30',
                hmeromhnia_apoxorhshs: departureA }),
            row('cycle-b-hire', '0004', hireB, { hmeromhnia_allaghs_orarioy_apo: hireB }),
            row('cycle-b-profile', '0005', hireB, { hmeromhnia_allaghs_orarioy_apo: '2025-08-01',
                hmeromhnia_isxyos_oron_ergasias_apo: '2025-08-01',
                afora_allagh_oron_ergasias: true })
        ]
    };
    const result = plan(input);
    assert.equal(result.status, PLAN_STATUSES.APPLYABLE);
    const byId = new Map(result.desiredHistoryRows.map(item => [String(item._id), item]));
    assert.equal(byId.get('cycle-a-hire').afora_proslhpsh, true);
    assert.equal(byId.get('cycle-b-hire').afora_proslhpsh, true);
    for (const id of ['cycle-a-profile', 'cycle-a-departure', 'cycle-b-profile']) {
        assert.equal(byId.get(id).afora_proslhpsh, false);
    }
    assert.equal(result.diagnostics.cycleSummariesAfter.length, 2);
    assert.equal(result.canonicalResult.status, 'CLEAN');
    assert.equal(result.diagnostics.secondPassIdempotent, true);
});

test('two independent hire boundaries in one cycle block', () => {
    const input = singleCycleFixture();
    input.completeHistoryRows.find(item => item._id === ids.technical1)
        .hmeromhnia_allaghs_orarioy_apo = '2026-04-25';
    const result = plan(input);
    assert.equal(result.status, PLAN_STATUSES.BLOCKED_MULTIPLE_HIRE_ANCHORS);
});

test('absence of an independently supported hire boundary blocks', () => {
    const input = singleCycleFixture();
    input.completeHistoryRows.find(item => item._id === ids.hire)
        .hmeromhnia_allaghs_orarioy_apo = '2026-04-26';
    const result = plan(input);
    assert.equal(result.status, PLAN_STATUSES.BLOCKED_NO_UNIQUE_HIRE_ANCHOR);
});

test('different genuinely invalid hire cycles and competing departures block', () => {
    const invalidHire = singleCycleFixture();
    invalidHire.completeHistoryRows.find(item => item._id === ids.technical2)
        .hmeromhnia_proslhpshs = '2026-10-01';
    assert.notEqual(plan(invalidHire).status, PLAN_STATUSES.APPLYABLE);

    const competingDeparture = singleCycleFixture();
    competingDeparture.completeHistoryRows.find(item => item._id === ids.technical2)
        .hmeromhnia_apoxorhshs = '2026-09-19';
    assert.notEqual(plan(competingDeparture).status, PLAN_STATUSES.APPLYABLE);
});

test('a canonical reason outside lifecycle ambiguity is never repaired', () => {
    const input = singleCycleFixture();
    const canonicalizer = () => ({ status: 'TRUE_AMBIGUITY', cleanupRequired: false,
        idempotent: false, rowsToUpdate: [], rowsToDelete: [], rowsToInsert: [],
        employeePatch: {}, diagnostics: { reason: 'CONFLICTING_PROFILE_EVENTS' } });
    const result = plan(input, { canonicalizer });
    assert.equal(result.status, PLAN_STATUSES.BLOCKED_NOT_LIFECYCLE_AMBIGUITY);
});

test('live references block while frozen references remain untouched', () => {
    const result = plan(singleCycleFixture(), { referencePartitioner: references => ({
        frozenProvenance: [], liveDereference: references
    }) });
    assert.equal(result.status, PLAN_STATUSES.BLOCKED_UNSAFE_REFERENCE);
    assert.equal(result.reason, 'LIVE_DEREFERENCE_BLOCKS_RECLASSIFICATION');
});

test('missing freshly loaded reference state blocks even for an unreferenced row', () => {
    const input = singleCycleFixture();
    const summaries = frozenReferences(input.completeHistoryRows);
    delete summaries[ids.profile1];
    const result = planEmployeeHistoryLifecycleReclassification({ scope, ...input,
        protectedReferenceSummary: summaries });
    assert.equal(result.status, PLAN_STATUSES.BLOCKED_UNSAFE_REFERENCE);
    assert.equal(result.reason, 'REFERENCE_STATE_NOT_LOADED');
});

test('additional canonical date/profile/delete/insert work is rejected', () => {
    const input = singleCycleFixture();
    let calls = 0;
    const canonicalizer = args => {
        calls++;
        if (calls === 1) return { status: 'TRUE_AMBIGUITY', cleanupRequired: false,
            idempotent: false, rowsToUpdate: [], rowsToDelete: [], rowsToInsert: [],
            employeePatch: {}, diagnostics: { reason: AMBIGUITY_REASON } };
        const clean = canonicalizeEmployeeHistory(args);
        return { ...clean, status: 'AUTO_REPAIRABLE', cleanupRequired: true,
            rowsToUpdate: [{ historyId: ids.profile1,
                patch: { hmeromhnia_isxyos_oron_ergasias_eos: '2026-06-13' } }] };
    };
    const result = plan(input, { canonicalizer });
    assert.equal(result.status, PLAN_STATUSES.BLOCKED_UNEXPECTED_MUTATION);
});

test('remaining ambiguity and non-idempotent second pass block', () => {
    const input = singleCycleFixture();
    let calls = 0;
    const stillAmbiguous = args => ++calls === 1
        ? canonicalizeEmployeeHistory(args)
        : { ...canonicalizeEmployeeHistory(args), status: 'TRUE_AMBIGUITY', idempotent: false,
            diagnostics: { reason: 'CONFLICTING_PROFILE_EVENTS' } };
    assert.equal(plan(input, { canonicalizer: stillAmbiguous }).status,
        PLAN_STATUSES.BLOCKED_REMAINING_AMBIGUITY);

    calls = 0;
    const nonIdempotent = args => {
        calls++;
        const result = canonicalizeEmployeeHistory(args);
        return calls === 3 ? { ...result, idempotent: false } : result;
    };
    assert.equal(plan(input, { canonicalizer: nonIdempotent }).status,
        PLAN_STATUSES.BLOCKED_REMAINING_AMBIGUITY);
});

test('strictly classified clean history returns NO_OP', () => {
    const input = singleCycleFixture();
    input.completeHistoryRows.forEach(item => {
        item.afora_proslhpsh = item._id === ids.hire;
    });
    const result = plan(input);
    assert.equal(result.status, PLAN_STATUSES.NO_OP);
    assert.deepEqual(result.changedHistoryIds, []);
    assert.equal(result.canonicalResult.status, 'CLEAN');
});

test('repeated planning is deterministic and never mutates source rows or stable identities', () => {
    const input = singleCycleFixture();
    const before = structuredClone(input);
    const first = plan(input);
    const second = plan(input);
    assert.equal(first.status, PLAN_STATUSES.APPLYABLE);
    assert.deepEqual(second, first);
    assert.deepEqual(input, before);
    assert.deepEqual(first.desiredHistoryRows.map(item => String(item._id)).sort(),
        before.completeHistoryRows.map(item => String(item._id)).sort());
    assert.equal(first.desiredHistoryRows.find(item => item._id === ids.hire).afora_proslhpsh,
        true);
    assert.ok(Object.values(first.historyPatches).every(patch =>
        Object.keys(patch).length === 1 && patch.afora_proslhpsh === false));
});

module.exports = { scope, ids, singleCycleFixture, frozenReferences };
