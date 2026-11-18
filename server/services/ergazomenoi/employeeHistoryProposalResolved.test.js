'use strict';
const { test, before, after, mock } = require('node:test');
const assert = require('node:assert/strict');
const { forbidRealSettlementMongo } = require('../../../test/fixtures/forbidRealSettlementMongo');
const F = require('../../../test/fixtures/employeeHistoryResolvedProposal');
const { selectEmployeeHistoryProposalCase: select } = require('./employeeHistoryProposalCaseService');
const { proposalHistoryState } = require('./employeeHistoryProposalReadService');
const X = require('./employeeHistoryProposalXlsxService');
const Row = require('./employeeHistoryRowApprovalService');
const A = require('./employeeHistoryAutomaticReconstructionApplyContract');
const C = require('./employeeHistoryAutomaticReconstructionContract');
const P = require('./employeeHistoryApprovedProposalContract');
const selection = data => select(data, { status: 'REVIEW_REQUIRED' });
before(() => forbidRealSettlementMongo(mock));
after(() => mock.restoreAll());

test('Ελλιπής 0001 → διορθωτική 02/02–31/03 → APPROVED_RESOLVED → φόρτωση χωρίς επιλογή', async () => {
    assert.equal(P.enabled(), false);
    const data = F.resolvedProposalFixture();
    const before = A.stringify({ history: data.completeHistoryRows, references: data.protectedReferenceSummary });
    const staleInsert = selection(data).cases.find(item => item.operation === 'INSERT');
    assert.equal(staleInsert.period.from, '2026-02-02'); assert.equal(staleInsert.period.to, '2026-03-31');
    const audit = F.approveSyntheticEdition(data), snapshot = A.stringify(data);
    const result = await X.buildEmployeeHistoryProposalWorkbook(structuredClone(data), F.catalogs);
    assert.equal(result.caseSelection.cases.some(item => item.operation === 'INSERT'), false);
    assert.equal(Row.pendingFinding(data, staleInsert), null);
    assert.equal(result.caseSelection.total, 1);
    assert.equal(result.caseSelection.selectedCase.targetHistoryId, data.completeHistoryRows[1]._id);
    assert.ok(result.caseSelection.selectedCase.reasons.includes('REQUIRED_PROFILE_FIELD'));
    assert.deepEqual(result.caseSelection.selectedCase.fields, ['krathsh_01']);
    assert.equal(result.caseSelection.selectedCase.period.from, '2026-04-01');
    assert.equal(result.caseSelection.selectedCase.period.to, '2026-06-02');
    assert.equal(result.caseSelection.completedRows[0].historyId, data.completeHistoryRows[0]._id);
    assert.match(result.workbook.getWorksheet('ΠΡΙΝ - ΜΕΤΑ').getCell('A2').text, /Περίπτωση 1 από 1/);
    assert.equal(A.stringify(data), snapshot);
    assert.equal(A.stringify({ history: data.completeHistoryRows, references: data.protectedReferenceSummary }), before);
    assert.equal(audit.diagnostics.rowApproval.status, 'APPROVED_RESOLVED');
    assert.equal(P.enabled(), false);
});

test('Μερική διορθωτική κάλυψη: απομένει ακριβώς 16/03–31/03, με την πραγματική αιτία', () => {
    const data = F.resolvedProposalFixture();
    F.approveSyntheticEdition(data, { [C.START]: new Date('2026-02-02'), [C.END]: new Date('2026-03-15') });
    const pending = selection(data), gaps = pending.cases.filter(item => item.operation === 'INSERT');
    assert.equal(gaps.length, 1);
    assert.deepEqual([gaps[0].period.from, gaps[0].period.to], ['2026-03-16', '2026-03-31']);
    assert.deepEqual(gaps[0].reasons, ['HISTORY_COVERAGE_MISSING']);
    assert.deepEqual(gaps[0].sourceHistoryIds, [data.completeHistoryRows[0]._id, data.completeHistoryRows[1]._id].sort());
    assert.ok(pending.cases.some(item => item.targetHistoryId === data.completeHistoryRows[1]._id));
});

test('Η τελευταία έγκυρη επαληθευμένη έκδοση κερδίζει, ανεξάρτητα από τη σειρά εισόδου', () => {
    const data = F.resolvedProposalFixture();
    const first = F.approveSyntheticEdition(data);
    const second = F.approveSyntheticEdition(data, { [C.END]: new Date('2026-03-15') }, { n: 2, previous: first });
    const third = F.approveSyntheticEdition(data, {}, { n: 3, previous: second, mode: 'APPROVAL_ONLY' });
    assert.equal(selection(data).gaps[0].from, '2026-03-16');
    third.diagnostics.rowApproval.verification.approvedContentHash = 'invalid';
    second.diagnostics.rowApproval.status = 'COMMITTED_AWAITING_VERIFICATION';
    assert.equal(selection(data).cases.some(item => item.operation === 'INSERT'), false);
    assert.equal(proposalHistoryState(data).decisions[0]._id, first._id);
});

test('Αλλοιωμένη, ξένη, μη επαληθευμένη ή παρωχημένη έγκριση δεν κρύβει το κενό', () => {
    for (const tamper of [
        (data, audit) => { audit.diagnostics.rowApproval.approvedContent[C.END] = new Date('2026-12-31'); },
        (data, audit) => { audit.employeeScope.employee_id = 'other'; },
        (data, audit) => { audit.employeeScope.company_kod = 'other'; },
        (data, audit) => { audit.diagnostics.binding.actorUserId = 'other'; },
        (data, audit) => { audit.diagnostics.rowApproval.verification.verifiedAt = null; },
        (data, audit) => { audit.diagnostics.rowApproval.status = 'COMMITTED_AWAITING_VERIFICATION'; },
        data => { data.completeHistoryRows[0].updatedAt = new Date('2026-11-19'); }
    ]) {
        const data = F.resolvedProposalFixture(); tamper(data, F.approveSyntheticEdition(data));
        const pending = selection(data);
        assert.equal(pending.completedRows.length, 0);
        assert.ok(pending.cases.some(item => item.operation === 'INSERT' && item.period.from === '2026-02-02'));
    }
});

test('Έγκυρη έγκριση και αύξηση τεχνικού μετρητή αναφορών: καμία νέα εκκρεμότητα', () => {
    const data = F.resolvedProposalFixture({ independent: false }); F.approveSyntheticEdition(data);
    data.completeHistoryRows[0].history_reference_fence = 8;
    const pending = selection(data);
    assert.equal(pending.total, 0); assert.equal(pending.selectedCase, null);
    assert.equal(pending.completedRows.length, 1); assert.equal(pending.historyStatus, 'REVIEW_REQUIRED');
});

test('Πραγματική επικάλυψη και ασυμφωνία τρεχόντων όρων παραμένουν μετά την έγκριση', () => {
    const data = F.resolvedProposalFixture({ independent: false });
    F.approveSyntheticEdition(data, { [C.START]: new Date('2026-02-02'), [C.END]: new Date('2026-04-15') });
    data.currentEmployee.nomimosMisthos = 999;
    const pending = selection(data);
    const conflict = pending.cases.find(item => item.kind === 'AMBIGUITY' && item.reasons.includes('OVERLAPPING_GENUINE_PERIODS'));
    assert.equal(pending.selectedCase.operation, 'REVIEW_REQUIRED');
    assert.deepEqual([conflict.period.from, conflict.period.to], ['2026-04-01', '2026-04-15']);
    assert.ok(pending.cases.some(item => item.reasons.includes('CURRENT_PROFILE_MISMATCH')));
    assert.equal(pending.completedRows[0].status, Row.STATUS);
});

test('Ανεξάρτητη αντίφαση λήξης σύμβασης: ακριβής ημερομηνία και αιτία αντί πλασματικού INSERT', () => {
    const data = F.resolvedProposalFixture({ independent: false }); F.approveSyntheticEdition(data);
    data.currentEmployee[C.CONTRACT_END] = '2026-05-31';
    const pending = selection(data);
    assert.equal(pending.total, 1);
    const conflict = pending.selectedCase;
    assert.equal(conflict.operation, 'REVIEW_REQUIRED');
    assert.deepEqual(conflict.reasons, ['CONTRACT_CONTINUATION_NOT_EVIDENCED']);
    assert.deepEqual([conflict.period.from, conflict.period.to], ['2026-06-03', '2026-06-03']);
    assert.match(conflict.label, /συνέχεια μετά τη λήξη της σύμβασης/);
    assert.equal(pending.completedRows[0].status, Row.STATUS);
});

test('Χειροκίνητη προβολή ολοκληρωμένης εγγραφής διατηρεί πλήθος και αρίθμηση εκκρεμοτήτων', async () => {
    const data = F.resolvedProposalFixture(); F.approveSyntheticEdition(data);
    const result = await X.buildEmployeeHistoryProposalWorkbook(data, F.catalogs, { selection: `UPDATE:${data.completeHistoryRows[0]._id}` });
    assert.equal(result.caseSelection.total, 1); assert.equal(result.caseSelection.cases.length, 1);
    assert.equal(result.caseSelection.selectedCase.manualSelection, true);
    assert.match(result.workbook.getWorksheet('ΠΡΙΝ - ΜΕΤΑ').getCell('A2').text, /^Επιλεγμένη εγγραφή/);
});
