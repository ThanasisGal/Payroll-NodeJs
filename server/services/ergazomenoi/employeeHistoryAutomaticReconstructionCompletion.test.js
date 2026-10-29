'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { planEmployeeHistoryAutomaticReconstruction: planner } = require('./employeeHistoryAutomaticReconstructionPlannerService');
const { canonicalizeEmployeeHistory } = require('./employeeHistoryCanonicalizationService');
const { employeeHistoryCoverageGaps } = require('../../utils/ergazomenoi/employmentHistoryCoverage');
const { buildEmployeeHistoryReconstructionPreview: preview } = require('./employeeHistoryReconstructionPreviewService');
const A = require('./employeeHistoryAutomaticReconstructionApplyContract');
const F = require('./fixtures/automaticEmployeeHistoryReconstructionFixtures');

test('reconstruction fixed point with active duplicates requires review without changing input or proposing cleanup', () => {
    const input = F.caseA();
    input.currentEmployee.hmeromhnia_isxyos_oron_ergasias_eos = '2026-10-05';
    input.completeHistoryRows = planner(input).proposedRows;
    input.completeHistoryRows.push({ ...input.completeHistoryRows[0], _id: 'synthetic-duplicate' });
    const before = structuredClone(input), first = planner(input), second = planner(input);
    assert.equal(mongoose.connection.readyState, 0);
    assert.equal(A.isNoOp(first), true);
    assert.equal(canonicalizeEmployeeHistory({ scope: input.scope, currentEmployee: input.currentEmployee,
        historyRows: input.completeHistoryRows }).status, 'AUTO_REPAIRABLE');
    assert.equal(A.historyCompletionStatus({ ...input, plan: first }), 'REVIEW_REQUIRED');
    assert.deepEqual(second, first);
    assert.deepEqual(first.rowDiffs, []);
    assert.deepEqual(input, before);
    const dto = preview({ plan: first, ...input });
    assert.equal(dto.status, 'unchanged');
    assert.equal(dto.historyStatus, 'REVIEW_REQUIRED');
    assert.doesNotMatch(dto.message, /είναι ήδη τακτοποιημένο/);
    assert.match(dto.message, /Δεν αποθηκεύτηκε.*1\..*2\..*ΙΣΤ-ΟΛΟΚΛ-01/s);
});

test('CLEAN requires both canonical state and complete coverage of the actual input', () => {
    const input = F.caseA();
    input.currentEmployee.hmeromhnia_isxyos_oron_ergasias_eos = '2026-10-05';
    input.completeHistoryRows = planner(input).proposedRows;
    const result = planner(input);
    assert.equal(A.isNoOp(result), true);
    assert.equal(A.historyCompletionStatus({ ...input, plan: result }), 'CLEAN');
    assert.deepEqual(employeeHistoryCoverageGaps({ currentEmployee: input.currentEmployee,
        historyRows: input.completeHistoryRows }), []);
    assert.equal(A.historyCompletionStatus({ ...input, plan: planner(input) }), 'CLEAN');
    // The independent check assesses persisted input, not a hypothetical repair.
    input.completeHistoryRows[0].hmeromhnia_isxyos_oron_ergasias_eos = '2026-05-20';
    assert.notEqual(A.historyCompletionStatus({ ...input, plan: planner(input) }), 'CLEAN');
});

test('empty history cannot be certified by the NO_HISTORY reconstruction result', () => {
    const input = F.caseA(); input.completeHistoryRows = [];
    const result = planner(input);
    assert.equal(result.status, 'NO_HISTORY');
    assert.equal(A.isNoOp(result), true);
    assert.equal(A.historyCompletionStatus({ ...input, plan: result }), 'REVIEW_REQUIRED');
});

test('blocked malformed input remains unverified rather than CLEAN', () => {
    const input = F.caseA(); input.completeHistoryRows[1]._id = input.completeHistoryRows[0]._id;
    const result = planner(input);
    assert.equal(result.status, 'BLOCKED');
    assert.equal(A.historyCompletionStatus({ ...input, plan: result }), 'UNVERIFIED');
});
