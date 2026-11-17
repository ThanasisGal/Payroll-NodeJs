'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const F=require('../fixtures/employeeHistoryApprovedProposalMongo');
const {createEmployeeHistoryApprovedProposalService:create}=require('../../server/services/ergazomenoi/employeeHistoryApprovedProposalService');
const Profile=require('../../server/utils/ergazomenoi/employmentProfileContract');
const binary=process.env.PAYROLL_APPROVED_PROPOSAL_TEST_MONGOD;
const approve=(proposal,preview)=>({proposal,approval:{token:preview.approval.token,confirmed:true}});
test('Παλιά μη πιστοποιημένα προφίλ: οι ρητές τιμές εγκρίνονται χωρίς πρόσθετη πιστοποίηση',{skip:!binary,timeout:90000},async t=>{
    const db=await F.startApprovedProposalMongo(binary);t.after(db.close);
    for(const state of ['absent','null','empty'])await t.test(`Κενές ημέρες ${state}: διατήρηση απουσίας, ρητό [] και καμία κατασκευή εκδόσεων`,async()=>{
        const f=await F.seedApprovedProposal(db);
        await db.historyModel.collection.updateOne({_id:f.history[0]._id},{$unset:{[Profile.SCHEMA_VERSION]:1,[Profile.TYPE_VERSION]:1,...(state==='absent'?{[Profile.DAYS]:1}:{})},
            ...(state==='absent'?{}:{$set:{[Profile.DAYS]:state==='null'?null:[]}})});
        const service=create(f.dependencies),proposal=await F.approvedProposalBody(f,{values:{nomimosMisthos:'1456.78',[Profile.DAYS]:''}});
        const preview=await service.preview(f.req,proposal);assert.equal(preview.certification,null);
        assert.deepEqual(preview.rows.map(row=>row.fieldId),['nomimosMisthos']);
        await service.apply(f.req,approve(proposal,preview));
        const saved=await db.historyModel.findById(f.history[0]._id).lean();
        assert.equal(Object.hasOwn(saved,Profile.SCHEMA_VERSION),false);assert.equal(Object.hasOwn(saved,Profile.TYPE_VERSION),false);
        assert.equal(Object.hasOwn(saved,Profile.DAYS),state!=='absent');if(state!=='absent')assert.deepEqual(saved[Profile.DAYS],state==='null'?null:[]);
        const explicit=await F.approvedProposalBody(f,{values:{[Profile.DAYS]:[]}}),checked=await service.preview(f.req,explicit);
        await service.apply(f.req,approve(explicit,checked));
        assert.deepEqual((await db.historyModel.findById(f.history[0]._id).lean())[Profile.DAYS],[]);
    });
    await t.test('Ρητή ενεργοποίηση με παλιά ελλιπή στοιχεία, κενή αιτιολογία και ακριβές audit',async()=>{
        const f=await F.seedApprovedProposal(db);
        await db.historyModel.collection.updateOne({_id:f.history[0]._id},{$unset:{[Profile.SCHEMA_VERSION]:1,[Profile.TYPE_VERSION]:1}});
        const service=create(f.dependencies),proposal=await F.approvedProposalBody(f,{values:{[Profile.ENABLED]:'1',[Profile.TYPE]:'OTHER_APPROVED_ARRANGEMENT',EVIDENCE:''}});
        const preview=await service.preview(f.req,proposal);assert.equal(preview.certification,null);
        const result=await service.apply(f.req,approve(proposal,preview));assert.equal(result.selectedCaseStatus,'APPROVED_RESOLVED');
        const audit=await db.auditModel.findById(result.auditId).lean();assert.equal(audit.diagnostics.evidence,'');
        assert.equal(Object.hasOwn(audit.diagnostics.actualAfter,Profile.SCHEMA_VERSION),false);
        assert.equal(audit.diagnostics.rowApproval.verification.actorUserId,String(f.actor));
    });
    await t.test('Η παλιά πρόσθετη πιστοποίηση δεν είναι διαθέσιμη ως διαδρομή XLSX',async()=>{
        const f=await F.seedApprovedProposal(db),http=await F.startApprovedProposalHttp(f,create(f.dependencies));
        try{
            const response=await fetch(`${http.origin}/api/ergazomenoi/${f.employee._id}/history-proposal-certification-preview`,{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':'synthetic-approved-csrf'},body:'{}'});
            assert.equal(response.status,404);
        }finally{await http.close();}
    });
});
