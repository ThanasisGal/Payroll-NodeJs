"use strict";
const {test}=require('node:test');const assert=require('node:assert/strict');
const F=require('../fixtures/employeeHistoryApprovedProposalMongo');
const {createEmployeeHistoryApprovedProposalService:create}=require('../../server/services/ergazomenoi/employeeHistoryApprovedProposalService');
const binary=process.env.PAYROLL_APPROVED_PROPOSAL_TEST_MONGOD;
test('XLSX rights: permitted actor, BLG Admin, denied module, foreign group/company and changed field',{skip:!binary,timeout:60000},async t=>{
 const db=await F.startApprovedProposalMongo(binary);t.after(db.close);
 for(const scenario of ['allowed','BLG_ADMIN','no-module-update','foreign-group','foreign-company']){
  const f=await F.seedApprovedProposal(db);const service=create({...f.dependencies,logger:{info(){}}});
  const proposal=await F.approvedProposalBody(f);
  if(scenario==='allowed'){
   const preview=await service.preview(f.req,proposal);const saved=await service.apply(f.req,{proposal,approval:{token:preview.approval.token,confirmed:true}});
   assert.equal(saved.verification.persisted,true);continue;
  }
  if(scenario==='BLG_ADMIN'){
   f.scope.team='BLG';f.req.session.userTeam='BLG';
   await db.employeeModel.collection.updateOne({_id:f.employee._id},{$set:{team:'BLG'}});
   await db.historyModel.collection.updateMany({company_kod:f.scope.company_kod},{$set:{team:'BLG'}});
   await db.companyModel.collection.updateOne({_id:new (require('mongoose').Types.ObjectId)(f.scope.company_kod)},{$set:{team:'BLG'}});
   await db.userModel.collection.updateOne({_id:f.actor},{$set:{team:'BLG',privileges:'A'}});
   await db.privilegeModel.collection.updateOne({userId:String(f.actor)},{$set:{'privileges.admin':true}});
  }
  if(scenario==='no-module-update')await db.privilegeModel.collection.updateOne({userId:String(f.actor)},{$set:{privileges:{read:true}}});
  if(scenario==='foreign-group')await db.userModel.collection.updateOne({_id:f.actor},{$set:{team:'OTHER'}});
  if(scenario==='foreign-company')f.req.session.companyInUse=String(new (require('mongoose').Types.ObjectId)());
  const before=await f.snapshot();
  await assert.rejects(service.preview(f.req,proposal),error=>error.statusCode===403 &&
   (scenario!=='BLG_ADMIN'||error.code==='EMPLOYEE_HISTORY_AUTOMATIC_RECONSTRUCTION_FORBIDDEN'));
  assert.equal(await f.snapshot(),before);
 }
});
