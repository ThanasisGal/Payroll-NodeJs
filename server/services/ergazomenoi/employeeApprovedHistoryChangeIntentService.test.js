'use strict';
const {test,before,after,mock}=require('node:test');
const assert=require('node:assert/strict');
const F=require('../../../test/fixtures/employeeHistoryResolvedProposal');
const A=require('./employeeHistoryAutomaticReconstructionApplyContract');
const C=require('./employeeHistoryAutomaticReconstructionContract');
const S=require('./employeeApprovedHistoryChangeIntentService');
before(()=>require('../../../test/fixtures/forbidRealSettlementMongo').forbidRealSettlementMongo(mock));
after(()=>mock.restoreAll());
const valid6={hmeres_ergasias_ebdomadas:6,typos_ebdomadas:'6HMERH',ores_ergasias_ebdomadas:40,mo_oron_hmerhsias_ergasias:6.67};
const valid5={hmeres_ergasias_ebdomadas:5,typos_ebdomadas:'5HMERH',ores_ergasias_ebdomadas:40,mo_oron_hmerhsias_ergasias:8};
const input=()=>{const data=F.resolvedProposalFixture({independent:false});F.approveSyntheticEdition(data);return data;};
const future=(overrides={})=>({kind:'NEW_CHANGE',effectiveFrom:'2026-11-23',correctedTerms:valid6,...overrides});
const planned=(data,request)=>S.planApprovedHistoryChangeIntent(data,request);

test('0002: 5->6 is a typed, approved-baseline read-only new-version PREVIEW, not a write',()=>{
 const data=input(), before=A.stringify(data);
 const result=planned(data,future());
 assert.equal(result.status,'READY_FOR_ATOMIC_NEW_VERSION_PREVIEW',JSON.stringify(result));
 assert.equal(result.kind,'NEW_CHANGE');
 assert.equal(result.fromDays,5);
 assert.deepEqual(result.proposedTerms,valid6);
 assert.deepEqual(result.existingHistoryMutationIds,[]);
 assert.equal(result.newMutationAuthorized,false);
 assert.equal(result.historyWritten,false);
 assert.equal(A.stringify(data),before);
});
test('6 x 6.67 approximately 40h passes with per-day 2-decimal rounding tolerance',()=>{
 assert.equal(planned(input(),future()).status,'READY_FOR_ATOMIC_NEW_VERSION_PREVIEW');
});
test('cannot submit 6 days while retaining a 5-day weekly category',()=>{
 const x=planned(input(),future({correctedTerms:{...valid6,typos_ebdomadas:'5HMERH'}}));
 assert.equal(x.status,'COMPLETE_COHERENT_WORK_TERMS_REQUIRED');
});
test('inconsistent hours are not silently fabricated or accepted',()=>{
 for(const correctedTerms of [{...valid6,mo_oron_hmerhsias_ergasias:8},
  {...valid6,ores_ergasias_ebdomadas:35},{hmeres_ergasias_ebdomadas:6},
  {...valid6,weeklyHourOverride:100},{...valid6,mo_oron_hmerhsias_ergasias:null}])
  assert.equal(planned(input(),future({correctedTerms})).status,'COMPLETE_COHERENT_WORK_TERMS_REQUIRED');
});
test('date must be explicit calendar date and newer than final saved profile period',()=>{
 for(const effectiveFrom of ['',null,'2026-02-30','23/11/2026','2026-01-01'])
  assert.notEqual(planned(input(),future({effectiveFrom})).status,'READY_FOR_ATOMIC_NEW_VERSION_PREVIEW');
 assert.equal(planned(input(),future({effectiveFrom:'2026-06-03'})).status,'NEW_DATE_NOT_AFTER_CURRENT_START');
});
test('request cannot carry forged approval, source evidence, or existing target for new version',()=>{
 assert.equal(planned(input(),future({claimedApproved:true})).status,'UNEXPECTED_CLIENT_EVIDENCE');
 assert.equal(planned(input(),future({targetHistoryId:'0001'})).status,'NEW_EVENT_CANNOT_REWRITE_AN_EXISTING_ROW');
});
test('blank or false change kind is rejected, rather than guessing an event',()=>{
 for(const kind of ['',null,'AUTOMATIC','TYPO'])
  assert.equal(planned(input(),future({kind})).status,'EXPLICIT_CHANGE_KIND_REQUIRED');
});
test('old approved missing gap does not mask another real missing period',()=>{
 const d=F.resolvedProposalFixture({independent:false});
 F.approveSyntheticEdition(d,{[C.START]:new Date('2026-02-02'),[C.END]:new Date('2026-03-15')});
 assert.equal(planned(d,future()).status,'UNRESOLVED_PREEXISTING_FINDINGS');
});
test('tampered previously approved audit cannot authorize new period',()=>{
 const d=input();d.approvedHistoryDecisions[0].diagnostics.rowApproval.verification.verifiedAt=null;
 assert.equal(planned(d,future()).status,'NO_VERIFIED_PRIOR_APPROVAL');
});
test('pending historical change always blocks a second new period',()=>{
 const d=input();d.currentEmployee.employee_pending_history={id:'pending'};
 assert.equal(planned(d,future()).status,'FIRST_CHANGE_STILL_PENDING');
});
test('unchanged 5 days never creates an extra period',()=>{
 assert.equal(planned(input(),future({correctedTerms:valid5})).status,'NO_CHANGE');
 assert.equal(planned(input(),future({correctedTerms:{...valid5,ores_ergasias_ebdomadas:35,mo_oron_hmerhsias_ergasias:7}})).status,'WORK_TERMS_CHANGED_WITHOUT_DAY_COUNT_CHANGE');
});
test('correction and new event are intentionally distinct; cannot use another date or target',()=>{
 const d=input(),row=d.completeHistoryRows.at(-1);
 d.currentEmployee.hmeres_ergasias_ebdomadas=6;
 row.hmeres_ergasias_ebdomadas=6;
 const request={kind:'CORRECT_SAVED_ERROR',targetHistoryId:String(row._id),
  effectiveFrom:'2026-06-03',correctedTerms:valid5};
 const before=A.stringify(d);
 const fixed=planned(d,request);
 assert.equal(fixed.status,'REQUIRES_CONTROLLED_EXISTING_ROW_CORRECTION',JSON.stringify(fixed));
 assert.equal(fixed.willCreateSecondHistoryEvent,false);
 assert.deepEqual(fixed.existingHistoryMutationIds,[]);
 assert.equal(fixed.newMutationAuthorized,false);
 assert.equal(A.stringify(d),before);
 assert.equal(planned(d,{...request,effectiveFrom:'2026-11-24'}).status,'CORRECTION_MUST_KEEP_ORIGINAL_EFFECTIVE_DATE');
 assert.equal(planned(d,{...request,targetHistoryId:'not-the-row'}).status,'EXACT_LATEST_ERRONEOUS_HISTORY_ID_REQUIRED');
});
test('previously approved rows are not altered by preview (including protected/frozen references)',()=>{
 const d=input();const before=A.stringify(d);
 const result=planned(d,future());
 assert.deepEqual(result.existingHistoryMutationIds,[]);
 assert.equal(A.stringify(d),before);
});
