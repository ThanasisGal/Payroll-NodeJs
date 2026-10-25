'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { fixture, store, scope, historyId } = require('../../../test/fixtures/employeeProfileTransactionStore');
const { token, userModel } = require('../../../test/fixtures/employeeHistorySupervisor');
const W = require('./employeeEmploymentProfileWriter');
const P = require('./employeeHistoryCorrectionPolicyService');
const { canonicalizeEmployeeHistory } = require('./employeeHistoryCanonicalizationService');
const { employeeHistoryCoverageGaps, assertVerifiedHistoryCoverageForDate } = require('../../utils/ergazomenoi/employmentHistoryCoverage');
const T = require('../../utils/ergazomenoi/employmentProfileTemporal');
const { getOrarioTermsForDate } = require('../../utils/ergazomenoi/getOrarioTermsForDate');
const { resolveEffectiveEmploymentProfileForReviewDate } = require('./apasxoliseisBorrowedEmploymentProfileResolverService');
const { getEffectiveRepoProfileForDate } = require('./apasxoliseisWeeklyRepoTransferAuthoritativeContextService');
const admin = userModel({privileges:'A',team:'THA',situation:'A'});
const references=async({historyIds})=>historyIds.map(historyId=>({historyId,collection:'Apasxoliseis_Weekly_Canonical_Decisions',documentId:'synthetic'}));
const request = targetHistoryId => ({ intent:'REMOVE_ROW',targetHistoryId,facts:{},confirmation:null });
const invoke=(db,correction)=>W.writeEmployeeEmploymentHistoryOperations({...db.deps,scope,employeeId:'employee',
    operations:[],expectedStateToken:token(db),actorUserId:'user',userModel:admin,correction,referenceChecker:references});
async function preview(db,correction) {
    let result;
    await assert.rejects(invoke(db,correction),error=>{
        assert.equal(error.code,'EMPLOYEE_HISTORY_SAFE_CORRECTION_REQUIRED');result=error.resolution;return true;
    });return result;
}
const canonical=f=>canonicalizeEmployeeHistory({scope,currentEmployee:f.employee,historyRows:f.history});

function firstEntryFixture() {
    const f=fixture();f.history=[];
    Object.assign(f.employee,{hmeromhnia_proslhpshs:'2025-05-01',
        hmeromhnia_isxyos_oron_ergasias_apo:'2025-06-01',
        hmeromhnia_isxyos_dialleimatos_apo:'2025-06-01',
        hmeres_ergasias_ebdomadas:5,ores_ergasias_ebdomadas:40,mo_oron_hmerhsias_ergasias:8});
    return f;
}

test('1.38 first-entry same terms starts without row selection and commits only after preview confirmation',async()=>{
    const f=firstEntryFixture(),db=store([f]),before=db.state();
    const choice=await preview(db,{intent:'REVIEW_INITIAL',targetHistoryId:null,facts:{},confirmation:null});
    assert.equal(choice.phase,'CHOICE');assert.equal(choice.choices[0].id,'INITIAL_FROM_HIRE');
    assert.deepEqual(db.state(),before);
    const r={intent:'INITIAL_FROM_HIRE',targetHistoryId:null,facts:{},confirmation:null};
    const proposal=await preview(db,r);assert.equal(proposal.phase,'PREVIEW');assert.deepEqual(db.state(),before);
    await invoke(db,{...r,confirmation:{fingerprint:proposal.fingerprint,confirmed:true}});
    const state=db.state();assert.equal(state.history.length,1);assert.equal(state.audits.length,1);
    assert.equal(new Date(state.history[0].hmeromhnia_isxyos_oron_ergasias_apo).toISOString().slice(0,10),'2025-05-01');
    assert.equal(new Date(state.employees[0].hmeromhnia_proslhpshs).toISOString().slice(0,10),'2025-05-01');
    assert.equal(canonicalizeEmployeeHistory({scope,currentEmployee:state.employees[0],historyRows:state.history}).status,'CLEAN');
});

test('first-entry preview cannot overwrite intervening Employee changes',async()=>{
    const f=firstEntryFixture(),db=store([f]);
    const r={intent:'INITIAL_FROM_HIRE',targetHistoryId:null,facts:{},confirmation:null};
    const proposal=await preview(db,r),oldToken=token(db);
    db.changeCommittedEmployee('employee',{ores_ergasias_ebdomadas:35});const before=db.state();
    await assert.rejects(W.writeEmployeeEmploymentHistoryOperations({...db.deps,scope,employeeId:'employee',
        operations:[],expectedStateToken:oldToken,actorUserId:'admin',userModel:admin,
        correction:{...r,confirmation:{fingerprint:proposal.fingerprint,confirmed:true}}}),
    error=>error.code==='EMPLOYEE_HISTORY_EDITOR_STALE');
    assert.deepEqual(db.state(),before);
});

test('first-entry missing terms and Supervisor requests cannot create a fabricated period',async()=>{
    const f=firstEntryFixture();delete f.employee.dialleima_se_lepta;
    const db=store([f]),before=db.state();
    const refusal=await preview(db,{intent:'REVIEW_INITIAL',targetHistoryId:null,facts:{},confirmation:null});
    assert.equal(refusal.phase,'BLOCKED');assert.deepEqual(db.state(),before);
    await assert.rejects(W.writeEmployeeEmploymentHistoryOperations({...db.deps,scope,employeeId:'employee',
        operations:[],expectedStateToken:token(db),actorUserId:'supervisor',
        userModel:userModel({privileges:'S',team:scope.team,situation:'A'}),
        correction:{intent:'REVIEW_INITIAL',targetHistoryId:null,facts:{},confirmation:null}}),
    error=>error.code==='EMPLOYEE_HISTORY_SUPERVISOR_SCOPE_FORBIDDEN');
    assert.deepEqual(db.state(),before);
});

test('first-entry audit failure rolls back the entire initial period and Employee boundary',async()=>{
    const f=firstEntryFixture(),db=store([f]),before=db.state();
    const r={intent:'INITIAL_FROM_HIRE',targetHistoryId:null,facts:{},confirmation:null};
    const proposal=await preview(db,r);db.deps.auditModel.create=async()=>{throw Error('first-entry audit failure');};
    await assert.rejects(invoke(db,{...r,confirmation:{fingerprint:proposal.fingerprint,confirmed:true}}),/first-entry audit failure/);
    assert.deepEqual(db.state(),before);
});

test('first-entry never overwrites a pre-existing historical compatibility observation',async()=>{
    const f=firstEntryFixture();f.employee.employment_profile_pre_v1={before:'2025-06-01',facts:{dialleima_se_lepta:15}};
    const db=store([f]),before=db.state();
    const refusal=await preview(db,{intent:'REVIEW_INITIAL',targetHistoryId:null,facts:{},confirmation:null});
    assert.equal(refusal.phase,'BLOCKED');assert.deepEqual(db.state(),before);
});

test('zero active profiles cannot be CLEAN, including a retained withdrawn sole record',()=>{
    const f=fixture();f.history=[];
    assert.equal(canonical(f).diagnostics.reason,'HISTORY_COVERAGE_MISSING');
    f.history=[{...fixture().history[2],employment_history_canonical_status:'WITHDRAWN_ERRONEOUS'}];
    assert.equal(canonical(f).diagnostics.reason,'HISTORY_COVERAGE_MISSING');
});

test('sole referenced withdrawal is blocked without writes or fabricated replacement periods',async()=>{
    const f=fixture();f.history=[f.history[2]];const db=store([f]),before=db.state();
    const result=await preview(db,request(f.history[0]._id));
    assert.equal(result.phase,'BLOCKED');assert.match(result.explanation,/ολόκληρη ιστορική περίοδος/);
    assert.deepEqual(db.state(),before);
});

test('real internal gap is distinguished from an open period and cannot be CLEAN',()=>{
    const f=fixture();f.history.splice(1,1);
    const result=canonical(f);assert.equal(result.diagnostics.reason,'HISTORY_COVERAGE_MISSING');
    assert.deepEqual(result.diagnostics.coverageGaps.map(g=>[g.from,g.to]),[['2026-02-01','2026-02-28']]);
    assert.equal(canonical(fixture()).status,'CLEAN');
});

test('existing initial gap offers an explicit from-hire choice, preview and separate atomic confirmation',async()=>{
    const f=fixture();f.history=[f.history[2]];
    const db=store([f]),before=db.state();
    const r={intent:'CONFIRM_PERIODS',targetHistoryId:f.history[0]._id,facts:{},confirmation:null};
    const worksheet=await preview(db,r);
    assert.equal(worksheet.kind,'USER_CONFIRMED_HISTORY_CORRECTION');
    assert.equal(worksheet.conflicts[0].intents[0].id,'FROM_HIRE');
    assert.deepEqual(db.state(),before);
    const answered={...r,facts:{periodCorrections:worksheet.conflicts.map(c=>({conflictId:c.conflictId,intent:'FROM_HIRE'}))}};
    const proposal=await preview(db,answered);
    assert.equal(proposal.phase,'PREVIEW');assert.deepEqual(db.state(),before);
    await invoke(db,{...answered,confirmation:{fingerprint:proposal.fingerprint,confirmed:true}});
    const state=db.state();
    assert.equal(new Date(state.history[0].hmeromhnia_isxyos_oron_ergasias_apo).toISOString().slice(0,10),'2026-01-01');
    assert.equal(new Date(state.employees[0].hmeromhnia_isxyos_oron_ergasias_apo).toISOString().slice(0,10),'2026-01-01');
    assert.equal(state.history[0]._id,f.history[0]._id);
    assert.equal(state.audits.length,1);
    assert.equal(canonicalizeEmployeeHistory({scope,currentEmployee:state.employees[0],historyRows:state.history}).status,'CLEAN');
});

test('period repair rejects a date that leaves a gap and does not change hire or stored terms',async()=>{
    const f=fixture();f.history=[f.history[2]];
    const db=store([f]),before=db.state(),r={intent:'CONFIRM_PERIODS',targetHistoryId:f.history[0]._id,facts:{},confirmation:null};
    const worksheet=await preview(db,r);
    const refused=await preview(db,{...r,facts:{periodCorrections:worksheet.conflicts.map(c=>({
        conflictId:c.conflictId,intent:'OTHER_DATE',effectiveDate:'2026-02-01'}))}});
    assert.equal(refused.phase,'BLOCKED');assert.deepEqual(db.state(),before);
});

test('Supervisor cannot use period repair to expand the authorization scope',async()=>{
    const f=fixture();f.history=[f.history[2]];const db=store([f]),before=db.state();
    await assert.rejects(W.writeEmployeeEmploymentHistoryOperations({...db.deps,scope,employeeId:'employee',
        operations:[],expectedStateToken:token(db),actorUserId:'supervisor',
        userModel:userModel({privileges:'S',team:scope.team,situation:'A'}),
        correction:{intent:'CONFIRM_PERIODS',targetHistoryId:f.history[0]._id,facts:{},confirmation:null}}),
    error=>error.code==='EMPLOYEE_HISTORY_SUPERVISOR_SCOPE_FORBIDDEN');
    assert.deepEqual(db.state(),before);
});

test('period repair rolls back current dates, history and audit on audit failure',async()=>{
    const f=fixture();f.history=[f.history[2]];const db=store([f]),before=db.state();
    const r={intent:'CONFIRM_PERIODS',targetHistoryId:f.history[0]._id,facts:{},confirmation:null};
    const worksheet=await preview(db,r);
    const answered={...r,facts:{periodCorrections:worksheet.conflicts.map(c=>({conflictId:c.conflictId,intent:'FROM_HIRE'}))}};
    const proposal=await preview(db,answered);
    db.deps.auditModel.create=async()=>{throw Error('synthetic period audit failure');};
    await assert.rejects(invoke(db,{...answered,confirmation:{fingerprint:proposal.fingerprint,confirmed:true}}),/synthetic period audit failure/);
    assert.deepEqual(db.state(),before);
});

test('period repair fails closed when protected reference semantics are unknown',async()=>{
    const f=fixture();f.history=[f.history[2]];const db=store([f]),before=db.state();
    await assert.rejects(W.writeEmployeeEmploymentHistoryOperations({...db.deps,scope,employeeId:'employee',
        operations:[],expectedStateToken:token(db),actorUserId:'admin',userModel:admin,
        correction:{intent:'CONFIRM_PERIODS',targetHistoryId:f.history[0]._id,facts:{},confirmation:null},
        referenceChecker:async()=>[{collection:'Unrecognized_Synthetic_Reference',documentId:'synthetic'}]}),
    error=>error.code==='EMPLOYEE_HISTORY_CORRECTION_REFERENCE_CHECK_FAILED');
    assert.deepEqual(db.state(),before);
});

test('unknown legacy profile facts do not become a same-terms coverage suggestion',()=>{
    const f=fixture();f.history=[f.history[2]];
    delete f.history[0].employment_profile_schema_version;
    const review=P.planHistoryCorrection({scope,currentEmployee:f.employee,historyRows:f.history,
        request:{intent:'REVIEW',targetHistoryId:f.history[0]._id,facts:{},confirmation:null},
        accessMode:'ADMIN_FULL',catalogs:{},insertId:historyId('employee',9)});
    assert.equal(review.public.choices.some(choice=>choice.id==='CONFIRM_PERIODS'),false);
});

test('guided gap dates require preview and final confirmation; cancellation performs no writes',async()=>{
    const f=fixture(),db=store([f]),before=db.state(),r=request(f.history[1]._id);
    const worksheet=await preview(db,r);assert.equal(worksheet.kind,'USER_CONFIRMED_HISTORY_CORRECTION');
    assert.deepEqual(db.state(),before);
    const corrected={...r,facts:{periodCorrections:worksheet.conflicts.map(c=>({conflictId:c.conflictId,
        intent:'OTHER_DATE',effectiveDate:'2026-02-28'}))}};
    const proposal=await preview(db,corrected);assert.equal(proposal.phase,'PREVIEW');
    assert.deepEqual(db.state(),before);
    await invoke(db,{...corrected,confirmation:{fingerprint:proposal.fingerprint,confirmed:true}});
    const state=db.state();assert.equal(state.history.find(row=>row._id===f.history[1]._id).employment_history_canonical_status,'WITHDRAWN_ERRONEOUS');
    assert.equal(canonicalizeEmployeeHistory({scope,currentEmployee:state.employees[0],historyRows:state.history}).status,'CLEAN');
    const retained=state.history.find(row=>row._id===f.history[1]._id);
    for(const [field,value] of Object.entries(f.history[1])) if(field!=='updatedAt') assert.deepEqual(retained[field],value);
});

test('a declared date that still leaves a gap is refused without changing history',async()=>{
    const f=fixture(),db=store([f]),before=db.state(),r=request(f.history[1]._id);
    const worksheet=await preview(db,r);
    const result=await preview(db,{...r,facts:{periodCorrections:worksheet.conflicts.map(c=>({
        conflictId:c.conflictId,intent:'OTHER_DATE',effectiveDate:'2026-02-14'}))}});
    assert.equal(result.phase,'BLOCKED');assert.deepEqual(db.state(),before);
});

test('redundant referenced row can retire when the correct covering record remains',async()=>{
    const f=fixture(),duplicate={...f.history[1],_id:historyId('employee',7),createdAt:new Date('2025-01-01')};
    f.history.push(duplicate);const db=store([f]),r=request(duplicate._id);
    const p=await preview(db,r);assert.equal(p.phase,'PREVIEW');
    await invoke(db,{...r,confirmation:{fingerprint:p.fingerprint,confirmed:true}});
    const row=db.state().history.find(row=>row._id===duplicate._id);
    assert.equal(row.employment_history_canonical_status,'REDUNDANT_REFERENCED');
    assert.equal(row.employment_history_canonical_survivor_id,f.history[1]._id);
});

test('pre-V1 baseline and time between closed and rehired cycles do not require fabricated profiles',()=>{
    const f=fixture();f.history=[f.history[2]];
    f.employee[T.ANCHOR]={source:'PRE_V1_CURRENT_OBSERVATION',before:new Date('2026-03-01'),facts:{}};
    assert.deepEqual(employeeHistoryCoverageGaps({currentEmployee:f.employee,historyRows:f.history}),[]);
    assert.doesNotThrow(()=>assertVerifiedHistoryCoverageForDate('2026-02-01',f.history,f.employee));
    const old=fixture();old.history=old.history.map(row=>({...row,hmeromhnia_apoxorhshs:'2026-03-31',
        [T.END]:row[T.END]||'2026-03-31'}));
    const next=fixture();next.history=[{...next.history[2],hmeromhnia_proslhpshs:'2026-05-01',[T.START]:'2026-05-01'}];
    next.employee={...next.history[0],_id:'employee'};
    assert.deepEqual(employeeHistoryCoverageGaps({currentEmployee:next.employee,historyRows:[...old.history,...next.history]}),[]);
});

for(const resolve of [
    (date,history,employee)=>resolveEffectiveEmploymentProfileForReviewDate({reviewDate:date,normalHistory:history,normalEmployee:employee}),
    getEffectiveRepoProfileForDate
]) test('verified calculation rejects missing historical coverage; ordinary temporal fallback remains unchanged',()=>{
    const f=fixture();f.history=[];
    assert.equal(getOrarioTermsForDate('2026-04-01',[],f.employee).source,'CURRENT_PROFILE');
    assert.throws(()=>resolve('2026-04-01',[],f.employee),{code:'EMPLOYEE_HISTORY_COVERAGE_REQUIRED'});
    assert.doesNotThrow(()=>resolve('2026-04-01',fixture().history,fixture().employee));
    assert.doesNotThrow(()=>resolve('2025-12-01',fixture().history,fixture().employee));
    const legacy={hmeres_ergasias_ebdomadas:5};
    assert.doesNotThrow(()=>resolve('2026-04-01',[],legacy));
    assert.doesNotThrow(()=>resolve(null,[],legacy));
});

test('finite declared coverage and non-profile legacy lifecycle evidence are not mistaken for gaps',()=>{
    const f=fixture();f.employee[T.END]='2026-03-31';f.history[2][T.END]='2026-03-31';
    assert.deepEqual(employeeHistoryCoverageGaps({currentEmployee:f.employee,historyRows:f.history}),[]);
    const legacyEmployee={hmeromhnia_proslhpshs:'2026-01-01'};
    const legacyHire={...legacyEmployee,_id:'legacy-hire',afora_proslhpsh:true,afora_allagh_oron_ergasias:false};
    assert.deepEqual(employeeHistoryCoverageGaps({currentEmployee:legacyEmployee,historyRows:[legacyHire]}),[]);
});

test('coverage guard does not bypass a known earlier cycle because the current employee was rehired',()=>{
    const old=fixture();old.history[2][T.END]='2026-03-31';
    old.history=old.history.filter((_,i)=>i!==1).map(row=>({...row,hmeromhnia_apoxorhshs:'2026-03-31'}));
    const current={...fixture().employee,hmeromhnia_proslhpshs:'2026-05-01',[T.START]:'2026-05-01'};
    assert.throws(()=>assertVerifiedHistoryCoverageForDate('2026-02-15',old.history,current),{code:'EMPLOYEE_HISTORY_COVERAGE_REQUIRED'});
    assert.doesNotThrow(()=>assertVerifiedHistoryCoverageForDate('2026-04-15',old.history,current));
});

test('withdrawn data cannot donate coverage and explicit non-terms rows cannot authorize fallback',()=>{
    const f=fixture();f.history[2].employment_history_canonical_status='WITHDRAWN_ERRONEOUS';
    assert.throws(()=>assertVerifiedHistoryCoverageForDate('2026-04-01',f.history,f.employee),{code:'EMPLOYEE_HISTORY_COVERAGE_REQUIRED'});
    const technical={...fixture().history[2],afora_allagh_oron_ergasias:false};
    assert.throws(()=>assertVerifiedHistoryCoverageForDate('2026-04-01',[technical],f.employee),{code:'EMPLOYEE_HISTORY_COVERAGE_REQUIRED'});
});

test('the actual period-calculation wrapper rejects fallback before producing daily work terms',()=>{
    const fs=require('node:fs'),vm=require('node:vm');
    const source=fs.readFileSync(require('node:path').join(__dirname,'../../controllers/ergazomenoi/erganhController.js'),'utf8');
    const start=source.indexOf('function getOrarioTermsForDate(date, istorikoRows');
    const end=source.indexOf('function getEffectiveEmployeeForDate(',start);
    const resolve=vm.runInNewContext(`(${source.slice(start,end).trim()})`,{
        assertVerifiedHistoryCoverageForDate,temporalProfile:T,resolveTemporalWorkTerms:getOrarioTermsForDate
    });
    const f=fixture();
    assert.throws(()=>resolve('2026-04-01',[],f.employee),{code:'EMPLOYEE_HISTORY_COVERAGE_REQUIRED'});
    assert.equal(resolve('2026-04-01',f.history,f.employee).istorikoId,f.history[2]._id);
});

test('unreferenced deletion cannot erase the evidence that a legacy employee needs a recorded profile',()=>{
    const f=fixture();const target={...f.history[0],[T.END]:null};
    const employee={...scope,_id:'employee',hmeromhnia_proslhpshs:'2026-01-01',energos:true};
    const sparse={...scope,_id:historyId('employee',8),hmeromhnia_proslhpshs:'2026-01-01',
        afora_proslhpsh:true,afora_allagh_oron_ergasias:false,
        employment_profile_source:'LEGACY_OPEN_CYCLE_CLEANUP_FOUNDATION'};
    assert.equal(canonicalizeEmployeeHistory({scope,currentEmployee:employee,historyRows:[sparse,target]}).status,'CLEAN');
    const result=P.planHistoryCorrection({scope,currentEmployee:employee,historyRows:[sparse,target],
        request:request(target._id),accessMode:'ADMIN_FULL',targetReferences:[]});
    assert.equal(result.public.phase,'BLOCKED');assert.match(result.public.explanation,/ολόκληρη ιστορική περίοδος/);
});

test('an inactive artifact alone does not invent a separate historical employment obligation',()=>{
    const f=fixture();
    const artifact={...f.history[0],_id:historyId('employee',9),hmeromhnia_proslhpshs:'2025-01-01',
        [T.START]:'2025-01-01',employment_history_canonical_status:'WITHDRAWN_ERRONEOUS'};
    assert.deepEqual(employeeHistoryCoverageGaps({currentEmployee:f.employee,historyRows:[...f.history,artifact]}),[]);
});
