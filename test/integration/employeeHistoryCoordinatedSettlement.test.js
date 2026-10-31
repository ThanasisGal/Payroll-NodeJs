'use strict';
const { test, before, after, mock } = require('node:test');
const assert = require('node:assert/strict');
const { forbidRealSettlementMongo } = require('../fixtures/forbidRealSettlementMongo');
const { startSettlementHarness } = require('../fixtures/employeeHistorySettlementHttpHarness');
const { typedFixture, acceptanceB } = require('../fixtures/employeeHistoryCoordinatedSettlementFixture');
const F = require('../../server/services/ergazomenoi/fixtures/unifiedEmployeeHistorySettlementFixtures');
const { isInactiveHistoryRow } = require('../../server/utils/ergazomenoi/employmentHistoryCanonicalStatus');
const A = require('../../server/services/ergazomenoi/employeeHistoryAutomaticReconstructionApplyContract');
before(() => forbidRealSettlementMongo(mock));
after(() => mock.restoreAll());
async function withHarness(fixture, work) {
    const h = await startSettlementHarness({ fixture, coordinated: true, enriched: false });
    try {
        const preview = await (await h.preview()).json();
        assert.equal(preview.success,true,JSON.stringify(preview));
        const body = { approval: { confirmed:true, fingerprint:preview.approvalFingerprint } };
        await work({...h,body,initialPreview:preview});
    } finally { await h.close(); }
}
function assertOriginals(before,after) {
    assert.deepEqual(after.references,before.references);
    for (const original of before.history) {
        const stored = after.history.find(row => String(row._id) === String(original._id));
        assert.ok(stored);
        if (isInactiveHistoryRow(stored) && !isInactiveHistoryRow(original)) {
            const { employment_history_canonical_status, employment_history_canonical_survivor_id, updatedAt, ...payload } = stored;
            const { updatedAt: oldRevision, ...oldPayload } = original;
            assert.deepEqual(payload,oldPayload);
            assert.equal(employment_history_canonical_status,'REDUNDANT_REFERENCED');
            assert.ok(after.history.some(row=>!isInactiveHistoryRow(row)&&String(row._id)===String(employment_history_canonical_survivor_id)));
        } else assert.deepEqual(stored,original);
    }
}
test('A: CLEAN/noOp writes nothing, including fence, audit and periods', async()=> {
    await withHarness(typedFixture(F.families.find(f=>f.number===23).make()),async h=>{
        const before=h.db.state(),response=await h.apply(h.body),result=await response.json();
        assert.equal(response.status,200,JSON.stringify(result));assert.equal(result.noOp,true);
        assert.deepEqual(h.db.state(),before);
        assert.equal(h.db.events.some(event=>['write','fence','syntheticInsert'].includes(event.type)),false);
    });
});
test('B: exact three logical periods, actual departure and rehire, all protected originals and finalized results survive',async()=>{
    await withHarness(acceptanceB(),async h=>{
        const before=h.db.state(),response=await h.apply(h.body),result=await response.json();
        assert.equal(response.status,200,JSON.stringify(result));assert.equal(result.historyStatus,'CLEAN');
        const after=h.db.state();assertOriginals(before,after);
        assert.equal(after.history.filter(isInactiveHistoryRow).length,1);
        assert.equal(h.db.events.filter(event=>event.type==='syntheticInsert').length,0);
        const day=value=>value?.toISOString().slice(0,10)||null;
        const rows=after.history.filter(row=>!isInactiveHistoryRow(row)).sort((a,b)=>a.hmeromhnia_isxyos_oron_ergasias_apo-b.hmeromhnia_isxyos_oron_ergasias_apo);
        assert.deepEqual(rows.map(row=>[day(row.hmeromhnia_isxyos_oron_ergasias_apo),day(row.hmeromhnia_isxyos_oron_ergasias_eos)]),[
            ['2025-12-01','2026-03-31'],['2026-04-01','2026-07-31'],['2026-09-16','2027-07-30']]);
        assert.equal(day(rows[1].hmeromhnia_apoxorhshs),'2026-07-31');assert.equal(day(rows[2].hmeromhnia_proslhpshs),'2026-09-16');
        assert.equal(after.audits.length,1);assert.equal(h.db.events.filter(event=>event.type==='commit').length,1);
        assert.equal((await(await h.preview()).json()).settlementPreview.state,'clean');
        const replay=await h.apply(h.body);assert.equal(replay.status,200,JSON.stringify(await replay.clone().json()));
        assert.equal((await replay.json()).alreadyApplied,true);assert.deepEqual(h.db.state(),after);
    });
});
for(const fault of ['INSERT','INSERT_EMPTY','INSERT_TAMPER','AUDIT','AUDIT_EMPTY','AUDIT_TAMPER','FINAL'])
test(`coordinated ${fault}: transaction rolls back all changes`,async()=>{
    await withHarness(acceptanceB({overlap:true}),async h=>{
        const before=h.db.state();h.db.failAt(fault);const response=await h.apply(h.body);
        assert.notEqual(response.status,200);assert.deepEqual(h.db.state(),before);
        assert.equal(h.db.events.some(event=>event.type==='commit'),false);
    });
});
for(const change of ['employee','history','reference','fingerprint']) test(`coordinated stale ${change} rejects`,async()=>{
    await withHarness(acceptanceB(),async h=>{
        if(change==='employee')h.db.changeEmployee({parathrhseis:'Συνθετική αλλαγή'});
        if(change==='history')h.db.changeHistory(h.initial.completeHistoryRows[0]._id,{synolo_symbashs:999});
        if(change==='reference')h.db.addReference(h.initial.completeHistoryRows[0]._id);
        if(change==='fingerprint')h.body.approval.fingerprint='x'.repeat(43);
        const before=h.db.state();const writes=h.db.events.length;assert.equal((await h.apply(h.body)).status,409);assert.deepEqual(h.db.state(),before);
        assert.equal(h.db.events.slice(writes).some(event=>['write','fence','syntheticInsert'].includes(event.type)),false);
    });
});
for(const fault of ['COMMIT_ACK_LOST','COMMIT_UNKNOWN_BEFORE'])test(`coordinated ${fault}: UNKNOWN then same approval resolves once`,async()=>{
    await withHarness(acceptanceB(),async h=>{
        h.db.failAt(fault);const response=await h.apply(h.body),result=await response.json();
        assert.equal(response.status,503);assert.equal(result.outcome,'UNKNOWN');assert.equal(result.success,undefined);
        const replay=await h.apply(h.body);assert.equal(replay.status,200,JSON.stringify(await replay.clone().json()));
        const after=h.db.state();assert.equal(after.audits.length,1);
        assert.equal((await(await h.apply(h.body)).json()).alreadyApplied,true);assert.deepEqual(h.db.state(),after);
        assert.equal(h.db.events.filter(event=>event.type==='commit').length,1);
    });
});
for(const change of ['employee','reference'])test(`coordinated concurrent ${change} retries and rejects stale approval`,async()=>{
    await withHarness(acceptanceB(),async h=>{
        const barrier=h.db.pauseNextHistoryRead(),pending=h.apply(h.body);await barrier.reached;
        if(change==='employee')h.db.changeEmployee({parathrhseis:'Συνθετική παράλληλη αλλαγή'});else h.db.addReference(h.initial.completeHistoryRows[0]._id);
        const before=h.db.state();barrier.resume();assert.equal((await pending).status,409);assert.deepEqual(h.db.state(),before);
        assert.ok(h.db.events.some(event=>event.type==='retry'));
    });
});
for(const change of ['role','permission','active','team'])for(const completed of [false,true])test(`coordinated revoked ${change}, replay=${completed}`,async()=>{
    await withHarness(acceptanceB(),async h=>{
        if(completed)assert.equal((await h.apply(h.body)).status,200);
        if(change==='role')h.actor.privileges='S';if(change==='permission')h.permission.update=false;
        if(change==='active')h.actor.situation='I';if(change==='team')h.actor.team='OTHER';
        const before=h.db.state();assert.equal((await h.apply(h.body)).status,403);assert.deepEqual(h.db.state(),before);
    });
});
for(const number of [1,2,3,4,5,6,7,8,9,10,12,15,16,18,19,20,21,23,24,27])test(`coordinated family ${number}: save and second CLEAN/noOp`,async()=>{
    const data=typedFixture(F.references(F.families.find(f=>f.number===number).make()));
    await withHarness(data,async h=>{
        const before=h.db.state(),response=await h.apply(h.body),result=await response.json();
        assert.equal(response.status,200,JSON.stringify(result));const after=h.db.state();assertOriginals(before,after);
        assert.equal((await(await h.preview()).json()).settlementPreview.state,'clean');
        const second=await h.apply(h.body);assert.equal(second.status,200,JSON.stringify(await second.clone().json()));assert.deepEqual(h.db.state(),after);
    });
});
for(const protection of ['none','first'])for(const number of [1,2,3,4,5,6,7,8,10,16,19])test(`coordinated family ${number}, protected=${protection}: exact logical result with no physical deletion`,async()=>{
    await withHarness(typedFixture(F.references(F.families.find(f=>f.number===number).make(),protection)),async h=>{
        const before=h.db.state(),response=await h.apply(h.body),result=await response.json();
        assert.equal(response.status,200,JSON.stringify(result));const after=h.db.state();
        assert.ok(before.history.every(row=>after.history.some(stored=>String(stored._id)===String(row._id))));
        assert.deepEqual(after.references,before.references);
        assert.equal((await(await h.preview()).json()).settlementPreview.state,'clean');
    });
});
test('missing historical monetary amounts stay absent on real planned insert documents',async()=>{
    const data=typedFixture(F.references(F.initialGap()));
    for(const row of [data.currentEmployee,...data.completeHistoryRows])for(const field of ['nomimoOromisthio','pragmatikoOromisthio','poso_symbashs_15'])delete row[field];
    await withHarness(data,async h=>{
        const before=h.db.state(),response=await h.apply(h.body);assert.equal(response.status,200,JSON.stringify(await response.clone().json()));
        const newRows=h.db.state().history.filter(row=>!before.history.some(old=>String(old._id)===String(row._id)));
        assert.ok(newRows.length);
        for(const row of newRows)for(const field of ['nomimoOromisthio','pragmatikoOromisthio','poso_symbashs_15'])assert.equal(Object.hasOwn(row,field),false);
    });
});
for(const selectedSalary of [1100,1300])test(`one factual approval also synchronizes current terms to recorded salary ${selectedSalary}`,async()=>{
    const data=typedFixture(F.references(F.input([F.period(1,{pay:1100}),F.period(2,{pay:1300})])));
    const h=await startSettlementHarness({fixture:data,coordinated:true,enriched:false});
    try{
        const input=h.db.approvalInput(h.actor._id);
        const {coordinateEmployeeHistorySettlement:coordinate}=require('../../server/services/ergazomenoi/employeeHistorySettlementCoordinatorService');
        const pending=coordinate(input);
        const businessDecision=pending.decisions[0].options.map(option=>({snapshotFingerprint:pending.snapshotFingerprint,selections:{cycle_1:{choiceId:option.id}}}))
            .find(decision=>coordinate({...input,businessDecision:decision}).proposedRows.find(row=>!isInactiveHistoryRow(row)).synolo_symbashs===selectedSalary);
        const preview=await(await h.resolve(businessDecision)).json();assert.ok(preview.approvalFingerprint,JSON.stringify(preview));
        const body={businessDecision,approval:{confirmed:true,fingerprint:preview.approvalFingerprint}};
        const response=await h.apply(body);assert.equal(response.status,200,JSON.stringify(await response.clone().json()));
        const after=h.db.state();assert.equal(after.employees[0].synolo_symbashs,selectedSalary);
        assert.equal(after.audits.length,1);assert.equal((await(await h.preview()).json()).settlementPreview.state,'clean');
        const replay=await h.apply(body);assert.equal(replay.status,200,JSON.stringify(await replay.clone().json()));assert.deepEqual(h.db.state(),after);
    }finally{await h.close();}
});
test('two simultaneous identical approvals commit exactly one audit and return one alreadyApplied result',async()=>{
    await withHarness(acceptanceB({overlap:true}),async h=>{
        const responses=await Promise.all([h.apply(h.body),h.apply(h.body)]);
        const results=await Promise.all(responses.map(response=>response.json()));
        assert.ok(responses.every(response=>response.status===200),JSON.stringify(results));
        assert.equal(results.filter(result=>result.alreadyApplied).length,1);
        assert.equal(h.db.state().audits.length,1);assert.equal(h.db.events.filter(event=>event.type==='commit').length,1);
    });
});
for(const change of ['employee','reference'])test(`committed coordinated replay after later ${change} edit is stale without writes`,async()=>{
    await withHarness(acceptanceB(),async h=>{
        assert.equal((await h.apply(h.body)).status,200);
        if(change==='employee')h.db.changeEmployee({parathrhseis:'Συνθετική μεταγενέστερη αλλαγή'});else h.db.addReference(h.initial.completeHistoryRows[0]._id);
        const after=h.db.state(),start=h.db.events.length;
        assert.equal((await h.apply(h.body)).status,409);assert.deepEqual(h.db.state(),after);
        assert.equal(h.db.events.slice(start).some(event=>['write','fence','syntheticInsert'].includes(event.type)),false);
    });
});
test('current salary correction and all History mutations roll back together on audit failure',async()=>{
    const data=typedFixture(F.references(F.input([F.period(1,{pay:1100}),F.period(2,{pay:1300})])));
    const h=await startSettlementHarness({fixture:data,coordinated:true,enriched:false});
    try{
        const input=h.db.approvalInput(h.actor._id),{coordinateEmployeeHistorySettlement:coordinate}=require('../../server/services/ergazomenoi/employeeHistorySettlementCoordinatorService');
        const pending=coordinate(input),businessDecision=pending.decisions[0].options.map(option=>({snapshotFingerprint:pending.snapshotFingerprint,selections:{cycle_1:{choiceId:option.id}}}))
            .find(decision=>coordinate({...input,businessDecision:decision}).currentPatch.synolo_symbashs===1100);
        assert.ok(businessDecision);
        const preview=await(await h.resolve(businessDecision)).json(),before=h.db.state();h.db.failAt('AUDIT');
        const response=await h.apply({businessDecision,approval:{confirmed:true,fingerprint:preview.approvalFingerprint}});
        assert.notEqual(response.status,200);assert.deepEqual(h.db.state(),before);
        assert.equal(h.db.events.some(event=>event.type==='commit'),false);
    }finally{await h.close();}
});
