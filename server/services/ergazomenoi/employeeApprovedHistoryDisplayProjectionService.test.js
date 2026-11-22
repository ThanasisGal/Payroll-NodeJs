'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const source=fs.readFileSync(__dirname+'/employeeApprovedHistoryDisplayProjectionService.js','utf8');
const day=v=>v instanceof Date?v.toISOString().slice(0,10):v;
const scope={team:'TEST',company_kod:'000000000000000000000001',kodikos:'0002'};
const current={_id:'000000000000000000000002'};
const original=[{_id:'000000000000000000000003',history_reference_fence:3,
    hmeromhnia_isxyos_oron_ergasias_eos:null}];
let reads=0, approvals=0;
const Row={async loadDecisions(){approvals++;return [{_id:'approved'}]}};
const B={OPERATION:'ATOMIC',WRITER_VERSION:'v1',invalid:s=>Error(s)};
let tampered=false;
const p={proposalHistoryState:input=>{if(tampered)throw Error('TAMPERED');return ({historyRows:input.completeHistoryRows,
    atomicBoundaries:[{priorHistoryId:String(original[0]._id),priorEffectiveTo:'2026-11-22'}]});}};
const ctx={module:{exports:{}},require:k=>k.endsWith('RowApprovalService')?Row:
    k.endsWith('ImmutableBoundaryService')?B:p, Object,Date};
vm.runInNewContext(source,ctx);
const project=ctx.module.exports.verifiedEmployeeHistoryDisplay;
const db=rows=>({find(query){reads++;assert.equal(query['employeeScope.kodikos'],'0002');
    return {sort(){return this},async lean(){return rows}}}});
test('zero atomic audits add no virtual end or extra approval query',async()=>{
    const before=structuredClone(original),r=await project({scope,currentEmployee:current,
        physicalRows:original,auditModel:db([])});
    assert.equal(r.verified,true);assert.equal(r.hasAtomic,false);
    assert.equal(Object.keys(r.boundaryEnds).length,0);assert.equal(approvals,0);
    assert.deepEqual(original,before);
});
test('verified atomic display gives only a label; persisted record not modified',async()=>{
    const before=structuredClone(original),r=await project({scope,currentEmployee:current,
        physicalRows:original,auditModel:db([{}])});
    assert.equal(r.verified,true);assert.equal(r.hasAtomic,true);
    assert.equal(r.boundaryEnds[original[0]._id],'2026-11-22');
    assert.deepEqual(original,before);assert.equal(original[0].hmeromhnia_isxyos_oron_ergasias_eos,null);
});
test('missing/tampered/failed proof yields no invented verified end',async()=>{
    tampered=true;
    const r=await project({scope,currentEmployee:current,physicalRows:original,auditModel:db([{}])});
    assert.equal(r.verified,false);assert.equal(r.hasAtomic,true);
    assert.equal(Object.keys(r.boundaryEnds).length,0);
    tampered=false;
});
