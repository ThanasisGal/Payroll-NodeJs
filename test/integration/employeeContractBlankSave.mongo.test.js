"use strict";
const {test}=require('node:test');const assert=require('node:assert/strict');const mongoose=require('mongoose');
const F=require('../fixtures/employeeHistoryApprovedProposalMongo');
const {controller}=require('../fixtures/employeeHistoryArchiveFormHarness');
const Validation=require('../../server/services/ergazomenoi/employeeHistorySaveValidationService');
const binary=process.env.PAYROLL_APPROVED_PROPOSAL_TEST_MONGOD;
test('Future hire 26/11/2026: full form empty contract to five-day with temporary external selection and explicit approval', {skip:!binary,timeout:60000},async t=>{
 const db=await F.startApprovedProposalMongo(binary);t.after(db.close);
 for(const [key,model] of Object.entries({scheduleModel:require('../../server/models/ergazomenoi').ProdhlomenaOrariaModel,branchModel:require('../../server/models/companies').YpokatasthmataModel})){
 db[key]=db.connection.model(model.modelName,model.schema.clone());await db[key].createCollection();}
 const f=await F.seedApprovedProposal(db);
 const row=f.history.at(-1),hire=new Date('2026-11-26');
 // These collections belong exclusively to this newly spawned synthetic mongod.
 await db.historyModel.deleteMany(f.scope);
 await db.historyModel.collection.insertOne({...row,aa_eggrafhs:'0001',hmeromhnia_proslhpshs:hire,hmeromhnia_allaghs_symbashs:hire,hmeromhnia_isxyos_oron_ergasias_apo:hire,hmeromhnia_isxyos_oron_ergasias_eos:null,afora_proslhpsh:true});
 await db.employeeModel.collection.updateOne({_id:f.employee._id},{$set:{eponymo:'ΣΥΝΘΕΤΙΚΟΣ',onoma:'ΕΛΕΓΧΟΣ',afm:'123456789',amka:'12345678901',hmeromhnia_proslhpshs:hire,hmeromhnia_allaghs_symbashs:hire,hmeromhnia_isxyos_oron_ergasias_apo:hire,apasxolhsh_basei_symbashs:'',oristikh_enhmerosh:true}});
 const initial=await f.input();const inspected=Validation.inspectEmployeeHistorySave({scope:f.scope,currentEmployee:initial.currentEmployee,historyRows:initial.completeHistoryRows});
 assert.equal(inspected.status,'CLEAN',JSON.stringify(inspected.issues));
 const h=await controller(db,f);t.after(h.close);
 const body=await h.payload('NEW_CHANGE',{hmeres_ergasias_ebdomadas:5,typos_ebdomadas:'5HMERH',ores_ergasias_ebdomadas:40,mo_oron_hmerhsias_ergasias:8});delete body.change;
 body.formData.apasxolhsh_basei_symbashs='5';body.filesToUpdate.isPermanent=false;
 const before=await f.snapshot();
 const preview=await h.submit(body);assert.equal(preview.body.success,true,JSON.stringify({preview,errors:h.errors}));
 assert.equal(preview.body.preflight,true);assert.equal(await f.snapshot(),before);
 const saved=preview.body.preflight?await h.submit(h.confirm(body,preview)):preview;
 assert.equal(saved.body.success,true,JSON.stringify({saved,errors:h.errors}));
 assert.equal((await db.employeeModel.findById(f.employee._id).lean()).apasxolhsh_basei_symbashs,'5');
 const history=await db.historyModel.findOne(f.scope).lean();assert.equal(history.aa_eggrafhs,'0001');assert.equal(history.typos_ebdomadas,'5HMERH');assert.equal(Object.hasOwn(history,'apasxolhsh_basei_symbashs'),false);
 assert.equal(await db.historyModel.countDocuments(f.scope),1);assert.deepEqual(h.effects,[]);
 assert.equal(mongoose.connection.readyState,0);
});
