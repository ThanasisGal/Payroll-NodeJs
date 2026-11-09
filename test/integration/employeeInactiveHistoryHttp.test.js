'use strict';
const {test,before,after,mock}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),express=require('express'),{once}=require('node:events');
const W=require('../../server/services/ergazomenoi/employeeEmploymentProfileWriter');
const M=require('../../server/utils/ergazomenoi/employmentProfileMaintenance'),A=require('../../server/services/ergazomenoi/employeeHistoryAuthorizationService');
const S=require('../../server/services/ergazomenoi/employeeHistoryEditorStateService');
const {employeeActiveHistoryFixture:fixture}=require('../fixtures/employeeActiveHistoryFixture');
const {store}=require('../fixtures/employeeProfileTransactionStore'),{userModel}=require('../fixtures/employeeHistorySupervisor');
const {clone}=require('../../server/services/ergazomenoi/employeeHistoryAutomaticSettlementPreparationContract');
before(()=>require('../fixtures/forbidRealSettlementMongo').forbidRealSettlementMongo(mock));after(()=>mock.restoreAll());
test('actual HTTP history controller confirms proven retirement atomically, reloads CLEAN and rejects a stale repeat',async()=>{
 const f=fixture(),duplicate={...clone(f.history[0]),_id:'507f1f77bcf86cd799439102',aa_eggrafhs:'0002',createdAt:new Date('2025-01-01')};f.history.push(duplicate);
 const db=store([f],{cloneFn:clone}),admin={privileges:'A',team:'THA',situation:'A'},source=fs.readFileSync(require.resolve('../../server/controllers/ergazomenoi/ergazomenoiController'),'utf8');
 const start=source.indexOf('static updateIstorikoData = '),end=source.indexOf('    static searchPostErgazomenoi',start);
 const method=source.slice(start,end).trim().replace('static updateIstorikoData = ','').replace(/;$/,'');
 const handler=vm.runInNewContext(`(${method})`,{...M,...A,...S,Date,console:{error(){}},
 ErgazomenoiModel:{findOne:()=>({lean:async()=>db.state().employees[0]})},getEmployeeHistoryAccess:async()=>A.accessForUser(admin),
 writeEmployeeEmploymentHistoryOperations:args=>W.writeEmployeeEmploymentHistoryOperations({...args,...db.deps,userModel:userModel(admin),correctionCatalogLoader:async()=>({})})});
 const app=express();app.use(express.json());app.use((req,res,next)=>{req.session={userId:'synthetic-admin',userTeam:f.scope.team,companyInUse:f.scope.company_kod};next();});app.post('/history',handler);
 app.get('/history',(req,res)=>res.json(db.state()));const server=app.listen(0,'127.0.0.1');await once(server,'listening');
 try{const origin=`http://127.0.0.1:${server.address().port}`,expectedStateToken=S.buildEmployeeHistoryEditorStateToken({currentEmployee:f.employee,historyRows:f.history});
 const correction={intent:'REMOVE_ROW',targetHistoryId:duplicate._id,facts:{},confirmation:null};
 const body={employeeId:f.employee._id,updates:[],expectedStateToken,correction};
 const send=value=>fetch(origin+'/history',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)});
 const preview=await(await send(body)).json();assert.equal(preview.resolution.phase,'PREVIEW',JSON.stringify(preview));assert.equal(db.state().audits.length,0);
 const approved={...body,correction:{...correction,confirmation:{fingerprint:preview.resolution.fingerprint,confirmed:true}}};
 const result=await send(approved);assert.equal(result.status,200);assert.equal((await result.json()).success,true);
 const reloaded=await(await fetch(origin+'/history')).json();assert.equal(reloaded.history.length,2);assert.equal(reloaded.audits.length,1);
 assert.equal(require('../../server/services/ergazomenoi/employeeHistorySaveValidationService').inspectEmployeeHistorySave({scope:f.scope,currentEmployee:reloaded.employees[0],historyRows:reloaded.history}).status,'CLEAN');
 const state=db.state(),stale=await send(approved);assert.equal(stale.status,409);assert.deepEqual(db.state(),state);
 }finally{await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});}
});
