'use strict';
const {test,before,after,mock}=require('node:test');
const assert=require('node:assert/strict');
const {forbidRealSettlementMongo}=require('../../../test/fixtures/forbidRealSettlementMongo');
const {acceptanceB}=require('../../../test/fixtures/employeeHistoryCoordinatedSettlementFixture');
const U=require('./employeeHistoryCoordinatedSettlementContract');
const S=require('./employeeHistoryAutomaticSettlementPreparationContract');
const W=require('./employeeEmploymentProfileWriter');
const A=require('./employeeHistoryAutomaticReconstructionApplyContract');
before(()=>forbidRealSettlementMongo(mock));after(()=>mock.restoreAll());
function approved() {
    const data=acceptanceB({overlap:true});
    const input={...data,employeeId:String(data.currentEmployee._id),actorUserId:'700000000000000000000001',now:new Date('2026-10-31T12:00:00Z')};
    const proposal=U.buildCoordinatedSettlementProposal(input);
    const fingerprint=S.buildEmployeeHistorySettlementApprovalFingerprint({...input,proposal});
    return {...input,proposal,approval:{confirmed:true,fingerprint}};
}
test('preview contract and fingerprints remain insufficient to authorize a coordinated write',()=>{
    const input=approved(),preview=input.proposal.sourceProposal;
    assert.throws(()=>W.prepareEmployeeEmploymentHistorySettlement({...input,proposal:preview,approval:{confirmed:true,fingerprint:preview.proposalFingerprint}}),
        {code:S.PREFIX+'CLEAN_PROPOSAL_REQUIRED'});
});
for(const field of ['assumptions','sourceProposal','currentPatch','proposedRows','verification'])test(`entire ${field} content participates in fresh approval verification`,()=>{
    const input=approved(),changed=S.clone(input);
    if(field==='assumptions')changed.proposal.assumptions.push({businessRationale:'unapproved'});
    if(field==='sourceProposal')changed.proposal.sourceProposal.snapshotFingerprint='tampered';
    if(field==='currentPatch')changed.proposal.currentPatch.synolo_symbashs=99999;
    if(field==='proposedRows')changed.proposal.proposedRows[0].synolo_symbashs=99999;
    if(field==='verification')changed.proposal.verification.issues.push('tampered');
    assert.throws(()=>W.prepareEmployeeEmploymentHistorySettlement(changed),{code:S.PREFIX+'PROPOSAL_CHANGED'});
});
for(const mutate of [
    input=>{input.currentEmployee.parathrhseis='concurrent';},
    input=>{input.currentEmployee.employee_profile_mutation_sequence=1;},
    input=>{input.completeHistoryRows[0].history_reference_fence=1;},
    input=>{input.protectedReferenceSummary[String(input.completeHistoryRows[0]._id)][0].frozen_snapshot.daily_results[0].amount=999;}
])test('approval binds unrelated current fields, technical fences and full protected frozen results',()=>{
    const input=approved();mutate(input);input.proposal=U.buildCoordinatedSettlementProposal(input);
    assert.throws(()=>S.assertApprovedSettlement(input),{code:S.PREFIX+'APPROVAL_REQUIRED'});
});
for(const tamper of ['salary','identity','duplicateInsert','delete','protectedPayload','unexpectedUpdate'])test(`physical ${tamper} tampering fails at the established write boundary`,()=>{
    const input=approved(),prepared=W.prepareEmployeeEmploymentHistorySettlement(input),physicalPlan=S.clone(prepared.physicalPlan);
    if(tamper==='salary')physicalPlan.rowsToInsert[0].synolo_symbashs=999999;
    if(tamper==='identity')physicalPlan.rowsToInsert[0]._id=input.completeHistoryRows[0]._id;
    if(tamper==='duplicateInsert')physicalPlan.rowsToInsert.push(S.clone(physicalPlan.rowsToInsert[0]));
    if(tamper==='delete')physicalPlan.rowsToDelete.push({historyId:String(input.completeHistoryRows[0]._id),survivingHistoryId:null});
    if(tamper==='protectedPayload')physicalPlan.rowsToUpdate[0].patch.synolo_symbashs=999999;
    if(tamper==='unexpectedUpdate')physicalPlan.rowsToUpdate.push({historyId:'710000000000000000000001',patch:{synolo_symbashs:999}});
    assert.throws(()=>S.assertSettlementPhysicalPlan({proposal:input.proposal,completeHistoryRows:input.completeHistoryRows,
        protectedReferenceSummary:input.protectedReferenceSummary,physicalPlan,expectedRows:physicalPlan.finalRows,
        now:prepared.preparedAt,splitOptions:input}),error=>error.code?.startsWith(S.PREFIX));
});
test('pure preparation preserves caller documents and allocates actual BSON identities only for necessary final periods',()=>{
    const input=approved(),before=A.stringify(input),prepared=W.prepareEmployeeEmploymentHistorySettlement(input);
    assert.equal(A.stringify(input),before);assert.equal(prepared.physicalPlan.rowsToDelete.length,0);
    assert.ok(prepared.physicalPlan.rowsToInsert.length>=2);
    assert.ok(prepared.physicalPlan.rowsToInsert.every(row=>row._id?._bsontype==='ObjectId'));
    for(const original of input.completeHistoryRows)assert.ok(prepared.physicalPlan.finalRows.some(row=>String(row._id)===String(original._id)));
});

const F = require('./fixtures/unifiedEmployeeHistorySettlementFixtures');
const { coordinateEmployeeHistorySettlement: coordinate } = require('./employeeHistorySettlementCoordinatorService');
const { isInactiveHistoryRow } = require('../../utils/ergazomenoi/employmentHistoryCanonicalStatus');

const { canonicalizeEmployeeHistory: canonicalize } = require('./employeeHistoryCanonicalizationService');
const { verifyEmployeeHistoryAutomaticSettlement: verify } = require('./employeeHistoryAutomaticReconstructionPlannerService');

// Structural reproduction only. All identities, references and amounts are synthetic.
function closedCycle() {
    const data = F.input([1, 2, 3].map(n => F.period(n, { hire: '2026-04-23', to: '2026-10-04',
        hmeromhnia_lhxhs_symbashs: '2026-10-15', departure: n === 3 ? '2026-10-04' : null,
        afora_allagh_oron_ergasias: n !== 3, aa_eggrafhs: String(n * 17).padStart(4, '0') })));
    data.currentEmployee.synolo_symbashs = 1300;
    return F.references(data);
}

test('closed-cycle regression: matching historical terms are not replaced by different current pay', () => {
    const data = closedCycle(), before = A.stringify(data);
    const strict = canonicalize({ ...data, historyRows: data.completeHistoryRows, strictProfileEvidence: true });
    assert.equal(strict.status, 'AUTO_REPAIRABLE');
    assert.equal(strict.diagnostics.reason, undefined);
    assert.deepEqual(strict.rowsToUpdate, [], 'historical pay must not be synchronized from the current employee');
    const plan = coordinate(data);
    assert.equal(plan.status, 'CLEAN', plan.reason);
    assert.equal(plan.verification.status, 'CLEAN');
    assert.deepEqual(plan.verification.issues, []);
    assert.deepEqual(plan.verification.coverageGaps, []);
    assert.deepEqual(plan.currentPatch, {});
    const active = plan.proposedRows.filter(row => !isInactiveHistoryRow(row));
    assert.equal(active.length, 1);
    assert.equal(active[0].synolo_symbashs, 1200);
    assert.equal(new Date(active[0].hmeromhnia_apoxorhshs).toISOString().slice(0, 10), '2026-10-04');
    assert.equal(new Date(active[0].hmeromhnia_lhxhs_symbashs).toISOString().slice(0, 10), '2026-10-15');
    for (const original of data.completeHistoryRows) {
        const retained = plan.proposedRows.find(row => String(row._id) === String(original._id));
        assert.ok(retained);
        if (isInactiveHistoryRow(retained)) {
            const { employment_history_canonical_status, employment_history_canonical_survivor_id, ...payload } = retained;
            assert.deepEqual(payload, original);
            assert.equal(String(employment_history_canonical_survivor_id), String(active[0]._id));
        } else assert.deepEqual(retained, original);
    }
    assert.equal(A.stringify(data), before);
    const next = { ...data, completeHistoryRows: plan.proposedRows,
        protectedReferenceSummary: Object.fromEntries(plan.proposedRows.map(row => [String(row._id), data.protectedReferenceSummary[String(row._id)] || []])) };
    const second = coordinate(next);
    assert.equal(second.status, 'CLEAN');
    assert.equal(second.noOp, true);
});

test('closed-cycle regression: genuinely different historical pay still requires a decision', () => {
    const data = closedCycle(), before = A.stringify(data);
    data.completeHistoryRows[0].synolo_symbashs = 1400;
    const modified = A.stringify(data), plan = coordinate(data);
    assert.notEqual(plan.status, 'CLEAN');
    assert.deepEqual(plan.proposedRows, []);
    assert.equal(A.stringify(data), modified);
    assert.notEqual(modified, before);
});

test('closed-cycle regression: active-cycle current disagreements retain their existing protection', () => {
    const data = closedCycle();
    for (const row of [data.currentEmployee, ...data.completeHistoryRows]) row.hmeromhnia_apoxorhshs = null;
    const before = A.stringify(data), plan = coordinate(data);
    assert.notEqual(plan.status, 'CLEAN');
    assert.deepEqual(plan.proposedRows, []);
    assert.equal(A.stringify(data), before);
});

test('closed-cycle regression: verifier uses the same strict mode without changing legacy verification', () => {
    const data = closedCycle(), row = data.completeHistoryRows[2];
    const args = { scope: data.scope, currentEmployee: data.currentEmployee, proposedRows: [row] };
    assert.equal(verify({ ...args, strictProfileEvidence: true }).status, 'CLEAN');
    assert.notEqual(verify(args).status, 'CLEAN', 'default verification retains its established synchronization behavior');
});

test('closed-cycle regression: normal preview adapter and its fresh recheck preserve the same historical terms', () => {
    const data = closedCycle(), before = A.stringify(data);
    const U = require('./employeeHistoryCoordinatedSettlementContract');
    const S = require('./employeeHistoryAutomaticSettlementPreparationContract');
    const proposal = U.buildCoordinatedSettlementProposal(data);
    assert.equal(proposal.status, 'CLEAN');
    assert.equal(proposal.verification.status, 'CLEAN');
    const options = { ...data, proposal, employeeId: String(data.currentEmployee._id), actorUserId: '700000000000000000000001' };
    const fingerprint = S.buildEmployeeHistorySettlementApprovalFingerprint(options);
    assert.equal(fingerprint, S.buildEmployeeHistorySettlementApprovalFingerprint(options));
    assert.equal(A.stringify(data), before);
    assert.throws(() => S.assertApprovedSettlement(options), { code: S.PREFIX + 'APPROVAL_REQUIRED' });
});
