'use strict';
const {test,before,after,mock}=require('node:test');
const assert=require('node:assert/strict');
const {forbidRealSettlementMongo}=require('../../../test/fixtures/forbidRealSettlementMongo');
const {store}=require('../../../test/fixtures/employeeProfileTransactionStore');
const F=require('./fixtures/employee0015HistoryFixture');
const M=require('./employeeHistoryMissingPeriodCorrectionService');
const {coordinateEmployeeHistorySettlement:coordinate}=require('./employeeHistorySettlementCoordinatorService');
const {buildUnifiedEmployeeHistorySettlementPreview:project}=require('./employeeHistorySettlementPreviewService');
const {verifyEmployeeHistoryAutomaticSettlement:verify}=require('./employeeHistoryAutomaticReconstructionPlannerService');
const {writeEmployeeMaintenance}=require('./employeeEmploymentProfileWriter');
const {employeeStateToken}=require('../../utils/ergazomenoi/employeeSaveState');
const {resolveEmploymentCycleForDate,buildEmploymentCycles}=require('./employeeEmploymentCycleResolverService');
const {isInactiveHistoryRow}=require('../../utils/ergazomenoi/employmentHistoryCanonicalStatus');
before(()=>forbidRealSettlementMongo(mock));after(()=>mock.restoreAll());
const query=value=>({select(){return this;},session(){return this;},lean:async()=>value});
const evidence=d=>M.summarizePredeclaredGapWorkTime({...d,historyRows:d.completeHistoryRows});
const day=value=>value?new Date(value).toISOString().slice(0,10):null;

test('0015 complete synthetic reproduction preserves six originals, withdrawn event, references and audits',()=>{
    const d=F.fixture(),before=structuredClone(d),result=coordinate(d),preview=project(d);
    assert.equal(d.completeHistoryRows.length,6);
    assert.equal(result.status,'REVIEW_REQUIRED');assert.equal(result.reason,'PREDECLARED_WORK_TIME_ONLY');
    assert.equal(preview.historyStatus,'REVIEW_REQUIRED');assert.equal(preview.executionEnabled,false);
    for(const value of ['0002','0003','0004','25/05/2026','09/06/2026','15/09/2026','31/10/2026'])assert.ok(preview.message.includes(value));
    assert.match(preview.message,/Δεν αποθηκεύτηκε καμία αλλαγή/);
    assert.equal(preview.questions.length,0,'no unsupported or falsely executable decision is issued');
    assert.deepEqual(d,before);
    assert.equal(d.currentEmployee.logos_peratosis,'6');assert.equal(d.erganiFacts[1].withdrawn,true);
});
test('complete predeclared days prove 1/8 for 26 April–24 May, with no financial or insurance fabrication',()=>{
    const d=F.fixture(),period=evidence(d)[0];
    assert.deepEqual(period,{from:'2026-04-26',to:'2026-05-24',source:'PREDECLARED_SCHEDULE',
        hmeres_ergasias_ebdomadas:1,ores_ergasias_ebdomadas:8,mo_oron_hmerhsias_ergasias:8});
    const pending=M.planEvidencedMissingHistoryPeriods({...d,historyRows:d.completeHistoryRows});
    assert.equal(pending.status,'BLOCKED');assert.equal(pending.reason,'PREDECLARED_WORK_TIME_ONLY');
    assert.equal(pending.desiredHistoryRows,undefined,'later 4/32 terms cannot be copied backwards');
});
for(const kind of ['missing-day','duplicate-day','wrong-scope','inconsistent-week','explicit-break','cards-only'])test(`predeclared evidence rejects ${kind}`,()=>{
    const d=F.fixture();
    if(kind==='missing-day')d.predeclaredScheduleRows.pop();
    if(kind==='duplicate-day')d.predeclaredScheduleRows.push(structuredClone(d.predeclaredScheduleRows[0]));
    if(kind==='wrong-scope')d.predeclaredScheduleRows[0].kodikos='other';
    if(kind==='inconsistent-week')d.predeclaredScheduleRows[0].eos_ora_01='17:00';
    if(kind==='explicit-break')d.predeclaredScheduleRows[0].dialleima_apo_ora_01='14:00';
    if(kind==='cards-only')d.predeclaredScheduleRows.forEach(row=>{row.kathgoria_ergasias_apologistika=row.kathgoria_ergasias;delete row.kathgoria_ergasias;});
    assert.deepEqual(evidence(d),[]);
});
test('schedule loading reads only scoped predeclared fields inside the bounded gap',async()=>{
    const d=F.fixture();let filter,options,limit;
    const connection={collection(name){assert.equal(name,'Prodhlomena_Oraria');return {find(f,o){filter=f;options=o;return {limit(n){limit=n;return this;},toArray:async()=>d.predeclaredScheduleRows};}};}};
    const result=await M.loadPredeclaredGapScheduleRows({...d,historyRows:d.completeHistoryRows,connection});
    assert.equal(result.length,29);assert.equal(limit,367);
    for(const key of ['team','company_kod','kodikos'])assert.equal(filter[key],d.scope[key]);
    assert.equal(day(filter.hmeromhnia.$gte),'2026-04-26');assert.equal(day(filter.hmeromhnia.$lte),'2026-05-24');
    assert.ok(Object.keys(options.projection).every(field=>!field.includes('apologistika')));
});
function setup(d) {
    const db=store([{employee:d.currentEmployee,history:d.completeHistoryRows}]);
    for(const method of ['create','updateOne','updateMany','deleteOne','deleteMany','bulkWrite','findOneAndUpdate'])
        db.deps.historyModel[method]=()=>assert.fail('Ordinary Save cannot mutate History');
    const run=(changes={email:'synthetic@example.invalid'},extra={})=>writeEmployeeMaintenance({...db.deps,
        scope:d.scope,employeeId:d.currentEmployee._id,actorUserId:'synthetic',
        expectedEmployeeStateToken:employeeStateToken(db.state().employees[0]),
        userModel:{findById:()=>query({team:'TEST',situation:'A'})},privilegeModel:{findOne:()=>query({privileges:{update:true}})},
        input:{},maintenance:{employeeChanges:changes,submittedEmployeeFields:Object.keys(changes),
            historyChanges:{},submittedHistoryChanges:{},submittedProfileFields:[],submittedFormValues:changes},...extra});
    return {db,run};
}
for(const technicalRows of [false,true])test(`explicit hypothetical certification -> CLEAN -> Save -> reload CLEAN, technical=${technicalRows}`,async()=>{
    const d=F.certifiedFixture({technicalRows}),before=structuredClone(d),plan=coordinate(d);
    assert.equal(plan.status,'CLEAN',JSON.stringify(plan));assert.equal(plan.noOp,true);
    const checked=verify({scope:d.scope,currentEmployee:d.currentEmployee,proposedRows:d.completeHistoryRows,
        requiredHistoryRows:d.completeHistoryRows,strictProfileEvidence:true});
    assert.equal(checked.status,'CLEAN',JSON.stringify(checked));
    const {db,run}=setup(d),stored=db.state();
    const result=await run();assert.equal(result.historyAlreadyClean,true);assert.equal(result.ambiguousHistoryPreserved,false);
    assert.equal(result.historyChangedRows,0);assert.deepEqual(db.state().history,stored.history);assert.deepEqual(db.state().audits,stored.audits);
    const state=db.state(),reload=coordinate({...d,currentEmployee:state.employees[0],completeHistoryRows:state.history});
    assert.equal(reload.status,'CLEAN');assert.equal(reload.noOp,true);
    assert.equal((await run()).historyAlreadyClean,true);
    assert.deepEqual(d,before);
    const employment={currentEmployee:d.currentEmployee,history:d.completeHistoryRows};
    assert.equal(buildEmploymentCycles(employment)[0].departure_date,'2026-09-15');
    assert.equal(resolveEmploymentCycleForDate('2026-09-16',employment).cycle,null);
    const active=d.completeHistoryRows.filter(row=>!isInactiveHistoryRow(row) && row.hmeromhnia_isxyos_oron_ergasias_apo);
    assert.ok(active.every(row=>day(row.hmeromhnia_isxyos_oron_ergasias_eos)<='2026-09-15'));
    assert.ok(active.some(row=>row.hmeres_ergasias_ebdomadas===2),'0003 remains a genuine evidenced period in this hypothetical case');
});
for(const [field,value] of Object.entries({pragmatikosMisthos:9999,ores_ergasias_ebdomadas:32,
    hmeromhnia_lhxhs_symbashs:'2026-10-30',hmeromhnia_apoxorhshs:'2026-09-14'}))test(`0015 real change ${field} cannot claim already CLEAN`,async()=>{
    const {db,run}=setup(F.certifiedFixture({technicalRows:true})),before=db.state();
    const result=await run({[field]:value});assert.notEqual(result.historyAlreadyClean,true);
    assert.equal(result.ambiguousHistoryPreserved,true);assert.deepEqual(db.state().history,before.history);
});
test('unresolved original periods cannot claim already CLEAN during ordinary Save',async()=>{
    const {db,run}=setup(F.fixture()),before=db.state();
    assert.notEqual((await run()).historyAlreadyClean,true);assert.deepEqual(db.state().history,before.history);
});

test('0015 certified NO_OP performs zero writes, including mutation sequence, timestamps and audits',async()=>{
    const {db,run}=setup(F.certifiedFixture({technicalRows:true})),before=db.state();
    db.deps.employeeModel.updateOne=()=>assert.fail('NO_OP must not acquire a write fence or update Employee');
    db.deps.auditModel.create=()=>assert.fail('NO_OP must not append an audit');
    const result=await run({});
    assert.equal(result.historyAlreadyClean,true);assert.equal(result.employeeUpdated,false);
    assert.equal(result.historyUpdated,false);assert.equal(result.historyChangedRows,0);
    assert.deepEqual(db.state(),before);
    assert.equal(db.events.some(event=>['fence','write'].includes(event.type)),false);
});
test('0015 Employee-only correction retains revisions and uses the transaction fence with timestamps disabled',async()=>{
    const {db,run}=setup(F.certifiedFixture()),before=db.state(),update=db.deps.employeeModel.updateOne;
    const writes=[];
    db.deps.employeeModel.updateOne=async(filter,patch,options)=>{
        writes.push({patch,options});return update(filter,patch,options);
    };
    const result=await run({email:'corrected@example.invalid'});
    assert.equal(result.historyAlreadyClean,true);assert.equal(result.employeeUpdated,true);
    assert.deepEqual(writes.map(write=>write.patch),[
        {$inc:{employee_profile_mutation_sequence:1}},{$set:{email:'corrected@example.invalid'}}]);
    assert.ok(writes.every(write=>write.options.timestamps===false && write.options.session));
    assert.deepEqual(db.state().employees[0],{...before.employees[0],email:'corrected@example.invalid',employee_profile_mutation_sequence:1});
    assert.deepEqual(db.state().history,before.history);assert.deepEqual(db.state().audits,before.audits);
});
for(const extra of [{expectedEmployeeStateToken:'stale'},
    {privilegeModel:{findOne:()=>query({privileges:{update:false}})}}])test('0015 read-only NO_OP still rejects stale or unauthorized requests without writes',async()=>{
    const {db,run}=setup(F.certifiedFixture()),before=db.state();
    await assert.rejects(run({},extra),error=>/STALE|FORBIDDEN/.test(error.code));
    assert.deepEqual(db.state(),before);
    assert.equal(db.events.some(event=>['fence','write'].includes(event.type)),false);
});
