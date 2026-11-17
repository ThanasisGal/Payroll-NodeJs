'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {startApprovedProposalMongo,approvedProposalBody}=require('../fixtures/employeeHistoryApprovedProposalMongo');
const {seedLegacyStructure,seedLegacyFrozen,rawState}=require('../fixtures/employeeHistoryLegacyStructure');
const {createEmployeeHistoryApprovedProposalService:create}=require('../../server/services/ergazomenoi/employeeHistoryApprovedProposalService');
const binary=process.env.PAYROLL_APPROVED_PROPOSAL_TEST_MONGOD;
const approve=(proposal,preview)=>({proposal,approval:{token:preview.approval.token,confirmed:true}});
test('Παλιά ιστορική δομή: ανεξάρτητη εγκεκριμένη έκδοση και αμετάβλητα προστατευμένα πρωτότυπα',{skip:!binary,timeout:90000},async t=>{
    const db=await startApprovedProposalMongo(binary);t.after(db.close);
    for(const version of ['employment-period-frozen:v1','employment-period-frozen:v2','employment-period-frozen:v3'])await t.test(`${version}: καμία απαίτηση πιστοποίησης άλλων εγγραφών ή κατασκευής περιόδων`,async()=>{
        const f=await seedLegacyStructure(db);await seedLegacyFrozen(f,{version,finalized:true});
        await db.historyModel.collection.updateOne({_id:f.history[1]._id},{$unset:{nomimosMisthos:1,dialleima_se_lepta:1}});
        const before=await rawState(f),service=create(f.dependencies),proposal=await approvedProposalBody(f,{values:{nomimosMisthos:'1456.78'}});
        const preview=await service.preview(f.req,proposal);assert.equal(preview.certification,null);
        const result=await service.apply(f.req,approve(proposal,preview));assert.equal(result.selectedCaseStatus,'APPROVED_RESOLVED');assert.equal(result.historyStatus,'REVIEW_REQUIRED');
        const after=await rawState(f);assert.deepEqual(after.history,before.history);assert.deepEqual(after.frozen,before.frozen);assert.deepEqual(after.controls,before.controls);
        const audit=await db.auditModel.findById(result.auditId).lean();assert.equal(audit.diagnostics.rowApproval.approvedContent.nomimosMisthos,1456.78);
        assert.equal(audit.diagnostics.rowApproval.status,'APPROVED_RESOLVED');assert.equal(audit.diagnostics.rowApproval.mode,'CORRECTION_EDITION');
        assert.deepEqual(audit.diagnostics.approvedFields,['nomimosMisthos']);
    });
    await t.test('Άγνωστα παλιά όρια και παλιά κλειδωμένη περίοδος: χωριστή έκδοση, χωρίς επινοημένα ιστορικά γεγονότα',async()=>{
        const f=await seedLegacyStructure(db);
        await db.periodControlModel.collection.insertOne({...f.scope,ypokatasthma:'0000',status:'LOCKED'});
        const before=await rawState(f),service=create(f.dependencies),proposal=await approvedProposalBody(f,{values:{dialleima_se_lepta:'0'}});
        const preview=await service.preview(f.req,proposal),result=await service.apply(f.req,approve(proposal,preview));
        assert.equal(result.selectedCaseStatus,'APPROVED_RESOLVED');const after=await rawState(f);
        assert.deepEqual(after.history,before.history);assert.deepEqual(after.controls,before.controls);
    });
    await t.test('Παραποιημένο αίτημα συνολικής πιστοποίησης απορρίπτεται πριν από εγγραφή',async()=>{
        const f=await seedLegacyStructure(db),proposal=await approvedProposalBody(f),before=await f.snapshot();
        proposal.legacyCertification={confirmed:true};await assert.rejects(create(f.dependencies).preview(f.req,proposal),error=>error.reason==='REQUEST');
        assert.equal(await f.snapshot(),before);
    });
});
