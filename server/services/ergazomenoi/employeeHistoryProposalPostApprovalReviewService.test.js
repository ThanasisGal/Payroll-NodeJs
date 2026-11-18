'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { separatePostApprovalFindings: separate } = require('./employeeHistoryProposalPostApprovalReviewService');

const item = (id, reasons, extra = {}) => ({ kind: 'EXISTING_ROW', operation: 'UPDATE',
    targetHistoryId: id, existingHistoryId: id, sourceHistoryIds: [id],
    reasons, fields: ['example_field'], period: { from: '2026-04-01', to: null }, ...extra });

test('3 verified approvals: two residual diagnoses become read-only findings, not new UPDATE requests', () => {
    const canonical = item('0003', ['RECORDED_ROW_CORRECTION'], { fields: ['hmeromhnia_isxyos_oron_ergasias_eos'] });
    const mismatch = item('0002', ['CURRENT_PROFILE_MISMATCH'],
        { fields: ['eidikh_kathgoria_ergazomenoy', 'synexes_diakekomeno', 'typos_orarioy'] });
    const before = structuredClone([canonical, mismatch]);
    const result = separate([canonical, mismatch], new Set(['0001', '0002', '0003']));
    assert.equal(result.cases.length, 0);
    assert.equal(result.reviewFindings.length, 2);
    for (const finding of result.reviewFindings) {
        assert.equal(finding.kind, 'POST_APPROVAL_REVIEW');
        assert.equal(finding.operation, 'REVIEW_REQUIRED');
        assert.equal(finding.targetHistoryId, null);
        assert.equal(finding.reviewOnly, true);
        assert.equal(finding.approvedHistoryId, finding.existingHistoryId);
    }
    assert.deepEqual([canonical, mismatch], before, 'the stored input is not mutated');
    assert.deepEqual(result.reviewFindings[1].fields,
        ['eidikh_kathgoria_ergazomenoy', 'synexes_diakekomeno', 'typos_orarioy']);
});

test('unapproved and unverifiable rows remain real UPDATE cases', () => {
    const pending = item('0004', ['CURRENT_PROFILE_MISMATCH']);
    const result = separate([pending], new Set(['0001', '0002', '0003']));
    assert.equal(result.cases.length, 1);
    assert.equal(result.reviewFindings.length, 0);
    assert.strictEqual(result.cases[0], pending);
});

test('mixed new safety, temporal and structural reasons are never downgraded', () => {
    const pending = [
        item('0002', ['CURRENT_PROFILE_MISMATCH', 'INVALID_TEMPORAL_DATE']),
        item('0003', ['RECORDED_ROW_CORRECTION', 'INVALID_NUMERIC_PROFILE_FACT']),
        item('0001', ['CONFLICTING_PROFILE_EVENTS']),
        { kind: 'AMBIGUITY', operation: 'REVIEW_REQUIRED', targetHistoryId: null,
            reasons: ['OVERLAPPING_GENUINE_PERIODS'], sourceHistoryIds: ['0002','0003'] }
    ];
    const result = separate(pending, new Set(['0001', '0002', '0003']));
    assert.equal(result.cases.length, 4);
    assert.equal(result.reviewFindings.length, 0);
});

test('an independently verified approved last-period-end inconsistency remains visible', () => {
    const result = separate([item('0003', ['ACTIVE_PERIOD_NOT_OPEN'])], new Set(['0003']));
    assert.equal(result.cases.length, 0);
    assert.deepEqual(result.reviewFindings[0].reasons, ['ACTIVE_PERIOD_NOT_OPEN']);
});

test('empty reasons cannot be silently reclassified as an approved review', () => {
    const result = separate([item('0002', []), item('0002', ['OTHER_UNEXPECTED_REASON'])], new Set(['0002']));
    assert.equal(result.cases.length, 2);
    assert.equal(result.reviewFindings.length, 0);
});
