"use strict";
const {test,before,after,mock}=require('node:test'),assert=require('node:assert/strict');
const P=require('./employeeHistorySaveValidationService'),W=require('./employeeEmploymentProfileWriter');
const H=require('../../utils/ergazomenoi/employmentProfileHistory'),S=require('../../utils/ergazomenoi/employeeSaveState');
const {store}=require('../../../test/fixtures/employeeProfileTransactionStore');
const {clone}=require('./employeeHistoryAutomaticSettlementPreparationContract');
const F=require('../../../test/fixtures/employee0015ReviewFixture');
const scope={team:'TEST',company_kod:'610000000000000000000001',kodikos:'0031'};
const actorUserId='700000000000000000000001',q=value=>({select(){return this;},session(){return this;},lean:async()=>value});
const auth={actorUserId,userModel:{findById:()=>q({_id:actorUserId,team:'TEST',situation:'A'})},privilegeModel:{findOne:()=>q({privileges:{create:true,update:true}})}};
before(()=>{require('../../../test/fixtures/forbidRealSettlementMongo').forbidRealSettlementMongo(mock);
 mock.method(require('../../models/companies').CompaniesModel,'findOne',()=>q({_id:scope.company_kod}));});
after(()=>mock.restoreAll());
function facts(){return {...scope,eponymo:'ΣΥΝΘΕΤΙΚΟΣ',onoma:'ΕΡΓΑΖΟΜΕΝΟΣ',afm:'123456789',_id:'507f1f77bcf86cd799439199',hmeromhnia_proslhpshs:'2026-04-01',hmeromhnia_lhxhs_symbashs:'2026-10-31',
 hmeres_ergasias_ebdomadas:5,ores_ergasias_ebdomadas:40,mo_oron_hmerhsias_ergasias:8,kathestos_apasxolhshs:'0',typos_apasxolhshs:'0',typos_ebdomadas:'5HMERH',
 krathsh_01:'0101',symbash:'01',kathgoria_symbashs:'01',eidikothta_symbashs:'01',nomimosMisthos:1200,pragmatikosMisthos:1300,synolo_symbashs:1300,
 evelikth_proselefsh:0,symbatikes_ores_ergasias:40,dialleima_se_lepta:0,energos:true,oristikh_enhmerosh:true};}
function aggregate(){const source=facts(),row={...H.buildCompleteProfileSnapshot({current:source,effectiveFrom:'2026-04-01'}),...scope,
 _id:'507f1f77bcf86cd799439101',aa_eggrafhs:'0001',afora_proslhpsh:true,createdAt:new Date('2026-04-01'),updatedAt:new Date('2026-04-01')};
 return {employee:{...source,...row,_id:source._id},history:[row]};}
const inspect=f=>P.inspectEmployeeHistorySave({scope,currentEmployee:f.employee,historyRows:f.history});
test('strict 0031 complete synthetic state is CLEAN',()=>assert.equal(inspect(aggregate()).status,'CLEAN'));
test('recorded rotating two-day week is complete without a five/six-day label',()=>{
 const f=aggregate();for(const row of [f.employee,...f.history])Object.assign(row,{
  hmeres_ergasias_ebdomadas:2,ores_ergasias_ebdomadas:16,typos_ebdomadas:'',kathestos_apasxolhshs:'2',typos_apasxolhshs:'2'});
 assert.equal(inspect(f).status,'CLEAN');
});
test('a five-day profile still requires its week label',()=>{
 const f=aggregate();for(const row of [f.employee,...f.history])row.typos_ebdomadas='';
 assert.notEqual(inspect(f).status,'CLEAN');
});
test('one recorded valid employment-type alias is sufficient evidence',()=>{
 const f=aggregate();for(const row of [f.employee,...f.history])delete row.kathestos_apasxolhshs;
 assert.equal(inspect(f).status,'CLEAN');
});
for(const kind of ['absent','conflicting','invalid-canonical'])test(`employment type ${kind} remains blocked`,()=>{
 const f=aggregate();for(const row of [f.employee,...f.history]){
  if(kind==='absent'){delete row.kathestos_apasxolhshs;delete row.typos_apasxolhshs;}
  if(kind==='conflicting')row.typos_apasxolhshs='1';
  if(kind==='invalid-canonical')row.kathestos_apasxolhshs='INVALID';
 }
 assert.notEqual(inspect(f).status,'CLEAN');
});
for(const field of ['krathsh_01','symbash','kathgoria_symbashs','eidikothta_symbashs','nomimosMisthos','pragmatikosMisthos','hmeres_ergasias_ebdomadas','ores_ergasias_ebdomadas'])
 test(`complete state rejects missing ${field}`,()=>{const f=aggregate();delete f.history[0][field];assert.notEqual(inspect(f).status,'CLEAN');});
for(const mode of ['gap','overlap','duplicate','after-departure','current-mismatch','closed-active','before-hire'])test(`full proposed state blocks ${mode}`,()=>{
 const f=aggregate(),row=f.history[0];
 if(mode==='gap')row.hmeromhnia_isxyos_oron_ergasias_apo='2026-04-02';
 if(mode==='overlap'||mode==='duplicate')f.history.push({...row,_id:'507f1f77bcf86cd799439102',aa_eggrafhs:'0002',afora_proslhpsh:false});
 if(mode==='after-departure'){f.employee.hmeromhnia_apoxorhshs='2026-09-15';row.hmeromhnia_isxyos_oron_ergasias_eos='2026-10-31';}
 if(mode==='current-mismatch')f.employee.pragmatikosMisthos=1500;
 if(mode==='closed-active')row.hmeromhnia_isxyos_oron_ergasias_eos='2026-09-15';
 if(mode==='before-hire')row.hmeromhnia_isxyos_oron_ergasias_apo='2026-03-31';
 assert.notEqual(inspect(f).status,'CLEAN');});
test('hire includes its new History row before final creation commits and reloads CLEAN',async()=>{
 const db=store([],{cloneFn:clone});await W.writeEmployeeEmploymentProfile({...db.deps,scope,newEmployee:facts(),effectiveFrom:'2026-04-01'});
 const f=db.state();assert.equal(f.history.length,1);assert.equal(f.history[0].afora_proslhpsh,true);
 assert.equal(inspect({employee:f.employees[0],history:f.history}).status,'CLEAN');});
for(const field of ['krathsh_01','pragmatikosMisthos','symbash'])test(`invalid final hire ${field} rolls back completely`,async()=>{
 const db=store([],{cloneFn:clone}),employee=facts();delete employee[field];const before=db.state();
 await assert.rejects(W.writeEmployeeEmploymentProfile({...db.deps,scope,newEmployee:employee,effectiveFrom:'2026-04-01'}),{code:'EMPLOYEE_SAVE_HISTORY_NOT_CLEAN'});assert.deepEqual(db.state(),before);});
test('temporary hire needs no History and failed finalization remains temporary',async()=>{
 const db=store([],{cloneFn:clone});const d=await W.writeEmployeeDraft({...db.deps,...auth,scope,newEmployee:{...scope,eponymo:'Συνθετικός',onoma:'Προσωρινός',afm:'123456789',hmeromhnia_proslhpshs:'2026-04-01'}});
 assert.equal(db.state().history.length,0);assert.equal(d.employee.oristikh_enhmerosh,false);
 const before=db.state();await assert.rejects(W.writeEmployeeMaintenance({...db.deps,...auth,scope,employeeId:String(d.employee._id),
 expectedEmployeeStateToken:d.employeeStateToken,maintenance:{employeeChanges:{hmeromhnia_proslhpshs:'2026-04-01'},historyChanges:{}}}));
 assert.deepEqual(db.state(),before);});
test('complete draft finalizes atomically and reloads CLEAN',async()=>{
 const db=store([],{cloneFn:clone}),d=await W.writeEmployeeDraft({...db.deps,...auth,scope,newEmployee:facts()});
 const r=await W.writeEmployeeMaintenance({...db.deps,...auth,scope,employeeId:String(d.employee._id),expectedEmployeeStateToken:d.employeeStateToken,
 maintenance:{employeeChanges:{},historyChanges:{}},scheduleModel:{find:()=>q([]),create:async()=>assert.fail('No schedules requested')}});
 assert.equal(r.firstFinalization,true);assert.equal(db.state().history.length,1);
 assert.equal(inspect({employee:db.state().employees[0],history:db.state().history}).status,'CLEAN');});
test('valid appended terms use the existing writer and preserve the preceding identity',async()=>{
 const f=aggregate(),db=store([f],{cloneFn:clone});await W.writeEmployeeEmploymentProfile({...db.deps,scope,employeeId:f.employee._id,effectiveFrom:'2026-06-01'});
 const final=db.state();assert.equal(final.history.length,2);assert.equal(String(final.history[0]._id),String(f.history[0]._id));
 assert.equal(inspect({employee:final.employees[0],history:final.history}).status,'CLEAN');});
test('a new invalid History append is rejected atomically despite the read-only execution fallback',async()=>{
 const f=aggregate(),db=store([f],{cloneFn:clone}),before=db.state();
 await assert.rejects(W.writeEmployeeEmploymentProfile({...db.deps,scope,employeeId:f.employee._id,
  effectiveFrom:'2026-06-01',maintenance:{employeeChanges:{},historyChanges:{hmeres_ergasias_ebdomadas:0}}}));
 assert.deepEqual(db.state(),before);
});
test('legacy 0015 independent email save preserves every physical row and audit',async()=>{
 const d=F.data(),db=store([{employee:d.currentEmployee,history:d.completeHistoryRows}],{cloneFn:clone}),before=db.state();
 const r=await W.writeEmployeeMaintenance({...db.deps,...auth,scope:d.scope,employeeId:d.currentEmployee._id,
 maintenance:{employeeChanges:{email:'synthetic@example.invalid'},submittedEmployeeFields:['email'],historyChanges:{},submittedHistoryChanges:{},submittedProfileFields:[]}});
 assert.equal(r.historyStatus,'LEGACY_REVIEW_REQUIRED');assert.equal(r.historyAccessMode,'READ_ONLY');assert.equal(r.historyAlreadyClean,false);
 assert.deepEqual(db.state().history,before.history);assert.deepEqual(db.state().audits,before.audits);});
test('legacy 0015 salary change is blocked without changing Employee or History',async()=>{
 const d=F.data(),db=store([{employee:d.currentEmployee,history:d.completeHistoryRows}],{cloneFn:clone}),before=db.state();
 await assert.rejects(W.writeEmployeeMaintenance({...db.deps,...auth,scope:d.scope,employeeId:d.currentEmployee._id,
 maintenance:{employeeChanges:{pragmatikosMisthos:1400},submittedEmployeeFields:['pragmatikosMisthos'],historyChanges:{},submittedHistoryChanges:{},submittedProfileFields:[]}}),{code:'EMPLOYEE_SAVE_LEGACY_HISTORY_READ_ONLY'});
 assert.deepEqual(db.state(),before);});
test('late audit failure rolls back approved valid append',async()=>{
 const f=aggregate(),db=store([f],{cloneFn:clone}),before=db.state();db.deps.auditModel.create=async()=>{throw Error('SYNTHETIC_AUDIT_FAILURE');};
 await assert.rejects(W.writeEmployeeEmploymentProfile({...db.deps,scope,employeeId:f.employee._id,effectiveFrom:'2026-06-01'}),/SYNTHETIC_AUDIT_FAILURE/);assert.deepEqual(db.state(),before);});

test('legacy NO_OP makes no write, revision, mutation sequence or audit',async()=>{
 const d=F.data(),db=store([{employee:d.currentEmployee,history:d.completeHistoryRows}],{cloneFn:clone}),before=db.state();
 const r=await W.writeEmployeeMaintenance({...db.deps,...auth,scope:d.scope,employeeId:d.currentEmployee._id,
 maintenance:{employeeChanges:{},historyChanges:{},submittedHistoryChanges:{},submittedProfileFields:[]}});
 assert.equal(r.historyStatus,'LEGACY_REVIEW_REQUIRED');assert.deepEqual(db.state(),before);
 assert.equal(db.events.some(e=>['write','fence'].includes(e.type)),false);
});
for(const mutation of [{effectiveFrom:'2026-04-02'}, {effectiveFrom:'2026-03-31'}])test(`new hire ${mutation.effectiveFrom} fails without a partial final record`,async()=>{
 const db=store([],{cloneFn:clone}),before=db.state();await assert.rejects(W.writeEmployeeEmploymentProfile({...db.deps,scope,newEmployee:facts(),...mutation}));
 assert.deepEqual(db.state(),before);
});
for(const field of ['krathsh_01','pragmatikosMisthos'])test(`actual correction clearing ${field} cannot commit`,async()=>{
 const f=aggregate(),db=store([f],{cloneFn:clone}),before=db.state();
 await assert.rejects(W.writeEmployeeEmploymentProfile({...db.deps,scope,employeeId:f.employee._id,effectiveFrom:'2026-04-01',
 mode:W.MODE_CORRECT_EXISTING,historyId:f.history[0]._id,maintenance:{employeeChanges:{},historyChanges:{[field]:null}}}));
 assert.deepEqual(db.state(),before);
});
test('parallel valid profile versions serialize without duplicate periods',async()=>{
 const f=aggregate(),db=store([f],{cloneFn:clone}),run=()=>W.writeEmployeeEmploymentProfile({...db.deps,scope,employeeId:f.employee._id,effectiveFrom:'2026-06-01'});
 const results=await Promise.allSettled([run(),run()]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 assert.equal(db.state().history.length,2);assert.equal(inspect({employee:db.state().employees[0],history:db.state().history}).status,'CLEAN');
});

test('departure preserves contractual end and independently verifies coverage',async()=>{
 const f=aggregate(),db=store([f],{cloneFn:clone});
 await W.writeEmployeeDeparture({...db.deps,scope,employeeId:f.employee._id,departureDate:'2026-09-15'});
 const state=db.state();assert.equal(new Date(state.employees[0].hmeromhnia_apoxorhshs).toISOString().slice(0,10),'2026-09-15');
 assert.equal(new Date(state.employees[0].hmeromhnia_lhxhs_symbashs).toISOString().slice(0,10),'2026-10-31');
 assert.equal(inspect({employee:state.employees[0],history:state.history}).status,'CLEAN');
});
test('first departure forwards the same transactional audit dependencies to its baseline writer',async()=>{
 const f=aggregate(),db=store([{employee:f.employee,history:[]}],{cloneFn:clone});let checked=0;
 const r=await W.writeEmployeeDeparture({...db.deps,scope,employeeId:f.employee._id,
  departureDate:'2026-04-01',effectiveFrom:'2026-04-01',
  auditCollectionChecker:async()=>{checked++;return true;}});
 assert.equal(checked,1);assert.equal(db.state().audits.length,1);assert.equal(db.state().history.length,1);
 assert.equal(inspect({employee:db.state().employees[0],history:db.state().history}).status,'CLEAN');
});
test('stale maintenance is rejected before any write',async()=>{
 const f=aggregate(),db=store([f],{cloneFn:clone}),before=db.state();
 await assert.rejects(W.writeEmployeeMaintenance({...db.deps,...auth,scope,employeeId:f.employee._id,expectedEmployeeStateToken:'stale',maintenance:{employeeChanges:{email:'x@example.invalid'},historyChanges:{}}}),{code:'EMPLOYEE_SAVE_STATE_STALE'});assert.deepEqual(db.state(),before);
});

test('strict CLEAN -> NO_OP Save -> reload CLEAN has zero historical or Employee revision changes',async()=>{
 const f=aggregate(),db=store([f],{cloneFn:clone}),before=db.state();
 const r=await W.writeEmployeeMaintenance({...db.deps,...auth,scope,employeeId:f.employee._id,expectedEmployeeStateToken:S.employeeStateToken(f.employee),maintenance:{employeeChanges:{},historyChanges:{},submittedHistoryChanges:{},submittedProfileFields:[]}});
 assert.equal(r.historyAlreadyClean,true);assert.deepEqual(db.state(),before);assert.equal(inspect({employee:db.state().employees[0],history:db.state().history}).status,'CLEAN');
 assert.equal(db.events.some(e=>['write','fence'].includes(e.type)),false);
});

test('rehire permits the actual non-employment gap between independent cycles',async()=>{
 const f=aggregate(),db=store([f],{cloneFn:clone});await W.writeEmployeeDeparture({...db.deps,scope,employeeId:f.employee._id,departureDate:'2026-09-15'});
 await W.writeEmployeeRehire({...db.deps,scope,employeeId:f.employee._id,rehireDate:'2026-10-01'});
 const state=db.state();assert.equal(inspect({employee:state.employees[0],history:state.history}).status,'CLEAN');
 assert.equal(P.inspectEmployeeHistorySave({scope,currentEmployee:state.employees[0],historyRows:state.history}).verification.cycles.length,2);
});


test('PR406: final preflight of unchanged legacy employee uses read-only NO_OP, no fence or writes', async () => {
    const d = F.data();
    const db = store([{ employee: d.currentEmployee, history: d.completeHistoryRows }], { cloneFn: clone });
    const before = db.state();
    const result = await W.writeEmployeeMaintenance({ ...db.deps, ...auth,
        scope: d.scope, employeeId: d.currentEmployee._id,
        expectedEmployeeStateToken: S.employeeStateToken(d.currentEmployee),
        historyPreflight: true,
        externalIntent: { isPermanent: true, erganiUploadMethod: 'xml', create_contract: false },
        maintenance: { employeeChanges: {}, submittedEmployeeFields: [], historyChanges: {},
            submittedHistoryChanges: {}, submittedProfileFields: [], submittedFormValues: {} } });
    assert.equal(result.employeeUpdated, false);
    assert.equal(result.historyUpdated, false);
    assert.equal(result.historyStatus, 'LEGACY_REVIEW_REQUIRED');
    assert.equal(result.historyAccessMode, 'READ_ONLY');
    assert.deepEqual(db.state(), before);
    assert.equal(db.events.some(e => ['fence', 'write'].includes(e.type)), false);
});

test('PR406: selected contract document never uses the NO_OP preflight shortcut', async () => {
    const d = F.data();
    const db = store([{ employee: d.currentEmployee, history: d.completeHistoryRows }], { cloneFn: clone });
    const before = db.state();
    const result = await W.writeEmployeeMaintenance({ ...db.deps, ...auth,
        scope: d.scope, employeeId: d.currentEmployee._id,
        historyPreflight: true,
        externalIntent: { create_contract: true, isPermanent: true, erganiUploadMethod: 'xml' },
        maintenance: { employeeChanges: {}, submittedEmployeeFields: [], historyChanges: {},
            submittedHistoryChanges: {}, submittedProfileFields: [], submittedFormValues: {} } });
    assert.equal(result.preflight, true);
    assert.deepEqual(db.state(), before);
    assert.equal(db.events.some(e => ['fence', 'write'].includes(e.type)), false);
});

test('PR406: real salary change still requires the normal historical preflight', async () => {
    const d = F.data();
    const db = store([{ employee: d.currentEmployee, history: d.completeHistoryRows }], { cloneFn: clone });
    const before = db.state();
    const result = await W.writeEmployeeMaintenance({ ...db.deps, ...auth,
        scope: d.scope, employeeId: d.currentEmployee._id,
        historyPreflight: true, externalIntent: {},
        maintenance: { employeeChanges: { pragmatikosMisthos: 1400 },
            submittedEmployeeFields: ['pragmatikosMisthos'],
            historyChanges: { pragmatikosMisthos: 1400 },
            submittedHistoryChanges: { pragmatikosMisthos: 1400 },
            submittedProfileFields: [], submittedFormValues: { pragmatikosMisthos: 1400 } } });
    assert.equal(result.preflight, true);
    assert.deepEqual(db.state(), before);
    assert.equal(db.events.some(e => ['fence', 'write'].includes(e.type)), false);
});


test('PR406: unsafe legacy preflight remains read-only; no second history mutation', async () => {
    const d = F.data();
    const db = store([{ employee: d.currentEmployee, history: d.completeHistoryRows }], { cloneFn: clone });
    const before = db.state();
    const response = await W.writeEmployeeMaintenance({ ...db.deps, ...auth,
        scope: d.scope, employeeId: d.currentEmployee._id,
        historyPreflight: true,
        maintenance: { employeeChanges: { pragmatikosMisthos: 1400 },
            submittedEmployeeFields: ['pragmatikosMisthos'],
            historyChanges: { pragmatikosMisthos: 1400 },
            submittedHistoryChanges: { pragmatikosMisthos: 1400 },
            submittedFormValues: { pragmatikosMisthos: 1400 } } });
    assert.equal(response.preflight, true);
    assert.deepEqual(db.state(), before);
    assert.equal(db.events.some(e => ['write','fence'].includes(e.type)), false);
});

function pr406ScopedActor(employeeScope, { update = true, actorTeam = employeeScope.team } = {}) {
    return {
        actorUserId,
        userModel: { findById: id => {
            assert.equal(String(id), actorUserId, 'actor identity must be server-owned');
            return q({ _id: actorUserId, team: actorTeam, situation: 'A' });
        } },
        privilegeModel: { findOne: query => {
            assert.equal(query.userId, actorUserId);
            assert.equal(query.form, 'Ergazomenoi');
            return q({ privileges: { admin: false, update } });
        } }
    };
}

test('PR406: synthetic legacy 0002 offers signed first-change deferral, preserves History and blocks a second change', async t => {
    // This guided feature is deliberately OFF by default. Verify that the OFF
    // gate rejects first, then opt in ONLY inside this synthetic test.
    const flag = 'PAYROLL_PR406_LEGACY_FIRST_CHANGE_ENABLED';
    const previous = process.env[flag];
    t.after(() => { if (previous === undefined) delete process.env[flag];
        else process.env[flag] = previous; });
    delete process.env[flag];
    const F2 = require('../../../test/fixtures/employee0002HistoryProposalFixture');
    const d = F2.employee0002HistoryProposalFixture();
    const db = store([{ employee: d.currentEmployee, history: d.completeHistoryRows }], { cloneFn: clone });
    const actor = pr406ScopedActor(d.scope);
    const original = db.state();
    assert.equal(String(original.employees[0]._id), String(d.currentEmployee._id));
    for (const field of ['team', 'company_kod', 'kodikos']) {
        assert.equal(original.employees[0][field], d.scope[field],
            `fixture must agree on authorized ${field}`);
    }
    const values = { pragmatikosMisthos: 1500 };
    const input = { ...db.deps, ...actor, scope: d.scope, employeeId: d.currentEmployee._id,
        confirmationSession: 'synthetic-legacy-first',
        expectedEmployeeStateToken: S.employeeStateToken(d.currentEmployee),
        externalIntent: { create_contract: true, isPermanent: true, erganiUploadMethod: 'rest' },
        maintenance: { employeeChanges: values, historyChanges: values,
            submittedHistoryChanges: values, submittedEmployeeFields: ['pragmatikosMisthos'],
            submittedFormValues: { ...values, hmeromhnia_metabolhs: '2026-10-01' } } };
    const disabled = await W.writeEmployeeMaintenance({ ...input, historyPreflight: true });
    assert.equal(disabled.preflight, true);
    assert.equal(disabled.status, 'UNSAFE_HISTORY_CHANGE', JSON.stringify(disabled));
    assert.deepEqual(db.state(), original);
    process.env[flag] = 'true'; // signed first-change scenario, test only
    const preview = await W.writeEmployeeMaintenance({ ...input, historyPreflight: true });
    assert.equal(preview.preflight, true);
    assert.equal(preview.status, 'MISSING_REQUIRED_HISTORY_FIELDS', JSON.stringify(preview));
    assert.equal(preview.decision, 'DEFER_LEGACY');
    assert.ok(preview.missingFields.length);
    assert.deepEqual(db.state(), original);
    await assert.rejects(W.writeEmployeeMaintenance({ ...input,
        historyDecision: 'DEFER_LEGACY', historyConfirmation: 'forged' }));
    assert.deepEqual(db.state(), original);
    const result = await W.writeEmployeeMaintenance({ ...input,
        historyDecision: 'DEFER_LEGACY', historyConfirmation: preview.historyConfirmation });
    assert.equal(result.historyDeferred, true);
    assert.equal(result.historyUpdated, false);
    assert.equal(result.externalActionsAllowed, true);
    assert.deepEqual(db.state().history, original.history);
    assert.equal(db.state().employees[0].employee_pending_history.mode,
        'LEGACY_GUIDED_RECONCILIATION');
    const next = { ...input, expectedEmployeeStateToken:
        S.employeeStateToken(db.state().employees[0]),
        maintenance: { ...input.maintenance,
            employeeChanges: { pragmatikosMisthos: 1600 },
            historyChanges: { pragmatikosMisthos: 1600 },
            submittedHistoryChanges: { pragmatikosMisthos: 1600 } } };
    const beforeSecond = db.state();
    const rejected = await W.writeEmployeeMaintenance({ ...next, historyPreflight: true });
    assert.equal(rejected.status, 'UNSAFE_HISTORY_CHANGE');
    assert.deepEqual(db.state(), beforeSecond);
});


test('PR406 stage2: legacy fallback is impossible without a user-supplied effective date', async () => {
    const F2 = require('../../../test/fixtures/employee0002HistoryProposalFixture');
    const d = F2.employee0002HistoryProposalFixture();
    const db = store([{ employee: d.currentEmployee, history: d.completeHistoryRows }], { cloneFn: clone });
    const old = db.state();
    const r = await W.writeEmployeeMaintenance({ ...db.deps,
        ...pr406ScopedActor(d.scope), scope: d.scope,
        employeeId: d.currentEmployee._id, historyPreflight: true,
        confirmationSession: 'synthetic-no-effective-date',
        maintenance: { employeeChanges: { pragmatikosMisthos: 1500 },
            submittedEmployeeFields: ['pragmatikosMisthos'],
            historyChanges: { pragmatikosMisthos: 1500 },
            submittedHistoryChanges: { pragmatikosMisthos: 1500 },
            submittedFormValues: { pragmatikosMisthos: 1500 } } });
    assert.equal(r.preflight, true);
    assert.notEqual(r.decision, 'DEFER_LEGACY');
    assert.deepEqual(db.state(), old);
});

test('PR406 stage2: independent email changes do not manufacture a new legacy pending transaction', async () => {
    const F2 = require('../../../test/fixtures/employee0002HistoryProposalFixture');
    const d = F2.employee0002HistoryProposalFixture();
    const db = store([{ employee: d.currentEmployee, history: d.completeHistoryRows }], { cloneFn: clone });
    const r = await W.writeEmployeeMaintenance({ ...db.deps,
        ...pr406ScopedActor(d.scope), scope: d.scope,
        employeeId: d.currentEmployee._id, historyPreflight: true,
        confirmationSession: 'synthetic-independent-only',
        maintenance: { employeeChanges: { email: 'synthetic-change@example.invalid' },
            submittedEmployeeFields: ['email'], historyChanges: {}, submittedHistoryChanges: {},
            submittedFormValues: { email: 'synthetic-change@example.invalid' } } });
    assert.notEqual(r.decision, 'DEFER_LEGACY');
    assert.equal(db.state().employees[0].employee_pending_history, undefined);
});

for (const kind of ['cross-team', 'no-update-right']) {
    test(`PR406 Stage2: ${kind} actor cannot preview or commit a legacy pending`, async () => {
        const F2 = require('../../../test/fixtures/employee0002HistoryProposalFixture');
        const d = F2.employee0002HistoryProposalFixture();
        const db = store([{ employee: d.currentEmployee, history: d.completeHistoryRows }],
            { cloneFn: clone });
        const initial = db.state();
        const actor = kind === 'cross-team'
            ? pr406ScopedActor(d.scope, { actorTeam: 'BLG' })
            : pr406ScopedActor(d.scope, { update: false });
        await assert.rejects(W.writeEmployeeMaintenance({
            ...db.deps, ...actor, scope: d.scope, employeeId: d.currentEmployee._id,
            historyPreflight: true,
            confirmationSession: 'synthetic-unauthorized',
            maintenance: {
                employeeChanges: { pragmatikosMisthos: 1500 },
                submittedEmployeeFields: ['pragmatikosMisthos'],
                historyChanges: { pragmatikosMisthos: 1500 },
                submittedHistoryChanges: { pragmatikosMisthos: 1500 },
                submittedFormValues: { pragmatikosMisthos: 1500,
                    hmeromhnia_metabolhs: '2026-10-01' }
            }
        }), { code: 'EMPLOYEE_HISTORY_MANAGEMENT_FORBIDDEN' });
        assert.deepEqual(db.state(), initial);
        assert.equal(db.events.some(event =>
            ['write', 'fence'].includes(event.type)), false);
    });
}
