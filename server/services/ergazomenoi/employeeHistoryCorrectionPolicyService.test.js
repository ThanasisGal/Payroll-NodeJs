'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const P = require('./employeeHistoryCorrectionPolicyService');
const W = require('./employeeEmploymentProfileWriter');
const S = require('./employeeHistoryEditorStateService');
const { fixture, store, scope, historyId, deferred, FIELD } = require('../../../test/fixtures/employeeProfileTransactionStore');
const { userModel, token, snapshot, modify } = require('../../../test/fixtures/employeeHistorySupervisor');
const admin = { privileges: 'A', team: 'THA', situation: 'A' };
const target = historyId('employee',0), middle = historyId('employee',1), last = historyId('employee',2);
const request = (intent, targetHistoryId = target, facts = {}, confirmation = null) => ({ intent, targetHistoryId, facts, confirmation });
const evidence = f => P.classifyHistoryEvidence({ scope, currentEmployee: f.employee, historyRows: f.history });
function closedFixture() {
    const f=fixture(); f.employee.hmeromhnia_apoxorhshs='2026-03-31'; f.employee.energos=false;
    f.employee.hmeromhnia_isxyos_oron_ergasias_eos='2026-03-31';
    Object.assign(f.history[2], { hmeromhnia_apoxorhshs:'2026-03-31', hmeromhnia_isxyos_oron_ergasias_eos:'2026-03-31' });
    return f;
}
function rehireFixture() {
    const f=closedFixture(), newer=fixture();
    newer.history.forEach((r,index) => {
        r._id=historyId('employee',index+3); r.aa_eggrafhs=String(index+4).padStart(4,'0');
        r.hmeromhnia_proslhpshs='2026-04-01';
        r.hmeromhnia_isxyos_oron_ergasias_apo=['2026-04-01','2026-05-01','2026-06-01'][index];
        r.hmeromhnia_isxyos_oron_ergasias_eos=['2026-04-30','2026-05-31',null][index];
        r.hmeromhnia_isxyos_dialleimatos_apo=r.hmeromhnia_isxyos_oron_ergasias_apo;
    });
    newer.employee={ ...newer.history[2], _id:'employee', energos:true };
    return { employee:newer.employee, history:[...f.history,...newer.history] };
}
const invoke = (db, correction, extra={}) => W.writeEmployeeEmploymentHistoryOperations({ ...db.deps,
    scope, employeeId:'employee', operations:[], expectedStateToken:token(db), actorUserId:'authenticated',
    userModel:userModel(admin), correctionCatalogLoader:async()=>({}), correction, ...extra });
async function propose(db, correction, extra={}) {
    let resolution;
    await assert.rejects(invoke(db,correction,extra), error => {
        assert.equal(error.code,'EMPLOYEE_HISTORY_SAFE_CORRECTION_REQUIRED');
        resolution=error.resolution; assert.ok(P.sanitizePublicCorrection(resolution)); return true;
    });
    return resolution;
}
async function confirm(db, correction, extra={}) {
    const proposal=await propose(db,correction,extra); assert.equal(proposal.phase,'PREVIEW');
    return invoke(db,{ ...correction, confirmation:{ fingerprint:proposal.fingerprint, confirmed:true } },extra);
}
const noChange=(db,before)=>assert.deepEqual(db.state(),before);

test('manual REVIEW and before/after proposals use snapshot reads and never attempt a mutation fence',async()=>{
    const db=store(),before=db.state();let transactionOptions;
    const startSession=db.deps.connection.startSession;
    db.deps.connection.startSession=async()=>{
        const session=await startSession();const withTransaction=session.withTransaction;
        session.withTransaction=(work,options)=>{transactionOptions=options;return withTransaction(work);};
        return session;
    };
    const deny=async()=>{assert.fail('an unconfirmed correction attempted a database write');};
    const employeeModel={...db.deps.employeeModel,updateOne:deny,create:deny,deleteOne:deny};
    const historyModel={...db.deps.historyModel,updateOne:deny,create:deny,deleteOne:deny};
    assert.equal((await propose(db,request('REVIEW',middle),{employeeModel,historyModel})).phase,'CHOICE');
    assert.equal((await propose(db,request('REMOVE_ROW',middle),{employeeModel,historyModel})).phase,'PREVIEW');
    assert.deepEqual(transactionOptions,{readConcern:{level:'snapshot'}});
    assert.equal(db.events.some(event=>['fence','write','commit'].includes(event.type)),false);
    noChange(db,before);
});

test('a concurrent change during a read-only review cannot be applied with the old editor token',async()=>{
    const db=store(),expectedStateToken=token(db);
    db.hooks.read=async(session,kind)=>{
        if(kind==='employees'&&!session.changed){session.changed=true;
            db.changeCommittedHistory(middle,{hmeromhnia_lhxhs_symbashs:'2026-11-30'});}
    };
    const proposal=await propose(db,request('REMOVE_ROW',middle),{expectedStateToken});
    assert.equal(proposal.phase,'PREVIEW');
    assert.equal(db.events.some(event=>event.type==='fence'),false);
    db.hooks.read=null;const before=db.state();
    await assert.rejects(invoke(db,request('REMOVE_ROW',middle,{},
        {fingerprint:proposal.fingerprint,confirmed:true}),{expectedStateToken}),
        {code:'EMPLOYEE_HISTORY_EDITOR_STALE'});
    assert.equal(db.events.filter(event=>event.type==='fence').length,1);
    noChange(db,before);
});

for (const [name,make,index] of [['open',fixture,0],['closed',closedFixture,0],['rehire',rehireFixture,3]]) {
    test(`A/H: authentic ${name} hire is protected from ordinary removal`,async()=>{
        const f=make(),db=store([f]),before=db.state();
        assert.equal(evidence(f)[index].authenticHire,true);
        await assert.rejects(W.writeEmployeeEmploymentHistoryOperations({ ...db.deps,scope,employeeId:'employee',
            operations:[{state:'deleted',historyId:f.history[index]._id}] }),{code:'EMPLOYEE_HISTORY_CORRECTION_REQUIRED'});
        noChange(db,before);
    });
}

test('H: flag alone does not prove hire; matching date alone does not prove hire; uncertainty fails closed',()=>{
    const flag=fixture(); flag.history[1].afora_proslhpsh=true;
    assert.equal(evidence(flag)[1].authenticHire,false);
    const date=fixture(); date.history[0].afora_proslhpsh=false;
    assert.equal(evidence(date)[0].authenticHire,false);
    const weak=fixture(); weak.history[0].employment_profile_source='unknown';
    assert.equal(evidence(weak)[0].authenticHire,false); assert.equal(evidence(weak)[0].uncertainHire,true);
    const result=P.planHistoryCorrection({scope,currentEmployee:weak.employee,historyRows:weak.history,
        request:request('REPLACE_START'),accessMode:'ADMIN_FULL',insertId:historyId('employee',9)});
    assert.equal(result.public.phase,'BLOCKED');
});

test('B: start cannot disappear, but a server-built atomic replacement succeeds',async()=>{
    const db=store(); const correction=request('REPLACE_START'); const before=db.state();
    const preview=await propose(db,correction); noChange(db,before);
    assert.deepEqual(preview.preview.before,preview.preview.after);
    assert.equal((await confirm(db,correction)).success,true);
    assert.equal(db.state().history.length,3); assert.equal(db.state().history.some(row=>row._id===target),false);
    assert.equal(evidence({employee:db.state().employees[0],history:db.state().history}).some(e=>e.authenticHire),true);
});

test('B/39: replacement reference/write failure rolls the entire correction back',async()=>{
    const db=store(),before=db.state(),correction=request('REPLACE_START');
    const preview=await propose(db,correction);
    const bad={...db.deps.historyModel,async create(){throw new Error('synthetic later insert failure');}};
    await assert.rejects(invoke(db,{...correction,confirmation:{fingerprint:preview.fingerprint,confirmed:true}},
        {historyModel:bad}),/synthetic later insert failure/); noChange(db,before);
});

test('C: ordinary batch cannot remove a whole old legitimate relationship',async()=>{
    const db=store([rehireFixture()]),before=db.state();
    await assert.rejects(W.writeEmployeeEmploymentHistoryOperations({...db.deps,scope,employeeId:'employee',
        operations:[0,1,2].map(index=>({state:'deleted',historyId:historyId('employee',index)}))}),
        {code:'EMPLOYEE_HISTORY_CORRECTION_REQUIRED'});noChange(db,before);
});

test('C: Admin confirms whole erroneous old relationship; every business event appears; newer cycle unchanged',async()=>{
    const db=store([rehireFixture()]),before=db.state(),correction=request('REMOVE_RELATIONSHIP');
    const preview=await propose(db,correction); noChange(db,before);
    assert.equal(preview.preview.before.length,7);assert.equal(preview.preview.after.length,3);
    assert.deepEqual(preview.preview.after,preview.preview.before.slice(4));
    assert.equal((await confirm(db,correction)).success,true);
    assert.deepEqual(db.state().history,before.history.slice(3));
    const { [FIELD]:ignored,...current }=db.state().employees[0];assert.deepEqual(current,before.employees[0]);
});

test('C/F: Supervisor cannot cancel an old relationship even with forged browser Admin flags',async()=>{
    const db=store([rehireFixture()]),before=db.state();
    await assert.rejects(invoke(db,{...request('REMOVE_RELATIONSHIP'),role:'ADMIN_FULL'},
        {userModel:userModel()}),{code:'EMPLOYEE_HISTORY_CORRECTION_INVALID_REQUEST'});noChange(db,before);
    const plan=P.planHistoryCorrection({scope,...snapshot(db),request:request('REMOVE_RELATIONSHIP'),
        accessMode:'SUPERVISOR_PROBLEM_SCOPE'});assert.equal(plan.public.phase,'BLOCKED');
});

test('D: safe old middle removal leaves the date gap and neighboring boundaries unchanged',async()=>{
    const db=store(),before=db.state(),correction=request('REMOVE_ROW',middle);
    const preview=await propose(db,correction);assert.equal(preview.preview.after.length,2);
    await confirm(db,correction);
    assert.deepEqual(db.state().history.find(row=>row._id===target),before.history[0]);
    assert.deepEqual(db.state().history.find(row=>row._id===last),before.history[2]);
});

test('D: missing neighbor boundary is blocked rather than silently filled',async()=>{
    const f=fixture();f.history[0].hmeromhnia_isxyos_oron_ergasias_eos=null;
    const db=store([f]),before=db.state();
    const preview=await propose(db,request('REMOVE_ROW',middle));assert.equal(preview.phase,'BLOCKED');noChange(db,before);
});

const historical=()=>request('INSERT_EVENT',middle,{effectiveDate:'2026-02-15',previousPeriodEnd:'2026-02-14',fieldId:'ACTUAL_PAY',value:1000});
test('E/D: normal retrospective Add stays rejected; confirmed insertion previews an explicit neighbor change',async()=>{
    const db=store(),before=db.state();
    await assert.rejects(W.writeEmployeeEmploymentHistoryOperations({...db.deps,scope,employeeId:'employee',
        operations:[{state:'inserted',effectiveFrom:'2026-02-15',input:{},maintenance:{historyChanges:{},employeeChanges:{}}}]}),
        {code:'EMPLOYEE_PROFILE_NON_APPEND_CHANGE'});noChange(db,before);
    const preview=await propose(db,historical());assert.equal(preview.preview.after.length,4);
    assert.ok(preview.changes.some(text=>text.includes('14/02/2026')));
    await confirm(db,historical());
    assert.equal(new Date(db.state().history.find(row=>row._id===middle).hmeromhnia_isxyos_oron_ergasias_eos).toISOString().slice(0,10),'2026-02-14');
    assert.equal(db.state().history.filter(row=>row.pragmatikosMisthos===1000).length,1);
});
for (const [name,facts] of [['overlap',{previousPeriodEnd:'2026-02-15'}],['outside period',{effectiveDate:'2026-03-15'}]]) {
    test(`E: insertion validates surrounding periods: ${name}`,async()=>{
        const db=store(),before=db.state();const r=historical();r.facts={...r.facts,...facts};
        assert.equal((await propose(db,r)).phase,'BLOCKED');noChange(db,before);
    });
}

test('E/39: insertion and explicit neighbor update roll back together on later failure',async()=>{
    const db=store(),before=db.state(),r=historical(),preview=await propose(db,r);
    await assert.rejects(invoke(db,{...r,confirmation:{fingerprint:preview.fingerprint,confirmed:true}},
        {historyModel:{...db.deps.historyModel,async create(){throw new Error('later insert failure');}}}),/later insert failure/);
    noChange(db,before);
});

test('F: non-fundamental problematic removal allowed to active Supervisor',async()=>{
    const f=fixture();f.history[1].hmeromhnia_isxyos_oron_ergasias_eos=null;
    const db=store([f]);assert.equal((await confirm(db,request('REMOVE_ROW',middle),{userModel:userModel()})).success,true);
});

test('F: fundamental destructive correction requires Admin even on a problematic row',async()=>{
    const f=fixture();f.history[0].hmeromhnia_isxyos_oron_ergasias_eos=null;
    const db=store([f]),before=db.state();
    const preview=await propose(db,request('REPLACE_START'),{userModel:userModel()});
    assert.equal(preview.phase,'BLOCKED');assert.match(preview.explanation,/διαχειριστή/);noChange(db,before);
});

test('G: sole departure cannot be deleted even when current Employee still has its date',async()=>{
    const db=store([closedFixture()]),before=db.state();
    await assert.rejects(W.writeEmployeeEmploymentHistoryOperations({...db.deps,scope,employeeId:'employee',
        operations:[{state:'deleted',historyId:last}]}),{code:'EMPLOYEE_HISTORY_CORRECTION_REQUIRED'});noChange(db,before);
});

test('G: corrected departure is previewed and applied consistently to relationship and terminal period',async()=>{
    const db=store([closedFixture()]),r=request('CORRECT_DEPARTURE',last,{departureDate:'2026-04-15'});
    const preview=await propose(db,r);assert.ok(preview.preview.after.some(row=>row.event==='Αποχώρηση'&&row.date==='15/04/2026'));
    await confirm(db,r);assert.equal(new Date(db.state().employees[0].hmeromhnia_apoxorhshs).toISOString().slice(0,10),'2026-04-15');
});

test('G: departure never happened is Admin-only, explicitly opens relationship, and validates final state',async()=>{
    const db=store([closedFixture()]),r=request('CANCEL_DEPARTURE',last,{periodEnd:null});
    const pure=P.planHistoryCorrection({scope,...snapshot(db),request:r,accessMode:'SUPERVISOR_PROBLEM_SCOPE'});
    assert.equal(pure.public.phase,'BLOCKED');
    const preview=await propose(db,r);assert.ok(preview.changes.some(text=>text.includes('ενεργή')));
    await confirm(db,r);assert.equal(db.state().employees[0].energos,true);
    assert.equal(db.state().employees[0].hmeromhnia_apoxorhshs,null);
});

test('G: cancelling departure before a rehire is rejected by the relationship checks',async()=>{
    const db=store([rehireFixture()]),before=db.state();
    assert.equal((await propose(db,request('CANCEL_DEPARTURE',last,{periodEnd:null}))).phase,'BLOCKED');noChange(db,before);
});

for (const correction of [request('REMOVE_ROW',middle),request('REPLACE_START'),historical(),
    request('CORRECT_DEPARTURE',last,{departureDate:'2026-04-15'}),request('REMOVE_RELATIONSHIP')]) {
    test(`36: deterministic sanitized business preview for ${correction.intent}`,async()=>{
        const f=correction.intent==='REMOVE_RELATIONSHIP'?rehireFixture():correction.intent==='CORRECT_DEPARTURE'?closedFixture():fixture();
        const db=store([f]);const a=await propose(db,correction),b=await propose(db,correction);
        assert.deepEqual(a,b);assert.equal(a.phase,'PREVIEW');
        assert.doesNotMatch(JSON.stringify({...a,fingerprint:undefined}),/507f|historyId|"patch"|survivor|deleteId|planner|Mongo/i);
        assert.equal(a.recommendation,null);
    });
}

test('37: old modal confirmation rejects after same employee change; fresh reads and D0b precede all business writes',async()=>{
    const db=store(),r=request('REMOVE_ROW',middle),expected=token(db),p=await propose(db,r);
    const ready=deferred(),release=deferred();db.hooks.beforeCommit=async()=>{ready.resolve();await release.promise;};
    const change=W.writeEmployeeEmploymentHistoryOperations({...db.deps,scope,employeeId:'employee',operations:[modify(last)]});
    await ready.promise;release.resolve();await change;delete db.hooks.beforeCommit;
    const before=db.state();
    await assert.rejects(invoke(db,{...r,confirmation:{fingerprint:p.fingerprint,confirmed:true}},
        {expectedStateToken:expected}),{code:'EMPLOYEE_HISTORY_EDITOR_STALE'});noChange(db,before);
});

test('37: different employee commit does not invalidate the preview',async()=>{
    const otherScope={...scope,kodikos:'0032'},db=store([fixture(),fixture('other',otherScope)]);
    const r=request('REMOVE_ROW',middle),expected=token(db),p=await propose(db,r);
    const ready=deferred(),release=deferred();db.hooks.beforeCommit=async()=>{ready.resolve();await release.promise;};
    const change=W.writeEmployeeEmploymentHistoryOperations({...db.deps,scope:otherScope,employeeId:'other',
        operations:[modify(historyId('other',2))]});await ready.promise;release.resolve();await change;delete db.hooks.beforeCommit;
    assert.equal((await invoke(db,{...r,confirmation:{fingerprint:p.fingerprint,confirmed:true}},
        {expectedStateToken:expected})).success,true);
});

test('38: referenced removal is blocked before confirmation without a recommendation',async()=>{
    const db=store(),before=db.state();
    const p=await propose(db,request('REMOVE_ROW',middle),{referenceChecker:async()=>[{historyId:middle,modelName:'Synthetic'}]});
    assert.equal(p.phase,'BLOCKED');assert.equal(p.recommendation,null);noChange(db,before);
});

test('38/39: reference appearing after preview is rechecked; correction writes none',async()=>{
    const db=store(),before=db.state(),r=request('REMOVE_ROW',middle),p=await propose(db,r);
    const final=await propose(db,{...r,confirmation:{fingerprint:p.fingerprint,confirmed:true}},
        {referenceChecker:async()=>[{historyId:middle,modelName:'Synthetic'}]});
    assert.equal(final.phase,'BLOCKED');noChange(db,before);
});

test('38/39: final reference fence failure rolls back whole relationship removal',async()=>{
    const db=store([rehireFixture()]),before=db.state(),r=request('REMOVE_RELATIONSHIP'),p=await propose(db,r);
    await assert.rejects(invoke(db,{...r,confirmation:{fingerprint:p.fingerprint,confirmed:true}},
        {historyModel:{...db.deps.historyModel,async updateMany(){return {matchedCount:0};}}}),
        {code:'EMPLOYEE_PROFILE_HISTORY_STALE'});noChange(db,before);
});

for(const forged of [{patch:{}},{historyIds:[middle]},{authorizationMode:'ADMIN_FULL'}]) {
    test(`24/30: correction request rejects browser authority ${Object.keys(forged)[0]}`,()=>{
        assert.throws(()=>P.normalizeCorrectionRequest({...request('REMOVE_ROW',middle),...forged}),
            {code:'EMPLOYEE_HISTORY_CORRECTION_INVALID_REQUEST'});
    });
}

test('D: ordinary deletion also rejects a pre-existing missing neighbor boundary without writing it',async()=>{
    const f=fixture();f.history[0].hmeromhnia_isxyos_oron_ergasias_eos=null;
    const db=store([f]),before=db.state();
    await assert.rejects(W.writeEmployeeEmploymentHistoryOperations({...db.deps,scope,employeeId:'employee',
        operations:[{state:'deleted',historyId:middle}]}),{code:'EMPLOYEE_HISTORY_CORRECTION_REQUIRED'});noChange(db,before);
});

test('F: shared role policy allows field correction but rejects fundamental or major reconstruction',()=>{
    const f=fixture();const check=(historyAfter,currentAfter=f.employee,accessMode='SUPERVISOR_PROBLEM_SCOPE')=>
        P.assertCorrectionRolePolicy({scope,currentEmployee:f.employee,historyBefore:f.history,
            historyAfter,currentAfter,accessMode});
    assert.doesNotThrow(()=>check(f.history.map(row=>row._id===target?{...row,pragmatikosMisthos:1000}:row)));
    assert.throws(()=>check(f.history.slice(1)),{code:'EMPLOYEE_HISTORY_CORRECTION_ADMIN_REQUIRED'});
    const reconstruction=f.history.map((row,index)=>index<2?{...row,hmeromhnia_isxyos_oron_ergasias_apo:'2026-01-15'}:row);
    assert.throws(()=>check(reconstruction),{code:'EMPLOYEE_HISTORY_CORRECTION_ADMIN_REQUIRED'});
    assert.doesNotThrow(()=>check(reconstruction,f.employee,'ADMIN_FULL'));
});

test('H: authoritative old closed hire and current rehire are independently classified',()=>{
    const values=evidence(rehireFixture());assert.equal(values[0].authenticHire,true);assert.equal(values[3].authenticHire,true);
});

for(const [intent,make,targetId,facts] of [
    ['REMOVE_ROW',fixture,middle,{}],['REPLACE_START',fixture,target,{}],
    ['INSERT_EVENT',fixture,middle,historical().facts],
    ['CORRECT_DEPARTURE',closedFixture,last,{departureDate:'2026-04-15'}],
    ['REMOVE_RELATIONSHIP',rehireFixture,target,{}]
])test(`36: committed business preview matches server proposal for ${intent}`,async()=>{
    const db=store([make()]),r=request(intent,targetId,facts),p=await propose(db,r);
    await invoke(db,{...r,confirmation:{fingerprint:p.fingerprint,confirmed:true}});
    assert.deepEqual(P.previewHistory({scope,...snapshot(db)}),p.preview.after);
});

test('32/38: exact targeting of redundant artifact preserves approved survivor/reference retention',async()=>{
    for(const referenced of [false,true]) {
        const f=fixture(),duplicate={...f.history[1],_id:historyId('employee',7),aa_eggrafhs:'0002',createdAt:new Date('2026-01-01')};
        f.history.push(duplicate);const db=store([f]);
        await W.writeEmployeeEmploymentHistoryOperations({...db.deps,scope,employeeId:'employee',
            operations:[{state:'deleted',historyId:duplicate._id}],referenceChecker:async({historyIds})=>
                referenced&&historyIds.includes(duplicate._id)?[{historyId:duplicate._id,collection:'Apasxoliseis_Weekly_Canonical_Decisions'}]:[]});
        const retained=db.state().history.find(row=>row._id===duplicate._id);
        if(referenced){assert.equal(retained.employment_history_canonical_status,'REDUNDANT_REFERENCED');
            assert.equal(retained.employment_history_canonical_survivor_id,middle);}else assert.equal(retained,undefined);
    }
});

test('G: deleting all duplicate stored departure evidence is protected as one business event',async()=>{
    const f=closedFixture();f.history.push({...f.history[2],_id:historyId('employee',7)});
    const db=store([f]),before=db.state();
    await assert.rejects(W.writeEmployeeEmploymentHistoryOperations({...db.deps,scope,employeeId:'employee',
        operations:[last,historyId('employee',7)].map(historyId=>({state:'deleted',historyId}))}),
        {code:'EMPLOYEE_HISTORY_CORRECTION_REQUIRED'});noChange(db,before);
});

test('E: competing historical facts remain ambiguous and insertion fails closed',async()=>{
    const f=fixture();f.history.push({...f.history[1],_id:historyId('employee',7),dialleima_se_lepta:30});
    const db=store([f]),before=db.state();assert.equal((await propose(db,historical())).phase,'BLOCKED');noChange(db,before);
});

test('F: fresh role downgrade prevents an Admin destructive confirmation on an authorized problematic row',async()=>{
    const f=rehireFixture();f.history[0].hmeromhnia_isxyos_oron_ergasias_eos=null;
    const db=store([f]),before=db.state(),r=request('REMOVE_RELATIONSHIP'),p=await propose(db,r);
    const blocked=await propose(db,{...r,confirmation:{fingerprint:p.fingerprint,confirmed:true}},
        {userModel:userModel()});assert.equal(blocked.phase,'BLOCKED');noChange(db,before);
});

test('38: unavailable/unknown reference state fails closed before any correction writes',async()=>{
    for(const referenceChecker of [async()=>{throw new Error('unavailable');},async()=>[{collection:'Unknown'}]]) {
        const db=store([closedFixture()]),before=db.state();
        await assert.rejects(invoke(db,request('CORRECT_DEPARTURE',last,{departureDate:'2026-04-15'}),
            {referenceChecker}),{code:'EMPLOYEE_HISTORY_CORRECTION_REFERENCE_CHECK_FAILED'});noChange(db,before);
    }
});

test('A/B: Admin replacement corrects an explicitly supplied historical start fact atomically',async()=>{
    const db=store(),r=request('REPLACE_START',target,{fieldId:'ACTUAL_PAY',value:1500}),p=await propose(db,r);
    assert.ok(p.preview.after[0].details.some(text=>text.includes('1500')));
    await confirm(db,r);assert.equal(db.state().history.find(row=>row.afora_proslhpsh===true).pragmatikosMisthos,1500);
    assert.deepEqual(P.previewHistory({scope,...snapshot(db)}),p.preview.after);
});

test('A/B: replacement of the sole current start previews and applies its explicit current value correction',async()=>{
    const f=fixture();f.history=f.history.slice(0,1);f.history[0].hmeromhnia_isxyos_oron_ergasias_eos=null;
    f.employee={...f.history[0],_id:'employee',energos:true};
    const db=store([f]),r=request('REPLACE_START',target,{fieldId:'ACTUAL_PAY',value:1500});
    const p=await propose(db,r);assert.ok(p.changes.some(text=>text.includes('σημερινά στοιχεία')));
    await confirm(db,r);assert.equal(db.state().employees[0].pragmatikosMisthos,1500);
});

test('H/B: trusted sparse hire foundation is classified from its existing strict provenance contract',async()=>{
    const row={...scope,_id:target,aa_eggrafhs:'0001',hmeromhnia_proslhpshs:'2026-01-01',
        afora_proslhpsh:true,afora_allagh_oron_ergasias:false,employment_profile_source:'LEGACY_OPEN_CYCLE_CLEANUP_FOUNDATION'};
    const f={employee:{...scope,_id:'employee',hmeromhnia_proslhpshs:'2026-01-01',energos:true},history:[row]};
    assert.equal(evidence(f)[0].authenticHire,true);
    const db=store([f]);await confirm(db,request('REPLACE_START'));
    assert.equal(db.state().history.length,1);assert.equal(db.state().history[0].employment_profile_version,undefined);
});
