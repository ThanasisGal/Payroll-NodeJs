'use strict';
const {test, before, after, mock}=require('node:test');
const assert=require('node:assert/strict');
const F=require('../../../test/fixtures/employeeHistoryResolvedProposal');
const A=require('./employeeHistoryAutomaticReconstructionApplyContract');
const B=require('./employeeApprovedHistoryMaintenanceBaselineService');
const C=require('./employeeHistoryAutomaticReconstructionContract');
before(()=>require('../../../test/fixtures/forbidRealSettlementMongo').forbidRealSettlementMongo(mock));
after(()=>mock.restoreAll());

test('approved 0002 legacy coverage is recognized as a verified prior correction, never CLEAN or a new-change authorization',()=>{
    const data=F.resolvedProposalFixture({independent:false});
    const physical=A.stringify(data.completeHistoryRows);
    const approved=F.approveSyntheticEdition(data);
    const result=B.assessApprovedMaintenanceBaseline(data);
    assert.equal(approved.diagnostics.rowApproval.status,'APPROVED_RESOLVED');
    assert.equal(result.state,'VERIFIED_PRIOR_FINDINGS_RESOLVED',JSON.stringify(result));
    assert.equal(result.verifiedApprovalCount,1);
    assert.ok(result.resolvedPriorGapCount>=1);
    assert.equal(result.residualGapCount,0);
    assert.equal(result.pendingCaseCount,0);
    assert.equal(result.reviewFindingCount,0);
    assert.equal(result.priorFindingsResolved,true);
    assert.equal(result.newMutationAuthorized,false);
    assert.equal(A.stringify(data.completeHistoryRows),physical,'all physical History stays untouched');
});

test('approved 0002 permits ONLY new-version planning for an explicitly dated 5->6 change',()=>{
    const data=F.resolvedProposalFixture({independent:false});
    F.approveSyntheticEdition(data);
    const before=A.stringify(data);
    const valid=B.assessApprovedMaintenanceBaseline(data,
        {effectiveFrom:'2026-11-23',weekDays:6});
    assert.equal(valid.newVersionPlanningStatus,'ELIGIBLE_FOR_FURTHER_VERSION_PLANNING');
    assert.equal(valid.newMutationAuthorized,false,'the write still needs a protected full plan');
    const missingDate=B.assessApprovedMaintenanceBaseline(data,{weekDays:6});
    assert.equal(missingDate.newVersionPlanningStatus,'INVALID_NEW_EFFECTIVE_DATE');
    const unchanged=B.assessApprovedMaintenanceBaseline(data,
        {effectiveFrom:'2026-11-23',weekDays:Number(data.currentEmployee.hmeres_ergasias_ebdomadas)});
    assert.equal(unchanged.newVersionPlanningStatus,'INVALID_OR_UNCHANGED_DAYS');
    assert.equal(A.stringify(data),before);
});

test('partial approved correction still exposes the remaining 16/03-31/03 gap',()=>{
    const data=F.resolvedProposalFixture({independent:false});
    F.approveSyntheticEdition(data,{[C.START]:new Date('2026-02-02'),[C.END]:new Date('2026-03-15')});
    const result=B.assessApprovedMaintenanceBaseline(data);
    assert.equal(result.state,'APPROVED_BUT_RESIDUAL_FINDINGS');
    assert.ok(result.residualGapCount>0);
    assert.equal(result.priorFindingsResolved,false);
    assert.equal(result.newMutationAuthorized,false);
});

test('tampered or unverified approval is never an accepted baseline',()=>{
    for(const tamper of [
        (audit)=>{audit.diagnostics.rowApproval.verification.verifiedAt=null;},
        (audit)=>{audit.diagnostics.rowApproval.status='COMMITTED_AWAITING_VERIFICATION';},
        (audit)=>{audit.employeeScope.company_kod='forged';}
    ]) {
        const data=F.resolvedProposalFixture({independent:false});
        const audit=F.approveSyntheticEdition(data);
        tamper(audit);
        const result=B.assessApprovedMaintenanceBaseline(data);
        assert.equal(result.state,'NO_VERIFIED_APPROVALS');
        assert.equal(result.verifiedApprovalCount,0);
        assert.ok(result.residualGapCount>0);
        assert.equal(result.newMutationAuthorized,false);
    }
});

test('independent unresolved insurance field remains a separate case after approval',()=>{
    const data=F.resolvedProposalFixture();
    F.approveSyntheticEdition(data);
    const result=B.assessApprovedMaintenanceBaseline(data);
    assert.equal(result.state,'APPROVED_BUT_RESIDUAL_FINDINGS');
    assert.equal(result.pendingCaseCount,1);
    assert.equal(result.newMutationAuthorized,false);
});

test('newly introduced current-profile mismatch cannot be hidden by prior approval',()=>{
    const data=F.resolvedProposalFixture({independent:false});
    F.approveSyntheticEdition(data);
    data.currentEmployee.nomimosMisthos=999;
    const result=B.assessApprovedMaintenanceBaseline(data);
    assert.notEqual(result.state,'VERIFIED_PRIOR_FINDINGS_RESOLVED');
    assert.equal(result.newMutationAuthorized,false);
});

test('read-only assessment leaves employee, raw rows and audit proof byte-for-byte untouched',()=>{
    const data=F.resolvedProposalFixture({independent:false});
    F.approveSyntheticEdition(data);
    const before=A.stringify(data);
    B.assessApprovedMaintenanceBaseline(data);
    B.assessApprovedMaintenanceBaseline(data);
    assert.equal(A.stringify(data),before);
});
