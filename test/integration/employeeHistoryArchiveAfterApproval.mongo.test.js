"use strict";
const {test}=require('node:test');const assert=require('node:assert/strict');
const F=require('../fixtures/employeeHistoryApprovedProposalMongo');
const Archive=require('../../server/services/ergazomenoi/employeeHistoryArchiveService');
const State=require('../../server/services/ergazomenoi/employeeHistoryArchiveStateService');
const Maintenance=require('../../server/services/ergazomenoi/employeeHistoryMaintenanceApprovalService');
const Cases=require('../../server/services/ergazomenoi/employeeHistoryProposalCaseService');
const Validation=require('../../server/services/ergazomenoi/employeeHistorySaveValidationService');
const Read=require('../../server/services/ergazomenoi/employeeHistoryProposalReadService');
const binary=process.env.PAYROLL_APPROVED_PROPOSAL_TEST_MONGOD;
for(const legacy of [false,true]) test(legacy
 ? 'Stored absent arrangement marker and break correction: full form save preserves existing receipts'
 : 'Archive 0002 then approve 0001: common management projection and original physical bytes', {skip:!binary,timeout:60000},async t=>{
 const db=await F.startApprovedProposalMongo(binary);t.after(db.close);const f=await F.seedApprovedProposal(db);
 const first={...(await db.historyModel.findById(f.history.at(-1)._id).lean()),_id:f.history[0]._id,aa_eggrafhs:'0001'};
 first.hmeromhnia_isxyos_oron_ergasias_apo=first.hmeromhnia_proslhpshs;first.hmeromhnia_isxyos_oron_ergasias_eos=null;
 if(legacy){delete first.afora_egkekrimenh_rythmish_ergasias;first.dialleima_se_lepta=0;}
 await db.historyModel.deleteMany(f.scope);await db.historyModel.collection.insertOne(first);
 await db.employeeModel.collection.updateOne({_id:f.employee._id},{$set:{apasxolhsh_basei_symbashs:'5',oysiodeis_oroi:'0',eponymo:'ΣΥΝΘΕΤΙΚΟΣ',onoma:'ΕΛΕΓΧΟΣ',afm:'123456789',amka:'12345678901',hmeromhnia_isxyos_oron_ergasias_apo:first.hmeromhnia_proslhpshs,hmeromhnia_isxyos_oron_ergasias_eos:null}});
 const current=await db.employeeModel.findById(f.employee._id).lean();await db.employeeModel.collection.replaceOne({_id:current._id},new db.employeeModel(current).toObject());
 const second={...first,_id:f.history[1]._id,aa_eggrafhs:'0002'};
 if(legacy) await db.employeeModel.collection.updateOne({_id:f.employee._id},{$set:{dialleima_se_lepta:30}});
 await db.historyModel.collection.insertOne(second);
 const input=async()=>Maintenance.loadMaintenanceApprovalInput(await originalInput(),db.auditModel);
 const originalInput=f.input;f.input=input;
 let i=await input();await Archive.createEmployeeHistoryArchiveService(db).archive(f.req,{...Archive.descriptor(f.req,i,second),confirmed:true});
 const originals=await db.historyModel.collection.find(f.scope,{raw:true}).sort({_id:1}).toArray();
 const approvals=require('../../server/services/ergazomenoi/employeeHistoryApprovedProposalService').createEmployeeHistoryApprovedProposalService(f.dependencies);
 const p=await F.approvedProposalBody(f,legacy?{values:{dialleima_se_lepta:'30',afora_egkekrimenh_rythmish_ergasias:'0'}}:{}),preview=await approvals.preview(f.req,p);
 await approvals.apply(f.req,{proposal:p,approval:{token:preview.approval.token,confirmed:true}});
 i=await input();
 if(legacy){
  const original=i.completeHistoryRows.find(r=>String(r._id)===String(first._id));
  const decision=Read.proposalHistoryState(i).decisions.find(a=>a.diagnostics.targetHistoryId===String(first._id));
  assert.equal(Object.hasOwn(original,'afora_egkekrimenh_rythmish_ergasias'),false);
  assert.equal(original.dialleima_se_lepta,0);
  assert.equal(decision.diagnostics.rowApproval.mode,'CORRECTION_EDITION');
  assert.equal(decision.diagnostics.rowApproval.approvedContent.afora_egkekrimenh_rythmish_ergasias,false);
  assert.equal(decision.diagnostics.rowApproval.approvedContent.dialleima_se_lepta,30);
 }
 const receiptsBeforeSave=await db.auditModel.collection.find({'employeeScope.employee_id':f.employee._id,
  mutationSource:{$in:[State.OPERATION,require('../../server/services/ergazomenoi/employeeHistoryApprovedProposalContract').OPERATION]}}).sort({_id:1}).toArray();
 const selection=Cases.selectEmployeeHistoryProposalCase(i,{status:'REVIEW_REQUIRED'});
 assert.equal(selection.total,0,JSON.stringify(selection));assert.equal(selection.reviewFindings.length,0);assert.equal(selection.historyStatus,'MANAGEMENT_RESOLVED');
 const inspect=Validation.inspectEmployeeHistorySave({scope:f.scope,currentEmployee:i.currentEmployee,historyRows:Read.proposalHistoryState(i).historyRows,approvedHistoryInput:i});
 assert.equal(inspect.status,'MANAGEMENT_RESOLVED',JSON.stringify(inspect.issues));assert.equal(inspect.historyCertified,false);
 const after=await db.historyModel.collection.find(f.scope,{raw:true}).sort({_id:1}).toArray();
 // The reference fence is intentionally technical; compare full business BSON.
 const source=raw=>State.source(require('mongoose').mongo.BSON.deserialize(raw));
 assert.deepEqual(after.map(source),originals.map(source));
 for(const [key,model] of Object.entries({scheduleModel:require('../../server/models/ergazomenoi').ProdhlomenaOrariaModel,branchModel:require('../../server/models/companies').YpokatasthmataModel})){
 db[key]=db.connection.model(model.modelName,model.schema.clone());await db[key].createCollection();}
 const h=await require('../fixtures/employeeHistoryArchiveFormHarness').controller(db,f);t.after(h.close);
 const body=await h.payload('NEW_CHANGE',Object.fromEntries(['hmeres_ergasias_ebdomadas','typos_ebdomadas','ores_ergasias_ebdomadas','mo_oron_hmerhsias_ergasias'].map(field=>[field,i.currentEmployee[field]])));
 delete body.change;body.formData.thlefono='2101234567';body.filesToUpdate={...body.filesToUpdate,isPermanent:false,erganiUploadMethod:'rest',e3_metaboles_ergasiakhs_sxeshs:true};
 const previewSave=await h.submit(body),saved=previewSave.body.preflight?await h.submit(h.confirm(body,previewSave)):previewSave;
 assert.equal(saved.body.success,true,JSON.stringify({saved,errors:h.errors}));assert.equal(h.effects.length,1);
 assert.deepEqual((await db.historyModel.collection.find(f.scope,{raw:true}).sort({_id:1}).toArray()).map(source),originals.map(source));
 const fresh=await input();const finalSelection=Cases.selectEmployeeHistoryProposalCase(fresh,{status:'REVIEW_REQUIRED'});
 assert.equal(finalSelection.total,0);assert.equal(finalSelection.completedRows.length,1);
 assert.equal(State.archivedIds(fresh).has(String(second._id)),true);
 assert.deepEqual(await db.auditModel.collection.find({'employeeScope.employee_id':f.employee._id,
  mutationSource:{$in:[State.OPERATION,require('../../server/services/ergazomenoi/employeeHistoryApprovedProposalContract').OPERATION]}}).sort({_id:1}).toArray(),receiptsBeforeSave);
 const bad=await h.payload('NEW_CHANGE',{hmeres_ergasias_ebdomadas:5,typos_ebdomadas:'5HMERH',ores_ergasias_ebdomadas:40,mo_oron_hmerhsias_ergasias:-1});
 assert.equal((await h.submit(bad)).body.success,false);
 await db.historyModel.collection.updateOne({_id:second._id},{$set:{nomimosMisthos:9000}});
 assert.equal(State.archivedIds(await input()).has(String(second._id)),false);
 assert.throws(()=>Maintenance.maintenanceHistoryState(fresh,(fresh.completeHistoryRows.map(r=>String(r._id)===String(second._id)?{...r,nomimosMisthos:9000}:r))));
});
