"use strict";
const {test}=require('node:test');
const assert=require('node:assert/strict');
const F=require('../../../test/fixtures/employeeHistoryResolvedProposal');
const Archive=require('./employeeHistoryArchiveStateService');
const Cases=require('./employeeHistoryProposalCaseService');
const C=require('./employeeHistoryAutomaticReconstructionContract');
const Read=require('./employeeHistoryProposalReadService');
const Validation=require('./employeeHistorySaveValidationService');
const A=require('./employeeHistoryAutomaticReconstructionApplyContract');
const {ENABLED}=require('../../utils/ergazomenoi/employmentProfileContract');
function fixture({unrecordedArrangement=false, legacyBreak=false, explicit={nomimosMisthos:1900}}={}){
 const input=F.resolvedProposalFixture({independent:false});
 // Two identical recorded events; a later approved salary makes the projected
 // pair disagree without changing either physical source or its boundaries.
 const first=input.completeHistoryRows[0], second=input.completeHistoryRows[2];
 Object.assign(first,{...second,_id:first._id,aa_eggrafhs:'0001'});
 second.aa_eggrafhs='0002';
 input.completeHistoryRows=[first,second];
 if(unrecordedArrangement) delete first[ENABLED];
 if(legacyBreak) for(const row of input.completeHistoryRows) row.dialleima_se_lepta=0;
 for(const row of input.completeHistoryRows){row[C.START]=row[C.HIRE];row[C.END]=null;}
 input.currentEmployee[C.START]=first[C.HIRE];input.currentEmployee[C.END]=null;
 const selected=Cases.selectEmployeeHistoryProposalCase(input,{status:'REVIEW_REQUIRED'});
 const audit={employeeScope:{...input.scope,employee_id:input.currentEmployee._id},mutationSource:Archive.OPERATION,
 diagnostics:{version:Archive.VERSION,newState:Archive.STATUS,outcome:'COMMITTED',actorUserId:'synthetic',
 targetHistoryId:String(second._id),originalRowHash:Archive.rowHash(second),contextHash:Archive.contextHash(input),
 acceptedFindings:[...selected.cases,...selected.reviewFindings].filter(i=>i.sourceHistoryIds.includes(String(second._id))).map(i=>Archive.findingHash(input,i)),
 acceptedIssues:[]}};
 input.archiveAudits=[audit];
 F.approveSyntheticEdition(input,explicit);
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

// The real failure differs from the old fixture: the physical row has no
// arrangement marker, but its already verified correction explicitly says false.
test('Existing archive and approval: absent arrangement marker to false keeps zero active findings',()=>{
 const input=fixture({unrecordedArrangement:true,explicit:{nomimosMisthos:1900,[ENABLED]:false}});
 const before=A.stringify(input),original=input.completeHistoryRows[0];
 assert.equal(Object.hasOwn(original,ENABLED),false);
 assert.equal(Read.proposalHistoryState(input).historyRows[0][ENABLED],false);
 assert.equal(Archive.validArchives(input)[0].diagnostics.contextHash,Archive.contextHash(input));
 const selection=Cases.selectEmployeeHistoryProposalCase(input,{status:'REVIEW_REQUIRED'});
 assert.equal(selection.total,0,JSON.stringify(selection));
 assert.equal(selection.reviewFindings.length,0);
 assert.equal(selection.completedRows.length,1);
 assert.equal(selection.historyStatus,'MANAGEMENT_RESOLVED');
 assert.equal(Archive.archivedIds(input).has(String(input.completeHistoryRows[1]._id)),true);
 const inspected=Validation.inspectEmployeeHistorySave({scope:input.scope,currentEmployee:input.currentEmployee,
 historyRows:Read.proposalHistoryState(input).historyRows,approvedHistoryInput:input,includeIssueDetails:true});
 assert.equal(inspected.status,'MANAGEMENT_RESOLVED',JSON.stringify(inspected.issues));
 assert.equal(inspected.issues.length,0);
 assert.equal(inspected.historyCertified,false);
 assert.equal(A.stringify(input),before);
});
test('Absent arrangement marker: activation and changed dates or event flags remain conflicts',()=>{
 for(const explicit of [{[ENABLED]:true},{[ENABLED]:'false'},
  {[ENABLED]:false,[C.START]:new Date('2026-01-01')},
  {[ENABLED]:false,afora_allagh_dialleimatos:false}]){
  const input=fixture({unrecordedArrangement:true,explicit:{nomimosMisthos:1900,...explicit}});
  const selection=Cases.selectEmployeeHistoryProposalCase(input,{status:'REVIEW_REQUIRED'});
  assert.ok(selection.total+selection.reviewFindings.length>0,JSON.stringify(explicit));
 }
});
test('Absent marker exception still requires original archive context, source and verified approval',()=>{
 for(const alter of [i=>i.completeHistoryRows[1].nomimosMisthos=2001,
  i=>i.currentEmployee.nomimosMisthos=2002,
  i=>{const row={...i.completeHistoryRows[0],_id:'670000000000000000000099',aa_eggrafhs:'0099',nomimosMisthos:2003};
   i.completeHistoryRows.push(row);i.protectedReferenceSummary[String(row._id)]=[];},
  i=>i.approvedHistoryDecisions[0].diagnostics.rowApproval.verification.approvedContentHash='invalid',
  i=>i.archiveAudits[0].diagnostics.contextHash='invalid']){
  const input=fixture({unrecordedArrangement:true,explicit:{nomimosMisthos:1900,[ENABLED]:false}});
  alter(input);
  const selection=Cases.selectEmployeeHistoryProposalCase(input,{status:'REVIEW_REQUIRED'});
  assert.ok(selection.total+selection.reviewFindings.length>0,JSON.stringify(selection));
 }
});

test('Stored legacy break correction: retired duplicate cannot block save with a derived current mismatch',()=>{
 const input=fixture({unrecordedArrangement:true,legacyBreak:true,explicit:{dialleima_se_lepta:30,[ENABLED]:false}});
 const before=A.stringify(input);
 const selection=Cases.selectEmployeeHistoryProposalCase(input,{status:'REVIEW_REQUIRED'});
 assert.equal(selection.total,0);
 assert.equal(selection.completedRows.length,1);
 assert.equal(selection.reviewFindings.length,0);
 const projected=Read.proposalHistoryState(input).historyRows;
 const raw=Validation.inspectEmployeeHistorySave({scope:input.scope,currentEmployee:input.currentEmployee,
  historyRows:projected,approvedHistoryInput:{...input,archiveAudits:[]},includeIssueDetails:true});
 assert.ok(raw.issues.some(i=>i.reason==='CURRENT_PROFILE_MISMATCH'&&i.historyId===String(input.completeHistoryRows[1]._id)&&i.field==='dialleima_se_lepta'));
 const inspected=Validation.assertEmployeeHistorySaveClean({scope:input.scope,currentEmployee:input.currentEmployee,
  historyRows:projected,approvedHistoryInput:input,includeIssueDetails:true});
 assert.equal(inspected.status,'MANAGEMENT_RESOLVED',JSON.stringify(inspected.issues));
 assert.equal(inspected.issues.length,0);
 assert.equal(inspected.accessMode,'NORMAL');
 assert.equal(inspected.historyCertified,false);
 assert.equal(A.stringify(input),before);
});
test('Stored break correction: real changes and unrelated findings must still block save',()=>{
 for(const alter of [i=>i.currentEmployee.dialleima_se_lepta=20,
  i=>i.completeHistoryRows[1].dialleima_se_lepta=15,
  i=>i.completeHistoryRows[0][C.START]=new Date('2026-01-01'),
  i=>{const row={...i.completeHistoryRows[0],_id:'670000000000000000000099',aa_eggrafhs:'0099',dialleima_se_lepta:15};
   i.completeHistoryRows.push(row);i.protectedReferenceSummary[String(row._id)]=[];},
  i=>i.approvedHistoryDecisions[0].diagnostics.rowApproval.verification.approvedContentHash='invalid']){
  const input=fixture({unrecordedArrangement:true,legacyBreak:true,explicit:{dialleima_se_lepta:30,[ENABLED]:false}});
  alter(input);
  assert.throws(()=>Validation.assertEmployeeHistorySaveClean({scope:input.scope,currentEmployee:input.currentEmployee,
   historyRows:Read.proposalHistoryState(input).historyRows,approvedHistoryInput:input,includeIssueDetails:true}),
   {code:'EMPLOYEE_SAVE_HISTORY_NOT_CLEAN'});
 }
});
