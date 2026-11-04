'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{createRequire}=require('node:module');
const root=path.resolve(__dirname,'../..');
const filename=path.join(root,'server/services/ergazomenoi/employeeHistoryIndependentFenceVerifier.js'),req=createRequire(filename);
require('node:net').Socket.prototype.connect=()=>assert.fail('OFFLINE_NETWORK_FORBIDDEN');
const mongoose=req('mongoose'),{BSON,ObjectId}=mongoose.mongo;
mongoose.connect=async()=>assert.fail('OFFLINE_DATABASE_FORBIDDEN');
mongoose.mongo.MongoClient.prototype.connect=async()=>assert.fail('OFFLINE_DATABASE_FORBIDDEN');
const source=fs.readFileSync(filename,'utf8'),D=req('./employeeHistoryReferenceDefinitionsService');
const id=n=>new ObjectId(n.toString(16).padStart(24,'0'));
const clone=value=>BSON.deserialize(BSON.serialize({value}),{promoteValues:false,promoteLongs:false}).value;
const SOURCE='EMPLOYEE_HISTORY_LEGACY_APPROVAL_FENCE';
function values(row,parts){if(!parts.length)return Array.isArray(row)?row.flatMap(x=>values(x,[])):[row];
 if(Array.isArray(row))return row.flatMap(x=>values(x,parts));return values(row?.[parts[0]],parts.slice(1));}
function match(row,filter){return Object.entries(filter).every(([k,wanted])=>k==='$or'?wanted.some(x=>match(row,x)):
 values(row,k.split('.')).some(value=>wanted?.$in?wanted.$in.some(x=>String(x)===String(value)):String(wanted)===String(value)));}
async function fixture(){
 const scope={team:'THA',company_kod:String(id(1)),kodikos:'OFFLINE_SYNTHETIC'};
 const binding={scope,reservationId:String(id(2)),employeeId:String(id(3)),actorUserId:String(id(4)),legacyAttemptId:String(id(5)),
  fingerprint:'f'.repeat(43),executionId:'SYNTHETIC_ORIGINAL_EXECUTION'};
 const employee={_id:id(3),...scope,employee_profile_mutation_sequence:new BSON.Int32(2)};
 const history=[{_id:id(6),...scope,date:new Date('2026-01-01'),amount:new BSON.Double(1234.5)}];
 const base={employeeScope:{...scope,employee_id:id(3)},currentBefore:clone(employee),historyBefore:clone(history),historyAfter:clone(history),
 survivingHistoryIds:[String(id(6))],deletedLegacyHistoryIds:[]};
 const state={employee,history,references:Object.fromEntries(D.SUPPORTED_COLLECTIONS.map(name=>[name,[]])),audits:[
 {_id:id(5),...clone(base),mutationSource:'EMPLOYEE_HISTORY_SETTLEMENT_ATTEMPT',diagnostics:{fingerprint:binding.fingerprint}},
 {_id:id(2),...clone(base),mutationSource:SOURCE+'_ATTEMPT',diagnostics:{actorUserId:binding.actorUserId,legacyAttemptId:binding.legacyAttemptId,
 fingerprint:binding.fingerprint,executionId:binding.executionId,approvalFingerprint:'a'.repeat(43)}}]};
 state.references.Prodhlomena_Oraria_Deviations.push({_id:id(7),...scope,effective_profile_istoriko_id:id(6),amount:new BSON.Double(42)});
 const transport={hosts:['synthetic-a','synthetic-b','synthetic-c']};
 class SyntheticMongoClient{
 constructor(uri){assert.equal(uri,'synthetic:offline');this.options={hosts:[...transport.hosts],replicaSet:'synthetic'};}
 async connect(){}async close(){}startSession(){return {withTransaction:async work=>work(),endSession:async()=>{}};}
 db(){return {databaseName:'synthetic',collection(name){const rows=name==='Ergazomenoi'?[state.employee]:name==='Istoriko_Proslhpseon_Allagon'?state.history:
 name==='Employee_History_Repair_Audit'?state.audits:state.references[name];return {
 find(filter){let selected=rows.filter(row=>match(row,filter));return {sort(){selected.sort((a,b)=>String(a._id).localeCompare(String(b._id)));return this;},limit(){return this;},toArray:async()=>clone(selected)};},
 async findOne(filter,options={}){const row=rows.filter(row=>match(row,filter)).sort((a,b)=>String(a._id).localeCompare(String(b._id)))[0];
 return row?clone(options.projection?{_id:row._id}:row):null;} };} };}
 }
 const moduleIsolated={exports:{}};
 vm.runInThisContext('(function(require,module,exports){'+source+'\n})',{filename})(
 name=>name==='mongoose'?{mongo:{...mongoose.mongo,MongoClient:SyntheticMongoClient}}:req(name),moduleIsolated,moduleIsolated.exports);
 const directory=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'payroll-fence-diagnostics-'));fs.chmodSync(directory,0o700);
 const options={uri:'synthetic:offline',binding,directory,repositoryRoot:root,secret:'SYNTHETIC_ONLY_OFFLINE_SECRET',expectedHistoryCount:1,expectedProtectedCount:1};
 const capture=opts=>moduleIsolated.exports.captureFenceVerificationEvidence(opts||options);
 assert.equal((await capture()).outcome,'BASELINE_PRESERVED');
 return {state,binding,options,capture,transport,directory,file:path.join(directory,binding.reservationId+'.pre-fence-evidence.bson')};
}

function changeSavedBinding(h){
 const crypto=require('node:crypto'),bytes=fs.readFileSync(h.file);
 const saved=BSON.deserialize(bytes.subarray(32),{promoteValues:false,promoteLongs:false});saved.binding.actorUserId=String(id(99));
 const payload=BSON.serialize(saved,{minInternalBufferSize:BSON.calculateObjectSize(saved)});
 fs.writeFileSync(h.file,Buffer.concat([crypto.createHmac('sha256',h.options.secret).update(payload).digest(),payload]));
}
async function rejected(h,change,t){
 const before=fs.readFileSync(h.file),logs=[];
 t.mock.method(process.stderr,'write',value=>{logs.push(String(value));return true;});
 change(h);let error;try{await h.capture();}catch(value){error=value;}
 assert.equal(error?.reason,'VERIFICATION_BASELINE_CHANGED');
 assert.ok(fs.readFileSync(h.file).equals(before));
 const message=JSON.parse(logs.join('').trim());assert.equal(message.code,error.reason);
 assert.deepEqual(message.firstDifference,error.diagnostics.firstDifference);
 assert.equal(message.REJECTED_EVIDENCE_VERIFIED,true);
 const files=fs.readdirSync(h.directory).filter(name=>name.includes('.rejected-'));
 assert.equal(files.length,1);
 const file=path.join(h.directory,files[0]),bytes=fs.readFileSync(file),payload=bytes.subarray(32),crypto=require('node:crypto');
 assert.ok(crypto.timingSafeEqual(crypto.createHmac('sha256',h.options.secret).update(payload).digest(),bytes.subarray(0,32)));
 assert.equal(fs.statSync(file).mode&0o777,0o600);
 const saved=BSON.deserialize(payload);
 assert.equal(saved.baselineEvidenceDigest,crypto.createHash('sha256').update(before).digest('hex'));
 return {diagnostics:error.diagnostics,log:logs.join(''),saved};
}
test('diagnostic positive control: unchanged second capture passes without rejected evidence',async()=>{
 const h=await fixture();assert.equal((await h.capture()).outcome,'BASELINE_PRESERVED');
 assert.equal(fs.readdirSync(h.directory).length,1);
});
test('diagnostic identifies binding-only mismatch and preserves authenticated rejected state',async t=>{
 const h=await fixture();changeSavedBinding(h);
 const {diagnostics:d}=await rejected(h,()=>{},t);
 assert.equal(d.BINDING_CHANGED,true);assert.equal(d.STATE_CHANGED,false);
 assert.deepEqual(d.firstDifference,{path:'binding.actorUserId',type:'VALUE'});
});
test('diagnostic identifies state-only mismatch without weakening rejection',async t=>{
 const h=await fixture();const {diagnostics:d}=await rejected(h,h=>{h.state.references.Prodhlomena_Oraria_Deviations[0].amount=new BSON.Double(43);},t);
 assert.equal(d.BINDING_CHANGED,false);assert.equal(d.STATE_CHANGED,true);
 assert.deepEqual(d.firstDifference,{path:'state.references.Prodhlomena_Oraria_Deviations[0].amount',type:'VALUE'});
 assert.equal(d.DOCUMENT_COUNT_CHANGED,false);assert.equal(d.DOCUMENT_CONTENT_CHANGED,true);
});
test('diagnostic evaluates both comparisons when binding and state differ',async t=>{
 const h=await fixture();changeSavedBinding(h);
 const {diagnostics:d}=await rejected(h,h=>{h.state.references.Prodhlomena_Oraria_Deviations[0].amount=new BSON.Double(43);},t);
 assert.equal(d.BINDING_CHANGED,true);assert.equal(d.STATE_CHANGED,true);
});
test('diagnostic separates target metadata from document content',async t=>{
 const h=await fixture();const {diagnostics:d}=await rejected(h,h=>{h.transport.hosts=['other-synthetic-host'];},t);
 assert.deepEqual(d.firstDifference,{path:'state.target',type:'VALUE'});
 assert.equal(d.BINDING_CHANGED,false);assert.equal(d.STATE_CHANGED,true);
 assert.equal(d.DOCUMENT_COUNT_CHANGED,false);assert.equal(d.DOCUMENT_CONTENT_CHANGED,false);
});
test('diagnostic distinguishes BSON numeric TYPE mismatch',async t=>{
 const h=await fixture();const {diagnostics:d}=await rejected(h,h=>{h.state.references.Prodhlomena_Oraria_Deviations[0].amount=new BSON.Int32(42);},t);
 assert.equal(d.firstDifference.type,'TYPE');
});
test('diagnostic reports document count change separately',async t=>{
 const h=await fixture();const {diagnostics:d}=await rejected(h,h=>{h.state.audits.push({_id:id(99),employeeScope:{...h.binding.scope,employee_id:id(3)},mutationSource:'SYNTHETIC_EXTRA'});},t);
 assert.deepEqual(d.firstDifference,{path:'state.audits.length',type:'EXTRA'});assert.equal(d.DOCUMENT_COUNT_CHANGED,true);
});
test('diagnostic reports field ORDER mismatch and still rejects',async t=>{
 const h=await fixture();const {diagnostics:d}=await rejected(h,h=>{
 const row=h.state.references.Prodhlomena_Oraria_Deviations[0];h.state.references.Prodhlomena_Oraria_Deviations[0]=Object.fromEntries(Object.entries(row).reverse());},t);
 assert.equal(d.firstDifference.type,'ORDER');
});
test('diagnostic reports MISSING and hides dynamic personal keys and all values',async t=>{
 const h=await fixture();const {diagnostics:d}=await rejected(h,h=>{delete h.state.references.Prodhlomena_Oraria_Deviations[0].amount;},t);
 assert.equal(d.firstDifference.type,'MISSING');
});
test('diagnostic EXTRA field log contains no personal keys, values, secrets or fingerprints',async t=>{
 const h=await fixture();const sentinel='SENSITIVE_PERSONAL_VALUE_123';
 const {diagnostics:d,log}=await rejected(h,h=>{h.state.references.Prodhlomena_Oraria_Deviations[0][sentinel]=sentinel;},t);
 assert.equal(d.firstDifference.type,'EXTRA');assert.match(d.firstDifference.path,/\[field:[a-f0-9]{24}\]$/);
 for(const value of [sentinel,h.options.secret,h.binding.fingerprint,h.binding.actorUserId,h.binding.executionId])assert.equal(log.includes(value),false);
});
test('security: real History BSON change remains blocked before baseline reuse',async()=>{
 const h=await fixture();h.state.history[0].amount=new BSON.Double(1235.5);
 await assert.rejects(h.capture(),{reason:'BASELINE_SNAPSHOT_MISMATCH'});
});
test('security: real employee sequence change remains blocked before baseline reuse',async()=>{
 const h=await fixture();h.state.employee.employee_profile_mutation_sequence=new BSON.Int32(3);
 await assert.rejects(h.capture(),{reason:'BASELINE_SNAPSHOT_MISMATCH'});
});
test('regression: same target host set in another connection order preserves the baseline',async()=>{
 const h=await fixture();h.transport.hosts.reverse();
 assert.equal((await h.capture()).outcome,'BASELINE_PRESERVED');
});
