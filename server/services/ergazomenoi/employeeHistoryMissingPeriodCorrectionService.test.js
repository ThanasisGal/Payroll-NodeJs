'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {fixture,store,scope}=require('../../../test/fixtures/employeeProfileTransactionStore');
const {token,userModel}=require('../../../test/fixtures/employeeHistorySupervisor');
const W=require('./employeeEmploymentProfileWriter');
const P=require('./employeeHistoryCorrectionPolicyService');
const {canonicalizeEmployeeHistory}=require('./employeeHistoryCanonicalizationService');
const catalogs={KPK_EFKA:[{code:'0101',label:'Ασφάλιση'}],CONTRACT_TYPE:[{code:'01',label:'Σύμβαση'}],
    CONTRACT_CATEGORY:[{code:'01',label:'Κατηγορία',afora_thn_symbash:'01'}],CONTRACT_SPECIALTY:[{code:'01',label:'Ειδικότητα',afora_thn_symbash_kathgoria:'0101'}]};
const values={KPK:'0101',SPECIALTY:'01',CONTRACT_TYPE:'01',CONTRACT_CATEGORY:'01',
    WORK_DAYS:5,WEEKLY_HOURS:35,DAILY_HOURS:7,LEGAL_PAY:900,ACTUAL_PAY:1000,CONTRACT_PAY:1000};
const admin=userModel({privileges:'A',team:'THA',situation:'A'});
const base={intent:'FILL_MISSING_PERIODS',targetHistoryId:null,facts:{},confirmation:null};
const invoke=(db,r,extra={})=>W.writeEmployeeEmploymentHistoryOperations({...db.deps,scope,employeeId:'employee',operations:[],
    expectedStateToken:token(db),actorUserId:'admin',userModel:admin,correction:r,correctionCatalogLoader:async()=>catalogs,...extra});
async function preview(db,r=base) { let result;await assert.rejects(invoke(db,r),e=>{
    assert.equal(e.code,'EMPLOYEE_HISTORY_SAFE_CORRECTION_REQUIRED');result=e.resolution;return true;});return result; }
const answered=worksheet=>({...base,facts:{periods:worksheet.conflicts.map(c=>({conflictId:c.conflictId,
    intent:'ENTER_DIFFERENT_VALUE',value:'PROFILE_CANDIDATE_1',values:{...values,
        ...Object.fromEntries(c.intents[0].valueControl.fields.filter(field=>field.optional &&
            !c.intents[0].valueControl.baselineValues[0].summary.some(item=>item.fieldId===field.id))
            .map(field=>[field.id,null]))}}))}});
function first(){const f=fixture();f.history=[];Object.assign(f.employee,{hmeres_ergasias_ebdomadas:5,
    ores_ergasias_ebdomadas:40,mo_oron_hmerhsias_ergasias:8});return f;}
for (const kind of ['first','initial','intermediate','multiple']) test(`different terms ${kind}: no premature writes, preview, atomic apply and CLEAN coverage`,async()=>{
    const f=kind==='first'?first():fixture();
    if(kind==='initial')f.history.shift();
    if(kind==='intermediate')f.history.splice(1,1);
    if(kind==='multiple'){ f.history[0].hmeromhnia_isxyos_oron_ergasias_eos='2026-01-15';f.history[1].hmeromhnia_isxyos_oron_ergasias_eos='2026-02-15'; }
    const db=store([f]),before=db.state(),worksheet=await preview(db);
    assert.equal(worksheet.kind,'USER_CONFIRMED_HISTORY_CORRECTION');assert.deepEqual(db.state(),before);
    if(kind==='multiple')assert.equal(worksheet.conflicts.length,2);
    const request=answered(worksheet),proposal=await preview(db,request);
    assert.equal(proposal.phase,'PREVIEW',proposal.explanation);assert.deepEqual(db.state(),before);
    await invoke(db,{...request,confirmation:{fingerprint:proposal.fingerprint,confirmed:true}});
    const after=db.state();assert.equal(after.audits.length,1);
    assert.equal(canonicalizeEmployeeHistory({scope,currentEmployee:after.employees[0],historyRows:after.history}).status,'CLEAN');
    for(const row of f.history){const remaining=after.history.find(r=>r._id===row._id);assert.ok(remaining);
        for(const key of Object.keys(row).filter(k=>!['aa_eggrafhs','updatedAt'].includes(k)))assert.deepEqual(remaining[key],row[key],key);}
    assert.equal(after.employees[0].hmeromhnia_proslhpshs,before.employees[0].hmeromhnia_proslhpshs);
    assert.equal(after.employees[0].ores_ergasias_ebdomadas,before.employees[0].ores_ergasias_ebdomadas);
    assert.ok(after.history.some(r=>r.ores_ergasias_ebdomadas===35));
});
test('different terms rejects partial facts, invented catalog codes and inconsistent hours without writes',async()=>{
    const db=store([first()]),before=db.state(),r=answered(await preview(db));
    for(const patch of [{KPK:'9999'},{WEEKLY_HOURS:36},{WORK_DAYS:undefined}]){
        const q=structuredClone(r);Object.assign(q.facts.periods[0].values,patch);
        if(patch.WORK_DAYS===undefined&&Object.hasOwn(patch,'WORK_DAYS'))delete q.facts.periods[0].values.WORK_DAYS;
        assert.equal((await preview(db,q)).phase,'BLOCKED');assert.deepEqual(db.state(),before);
    }
});
test('different terms audit failure rolls back all inserted periods and current period',async()=>{
    const db=store([first()]),r=answered(await preview(db)),proposal=await preview(db,r),before=db.state();
    db.deps.auditModel.create=async()=>{throw Error('audit failure');};
    await assert.rejects(invoke(db,{...r,confirmation:{fingerprint:proposal.fingerprint,confirmed:true}}),/audit failure/);
    assert.deepEqual(db.state(),before);
});
test('different terms refuses stale preview, changed answers, Supervisor and unrecorded source',async()=>{
    const db=store([first()]),r=answered(await preview(db)),proposal=await preview(db,r),before=db.state();
    const changed=structuredClone(r);changed.facts.periods[0].values.ACTUAL_PAY=1100;
    await assert.rejects(invoke(db,{...changed,confirmation:{fingerprint:proposal.fingerprint,confirmed:true}}),e=>e.code==='EMPLOYEE_HISTORY_CORRECTION_CHANGED');
    await assert.rejects(invoke(db,r,{userModel:userModel({privileges:'S',team:scope.team,situation:'A'})}),e=>e.code==='EMPLOYEE_HISTORY_SUPERVISOR_SCOPE_FORBIDDEN');
    assert.deepEqual(db.state(),before);
    const oldToken=token(db);db.changeCommittedEmployee('employee',{pragmatikosMisthos:1200});
    await assert.rejects(invoke(db,{...r,confirmation:{fingerprint:proposal.fingerprint,confirmed:true}},{expectedStateToken:oldToken}),e=>e.code==='EMPLOYEE_HISTORY_EDITOR_STALE');
    const f=fixture();f.history.splice(1,1);delete f.history[0].dialleima_se_lepta;const incomplete=store([f]);
    const worksheet=await preview(incomplete),missing=answered(worksheet);
    assert.equal(worksheet.kind,'USER_CONFIRMED_HISTORY_CORRECTION');
    delete missing.facts.periods[0].values.dialleima_se_lepta;
    assert.equal((await preview(incomplete,missing)).phase,'BLOCKED');
    missing.facts.periods[0].values.dialleima_se_lepta=20;
    const fixed=await preview(incomplete,missing);assert.equal(fixed.phase,'PREVIEW',fixed.explanation);
    await invoke(incomplete,{...missing,confirmation:{fingerprint:fixed.fingerprint,confirmed:true}});
    assert.equal(incomplete.state().history.length,3);
    assert.equal(incomplete.state().history.find(row=>new Date(row.hmeromhnia_isxyos_oron_ergasias_apo).toISOString().slice(0,10)==='2026-02-01').dialleima_se_lepta,20);
});
test('missing-period request rejects target forgery and extra decision properties',()=>{
    assert.throws(()=>P.normalizeCorrectionRequest({...base,targetHistoryId:'507f1f77bcf86cd799439100'}));
    assert.throws(()=>P.normalizeCorrectionRequest({...base,facts:{periods:[{conflictId:'MISSING_PERIOD_1',intent:'ENTER_DIFFERENT_VALUE',value:'PROFILE_CANDIDATE_1',values,patch:{}}]}}));
});


test('missing-period insertion preserves existing BSON identities and frozen references',async()=>{
    const mongoose=require('mongoose');
    const BSON=mongoose.mongo.BSON;
    const f=fixture();f.history.splice(1,1);
    for(const row of f.history)row._id=new mongoose.Types.ObjectId(row._id);
    const db=store([f],{cloneFn:value=>BSON.deserialize(BSON.serialize({value})).value});
    const worksheet=await preview(db),r=answered(worksheet),proposal=await preview(db,r);
    assert.equal(proposal.phase,'PREVIEW');
    await invoke(db,{...r,confirmation:{fingerprint:proposal.fingerprint,confirmed:true}},{referenceChecker:async()=>[
        {collection:'Apasxoliseis_Period_Frozen_Snapshots',documentId:'synthetic'}]});
    for(const original of f.history){const actual=db.state().history.find(row=>String(row._id)===String(original._id));
        assert.ok(actual._id instanceof mongoose.Types.ObjectId);assert.ok(actual._id.equals(original._id));
        assert.deepEqual(actual.hmeromhnia_isxyos_oron_ergasias_apo,original.hmeromhnia_isxyos_oron_ergasias_apo);
    }
});

test('missing-period worksheet fails clearly when catalogs cannot provide real choices',async()=>{
    const db=store([first()]);let resolution;
    await assert.rejects(invoke(db,base,{correctionCatalogLoader:async()=>({})}),e=>{resolution=e.resolution;return true;});
    assert.equal(resolution.phase,'BLOCKED');assert.match(resolution.explanation,/Δεν φορτώθηκαν.*Ακύρωση/);
    assert.equal(db.state().history.length,0);
});

test('complete missing-period contract exposes every profile term except the generated break boundary',async()=>{
    const {PROFILE_FIELDS}=require('./employeeHistoryAutomaticReconstructionContract');
    const {CORRECTION_FIELD_REGISTRY}=require('./employeeHistoryCorrectionFieldRegistryService');
    const worksheet=await preview(store([first()]));
    const fields=worksheet.conflicts[0].intents[0].valueControl.fields;
    const exposed=new Set(fields.map(field=>CORRECTION_FIELD_REGISTRY.find(entry=>entry.id===field.id)?.fields[0] || field.id));
    for(const field of PROFILE_FIELDS.filter(field=>field!=='hmeromhnia_isxyos_dialleimatos_apo')) assert.ok(exposed.has(field),field);
    assert.ok(fields.every(field=>field.label));
});

test('different break, arrangement, contractual pay and explicit absent values are previewed and saved atomically',async()=>{
    const db=store([first()]),request=answered(await preview(db)),before=db.state();
    Object.assign(request.facts.periods[0].values,{dialleima_se_lepta:20,
        dialleima_apo_ora_01:'12:00',dialleima_eos_ora_01:'12:20',
        afora_egkekrimenh_rythmish_ergasias:true,typos_egkekrimenhs_rythmishs:'OTHER_APPROVED_ARRANGEMENT',
        hmnia_enarxhs_egkekrimenhs_rythmishs:'2026-01-01',hmnia_lhxhs_egkekrimenhs_rythmishs:'2026-01-31',
        hmeres_efarmoghs_egkekrimenhs_rythmishs:[1,3,5],poso_symbashs_01:120,
        krathsh_02:null,hmeromhnia_lhxhs_symbashs:null});
    const proposal=await preview(db,request);assert.equal(proposal.phase,'PREVIEW',proposal.explanation);
    assert.ok(proposal.preview.after.some(row=>row.details.includes('Διάλειμμα σε λεπτά: 20')));
    assert.deepEqual(db.state(),before);
    await invoke(db,{...request,confirmation:{fingerprint:proposal.fingerprint,confirmed:true}});
    const row=db.state().history.find(row=>new Date(row.hmeromhnia_isxyos_oron_ergasias_apo).toISOString().slice(0,10)==='2026-01-01');
    assert.equal(row.dialleima_se_lepta,20);assert.equal(row.dialleima_apo_ora_01,'12:00');
    assert.deepEqual(row.hmeres_efarmoghs_egkekrimenhs_rythmishs,[1,3,5]);assert.equal(row.poso_symbashs_01,120);
    assert.equal(row.krathsh_02,null);assert.equal(row.hmeromhnia_lhxhs_symbashs,null);
    const {employee_profile_mutation_sequence,...employeeAfter}=db.state().employees[0];
    assert.equal(employee_profile_mutation_sequence,1);
    assert.deepEqual(employeeAfter,before.employees[0]);
});

test('additional terms reject unknown fields, invalid intervals, arrangements and dates without writes',async()=>{
    const db=store([first()]),request=answered(await preview(db)),before=db.state();
    for(const patch of [{_id:'forged'},{dialleima_se_lepta:2},{dialleima_apo_ora_01:'12:00'},
        {afora_egkekrimenh_rythmish_ergasias:true},{hmnia_enarxhs_egkekrimenhs_rythmishs:'2026-02-30'},
        {hmeres_efarmoghs_egkekrimenhs_rythmishs:[8]},{dialleima_se_lepta:null}]) {
        const q=structuredClone(request);Object.assign(q.facts.periods[0].values,patch);
        assert.equal((await preview(db,q)).phase,'BLOCKED',JSON.stringify(patch));assert.deepEqual(db.state(),before);
    }
});

test('an unrecorded Boolean requires an explicit real answer and does not default to false',async()=>{
    const f=fixture();f.history.splice(1,1);delete f.history[0].dialleima_entos_ektos_orarioy;
    const db=store([f]),request=answered(await preview(db)),before=db.state();
    delete request.facts.periods[0].values.dialleima_entos_ektos_orarioy;
    const refused=await preview(db,request);assert.equal(refused.phase,'BLOCKED');
    assert.match(refused.explanation,/Δεν υπάρχει καταγεγραμμένη τιμή/);assert.deepEqual(db.state(),before);
    request.facts.periods[0].values.dialleima_entos_ektos_orarioy=false;
    const proposal=await preview(db,request);assert.equal(proposal.phase,'PREVIEW',proposal.explanation);
    await invoke(db,{...request,confirmation:{fingerprint:proposal.fingerprint,confirmed:true}});
    const added=db.state().history.find(row=>!f.history.some(old=>old._id===row._id));
    assert.equal(added.dialleima_entos_ektos_orarioy,false);
    assert.equal(Object.hasOwn(db.state().history.find(row=>row._id===f.history[0]._id),'dialleima_entos_ektos_orarioy'),false);
});

test('missing-period comparison never presents another period as recorded BEFORE',async()=>{
    const db=store([first()]),worksheet=await preview(db);
    const control=worksheet.conflicts[0].intents[0].valueControl;
    assert.deepEqual(control.beforeValues,[]);
    const duration=control.fields.find(field=>field.id==='dialleima_se_lepta');
    const interval=control.fields.find(field=>field.id==='dialleima_apo_ora_01');
    assert.equal(duration.nullable,false);assert.equal(interval.nullable,true);
});
