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
