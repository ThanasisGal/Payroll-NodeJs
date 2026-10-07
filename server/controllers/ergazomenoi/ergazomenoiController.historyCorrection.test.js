'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const W=require('../../services/ergazomenoi/employeeEmploymentProfileWriter');
const M=require('../../utils/ergazomenoi/employmentProfileMaintenance');
const A=require('../../services/ergazomenoi/employeeHistoryAuthorizationService');
const S=require('../../services/ergazomenoi/employeeHistoryEditorStateService');
const {fixture,store,scope,historyId}=require('../../../test/fixtures/employeeProfileTransactionStore');
const {userModel,token}=require('../../../test/fixtures/employeeHistorySupervisor');
const source=fs.readFileSync(__dirname+'/ergazomenoiController.js','utf8');
const start=source.indexOf('static updateIstorikoData = '),end=source.indexOf('    static searchPostErgazomenoi',start);
const method=source.slice(start,end).trim().replace('static updateIstorikoData = ','').replace(/;$/,'');
const correction=(intent='REMOVE_ROW')=>({intent,targetHistoryId:historyId('employee',1),facts:{},confirmation:null});
const admin={privileges:'A',team:'THA',situation:'A'};
function endpoint(db,role=admin,extra={}) {
    const handler=vm.runInNewContext(`(${method})`,{...M,...A,...S,Date,console:{error(){}},
        ErgazomenoiModel:{findOne(){return {lean:async()=>db.state().employees[0]};}},
        getEmployeeHistoryAccess:async()=>A.accessForUser(role),
        writeEmployeeEmploymentHistoryOperations:args=>W.writeEmployeeEmploymentHistoryOperations({...args,...db.deps,
            userModel:userModel(role),correctionCatalogLoader:async()=>({}),...extra})});
    return async(body)=>{
        const res={code:200,status(code){this.code=code;return this;},json(body){this.body=body;return this;}};
        await handler({session:{userId:'session-actor',userTeam:scope.team,companyInUse:scope.company_kod},
            body:{employeeId:'employee',updates:[],expectedStateToken:token(db),...body}},res);
        return res;
    };
}

test('HTTP correction preview is sanitized and commits zero changes; confirmation uses the same writer',async()=>{
    const db=store(),before=db.state(),call=endpoint(db),r=correction();
    const p=await call({correction:r});assert.equal(p.code,409);assert.equal(p.body.resolutionRequired,true);
    assert.equal(p.body.resolution.phase,'PREVIEW');assert.deepEqual(db.state(),before);
    assert.doesNotMatch(JSON.stringify({...p.body.resolution,fingerprint:undefined}),/507f|historyId|"patch"|survivorId|deleteId/);
    const final=await call({correction:{...r,confirmation:{fingerprint:p.body.resolution.fingerprint,confirmed:true}}});
    assert.equal(final.code,200);assert.equal(final.body.success,true);assert.equal(db.state().history.length,2);
});

test('HTTP malformed correction cannot choose writes or weaken the transaction',async()=>{
    const db=store(),before=db.state();const result=await endpoint(db)({correction:{...correction(),patch:{energos:false}}});
    assert.equal(result.code,409);assert.equal(result.body.reason,'EMPLOYEE_HISTORY_CORRECTION_INVALID_REQUEST');
    assert.match(result.body.message,/Δεν έχει γίνει καμία αλλαγή/);assert.match(result.body.message,/1\./);
    assert.deepEqual(db.state(),before);
});

test('HTTP cancellation of the preview requires no save call and preserves the full business state',async()=>{
    const db=store(),before=db.state();const p=await endpoint(db)({correction:correction()});
    assert.equal(p.body.resolution.phase,'PREVIEW');assert.deepEqual(db.state(),before);
    assert.equal(db.events.some(event=>event.type==='commit'),false);
});

test('HTTP old confirmation receives D0b 409 without any correction write',async()=>{
    const db=store(),call=endpoint(db),expected=token(db),r=correction(),p=await call({correction:r});
    db.changeCommittedHistory(historyId('employee',2),{hmeromhnia_lhxhs_symbashs:'2026-11-30'});
    const before=db.state();const result=await call({expectedStateToken:expected,
        correction:{...r,confirmation:{fingerprint:p.body.resolution.fingerprint,confirmed:true}}});
    assert.equal(result.code,409);assert.equal(result.body.reason,'EMPLOYEE_HISTORY_EDITOR_STALE');assert.deepEqual(db.state(),before);
});

test('HTTP Supervisor fundamental correction opens an Admin-review refusal even with browser role flags',async()=>{
    const f=fixture();f.history[0].hmeromhnia_isxyos_oron_ergasias_eos=null;
    const db=store([f]),before=db.state();const result=await endpoint(db,{privileges:'S',team:'BLG',situation:'A'})({
        privileges:'A',authorizationMode:'ADMIN_FULL',correction:{...correction('REPLACE_START'),targetHistoryId:historyId('employee',0)}});
    assert.equal(result.code,409);assert.equal(result.body.resolution.phase,'BLOCKED');
    assert.match(result.body.resolution.explanation,/διαχειριστή/);assert.deepEqual(db.state(),before);
});

test('HTTP mixed ordinary changes and a correction reject atomically',async()=>{
    const db=store(),before=db.state();
    // Deleted-row mapping uses no controller form helpers.
    const result=await endpoint(db)({correction:correction(),updates:[{state:'deleted',_id:historyId('employee',1)}]});
    assert.equal(result.code,409);assert.equal(result.body.reason,'EMPLOYEE_HISTORY_CORRECTION_INVALID_REQUEST');assert.deepEqual(db.state(),before);
});
