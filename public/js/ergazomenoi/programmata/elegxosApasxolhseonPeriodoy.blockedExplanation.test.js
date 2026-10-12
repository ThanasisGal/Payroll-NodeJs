'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, 'elegxosApasxolhseonPeriodoy.js'), 'utf8');
const start = source.indexOf('function weeklyHrStage1BusinessStatus');
const end = source.indexOf('function weeklyHrStage1Counts', start);
const sandbox = { EmploymentReviewGuidanceUi: require('./employmentReviewGuidanceUi') };
vm.createContext(sandbox);
vm.runInContext(source.slice(start, end), sandbox);

function payload(status, reasons = []) {
    return { lifecycle_projection: { stages: { stage1: {
        business_status: status, blockers: reasons
    } } }, workflow: { next_required_hr_stage: status === 'BLOCKED' ? 'BLOCKED' : status,
        blocking_reasons: reasons } };
}

const orphan = sandbox.weeklyHrBlockedExplanation(payload('BLOCKED', [
    'ORPHAN_CARD_DURATION_REQUIRES_HR_DECISION',
    'UNRESOLVED_INCOMPLETE_CARD_EVIDENCE'
]));
assert.match(orphan, /χτύπημα κάρτας/);
assert.match(orphan, /δεν μπορεί ακόμη να επιβεβαιωθεί/);

const zeroLength = sandbox.weeklyHrBlockedExplanation(payload('BLOCKED', [
    'ZERO_LENGTH_CARD_INTERVAL_REQUIRES_HR_DECISION',
    'UNRESOLVED_INCOMPLETE_CARD_EVIDENCE'
]));
assert.match(zeroLength, /ίδια ώρα|μηδενικ/);
assert.doesNotMatch(zeroLength, /ορφανό χτύπημα κάρτας/);

const repo = sandbox.weeklyHrBlockedExplanation(payload('BLOCKED', [
    'MULTIPLE_SOURCE_CANDIDATES'
]));
assert.match(repo, /Περισσότερες από μία|περισσότερες από μία/);

const missing = sandbox.weeklyHrBlockedExplanation(payload('BLOCKED', [
    'INCOMPLETE_NATURAL_WEEK'
]));
assert.match(missing, /εβδομάδα|εβδομάδας/);
assert.match(missing, /εγγραφές|ημέρες/);

for (const message of [orphan, zeroLength, repo, missing]) {
    assert.doesNotMatch(message,
        /ORPHAN_CARD|UNRESOLVED|MULTIPLE_SOURCE|INCOMPLETE_NATURAL_WEEK/);
}
assert.strictEqual(sandbox.weeklyHrBlockedExplanation(payload('OPEN')), '');
assert.strictEqual(sandbox.weeklyHrBlockedExplanation(payload('COMPLETED')), '');
const approvedZeroLength = payload('COMPLETED');
approvedZeroLength.rows = [{ cards_apo_ora_01: '14:04', cards_eos_ora_01: '14:04',
    zero_length_card_resolution: { status: 'HR_APPROVED' } }];
assert.strictEqual(sandbox.weeklyHrBlockedExplanation(approvedZeroLength), '');
assert.strictEqual(sandbox.weeklyHrHasOnlyOrphanBlockers(approvedZeroLength), false);

const rebasedCompleted = payload('COMPLETED');
rebasedCompleted.workflow = { next_required_hr_stage: 'BLOCKED',
    blocking_reasons: ['MISSING_AUTHORITATIVE_EMPLOYMENT_FACTS'] };
assert.strictEqual(sandbox.weeklyHrBlockedExplanation(rebasedCompleted), '');
assert.strictEqual(sandbox.weeklyHrHasOnlyOrphanBlockers(rebasedCompleted), false);
const countsSource = source.slice(source.indexOf('function weeklyHrStage1Counts'),
    source.indexOf('const workflowStageNames'));
assert.match(countsSource,
    /blocked:\s*payloads\.filter\(\(item\)\s*=>\s*weeklyHrStage1BusinessStatus\(item\) === 'BLOCKED'\)/);
assert.doesNotMatch(countsSource, /next_required_hr_stage === 'BLOCKED'/);

console.log('weekly blocked explanation presentation tests passed');
