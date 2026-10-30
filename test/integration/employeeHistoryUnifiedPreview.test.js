'use strict';
const {test,before,after,mock}=require('node:test');
const assert=require('node:assert/strict');
const {forbidRealSettlementMongo}=require('../fixtures/forbidRealSettlementMongo');
const {startUnifiedPreviewHarness}=require('../fixtures/employeeHistoryUnifiedPreviewHttpHarness');
const F=require('../../server/services/ergazomenoi/fixtures/unifiedEmployeeHistorySettlementFixtures');
const A=require('../../server/services/ergazomenoi/employeeHistoryAutomaticReconstructionApplyContract');
before(()=>forbidRealSettlementMongo(mock));after(()=>mock.restoreAll());
for(const family of F.families) test(`synthetic HTTP family ${family.number}: production preview controller, real projection, zero writes`,async()=>{
    const data=family.make();
    // The public route requires a genuine BSON-shaped employee/company identity.
    Object.assign(data.scope,{team:'SYNTHETIC',company_kod:'610000000000000000000001'});
    Object.assign(data.currentEmployee,data.scope,{_id:F.identity(900)});
    data.completeHistoryRows.forEach(row=>Object.assign(row,data.scope));
    const h=await startUnifiedPreviewHarness({data}),before=A.stringify(h.state);
    try{
        const response=await h.preview(),payload=await response.json();assert.equal(response.status,200);
        assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(payload.executionMode,'PREVIEW_ONLY');
        const expected=family.expected==='CLEAN'?'clean':family.expected==='AUTOMATIC'?'automatic':family.expected==='BUSINESS_DECISION_REQUIRED'?'decision':'unknown';
        assert.equal(payload.settlementPreview.state,expected);
        assert.equal(payload.settlementPreview.executionEnabled,false);assert.equal(payload.approvalFingerprint,undefined);assert.equal(payload.previewToken,undefined);
        assert.equal(h.counts.referenceReads,data.completeHistoryRows.length);
        assert.ok(h.counts.selections.includes('+employee_profile_mutation_sequence'));
        assert.ok(h.counts.selections.includes('+history_reference_fence'));
        assert.doesNotMatch(JSON.stringify(payload),/history_reference_fence|employee_profile_mutation_sequence/);
        assert.equal(A.stringify(h.state),before);assert.equal(h.counts.applyRequests,0);
    }finally{await h.close();}
});
test('actual HTTP 423 blocks every approval-shaped request before permission reads, employee reads, sessions and writers',async()=>{
    const h=await startUnifiedPreviewHarness({data:F.initialGap()}),before=A.stringify(h.state);
    try{for(const body of [{},{approval:{confirmed:true,fingerprint:'forged'}},{executionEnabled:true,mode:'SYNTHETIC_ONLY'},
        {proposal:{status:'CLEAN'},businessDecision:{choiceId:'FORGED'}}]){
        const response=await h.apply(body),payload=await response.json();assert.equal(response.status,423);
        assert.equal(payload.code,'EMPLOYEE_HISTORY_SETTLEMENT_EXECUTION_DISABLED');assert.equal(payload.executionEnabled,false);
        assert.equal(response.headers.get('cache-control'),'no-store');assert.match(payload.message,/δεν αποθηκεύτηκε καμία αλλαγή/);
    }
    assert.equal(h.counts.employeeReads,0);assert.equal(h.counts.historyReads,0);assert.equal(h.counts.referenceReads,0);assert.equal(h.counts.permissionReads,0);
    assert.equal(A.stringify(h.state),before);
    }finally{await h.close();}
});
test('generic factual choices are recomputed by HTTP resolve; concurrent changes revoke the snapshot without writes',async()=>{
    const h=await startUnifiedPreviewHarness({data:F.references(F.payAlternatives())});
    try{const payload=await(await h.preview()).json(),preview=payload.settlementPreview;
        const decision={snapshotFingerprint:preview.decisionContext.snapshotFingerprint,selections:{cycle_1:{choiceId:preview.questions[0].options[0].id}}};
        const before=A.stringify(h.state),response=await h.resolve(decision),selected=await response.json();
        assert.equal(response.status,200);assert.equal(selected.settlementPreview.state,'automatic');assert.equal(selected.approvalFingerprint,undefined);
        assert.equal(A.stringify(h.state),before);
        h.state.completeHistoryRows[0].updatedAt=new Date('2026-02-01');const changed=A.stringify(h.state);
        const stale=await h.resolve(decision);assert.equal(stale.status,409);assert.equal(A.stringify(h.state),changed);
    }finally{await h.close();}
});
test('technical reference failure stays distinct from administrator review and exposes no partial proposal or exception',async()=>{
    const h=await startUnifiedPreviewHarness({data:F.initialGap(),failReferences:true});
    try{const response=await h.preview(),payload=await response.json();assert.equal(response.status,500);
        assert.equal(payload.code,'ΙΣΤ-ΑΥΤ-3Τ');
        assert.equal(payload.settlementPreview,undefined);assert.doesNotMatch(JSON.stringify(payload),/SYNTHETIC_PRIVATE_FAILURE|stack|historyId/);
    }finally{await h.close();}
});
