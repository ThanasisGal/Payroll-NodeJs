'use strict';
const {test,before,after,mock}=require('node:test');
const assert=require('node:assert/strict');
const {forbidRealSettlementMongo}=require('../fixtures/forbidRealSettlementMongo');
const {startSettlementHarness}=require('../fixtures/employeeHistorySettlementHttpHarness');
const {acceptanceBWithInitialGap,typedFixture}=require('../fixtures/employeeHistoryCoordinatedSettlementFixture');
const F=require('../../server/services/ergazomenoi/fixtures/unifiedEmployeeHistorySettlementFixtures');
before(()=>forbidRealSettlementMongo(mock));after(()=>mock.restoreAll());
async function withHarness(work,fixture=acceptanceBWithInitialGap()) {
    const h=await startSettlementHarness({fixture,realHttp:true,enriched:false});
    try{const p=await(await h.preview()).json();assert.equal(p.executionMode,'CONTROLLED_DEV',JSON.stringify(p));
        await work({...h,body:{approval:{confirmed:true,fingerprint:p.approvalFingerprint}}});}finally{await h.close();}
}
test('same real HTTP handler previews, authorizes, writes through existing writer, reports commit and replays safely',async()=>{
    await withHarness(async h=>{const before=h.db.state(),r=await h.apply(h.body),p=await r.json();assert.equal(r.status,200,JSON.stringify(p));
        assert.equal(p.success,true);assert.equal(p.historyStatus,'CLEAN');assert.ok(p.corrections.actions.length);
        const after=h.db.state();assert.equal(after.audits.length,1);assert.equal(after.audits[0].mutationSource,'EMPLOYEE_HISTORY_SETTLEMENT');assert.equal(after.history.length,before.history.length+1);
        assert.deepEqual(after.references,before.references);assert.equal((await(await h.preview()).json()).settlementPreview.state,'clean');
        const replay=await h.apply(h.body);assert.equal(replay.status,200,JSON.stringify(await replay.clone().json()));
        assert.equal((await replay.json()).alreadyApplied,true);assert.deepEqual(h.db.state(),after);
    });
});
test('real HTTP CLEAN/noOp makes no write or committed fence',async()=>{
    await withHarness(async h=>{const before=h.db.state(),r=await h.apply(h.body);assert.equal(r.status,200,JSON.stringify(await r.clone().json()));
        assert.equal((await r.json()).noOp,true);assert.deepEqual(h.db.state(),before);assert.equal(h.db.events.some(e=>e.type==='commit'),false);
    },typedFixture(F.families.find(f=>f.number===23).make()));
});
for(const change of ['session','company','employee','role','permission','active','fingerprint','plan','current','reference'])
test(`real HTTP rejects ${change} before mutation`,async()=>{
    await withHarness(async h=>{
        if(change==='session')delete h.session.userId;
        if(change==='company')h.session.companyInUse='720000000000000000000001';
        if(change==='employee')h.session.companyInUse='invalid';
        if(change==='role')h.actor.privileges='S';if(change==='permission')h.permission.update=false;if(change==='active')h.actor.situation='I';
        if(change==='fingerprint')h.body.approval.fingerprint='x'.repeat(43);
        if(change==='plan')h.body.proposedRows=[];
        if(change==='current')h.db.changeEmployee({parathrhseis:'Συνθετική αλλαγή'});
        if(change==='reference')h.db.addReference(h.initial.completeHistoryRows[0]._id);
        const before=h.db.state(),r=await h.apply(h.body);assert.notEqual(r.status,200);assert.deepEqual(h.db.state(),before);
    });
});
for(const fault of ['INSERT','AUDIT','FINAL'])test(`real HTTP ${fault} rolls back atomically`,async()=>{
    await withHarness(async h=>{h.db.failAt(fault);const before=h.db.state(),r=await h.apply(h.body);assert.notEqual(r.status,200);assert.deepEqual(h.db.state(),before);},require('../fixtures/employeeHistoryCoordinatedSettlementFixture').acceptanceB({overlap:true}));
});
for(const fault of ['COMMIT_ACK_LOST','COMMIT_UNKNOWN_BEFORE'])test(`real HTTP ${fault} returns UNKNOWN and retries the same approval once`,async()=>{
    await withHarness(async h=>{h.db.failAt(fault);const r=await h.apply(h.body),p=await r.json();assert.equal(r.status,503,JSON.stringify(p));assert.equal(p.outcome,'UNKNOWN');assert.equal(p.success,undefined);
        const second=await h.apply(h.body);assert.equal(second.status,200,JSON.stringify(await second.clone().json()));assert.equal(h.db.state().audits.length,1);
    });
});
test('another valid employee ID never reuses the reviewed employee approval',async()=>{
    await withHarness(async h=>{const before=h.db.state();const response=await fetch(`${h.origin}/api/ergazomenoi/720000000000000000000002/history-automatic-settlement-apply`,{
        method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(h.body)});assert.equal(response.status,403);assert.deepEqual(h.db.state(),before);
    });
});
test('two concurrent real HTTP approvals commit once',async()=>{
    await withHarness(async h=>{const responses=await Promise.all([h.apply(h.body),h.apply(h.body)]),results=await Promise.all(responses.map(r=>r.json()));
        assert.ok(responses.every(r=>r.status===200),JSON.stringify(results));assert.equal(results.filter(r=>r.alreadyApplied).length,1);assert.equal(h.db.state().audits.length,1);
    });
});
test('one real HTTP factual selection binds the full proposal and updates current terms in the same transaction',async()=>{
    const fixture=typedFixture(F.references(F.input([F.period(1,{pay:1100}),F.period(2,{pay:1300})])));
    const h=await startSettlementHarness({fixture,realHttp:true,enriched:false});
    try{
        const input=h.db.approvalInput(h.actor._id),coordinate=require('../../server/services/ergazomenoi/employeeHistorySettlementCoordinatorService').coordinateEmployeeHistorySettlement;
        const pending=coordinate(input),businessDecision=pending.decisions[0].options.map(option=>({snapshotFingerprint:pending.snapshotFingerprint,selections:{cycle_1:{choiceId:option.id}}}))
            .find(decision=>coordinate({...input,businessDecision:decision}).currentPatch.synolo_symbashs===1100);
        const preview=await(await h.resolve(businessDecision)).json();assert.ok(preview.approvalFingerprint,JSON.stringify(preview));
        const body={businessDecision,approval:{confirmed:true,fingerprint:preview.approvalFingerprint}};
        const r=await h.apply(body),p=await r.json();assert.equal(r.status,200,JSON.stringify(p));assert.equal(h.db.state().employees[0].synolo_symbashs,1100);
        assert.ok(p.corrections.actions.some(value=>value.startsWith('Ισχύοντα στοιχεία')));
        const after=h.db.state();const replay=await h.apply(body);assert.equal(replay.status,200,JSON.stringify(await replay.clone().json()));assert.deepEqual(h.db.state(),after);
    }finally{await h.close();}
});
