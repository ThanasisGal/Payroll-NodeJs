'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const W = require('./employeeEmploymentProfileWriter');
const {canonicalizeEmployeeHistory} = require('./employeeHistoryCanonicalizationService');
const {buildCompleteProfileSnapshot} = require('../../utils/ergazomenoi/employmentProfileHistory');
const {employeeStateToken} = require('../../utils/ergazomenoi/employeeSaveState');
const {store} = require('../../../test/fixtures/employeeProfileTransactionStore');
const scope = {team:'TEST', company_kod:'company', kodikos:'0031'};
const query = value => ({select(){return this;},session(){return this;},lean:async()=>value});
const cleanMessage = 'Η αποθήκευση ολοκληρώθηκε. Τα στοιχεία του εργαζομένου ενημερώθηκαν. Το Ιστορικό ελέγχθηκε και ήταν ήδη σωστό· δεν χρειάστηκε καμία ιστορική μεταβολή.';

function fixture() {
    const row = {...buildCompleteProfileSnapshot({effectiveFrom:'2026-04-23'}), ...scope,
        _id:'507f1f77bcf86cd799439101', aa_eggrafhs:'0001', afora_proslhpsh:true,
        hmeromhnia_proslhpshs:'2026-04-23', hmeromhnia_apoxorhshs:'2026-10-04',
        hmeromhnia_lhxhs_symbashs:'2026-10-15', hmeromhnia_isxyos_oron_ergasias_eos:'2026-10-04',
        pragmatikosMisthos:1200, updatedAt:new Date('2026-10-04'), history_reference_fence:3};
    const history = [row, ...[2,3].map(n => ({...row,
        _id:'507f1f77bcf86cd79943910'+n, aa_eggrafhs:'000'+n,
        employment_history_canonical_status:'REDUNDANT_REFERENCED',
        employment_history_canonical_survivor_id:row._id}))];
    return {employee:{...row,_id:'507f1f77bcf86cd799439199',energos:false,
        oristikh_enhmerosh:true,pragmatikosMisthos:1300}, history};
}
function setup(initial = fixture()) {
    const db = store([initial]);
    // The new route must never even call a History mutation method.
    for (const name of ['create','updateOne','updateMany','deleteOne','deleteMany','bulkWrite','findOneAndUpdate']) {
        db.deps.historyModel[name] = () => { throw Error('Forbidden History mutation: '+name); };
    }
    const run = (changes={email:'saved@example.invalid'}, extra={}) => W.writeEmployeeMaintenance({
        ...db.deps, scope, employeeId:initial.employee._id, actorUserId:'synthetic',
        userModel:{findById:()=>query({team:'TEST',situation:'A'})},
        privilegeModel:{findOne:()=>query({privileges:{update:true}})},
        expectedEmployeeStateToken:employeeStateToken(db.state().employees[0]), input:{},
        maintenance:{employeeChanges:changes,submittedEmployeeFields:Object.keys(changes),
            historyChanges:{},submittedHistoryChanges:{},submittedProfileFields:[],submittedFormValues:changes},...extra});
    return {db,run};
}
function preview(db, strictProfileEvidence=true) {
    const state=db.state();
    return canonicalizeEmployeeHistory({scope,currentEmployee:state.employees[0],historyRows:state.history,strictProfileEvidence});
}

test('CLEAN preview -> ordinary Save -> real response and screen message -> reload CLEAN; all three physical rows untouched',async()=>{
    const {db,run}=setup(), before=db.state();
    assert.equal(preview(db,false).status,'AUTO_REPAIRABLE');
    assert.equal(preview(db).status,'CLEAN');assert.equal(preview(db).cleanupRequired,false);
    const result=await run();
    assert.equal(result.historyUpdated,false);assert.equal(result.historyChangedRows,0);
    assert.equal(result.ambiguousHistoryPreserved,false);assert.equal(result.historyAlreadyClean,true);
    assert.equal(result.employee.email,'saved@example.invalid');
    assert.deepEqual(db.state().history,before.history);assert.deepEqual(db.state().audits,before.audits);
    assert.equal(preview(db).status,'CLEAN');assert.equal(preview(db).cleanupRequired,false);
    const controller=fs.readFileSync(path.join(__dirname,'../../controllers/ergazomenoi/ergazomenoiController.js'),'utf8');
    const start=controller.lastIndexOf('            message: maintenanceResult?.historyAlreadyClean');
    const fields=controller.slice(start,controller.indexOf('            automaticReconstructionApplied,',start));
    const response=vm.runInNewContext('({'+fields+'})',{maintenanceResult:result});
    assert.equal(response.message,cleanMessage);assert.equal(response.historyAlreadyClean,true);
    assert.equal(response.ambiguousHistoryPreserved,false);
    const frontend=fs.readFileSync(path.join(__dirname,'../../../public/js/ergazomenoi/genika/putFieldValues.js'),'utf8');
    const message=vm.runInNewContext(frontend.slice(0,frontend.indexOf('// Only successful saves'))+';employeeMaintenanceSuccessMessage');
    assert.equal(message(response),cleanMessage);
    const repeated=await run();assert.equal(repeated.historyAlreadyClean,true);
    assert.deepEqual(db.state().history,before.history);assert.equal(db.state().history.length,3);
});

for(const [field,value] of Object.entries({pragmatikosMisthos:1400,nomimosMisthos:1250,
    synolo_symbashs:1450,poso_symbashs_01:150,poso_symbashs_basei_oron_ergasias_01:160,
    symbash:'new-contract',ores_ergasias_ebdomadas:35,hmeromhnia_apoxorhshs:'2026-10-03'})) {
    test(`real historical change ${field} cannot claim already CLEAN or mutate History`,async()=>{
        const {db,run}=setup(),before=db.state();
        const result=await run({[field]:value});
        assert.notEqual(result.historyAlreadyClean,true);assert.equal(result.ambiguousHistoryPreserved,true);
        assert.equal(result.historyPreservationReason.code,'HISTORY_CHANGE_REQUESTED');
        assert.deepEqual(db.state().history,before.history);
    });
}
for(const problem of ['conflicting-active','coverage-gap','future-departure','not-departed']) {
    test(`${problem} never receives the closed CLEAN exception`,async()=>{
        const f=fixture();
        if(problem==='conflicting-active') f.history.push({...f.history[0],_id:'507f1f77bcf86cd799439109',pragmatikosMisthos:1900});
        if(problem==='coverage-gap') f.history[0].hmeromhnia_isxyos_oron_ergasias_eos='2026-09-01';
        if(problem==='future-departure') f.employee.hmeromhnia_apoxorhshs='2099-01-01';
        if(problem==='not-departed') f.employee.hmeromhnia_apoxorhshs=null;
        const {db,run}=setup(f),before=db.state();
        const result=await run();assert.notEqual(result.historyAlreadyClean,true);
        assert.equal(result.ambiguousHistoryPreserved,true);assert.ok(result.historyPreservationReason.code);
        assert.deepEqual(db.state().history,before.history);
    });
}
for(const [field,value] of Object.entries({aa_eggrafhs:'9999',afora_proslhpsh:false,
    employment_history_canonical_status:'REDUNDANT_REFERENCED',updatedAt:new Date('2026-11-01')})) {
    test(`explicit historical metadata ${field} prevents the CLEAN exception`,async()=>{
        const {db,run}=setup(),before=db.state();
        const result=await run({}, {maintenance:{employeeChanges:{},historyChanges:{[field]:value},
            submittedHistoryChanges:{[field]:value},submittedEmployeeFields:[],submittedFormValues:{}}});
        assert.notEqual(result.historyAlreadyClean,true);assert.deepEqual(db.state().history,before.history);
    });
}
test('explicit row correction and rehire do not enter the read-only CLEAN exception',async()=>{
    for(const maintenance of [{originalHistoryId:'507f1f77bcf86cd799439101'},
        {submittedFormValues:{rehireIntent:true}}]) {
        const {db,run}=setup(),before=db.state();
        const result=await run({}, {maintenance:{employeeChanges:{},historyChanges:{},...maintenance}});
        assert.notEqual(result.historyAlreadyClean,true);assert.deepEqual(db.state().history,before.history);
    }
});
test('stale employee token and unauthorized actor leave every record unchanged',async()=>{
    for(const extra of [{expectedEmployeeStateToken:'stale'},
        {privilegeModel:{findOne:()=>query({privileges:{update:false}})}}]) {
        const {db,run}=setup(),before=db.state();
        await assert.rejects(run(undefined,extra),error=>/STALE|FORBIDDEN/.test(error.code));
        assert.deepEqual(db.state(),before);
    }
});
test('another user changes History after form load: old row revision cannot claim CLEAN',async()=>{
    const {db,run}=setup(),before=db.state();
    db.changeCommittedHistory(before.history[0]._id,{pragmatikosMisthos:1250,updatedAt:new Date('2026-11-01')});
    const changed=db.state();
    const result=await run({}, {maintenance:{employeeChanges:{},historyChanges:{},expectedRevision:before.history[0].updatedAt}});
    assert.notEqual(result.historyAlreadyClean,true);assert.equal(result.ambiguousHistoryPreserved,true);
    assert.equal(result.historyPreservationReason.code,'HISTORY_REVISION_CHANGED');
    assert.deepEqual(db.state().history,changed.history);
});
test('explicit reconstruction cannot receive the ordinary already-CLEAN result',async()=>{
    const {db,run}=setup(),before=db.state();
    const result=await run({}, {reconstruction:{previewToken:'A'.repeat(43),approvalAccepted:true}});
    assert.notEqual(result.historyAlreadyClean,true);assert.deepEqual(db.state().history,before.history);
});
test('normal full-form salary echo and History-owned hire marker compare against their actual owners',async()=>{
    const f=fixture();delete f.employee.afora_proslhpsh;
    const {db,run}=setup(f),before=db.state();
    const echo={afora_proslhpsh:true,pragmatikosMisthos:1300};
    const result=await run({}, {maintenance:{employeeChanges:{},historyChanges:echo,
        submittedHistoryChanges:echo,submittedEmployeeFields:[],submittedFormValues:{}}});
    assert.equal(result.historyAlreadyClean,true);assert.equal(result.ambiguousHistoryPreserved,false);
    assert.deepEqual(db.state().history,before.history);
});
test('another user changes Employee between discovery and fence: stale Save cannot commit',async()=>{
    const {db,run}=setup(),before=db.state();let changed=false;
    db.hooks.read=async(session,kind)=>{
        if(kind==='employees'&&!changed){changed=true;db.changeCommittedEmployee(before.employees[0]._id,{email:'other@example.invalid'});}
    };
    await assert.rejects(run(),error=>/STALE/.test(error.code));
    assert.equal(db.state().employees[0].email,'other@example.invalid');
    assert.deepEqual(db.state().history,before.history);assert.equal(db.events.some(e=>e.type==='commit'),false);
});
test('changed retained physical row during Employee write aborts and rolls back instead of claiming CLEAN',async()=>{
    const {db,run}=setup(),before=db.state(),update=db.deps.employeeModel.updateOne;
    db.deps.employeeModel.updateOne=async(filter,patch,options)=>{
        const result=await update(filter,patch,options);
        if(patch.$set?.email)options.session.draft.history[1].pragmatikosMisthos=1900;
        return result;
    };
    await assert.rejects(run(),{code:'EMPLOYEE_HISTORY_AUTOMATIC_RECONSTRUCTION_FINAL_VERIFICATION_FAILED'});
    assert.deepEqual(db.state(),before);
});
