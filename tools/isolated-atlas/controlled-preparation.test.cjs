'use strict';
const {test,before,after,mock}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {EventEmitter}=require('node:events');
const {buildCaseB}=require('./history-case-b.cjs');
const seedTool=require('./seed-history-case-b.cjs');
const {verifyClient}=require('../../server/config/isolatedTestRuntime');
const {forbidRealSettlementMongo}=require('../../test/fixtures/forbidRealSettlementMongo');
const bcrypt=require('bcrypt');
const password='SYNTHETIC-OFFLINE-ONLY',hash=bcrypt.hashSync(password,4);
const data=()=>buildCaseB({passwordHash:hash});
before(()=>forbidRealSettlementMongo(mock));after(()=>mock.restoreAll());
function fakeClient({database='payroll_test_isolated',user='payroll_dev_test'}={}) {
    const documents=new Map(),indexes=[];let audit=false;const events=[];
    const rows=name=>documents.get(name)||[];
    const db={databaseName:database,async command(){events.push('preflight');return{authInfo:{
        authenticatedUsers:[{user,db:'admin'}],authenticatedUserRoles:[{role:'readWrite',db:'payroll_test_isolated'}],
        authenticatedUserPrivileges:[{resource:{db:'payroll_test_isolated',collection:''},actions:['find','insert','update']}]}};},
        listCollections(){return{async hasNext(){return audit;}};},
        async createCollection(name){events.push('createCollection');audit=true;},
        collection(name){return{async countDocuments(){return rows(name).length;},
            async findOne(filter){return rows(name).find(row=>String(row._id)===String(filter._id))||null;},
            listIndexes(){return{async toArray(){return indexes;}};},
            async createIndex(key,options){events.push('createIndex');indexes.push({key,name:options.name});},
            async insertOne(doc){events.push('insert');documents.set(name,[...rows(name),doc]);}};}};
    return {db:()=>db,options:{credentials:{username:user}},documents,events};
}
test('canonical bundle admits one selected variant and rejects real identities or modified evidence',()=>{
    const bundle={preparationOnly:true,historyExecutionEnabled:false,syntheticLoginPassword:password,
        cases:[data(),buildCaseB({passwordHash:hash,initialGap:false})]};
    assert.equal(seedTool.validateBundle(bundle).variant,'acceptanceBWithInitialGap');
    const EJSON=require('mongoose').mongo.BSON.EJSON;
    const altered=EJSON.parse(EJSON.stringify(bundle,{relaxed:false}),{relaxed:true});
    altered.cases[0].collections.Ergazomenoi[0].afm='NOT_A_REAL_TAX_ID';
    assert.throws(()=>seedTool.validateBundle(altered));
    assert.throws(()=>seedTool.validateBundle({...bundle,historyExecutionEnabled:true}));
});
test('seed performs guarded inserts and audit setup only, with preflight before every write',async()=>{
    const selected=data(),client=fakeClient();let checks=0;
    const result=await seedTool.seed({client,data:selected,fingerprint:'fixture',reload:()=>{checks++;return{data:selected,fingerprint:'fixture'};}});
    const writes=client.events.filter(event=>event!=='preflight').length;
    assert.equal(result.writesConfirmed,12);assert.equal(writes,12);
    assert.ok(checks>writes);assert.equal(client.events.filter(event=>event==='preflight').length,checks);
    assert.equal(result.historyExecutionEnabled,false);
    assert.equal(client.documents.get('Istoriko_Proslhpseon_Allagon').length,3);
});
for(const target of [{database:'payrollDB'},{user:'payroll_app_prod'},{user:'payroll_migration_user'}])
test(`seed rejects wrong target ${JSON.stringify(target)} before any writes`,async()=>{
    const client=fakeClient(target),selected=data();
    await assert.rejects(seedTool.seed({client,data:selected,fingerprint:'fixture',reload:()=>({data:selected,fingerprint:'fixture'})}));
    assert.equal(client.events.filter(event=>event!=='preflight').length,0);
});
test('seed rejects an existing document or stale file fingerprint without modifying anything',async()=>{
    const selected=data();
    for(const conflict of ['existing','stale']){
        const client=fakeClient();if(conflict==='existing')client.documents.set('Companies',[{_id:'unrelated'}]);
        await assert.rejects(seedTool.seed({client,data:selected,fingerprint:'fixture',reload:()=>({data:selected,fingerprint:conflict==='stale'?'changed':'fixture'})}));
        assert.equal(client.events.filter(event=>event!=='preflight').length,0);
    }
});

function policyHarness({clientOptions={},patch={},employeePatch={},execute=false}={}) {
    const module={exports:{}},real=require('../../server/services/ergazomenoi/employeeHistorySettlementIsolatedTestPolicy');
    const server=new EventEmitter();server.listening=true;server.address=()=>({address:'127.0.0.1',port:5025});
    const selected=data(),connection={name:'payroll_test_isolated',db:{databaseName:'payroll_test_isolated'},getClient:()=>clients[0]};
    const clients=[fakeClient(clientOptions),fakeClient()];
    const query=value=>({async lean(){return value;}});
    const employee={...selected.collections.Ergazomenoi[0],...employeePatch};
    const models={employee:{db:connection,findOne:()=>query(employee)},history:{db:connection},
        company:{db:connection,findOne:()=>query(selected.collections.Companies[0])},
        user:{db:connection,findById:()=>query(selected.collections.users[0])},privilege:{db:connection},audit:{db:connection}};
    const processMock={argv:['node',path.join(real.ROOT,'tools/isolated-atlas/start.cjs'),execute?real.EXECUTE_FLAG:real.FLAG],
        cwd:()=>real.ROOT,env:{NODE_ENV:'development'}};
    Object.assign(processMock,patch);
    const context={module,exports:module.exports,process:processMock,require(name){
        if(name==='node:fs')return{realpathSync:value=>value};
        if(name==='node:path')return path;
        if(name.includes('isolatedTestRuntime'))return{verifiedClients:()=>clients,verifyClient,automaticTasksEnabled:()=>false};
        if(name==='mongoose')return{connection};
        if(name==='../../models/ergazomenoi')return{ErgazomenoiModel:models.employee,IstorikoProslhpseonAllagonModel:models.history};
        if(name==='../../models/companies')return{CompaniesModel:models.company};
        if(name==='../../models/userModel')return models.user;
        if(name==='../../models/privileges')return{UserPrivilegesModel:models.privilege};
        if(name==='../../models/employeeHistoryRepairAudit')return models.audit;
        if(name==='./employeeHistoryReferenceAuditService')return{findHistoryIdReferences:async()=>[]};
        if(name==='./employeeEmploymentProfileWriter')return{transactionCapability:async()=>true};
        if(name==='./employeeHistoryRepairAuditSetupService')return{employeeHistoryRepairAuditCollectionExists:async()=>true};
        throw Error('Unexpected dependency');
    }};
    vm.runInNewContext(fs.readFileSync(path.join(real.ROOT,'server/services/ergazomenoi/employeeHistorySettlementIsolatedTestPolicy.js'),'utf8'),context);
    const req={session:selected.sessionTemplate,params:{id:selected.employeeId},socket:{server,localPort:5025}};
    return{policy:module.exports,server,root:real.ROOT,req,models,clients,employee};
}
test('TEST policy requires the exact invocation and two real-configuration clients; writes stay closed',async()=>{
    const h=policyHarness();assert.equal(await h.policy.initialize({server:h.server,appRoot:h.root}),true);
    const handle=h.policy.getReadHandle(h.req);assert.ok(handle);
    const context=h.policy.contextFor(handle);assert.equal(context.executionEnabled,false);
    await context.assertRequest(h.req);assert.equal(h.policy.getApplyHandle(h.req),null);
    assert.equal(h.policy.getReadHandle({...h.req,params:{id:'unrelated'}}),null);
    assert.equal(h.policy.getReadHandle({...h.req,socket:{server:{},localPort:5025}}),null);
    const registry=require('../../server/services/ergazomenoi/employeeHistorySettlementDevActivation');
    mock.method(registry,'settlementContext',()=>context);
    await assert.rejects(require('../../server/services/ergazomenoi/employeeEmploymentProfileWriter')
        .applyEmployeeEmploymentHistorySettlementInSyntheticStore({syntheticStore:handle}),{statusCode:423});
    mock.restoreAll();forbidRealSettlementMongo(mock);
    h.employee.afm='NOT_A_REAL_TAX_ID';await assert.rejects(context.assertRequest(h.req));
    h.server.emit('close');assert.equal(h.policy.getReadHandle(h.req),null);
});
test('policy rejects wrong roots, ports, CI, production, flags, accounts and real-person-shaped records',async()=>{
    const exported=require('../../server/services/ergazomenoi/employeeHistorySettlementIsolatedTestPolicy');
    const valid={root:exported.ROOT,cwd:exported.ROOT,entry:path.join(exported.ROOT,'tools/isolated-atlas/start.cjs'),
        environment:'development',ci:false,host:'127.0.0.1',port:5025,argv:['node','start.cjs',exported.FLAG]};
    assert.equal(exported.eligible(valid),true);
    for(const patch of [{root:'/tmp/other'},{cwd:'/tmp/other'},{port:5000},{port:5015},{host:'0.0.0.0'},
        {ci:true},{environment:'production'},{argv:['node','start.cjs']},{argv:[...valid.argv,exported.FLAG]}])
        assert.equal(exported.eligible({...valid,...patch}),false);
    for(const options of [{clientOptions:{database:'payrollDB'}},{clientOptions:{user:'payroll_app_prod'}},
        {employeePatch:{onoma:'NOT_TEST'}},{employeePatch:{amka:'NOT_A_REAL_ID'}}]){
        const h=policyHarness(options);await assert.rejects(h.policy.initialize({server:h.server,appRoot:h.root}));
        assert.equal(h.policy.getReadHandle(h.req),null);
    }
});
test('seed invocation never accepts a wrong worktree, production or CI',()=>{
    const {ROOT}=require('../../server/services/ergazomenoi/employeeHistorySettlementIsolatedTestPolicy');
    const base={root:ROOT,cwd:ROOT,ci:false,environment:'development'};
    assert.equal(seedTool.invocationAllowed(base),true);
    for(const change of [{root:'/tmp/other'},{cwd:'/tmp/other'},{ci:true},{environment:'production'}])
        assert.equal(seedTool.invocationAllowed({...base,...change}),false);
});
test('explicit execution is consumed once only after an approved fingerprint; preview mode stays closed',async()=>{
    const h=policyHarness({execute:true});await h.policy.initialize({server:h.server,appRoot:h.root});
    const handle=h.policy.getApplyHandle(h.req),context=h.policy.contextFor(handle);assert.ok(handle);
    const args={scope:data().scope,actorUserId:data().actorId,employeeId:data().employeeId,fingerprint:'a'.repeat(43),approvedFingerprint:'b'.repeat(43)};
    await assert.rejects(context.claimExecution(args));assert.equal(context.executionEnabled,true);
    args.approvedFingerprint=args.fingerprint;
    const results=await Promise.allSettled([context.claimExecution(args),context.claimExecution(args)]);
    assert.equal(results.filter(result=>result.status==='fulfilled').length,1);
    assert.equal(context.executionEnabled,false);assert.equal(h.policy.getApplyHandle(h.req),null);
    assert.ok(h.policy.getReadHandle(h.req));
});
