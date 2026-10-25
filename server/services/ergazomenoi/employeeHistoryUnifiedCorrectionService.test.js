'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const W=require('./employeeEmploymentProfileWriter');
const {fixture,store,scope}=require('../../../test/fixtures/employeeProfileTransactionStore');
const {token,userModel}=require('../../../test/fixtures/employeeHistorySupervisor');
const {canonicalizeEmployeeHistory}=require('./employeeHistoryCanonicalizationService');
const catalogs={KPK_EFKA:[{code:'0101',label:'Ασφάλιση'}],CONTRACT_TYPE:[{code:'01',label:'Σύμβαση'}],CONTRACT_CATEGORY:[{code:'01',label:'Κατηγορία',afora_thn_symbash:'01'}],CONTRACT_SPECIALTY:[{code:'01',label:'Ειδικότητα',afora_thn_symbash_kathgoria:'0101'}]};
const base={intent:'RECONCILE_HISTORY',targetHistoryId:null,facts:{},confirmation:null};
function data(){const f=fixture();for(const row of [...f.history,f.employee]) Object.assign(row,{krathsh_01:'0101',symbash:'01',kathgoria_symbashs:'01',eidikothta_symbashs:'01',hmeres_ergasias_ebdomadas:5,ores_ergasias_ebdomadas:40,mo_oron_hmerhsias_ergasias:8,nomimosMisthos:900,pragmatikosMisthos:1000,synolo_symbashs:1000,eidikh_kathgoria_ergazomenoy:null});return f;}
const run=(db,request,extra={})=>W.writeEmployeeEmploymentHistoryOperations({...db.deps,scope,employeeId:'employee',operations:[],expectedStateToken:token(db),actorUserId:'admin',userModel:userModel({privileges:'A',team:'THA',situation:'A'}),correctionCatalogLoader:async()=>catalogs,correction:request,...extra});
async function preview(db,r=base,extra={}){let result;await assert.rejects(run(db,r,extra),e=>{assert.equal(e.code,'EMPLOYEE_HISTORY_SAFE_CORRECTION_REQUIRED');result=e.resolution;return true;});return result;}
const answers=sheet=>sheet.conflicts.map(c=>({conflictId:c.conflictId,intent:'ENTER_DIFFERENT_VALUE',value:'PROFILE_CANDIDATE_1',values:Object.fromEntries(c.intents[0].valueControl.beforeValues.map(item=>[item.fieldId,item.value]))}));
test('unified changes two interdependent boundaries with one preview, transaction, audit and CLEAN result',async()=>{
 const f=data(),db=store([f]),before=db.state(),sheet=await preview(db);
 assert.equal(sheet.kind,'USER_CONFIRMED_HISTORY_CORRECTION');assert.deepEqual(db.state(),before);
 const periods=answers(sheet);periods[0].values.PERIOD_END='2026-02-04';periods[1].values.PERIOD_START='2026-02-05';
 const request={...base,facts:{periods}},p=await preview(db,request);assert.equal(p.phase,'PREVIEW',p.explanation);assert.deepEqual(db.state(),before);
 await run(db,{...request,confirmation:{fingerprint:p.fingerprint,confirmed:true}});
 assert.equal(db.state().audits.length,1);assert.equal(db.events.filter(e=>e.type==='commit').length,1);
 assert.deepEqual(db.state().history.map(row=>row._id).sort(),f.history.map(row=>row._id).sort());
 assert.equal(canonicalizeEmployeeHistory({scope,currentEmployee:db.state().employees[0],historyRows:db.state().history}).status,'CLEAN');
});
test('unified incomplete or contradictory answers never commit a partial correction and preserve earlier answers',async()=>{
 const db=store([data()]),before=db.state(),sheet=await preview(db),periods=answers(sheet);
 periods[0].values.PERIOD_END='2026-02-04';periods[1].values.PERIOD_START='2026-02-01';
 const result=await preview(db,{...base,facts:{periods}});assert.equal(result.kind,'USER_CONFIRMED_HISTORY_CORRECTION');
 assert.equal(result.conflicts[0].intents[0].valueControl.initialValues.PERIOD_END,'2026-02-04');assert.deepEqual(db.state(),before);
});
test('unified audit failure rolls back all periods, hidden fence and audit',async()=>{
 const db=store([data()]),periods=answers(await preview(db));periods[0].values.ACTUAL_PAY=1100;periods[1].values.ACTUAL_PAY=1200;
 const r={...base,facts:{periods}},p=await preview(db,r),before=db.state();assert.equal(p.phase,'PREVIEW',p.explanation);
 db.deps.auditModel.create=async()=>{throw Error('synthetic audit failure');};
 await assert.rejects(run(db,{...r,confirmation:{fingerprint:p.fingerprint,confirmed:true}}),/synthetic audit failure/);assert.deepEqual(db.state(),before);
});
test('unified Supervisor cannot use global scope and changed approval cannot apply',async()=>{
 const db=store([data()]),before=db.state();await assert.rejects(run(db,base,{userModel:userModel({privileges:'S',team:scope.team,situation:'A'})}),e=>e.code==='EMPLOYEE_HISTORY_SUPERVISOR_SCOPE_FORBIDDEN');assert.deepEqual(db.state(),before);
 const periods=answers(await preview(db));periods[0].values.ACTUAL_PAY=1100;const r={...base,facts:{periods}},p=await preview(db,r);periods[0].values.ACTUAL_PAY=1200;
 await assert.rejects(run(db,{...r,confirmation:{fingerprint:p.fingerprint,confirmed:true}}),e=>e.code==='EMPLOYEE_HISTORY_CORRECTION_CHANGED');assert.deepEqual(db.state(),before);
});

function completeAnswers(sheet,f){
 const {CORRECTION_FIELD_REGISTRY}=require('./employeeHistoryCorrectionFieldRegistryService');
 return sheet.conflicts.map(c=>{
  const control=c.intents[0].valueControl;
  const prior=control.initialValues || Object.fromEntries(control.beforeValues.map(item=>[item.fieldId,item.value]));
  const values=Object.keys(prior).length ? {...prior} : Object.fromEntries(control.fields.map(field=>{
   const name=CORRECTION_FIELD_REGISTRY.find(entry=>entry.id===field.id)?.fields[0] || field.id;
   const value=f.history[0][name];return [field.id,value instanceof Date ? value.toISOString().slice(0,10) : value ?? null];
  }));
  return {conflictId:c.conflictId,intent:'ENTER_DIFFERENT_VALUE',value:'PROFILE_CANDIDATE_1',values};
 });
}
test('new dependent gap stays in the same worksheet, retains answers and commits all periods together',async()=>{
 const f=data(),db=store([f]),before=db.state(),sheet=await preview(db),periods=answers(sheet);
 periods[1].values.PERIOD_START='2026-02-05';
 const dependent=await preview(db,{...base,facts:{periods}});
 assert.equal(dependent.kind,'USER_CONFIRMED_HISTORY_CORRECTION');assert.equal(dependent.conflicts.length,4);
 assert.equal(dependent.conflicts[1].intents[0].valueControl.initialValues.PERIOD_START,'2026-02-05');
 assert.deepEqual(db.state(),before);
 const request={...base,facts:{periods:completeAnswers(dependent,f)}},p=await preview(db,request);assert.equal(p.phase,'PREVIEW',p.explanation);
 await run(db,{...request,confirmation:{fingerprint:p.fingerprint,confirmed:true}});
 assert.equal(db.state().history.length,4);assert.equal(db.state().audits.length,1);
 assert.equal(db.events.filter(e=>e.type==='commit').length,1);
});
test('missing dependent facts retain the full worksheet and selected source until one final correction',async()=>{
 const f=data();f.history.splice(1,1);const db=store([f]),before=db.state(),sheet=await preview(db);
 const request={...base,facts:{periods:completeAnswers(sheet,f)}};
 const gap=request.facts.periods.find(answer=>answer.conflictId.startsWith('GAP_'));
 gap.value='PROFILE_CANDIDATE_2';delete gap.values.dialleima_se_lepta;
 // A missing required business fact keeps the supplied source and all other
 // answers editable, without partial persistence.
 const missing=structuredClone(request);delete missing.facts.periods.find(answer=>answer.conflictId===gap.conflictId).values.KPK;
 const pending=await preview(db,missing);
 assert.equal(pending.kind,'USER_CONFIRMED_HISTORY_CORRECTION');assert.equal(pending.phase,undefined);
 const control=pending.conflicts.find(c=>c.conflictId===gap.conflictId).intents[0].valueControl;
 assert.equal(control.initialSource,'PROFILE_CANDIDATE_2');assert.deepEqual(control.initialValues,missing.facts.periods.find(a=>a.conflictId===gap.conflictId).values);
 assert.deepEqual(db.state(),before);
 const completed=completeAnswers(pending,f);const answer=completed.find(a=>a.conflictId===gap.conflictId);
 answer.value='PROFILE_CANDIDATE_2';answer.values.KPK='0101';answer.values.dialleima_se_lepta=20;
 const r={...base,facts:{periods:completed}},p=await preview(db,r);assert.equal(p.phase,'PREVIEW',p.explanation);
 await run(db,{...r,confirmation:{fingerprint:p.fingerprint,confirmed:true}});
 assert.equal(db.state().audits.length,1);assert.equal(db.events.filter(e=>e.type==='commit').length,1);
 const canonical=canonicalizeEmployeeHistory({scope,currentEmployee:db.state().employees[0],historyRows:db.state().history});
 assert.equal(canonical.status,'CLEAN');assert.equal(canonical.cleanupRequired,false);
 assert.equal((await preview(db)).conflicts.some(c=>c.conflictId===gap.conflictId),false);
});
test('unified removes an erroneous period only with jointly confirmed neighboring coverage',async()=>{
 const db=store([data()]),sheet=await preview(db),periods=answers(sheet);
 periods[0].values.PERIOD_END='2026-02-28';periods[1].values={ROW_ACTION:'REMOVE'};
 const r={...base,facts:{periods}},p=await preview(db,r);assert.equal(p.phase,'PREVIEW',p.explanation);
 await run(db,{...r,confirmation:{fingerprint:p.fingerprint,confirmed:true}});
 assert.equal(db.state().history.length,2);assert.equal(db.state().audits.length,1);
});
test('frozen historical references survive logical withdrawal with native BSON identities',async()=>{
 const mongoose=require('mongoose'),BSON=mongoose.mongo.BSON,f=data();
 for(const row of f.history)row._id=new mongoose.Types.ObjectId(row._id);
 const db=store([f],{cloneFn:value=>BSON.deserialize(BSON.serialize({value})).value});
 const refs={referenceChecker:async({historyIds})=>historyIds.map(String).includes(String(f.history[1]._id)) ? [{collection:'Apasxoliseis_Period_Frozen_Snapshots',documentId:'frozen'}] : []};
 const sheet=await preview(db,base,refs),periods=answers(sheet);periods[0].values.PERIOD_END='2026-02-28';periods[1].values={ROW_ACTION:'REMOVE'};
 const r={...base,facts:{periods}},p=await preview(db,r,refs);assert.equal(p.phase,'PREVIEW',p.explanation);
 await run(db,{...r,confirmation:{fingerprint:p.fingerprint,confirmed:true}},refs);
 assert.equal(db.state().history.length,3);const retired=db.state().history.find(row=>row._id.equals(f.history[1]._id));
 assert.equal(retired.employment_history_canonical_status,'WITHDRAWN_ERRONEOUS');
    assert.deepEqual(retired.hmeromhnia_isxyos_oron_ergasias_apo,f.history[1].hmeromhnia_isxyos_oron_ergasias_apo);
 assert.ok(retired._id instanceof mongoose.Types.ObjectId);
 const {employment_history_canonical_status,employment_history_canonical_survivor_id,updatedAt,...businessAfter}=retired;
 const {updatedAt:oldRevision,...businessBefore}=f.history[1];
 assert.deepEqual(businessAfter,businessBefore);
});

test('two gaps complete together while finalized work, cards, schedules, decisions and submissions stay byte-identical',async()=>{
 const f=data();f.history[0].hmeromhnia_isxyos_oron_ergasias_eos='2026-01-15';
 f.history[1].hmeromhnia_isxyos_oron_ergasias_eos='2026-02-15';
 const db=store([f]),protectedDocuments={
  Prodhlomena_Oraria:[{...scope,hmeromhnia:'2026-01-20',apo:'08:00',eos:'16:00'}],
  Oraria_Apo_Kartes:[{...scope,hmeromhnia:'2026-01-20',apo:'08:01',eos:'16:03'}],
  Apasxolhseis:[{...scope,finalized:true,net:1234.56,minutes:480}],
  Apasxoliseis_Period_Frozen_Snapshots:[{history_id:f.history[0]._id,minutes:480,snapshot:{pay:1000}}],
  Apasxoliseis_Weekly_Canonical_Decisions:[{history_id:f.history[0]._id,decision:'APPROVED'}],
  Ergazomenoi_Erganh:[{...scope,submitted:true,history_id:f.history[0]._id}]
 };
 const before=JSON.stringify(protectedDocuments);
 const extra={referenceChecker:async({historyIds})=>Object.entries(protectedDocuments)
  .filter(([name])=>['Apasxoliseis_Period_Frozen_Snapshots','Apasxoliseis_Weekly_Canonical_Decisions'].includes(name))
  .flatMap(([collection,rows])=>rows.filter(row=>historyIds.map(String).includes(String(row.history_id)))
   .map(row=>({collection,documentId:'synthetic',historyId:row.history_id})))};
 db.deps.connection.collection=name=>({
  findOne:async()=>protectedDocuments[name]?.[0] || null,
  updateOne:()=>assert.fail('Protected document update'),deleteOne:()=>assert.fail('Protected document deletion'),
  insertOne:()=>assert.fail('Protected document insertion'),bulkWrite:()=>assert.fail('Protected document bulk write')
 });
 const sheet=await preview(db,base,extra);assert.equal(sheet.conflicts.filter(c=>c.conflictId.startsWith('GAP_')).length,2);
 const r={...base,facts:{periods:completeAnswers(sheet,f)}},p=await preview(db,r,extra);assert.equal(p.phase,'PREVIEW',p.explanation);
 assert.equal(db.state().audits.length,0);assert.equal(JSON.stringify(protectedDocuments),before);
 await run(db,{...r,confirmation:{fingerprint:p.fingerprint,confirmed:true}},extra);
 assert.equal(db.state().history.length,5);assert.equal(db.state().audits.length,1);
 assert.equal(db.events.filter(e=>e.type==='commit').length,1);assert.equal(JSON.stringify(protectedDocuments),before);
 const again=await preview(db,base,extra);assert.equal(again.conflicts.some(c=>c.conflictId.startsWith('GAP_')),false);
 const business=({aa_eggrafhs,updatedAt,...row})=>row;
 for(const original of f.history)assert.deepEqual(business(db.state().history.find(row=>row._id===original._id)),business(original));
});
test('unified checks references for every persisted row before presenting questions and refuses uncertainty',async()=>{
 const f=data(),db=store([f]),seen=[];
 await preview(db,base,{referenceChecker:async({historyIds})=>{seen.push(...historyIds.map(String));return [];}});
 assert.deepEqual([...new Set(seen)].sort(),f.history.map(row=>String(row._id)).sort());
 const before=db.state();await assert.rejects(run(db,base,{referenceChecker:async()=>{throw Error('offline');}}),e=>e.code==='EMPLOYEE_HISTORY_CORRECTION_REFERENCE_CHECK_FAILED');assert.deepEqual(db.state(),before);
});

test('two closed/current cycles retain distinct hire identities while two terms are corrected atomically',async()=>{
 const {historyId}=require('../../../test/fixtures/employeeProfileTransactionStore');
 const older=data(),newer=data();older.history[2].hmeromhnia_apoxorhshs='2026-03-31';older.history[2].hmeromhnia_isxyos_oron_ergasias_eos='2026-03-31';
 newer.history.forEach((row,index)=>Object.assign(row,{_id:historyId('employee',index+3),aa_eggrafhs:String(index+4).padStart(4,'0'),hmeromhnia_proslhpshs:'2026-04-01',hmeromhnia_isxyos_oron_ergasias_apo:['2026-04-01','2026-05-01','2026-06-01'][index],hmeromhnia_isxyos_dialleimatos_apo:['2026-04-01','2026-05-01','2026-06-01'][index],hmeromhnia_isxyos_oron_ergasias_eos:['2026-04-30','2026-05-31',null][index]}));
 const f={employee:{...newer.history[2],_id:'employee',energos:true},history:[...older.history,...newer.history]},db=store([f]),sheet=await preview(db),periods=answers(sheet);
 assert.equal(sheet.conflicts.length,6);assert.match(sheet.explanation,/2 εργασιακοί κύκλοι/);
 periods[1].values.ACTUAL_PAY=1150;periods[4].values.ACTUAL_PAY=1250;
 const r={...base,facts:{periods}},p=await preview(db,r);assert.equal(p.phase,'PREVIEW',p.explanation);
 await run(db,{...r,confirmation:{fingerprint:p.fingerprint,confirmed:true}});
 for(const original of f.history){const saved=db.state().history.find(row=>row._id===original._id);assert.equal(saved.hmeromhnia_proslhpshs,original.hmeromhnia_proslhpshs);}
 assert.equal(db.state().audits.length,1);assert.equal(db.events.filter(e=>e.type==='commit').length,1);
});
test('state token and full reference drift invalidate the total approval without partial writes',async()=>{
 const f=data(),db=store([f]),periods=answers(await preview(db));periods[0].values.ACTUAL_PAY=1100;
 const r={...base,facts:{periods}},p=await preview(db,r),before=db.state();
 await assert.rejects(run(db,{...r,confirmation:{fingerprint:p.fingerprint,confirmed:true}},{referenceChecker:async()=>[{collection:'Apasxoliseis_Period_Frozen_Snapshots',documentId:'new-frozen'}]}),e=>e.code==='EMPLOYEE_HISTORY_CORRECTION_CHANGED');assert.deepEqual(db.state(),before);
 const old=token(db);db.changeCommittedEmployee('employee',{pragmatikosMisthos:1300});const changed=db.state();
 await assert.rejects(run(db,{...r,confirmation:{fingerprint:p.fingerprint,confirmed:true}},{expectedStateToken:old}),e=>e.code==='EMPLOYEE_HISTORY_EDITOR_STALE');assert.deepEqual(db.state(),changed);
});

const emptyHireDependencies=async()=>({checked:true,blockers:[],allowLater:true});
test('1.38-C later actual hire and explicitly corrected first period share one preview and commit',async()=>{
 const f=data(),db=store([f]),periods=answers(await preview(db));
 periods[0].values.HIRE_DATE='2026-01-02';periods[0].values.PERIOD_START='2026-01-02';
 const r={...base,facts:{periods}},extra={hireDependencyChecker:emptyHireDependencies},p=await preview(db,r,extra);
 assert.equal(p.phase,'PREVIEW',p.explanation);assert.equal(db.state().audits.length,0);
 await run(db,{...r,confirmation:{fingerprint:p.fingerprint,confirmed:true}},extra);
 assert.equal(new Date(db.state().employees[0].hmeromhnia_proslhpshs).toISOString().slice(0,10),'2026-01-02');
 assert.ok(db.state().history.every(row=>new Date(row.hmeromhnia_proslhpshs).toISOString().slice(0,10)==='2026-01-02'));
 assert.equal(db.state().audits.length,1);assert.equal(db.events.filter(e=>e.type==='commit').length,1);
});
test('earlier hire requires explicit initial terms boundary and preserves native IDs',async()=>{
 const f=data(),db=store([f]),periods=answers(await preview(db));periods[0].values.HIRE_DATE='2025-12-31';periods[0].values.PERIOD_START='2025-12-31';
 const extra={hireDependencyChecker:emptyHireDependencies},r={...base,facts:{periods}},p=await preview(db,r,extra);assert.equal(p.phase,'PREVIEW',p.explanation);
 await run(db,{...r,confirmation:{fingerprint:p.fingerprint,confirmed:true}},extra);
 assert.deepEqual(db.state().history.map(row=>row._id).sort(),f.history.map(row=>row._id).sort());
 assert.equal(canonicalizeEmployeeHistory({scope,currentEmployee:db.state().employees[0],historyRows:db.state().history}).status,'CLEAN');
});
test('hire dependencies, failed inventory, reference drift and Supervisor stop the same total correction',async()=>{
 const f=data(),db=store([f]),periods=answers(await preview(db)),before=db.state();periods[0].values.HIRE_DATE='2026-01-02';periods[0].values.PERIOD_START='2026-01-02';const r={...base,facts:{periods}};
 for(const checker of [async()=>({checked:true,blockers:['Apasxolhseis']}),async()=>{throw Error('inventory offline');}]) {
  const result=await preview(db,r,{hireDependencyChecker:checker});assert.equal(result.kind,'USER_CONFIRMED_HISTORY_CORRECTION');assert.deepEqual(db.state(),before);
 }
 const result=await preview(db,r,{hireDependencyChecker:emptyHireDependencies,referenceChecker:async()=>[{collection:'Apasxoliseis_Period_Frozen_Snapshots',documentId:'protected'}]});
 assert.equal(result.kind,'USER_CONFIRMED_HISTORY_CORRECTION');assert.deepEqual(db.state(),before);
});
function closedData(){const f=data();Object.assign(f.employee,{hmeromhnia_apoxorhshs:'2026-03-31',hmeromhnia_isxyos_oron_ergasias_eos:'2026-03-31',energos:false});Object.assign(f.history[2],{hmeromhnia_apoxorhshs:'2026-03-31',hmeromhnia_isxyos_oron_ergasias_eos:'2026-03-31'});return f;}
test('departure and historical terms are composed with the existing departure planner and saved once',async()=>{
 const f=closedData(),db=store([f]),before=db.state(),periods=answers(await preview(db));periods[0].values.ACTUAL_PAY=1100;periods[2].values.DEPARTURE_DATE='2026-04-01';
 const r={...base,facts:{periods}},p=await preview(db,r);assert.equal(p.phase,'PREVIEW',p.explanation);assert.deepEqual(db.state(),before);
 await run(db,{...r,confirmation:{fingerprint:p.fingerprint,confirmed:true}});
 assert.equal(new Date(db.state().employees[0].hmeromhnia_apoxorhshs).toISOString().slice(0,10),'2026-04-01');
 assert.equal(new Date(db.state().history.find(row=>row._id===f.history[2]._id).hmeromhnia_isxyos_oron_ergasias_eos).toISOString().slice(0,10),'2026-04-01');
 assert.equal(db.state().history.find(row=>row._id===f.history[0]._id).pragmatikosMisthos,1100);assert.equal(db.state().audits.length,1);
});
test('dependency inventory uses the same transaction and refuses company-wide frozen/payroll evidence',async()=>{
 const {checkUnifiedHireDependencies}=require('./employeeHistoryUnifiedCorrectionService');const session={},seen=[];
 const connection={collection:name=>({async findOne(filter,options){assert.equal(options.session,session);assert.deepEqual(filter,{team:scope.team,company_kod:scope.company_kod});seen.push(name);return name==='Apasxoliseis_Period_Frozen_Snapshots'?{_id:'frozen'}:null;}})};
 const result=await checkUnifiedHireDependencies({connection,scope,session});assert.equal(result.checked,true);assert.deepEqual(result.blockers,['Apasxoliseis_Period_Frozen_Snapshots']);
 assert.ok(seen.includes('Oraria_Apo_Kartes'));assert.ok(seen.includes('Apasxolhseis'));assert.ok(seen.includes('Ergazomenoi_Erganh'));
});

test('rehire-date correction changes only the chosen current cycle and preserves the earlier closed cycle',async()=>{
 const {historyId}=require('../../../test/fixtures/employeeProfileTransactionStore');const older=closedData(),newer=data();
 newer.history.forEach((row,index)=>Object.assign(row,{_id:historyId('employee',index+3),aa_eggrafhs:String(index+4).padStart(4,'0'),hmeromhnia_proslhpshs:'2026-04-01',hmeromhnia_isxyos_oron_ergasias_apo:['2026-04-01','2026-05-01','2026-06-01'][index],hmeromhnia_isxyos_dialleimatos_apo:['2026-04-01','2026-05-01','2026-06-01'][index],hmeromhnia_isxyos_oron_ergasias_eos:['2026-04-30','2026-05-31',null][index]}));
 const f={employee:{...newer.history[2],_id:'employee',energos:true},history:[...older.history,...newer.history]},db=store([f]),periods=answers(await preview(db)),before=db.state();
 periods[3].values.HIRE_DATE='2026-04-02';periods[3].values.PERIOD_START='2026-04-02';
 const r={...base,facts:{periods}},extra={hireDependencyChecker:emptyHireDependencies},p=await preview(db,r,extra);assert.equal(p.phase,'PREVIEW',p.explanation);
 await run(db,{...r,confirmation:{fingerprint:p.fingerprint,confirmed:true}},extra);
 for(const original of before.history.slice(0,3))assert.deepEqual(db.state().history.find(row=>row._id===original._id),original);
 assert.equal(new Date(db.state().employees[0].hmeromhnia_proslhpshs).toISOString().slice(0,10),'2026-04-02');
 assert.equal(db.state().audits.length,1);
});
test('hire-date correction rolls back all cycle changes if audit fails',async()=>{
 const db=store([data()]),periods=answers(await preview(db));periods[0].values.HIRE_DATE='2026-01-02';periods[0].values.PERIOD_START='2026-01-02';
 const r={...base,facts:{periods}},extra={hireDependencyChecker:emptyHireDependencies},p=await preview(db,r,extra),before=db.state();
 db.deps.auditModel.create=async()=>{throw Error('lifecycle audit failure');};
 await assert.rejects(run(db,{...r,confirmation:{fingerprint:p.fingerprint,confirmed:true}},extra),/lifecycle audit failure/);assert.deepEqual(db.state(),before);
});
test('conflicting explicit departure/end answers remain editable with no writes',async()=>{
 const db=store([closedData()]),periods=answers(await preview(db)),before=db.state();periods[2].values.DEPARTURE_DATE='2026-04-01';periods[2].values.PERIOD_END='2026-04-02';
 const p=await preview(db,{...base,facts:{periods}});assert.equal(p.kind,'USER_CONFIRMED_HISTORY_CORRECTION');assert.match(p.explanation,/διαφέρει/);assert.deepEqual(db.state(),before);
});

test('native BSON identities survive approved hire correction without changing frozen snapshots',async()=>{
 const mongoose=require('mongoose'),BSON=mongoose.mongo.BSON,f=data();for(const row of f.history)row._id=new mongoose.Types.ObjectId(row._id);
 const db=store([f],{cloneFn:value=>BSON.deserialize(BSON.serialize({value})).value}),periods=answers(await preview(db));periods[0].values.HIRE_DATE='2026-01-02';periods[0].values.PERIOD_START='2026-01-02';
 const r={...base,facts:{periods}},extra={hireDependencyChecker:emptyHireDependencies},p=await preview(db,r,extra);assert.equal(p.phase,'PREVIEW',p.explanation);
 await run(db,{...r,confirmation:{fingerprint:p.fingerprint,confirmed:true}},extra);
 for(const original of f.history){const saved=db.state().history.find(row=>row._id.equals(original._id));assert.ok(saved._id instanceof mongoose.Types.ObjectId);assert.ok(saved._id.equals(original._id));}
 assert.equal(db.state().audits.length,1);
});

function defaultInventory(db, dependencies = {}) {
 db.deps.connection.collection = name => ({ async findOne(filter, { session }) {
  assert.ok(session);assert.deepEqual(filter,{team:scope.team,company_kod:scope.company_kod});
  return dependencies[name]?.[0] || null;
 } });
 return dependencies;
}
test('native default inventory keeps 1.38-C later hire blocked even with no concurrent work or dependencies',async()=>{
 const db=store([data()]);defaultInventory(db);const before=db.state(),periods=answers(await preview(db));
 periods[0].values.HIRE_DATE='2026-01-02';periods[0].values.PERIOD_START='2026-01-02';
 const r={...base,facts:{periods}},p=await preview(db,r);assert.notEqual(p.phase,'PREVIEW');
 assert.match(p.explanation,/μεταγενέστερη/);
 await assert.rejects(run(db,{...r,confirmation:{fingerprint:'a'.repeat(64),confirmed:true}}),e=>e.code==='EMPLOYEE_HISTORY_SAFE_CORRECTION_REQUIRED');
 assert.deepEqual(db.state(),before);assert.equal(db.events.some(event=>event.type==='commit'),false);
});
test('safe earlier hire completes using native dependency checker, with no injected allowLater evidence',async()=>{
 const db=store([data()]);defaultInventory(db);const periods=answers(await preview(db));
 periods[0].values.HIRE_DATE='2025-12-31';periods[0].values.PERIOD_START='2025-12-31';
 const r={...base,facts:{periods}},p=await preview(db,r);assert.equal(p.phase,'PREVIEW',p.explanation);
 await run(db,{...r,confirmation:{fingerprint:p.fingerprint,confirmed:true}});
 assert.equal(new Date(db.state().employees[0].hmeromhnia_proslhpshs).toISOString().slice(0,10),'2025-12-31');
 assert.equal(db.state().audits.length,1);
});
test('native checker rereads newly inserted work during confirmed correction and rolls back its fence',async()=>{
 const db=store([data()]),dependencies=defaultInventory(db),periods=answers(await preview(db));
 periods[0].values.HIRE_DATE='2025-12-31';periods[0].values.PERIOD_START='2025-12-31';
 const r={...base,facts:{periods}},p=await preview(db,r),before=db.state();assert.equal(p.phase,'PREVIEW');
 dependencies.Prodhlomena_Oraria=[{_id:'new-work',...scope,hmeromhnia:'2026-01-01'}];
 await assert.rejects(run(db,{...r,confirmation:{fingerprint:p.fingerprint,confirmed:true}}),e=>e.code==='EMPLOYEE_HISTORY_SAFE_CORRECTION_REQUIRED');
 assert.deepEqual(db.state(),before);
});
test('native earlier hire transaction failure rolls back every cycle, fence and audit',async()=>{
 const db=store([data()]);defaultInventory(db);const periods=answers(await preview(db));
 periods[0].values.HIRE_DATE='2025-12-31';periods[0].values.PERIOD_START='2025-12-31';
 const r={...base,facts:{periods}},p=await preview(db,r),before=db.state();assert.equal(p.phase,'PREVIEW');
 db.deps.auditModel.create=async()=>{throw Error('native correction audit failure');};
 await assert.rejects(run(db,{...r,confirmation:{fingerprint:p.fingerprint,confirmed:true}}),/native correction audit failure/);
 assert.deepEqual(db.state(),before);
});

for(const correctionFirst of [true,false])test(`native blocked later hire versus simultaneous actual work: ${correctionFirst?'correction':'work'} owns fence first`,async()=>{
 const {deferred}=require('../../../test/fixtures/employeeProfileTransactionStore');
 const {runEmployeeWorkWrite}=require('./employeeWorkWriteFenceService');
 const periods=answers(await preview(store([data()])));periods[0].values.HIRE_DATE='2026-01-02';periods[0].values.PERIOD_START='2026-01-02';
 const db=store([data()]);
 db.deps.connection.collection=name=>({async findOne(filter,{session}){
  return name==='Prodhlomena_Oraria'?session.draft.audits.find(row=>row.kind==='actual-work') || null:null;
 }});
 const held=deferred(),release=deferred(),conflict=deferred(),firstDone=deferred();
 db.hooks.read=async(session,kind)=>{if(session.id===1 && kind==='employees' && db.events.at(-1).projection!=='_id' && !session.held){session.held=true;held.resolve();await release.promise;}};
 db.hooks.retry=async session=>{assert.equal(session.id,2);conflict.resolve();await firstDone.promise;};
 const correction=()=>run(db,{...base,facts:{periods},confirmation:{fingerprint:'a'.repeat(64),confirmed:true}}).then(()=>null,error=>error);
 const work=()=>runEmployeeWorkWrite({...db.deps,documents:[{...scope,hmeromhnia:'2026-01-01'}],work:({session})=>db.deps.auditModel.create([{kind:'actual-work',...scope,hmeromhnia:'2026-01-01'}],{session})});
 const a=correctionFirst?correction():work();await held.promise;
 const b=correctionFirst?work():correction();await conflict.promise;
 release.resolve();const firstResult=await a;firstDone.resolve();const secondResult=await b;
 assert.equal((correctionFirst?firstResult:secondResult).code,'EMPLOYEE_HISTORY_SAFE_CORRECTION_REQUIRED');
 assert.equal(new Date(db.state().employees[0].hmeromhnia_proslhpshs).toISOString().slice(0,10),'2026-01-01');
 assert.equal(db.state().audits.filter(row=>row.kind==='actual-work').length,1);
 assert.equal(db.events.filter(event=>event.type==='commit').length,1);
 assert.equal(db.state().employees[0].employee_profile_mutation_sequence,1);
});
