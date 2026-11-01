'use strict';
const {test,before,after,mock}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const mongoose=require('mongoose');
const URI='mongodb://127.0.0.1:27249/payroll_history_pilot_test?replicaSet=payrollPilotTest';
const R=require('../../server/services/ergazomenoi/employeeHistoryPilotRecoveryService');
const G=require('../../server/services/ergazomenoi/employeeHistoryPilotGate');
const A=require('../../server/services/ergazomenoi/employeeHistoryAutomaticReconstructionApplyContract');
const S=require('../../server/services/ergazomenoi/employeeHistoryAutomaticSettlementPreparationContract');
const U=require('../../server/services/ergazomenoi/employeeHistoryCoordinatedSettlementContract');
const P=require('../../server/services/ergazomenoi/employeeHistorySettlementDevActivation');
const W=require('../../server/services/ergazomenoi/employeeEmploymentProfileWriter');
const {ErgazomenoiModel:E,IstorikoProslhpseonAllagonModel:H}=require('../../server/models/ergazomenoi');
const Audit=require('../../server/models/employeeHistoryRepairAudit');
const User=require('../../server/models/userModel');
const Priv=require('../../server/models/privileges').UserPrivilegesModel;
const Company=require('../../server/models/companies').CompaniesModel;
const {SUPPORTED_COLLECTIONS,employeeHistoryReferenceQueryPaths}=require('../../server/services/ergazomenoi/employeeHistoryReferenceDefinitionsService');
const contexts=new WeakMap();
let directory;
before(async()=>{
    assert.equal(process.env.PAYROLL_PILOT_TEST_MONGO_URI,URI,'Explicit disposable local test URI required; never load application .env');
    assert.equal(mongoose.connection.readyState,0);
    await mongoose.connect(URI,{autoCreate:false,autoIndex:false,serverSelectionTimeoutMS:5000});
    const hello=await mongoose.connection.db.admin().command({hello:1});
    assert.equal(hello.setName,'payrollPilotTest');assert.deepEqual(hello.hosts,['127.0.0.1:27249']);
    assert.equal(mongoose.connection.db.databaseName,'payroll_history_pilot_test');
    for(const model of [E,H,Audit,User,Priv,Company])await model.createCollection();
    for(const name of SUPPORTED_COLLECTIONS)if(!await mongoose.connection.db.listCollections({name}).hasNext())await mongoose.connection.db.createCollection(name);
    directory=fs.mkdtempSync(path.join(os.tmpdir(),'payroll-pilot-safety-'));fs.chmodSync(directory,0o700);
    const original=P.settlementContext;
    mock.method(P,'settlementContext',handle=>contexts.get(handle)||original(handle));
});
after(async()=>{mock.restoreAll();await mongoose.disconnect();});
function nested(field,value){const root={};let target=root;const parts=field.split('.');for(const key of parts.slice(0,-1))target=target[key]={};target[parts.at(-1)]=value;return root;}
async function setup({factual=false}={}){
    let input=require('../fixtures/employeeHistoryCoordinatedSettlementFixture').acceptanceBWithInitialGap();
    if(factual){const F=require('../../server/services/ergazomenoi/fixtures/unifiedEmployeeHistorySettlementFixtures');input=require('../fixtures/employeeHistoryCoordinatedSettlementFixture').typedFixture(F.references(F.input([F.period(1,{pay:1100}),F.period(2,{pay:1300})])));}
    const scope={...input.scope,company_kod:String(new mongoose.Types.ObjectId())};
    const employeeId=String(new mongoose.Types.ObjectId()),actorUserId=String(new mongoose.Types.ObjectId());
    const ids=new Map(input.completeHistoryRows.map(row=>[String(row._id),new mongoose.Types.ObjectId()]));
    const employee={...input.currentEmployee,...scope,_id:new mongoose.Types.ObjectId(employeeId)};
    const rows=input.completeHistoryRows.map(row=>({...row,...scope,_id:ids.get(String(row._id))}));
    await E.collection.insertOne(employee);await H.collection.insertMany(rows);
    await Company.collection.insertOne({_id:new mongoose.Types.ObjectId(scope.company_kod),team:scope.team});
    await User.collection.insertOne({_id:new mongoose.Types.ObjectId(actorUserId),privileges:'A',situation:'A',team:'THA'});
    await Priv.collection.insertOne({userId:actorUserId,form:'Ergazomenoi',privileges:{update:true}});
    for(const name of SUPPORTED_COLLECTIONS)for(let i=0;i<2;i++)await mongoose.connection.collection(name).insertOne({
        _id:new mongoose.Types.ObjectId(),...scope,...nested(employeeHistoryReferenceQueryPaths(name)[0],rows[0]._id),
        frozenPayload:{amount:123.45,typed:mongoose.mongo.BSON.Decimal128.fromString('12.340'),when:new Date('2026-01-01')}});
    const deps={connection:mongoose.connection,employeeModel:E,historyModel:H,auditModel:Audit,userModel:User,privilegeModel:Priv,companyModel:Company,
        capabilityProbe:W.transactionCapability,auditCollectionChecker:require('../../server/services/ergazomenoi/employeeHistoryRepairAuditSetupService').employeeHistoryRepairAuditCollectionExists,
        referenceChecker:require('../../server/services/ergazomenoi/employeeHistoryReferenceAuditService').findHistoryIdReferences};
    const referenceSummary=async(rows,session)=>{const out={};for(const row of rows)out[String(row._id)]=await deps.referenceChecker({connection:deps.connection,historyIds:[String(row._id)],session});return out;};
    const before=await R.capture({deps,scope,employeeId});
    const base={scope,employeeId,actorUserId,currentEmployee:before.employee,completeHistoryRows:before.history,protectedReferenceSummary:await referenceSummary(before.history)};
    let businessDecision;
    if(factual){const coordinate=require('../../server/services/ergazomenoi/employeeHistorySettlementCoordinatorService').coordinateEmployeeHistorySettlement,pending=coordinate(base);businessDecision=pending.decisions[0].options.map(option=>({snapshotFingerprint:pending.snapshotFingerprint,selections:{cycle_1:{choiceId:option.id}}})).find(decision=>coordinate({...base,businessDecision:decision}).currentPatch.synolo_symbashs===1100);assert.ok(businessDecision);}
    const proposal=U.buildCoordinatedSettlementProposal({...base,...(businessDecision?{businessDecision}:{})});
    assert.equal(proposal.status,'CLEAN');assert.equal(proposal.noOp,false);
    const fingerprint=S.buildEmployeeHistorySettlementApprovalFingerprint({scope,employeeId,actorUserId,currentEmployee:before.employee,
        completeHistoryRows:before.history,protectedReferenceSummary:await referenceSummary(before.history),proposal,...(businessDecision?{businessDecision}:{})});
    const backup=await R.prepareBackup({deps,scope,employeeId,actorUserId,outputDirectory:directory,appRoot:process.cwd(),...(businessDecision?{businessDecision}:{})});
    const grant={version:1,root:process.cwd(),identity:R.databaseIdentity(deps.connection),scope,employeeId,actorUserId,fingerprint,
        backupFile:backup.file,backupSha256:backup.sha256};
    const grantFile=path.join(directory,new mongoose.Types.ObjectId()+'.json');fs.writeFileSync(grantFile,JSON.stringify(grant),{mode:0o600});
    const gate=G.createGate({grantFile,deps,root:process.cwd(),ledgerDirectory:directory});
    const context={mode:'CONTROLLED_DEV',deps,pilot:gate,get executionEnabled(){return gate.available();},assertRequest:gate.assertRequest,
        claimExecution:gate.claimExecution,assertPilotTransaction:gate.assertTransaction,pilotAuditEvidence:gate.auditEvidence,referenceSummary,
        readAudits:session=>Audit.find({'employeeScope.employee_id':employee._id}).session(session||null).sort({_id:1}).lean()};
    const handle={};contexts.set(handle,context);
    const args={syntheticStore:handle,scope,employeeId,actorUserId,approval:{confirmed:true,fingerprint},coordinated:true,...(businessDecision?{businessDecision}:{})};
    return {deps,scope,employeeId,actorUserId,before,backup,grant,grantFile,gate,context,args,rows,
        run:()=>W.applyEmployeeEmploymentHistorySettlementInSyntheticStore(args),
        audit:()=>Audit.collection.findOne({'employeeScope.employee_id':employee._id,mutationSource:'EMPLOYEE_HISTORY_SETTLEMENT'}),
        state:()=>R.capture({deps,scope,employeeId})};
}
test('real MongoDB: exact protected backup includes two full references in every known collection',async()=>{
    const h=await setup(),b=R.readBackup(h.backup.file,h.backup.sha256,process.cwd());
    assert.ok(R.sameSnapshot(b,h.before));for(const name of SUPPORTED_COLLECTIONS)assert.equal(b.references[name].length,2);
    assert.equal(fs.statSync(h.backup.file).mode&0o777,0o600);
    assert.throws(()=>R.readBackup(h.backup.file,'0'.repeat(64),process.cwd()));
});
test('one successful transaction; second, renamed manifest and fresh-process gate remain closed',async()=>{
    const h=await setup();assert.equal((await h.run()).applied,true);const after=await h.state();
    assert.deepEqual(after.references,h.before.references);assert.equal(h.gate.available(),false);
    await assert.rejects(h.run,{statusCode:423});
    const copied=path.join(directory,new mongoose.Types.ObjectId()+'.json');fs.copyFileSync(h.grantFile,copied);fs.chmodSync(copied,0o600);
    assert.equal(G.createGate({grantFile:copied,deps:h.deps,root:process.cwd(),ledgerDirectory:directory}).available(),false);
    const {spawnSync}=require('node:child_process');
    const child=spawnSync(process.execPath,['-e',`const fs=require('fs');const g=JSON.parse(fs.readFileSync(process.argv[1]));const G=require('./server/services/ergazomenoi/employeeHistoryPilotGate');const connection={db:{databaseName:g.identity.database},getClient:()=>({options:{hosts:g.identity.hosts,replicaSet:g.identity.replicaSet,srvHost:g.identity.srvHost}})};if(G.createGate({grantFile:process.argv[1],deps:{connection},root:process.cwd(),ledgerDirectory:process.argv[2]}).available())process.exit(9);`,copied,directory],{cwd:process.cwd(),encoding:'utf8'});
    assert.equal(child.status,0,child.stderr);assert.ok(R.sameSnapshot(after,await h.state()));
});
test('simultaneous approvals produce exactly one application and one audit',async()=>{
    const h=await setup();const results=await Promise.allSettled([h.run(),h.run()]);
    assert.equal(results.filter(r=>r.status==='fulfilled'&&r.value.applied).length,1);
    assert.equal(await Audit.countDocuments({'employeeScope.employee_id':new mongoose.Types.ObjectId(h.employeeId)}),1);
    assert.equal(h.gate.available(),false);
});
test('rollback after real writes consumes grant permanently and restores every Mongo document',async()=>{
    const h=await setup(),original=Audit.create.bind(Audit);
    const m=mock.method(Audit,'create',async(...args)=>{await original(...args);throw Error('PILOT_TEST_AFTER_REAL_AUDIT_WRITE');});
    try{await assert.rejects(h.run,/PILOT_TEST_AFTER_REAL_AUDIT_WRITE/);}finally{m.mock.restore();}
    assert.ok(R.sameSnapshot(h.before,await h.state()));assert.equal(await h.audit(),null);
    assert.equal(h.gate.available(),false);await assert.rejects(h.run,{statusCode:423});
});
test('COMMIT_UNCERTAIN never permits a second write after lost real commit acknowledgement',async()=>{
    const h=await setup(),original=mongoose.connection.startSession.bind(mongoose.connection);
    const m=mock.method(mongoose.connection,'startSession',async(...args)=>{const s=await original(...args),run=s.withTransaction.bind(s);
        s.withTransaction=async(...values)=>{await run(...values);const e=Error('LOST_ACK_AFTER_COMMIT');e.errorLabels=['UnknownTransactionCommitResult'];throw e;};return s;});
    try{await assert.rejects(h.run,e=>e.code?.endsWith('COMMIT_UNCERTAIN'));}finally{m.mock.restore();}
    assert.ok(await h.audit());const after=await h.state();await assert.rejects(h.run,{statusCode:423});
    const reconciled=await R.reconcile({context:h.context,actorUserId:h.actorUserId});
    assert.equal(reconciled.outcome,'COMMITTED');assert.equal(reconciled.historyStatus,'CLEAN');assert.equal(reconciled.noOp,true);
    assert.ok(R.sameSnapshot(after,await h.state()));
});
test('undo restores only pilot changes, preserves a newer independent note and the original audit',async()=>{
    const h=await setup();await h.run();const audit=await h.audit(),appliedState=await h.state();
    const unchanged=h.before.history.filter(row=>appliedState.history.some(item=>A.equal(row,item)));
    await E.collection.updateOne({_id:new mongoose.Types.ObjectId(h.employeeId)},{$set:{parathrhseis:'Νεότερη ανεξάρτητη σημείωση'}});
    assert.equal((await R.undo({context:h.context,actorUserId:h.actorUserId,auditId:String(audit._id),confirmed:true})).undone,true);
    const final=await h.state();assert.equal(final.employee.parathrhseis,'Νεότερη ανεξάρτητη σημείωση');
    assert.equal(final.history.length,h.before.history.length);assert.deepEqual(final.references,h.before.references);
    for(const row of unchanged)assert.deepEqual(final.history.find(item=>String(item._id)===String(row._id)),row);
    assert.deepEqual(await h.audit(),audit);
    assert.equal(await Audit.countDocuments({mutationSource:'EMPLOYEE_HISTORY_SETTLEMENT_PILOT_UNDO','diagnostics.originalAuditId':audit._id}),1);
    await assert.rejects(()=>R.undo({context:h.context,actorUserId:h.actorUserId,auditId:String(audit._id),confirmed:true}));
});
test('new reference to a pilot-created period blocks undo without changing anything',async()=>{
    const h=await setup();await h.run();const audit=await h.audit(),state=await h.state();
    const created=state.history.find(row=>!h.before.history.some(old=>String(old._id)===String(row._id)));
    await mongoose.connection.collection(SUPPORTED_COLLECTIONS[0]).insertOne({_id:new mongoose.Types.ObjectId(),...h.scope,
        ...nested(employeeHistoryReferenceQueryPaths(SUPPORTED_COLLECTIONS[0])[0],created._id)});
    const before=await h.state();await assert.rejects(()=>R.undo({context:h.context,actorUserId:h.actorUserId,auditId:String(audit._id),confirmed:true}),/PILOT_NEWER_DEPENDENCY/);
    assert.ok(R.sameSnapshot(before,await h.state()));assert.deepEqual(await h.audit(),audit);
});
test('wrong actor, company, team, employee and fingerprint fail before consuming the grant',async()=>{
    const h=await setup();for(const patch of [{actorUserId:'a'.repeat(24)},{employeeId:'b'.repeat(24)},
        {scope:{...h.scope,company_kod:'c'.repeat(24)}},{scope:{...h.scope,team:'OTHER'}},{fingerprint:'x'.repeat(43)}]){
        await assert.rejects(()=>h.gate.claimExecution({scope:h.scope,employeeId:h.employeeId,actorUserId:h.actorUserId,fingerprint:h.grant.fingerprint,...patch}));
    }assert.equal(h.gate.available(),true);assert.ok(R.sameSnapshot(h.before,await h.state()));
});
test('default real registered HTTP endpoint stays 423 with forged activation',async()=>{
    const express=require('express'),{once}=require('node:events');const app=express();app.use(express.json());
    app.use((req,res,next)=>{req.session={userId:'synthetic'};next();});
    require('../../server/routes/employeeHistorySettlementRoutes').registerEmployeeHistorySettlementRoutes(app,{checkAuth:(req,res,next)=>next(),
        requireUserPrivilegeAction:()=>()=>assert.fail('No database-backed rights lookup while closed')});
    const server=app.listen(0,'127.0.0.1');await once(server,'listening');try{
        const response=await fetch(`http://127.0.0.1:${server.address().port}/api/ergazomenoi/${'a'.repeat(24)}/history-automatic-settlement-apply`,{
            method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({executionEnabled:true,pilot:true})});
        assert.equal(response.status,423);assert.equal((await response.json()).executionEnabled,false);
    }finally{await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});}
});
test('new business fact or revoked authorization blocks undo and preserves every document',async()=>{
    for(const change of ['business','role','permission','actor']){
        const h=await setup();await h.run();const audit=await h.audit();
        if(change==='business')await E.collection.updateOne({_id:new mongoose.Types.ObjectId(h.employeeId)},{$set:{synolo_symbashs:9999}});
        if(change==='role')await User.collection.updateOne({_id:new mongoose.Types.ObjectId(h.actorUserId)},{$set:{privileges:'S'}});
        if(change==='permission')await Priv.collection.updateOne({userId:h.actorUserId},{$set:{'privileges.update':false}});
        const before=await h.state();await assert.rejects(()=>R.undo({context:h.context,actorUserId:change==='actor'?'a'.repeat(24):h.actorUserId,auditId:String(audit._id),confirmed:true}));
        assert.ok(R.sameSnapshot(before,await h.state()));assert.deepEqual(await h.audit(),audit);
    }
});
test('undo audit failure rolls back every inverse write and never reopens either permit',async()=>{
    const h=await setup();await h.run();const audit=await h.audit(),before=await h.state();
    const collection=mongoose.connection.collection('Employee_History_Repair_Audit'),original=collection.insertOne.bind(collection);
    const m=mock.method(collection,'insertOne',async(...args)=>{const result=await original(...args);if(args[0].mutationSource==='EMPLOYEE_HISTORY_SETTLEMENT_PILOT_UNDO')throw Error('UNDO_AUDIT_FAILURE');return result;});
    try{await assert.rejects(()=>R.undo({context:h.context,actorUserId:h.actorUserId,auditId:String(audit._id),confirmed:true}),/UNDO_AUDIT_FAILURE/);}finally{m.mock.restore();}
    assert.ok(R.sameSnapshot(before,await h.state()));assert.deepEqual(await h.audit(),audit);assert.equal(h.gate.available(),false);
    await assert.rejects(()=>R.undo({context:h.context,actorUserId:h.actorUserId,auditId:String(audit._id),confirmed:true}));
});
test('stale backup or wrong preview fingerprint cannot consume an unused grant',async()=>{
    const h=await setup();await E.collection.updateOne({_id:new mongoose.Types.ObjectId(h.employeeId)},{$set:{parathrhseis:'Changed before claim'}});
    const session=await mongoose.connection.startSession();
    try{await assert.rejects(()=>session.withTransaction(()=>h.gate.claimExecution({scope:h.scope,employeeId:h.employeeId,actorUserId:h.actorUserId,fingerprint:h.grant.fingerprint,session})),/PILOT_BACKUP_STALE/);}
    finally{await session.endSession();}assert.equal(h.gate.available(),true);
});
test('grant and backup with broad permissions or symbolic links are rejected',async()=>{
    const h=await setup(),mode=fs.statSync(h.grantFile).mode;
    fs.chmodSync(h.grantFile,0o644);assert.throws(()=>G.createGate({grantFile:h.grantFile,deps:h.deps,root:process.cwd(),ledgerDirectory:directory}));fs.chmodSync(h.grantFile,mode&0o777);
    const link=path.join(directory,'symlink-'+new mongoose.Types.ObjectId());fs.symlinkSync(h.grantFile,link);
    assert.throws(()=>G.createGate({grantFile:link,deps:h.deps,root:process.cwd(),ledgerDirectory:directory}));
    assert.equal(h.gate.available(),true);
});
test('real HTTP pilot handler commits once then returns HTTP 423; wrong identity is rejected',async()=>{
    const h=await setup(),express=require('express'),{once}=require('node:events');
    const {createEmployeeHistorySettlementHttpController:create}=require('../../server/controllers/ergazomenoi/employeeHistorySettlementHttpController');
    const controller=create({contextProvider:()=>h.args.syntheticStore,applyContextProvider:()=>h.args.syntheticStore});
    const app=express();app.use(express.json());const identity={userId:h.actorUserId,userTeam:h.scope.team,companyInUse:h.scope.company_kod};
    app.use((req,res,next)=>{req.session=identity;next();});
    app.post('/api/ergazomenoi/:id/apply',controller.apply);const server=app.listen(0,'127.0.0.1');await once(server,'listening');
    const url=`http://127.0.0.1:${server.address().port}/api/ergazomenoi/${h.employeeId}/apply`;
    const apply=()=>fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({approval:h.args.approval})});
    try{
        identity.userId='a'.repeat(24);assert.equal((await apply()).status,423);identity.userId=h.actorUserId;assert.equal(h.gate.available(),true);
        const first=await apply();assert.equal(first.status,200,JSON.stringify(await first.clone().json()));assert.equal((await first.json()).historyStatus,'CLEAN');
        const second=await apply();assert.equal(second.status,423);assert.equal(h.gate.available(),false);
        assert.equal((await R.reconcile({context:h.context,actorUserId:h.actorUserId})).noOp,true);
    }finally{await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});}
});
test('undo reverses an approved current-employment change as well as history in one transaction',async()=>{
    const h=await setup({factual:true});await h.run();const audit=await h.audit(),applied=await h.state();
    assert.equal(applied.employee.synolo_symbashs,1100);assert.notEqual(applied.employee.synolo_symbashs,h.before.employee.synolo_symbashs);
    await E.collection.updateOne({_id:new mongoose.Types.ObjectId(h.employeeId)},{$set:{parathrhseis:'Independent after business correction'}});
    await R.undo({context:h.context,actorUserId:h.actorUserId,auditId:String(audit._id),confirmed:true});
    const final=await h.state();assert.equal(final.employee.synolo_symbashs,h.before.employee.synolo_symbashs);
    assert.equal(final.employee.parathrhseis,'Independent after business correction');assert.deepEqual(final.references,h.before.references);
    assert.equal(final.employee.employee_profile_mutation_sequence,2);
});
test('simultaneous inverse operations produce one undo audit and leave another employee untouched',async()=>{
    const h=await setup(),neighbor=await setup(),neighborBefore=await neighbor.state();await h.run();const audit=await h.audit();
    const args={context:h.context,actorUserId:h.actorUserId,auditId:String(audit._id),confirmed:true};
    const results=await Promise.allSettled([R.undo(args),R.undo(args)]);
    assert.equal(results.filter(r=>r.status==='fulfilled'&&r.value.undone).length,1);
    assert.equal(await Audit.countDocuments({mutationSource:'EMPLOYEE_HISTORY_SETTLEMENT_PILOT_UNDO','diagnostics.originalAuditId':audit._id}),1);
    assert.ok(R.sameSnapshot(neighborBefore,await neighbor.state()));
});
test('offline operations reject this independent worktree and production before any connection',()=>{
    const tool=require('../../tools/history-pilot/operations.cjs'),original=process.env.NODE_ENV;
    try{process.env.NODE_ENV='production';assert.throws(tool.assertInvocation,/ENVIRONMENT_REJECTED/);
        process.env.NODE_ENV='development';assert.throws(tool.assertInvocation,/ENVIRONMENT_REJECTED/);
    }finally{if(original===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=original;}
});
