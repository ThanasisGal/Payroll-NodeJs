'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const W = require('./employeeEmploymentProfileWriter');
const { store, fixture } = require('../../../test/fixtures/employeeProfileTransactionStore');
const { persisted0030 } = require('./fixtures/tha0030SanitizedMaintenanceFixture');
const { legacyWeeklyHours } = require('./fixtures/maintenanceWeeklyHoursLegacyFixture');
const { tha0030DepartureStructure } = require('./fixtures/tha0030SanitizedDepartureReconstructionFixture');
const A = require('./employeeHistoryAutomaticReconstructionApplyContract');
const { planEmployeeHistoryAutomaticReconstruction: reconstructionPlanner } = require('./employeeHistoryAutomaticReconstructionPlannerService');
const { accessForUser, assertEmployeeHistoryOperationsAuthorized } = require('./employeeHistoryAuthorizationService');
const START = 'hmeromhnia_isxyos_oron_ergasias_apo';
const END = 'hmeromhnia_isxyos_oron_ergasias_eos';
const DEPARTURE = 'hmeromhnia_apoxorhshs';
const query = value => ({ select() { return this; }, session() { return this; }, lean: async () => value });
function setup(input = persisted0030(), role = 'U') {
    const db = store([{ employee: input.employee, history: input.history }]);
    const request = { ...db.deps, scope: input.scope || {team:input.employee.team,company_kod:input.employee.company_kod,kodikos:input.employee.kodikos},
        employeeId: String(input.employee._id), actorUserId: 'synthetic-actor',
        userModel: { findById: () => query({ situation: 'A', team: input.employee.team, privileges: role }) },
        privilegeModel: { findOne: () => query({ privileges: { update: true } }) },
        correctionCatalogLoader: async () => ({}), departureAuditContextLoader: async () => [] };
    const payload = (changes, extra = {}) => ({ ...request, input: {}, maintenance: {
        employeeChanges: changes, submittedEmployeeFields: Object.keys(changes),
        historyChanges: Object.fromEntries(Object.entries(changes).filter(([f]) => !['email','iban'].includes(f))),
        submittedProfileFields: [], submittedFormValues: changes }, ...extra });
    return { db, request, payload, run: (changes = {}, extra) => W.writeEmployeeMaintenance(payload(changes, extra)) };
}
const day = value => value ? new Date(value).toISOString().slice(0,10) : null;
function oneCommit(db, start = 0) {
    const events = db.events.slice(start);
    assert.equal(events.filter(e => e.type === 'commit').length, 1);
    assert.equal(events.filter(e => e.type === 'fence').length, 1);
    assert.equal(new Set(events.map(e => e.session)).size, 1);
}
function unchanged(db, before) { assert.deepEqual(db.state(), before); assert.equal(db.events.some(e=>e.type==='commit'),false); }
for (const [label, changes] of [
    ['only', {}], ['employee-only', {email:'synthetic@example.invalid',iban:'SYNTHETIC'}],
    ['profile', {pragmatikosMisthos:1700,ores_ergasias_ebdomadas:35}],
    ['boundary', {[START]:'2026-07-23'}],
    ['combined', {email:'synthetic@example.invalid',pragmatikosMisthos:1700,ores_ergasias_ebdomadas:35,[START]:'2026-07-23'}]
]) test(`cancellation ${label}: restored state then explicit intent, one commit, exact identities`, async () => {
    const {run,db}=setup(), before=db.state(); const r=await run({[DEPARTURE]:null,...changes});
    const after=db.state(),current=after.employees[0],last=after.history.find(x=>x.aa_eggrafhs==='0003');
    assert.equal(current.energos,false);assert.equal(current[DEPARTURE],null);assert.equal(current.employment_departure_restore,null);
    assert.equal(current[END],null);assert.equal(day(last[END]),'2026-10-15');assert.equal(last[DEPARTURE],null);
    for(const [f,v] of Object.entries(changes)) { assert.equal(day(f===START?current[f]:null), f===START?v:null); if(f!==START)assert.deepEqual(current[f],v); }
    assert.deepEqual(after.history.map(x=>[x._id,x.aa_eggrafhs]).sort(),before.history.map(x=>[x._id,x.aa_eggrafhs]).sort());
    assert.deepEqual(after.history.find(x=>x.aa_eggrafhs==='0001'),before.history.find(x=>x.aa_eggrafhs==='0001'));
    assert.equal(after.audits.filter(x=>x.mutationSource==='CANCEL_DEPARTURE').length,1);oneCommit(db);
    assert.equal(r.automaticReconstructionApplied,false);
});
test('cancellation explicit new end overrides restored end',async()=>{
    const {run,db}=setup();await run({[DEPARTURE]:null,[END]:'2026-11-01'});
    assert.equal(day(db.state().employees[0][END]),'2026-11-01');
    assert.equal(day(db.state().history.find(x=>x.aa_eggrafhs==='0003')[END]),'2026-11-01');
});
for(const requested of ['2026-10-03','2026-10-05'])test(`correction ${requested} plus employee/profile facts follows owned ends`,async()=>{
    const {run,db}=setup();await run({[DEPARTURE]:requested,email:'synthetic@example.invalid',pragmatikosMisthos:1700});
    const after=db.state();assert.equal(day(after.employees[0][END]),requested);
    const last=after.history.find(x=>x.aa_eggrafhs==='0003');assert.equal(day(last[END]),requested);assert.equal(day(last[DEPARTURE]),requested);
    assert.equal(last.pragmatikosMisthos,1700);assert.equal(after.employees[0].email,'synthetic@example.invalid');
    assert.equal(after.audits[0].mutationSource,'HISTORY_DEPARTURE_DATE_CORRECTION');oneCommit(db);
});
test('independent earlier end does not follow departure correction',async()=>{
    const input=persisted0030();input.employee[END]=new Date('2026-09-30');input.history.find(x=>x.aa_eggrafhs==='0003')[END]=new Date('2026-09-30');
    Object.assign(input.employee.employment_departure_restore,{employee_end_clamped:false,profile_end_clamped:false});
    const {run,db}=setup(input);await run({[DEPARTURE]:'2026-10-05'});assert.equal(day(db.state().employees[0][END]),'2026-09-30');
});
test('0030 23 -> 24 -> 23 is reversible, same physical target, gaps and adjacency valid',async()=>{
    const input=persisted0030();input.employee[START]=new Date('2026-07-23');input.history.find(x=>x.aa_eggrafhs==='0003')[START]=new Date('2026-07-23');
    const {run,db}=setup(input);const target=input.history.find(x=>x.aa_eggrafhs==='0003')._id;
    await run({[START]:'2026-07-24'});await run({[START]:'2026-07-23'});
    assert.equal(day(db.state().history.find(x=>x._id===target)[START]),'2026-07-23');
    assert.equal(day(db.state().history.find(x=>x.aa_eggrafhs==='0002')[END]),'2026-07-22');
});
for(const cancel of [false,true])test(`History overlap preserves History and saves valid Employee, cancel=${cancel}`,async()=>{
 const {run,db}=setup(),before=db.state();
 const result=await run({[START]:'2026-07-22',...(cancel?{[DEPARTURE]:null,energos:true}:{})});
 assert.equal(day(result.employee[START]),'2026-07-22');assert.equal(result.historyUpdated,false);
 assert.deepEqual(db.state().history,before.history);
 if(cancel)assert.equal(result.employee.energos,true);
});
test('missing History cancellation provenance permits Employee cancellation without History mutation',async()=>{
 const input=persisted0030();delete input.employee.employment_departure_restore;
 const {run,db}=setup(input),before=db.state();const result=await run({[DEPARTURE]:null,energos:true});
 assert.equal(result.employee[DEPARTURE],null);assert.equal(result.employee.energos,true);
 assert.deepEqual(db.state().history,before.history);
});
for(const changes of [{email:'synthetic@example.invalid'}, {pragmatikosMisthos:1700},
    {pragmatikosMisthos:1700,ores_ergasias_ebdomadas:35}, {email:'synthetic@example.invalid',pragmatikosMisthos:1700}])
test(`active ordinary save ${Object.keys(changes).join('+')}`,async()=>{
    const input=fixture();const {run,db}=setup(input),before=db.state();const r=await run(changes);oneCommit(db);
    if(Object.keys(changes).every(f=>f==='email'))assert.deepEqual(db.state().history,before.history);
    else assert.equal(db.state().history.find(x=>x._id===input.history[2]._id).pragmatikosMisthos,1700);
    assert.equal(r.automaticReconstructionApplied,false);
});
test('passive empty/null/false/array/catalog/derived echoes do not create separate-save',async()=>{
    const input=persisted0030();Object.assign(input.employee,{forologikh_klimaka:'20260101',foreas_epikoyrikhs_asfalishs:['001'],typos_metabolhs:['A']});
    const {run,db}=setup(input);await run({[DEPARTURE]:null,email:'',typos_ergodoth_daneismoy:false,
        foreas_epikoyrikhs_asfalishs:['["001"]'],typos_metabolhs:'["A"]',forologikh_klimaka:'0101',synolo_proyphresias_se_eth:999});
    assert.equal(db.state().employees[0].forologikh_klimaka,'20260101');assert.deepEqual(db.state().employees[0].foreas_epikoyrikhs_asfalishs,['001']);
});
for(const [label,mutate,changes,code] of [
    ['before hire',()=>{}, {[DEPARTURE]:'2026-01-01'},'EMPLOYEE_DEPARTURE_BEFORE_HIRE'],
])test(`${label} fails closed`,async()=>{const input=persisted0030();mutate(input);const {run,db}=setup(input),before=db.state();await assert.rejects(run(changes),{code});unchanged(db,before);});
test('stale expected target revision blocks',async()=>{const {run,db}=setup(),before=db.state();await assert.rejects(run({[DEPARTURE]:null},{maintenance:{employeeChanges:{[DEPARTURE]:null},expectedRevision:'2000-01-01'}}),{code:'EMPLOYEE_PROFILE_STALE'});unchanged(db,before);});
test('failure after business writes rolls back fence, employee, history and audits',async()=>{
    const {run,db}=setup(),before=db.state();db.hooks.beforeCommit=()=>{throw Error('synthetic failure after all writes');};
    await assert.rejects(run({[DEPARTURE]:null,email:'synthetic@example.invalid',pragmatikosMisthos:1700}),/synthetic failure/);unchanged(db,before);
});
for(const role of ['U','HR','C','S','A'])test(`${role}: employee capability permits sync, manual capability unchanged`,async()=>{
    const {run}=setup(persisted0030(),role);await run({[DEPARTURE]:null,pragmatikosMisthos:1700});
    const access=accessForUser({privileges:role,team:'TEST',situation:'A'});
    if(['U','HR','C'].includes(role))for(const state of ['modified','deleted','inserted'])assert.throws(()=>assertEmployeeHistoryOperationsAuthorized({accessMode:access.mode,operations:[{state,historyId:'arbitrary'}]}),{code:'EMPLOYEE_HISTORY_MANAGEMENT_FORBIDDEN'});
});
for(const denied of ['inactive','other-team','no-update','no-actor'])test(`maintenance authorization ${denied}`,async()=>{
    const {run,request,db}=setup(),before=db.state();
    if(denied==='inactive')request.userModel.findById=()=>query({situation:'D',team:'TEST'});
    if(denied==='other-team')request.userModel.findById=()=>query({situation:'A',team:'OTHER'});
    if(denied==='no-update')request.privilegeModel.findOne=()=>query({privileges:{read:true}});
    if(denied==='no-actor')request.actorUserId=null;
    await assert.rejects(run({email:'synthetic@example.invalid'}),{code:'EMPLOYEE_HISTORY_MANAGEMENT_FORBIDDEN'});unchanged(db,before);
});
test('pre-fix proof: original wrapper invents 0030 overlap; unified intent succeeds',async()=>{
    const {payload,run,db}=setup(),before=db.state();
    const request=payload({[START]:'2026-07-23'});
    request.userModel={findById:()=>query({situation:'A',team:'ALL',privileges:'S'})};
    // Isolate the old ordering using its authorized Admin fixture.
    const input=persisted0030();input.scope.team='THA';input.employee.team='THA';input.history.forEach(x=>x.team='THA');
    const old=setup(input,'A');
    await assert.rejects(W.writeEmployeeEmploymentProfileWithAutomaticReconstruction({...old.payload({[START]:'2026-07-23'}),effectiveFrom:'2026-07-23'}),{code:'CONFLICT_OVERLAP'});
    unchanged(db,before);await run({[START]:'2026-07-23'});
});
test('pre-fix proof: raw cancellation guard rejects a passive empty field',async()=>{
    const {payload,run}=setup();const changes={[DEPARTURE]:null,typos_ergodoth_daneismoy:false};
    await assert.rejects(W.writeEmployeeDepartureCancellation(payload(changes)),{code:'EMPLOYEE_DEPARTURE_CANCELLATION_SEPARATE_SAVE_REQUIRED'});
    await run(changes);
});
test('pre-fix proof: date correction mixed-field guard rejects legitimate email',async()=>{
    const {payload,run}=setup();const changes={[DEPARTURE]:'2026-10-03',email:'synthetic@example.invalid'};
    await assert.rejects(W.writeEmployeeDepartureDateCorrection({...payload(changes),requestedDepartureDate:'2026-10-03'}),{code:'EMPLOYEE_DEPARTURE_PROFILE_CHANGE_REQUIRES_SEPARATE_SAVE'});
    await run(changes);
});
function reconstructionInput() {
    const raw=tha0030DepartureStructure({missingLatestValidity:true});
    const plain=v=>v instanceof Date?new Date(v):v?.toHexString?v.toHexString():Array.isArray(v)?v.map(plain):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,plain(x)])):v;
    return plain({scope:raw.scope,employee:raw.currentEmployee,history:raw.completeHistoryRows});
}
test('problematic departure History saves full Employee intent without reconstruction or History writes',async()=>{
 const {run,db}=setup(reconstructionInput()),before=db.state();
 const result=await run({[DEPARTURE]:'2026-10-04',email:'synthetic@example.invalid',pragmatikosMisthos:1900});
 assert.equal(result.employeeUpdated,true);assert.equal(result.historyUpdated,false);
 assert.equal(result.employee.email,'synthetic@example.invalid');assert.equal(result.employee.pragmatikosMisthos,1900);
 assert.equal(result.employee.energos,false);assert.deepEqual(db.state().history,before.history);
 assert.deepEqual(db.state().audits,before.audits);oneCommit(db);
});
for(const change of ['employee','history','reference-fence','schedule']) test(`problematic History respects concurrent ${change} state`,async()=>{
 const {run,db,request}=setup(reconstructionInput());
 const token=require('../../utils/ergazomenoi/employeeSaveState').employeeStateToken(db.state().employees[0]);
 if(change==='employee')db.changeCommittedEmployee(request.employeeId,{email:'concurrent@example.invalid'});
 else db.changeCommittedHistory(db.state().history[0]._id, change==='reference-fence'?{history_reference_fence:99}
  :change==='schedule'?{hmeromhnia_allaghs_orarioy_apo:new Date('2026-09-01')}:{nomimosMisthos:9999});
 const before=db.state();
 if(change==='employee') {await assert.rejects(run({pragmatikosMisthos:1900},{expectedEmployeeStateToken:token}),{code:'EMPLOYEE_SAVE_STATE_STALE'});unchanged(db,before);}
 else {const result=await run({pragmatikosMisthos:1900},{expectedEmployeeStateToken:token});
  assert.equal(result.employee.pragmatikosMisthos,1900);assert.deepEqual(db.state().history,before.history);}
});
test('reconstruction NO_OP cannot become a required remedy for a real blocked save',async()=>{
    const {run,db}=setup(),before=db.state();const plan=reconstructionPlanner({scope:persisted0030().scope,currentEmployee:before.employees[0],completeHistoryRows:before.history});
    // The requested final boundary makes reconstruction NO_OP; it must execute
    // directly rather than presenting the old wrapper's gap-filling proposal.
    await run({[START]:'2026-07-23'});assert.equal(A.isNoOp(reconstructionPlanner({scope:persisted0030().scope,currentEmployee:db.state().employees[0],completeHistoryRows:db.state().history})),true);
    assert.equal(db.state().audits.some(x=>x.mutationSource===A.OPERATION),false);assert.ok(plan.rowDiffs.length);
});
test('unknown protected reference semantics fail closed',async()=>{
    const {run,db,request}=setup(),before=db.state();request.referenceChecker=async()=>[{collection:'Unsupported_live_reference',documentId:'synthetic'}];
    await assert.rejects(run({[DEPARTURE]:null,pragmatikosMisthos:1700}),{code:'EMPLOYEE_HISTORY_REFERENCE_CHECK_FAILED'});unchanged(db,before);
});
test('concurrent Employee change during discovery is caught before commit',async()=>{
    const {run,db,request}=setup();let once=true;
    db.hooks.read=(session,kind)=>{if(once&&kind==='history'){once=false;db.changeCommittedEmployee(request.employeeId,{[DEPARTURE]:new Date('2026-10-05')});}};
    await assert.rejects(run({[DEPARTURE]:null},{expectedStoredDeparture:'2026-10-04'}),{code:'EMPLOYEE_DEPARTURE_DATE_CORRECTION_STALE'});
    assert.equal(db.events.some(e=>e.type==='commit'),false);assert.equal(db.state().employees[0].energos,false);
});

test('repeated Maintenance of problematic History saves Employee without structural cleanup',async()=>{
 const {run,db}=setup(reconstructionInput());
 await run({[DEPARTURE]:'2026-10-04'});const before=db.state();
 const result=await run({email:'next@example.invalid',pragmatikosMisthos:1700});
 assert.equal(result.historyUpdated,false);assert.equal(result.employee.email,'next@example.invalid');
 assert.deepEqual(db.state().history,before.history);assert.deepEqual(db.state().audits,before.audits);
});
for(const [label,input,changes] of [
    ['boundary',persisted0030(),{[START]:'2026-07-23'}],
    ['first departure',fixture(),{[DEPARTURE]:'2026-10-04',email:'synthetic@example.invalid'}],
    ['correction',persisted0030(),{[DEPARTURE]:'2026-10-03',pragmatikosMisthos:1700}],
    ['cancellation',persisted0030(),{[DEPARTURE]:null,email:'synthetic@example.invalid'}]
])test(`normal U role authorized ${label} without manual History privilege`,async()=>{
    const {run,db}=setup(input,'U');await run(changes);oneCommit(db);
    assert.equal(accessForUser({privileges:'U',team:input.employee.team,situation:'A'}).mode,'NONE');
});
test('boundary requested after departure is a genuine conflict, zero committed changes',async()=>{
    const {run,db}=setup(),before=db.state();
    await assert.rejects(run({[START]:'2026-10-06'}));unchanged(db,before);
});
test('Employee maintenance cannot transfer its authority to another employee scope',async()=>{
    const {run,request,db}=setup(),before=db.state();request.scope={...request.scope,company_kod:'another-company'};
    await assert.rejects(run({email:'synthetic@example.invalid'}));unchanged(db,before);
});
test('frozen protected references survive a legitimate current profile correction',async()=>{
    const {run,request,db}=setup();request.referenceChecker=async()=>[{collection:'Oraria_Apologistika',documentId:'synthetic-frozen'}];
    await run({[DEPARTURE]:'2026-10-03',pragmatikosMisthos:1700});oneCommit(db);
});
for(const role of ['U','C','HR','S']) test(`legacy weekly hours 40 -> 39 (${role}): Employee saves, History remains byte-identical`,async()=>{
 const {run,db}=setup(legacyWeeklyHours(),role),before=db.state();
 const result=await run({ores_ergasias_ebdomadas:39});oneCommit(db);
 assert.equal(result.employee.ores_ergasias_ebdomadas,39);assert.equal(result.historyUpdated,false);
 assert.deepEqual(db.state().history,before.history);assert.deepEqual(db.state().audits,before.audits);
 await run({ores_ergasias_ebdomadas:38});assert.equal(db.state().employees[0].ores_ergasias_ebdomadas,38);
 assert.deepEqual(db.state().history,before.history);
});
test('commit failure rolls back Employee and fence while preserving problematic History',async()=>{
 const {run,db}=setup(legacyWeeklyHours()),before=db.state();
 db.hooks.beforeCommit=()=>{throw Error('synthetic composite commit failure');};
 await assert.rejects(run({ores_ergasias_ebdomadas:39}),/synthetic composite commit failure/);unchanged(db,before);
});
test('History reference problems do not gate Employee-only updates',async()=>{
 const {run,request,db}=setup(legacyWeeklyHours()),before=db.state();
 request.referenceChecker=async()=>{throw Error('History references must not be touched');};
 const result=await run({ores_ergasias_ebdomadas:39});
 assert.equal(result.employee.ores_ergasias_ebdomadas,39);assert.equal(result.historyUpdated,false);
 assert.deepEqual(db.state().history,before.history);
});
