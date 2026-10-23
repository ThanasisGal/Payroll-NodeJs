'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const W=require('./employeeEmploymentProfileWriter');
const {fixture,store}=require('../../../test/fixtures/employeeProfileTransactionStore');
const query=value=>({select(){return this;},session(){return this;},lean:async()=>value});
function setup({ invalidDeparture = false, ambiguous = true } = {}){
 const f=fixture('507f1f77bcf86cd799439199');
 const row=f.history[2];if(ambiguous) f.history.push({...row,_id:'507f1f77bcf86cd799439299',aa_eggrafhs:'0004',pragmatikosMisthos:1900});
 if (invalidDeparture) {
  f.employee.hmeromhnia_apoxorhshs = '2025-12-31';
  f.history.slice(-2).forEach(row => { row.hmeromhnia_apoxorhshs = '2025-12-31'; });
 }
 const db=store([f]);
 const run=(changes={},extra={})=>W.writeEmployeeMaintenance({...db.deps,scope:{team:f.employee.team,company_kod:f.employee.company_kod,kodikos:f.employee.kodikos},employeeId:f.employee._id,actorUserId:'synthetic',
 userModel:{findById:()=>query({team:'TEST',situation:'A'})},privilegeModel:{findOne:()=>query({privileges:{update:true}})},input:{},maintenance:{employeeChanges:changes,submittedEmployeeFields:Object.keys(changes),historyChanges:{},submittedProfileFields:[],submittedFormValues:changes},...extra});
 return {db,run};
}
test('ambiguous ordinary Maintenance saves contact data and preserves all History',async()=>{
 const {db,run}=setup(),before=db.state();const r=await run({email:'synthetic@example.invalid'});
 assert.equal(r.ambiguousHistoryPreserved,true);assert.equal(r.employeeUpdated,true);assert.equal(r.historyUpdated,false);
 assert.equal(db.state().employees[0].email,'synthetic@example.invalid');assert.deepEqual(db.state().history,before.history);
});
test('all schema-owned Employee fields save, including fields shared with History',async()=>{
 const {db,run}=setup(),before=db.state();
 const changes={email:'synthetic@example.invalid',pragmatikosMisthos:2000,onoma:'ΣΥΝΘΕΤΙΚΟΣ',
  afm:'123456789',iban:'GR-SYNTHETIC',epoxikos:true,energos:false,arithmos_teknon:2};
 const result=await run(changes);
 assert.equal(result.employeeUpdated,true);
 for(const [field,value] of Object.entries(changes)) assert.equal(db.state().employees[0][field],value);
 assert.deepEqual(db.state().history,before.history);
});
for(const ambiguous of [false,true]) test(`manual active true -> false -> true, ambiguous=${ambiguous}`,async()=>{
 const {db,run}=setup({ambiguous});
 for(const energos of [false,true]) {
  const r=await run({energos});assert.equal(r.employee.energos,energos);
  assert.equal(db.state().employees[0].energos,energos);
 }
});
test('seasonal departure saves Employee and writes no History',async()=>{
 const {db,run}=setup(),before=db.state();
 const r=await run({epoxikos:true,hmeromhnia_apoxorhshs:'2026-10-01',energos:true});
 assert.equal(r.employee.energos,false);assert.equal(r.employee.epoxikos,true);
 assert.equal(new Date(r.employee.hmeromhnia_apoxorhshs).toISOString().slice(0,10),'2026-10-01');
 assert.deepEqual(db.state().history,before.history);
 assert.equal(db.events.some(e=>e.kind==='history' && e.type==='write'),false);
});
test('failed Employee write rolls back and never reports success',async()=>{
 const {db,run}=setup(),before=db.state();const original=db.deps.employeeModel.updateOne;
 db.deps.employeeModel.updateOne=async(filter,update,options)=>{
  if(update.$set?.email) throw new Error('synthetic Employee write failed');
  return original(filter,update,options);
 };
 await assert.rejects(run({email:'failed@example.invalid'}),/synthetic Employee write failed/);
 assert.deepEqual(db.state(),before);
});
test('ambiguous Maintenance does not bypass authorization',async()=>{
 const {db,run}=setup(),before=db.state();await assert.rejects(run({email:'synthetic@example.invalid'},{privilegeModel:{findOne:()=>query({privileges:{update:false}})}}),{code:'EMPLOYEE_HISTORY_MANAGEMENT_FORBIDDEN'});assert.deepEqual(db.state(),before);
});

test('saved departure cannot be cleared through Employee-only fallback', async () => {
 for (const changes of [{ hmeromhnia_apoxorhshs: null, energos: true },
  { hmeromhnia_apoxorhshs: '', email: 'synthetic@example.invalid', energos: false }]) {
  const { db, run } = setup({ invalidDeparture: true }), before = db.state();
  await assert.rejects(run(changes), { code: 'EMPLOYEE_DEPARTURE_CANCELLATION_PROVENANCE_REQUIRED' });
  assert.deepEqual(db.state(), before);
 }
});

for(const energos of [true,false]) test(`new Employee preserves Boolean energos=${energos}`,async()=>{
 const f=fixture('507f1f77bcf86cd799439199'),db=store([]);
 const result=await W.writeEmployeeEmploymentProfile({...db.deps,
  scope:{team:f.employee.team,company_kod:f.employee.company_kod,kodikos:f.employee.kodikos},
  newEmployee:{...f.employee,energos},effectiveFrom:'2026-03-01'});
 assert.equal(result.employee.energos,energos);
 assert.equal(db.state().employees[0].energos,energos);
});
test('stale Employee token prevents ambiguous save before any committed changes',async()=>{
 const {db,run}=setup(),before=db.state();
 await assert.rejects(run({onoma:'ΣΥΝΘΕΤΙΚΟΣ'},{expectedEmployeeStateToken:'stale'}),
  error=>String(error.code).includes('STALE'));
 assert.deepEqual(db.state(),before);
});

test('seasonal departure followed by another save still preserves History',async()=>{
 const {db,run}=setup(),before=db.state();
 await run({epoxikos:true,hmeromhnia_apoxorhshs:'2026-10-01',energos:true});
 const r=await run({onoma:'ΕΠΟΧΙΚΟΣ',energos:true});
 assert.equal(r.employee.onoma,'ΕΠΟΧΙΚΟΣ');assert.equal(r.employee.energos,false);
 assert.deepEqual(db.state().history,before.history);
});

for (const problem of ['missing', 'repairable', 'invalid-history-date', 'missing-identity']) test(`complete Employee save with ${problem} History`, async () => {
 const f=fixture('507f1f77bcf86cd799439199');
 if(problem==='missing') f.history=[];
 if(problem==='repairable') f.history.push({...f.history[2],_id:'507f1f77bcf86cd799439299'});
 if(problem==='invalid-history-date') f.history[1].hmeromhnia_proslhpshs='broken';
 if(problem==='missing-identity') f.history=f.history.slice(0,2);
 const db=store([f]),before=db.state();
 const changes={onoma:'ΣΥΝΘΕΤΙΚΟΣ',eponymo:'ΕΡΓΑΖΟΜΕΝΟΣ',afm:'123456789',energos:false,
  pragmatikosMisthos:2100,ores_ergasias_ebdomadas:35,hmeres_ergasias_ebdomadas:5,
  hmeromhnia_allaghs_symbashs:'2026-04-01',hmeromhnia_allaghs_orarioy_apo:'2026-04-01',
  hmeromhnia_allaghs_orarioy_eos:'2026-04-07',epoxikos:true,iban:'SYNTHETIC',email:'saved@example.invalid'};
 const result=await W.writeEmployeeMaintenance({...db.deps,scope:{team:f.employee.team,company_kod:f.employee.company_kod,kodikos:f.employee.kodikos},
  employeeId:f.employee._id,actorUserId:'synthetic',userModel:{findById:()=>query({team:'TEST',situation:'A'})},
  privilegeModel:{findOne:()=>query({privileges:{update:true}})},input:{},
  ambiguousSaveHasOtherActions:true,ambiguousSaveSchedules:()=>{throw Error('History must not gate schedules');},
  maintenance:{employeeChanges:changes,submittedEmployeeFields:Object.keys(changes),historyChanges:{aa_eggrafhs:'9999'},submittedFormValues:changes}});
 assert.equal(result.employeeUpdated,true);assert.equal(result.historyUpdated,false);
 for(const [field,value] of Object.entries(changes)) {
  const actual=result.employee[field];
  assert.equal(actual instanceof Date ? actual.toISOString().slice(0,10) : actual,value,field);
 }
 assert.deepEqual(db.state().history,before.history);
 assert.deepEqual(db.state().audits,before.audits);
 assert.equal(db.events.some(e=>e.kind==='history' && e.type==='write'),false);
});
test('Employee validation failure with ambiguous History never reports success',async()=>{
 const {db,run}=setup(),before=db.state();
 await assert.rejects(run({arithmos_teknon:'invalid-number',onoma:'ΣΥΝΘΕΤΙΚΟΣ'}));
 assert.deepEqual(db.state(),before);
});

test('all History mutation methods are forbidden during a full ambiguous Employee save',async()=>{
 const {db,run}=setup(),before=db.state();
 for(const method of ['create','updateOne','updateMany','deleteOne','deleteMany','bulkWrite','findOneAndUpdate']) {
  db.deps.historyModel[method]=()=>{throw Error('Forbidden History write: '+method);};
 }
 const result=await run({onoma:'ΕΡΓΑΖΟΜΕΝΟΣ',pragmatikosMisthos:2200,ores_ergasias_ebdomadas:35,
  epoxikos:true,hmeromhnia_apoxorhshs:'2026-10-01',energos:true});
 assert.equal(result.employeeUpdated,true);assert.equal(result.employee.pragmatikosMisthos,2200);
 assert.equal(result.employee.energos,false);assert.deepEqual(db.state().history,before.history);
});
test('a matched Employee update that did not persist the requested values cannot report success',async()=>{
 const {db,run}=setup(),before=db.state(),original=db.deps.employeeModel.updateOne;
 db.deps.employeeModel.updateOne=(filter,update,options)=>update.$set?.onoma
  ? Promise.resolve({matchedCount:1}) : original(filter,update,options);
 await assert.rejects(run({onoma:'NOT-PERSISTED'}),{code:'EMPLOYEE_HISTORY_AUTOMATIC_RECONSTRUCTION_FINAL_VERIFICATION_FAILED'});
 assert.deepEqual(db.state(),before);
});
test('controller preserves ordinary schedule/document continuation and reports History preservation at final response',()=>{
 const source=require('node:fs').readFileSync(require('node:path').join(__dirname,'../../controllers/ergazomenoi/ergazomenoiController.js'),'utf8');
 const start=source.indexOf('            maintenanceResult = result;');
 const schedules=source.indexOf('// ✅ 6) ΕΝΗΜΕΡΩΣΗ ΩΡΑΡΙΩΝ',start);
 assert.ok(start>0&&schedules>start);
 assert.doesNotMatch(source.slice(start,schedules),/if \(result\.ambiguousHistoryPreserved/);
 assert.match(source.slice(schedules),/ambiguousHistoryPreserved: maintenanceResult\?\.ambiguousHistoryPreserved === true/);
 assert.doesNotMatch(source.slice(start,schedules),/EMPLOYEE_PROFILE_AMBIGUOUS_CHANGES_BLOCKED/);
});
