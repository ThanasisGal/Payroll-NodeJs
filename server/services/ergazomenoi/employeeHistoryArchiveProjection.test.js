"use strict";
const {test}=require('node:test');
const assert=require('node:assert/strict');
const F=require('../../../test/fixtures/employeeHistoryResolvedProposal');
const Archive=require('./employeeHistoryArchiveStateService');
const Cases=require('./employeeHistoryProposalCaseService');
const C=require('./employeeHistoryAutomaticReconstructionContract');
const Read=require('./employeeHistoryProposalReadService');
const Validation=require('./employeeHistorySaveValidationService');
function fixture(){
 const input=F.resolvedProposalFixture({independent:false});
 // Two identical recorded events; a later approved salary makes the projected
 // pair disagree without changing either physical source or its boundaries.
 const first=input.completeHistoryRows[0], second=input.completeHistoryRows[2];
 Object.assign(first,{...second,_id:first._id,aa_eggrafhs:'0001'});
 second.aa_eggrafhs='0002';
 input.completeHistoryRows=[first,second];
 for(const row of input.completeHistoryRows){row[C.START]=row[C.HIRE];row[C.END]=null;}
 input.currentEmployee[C.START]=first[C.HIRE];input.currentEmployee[C.END]=null;
 const selected=Cases.selectEmployeeHistoryProposalCase(input,{status:'REVIEW_REQUIRED'});
 const audit={employeeScope:{...input.scope,employee_id:input.currentEmployee._id},mutationSource:Archive.OPERATION,
 diagnostics:{version:Archive.VERSION,newState:Archive.STATUS,outcome:'COMMITTED',actorUserId:'synthetic',
 targetHistoryId:String(second._id),originalRowHash:Archive.rowHash(second),contextHash:Archive.contextHash(input),
 acceptedFindings:[...selected.cases,...selected.reviewFindings].filter(i=>i.sourceHistoryIds.includes(String(second._id))).map(i=>Archive.findingHash(input,i)),
 acceptedIssues:[]}};
 input.archiveAudits=[audit];
 F.approveSyntheticEdition(input,{nomimosMisthos:1900});
 return input;
}
const conflicts=input=>Cases.selectEmployeeHistoryProposalCase(input,{status:'REVIEW_REQUIRED'}).cases
 .filter(i=>i.reasons.includes('CONFLICTING_PROFILE_EVENTS'));
test('Archived unchanged 0002: verified correction of 0001 does not revive their management conflict',()=>{
 const input=fixture();
 assert.equal(conflicts(input).length,0);
 const selection=Cases.selectEmployeeHistoryProposalCase(input,{status:'REVIEW_REQUIRED'});
 assert.equal(selection.total,0,JSON.stringify(selection));
 assert.equal(selection.reviewFindings.length,0);
 assert.equal(selection.historyStatus,'MANAGEMENT_RESOLVED');
 const inspected=Validation.inspectEmployeeHistorySave({scope:input.scope,currentEmployee:input.currentEmployee,
 historyRows:Read.proposalHistoryState(input).historyRows,approvedHistoryInput:input,includeIssueDetails:true});
 assert.equal(inspected.issues.some(i=>i.reason==='CONFLICTING_PROFILE_EVENTS'),false);
});
test('New event, altered archived source, changed current terms and approved bounds remain strict',()=>{
 for(const alter of [i=>i.completeHistoryRows[1].nomimosMisthos=2001,
 i=>i.currentEmployee.nomimosMisthos=2002,
 i=>{const r={...i.completeHistoryRows[0],_id:'670000000000000000000099',aa_eggrafhs:'0099',nomimosMisthos:2003};i.completeHistoryRows.push(r);i.protectedReferenceSummary[String(r._id)]=[];},
 i=>{i.approvedHistoryDecisions=[];F.approveSyntheticEdition(i,{nomimosMisthos:1900,[C.START]:new Date('2026-01-01')});}]){
 const input=fixture();alter(input);const selected=Cases.selectEmployeeHistoryProposalCase(input,{status:'REVIEW_REQUIRED'});assert.ok(selected.cases.length>0,JSON.stringify(selected));
 }
});
