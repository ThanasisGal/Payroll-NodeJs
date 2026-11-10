'use strict';
// Actual controller handlers/helpers and business services. Persistence and the
// authenticated session are synthetic; no app.js, dotenv, jobs or database.
const {test,before,after,mock}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),Module=require('node:module');
const express=require('express'),mongoose=require('mongoose'),{once}=require('node:events');
const dates=require('../../utils/date/mondaySundayWeek');
const src=fs.readFileSync(require.resolve('./erganhController'),'utf8');
const routes=fs.readFileSync(require.resolve('../../routes/usersRoute'),'utf8');
const bind=(code,deps)=>Function(...Object.keys(deps),code)(...Object.values(deps));
function section(a,b){const i=src.indexOf(a),j=src.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,a);return src.slice(i,j);}
function handler(name,deps){const i=src.indexOf('static '+name+' ='),j=src.indexOf('\n    static ',i+1);const s=src.slice(i,j);const end=s.lastIndexOf('};');return bind('return ('+s.slice(s.indexOf('=')+1,end+1).trim()+');',deps);}
const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
const q=value=>({select(){return this;},sort(){return this;},session(){return this;},lean:async()=>clone(value)});
let hooks;
before(()=>{
 require('../../../test/fixtures/forbidRealSettlementMongo').forbidRealSettlementMongo(mock);
 const load=Module._load;
 try{Module._load=function(name,parent,main){if(name==='libxmljs2')return {};if(name==='../../config/aws')return {s3Client:{}};return load.call(this,name,parent,main);};hooks=require('./erganhController').__stage3DailyEmploymentProfileTestHooks;}finally{Module._load=load;}
});
after(()=>mock.restoreAll());
const role=require('../../services/ergazomenoi/apasxoliseisCriticalActionAuthorizationService');
const lifecycle=require('../../services/ergazomenoi/apasxoliseisWeeklyHrLifecycleProjectionService');
const repo=require('../../services/ergazomenoi/apasxoliseisWeeklyRepoTransferAuthoritativeContextService');
const borrowed=require('../../services/ergazomenoi/apasxoliseisBorrowedEmploymentProfileResolverService');
const stage1=require('../../services/ergazomenoi/apasxoliseisWeeklyHrWorkflowStage1CompletionService');
const stage2=require('../../services/ergazomenoi/apasxoliseisWeeklyHrWorkflowStage2CompletionService');
const stage3=require('../../services/ergazomenoi/apasxoliseisWeeklyHrWorkflowStage3ResolutionService');
const bulk3=require('../../services/ergazomenoi/apasxoliseisWeeklyHrWorkflowStage3BulkApplyService');
const preview3=require('../../services/ergazomenoi/apasxoliseisWeeklyHrStage3BulkPreviewService');
const fingerprints=require('../../services/ergazomenoi/apasxoliseisStage3FingerprintService');
async function start({snapshotType=null,finalized=false,badCard=false}={}){
 const f=require('../../../test/fixtures/employeeActiveHistoryFixture').employeeActiveHistoryFixture('SYNTHETIC');
 const base={team:f.scope.team,company_kod:f.scope.company_kod,ypokatasthma:'0000'};
 const scope={...base,employee_id:f.employee._id,employee_kodikos:f.employee.kodikos,week_start:'2026-06-01',week_end:'2026-06-07'};
 const periodScope={...base,period_start:'2026-06-01',period_end:'2026-06-30'};
 const history=[f.history[0],{...clone(f.history[0]),_id:'507f1f77bcf86cd799439102',aa_eggrafhs:'0002'}];
 const store={state:null,audits:[],dailyAudits:[],rows:Array.from({length:7},(_,i)=>({...base,kodikos:f.employee.kodikos,
 _id:(0x640000000000000000000000n+BigInt(i)).toString(16),hmeromhnia:'2026-06-0'+(i+1),updatedAt:'2026-06-30T00:00:00.000Z',
 kathgoria_ergasias:'ΕΡΓ',ores_ergasias:6,apo_ora_01:'09:00',eos_ora_01:'15:00',
 cards_apo_ora_01:i===2?'':'09:00',cards_eos_ora_01:i===2?'':badCard&&i===0?'09:00':'15:00',cards_ores_ergasias:i===2?0:6,
 kathgoria_ergasias_apologistika:i===2?'':'ΕΡΓ',kathgoria_adeias_apologistika:i===2?'POSSIBLE_LEAVE':'',
 ores_ergasias_apologistika:i===2?0:6,ores_pragmatikhs_ergasias_apologistika:i===2?0:6,
 repo:false,repo_apologistika:false,adeia_apologistika:false,astheneia_apologistika:false,apousia_apologistika:false,apologistiko_biblio:false,is_locked:false,
 ...(snapshotType?{kathestos_apasxolhshs_hmeras:snapshotType}:{})})),history:clone(history),
 frozen:{schema:'synthetic-frozen',amount:123.45},oldAudit:{id:'immutable-audit',value:987}};
 const originals=clone({history:store.history,frozen:store.frozen,oldAudit:store.oldAudit});
 const matches=(row,filter)=>Object.entries(filter).every(([k,v])=>{const a=k.split('.').reduce((x,key)=>x?.[key],row);if(v instanceof Date)return new Date(a).getTime()===v.getTime();if(v&&typeof v==='object'&&!(v instanceof Date)&&!(v instanceof mongoose.Types.ObjectId)){if('$exists'in v)return (a!==undefined)===v.$exists;if('$ne'in v)return a!==v.$ne;}return String(a)===String(v);});
 const updateState=async(filter,update)=>{if(!store.state||!matches(store.state,filter))return {matchedCount:0};Object.assign(store.state,clone(update.$set));return {matchedCount:1};};
 const stateModel={findOne:()=>q(store.state),create:async([s])=>{store.state=clone(s);return [store.state];},updateOne:updateState,collection:{updateOne:updateState}};
 const auditModel={findOne:filter=>q(store.audits.find(a=>a.request_id===filter.request_id)||null),find:filter=>q(store.audits.filter(a=>!filter?.request_id?.$regex||new RegExp(filter.request_id.$regex).test(a.request_id))),create:async(records)=>{store.audits.push(...clone(records));return records;}};
 const dailyModel={find:()=>q(store.rows),findOne:filter=>q(store.rows.find(r=>String(r._id)===String(filter._id))||null),updateOne:async(filter,update)=>{const row=store.rows.find(r=>matches(r,filter));if(!row)return {matchedCount:0};Object.assign(row,clone(update.$set));return {matchedCount:1};}};
 const dailyAudit={create:async records=>{store.dailyAudits.push(...clone(records));return records;}};
 const periodAccess=async()=>{if(finalized)throw Object.assign(new Error('frozen'),{code:'PERIOD_CONTROL_FINALIZED',statusCode:409});return {scope:periodScope,state:{effective_mode:'NORMAL',version:1,write_fence_version:1},token:{}};};
 const fence=async({work})=>{await periodAccess();const old=clone(store);try{return {result:await work({session:{synthetic:true},state:{version:1,write_fence_version:1}})};}catch(e){Object.assign(store,old);throw e;}};
 const writeDaily=args=>require('../../services/ergazomenoi/apasxoliseisCanonicalDailyClassificationWriterService').writeCanonicalDailyClassification({...args,prodhlomenaModel:dailyModel,prodhlomenaAuditModel:dailyAudit});
 const weekly=async()=>{const resolveProfileForDate=date=>borrowed.resolveEffectiveEmploymentProfileForReviewDate({reviewDate:date,normalEmployee:f.employee,normalHistory:history});
 const rows=clone(store.rows),profiles=Object.fromEntries(rows.map(row=>[row.hmeromhnia,repo.getDailyRepoProfileInfo({row,resolveProfileForDate}).profile]));
 return {base,employee:f.employee,rows,histories:history,resolveProfileForDate,effectiveProfile:resolveProfileForDate('2026-06-07'),effectiveProfilesByDate:profiles,
 week:{start:new Date('2026-06-01'),end:new Date('2026-06-07'),startKey:'2026-06-01',endKey:'2026-06-07'},periodScope,companySettings:{},employmentDateScope:{employment_owned_dates:rows.map(r=>r.hmeromhnia),authoritative_date_set:rows.map(r=>r.hmeromhnia),context_only_dates:[]}};};
 const deps={...dates,...hooks,...lifecycle,...fingerprints,mongoose,console,
 ...require('../../services/ergazomenoi/apasxoliseisStage1DailyClassificationBulkService'),
 ...require('../../services/ergazomenoi/apasxoliseisWeeklyRepoTransferAppliedProtectionService'),
 ...require('../../services/ergazomenoi/apasxoliseisOrphanResolutionPersistenceService'),
 ...require('../../services/ergazomenoi/apasxoliseisHrLeaveCategoryPolicyService'),
 REVIEW_SELECT_FIELDS:'',canReviewEdit:req=>role.isCriticalEmploymentDecisionRoleAllowed(req.session.userRole),
 activeEmploymentReviewPeriodScope:async()=>periodScope,
 assertReviewRowEmploymentDate:async({row})=>{assert.equal(row.kodikos,f.employee.kodikos);},
 orphanResolutionBoundaryTestOverrides:{loadOldRecord:async({id})=>clone(store.rows.find(r=>r._id===id)),
 assertEmploymentDate:async({row})=>{assert.equal(row.kodikos,f.employee.kodikos);},getPeriodAccess:periodAccess,periodFence:fence,loadAppliedProtection:async()=>({entriesByRowId:{}})},
 reviewErrorResponse:(error,...args)=>{if(!error.code)console.error('SYNTHETIC_ERROR',error.stack);return require('../../services/ergazomenoi/apasxoliseisReviewErrorPresentationService').reviewErrorResponse(error,...args);},
 weeklyHrApiError:(code,statusCode,message)=>Object.assign(new Error(message),{code,statusCode}),
 assertWeeklyHrWorkflowIndexesReady:async()=>{},loadWeeklyHrContext:weekly,
 ProdhlomenaOrariaModel:dailyModel,ProdhlomenaOrariaAuditModel:dailyAudit,
 buildPreparedPhaseHistoryMaps:require('../../services/kinhseis/preparedPhaseHistoryDatasetService').buildPreparedPhaseHistoryMaps,
 ApasxoliseisWeeklyHrWorkflowStateModel:stateModel,ApasxoliseisWeeklyHrWorkflowAuditModel:auditModel,
 assertActiveEmploymentReviewStage1CompletionReadable:periodAccess,assertActiveEmploymentReviewPeriodReadable:periodAccess,
 assertActiveEmploymentReviewStage3DayWritable:periodAccess,
 runWithPeriodWriteFence:fence,runWithStaleStage1CompletionWriteFence:fence,runWithStaleStage2MaterializationWriteFence:fence,runWithStaleStage3ResolutionWriteFence:fence,
 completeWeeklyHrWorkflowStage1:stage1.completeWeeklyHrWorkflowStage1,
 completeWeeklyHrWorkflowStage2:args=>stage2.completeWeeklyHrWorkflowStage2({...args,stateModel,auditModel,writeDaily}),
 executeWeeklyHrStage3Day:args=>stage3.resolveWeeklyHrStage3Day({...args,stateModel,auditModel,writeDaily}),
 createStage1BulkPeriodAccessResolver:require('../../services/ergazomenoi/apasxoliseisWeeklyHrWorkflowStage1BulkCompletionService').createStage1BulkPeriodAccessResolver,
 completeWeeklyHrWorkflowStage1Bulk:args=>require('../../services/ergazomenoi/apasxoliseisWeeklyHrWorkflowStage1BulkCompletionService').completeWeeklyHrWorkflowStage1Bulk({...args,indexGuard:async()=>{}}),
 buildWeeklyHrStage3BulkPreview:preview3.buildWeeklyHrStage3BulkPreview,
 normalizeStage3BulkApplyCommand:bulk3.normalizeStage3BulkApplyCommand,
 inspectStage3BulkIdempotency:args=>bulk3.inspectStage3BulkIdempotency({...args,auditModel}),
 applyWeeklyHrStage3Bulk:args=>bulk3.applyWeeklyHrStage3Bulk({...args,auditModel}),
 isDateInsideEmploymentPeriod:require('../../services/ergazomenoi/apasxoliseisPeriodControlService').isDateInsideEmploymentPeriod,
 Models_A:{KathgoriesAdeiasModel:{findOne:filter=>q(['LEAVE','SICK'].includes(filter.kodikos)?{_id:'category',kodikos:filter.kodikos,perigrafh:'Συνθετική κατηγορία'}:null)}},buildHrSelectableLeaveCategoryQuery:()=>({}),
 buildReviewPhaseContextByKodikos:async()=>new Map(),getReviewPhaseCodeForRow:()=>'',
 resolveStage3DailyActualWorkFacts:require('../../services/ergazomenoi/apasxoliseisDailyActualWorkFactsService').resolveDailyActualWorkFacts,
 stage3FingerprintResolvedDates:lifecycle.stage3FingerprintResolvedDates};
 deps.completeWeeklyHrStage1ForScope=bind(section('async function completeWeeklyHrStage1ForScope(','const CORRECTIVE_DELTA_LABELS')+';return completeWeeklyHrStage1ForScope;',deps);
 deps.loadWeeklyHrStage2CompletionContext=bind(section('async function loadWeeklyHrStage2CompletionContext(','async function prepareWeeklyHrStage2PairRecords')+';return loadWeeklyHrStage2CompletionContext;',deps);
 deps.loadWeeklyHrStage3DecisionContext=bind(section('async function loadWeeklyHrStage3DecisionContext(','async function assertActiveEmploymentReviewStage3DayWritable')+';return loadWeeklyHrStage3DecisionContext;',deps);
 deps.assertReviewDecisionMutualExclusion=bind(section('function assertReviewDecisionMutualExclusion(','async function activeEmploymentReviewPeriodDates')+';return assertReviewDecisionMutualExclusion;',deps);
 deps.blocksInteractiveAppliedIdentityChange=bind(section('function blocksInteractiveAppliedIdentityChange(','function clampDateStartUtc(')+';return blocksInteractiveAppliedIdentityChange;',deps);
 deps.buildStage1ClassificationUpdates=require('../../services/ergazomenoi/apasxoliseisStage1DailyClassificationBulkService').classificationUpdates;
 const controller={};deps.erganhController=controller;
 const app=express();app.use(express.json());app.use((req,res,next)=>{req.session={userId:'507f191e810c19729de860ea',userRole:req.headers['x-test-role']||'HR',userName:'Συνθετικός υπεύθυνος',userTeam:base.team,companyInUse:base.company_kod,appDate:'2026-06-30'};next();});
 const prefix='/api/prodhlomena-oraria/review/weekly-hr-workflow/';
 const actions=[['stage1/complete','completeWeeklyHrWorkflowStage1'],['stage1/bulk-complete','completeWeeklyHrWorkflowStage1Bulk'],['stage2/complete','completeWeeklyHrWorkflowStage2'],['stage3/resolve-day','resolveWeeklyHrStage3Day'],['stage3/bulk-preview','previewWeeklyHrStage3Bulk'],['stage3/bulk-apply','applyWeeklyHrStage3Bulk'],['stage1/bulk-classify-days','saveWeeklyHrStage1DailyClassificationsBulk']];
 for(const [url,name]of actions){assert.ok(routes.includes(prefix+url),url);controller[name]=handler(name,deps);app.post(prefix+url,role.requireCriticalEmploymentDecisionRole,controller[name]);}
 controller.updateProdhlomenaOrariaReviewRecord=handler('updateProdhlomenaOrariaReviewRecord',deps);
 app.patch('/api/prodhlomena-oraria/review/:id',role.requireCriticalEmploymentDecisionRole,controller.updateProdhlomenaOrariaReviewRecord);
 const server=app.listen(0,'127.0.0.1');await once(server,'listening');
 return {store,scope,periodScope,originals,deps,async context(){return deps.loadWeeklyHrStage3DecisionContext({req:{session:{userTeam:base.team,companyInUse:base.company_kod}},input:{row_id:store.rows[2]._id,decision_date:store.rows[2].hmeromhnia}});},
 async patch(rowId,body){const response=await fetch('http://127.0.0.1:'+server.address().port+'/api/prodhlomena-oraria/review/'+rowId,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:response.status,body:await response.json()};},
 async post(url,body,roleName='HR'){const response=await fetch('http://127.0.0.1:'+server.address().port+prefix+url,{method:'POST',headers:{'Content-Type':'application/json','x-test-role':roleName},body:JSON.stringify(body)});return {status:response.status,body:await response.json()};},
 unchanged(){assert.deepEqual({history:store.history,frozen:store.frozen,oldAudit:store.oldAudit},originals);},close:()=>new Promise(r=>{server.close(r);server.closeAllConnections();})};
}
const command=h=>({ypokatasthma:'0000',employee_id:h.scope.employee_id,week_start:'2026-06-01',week_end:'2026-06-07',reason_or_notes:'Συνθετικός έλεγχος',request_id:'closure-stage1-0001'});
test('HTTP Stage1 attestation, bulk attestation and Stage2 no-op preserve unresolved history explicitly',async()=>{
 const h=await start();try{const a=await h.post('stage1/complete',command(h));assert.equal(a.status,200,JSON.stringify(a));assert.equal(h.store.audits.length,1);
 const b=await h.post('stage1/bulk-complete',{scopes:[{ypokatasthma:'0000',employee_id:h.scope.employee_id,week_start:'2026-06-01',week_end:'2026-06-07'}],reason_or_notes:'Συνθετικός έλεγχος',bulk_request_id:'closure-bulk-stage1'});assert.equal(b.status,200,JSON.stringify(b));assert.equal(b.body.already_completed_count,1);
 const c=await h.post('stage2/complete',{...command(h),request_id:'closure-stage2-0001'});assert.equal(c.status,200,JSON.stringify(c));assert.equal(c.body.completed,false);assert.equal(c.body.materialized_count,0);assert.equal(h.store.dailyAudits.length,0);h.unchanged();
 }finally{await h.close();}
});
for(const classification of ['LEAVE','SICKNESS','ABSENCE'])test('HTTP Stage3 independent '+classification+' with no verified history writes exactly once',async()=>{
 const h=await start();try{assert.equal((await h.post('stage1/complete',command(h))).status,200);const initial=await h.context();assert.equal(initial.dailyProfile.history_terms_unavailable,true);assert.equal(initial.isResidual,true);
 const body={...command(h),request_id:'closure-stage3-'+classification,row_id:initial.row._id,decision_date:initial.row.hmeromhnia,expected_input_fingerprint:fingerprints.buildStage3InputFingerprint(initial).fingerprint,expected_stage3_version:0,final_classification:classification,leave_category:classification==='LEAVE'?'LEAVE':classification==='SICKNESS'?'SICK':''};
 const result=await h.post('stage3/resolve-day',body);assert.equal(result.status,200,JSON.stringify(result));assert.equal(h.store.dailyAudits.length,1);assert.equal(h.store.audits.length,2);assert.equal(h.store.rows[2].is_locked,true);h.unchanged();
 }finally{await h.close();}
});
test('HTTP independent role, card and finalized protections reject without any partial writes',async()=>{
 for(const options of [{},{badCard:true},{finalized:true}]){const h=await start(options);try{const old=clone(h.store);const result=await h.post('stage1/complete',command(h),options.badCard||options.finalized?'HR':'READ');assert.equal(result.status,options.badCard||options.finalized?409:403,JSON.stringify(result));assert.deepEqual(h.store,old);h.unchanged();}finally{await h.close();}}
});

test('HTTP Stage2 materializes independent recorded daily rotational terms without history',async()=>{
 const h=await start({snapshotType:'2'});try{assert.equal((await h.post('stage1/complete',command(h))).status,200);
 const result=await h.post('stage2/complete',{...command(h),request_id:'closure-stage2-positive'});assert.equal(result.status,200,JSON.stringify(result));assert.equal(result.body.materialized_count,1);assert.equal(h.store.rows[2].kathgoria_ergasias_apologistika,'ΜΕ');assert.equal(h.store.dailyAudits.length,1);h.unchanged();}finally{await h.close();}
});
test('HTTP Stage3 bulk preview and real atomic apply retain independent absence authority',async()=>{
 const h=await start();try{assert.equal((await h.post('stage1/complete',command(h))).status,200);const context=await h.context();
 const item={employee_id:h.scope.employee_id,employee_kodikos:h.scope.employee_kodikos,week_start:'2026-06-01',week_end:'2026-06-07',row_id:context.row._id,decision_date:context.row.hmeromhnia,expected_input_fingerprint:fingerprints.buildStage3InputFingerprint(context).fingerprint,expected_stage3_version:0};
 const body={ypokatasthma:'0000',period_start:'2026-06-01',period_end:'2026-06-30',final_classification:'ABSENCE',items:[item]};
 const preview=await h.post('stage3/bulk-preview',body);assert.equal(preview.status,200,JSON.stringify(preview));assert.equal(preview.body.can_apply,true,JSON.stringify(preview));
 const applied=await h.post('stage3/bulk-apply',{...body,expected_preview_fingerprint:preview.body.preview_fingerprint,bulk_request_id:'closure-stage3-bulk',reason_or_notes:'Συνθετική απόφαση απουσίας'});assert.equal(applied.status,200,JSON.stringify(applied));assert.equal(h.store.dailyAudits.length,1);assert.equal(h.store.rows[2].apousia_apologistika,true);h.unchanged();}finally{await h.close();}
});
test('HTTP Stage1 bulk classification and Stage4 manual row update execute real persistence and keep locks',async()=>{
 for(const bulk of [true,false]){const h=await start();try{const row=h.store.rows[2];
 const result=bulk?await h.post('stage1/bulk-classify-days',{ypokatasthma:'0000',period_start:'2026-06-01',period_end:'2026-06-30',changes:[{row_id:row._id,classification:'ABSENCE'}],reason:'Συνθετική απόφαση'}):await h.patch(row._id,{updates:{apousia_apologistika:true},reason:'Συνθετική απόφαση'});
 assert.equal(result.status,200,JSON.stringify(result));if(bulk)assert.equal(result.body.saved_count,1,JSON.stringify(result));assert.equal(h.store.dailyAudits.length,1);assert.equal(h.store.rows[2].apousia_apologistika,true);assert.equal(h.store.rows[2].is_locked,true);
 const locked=await h.patch(row._id,{updates:{apousia_apologistika:false},reason:'Αρνητική δοκιμή'});assert.equal(locked.status,409);assert.equal(h.store.dailyAudits.length,1);h.unchanged();}finally{await h.close();}}
});
