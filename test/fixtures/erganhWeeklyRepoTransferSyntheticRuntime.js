'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),Module=require('node:module'),path=require('node:path');
// The existing reconstruction, decision, preflight, input fences and atomic writer
// execute unchanged. Only model I/O and transaction commit/rollback are synthetic.
function syntheticRuntime(f,{failExecution=false}={}){
 const state={rows:f.rows,employees:[f.employee],histories:f.history,decisions:[],executions:[],audits:[],approvals:[]};
 let sequence=0,transactions=0,atomicBefore=null,lastApplyOptions=null;
 const value=(row,key)=>key.split('.').reduce((r,k)=>r?.[k],row);
 const same=(a,b)=>{if(a==null&&b==null)return true;if(a instanceof Date||b instanceof Date)return new Date(a).getTime()===new Date(b).getTime();return String(a)===String(b);};
 function matches(row,filter){return Object.entries(filter).every(([key,expected])=>{
  if(key==='$or')return expected.some(x=>matches(row,x));if(key==='$and')return expected.every(x=>matches(row,x));if(key==='$nor')return !expected.some(x=>matches(row,x));
  const actual=value(row,key);if(expected==null)return actual==null;
  if(typeof expected==='object'&&!(expected instanceof Date)&&!expected.toHexString&&!Object.keys(expected).some(k=>k.startsWith('$')))return JSON.stringify(actual)===JSON.stringify(expected);
  if(typeof expected==='object'&&!(expected instanceof Date)&&!expected.toHexString)return Object.entries(expected).every(([op,x])=>op==='$in'?x.some(v=>same(actual,v)):op==='$exists'?(actual!==undefined)===x:op==='$ne'?!same(actual,x):op==='$gte'?new Date(actual)>=new Date(x):op==='$lte'?new Date(actual)<=new Date(x):op==='$gt'?new Date(actual)>new Date(x):op==='$lt'?new Date(actual)<new Date(x):false);
  return same(actual,expected);
 });}
 const rowsFor=(kind,session)=>session?.working?.[kind]||state[kind];
 function query(read){let session=null;return {select(){return this;},sort(){return this;},limit(){return this;},session(s){session=s;return this;},async lean(){return structuredClone(read(session));}};}
 function model(kind){return {find:filter=>query(session=>rowsFor(kind,session).filter(r=>matches(r,filter))),findOne:filter=>query(session=>rowsFor(kind,session).find(r=>matches(r,filter))||null),
  async updateOne(filter,update,{session}={}){assert.ok(session?.inTransaction());const row=rowsFor(kind,session).find(r=>matches(r,filter));if(!row)return {matchedCount:0};if(kind==='rows'&&Object.keys(update.$set||{}).some(key=>key!=='__v'))assert.notEqual(row.is_locked,true);Object.assign(row,structuredClone(update.$set||{}));for(const [key,n]of Object.entries(update.$inc||{}))row[key]=Number(row[key]||0)+n;for(const key of Object.keys(update.$unset||{}))delete row[key];return {matchedCount:1};},
  async create(input,{session}={}){assert.ok(session?.inTransaction());if(kind==='executions'&&failExecution){failExecution=false;throw Object.assign(Error('Synthetic execution insertion failure'),{code:'SYNTHETIC_EXECUTION_FAILURE'});}const array=Array.isArray(input);const records=(array?input:[input]).map(r=>({_id:(0x670000000000000000000000n+BigInt(++sequence)).toString(16),...structuredClone(r)}));rowsFor(kind,session).push(...records);return array?records:records[0];}};}
 const models={prodhlomenaModel:model('rows'),employeeModel:model('employees'),historyModel:model('histories'),auditModel:model('audits'),companiesModel:{findOne:()=>query(()=>({}))}};
 const decisions=model('decisions'),executions=model('executions');
 const connection={db:{admin:()=>({command:async()=>({setName:'synthetic',logicalSessionTimeoutMinutes:30})})},async startSession(){transactions++;const session={working:null,inTransaction(){return this.working!==null;},async withTransaction(work){this.working=structuredClone(state);if(transactions%2===0)atomicBefore=structuredClone(this.working.rows);try{const out=await work();for(const key of Object.keys(state))state[key].splice(0,state[key].length,...this.working[key]);return out;}finally{this.working=null;}},async endSession(){}};return session;}};
 const serviceRoot=path.resolve(__dirname,'../../server/services/ergazomenoi');
 const sandboxNames=new Set(['apasxoliseisWeeklyRepoTransferDecisionService','apasxoliseisWeeklyRepoTransferDecisionReconstructionService','apasxoliseisWeeklyRepoTransferApplyService','apasxoliseisWeeklyRepoTransferApplyPreflightService','apasxoliseisWeeklyRepoTransferAtomicWriterService','apasxoliseisWeeklyRepoTransferInputWriteFenceService','employeeHistoryReferenceWriteFenceService']);
 const cache=new Map();
 function load(name){if(cache.has(name))return cache.get(name).exports;const file=path.join(serviceRoot,name+'.js'),mod={exports:{}};cache.set(name,mod);const native=Module.createRequire(file);
  const requireIsolated=request=>{if(request==='../../models/ergazomenoi')return {ProdhlomenaOrariaModel:models.prodhlomenaModel,ErgazomenoiModel:models.employeeModel,IstorikoProslhpseonAllagonModel:models.historyModel,ProdhlomenaOrariaAuditModel:models.auditModel};const local=path.basename(request,'.js');return request.startsWith('./')&&sandboxNames.has(local)?load(local):native(request);};
  Function('require','module',fs.readFileSync(file,'utf8'))(requireIsolated,mod);
  if(name==='apasxoliseisWeeklyRepoTransferDecisionReconstructionService'){const original=mod.exports.reconstructWeeklyRepoTransferDecision;mod.exports.reconstructWeeklyRepoTransferDecision=args=>original({...args,contextLoader:ctx=>mod.exports.defaultContextLoader({...ctx,models,holidayContextBuilder:async()=>({argiesByDateKey:new Map(),companyFlags:{}})})});}
  return mod.exports;
 }
 const decisionService=load('apasxoliseisWeeklyRepoTransferDecisionService'),applyService=load('apasxoliseisWeeklyRepoTransferApplyService');
 const runTransaction=async work=>{const session=await connection.startSession();try{return await session.withTransaction(()=>work(session));}finally{await session.endSession();}};
 return {state,models,decisions,executions,replay:()=>applyService.applyWeeklyRepoTransfer(lastApplyOptions),get atomicBefore(){return atomicBefore;},
  attach(deps){deps.ApasxoliseisWeeklyRepoTransferDecisionModel=decisions;deps.ApasxoliseisWeeklyRepoTransferExecutionModel=executions;deps.ProdhlomenaOrariaAuditModel=models.auditModel;
   deps.runWithPeriodCalculationWriteFence=({work})=>runTransaction(session=>work({session}));
   deps.fencePeriodCalculationForWrite=async({session})=>{assert.ok(session.inTransaction());};
   deps.createWeeklyRepoTransferDecision=args=>decisionService.createWeeklyRepoTransferDecision({...args,decisionModel:decisions,approvalModel:model('approvals')});
   deps.applyWeeklyRepoTransfer=args=>{lastApplyOptions={...args,decisionModel:decisions,executionModel:executions,writerOptions:{connection,prodhlomenaModel:models.prodhlomenaModel,auditModel:models.auditModel,executionModel:executions,now:()=>new Date('2026-05-31T12:00:00Z')}};return applyService.applyWeeklyRepoTransfer(lastApplyOptions);};
   deps.loadAppliedRepoTransferProtectionContext=async({rows})=>{const executions=structuredClone(state.executions);const context=require(path.join(serviceRoot,'apasxoliseisWeeklyRepoTransferAppliedProtectionService')).buildAppliedRepoTransferProtectionContext({executions,scope:{team:f.scope.team,company_kod:f.scope.company_kod,ypokatasthma:'0000'},loadedRowIds:(rows||f.rows).map(r=>r._id)});return {...context,executions};};
  }
 };
}
module.exports={syntheticRuntime};
