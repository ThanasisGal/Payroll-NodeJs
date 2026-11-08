'use strict';
const {test,before,after,mock}=require('node:test'),assert=require('node:assert/strict');
const {employeeActiveHistoryFixture:fixture}=require('../../../test/fixtures/employeeActiveHistoryFixture');
const {store}=require('../../../test/fixtures/employeeProfileTransactionStore');
const {clone}=require('./employeeHistoryAutomaticSettlementPreparationContract');
const W=require('./employeeEmploymentProfileWriter'),P=require('./employeeHistorySaveValidationService');
const {planEmployeeHistoryAutomaticReconstruction:plan}=require('./employeeHistoryAutomaticReconstructionPlannerService');
const {buildEmployeeHistoryEditorStateToken:token}=require('./employeeHistoryEditorStateService');
const {userModel}=require('../../../test/fixtures/employeeHistorySupervisor');
const {getOrarioTermsForDate:terms}=require('../../utils/ergazomenoi/getOrarioTermsForDate');
const {resolveEmploymentProfileFactsForDate:facts}=require('../../utils/ergazomenoi/employmentProfileHistory');
const {assertVerifiedHistoryCoverageForDate:coverage}=require('../../utils/ergazomenoi/employmentHistoryCoverage');
const {buildDailyOrarioTermsForPeriod:daily}=require('../../utils/ergazomenoi/buildDailyOrarioTermsForPeriod');
const {detectPayrollPhasesForDateRange:phases}=require('../kinhseis/phaseDetectorService');
const {buildPreparedPhaseHistoryMaps:maps}=require('../kinhseis/preparedPhaseHistoryDatasetService');
const {resolveEffectiveEmploymentProfileForReviewDate:review}=require('./apasxoliseisBorrowedEmploymentProfileResolverService');
const {getEffectiveRepoProfileForDate:repo}=require('./apasxoliseisWeeklyRepoTransferAuthoritativeContextService');
before(()=>require('../../../test/fixtures/forbidRealSettlementMongo').forbidRealSettlementMongo(mock));after(()=>mock.restoreAll());
const inspect=f=>P.inspectEmployeeHistorySave({scope:f.scope,currentEmployee:f.employee,historyRows:f.history});
const mark=(f,status)=>({...f.history[0],_id:'507f1f77bcf86cd799439188',aa_eggrafhs:'0099',
 hmeromhnia_proslhpshs:'2020-01-01',hmeromhnia_allaghs_symbashs:'2026-04-02',
 hmeromhnia_isxyos_oron_ergasias_apo:'2026-04-02',employment_history_canonical_status:status,
 ...(status==='REDUNDANT_REFERENCED'?{employment_history_canonical_survivor_id:f.history[0]._id}:{}),
 kathestos_apasxolhshs:'2',typos_apasxolhshs:'2',hmeres_ergasias_ebdomadas:2,ores_ergasias_ebdomadas:16});
const phaseInput=f=>({...f.scope,apo:'2026-04-06',eos:'2026-04-06',asOfDate:'2026-04-30',preparedContext:{employee:f.employee,
 contractStatusHistoryRows:f.history,workingTermsHistoryRows:f.history,rows:[{hmeromhnia:'2026-04-06',kathgoria_ergasias:'ΕΡΓ',ores_ergasias:8,apo_ora_01:'10:00',eos_ora_01:'18:00'}]}});
for(const code of ['0015','0031','0182'])for(const status of ['WITHDRAWN_ERRONEOUS','REDUNDANT_REFERENCED'])
test(`${code}: ${status} has no effect on clean active history and actual payroll phases`,async()=>{
 const f=fixture(code),before=clone(f),expected=await phases(phaseInput(f));f.history.push(mark(f,status));
 assert.equal(inspect(f).status,'CLEAN');assert.notEqual(plan({scope:f.scope,currentEmployee:f.employee,completeHistoryRows:f.history}).status,'BLOCKED');
 const m=maps({historyByEmployee:new Map([[code,f.history]]),employeeByCode:new Map([[code,f.employee]]),periodStart:'2026-04-01',periodEnd:'2026-04-30'});
 assert.equal(m.contractStatusHistoryByEmployee.get(code).length,1);assert.equal(m.workingTermsHistoryByEmployee.get(code).length,1);
 assert.deepEqual(await phases(phaseInput(f)),expected);assert.equal(terms('2026-04-06',f.history,f.employee).hmeres_ergasias_ebdomadas,5);
 assert.equal(daily({periodApo:'2026-04-06',periodEos:'2026-04-06',istorikoRows:f.history,ergazomenos:f.employee})[0].ores_ergasias_ebdomadas,40);
 assert.equal(review({reviewDate:'2026-04-06',normalEmployee:f.employee,normalHistory:f.history}).hmeres_ergasias_ebdomadas,5);
 assert.equal(repo('2026-04-06',f.history,f.employee).hmeres_ergasias_ebdomadas,5);
 assert.deepEqual(f.history[0],before.history[0]);
});
test('withdrawn sole profile never supplies missing coverage',()=>{
 const f=fixture();f.history[0]={...f.history[0],employment_history_canonical_status:'WITHDRAWN_ERRONEOUS'};
 assert.notEqual(inspect(f).status,'CLEAN');assert.throws(()=>coverage('2026-04-06',f.history,f.employee),{code:'EMPLOYEE_HISTORY_COVERAGE_REQUIRED'});
});
test('uncertainty blocks only its actual date and does not retire an ambiguous real period',()=>{
 const f=fixture();const late={...f.history[0],_id:'507f1f77bcf86cd799439102',aa_eggrafhs:'0002',afora_proslhpsh:false,
 hmeromhnia_isxyos_oron_ergasias_apo:'2026-05-01',hmeromhnia_allaghs_symbashs:'2026-05-01',hmeres_ergasias_ebdomadas:2,ores_ergasias_ebdomadas:16};
 f.history.push(late);assert.equal(terms('2026-04-06',f.history,f.employee).hmeres_ergasias_ebdomadas,5);
 assert.throws(()=>terms('2026-05-06',f.history,f.employee),{code:'EMPLOYEE_HISTORY_COVERAGE_REQUIRED'});
 assert.throws(()=>facts('2026-05-06',f.history,{currentEmployee:f.employee}),{code:'EMPLOYEE_HISTORY_COVERAGE_REQUIRED'});
 const survivor=require('./employeeHistoryCorrectionPolicyService').verifiedRedundantSurvivor({scope:f.scope,currentEmployee:f.employee,historyRows:f.history,targetHistoryId:late._id});
 assert.equal(survivor,null);assert.equal(late.employment_history_canonical_status,undefined);
});
async function retire(f,{references=[],fault=false}={}) {
 const db=store([f],{cloneFn:clone}),admin=userModel({privileges:'A',team:'THA',situation:'A'});
 const req={intent:'REMOVE_ROW',targetHistoryId:f.history.at(-1)._id,facts:{},confirmation:null};
 const invoke=correction=>W.writeEmployeeEmploymentHistoryOperations({...db.deps,scope:f.scope,employeeId:f.employee._id,operations:[],
 expectedStateToken:token({currentEmployee:db.state().employees[0],historyRows:db.state().history}),actorUserId:'user',userModel:admin,correction,
 referenceChecker:async({historyIds})=>historyIds.includes(req.targetHistoryId)?references:[]});
 let preview;await assert.rejects(invoke(req),e=>{preview=e.resolution;return e.code==='EMPLOYEE_HISTORY_SAFE_CORRECTION_REQUIRED';});
 assert.equal(preview.phase,'PREVIEW',JSON.stringify(preview));const before=db.state();
 if(fault)db.deps.auditModel.create=async()=>{throw Error('SYNTHETIC_RETIREMENT_AUDIT_FAILURE');};
 return {db,preview,before,apply:()=>invoke({...req,confirmation:{confirmed:true,fingerprint:preview.fingerprint}})};
}
for(const frozen of [false,true])test(`confirmed proven duplicate retains its ID, references, audit and strict CLEAN; protected=${frozen}`,async()=>{
 const f=fixture(),duplicate={...clone(f.history[0]),_id:'507f1f77bcf86cd799439102',aa_eggrafhs:'0002',createdAt:new Date('2025-01-01')};f.history.push(duplicate);
 const reference={collection:'Apasxoliseis_Weekly_Canonical_Decisions',documentId:'synthetic-frozen'};
 const {db,apply}=await retire(f,{references:frozen?[reference]:[]});await apply();const after=db.state();
 assert.equal(after.history.length,2);assert.equal(after.audits.length,1);const retained=after.history.find(r=>String(r._id)===String(duplicate._id));
 assert.equal(retained.employment_history_canonical_status,'REDUNDANT_REFERENCED');
 const {employment_history_canonical_status,employment_history_canonical_survivor_id,updatedAt,...payload}=retained;
 const {updatedAt:oldRevision,...original}=duplicate;assert.deepEqual(payload,original);
 assert.equal(P.inspectEmployeeHistorySave({scope:f.scope,currentEmployee:after.employees[0],historyRows:after.history}).status,'CLEAN');
 assert.deepEqual(await phases(phaseInput({...f,employee:after.employees[0],history:after.history})),await phases(phaseInput({...f,history:[f.history[0]]})));
});
test('retirement audit failure rolls back the whole correction',async()=>{
 const f=fixture();f.history.push({...clone(f.history[0]),_id:'507f1f77bcf86cd799439102',aa_eggrafhs:'0002',createdAt:new Date('2025-01-01')});
 const {db,apply,before}=await retire(f,{fault:true});await assert.rejects(apply(),/SYNTHETIC_RETIREMENT_AUDIT_FAILURE/);assert.deepEqual(db.state(),before);
});

test('all original 0015 rows remain active while 0003 validity is genuinely uncertain',()=>{
 const f=require('../../../test/fixtures/employee0015ReviewFixture').data(),before=clone(f.completeHistoryRows);
 const policy=require('./employeeHistoryCorrectionPolicyService');
 for(const row of f.completeHistoryRows)assert.equal(policy.verifiedRedundantSurvivor({scope:f.scope,currentEmployee:f.currentEmployee,historyRows:f.completeHistoryRows,targetHistoryId:row._id}),null);
 const request={intent:'REMOVE_ROW',targetHistoryId:f.completeHistoryRows[2]._id,facts:{},confirmation:null};
 const result=policy.planHistoryCorrection({scope:f.scope,currentEmployee:f.currentEmployee,historyRows:f.completeHistoryRows,request,accessMode:'ADMIN_FULL',catalogs:{},targetReferences:[]});
 assert.equal(result.public.phase,'BLOCKED');assert.deepEqual(f.completeHistoryRows,before);
 assert.notEqual(P.inspectEmployeeHistorySave({scope:f.scope,currentEmployee:f.currentEmployee,historyRows:f.completeHistoryRows}).status,'CLEAN');
});
test('actual payroll work-facts generation uses active history throughout',async t=>{
 const f=fixture(),detector=require('../kinhseis/phaseDetectorService'),real=detector.detectPayrollPhasesForDateRange;
 t.mock.method(detector,'detectPayrollPhasesForDateRange',args=>real({...args,preparedContext:phaseInput(f).preparedContext}));
 const generate=()=>require('../kinhseis/workFactsPrecalcService').generateWorkFactsForEmployeePeriod({...f.scope,apo:'2026-04-06',eos:'2026-04-06',asOfDate:'2026-04-30',scope:'MANUAL'});
 const before=await generate();assert.equal(before.status,'READY');f.history.push(mark(f,'WITHDRAWN_ERRONEOUS'));
 const after=await generate();const stable=({generatedAt,...value})=>value;assert.deepEqual(stable(after),stable(before));
});
test('safe retirement -> ordinary Save -> reload remains CLEAN with no second historical mutation',async()=>{
 const f=fixture();f.history.push({...clone(f.history[0]),_id:'507f1f77bcf86cd799439102',aa_eggrafhs:'0002',createdAt:new Date('2025-01-01')});
 const {db,apply}=await retire(f);await apply();const after=db.state(),q=value=>({select(){return this;},session(){return this;},lean:async()=>value});
 const saved=await W.writeEmployeeMaintenance({...db.deps,scope:f.scope,employeeId:f.employee._id,actorUserId:'user',
 userModel:{findById:()=>q({team:'TEST',situation:'A'})},privilegeModel:{findOne:()=>q({privileges:{update:true}})},
 maintenance:{employeeChanges:{},historyChanges:{},submittedHistoryChanges:{},submittedProfileFields:[]}});
 assert.equal(saved.historyAlreadyClean,true);assert.deepEqual(db.state(),after);
});
test('frozen finalized results are read unchanged after retirement, without recalculation',()=>{
 const f=fixture(),snapshot={snapshot_schema_version:'employment-period-frozen:v1',scope:{...f.scope,ypokatasthma:'0001',period_start:'2026-04-01',period_end:'2026-04-30'},
 employees:[f.employee],daily_results:[{...f.scope,hmeromhnia:'2026-04-06',ypokatasthma:'0001',ores_ergasias:8,ores_pragmatikhs_ergasias_apologistika:7.5}],
 payroll_results:[{employee_kodikos:f.scope.kodikos,net:1234.56}],deviations:[],canonical_decisions:[],applied_repo_transfers:[]};
 const before=clone(snapshot),project=require('./apasxoliseisStoredReviewReadService').projectStoredFrozenReview;
 const result=project({snapshot,scope:snapshot.scope});assert.equal(result.finalized,true);assert.deepEqual(result.payroll_results,before.payroll_results);assert.deepEqual(snapshot,before);
});

test('payroll history loader keeps employee identity when a history sequence is supplied',async t=>{
 const f=fixture(),retired=mark(f,'WITHDRAWN_ERRONEOUS'),foreign={...f.history[0],kodikos:'OTHER'};let captured;
 t.mock.method(require('../../models/ergazomenoi').IstorikoProslhpseonAllagonModel,'find',query=>{
  captured=query;return {sort(){return this;},lean:async()=>[f.history[0],retired,foreign].filter(row=>row.kodikos===query.kodikos)};
 });
 const rows=await require('../../utils/ergazomenoi/getIstorikoOronErgasiasForPeriod').getIstorikoOronErgasiasForPeriod({...f.scope,aa_eggrafhs:'0001',periodApo:'2026-04-01',periodEos:'2026-04-30'});
 assert.equal(captured.kodikos,f.scope.kodikos);assert.equal(rows.length,1);assert.equal(rows[0]._id,f.history[0]._id);
});
test('two approvals of the same documented retirement cannot produce duplicate audit or partial state',async()=>{
 const f=fixture();f.history.push({...clone(f.history[0]),_id:'507f1f77bcf86cd799439102',aa_eggrafhs:'0002',createdAt:new Date('2025-01-01')});
 const {db,apply}=await retire(f);const results=await Promise.allSettled([apply(),apply()]);
 assert.equal(results.filter(result=>result.status==='fulfilled').length,1);assert.equal(db.state().audits.length,1);assert.equal(db.state().history.length,2);
});
test('a failed independent final-state check rolls back the retirement and audit',async()=>{
 const f=fixture();f.history.push({...clone(f.history[0]),_id:'507f1f77bcf86cd799439102',aa_eggrafhs:'0002',createdAt:new Date('2025-01-01')});
 const {db,apply,before}=await retire(f);db.hooks.read=(session,kind)=>{if(kind==='history'&&session.draft.history.some(row=>row.employment_history_canonical_status))session.draft.history[0].ores_ergasias_ebdomadas=17;};
 await assert.rejects(apply());assert.deepEqual(db.state(),before);
});
