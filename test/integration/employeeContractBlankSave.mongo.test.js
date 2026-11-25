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
 f.scope.team='BLG';f.req.session.userTeam='BLG';
 await db.employeeModel.collection.updateOne({_id:f.employee._id},{$set:{team:'BLG'}});
 await db.historyModel.collection.updateMany({company_kod:f.scope.company_kod},{$set:{team:'BLG'}});
 await db.companyModel.collection.updateOne({_id:new mongoose.Types.ObjectId(f.scope.company_kod)},{$set:{team:'BLG'}});
 await db.userModel.collection.updateOne({_id:f.actor},{$set:{team:'BLG',privileges:'A'}});
 await db.privilegeModel.collection.updateOne({userId:String(f.actor)},{$set:{'privileges.admin':true}});
 const row=f.history.at(-1),hire=new Date('2026-11-26');
 // These collections belong exclusively to this newly spawned synthetic mongod.
 await db.historyModel.deleteMany(f.scope);
 await db.historyModel.collection.insertOne({...row,...f.scope,aa_eggrafhs:'0001',hmeromhnia_proslhpshs:hire,hmeromhnia_allaghs_symbashs:hire,hmeromhnia_isxyos_oron_ergasias_apo:hire,hmeromhnia_isxyos_oron_ergasias_eos:null,afora_proslhpsh:true});
 await db.employeeModel.collection.updateOne({_id:f.employee._id},{$set:{eponymo:'ΣΥΝΘΕΤΙΚΟΣ',onoma:'ΕΛΕΓΧΟΣ',afm:'123456789',amka:'12345678901',hmeromhnia_proslhpshs:hire,hmeromhnia_allaghs_symbashs:hire,hmeromhnia_isxyos_oron_ergasias_apo:hire,apasxolhsh_basei_symbashs:'',oristikh_enhmerosh:true}});
 const initial=await f.input();const inspected=Validation.inspectEmployeeHistorySave({scope:f.scope,currentEmployee:initial.currentEmployee,historyRows:initial.completeHistoryRows});
 assert.equal(inspected.status,'CLEAN',JSON.stringify(inspected.issues));
 const h=await controller(db,f);t.after(h.close);
 const body=await h.payload('NEW_CHANGE',{hmeres_ergasias_ebdomadas:5,typos_ebdomadas:'5HMERH',ores_ergasias_ebdomadas:40,mo_oron_hmerhsias_ergasias:8});delete body.change;
 body.formData.apasxolhsh_basei_symbashs='5';body.filesToUpdate.isPermanent=false;
 const before=await f.snapshot();
 const preview=await h.submit(body);assert.equal(preview.body.success,true,JSON.stringify({preview,errors:h.errors}));
 assert.equal(preview.body.preflight,true);assert.equal(await f.snapshot(),before);
 // Render the real complete EJS form and run the production preview/approval
 // continuation in Chromium, against the real isolated HTTP writer above.
 const path=require('node:path'),fs=require('node:fs'),root=path.resolve(__dirname,'../..');
 const R=require('../../server/utils/ergazomenoi/historicalProfileComparison');
 const employee=initial.currentEmployee;
 const html=(await require('ejs').renderFile(path.join(root,'views/ergazomenoi/ergazomenoi/edit.ejs'),{
  ergazomenoiData:employee,rec:employee,companyData:{apasxolhsh_kata_tis_argies:true},
  employeeHistoryComparison:R.clientBaseline(employee),originalEmploymentHistoryId:'',originalEmploymentHistoryRevision:'',
  employeeStateToken:'',employeeHistoryStateToken:'',employeeHistoryAccessMode:'NONE',problematicHistoryIds:[],
  istorikoData:initial.completeHistoryRows,orariaData:[],perifereies:[],genikesParametroi:[],sessionYearInUse:2026,
  companyInUse:'TEST',userTeam:'BLG',NODE_ENV:'development',nonce:'',csrfToken:'synthetic',userRole:'A',
  CONFIG:{EGGRAFES:20},script:()=>'',mode:'edit',context:'ergazomenoi'
 })).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
 const browser=await require('playwright').chromium.launch({headless:true,args:['--no-sandbox']});t.after(()=>browser.close());
 const page=await browser.newPage({locale:'el-GR'});await page.route('**/*',route=>route.abort());
 await page.setContent('<!doctype html><html lang="el"><meta charset="utf-8"><body>'+html+'</body></html>');
 await page.evaluate(()=>{document.querySelectorAll('[inert]').forEach(node=>node.inert=false);
  const select=document.getElementById('apasxolhsh_basei_symbashs');select.add(new Option('5ΗΜΕΡΗ','5'));});
 await page.locator('#apasxolhsh_basei_symbashs').selectOption('5',{force:true});
 assert.equal(await page.locator('#apasxolhsh_basei_symbashs').inputValue(),'5');
 await page.addScriptTag({path:require.resolve('sweetalert2/dist/sweetalert2.all.js')});
 await page.addStyleTag({path:require.resolve('sweetalert2/dist/sweetalert2.css')});
 const source=fs.readFileSync(path.join(root,'public/js/ergazomenoi/genika/putFieldValues.js'),'utf8');
 await page.addScriptTag({content:source.slice(0,source.indexOf("document.addEventListener('DOMContentLoaded'"))});
 await page.exposeFunction('submitSyntheticEmployee',payload=>h.submit(payload));
 await page.evaluate(({body,preview})=>{
  body.formData.apasxolhsh_basei_symbashs=document.getElementById('apasxolhsh_basei_symbashs').value;
  const response=new Response(JSON.stringify(preview.body),{headers:{'content-type':'application/json'}});
  window.savedEmployeePromise=continueEmployeeSaveWithHistoryDecision({response,originalPayload:body,swal:Swal,documentRef:document,
   retryRequest:async payload=>{const result=await window.submitSyntheticEmployee(payload);return new Response(JSON.stringify(result.body),{status:result.statusCode,headers:{'content-type':'application/json'}});}
  }).then(async result=>({body:await result.response.json(),statusCode:result.response.status}));
 },{body,preview});
 await page.getByRole('button',{name:'Έγκριση και αποθήκευση',exact:true}).click();
 const saved=await page.evaluate(()=>window.savedEmployeePromise);
 assert.equal(saved.body.success,true,JSON.stringify({saved,errors:h.errors}));
 assert.equal((await db.employeeModel.findById(f.employee._id).lean()).apasxolhsh_basei_symbashs,'5');
 const history=await db.historyModel.findOne(f.scope).lean();assert.equal(history.aa_eggrafhs,'0001');assert.equal(history.typos_ebdomadas,'5HMERH');assert.equal(Object.hasOwn(history,'apasxolhsh_basei_symbashs'),false);
 assert.equal(await db.historyModel.countDocuments(f.scope),1);assert.deepEqual(h.effects,[]);
 assert.equal(mongoose.connection.readyState,0);
});
