'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { buildCompleteProfileSnapshot } =
    require('../../utils/ergazomenoi/employmentProfileHistory');
const { PLAN_STATUSES, CONTRACT_END_FIELD, planEmployeeContractEndCorrection } =
    require('./employeeContractEndCorrectionPlannerService');

const scope = { team: 'CONTRACT', company_kod: 'company', kodikos: '0001' };
const ids = { first: 'contract-first', latest: 'contract-latest', oldCycle: 'old-cycle' };
const facts = {
    kathestos_apasxolhshs: '0',
    typos_apasxolhshs: '0',
    typos_ebdomadas: '5HMERH',
    hmeres_ergasias_ebdomadas: 5,
    ores_ergasias_ebdomadas: 40,
    mo_oron_hmerhsias_ergasias: 8
};

function profileRow({ id, sequence, from, until = null, hire = '2026-01-01',
    segmentStart = '2026-01-01', contractEnd = '2026-12-31', hireEvent = false }) {
    return {
        ...buildCompleteProfileSnapshot({ input: facts, current: facts, effectiveFrom: from }),
        _id: id,
        ...scope,
        aa_eggrafhs: sequence,
        hmeromhnia_proslhpshs: hire,
        hmeromhnia_allaghs_symbashs: segmentStart,
        hmeromhnia_lhxhs_symbashs: contractEnd,
        hmeromhnia_allaghs_orarioy_apo: from,
        hmeromhnia_allaghs_orarioy_eos: from,
        hmeromhnia_isxyos_oron_ergasias_apo: from,
        hmeromhnia_isxyos_oron_ergasias_eos: until,
        afora_proslhpsh: hireEvent,
        afora_allagh_oron_ergasias: true,
        createdAt: `2026-01-0${sequence}T00:00:00.000Z`,
        updatedAt: `2026-01-0${sequence}T00:00:00.000Z`
    };
}

function contractSegmentFixture(overrides = {}) {
    const first = profileRow({ id: ids.first, sequence: '1', from: '2026-01-01',
        until: '2026-05-31', hireEvent: true });
    const latest = profileRow({ id: ids.latest, sequence: '2', from: '2026-06-01' });
    const currentEmployee = { ...latest, _id: 'employee', aa_eggrafhs: undefined,
        afora_proslhpsh: undefined, afora_allagh_oron_ergasias: undefined,
        energos: true, archived: false };
    const completeHistoryRows = [first, latest];
    const protectedReferences = Object.fromEntries(completeHistoryRows.map(row =>
        [String(row._id), []]));
    return {
        scope: { ...scope }, currentEmployee, completeHistoryRows, protectedReferences,
        ...overrides
    };
}

function plan(input, requestedContractEnd = '2027-01-31', extra = {}) {
    return planEmployeeContractEndCorrection({ ...input, requestedContractEnd, ...extra });
}

test('contract end synchronizes the existing segment with stable ids and no input mutation', () => {
    const input = contractSegmentFixture();
    const before = structuredClone(input);
    const result = plan(input);
    assert.equal(result.status, PLAN_STATUSES.APPLYABLE);
    assert.deepEqual(result.changedHistoryIds, [ids.first, ids.latest]);
    assert.deepEqual(result.desiredHistoryRows.map(row => String(row._id)),
        input.completeHistoryRows.map(row => String(row._id)));
    assert.ok(result.desiredHistoryRows.every(row =>
        row[CONTRACT_END_FIELD] === '2027-01-31'));
    assert.deepEqual(input, before);
    assert.deepEqual(plan(input), result);
});

test('partially synchronized segment patches only stale rows', () => {
    const input = contractSegmentFixture();
    input.currentEmployee[CONTRACT_END_FIELD] = '2027-01-31';
    input.completeHistoryRows[1][CONTRACT_END_FIELD] = '2027-01-31';
    const result = plan(input);
    assert.equal(result.status, PLAN_STATUSES.APPLYABLE_PARTIAL_SEGMENT_SYNC);
    assert.deepEqual(result.currentPatch, {});
    assert.deepEqual(result.changedHistoryIds, [ids.first]);
    assert.deepEqual(result.unchangedHistoryIds, [ids.latest]);
});

test('repeated synchronized correction is a write-free NO_OP', () => {
    const input = contractSegmentFixture();
    input.currentEmployee[CONTRACT_END_FIELD] = '2027-01-31';
    input.completeHistoryRows.forEach(row => { row[CONTRACT_END_FIELD] = '2027-01-31'; });
    const result = plan(input);
    assert.equal(result.status, PLAN_STATUSES.NO_OP);
    assert.deepEqual(result.currentPatch, {});
    assert.deepEqual(result.historyPatches, {});
});

test('only rows in the current contract segment are synchronized', () => {
    const input = contractSegmentFixture();
    input.completeHistoryRows[0].hmeromhnia_allaghs_symbashs = '2025-10-01';
    input.completeHistoryRows[0][CONTRACT_END_FIELD] = '2025-12-31';
    input.protectedReferences = { [ids.latest]: [] };
    const result = plan(input);
    assert.equal(result.status, PLAN_STATUSES.APPLYABLE);
    assert.deepEqual(result.changedHistoryIds, [ids.latest]);
    assert.equal(result.desiredHistoryRows[0][CONTRACT_END_FIELD], '2025-12-31');
});

test('a sparse hire anchor is preserved when recorded segment profiles exist', () => {
    const input = contractSegmentFixture();
    input.completeHistoryRows[0] = {
        _id: ids.first, ...scope, aa_eggrafhs: '1',
        hmeromhnia_proslhpshs: '2026-01-01',
        hmeromhnia_allaghs_symbashs: '2026-01-01',
        hmeromhnia_allaghs_orarioy_apo: '2026-01-01',
        hmeromhnia_lhxhs_symbashs: null,
        afora_proslhpsh: true, afora_allagh_oron_ergasias: false
    };
    const result = plan(input);
    assert.equal(result.status, PLAN_STATUSES.APPLYABLE);
    assert.deepEqual(result.changedHistoryIds, [ids.latest]);
    assert.equal(result.desiredHistoryRows[0][CONTRACT_END_FIELD], null);
    assert.deepEqual(result.targetSegmentHistoryIds, [ids.latest]);
});

test('an unrelated employment cycle is never modified', () => {
    const input = contractSegmentFixture();
    const oldCycle = profileRow({ id: ids.oldCycle, sequence: '0',
        from: '2025-01-01', until: '2025-06-30', hire: '2025-01-01',
        segmentStart: '2025-01-01', contractEnd: '2025-06-30', hireEvent: true });
    oldCycle.hmeromhnia_apoxorhshs = '2025-06-30';
    input.completeHistoryRows.unshift(oldCycle);
    input.protectedReferences[ids.oldCycle] = [];
    const result = plan(input);
    assert.equal(result.status, PLAN_STATUSES.APPLYABLE);
    assert.ok(!result.targetSegmentHistoryIds.includes(ids.oldCycle));
    assert.equal(result.desiredHistoryRows[0][CONTRACT_END_FIELD], '2025-06-30');
});

test('missing or conflicting segment evidence fails closed', () => {
    const missing = contractSegmentFixture();
    delete missing.completeHistoryRows[0].hmeromhnia_allaghs_symbashs;
    assert.equal(plan(missing).status, PLAN_STATUSES.BLOCKED_SEGMENT_AMBIGUITY);

    const conflicting = contractSegmentFixture();
    conflicting.completeHistoryRows[0][CONTRACT_END_FIELD] = '2026-11-30';
    conflicting.completeHistoryRows[1][CONTRACT_END_FIELD] = '2026-10-31';
    assert.equal(plan(conflicting).status, PLAN_STATUSES.BLOCKED_INCONSISTENT_SEGMENT);
});

test('reference evidence is required and live dereferences block the whole plan', () => {
    const missing = contractSegmentFixture();
    delete missing.protectedReferences[ids.first];
    assert.equal(plan(missing).status, PLAN_STATUSES.BLOCKED_REFERENCE);

    const live = contractSegmentFixture();
    live.protectedReferences[ids.first] = [{ collection: 'future-live' }];
    const result = plan(live, '2027-01-31', { referencePartitioner: references => ({
        frozenProvenance: [], liveDereference: references
    }) });
    assert.equal(result.status, PLAN_STATUSES.BLOCKED_REFERENCE);
});

test('frozen provenance references are preserved as safe evidence', () => {
    const input = contractSegmentFixture();
    for (const row of input.completeHistoryRows) input.protectedReferences[String(row._id)] = [{
        collection: 'Apasxoliseis_Period_Frozen_Snapshots', documentId: `frozen-${row._id}`
    }];
    const result = plan(input);
    assert.equal(result.status, PLAN_STATUSES.APPLYABLE);
    assert.ok(Object.values(result.diagnostics.protectedReferenceSummary)
        .every(summary => summary.frozenProvenance === 1 && summary.liveDereference === 0));
});

test('invalid contract end and foreign scope fail closed', () => {
    assert.equal(plan(contractSegmentFixture(), '2025-12-31').status,
        PLAN_STATUSES.BLOCKED_INVALID_DATE);
    const foreign = contractSegmentFixture();
    foreign.completeHistoryRows[0].team = 'FOREIGN';
    assert.equal(plan(foreign).status, PLAN_STATUSES.BLOCKED_SCOPE);
});

for (const [relation, requested] of [
    ['before', '2026-08-31'], ['equal to', '2026-09-23'], ['after', '2026-11-30']
]) {
    test(`valid contract end ${relation} actual departure preserves departure evidence`, () => {
        const input = contractSegmentFixture();
        const departure = '2026-09-23';
        input.currentEmployee.hmeromhnia_apoxorhshs = departure;
        input.currentEmployee.hmeromhnia_isxyos_oron_ergasias_eos = departure;
        input.currentEmployee.energos = false;
        const latest = input.completeHistoryRows[1];
        latest.hmeromhnia_apoxorhshs = departure;
        latest.hmeromhnia_isxyos_oron_ergasias_eos = departure;
        const before = structuredClone(input);
        const result = plan(input, requested);
        assert.equal(result.status, PLAN_STATUSES.APPLYABLE);
        assert.equal(result.currentPatch[CONTRACT_END_FIELD], requested);
        assert.deepEqual(result.desiredHistoryRows, before.completeHistoryRows.map(row =>
            ({ ...row, [CONTRACT_END_FIELD]: requested })));
        assert.deepEqual(input, before);
    });
}

test('partial synchronization repairs only the stale current-segment row across two segments', () => {
    const input = contractSegmentFixture();
    const old = input.completeHistoryRows[0];
    old[CONTRACT_END_FIELD] = '2026-05-31';
    input.currentEmployee.hmeromhnia_allaghs_symbashs = '2026-06-01';
    input.currentEmployee[CONTRACT_END_FIELD] = '2027-01-31';
    input.completeHistoryRows[1].hmeromhnia_allaghs_symbashs = '2026-06-01';
    const synchronized = { ...input.completeHistoryRows[1], _id: 'synchronized-profile',
        aa_eggrafhs: '3', hmeromhnia_allaghs_orarioy_apo: '2026-08-01',
        hmeromhnia_allaghs_orarioy_eos: '2026-08-01',
        hmeromhnia_isxyos_oron_ergasias_apo: '2026-08-01',
        [CONTRACT_END_FIELD]: '2027-01-31' };
    input.completeHistoryRows[1].hmeromhnia_isxyos_oron_ergasias_eos = '2026-07-31';
    input.completeHistoryRows.push(synchronized);
    Object.assign(input.currentEmployee, synchronized, { _id: 'employee' });
    input.protectedReferences[synchronized._id] = [];
    const before = structuredClone(input);
    const result = plan(input);
    assert.equal(result.status, PLAN_STATUSES.APPLYABLE_PARTIAL_SEGMENT_SYNC);
    assert.deepEqual(result.currentPatch, {});
    assert.deepEqual(result.changedHistoryIds, [ids.latest]);
    assert.deepEqual(result.desiredHistoryRows, before.completeHistoryRows.map(row =>
        row._id === ids.latest ? { ...row, [CONTRACT_END_FIELD]: '2027-01-31' } : row));
    assert.deepEqual(input, before);
});
