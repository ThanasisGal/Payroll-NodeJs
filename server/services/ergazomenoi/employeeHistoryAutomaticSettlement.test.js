'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { planEmployeeHistoryAutomaticReconstruction: reconstruct,
    planEmployeeHistoryAutomaticSettlement: settle,
    verifyEmployeeHistoryAutomaticSettlement: verify } =
    require('./employeeHistoryAutomaticReconstructionPlannerService');
const { canonicalizeEmployeeHistory } = require('./employeeHistoryCanonicalizationService');
const { isInactiveHistoryRow } = require('../../utils/ergazomenoi/employmentHistoryCanonicalStatus');
const A = require('./employeeHistoryAutomaticReconstructionApplyContract');
const rawFixtures = require('./fixtures/automaticEmployeeHistoryReconstructionFixtures');
// Positive canonical/reference scenarios explicitly supply recorded numeric
// evidence. The unchanged sparse 0006 fixture is tested as pending separately.
function withRecordedNumbers(input) {
    for (const row of input.completeHistoryRows) {
        Object.assign(row, { evelikth_proselefsh: 0, symbatikes_ores_ergasias: 40 });
    }
    return input;
}
const F = { ...rawFixtures,
    caseA: () => withRecordedNumbers(rawFixtures.caseA()),
    coincidentLegacyArtifacts: () => withRecordedNumbers(rawFixtures.coincidentLegacyArtifacts()),
    real0006BoundaryStructure: () => withRecordedNumbers(rawFixtures.real0006BoundaryStructure()) };

function referencesFor(input, protectedIds = []) {
    return Object.fromEntries(input.completeHistoryRows.map(row => [String(row._id),
        protectedIds.includes(String(row._id)) ? [{
            collection: 'Apasxoliseis_Period_Frozen_Snapshots',
            documentId: `synthetic-snapshot-${row.aa_eggrafhs}`, historyId: String(row._id),
            frozen_snapshot: { finalized: true, daily_results: [{ amount: 123.45, hours: 8 }] }
        }] : []]));
}
function run(input, protectedIds = []) {
    return settle({ ...input, protectedReferenceSummary: referencesFor(input, protectedIds) });
}
function twoChanges() {
    const input = F.caseA();
    Object.assign(input.currentEmployee, F.workTerms, {
        hmeromhnia_isxyos_oron_ergasias_apo: '2026-05-25',
        hmeromhnia_isxyos_oron_ergasias_eos: '2026-10-05'
    });
    Object.assign(input.completeHistoryRows[0], {
        hmeres_ergasias_ebdomadas: 5, ores_ergasias_ebdomadas: 35, mo_oron_hmerhsias_ergasias: 7
    });
    return input;
}
function assertPending(plan) {
    assert.equal(plan.status, 'REVIEW_REQUIRED');
    assert.deepEqual(plan.proposedRows, []);
    assert.deepEqual(plan.proposedActiveRows, []);
    assert.deepEqual(plan.fieldChanges, []);
    assert.deepEqual(plan.redundantRows, []);
    assert.equal(plan.noOp, false);
}

test('synthetic 0006 with recorded numeric evidence: one CLEAN period; two protected originals retain identities and payloads', () => {
    const input = F.real0006BoundaryStructure();
    const protectedIds = input.completeHistoryRows.slice(0, 2).map(row => String(row._id));
    const references = referencesFor(input, protectedIds);
    const before = A.stringify({ input, references });
    const old = reconstruct(input);
    assert.equal(old.proposedRows.length, 3);
    assert.equal(old.rowDiffs.length, 19);
    assert.equal(canonicalizeEmployeeHistory({ scope: input.scope, currentEmployee: input.currentEmployee,
        historyRows: old.proposedRows }).status, 'AUTO_REPAIRABLE');
    const plan = settle({ ...input, protectedReferenceSummary: references });
    assert.equal(plan.status, 'CLEAN', JSON.stringify(plan));
    assert.equal(plan.mode, 'IN_MEMORY_ONLY');
    assert.equal(plan.proposedActiveRows.length, 1);
    assert.equal(plan.proposedRows.length, 3);
    assert.equal(plan.redundantRows.length, 2);
    assert.deepEqual(plan.diagnostics, { initialActiveCount: 3, proposedActiveCount: 1, retainedProtectedCount: 2 });
    const survivor = plan.proposedActiveRows[0];
    assert.equal(survivor.hmeromhnia_isxyos_oron_ergasias_apo.toISOString().slice(0, 10), '2026-04-23');
    assert.equal(survivor.hmeromhnia_isxyos_oron_ergasias_eos.toISOString().slice(0, 10), '2026-10-15');
    for (const [field, value] of Object.entries(F.workTerms)) assert.equal(survivor[field], value);
    for (const original of input.completeHistoryRows.slice(0, 2)) {
        const retained = plan.proposedRows.find(row => String(row._id) === String(original._id));
        const { employment_history_canonical_status, employment_history_canonical_survivor_id, ...payload } = retained;
        assert.deepEqual(payload, original);
        assert.equal(employment_history_canonical_status, 'REDUNDANT_REFERENCED');
        assert.equal(employment_history_canonical_survivor_id, String(survivor._id));
        assert.ok(retained._id instanceof mongoose.Types.ObjectId);
    }
    assert.ok(plan.redundantRows.every(row => row.disposition === 'PRESERVE_REFERENCED'));
    assert.equal(plan.verification.status, 'CLEAN');
    assert.equal(plan.verification.canonicalStatus, 'CLEAN');
    assert.equal(plan.verification.canonicalIdempotent, true);
    assert.deepEqual(plan.verification.coverageGaps, []);
    assert.equal(plan.verification.cycles.length, 1);
    assert.ok(plan.assumptions.some(item => item.code === 'EXISTING_INITIAL_START_AFTER_HIRE' && item.businessRationale));
    assert.equal(A.stringify({ input, references }), before, 'inputs, finalized results and references stay unchanged');
});

test('identical unreferenced duplicates collapse without business selection by technical ordering', () => {
    const input = F.coincidentLegacyArtifacts();
    input.completeHistoryRows = reconstruct(input).proposedRows;
    const first = run(input);
    assert.equal(first.status, 'CLEAN', first.reason);
    assert.equal(first.proposedActiveRows.length, 1);
    assert.equal(first.redundantRows.length, 2);
    assert.ok(first.redundantRows.every(row => row.disposition === 'EXCLUDE_FROM_ACTIVE_HISTORY'));
    const changedOrder = { ...input, completeHistoryRows: input.completeHistoryRows.toReversed().map((row, index) => ({
        ...row, _id: `synthetic-permuted-${index}`, aa_eggrafhs: String(999 - index),
        createdAt: new Date(`2020-01-0${index + 1}`)
    })) };
    const second = run(changedOrder);
    assert.equal(second.status, 'CLEAN');
    assert.equal(second.proposedActiveRows.length, 1);
    for (const field of Object.keys(F.workTerms)) {
        assert.equal(second.proposedActiveRows[0][field], first.proposedActiveRows[0][field]);
    }
});

test('two genuine work-term changes remain separate with their original 35/40-hour profiles', () => {
    const input = twoChanges(), before = A.stringify(input);
    const plan = run(input);
    assert.equal(plan.status, 'CLEAN', JSON.stringify(plan));
    assert.equal(plan.proposedActiveRows.length, 2);
    assert.deepEqual(plan.proposedActiveRows.map(row => row.ores_ergasias_ebdomadas), [35, 40]);
    assert.deepEqual(plan.redundantRows, []);
    assert.equal(plan.proposedActiveRows[0].hmeromhnia_isxyos_oron_ergasias_eos.toISOString().slice(0, 10), '2026-05-24');
    assert.equal(A.stringify(input), before);
    const second = run({ ...input, completeHistoryRows: plan.proposedRows });
    assert.equal(second.status, 'CLEAN');
    assert.equal(second.noOp, true);
    assert.deepEqual(second.fieldChanges, []);
});

for (const protectedCount of [0, 1, 2, 3]) {
    test(`second execution adds no proposed corrections with ${protectedCount} referenced rows`, () => {
        const input = F.real0006BoundaryStructure();
        const protectedIds = input.completeHistoryRows.slice(0, protectedCount).map(row => String(row._id));
        const first = run(input, protectedIds);
        assert.equal(first.status, 'CLEAN', first.reason);
        const second = run({ ...input, completeHistoryRows: first.proposedRows }, protectedIds);
        assert.equal(second.status, 'CLEAN', JSON.stringify(second));
        assert.equal(second.noOp, true);
        assert.deepEqual(second.fieldChanges, []);
        assert.deepEqual(second.redundantRows, []);
        assert.deepEqual(second.proposedRows, first.proposedRows);
    });
}

test('missing, unknown or mismatched reference evidence yields no candidate', () => {
    const input = F.real0006BoundaryStructure();
    const absent = settle(input);
    assertPending(absent);
    assert.equal(absent.reason, 'REFERENCE_STATE_NOT_LOADED');
    for (const reference of [
        { collection: 'Unknown_Reference_Consumer' },
        { collection: 'Apasxoliseis_Period_Frozen_Snapshots', historyId: 'different-history' },
        null
    ]) {
        const references = referencesFor(input);
        references[String(input.completeHistoryRows[0]._id)] = [reference];
        assertPending(settle({ ...input, protectedReferenceSummary: references }));
    }
});

test('same-date conflicting business values never use physical identity, sequence or foundation preference', () => {
    for (const reverse of [false, true]) {
        const input = F.coincidentLegacyArtifacts();
        Object.assign(input.completeHistoryRows[1], { pragmatikosMisthos: 1200,
            employment_profile_source: 'EMPLOYEE_PROFILE_FOUNDATION' });
        input.completeHistoryRows[2].pragmatikosMisthos = 1400;
        if (reverse) input.completeHistoryRows.reverse();
        const plan = run(input);
        assertPending(plan);
        assert.equal(plan.reason, 'RECONSTRUCTION_REQUIRES_BUSINESS_CONFIRMATION');
    }
});

test('canonical current synchronization cannot replace different historical terms', () => {
    const input = F.coincidentLegacyArtifacts();
    Object.assign(input.currentEmployee, { ores_ergasias_ebdomadas: 35, mo_oron_hmerhsias_ergasias: 7 });
    const plan = run(input);
    assertPending(plan);
    assert.equal(plan.reason, 'CANONICALIZATION_WOULD_REPLACE_RECONSTRUCTED_TERMS');
});

test('independent validation rejects gaps, overlapping periods, invalid cycles and dangling survivor identities', () => {
    const input = twoChanges(), clean = run(input);
    assert.equal(clean.status, 'CLEAN');
    const check = proposedRows => verify({ scope: input.scope, currentEmployee: input.currentEmployee, proposedRows });
    const gap = clean.proposedRows.map(row => ({ ...row }));
    gap[0].hmeromhnia_isxyos_oron_ergasias_apo = '2026-05-01';
    assert.notEqual(check(gap).status, 'CLEAN');
    assert.ok(check(gap).coverageGaps.length);
    const overlap = clean.proposedRows.map(row => ({ ...row }));
    overlap[0].hmeromhnia_isxyos_oron_ergasias_eos = '2026-06-01';
    assert.notEqual(check(overlap).status, 'CLEAN');
    const cycles = clean.proposedRows.map(row => ({ ...row }));
    cycles[0].hmeromhnia_proslhpshs = '2025-01-01';
    assert.notEqual(check(cycles).status, 'CLEAN');
    const dangling = [...clean.proposedRows, { ...clean.proposedRows[0], _id: 'synthetic-dangling',
        employment_history_canonical_status: 'REDUNDANT_REFERENCED',
        employment_history_canonical_survivor_id: 'synthetic-missing' }];
    assert.notEqual(check(dangling).status, 'CLEAN');
    const unknown = clean.proposedRows.map(row => ({ ...row, employment_history_canonical_status: 'UNKNOWN' }));
    assert.notEqual(check(unknown).status, 'CLEAN');
    const invalidDate = clean.proposedRows.map(row => ({ ...row, hmeromhnia_allaghs_symbashs: 'invalid-date' }));
    assert.notEqual(check(invalidDate).status, 'CLEAN');
    assert.notEqual(check([]).status, 'CLEAN');
});

test('incomplete work terms, invalid input and withdrawn evidence remain pending with no proposed rows', () => {
    const incomplete = F.caseA();
    for (const row of incomplete.completeHistoryRows) for (const field of Object.keys(F.workTerms)) delete row[field];
    assertPending(run(incomplete));
    const invalid = F.real0006BoundaryStructure();
    invalid.completeHistoryRows[1]._id = invalid.completeHistoryRows[0]._id;
    assertPending(run(invalid));
    const withdrawn = F.real0006BoundaryStructure();
    withdrawn.completeHistoryRows[0].employment_history_canonical_status = 'WITHDRAWN_ERRONEOUS';
    assertPending(run(withdrawn));
});

test('settlement cannot enter the existing physical apply boundary and performs no connection or model write', t => {
    const forbidden = () => { assert.fail('Database connection/write path must never run'); };
    t.mock.method(mongoose, 'connect', forbidden);
    t.mock.method(mongoose, 'createConnection', forbidden);
    t.mock.method(mongoose.Model.prototype, 'save', forbidden);
    t.mock.method(mongoose.connection, 'startSession', forbidden);
    for (const method of ['find', 'findOne', 'findById', 'aggregate',
        'updateOne', 'updateMany', 'deleteOne', 'deleteMany', 'insertMany', 'bulkWrite']) {
        t.mock.method(mongoose.Model, method, forbidden);
    }
    const input = F.real0006BoundaryStructure();
    const plan = run(input, input.completeHistoryRows.map(row => String(row._id)));
    assert.equal(plan.status, 'CLEAN');
    assert.throws(() => A.buildAutomaticReconstructionPhysicalPlan({ plan,
        completeHistoryRows: input.completeHistoryRows }), { code: A.PREFIX + 'BOUNDARY_FAILED' });
    assert.equal(mongoose.connection.readyState, 0);
});
