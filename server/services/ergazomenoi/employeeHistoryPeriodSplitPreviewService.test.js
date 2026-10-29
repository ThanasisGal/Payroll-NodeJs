'use strict';
const { test, before, after, mock } = require('node:test');
const assert = require('node:assert/strict');
const { buildEmployeeHistoryPeriodSplitProposal: split } = require('./employeeHistoryPeriodSplitPreviewService');
const { settlementDecisionFixture } = require('../../../test/fixtures/employeeHistorySettlementDecisionFixture');
const { optionalIntermediateProfileFixture } = require('./fixtures/multipleSafeEmployeeHistoryResolutionFixtures');
const { forbidRealSettlementMongo } = require('../../../test/fixtures/forbidRealSettlementMongo');
const { startSettlementHarness } = require('../../../test/fixtures/employeeHistorySettlementHttpHarness');
const { verifyEmployeeHistoryAutomaticSettlement: verify } = require('./employeeHistoryAutomaticReconstructionPlannerService');
const S = require('./employeeHistoryAutomaticSettlementPreparationContract');
const A = require('./employeeHistoryAutomaticReconstructionApplyContract');
const { periodSplitFixture } = require('../../../test/fixtures/employeeHistoryPeriodSplitFixture');
before(() => forbidRealSettlementMongo(mock));
after(() => mock.restoreAll());
const decision = { choiceId: 'SPLIT_AT_2026_06_29' };
function withProof() {
    const input = settlementDecisionFixture();
    input.completeHistoryRows[2].hmeromhnia_allaghs_symbashs = new Date('2026-06-29');
    return input;
}
test('one overlapped period becomes two successive terms with no gap, overlap, lost identity or changed reference payload', () => {
    const input = settlementDecisionFixture(), before = A.stringify(input), proposal = split(input, decision);
    assert.equal(proposal.status, 'CLEAN');
    assert.equal(proposal.verification.status, 'CLEAN');
    assert.equal(proposal.executionEnabled, false);
    assert.equal(proposal.requiresInsertContractExtension, true);
    assert.deepEqual(proposal.periods.slice(1, 3), [
        { from: '2026-06-27', to: '2026-06-28', days: 2, hours: 14 },
        { from: '2026-06-29', to: '2026-07-05', days: 4, hours: 30 } ]);
    for (let index = 1; index < proposal.periods.length; index++) {
        const previousEnd = new Date(proposal.periods[index - 1].to);
        previousEnd.setUTCDate(previousEnd.getUTCDate() + 1);
        assert.equal(proposal.periods[index].from, previousEnd.toISOString().slice(0, 10));
    }
    for (const row of input.completeHistoryRows) {
        const retained = proposal.proposedRows.find(item => String(item._id) === String(row._id));
        assert.ok(retained);
        const { employment_history_canonical_status, employment_history_canonical_survivor_id, ...payload } = retained;
        assert.deepEqual(payload, row);
        if (employment_history_canonical_survivor_id) assert.ok(proposal.proposedRows.some(item =>
            String(item._id) === String(employment_history_canonical_survivor_id)));
    }
    assert.equal(A.stringify(input), before);
    assert.equal(proposal.proposedRows.length, input.completeHistoryRows.length + 2);
});
test('recorded contract-change date is selected automatically without a human answer', () => {
    const proposal = split(withProof());
    assert.equal(proposal.automatic, true);
    assert.deepEqual(proposal.businessDecision, decision);
    assert.equal(proposal.verification.status, 'CLEAN');
});
test('an informational schedule date alone never proves the real change automatically', () => {
    assert.equal(split(settlementDecisionFixture()), null);
});
test('the documented contract change takes precedence over a different informational schedule date', () => {
    const input = settlementDecisionFixture();
    input.completeHistoryRows[2].hmeromhnia_allaghs_symbashs = new Date('2026-06-30');
    const proposal = split(input);
    assert.equal(proposal.automatic, true);
    assert.equal(proposal.businessDecision.choiceId, 'SPLIT_AT_2026_06_30');
    assert.equal(proposal.periods.find(period => period.hours === 30).from, '2026-06-30');
    assert.equal(input.completeHistoryRows[2].hmeromhnia_allaghs_orarioy_apo.toISOString().slice(0, 10), '2026-06-29');
});
test('existing intermediate resolver provides three consecutive states and validates an alternate business date', () => {
    const input = settlementDecisionFixture(optionalIntermediateProfileFixture);
    for (const businessDecision of [ { choiceId: 'INTERMEDIATE_PROFILE_FROM_2026_06_02' },
        { choiceId: 'INTERMEDIATE_PROFILE_OTHER_DATE', answers: { effectiveDate: '2026-06-01' } } ]) {
        const proposal = split(input, businessDecision);
        assert.equal(proposal.status, 'CLEAN');
        assert.equal(proposal.verification.coverageGaps.length, 0);
        const period = proposal.periods.find(period => period.hours === 16);
        assert.equal(period.from, businessDecision.answers?.effectiveDate || '2026-06-02');
        assert.equal(period.to, '2026-06-08');
    }
    for (const effectiveDate of ['2026-05-25', '2026-06-09', '2026-02-30', '01/06/2026']) {
        assert.throws(() => split(input, { choiceId: 'INTERMEDIATE_PROFILE_OTHER_DATE', answers: { effectiveDate } }));
    }
});
test('repeat planning is deterministic and an already split in-memory image requires no new split', () => {
    const input = withProof(), first = split(input), second = split(input);
    assert.deepEqual(second, first);
    assert.equal(split({ ...input, completeHistoryRows: first.proposedRows }), null);
    assert.equal(verify({ ...input, proposedRows: first.proposedRows }).status, 'CLEAN');
});
test('a split preview from another actor cannot acquire a preparation approval', () => {
    const { scope, currentEmployee, completeHistoryRows, protectedReferenceSummary } = withProof();
    const input = { scope, currentEmployee, completeHistoryRows, protectedReferenceSummary }, proposal = split(input);
    assert.throws(() => S.buildEmployeeHistorySettlementApprovalFingerprint({ ...input, proposal,
        employeeId: String(input.currentEmployee._id), actorUserId: '700000000000000000000001' }),
    { code: S.PREFIX + 'PROPOSAL_CHANGED' });
});
test('unknown references and different employment cycles never get silently rewritten', () => {
    const input = withProof();
    input.protectedReferenceSummary = {};
    const before = A.stringify(input);
    assert.equal(split(input), null);
    assert.equal(A.stringify(input), before);
    const otherCycle = withProof();
    otherCycle.completeHistoryRows[0].hmeromhnia_proslhpshs = new Date('2025-01-01');
    const otherBefore = A.stringify(otherCycle);
    assert.equal(split(otherCycle), null);
    assert.equal(A.stringify(otherCycle), otherBefore);
});
test('synthetic HTTP auto preview performs zero writes and changed choice revokes prior approval', async () => {
    const h = await startSettlementHarness({ fixture: settlementDecisionFixture() });
    try {
        const approved = await (await h.resolve({ choiceId: 'KEEP_TWO_DAY_PROFILE' })).json();
        const splitPreview = await (await h.resolve(decision)).json();
        assert.equal(splitPreview.executionMode, 'SYNTHETIC_ONLY');
        assert.equal(typeof splitPreview.approvalFingerprint, 'string');
        const before = h.db.state();
        assert.equal((await h.apply({ businessDecision: approved.businessDecision,
            approval: { confirmed: true, fingerprint: approved.approvalFingerprint } })).status, 409);
        assert.equal((await h.apply({ businessDecision: decision,
            approval: { confirmed: true, fingerprint: splitPreview.proposalFingerprint } })).status, 409);
        assert.deepEqual(h.db.state(), before);
        h.db.changeHistory(h.initial.completeHistoryRows[2]._id, { hmeromhnia_allaghs_symbashs: new Date('2026-06-29') });
        const changed = h.db.state(), automatic = await (await h.preview()).json();
        assert.equal(automatic.settlementPreview.state, 'automatic');
        assert.deepEqual(automatic.settlementPreview.questions, []);
        assert.notEqual(automatic.proposalFingerprint, splitPreview.proposalFingerprint);
        assert.deepEqual(h.db.state(), changed);
    } finally { await h.close(); }
});
test('the requested annual example becomes January–June and July–December automatically', () => {
    const proposal = split(periodSplitFixture({ yearly: true }));
    assert.equal(proposal.automatic, true);
    assert.deepEqual(proposal.periods.filter(period => period.from.startsWith('2026')), [
        { from: '2026-01-01', to: '2026-06-30', days: 2, hours: 14 },
        { from: '2026-07-01', to: '2026-12-31', days: 4, hours: 30 } ]);
});
test('a previous finalized employment cycle remains byte-for-byte intact beside the split current cycle', () => {
    const input = periodSplitFixture({ priorCycle: true }), before = A.stringify(input);
    const proposal = split(input);
    assert.equal(proposal.status, 'CLEAN');
    assert.equal(proposal.verification.cycles.length, 2);
    assert.deepEqual(proposal.proposedRows.find(row => String(row._id) === '600000000000000000000099'), input.completeHistoryRows[0]);
    assert.equal(A.stringify(input), before);
    const expectedHires = new Set(input.completeHistoryRows.map(row => new Date(row.hmeromhnia_proslhpshs).toISOString()));
    assert.ok(proposal.proposedRows.every(row => expectedHires.has(new Date(row.hmeromhnia_proslhpshs).toISOString())));
});
test('changing recorded evidence or references changes the memory fingerprint without changing source data', () => {
    const input = withProof(), first = split(input);
    input.protectedReferenceSummary[String(input.completeHistoryRows[0]._id)].push({
        collection: 'Apasxoliseis_Period_Frozen_Snapshots', documentId: 'synthetic-later-result' });
    assert.notEqual(split(input).proposalFingerprint, first.proposalFingerprint);
});
