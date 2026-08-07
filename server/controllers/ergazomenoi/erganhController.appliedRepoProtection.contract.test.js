'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const source = fs.readFileSync(path.join(__dirname, 'erganhController.js'), 'utf8');
const calculationStart = source.indexOf('static calcApasxolhseisPeriodoy = async');
const calculationEnd = source.indexOf('static updateProdhlomenaOrariaReviewRecord', calculationStart);
const calculation = source.slice(calculationStart, calculationEnd);
const postCheckStart = source.indexOf('async function runWeeklyRepoPostCheck({');
const postCheckEnd = source.indexOf('function getDailyDeclaredMinutes', postCheckStart);
const postCheck = source.slice(postCheckStart, postCheckEnd);

test('controller imports the scoped loader and the committed d1 sanitizer', () => {
    assert.ok(source.includes(
        "require('../../services/ergazomenoi/apasxoliseisWeeklyRepoTransferAppliedProtectionContextService')"
    ));
    assert.ok(source.includes(
        "require('../../services/ergazomenoi/apasxoliseisWeeklyRepoTransferAppliedProtectionService')"
    ));
});

test('main projection loads row ID, branch and current Class-A identity', () => {
    assert.match(calculation, /'_id kodikos ypokatasthma hmeromhnia repo argia is_locked '/);
    assert.ok(calculation.includes(
        "'kathgoria_ergasias_apologistika repo_apologistika '"
    ));
});

test('main calculation performs one scoped prefetch after all rows are loaded', () => {
    assert.equal(
        calculation.match(/loadAppliedRepoTransferProtectionContext\(\{/g)?.length,
        1
    );
    assert.ok(calculation.includes('appliedProtectionRowIdsByBranch'));
    assert.ok(calculation.includes('execution_status') === false);
});

test('main update is sanitized exactly once before entering main bulk operations', () => {
    const calls = calculation.match(/sanitizeAppliedRepoTransferUpdate\(\{/g) || [];
    assert.equal(calls.length, 1);
    assert.ok(calculation.includes('update: { $set: protectedUpdate.sanitizedUpdate }'));
    assert.ok(!calculation.includes('update: { $set: update }'));
});

test('main sanitizer diagnostics are grouped by employee/week in memory', () => {
    assert.ok(calculation.includes('const appliedProtectionReasonsByWeek = new Map()'));
    assert.ok(calculation.includes('protectedUpdate.diagnostics'));
    assert.ok(calculation.includes('appliedProtectionReasonsByWeek.get(diagnosticWeekKey).add(reason)'));
});

test('the exact same context and main diagnostics are passed to post-check', () => {
    const callStart = calculation.indexOf('runWeeklyRepoPostCheck({');
    const call = calculation.slice(callStart, calculation.indexOf('});', callStart) + 3);
    assert.ok(call.includes('appliedProtectionContext'));
    assert.ok(call.includes('appliedProtectionReasonsByWeek'));
    assert.equal(postCheck.match(/loadAppliedRepoTransferProtectionContext\(/g), null);
});

test('post-check sanitizes its completed update before its bulk operation', () => {
    assert.equal((postCheck.match(/sanitizeAppliedRepoTransferUpdate\(\{/g) || []).length, 1);
    assert.ok(postCheck.includes('update: { $set: protectedUpdate.sanitizedUpdate }'));
    assert.ok(!postCheck.includes('update: { $set: update }'));
});

test('post-check merges main and local protection diagnostics into existing reasons', () => {
    assert.ok(postCheck.includes('appliedProtectionReasonsByWeek.get(protectionWeekKey)'));
    assert.ok(postCheck.includes('repoStateReasons.add(reason)'));
    assert.ok(postCheck.includes("status: 'NEEDS_HR_DECISION'"));
    assert.ok(postCheck.includes('reasons: [...repoStateReasons]'));
});

test('integration is field-level without blanket skip or post-hoc restore', () => {
    assert.ok(!calculation.includes('restoreApplied'));
    assert.ok(!postCheck.includes('restoreApplied'));
    assert.ok(!calculation.includes('skipProtectedRow'));
    assert.ok(!postCheck.includes('skipProtectedRow'));
});
