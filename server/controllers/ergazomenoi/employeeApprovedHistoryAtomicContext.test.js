'use strict';

// Stage5F's route is a strictly read-only server-owned context adapter.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createEmployeeApprovedHistoryAtomicMaintenanceController: create } =
    require('./employeeApprovedHistoryAtomicMaintenanceController');
const ID = '650000000000000000000010';
const H = '650000000000000000000011';
const body = () => ({success:true,contextOnly:true,pendingHistory:false,
    targetHistoryId:H,effectiveFrom:'2026-11-23',currentTerms:{
        hmeres_ergasias_ebdomadas:5,typos_ebdomadas:'5HMERH',
        ores_ergasias_ebdomadas:40,mo_oron_hmerhsias_ergasias:8}});
const req = (requestBody = {}) => ({body:requestBody,params:{id:ID},
    session:{userId:ID},sessionID:'synthetic'});
const res = () => ({headers:{},set(k,v){this.headers[k]=v;return this;},
    status(status){this.code=status;return this;},json(data){this.body=data;return this;}});
const mocked = (enabled=true) => {const calls=[];return {calls,isEnabled:()=>enabled,
    preview:async()=>{throw Error('unexpected preview')},
    apply:async()=>{throw Error('unexpected apply')},
    context:async(request)=>{calls.push(request);return body()}};};

test('context returns only scoped read metadata, never write',async()=>{
    const service=mocked(), c=create({service}),r=res();
    await c.context(req(),r);assert.equal(r.code,200);
    assert.deepEqual(r.body,body());assert.equal(service.calls.length,1);
    assert.equal(r.headers['Cache-Control'],'no-store');
});
test('disabled context gate precedes all request and database inspection',async()=>{
    const service=mocked(false),c=create({service}),r=res();
    const request=new Proxy({}, {get(){assert.fail('request accessed while disabled')}});
    await c.context(request,r);assert.equal(r.code,423);
    assert.equal(r.body.saved,false);assert.equal(service.calls.length,0);
});
test('context rejects arbitrary client-supplied scope, history and approval',async()=>{
    const service=mocked(),c=create({service});
    for(const injected of [{scope:{team:'THA'}},{history:[{}]},{approval:'forged'},
        {change:{kind:'NEW_CHANGE'}},[],null]) {
        const r=res();await c.context(req(injected),r);assert.equal(r.code,400);
        assert.equal(r.body.saved,false);
    }
    assert.equal(service.calls.length,0);
});
test('no session or invalid employee ID cannot query context',async()=>{
    const service=mocked(),c=create({service});
    let r=res(),q=req();q.session=null;await c.context(q,r);assert.equal(r.code,401);
    r=res();q=req();q.params.id='not-an-id';await c.context(q,r);assert.equal(r.code,400);
    assert.equal(service.calls.length,0);
});
test('context known authorization refusal is opaque to browser',async()=>{
    const service=mocked();service.context=async()=>{throw Object.assign(Error('secret'),
        {code:'EMPLOYEE_APPROVED_ATOMIC_SCOPE',statusCode:403})};
    const r=res();await create({service}).context(req(),r);assert.equal(r.code,403);
    assert.equal(r.body.saved,false);assert.doesNotMatch(JSON.stringify(r.body),/secret/);
});
test('context unexpected read error is rejected, never an ambiguous commit',async()=>{
    const service=mocked();service.context=async()=>{throw Error('read broke')};
    const r=res();await create({service}).context(req(),r);assert.equal(r.code,503);
    assert.equal(r.body.saved,false);assert.equal(r.body.outcome,'REJECTED');
});

test('shared route registers context once; requires POST and authentication',async()=>{
    const express=require('express');const {once}=require('node:events');
    const {registerEmployeeHistorySettlementRoutes}=require('../../routes/employeeHistorySettlementRoutes');
    const service=mocked(),controller=create({service});
    const app=express();app.use(express.json());app.use((request,response,next)=>{
        request.session={userId:ID};request.sessionID='synthetic';next();});
    let checks=0;
    registerEmployeeHistorySettlementRoutes(app,{
        checkAuth:(request,response,next)=>{checks++;next()},
        requireUserPrivilegeAction:()=> (request,response,next)=>next(),
        approvedAtomicMaintenanceController:controller,
        controller:{apply:(req,res)=>res.status(404).end(),resolve:(req,res)=>res.status(404).end(),
            exportXlsx:(req,res)=>res.status(404).end()},
        approvedProposalController:{preview:(req,res)=>res.status(404).end(),
            apply:(req,res)=>res.status(404).end(),reconcile:(req,res)=>res.status(404).end()}
    });
    const server=app.listen(0,'127.0.0.1');await once(server,'listening');
    try {
        const path=`http://127.0.0.1:${server.address().port}/api/ergazomenoi/${ID}/history-approved-maintenance-context`;
        let r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
        assert.equal(r.status,200);assert.deepEqual(await r.json(),body());
        r=await fetch(path,{method:'GET'});assert.equal(r.status,404);
        assert.equal(checks,1);assert.equal(service.calls.length,1);
    } finally {await new Promise(resolve=>server.close(resolve));server.closeAllConnections?.()}
});
