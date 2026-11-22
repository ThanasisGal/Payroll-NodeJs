'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {createEmployeeApprovedHistoryAtomicMaintenanceController:create} = require('./employeeApprovedHistoryAtomicMaintenanceController');
const EXP = '650000000000000000000010';
const terms = {hmeres_ergasias_ebdomadas:6,typos_ebdomadas:'6HMERH',ores_ergasias_ebdomadas:40,mo_oron_hmerhsias_ergasias:6.67};
const change = {kind:'NEW_CHANGE',effectiveFrom:'2026-11-23',correctedTerms:terms};
const req = (body, session = true) => ({body,session:session?{userId:EXP}:null,sessionID:session?'synthetic-session':null,params:{id:EXP}});
const res = () => ({headers:{}, set(k,v){this.headers[k]=v;return this;},status(code){this.code=code;return this;},json(body){this.body=body;return this;}});
const service = (enabled = true) => {const calls=[]; return {calls,isEnabled:()=>enabled,
    async preview(request,value){calls.push({method:'preview',request,value});return {success:true,previewOnly:true,approval:'HMAC-CONTROLLED-TOKEN'};},
    async apply(request,value,token){calls.push({method:'apply',request,value,token});return {success:true,historyUpdated:true,employeeUpdated:true,historyStatus:'LEGACY_COMPATIBLE'};}};};
test('OFF before inspecting a hostile request; no DB or save calls',async()=>{
 const s=service(false),c=create({service:s});for(const handler of [c.preview,c.apply]){
  const request=new Proxy({}, {get(){assert.fail('DISABLED must not inspect req');}}), response=res();
  await handler(request,response);assert.equal(response.code,423);
  assert.equal(response.body.saved,false);assert.equal(response.body.executionEnabled,false);
  assert.equal(response.headers['Cache-Control'],'no-store');
 }assert.equal(s.calls.length,0);
});
test('preview accepts only coherent typed work terms, no scope/approvals from browser',async()=>{
 const s=service(),c=create({service:s});const response=res(),request=req({change});
 await c.preview(request,response);assert.equal(response.code,200);assert.equal(response.body.previewOnly,true);
 assert.deepEqual(s.calls.map(x=>x.method),['preview']);
 assert.deepEqual(s.calls[0].value,change);
});
test('apply requires exact matching intent and confirmed signature, then hands back result',async()=>{
 const s=service(),c=create({service:s}),request=req({change,approval:{token:'HMAC-CONTROLLED-TOKEN',confirmed:true}}),response=res();
 await c.apply(request,response);assert.equal(response.code,200);assert.equal(response.body.historyStatus,'LEGACY_COMPATIBLE');
 assert.equal(s.calls.length,1);assert.equal(s.calls[0].method,'apply');assert.equal(s.calls[0].token,'HMAC-CONTROLLED-TOKEN');
});
for(const [name,mutate] of [
 ['invented browser scope',c=>({...c,scope:{team:'THA'}})],
 ['client approved decisions',c=>({...c,approvedHistoryDecisions:[{status:'APPROVED_RESOLVED'}]})],
 ['new change with forged history id',c=>({...c,targetHistoryId:EXP})],
 ['strange change mode',c=>({...c,kind:'REPLACE_ALL_HISTORY'})],
 ['missing validity date',c=>({...c,effectiveFrom:''})],
 ['impossible calendar date',c=>({...c,effectiveFrom:'2026-02-30'})],
 ['bad calendar month',c=>({...c,effectiveFrom:'2026-13-42'})],
 ['inconsistent days/week',c=>({...c,correctedTerms:{...terms,typos_ebdomadas:'5HMERH'}})],
 ['inconsistent daily hours',c=>({...c,correctedTerms:{...terms,mo_oron_hmerhsias_ergasias:8}})],
 ['null daily hours',c=>({...c,correctedTerms:{...terms,mo_oron_hmerhsias_ergasias:null}})],
 ['client flags',c=>({...c,executionEnabled:true})]
])test('rejects '+name+' before service call',async()=>{
 const s=service(),controller=create({service:s}),response=res();await controller.preview(req({change:mutate(change)}),response);
 assert.equal(response.code,400);assert.equal(response.body.saved,false);assert.equal(s.calls.length,0);
});
for(const x of [{confirmed:false,token:'abc'}, {confirmed:true,token:2}, {confirmed:true,token:'abc',scope:'inject'}, {}, null])
test('bad approval envelope is rejected '+JSON.stringify(x),async()=>{
 const s=service(),response=res();await create({service:s}).apply(req({change,approval:x}),response);
 assert.equal(response.code,400);assert.equal(s.calls.length,0);
});
test('missing auth is rejected before service invocation',async()=>{
 const s=service(),response=res();await create({service:s}).preview(req({change},false),response);
 assert.equal(response.code,401);assert.equal(s.calls.length,0);
});
test('same-date correction requires original trusted target ID',async()=>{
 const s=service(),response=res();const correction={...change,kind:'CORRECT_SAVED_ERROR'};
 await create({service:s}).preview(req({change:correction}),response);assert.equal(response.code,400);
 const response2=res();await create({service:s}).preview(req({change:{...correction,targetHistoryId:EXP}}),response2);
 assert.equal(response2.code,200);assert.equal(s.calls.length,1);
});
test('known business refusal is typed and does not echo internal state',async()=>{
 const s=service();s.preview=async()=>{throw Object.assign(Error('secret database detail'),{code:'EMPLOYEE_APPROVED_ATOMIC_PENDING_HISTORY_FIRST',statusCode:409});};
 const response=res();await create({service:s}).preview(req({change}),response);
 assert.equal(response.code,409);assert.equal(response.body.outcome,'REJECTED');assert.equal(response.body.saved,false);
 assert.doesNotMatch(JSON.stringify(response.body),/secret|database detail/);
});
test('unconfirmed transaction outcome is not declared rolled back',async()=>{
 const s=service();s.apply=async()=>{throw Error('synthetic commit-uncertain');};
 const response=res();await create({service:s}).apply(req({change,approval:{token:'signed',confirmed:true}}),response);
 assert.equal(response.code,503);assert.equal(response.body.saved,null);assert.equal(response.body.outcome,'UNKNOWN');
 assert.match(response.body.message,/Μην επαναλάβετε/);
});
test('strict service factory API',()=>{
 assert.throws(()=>create({service:{isEnabled:()=>true}}),/SERVICE_REQUIRED/);
});
test('route registration uses only shared POST and existing authentication',async()=>{
 const express=require('express');const {once}=require('node:events');
 const {registerEmployeeHistorySettlementRoutes}=require('../../routes/employeeHistorySettlementRoutes');
 const s=service();const approvedAtomicController=create({service:s});
 const app=express();app.use(express.json());app.use((request,response,next)=>{request.session={userId:EXP};request.sessionID='session';next();});
 let checked=0;
 registerEmployeeHistorySettlementRoutes(app,{checkAuth:(req,res,next)=>{checked++;next();},
  requireUserPrivilegeAction:()=> (req,res,next)=>next(),
  controller:{apply:(_req,res)=>res.status(404).end(),resolve:(_req,res)=>res.status(404).end(),exportXlsx:(_req,res)=>res.status(404).end()},
  approvedProposalController:{preview:(_req,res)=>res.status(404).end(),apply:(_req,res)=>res.status(404).end(),reconcile:(_req,res)=>res.status(404).end()},
  approvedAtomicMaintenanceController:approvedAtomicController});
 const server=app.listen(0,'127.0.0.1');await once(server,'listening');
 try{const url=`http://127.0.0.1:${server.address().port}/api/ergazomenoi/${EXP}/history-approved-maintenance`;
  let result=await fetch(url+'-preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({change})});
  assert.equal(result.status,200);assert.equal((await result.json()).previewOnly,true);
  result=await fetch(url+'-apply',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({change,approval:{token:'signed',confirmed:true}})});
  assert.equal(result.status,200);assert.equal((await result.json()).historyUpdated,true);
  assert.equal(checked,2);assert.deepEqual(s.calls.map(x=>x.method),['preview','apply']);
  assert.equal((await fetch(url+'-apply',{method:'GET'})).status,404);
 }finally{await new Promise(resolve=>server.close(resolve));server.closeAllConnections?.();}
});
