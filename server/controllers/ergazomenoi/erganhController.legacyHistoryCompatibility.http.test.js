'use strict';
const {test,before,after,mock}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),Module=require('node:module');
const express=require('express'),{once}=require('node:events');
const dates=require('../../utils/date/mondaySundayWeek');
const read=require('../../services/ergazomenoi/apasxoliseisStoredReviewReadService');
const repo=require('../../services/ergazomenoi/apasxoliseisWeeklyRepoTransferAuthoritativeContextService');
const borrowed=require('../../services/ergazomenoi/apasxoliseisBorrowedEmploymentProfileResolverService');
const holiday=require('../../services/ergazomenoi/apasxoliseisEffectiveHolidayContextProviderService');
const temporal=require('../../utils/ergazomenoi/employmentProfileTemporal');
const policy=require('../../services/ergazomenoi/employeeHistorySaveValidationService');
const period=require('../../services/ergazomenoi/apasxoliseisPeriodControlService');
const fixture=require('../../../test/fixtures/employeeActiveHistoryFixture').employeeActiveHistoryFixture;
const source=fs.readFileSync(require.resolve('./erganhController'),'utf8');
const routeSource=fs.readFileSync(require.resolve('../../routes/usersRoute'),'utf8');
const section=(a,b)=>{const i=source.indexOf(a),j=source.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,a);return source.slice(i,j);};
const bind=(code,deps)=>Function(...Object.keys(deps),code)(...Object.values(deps));
function handler(name,next,deps){const s=section('static '+name+' =','static '+next);return bind('return ('+s.slice(s.indexOf('=')+1).trim().replace(/;$/,'')+');',deps);}
// Use the existing controller test hooks and prohibit all real database access.
let hooks,profileHooks,httpRequests=0;
before(()=>{
 require('../../../test/fixtures/forbidRealSettlementMongo').forbidRealSettlementMongo(mock);
 const load=Module._load;
 try{Module._load=function(request,parent,main){if(request==='libxmljs2')return {};if(request==='../../config/aws')return {s3Client:{}};return load.call(this,request,parent,main);};
 const c=require('./erganhController');hooks=c.__orphanDailyCalculationTestHooks;profileHooks=c.__stage3DailyEmploymentProfileTestHooks;
 }finally{Module._load=load;}
});
after(()=>{console.log('Synthetic HTTP requests:',httpRequests);mock.restoreAll();});
function matches(row,filter){return Object.entries(filter).every(([k,v])=>{
 if(k==='$or')return v.some(x=>matches(row,x));if(k==='$and')return v.every(x=>matches(row,x));if(k==='$nor')return !v.some(x=>matches(row,x));
 const a=row[k];if(v==null)return a==null;
 if(v&&typeof v==='object'&&!(v instanceof Date))return Object.entries(v).every(([op,x])=>{
  if(op==='$in')return x.map(String).includes(String(a));if(op==='$ne')return String(a)!==String(x);
  const left=new Date(a).getTime(),right=new Date(x).getTime();
  return op==='$gte'?left>=right:op==='$lte'?left<=right:op==='$gt'?left>right:op==='$lt'?left<right:false;
 });return String(a)===String(v);
});}
function query(value){let select='',skip=0,limit=Infinity;return {select(s){select=s;return this;},sort(){return this;},skip(n){skip=n;return this;},limit(n){limit=n;return this;},session(){return this;},async lean(){
 const project=r=>{if(!r||!select)return structuredClone(r);const fields=new Set(('_id '+select).split(/\s+/));return Object.fromEntries(Object.entries(structuredClone(r)).filter(([k])=>fields.has(k)||[...fields].some(name=>name.startsWith(k+'.'))));};
 return Array.isArray(value)?value.slice(skip,skip+limit).map(project):project(value);
}};}
function data(kind='legacy'){
 const f=fixture('0015');f.employee.hmeromhnia_proslhpshs=f.history[0].hmeromhnia_proslhpshs='2026-01-01';
 f.employee.ypokatasthma='0000';
 const old={...structuredClone(f.history[0]),_id:'507f1f77bcf86cd799439088',aa_eggrafhs:'0000',employment_profile_schema_version:undefined,
 hmeromhnia_isxyos_oron_ergasias_apo:'2026-01-01',hmeromhnia_isxyos_oron_ergasias_eos:'2026-03-31',
 hmeromhnia_allaghs_symbashs:'2026-01-01',hmeromhnia_isxyos_dialleimatos_apo:'2026-01-01',hmeromhnia_lhxhs_symbashs:'2025-12-31',krathsh_01:null,pragmatikosMisthos:null};
 if(kind!=='clean')f.history.unshift(old);
 if(kind==='overlap')f.history[0].hmeromhnia_isxyos_oron_ergasias_eos=null;
 if(kind==='missing-workdays')delete f.history.at(-1).hmeres_ergasias_ebdomadas;
 if(kind==='missing-weekly-hours')delete f.history.at(-1).ores_ergasias_ebdomadas;
 if(kind==='ambiguous-selection')f.history.push({...structuredClone(f.history.at(-1)),_id:'507f1f77bcf86cd799439077',aa_eggrafhs:'0003'});
 if(kind==='uncertain-departure')f.history.at(-1).hmeromhnia_apoxorhshs='invalid';
 if(kind==='no-verified-history'){
  const first={...structuredClone(f.history[0]),hmeromhnia_isxyos_oron_ergasias_eos:null};
  f.history=[first,{...structuredClone(first),_id:'507f1f77bcf86cd799439077',aa_eggrafhs:'0003'}];
 }
 if(kind==='no-history-no-terms'){
  f.history=[];
  for(const field of ['hmeres_ergasias_ebdomadas','ores_ergasias_ebdomadas',
   'mo_oron_hmerhsias_ergasias','kathestos_apasxolhshs','typos_apasxolhshs'])delete f.employee[field];
 }
 f.rows=Array.from({length:7},(_,i)=>({...f.scope,_id:'card-'+i,ypokatasthma:'0000',hmeromhnia:new Date(Date.UTC(2026,4,4+i)),
 kathgoria_ergasias:i<5?'ΕΡΓ':'ΑΝ',ores_ergasias:i<5?8:0,repo:i>=5,apo_ora_01:i<5?'08:00':'',eos_ora_01:i<5?'16:00':'',
 cards_apo_ora_01:i<5?'08:00':'',cards_eos_ora_01:i<5?'16:00':'',cards_ores_ergasias:i<5?8:0,
 is_locked:i===1,ores_ergasias_apologistika:i===1?7.25:0}));
 f.frozen={snapshot_schema_version:'employment-period-frozen:v3',employees:[structuredClone(f.employee)],daily_results:[{...structuredClone(f.rows[0]),ores_ergasias_apologistika:6.37,is_locked:true}],canonical_decisions:[],applied_repo_transfers:[]};
 f.oldFinalized={period_start:'2026-03-01',period_end:'2026-03-31',results:[{hours:123.45,protocol:'SYNTHETIC-FINALIZED'}]};
 return f;
}
async function start(f,{finalized=false,fullWeekly=false,automatic=false,approvals=[],atomicStore=false,failExecution=false}={}){
 const before=structuredClone(f),writes=[],historyQueries=[],historyReads=[];
 const scope={team:f.scope.team,company_kod:f.scope.company_kod,ypokatasthma:'0000',period_start:'2026-05-01',period_end:'2026-05-31'};
 const empty={find:()=>query([]),findOne:()=>query(null)};
 const decisionRecords=[];const decisionModel={find:filter=>query(decisionRecords.filter(r=>matches(r,filter))),findOne:filter=>query(decisionRecords.find(r=>matches(r,filter))||null),async create(input){const array=Array.isArray(input),rows=(array?input:[input]).map(r=>({_id:'650000000000000000000001',...structuredClone(r)}));decisionRecords.push(...rows);return array?rows:rows[0];}};
 const model={find:filter=>query(f.rows.filter(r=>matches(r,filter))),countDocuments:async filter=>f.rows.filter(r=>matches(r,filter)).length,
 async bulkWrite(ops){for(const op of ops){const row=f.rows.find(r=>String(r._id)===String(op.updateOne.filter._id));assert.ok(row&&!row.is_locked);assert.equal(dates.dateKeyUtc(row.hmeromhnia).slice(0,7),'2026-05');writes.push(structuredClone(op));Object.assign(row,op.updateOne.update.$set);}return {modifiedCount:ops.length};}};
 const deps={...dates,...read,
 ...require('../../services/ergazomenoi/erganiDataPipelineService'),
 ...require('../../services/ergazomenoi/erganiResultFreshnessService'),
 console:{log(){},warn(){},error(...a){f.lastError=a.map(x=>x?.message||String(x)).join(' ');}},
 mongoose:{trusted:x=>x},temporalProfile:temporal,
 finalizedEmployeeFilter:require('../../utils/ergazomenoi/finalizedEmployeeFilter').finalizedEmployeeFilter,
 ErgazomenoiModel:{find:()=>query(f.employees||[f.employee]),findOne:()=>query(f.employee)},CompaniesModel:{findOne:()=>query({})},ProdhlomenaOrariaModel:model,
 IstorikoProslhpseonAllagonModel:{find(filter){historyQueries.push(filter);const selected=f.history.filter(r=>matches(r,filter));historyReads.push(selected.map(r=>r._id));return query(selected);}},
 ProdhlomenaOrariaDeviationsModel:empty,ProdhlomenaOrariaAuditModel:empty,ApasxoliseisWeeklyCanonicalDecisionModel:decisionModel,
 ApasxoliseisWeeklyRepoTransferExecutionModel:empty,ApasxoliseisWeeklyHrWorkflowStateModel:empty,ApasxoliseisPeriodCorrectiveCaseModel:empty,
 ApasxoliseisCorrectivePayrollPostingModel:empty,ApasxoliseisPeriodFrozenSnapshotModel:{findOne:()=>query({frozen_snapshot:f.frozen,frozen_snapshot_fingerprint:'synthetic'})},
 activeEmploymentReviewPeriodScope:async()=>scope,activeEmploymentReviewPeriodDates:async()=>scope,
 getPeriodControl:async()=>({stored_status:finalized?'FINALIZED':'OPEN',effective_mode:finalized?'FINALIZED':'NORMAL',frozen_snapshot_id:'frozen-id',frozen_snapshot_fingerprint:'synthetic'}),
 applyEmploymentDepartureScopeToFilters:async()=>({employees:f.employees||[f.employee]}),
 preloadBorrowedEmploymentProfileContexts:async()=>new Map(),borrowedProfileEmployeeKey:borrowed.employeeKey,
 resolveEffectiveEmploymentProfileForReviewDate:borrowed.resolveEffectiveEmploymentProfileForReviewDate,
 buildPreparedPhaseHistoryMaps:require('../../services/kinhseis/preparedPhaseHistoryDatasetService').buildPreparedPhaseHistoryMaps,
 buildReviewPhaseContextByKodikos:async()=>new Map(),buildNoCardsDisplayContext:async()=>({argiesByDateKey:new Map(),companyFlags:{}}),
 resolveBreakConfigurationForDate:require('../../utils/ergazomenoi/resolveBreakConfigurationForDate').resolveBreakConfigurationForDate,
 ...profileHooks,getReviewPhaseCodeForRow:()=>'',isFullTimeWorkTerms:require('../../services/ergazomenoi/apasxoliseisReviewEmploymentProfileService').resolveFullTimeFromWorkTerms,classifyLeaveProvenance:()=>'',LEAVE_PROVENANCE:{},detectSuspiciousShortCardInterval:()=>null,
 resolveReviewNoCardsDisplayStatus:()=>'',buildReviewHolidayResponseFields:()=>({}),
 CANONICAL_EMPLOYEE_PROFILE_FIELDS:temporal.profileSelect(),CANONICAL_HISTORY_SELECT_FIELDS:temporal.profileSelect(),
 groupWeeklyCanonicalDecisions:()=>new Map(),buildWeeklyRepoDeviationPreview:()=>({deviations:[],pendingWeeks:[],policyVersion:'synthetic'}),
 groupWeeklyReusableCases:()=>[],listActiveReusablePolicyDecisionRecords:async()=>[],attachOrphanResolutionPreviews:({rows})=>rows,
 attachSixthDayPresentationToRows:rows=>rows,buildFullMonthBoundaryContextPreflight:()=>null,
 buildPreparedReviewLifecycleContext:async()=>({lifecycleByWeek:new Map(),workflowStates:[],rowsByEmployeeWeek:new Map()}),
 stage2BulkRequestScope:()=>scope,loadWeeklyHrStage2BulkSearchPresentation:async()=>null,assessDeferredCrossPeriodRequirementsBulk:()=>[],
 appendStage4BlockedDeviationRows:({deviations})=>deviations,
 clampDateStartUtc:dates.dateOnlyUtc,clampDateEndUtc:v=>new Date(dates.dateKeyUtc(v)+'T23:59:59.999Z'),asDateOnlyUtc:dates.dateOnlyUtc,
 acquirePeriodCalculationOwnership:async()=>{await period.assertNormalPeriod({scope,now:new Date('2026-05-31'),periodControlModel:{findOne:()=>query(finalized?{status:'FINALIZED'}:null)}});return {calculationId:'synthetic',historical:false};},
 releasePeriodCalculationOwnership:async()=>{},runWithPeriodCalculationWriteFence:async({work})=>work({session:{synthetic:true}}),
 preloadEffectiveHolidayContextProvider:args=>holiday.preloadEffectiveHolidayContextProvider({...args,loadHolidayContext:async()=>({argiesByDateKey:new Map(),companyFlags:{}})}),
 loadAppliedRepoTransferProtectionContext:async()=>({entriesByRowId:{},executions:[]}),
 Models_A:{KathgoriesAdeiasModel:{find:()=>query([])}},buildHrSelectableLeaveCategoryQuery:()=>({}),
 deriveApprovedHourlyLeave:require('../../services/ergazomenoi/apasxoliseisApprovedHourlyLeaveService').deriveApprovedHourlyLeave,
 scheduledWorkingDay:require('../../services/ergazomenoi/apasxoliseisApprovedHourlyLeaveService').scheduledWorkingDay,
 deriveApprovedTimeShift:require('../../services/ergazomenoi/apasxoliseisApprovedTimeShiftService').deriveApprovedTimeShift,
 approvedLeaveCalculationRow:hooks.approvedLeaveCalculationRow,normalizeZeroLengthCardPairs:hooks.AUTHORITATIVE_DAILY_CALCULATION_OPERATIONS.normalizeZeroLengthCardPairs,
 getPayrollDailyWorkMinutes:hooks.getPayrollDailyWorkMinutes,AUTHORITATIVE_DAILY_CALCULATION_OPERATIONS:hooks.AUTHORITATIVE_DAILY_CALCULATION_OPERATIONS,
 ...require('../../services/ergazomenoi/apasxoliseisEmploymentDailyCalculationAdapterService'),
 isDateWithinEmploymentPeriod:require('../../services/ergazomenoi/apasxoliseisEmploymentPeriodScopeService').isDateWithinEmploymentPeriod,
 getWeeklyRepoTransferApplyRuntimeState:()=>({enabled:false}),
 runWeeklyRepoPostCheck:async()=>({recordsUpdated:0,recordsChecked:0,deviations:[]})};
 deps.getNumber=bind(section('function getNumber(','function buildWorkTermsFromEmployee(')+';return getNumber;',deps);
 deps.getWorkTimeRules=bind(section('function getWorkTimeRules(','function isRegularWorkingDayForOverwork(')+';return getWorkTimeRules;',deps);
 deps.isRegularWorkingDayForOverwork=bind(section('function isRegularWorkingDayForOverwork(','function normalizeEmploymentTypeForAdditionalWork(')+';return isRegularWorkingDayForOverwork;',deps);
 deps.chunkArray=bind(section('function chunkArray(','function normalizeEmploymentTypeForAdditionalWork(')+';return chunkArray;',deps);
 deps.isDateInsideRange=bind(section('function isDateInsideRange(','async function loadAppliedProtectionForRows(')+';return isDateInsideRange;',deps);
 deps.getWeekKeyMonday=date=>dates.dateKeyUtc(dates.startOfWeekMondayUtc(date));
 deps.loadStoredFinalizedReview=bind(section('async function loadStoredFinalizedReview(','async function loadStoredDraftReview(')+';return loadStoredFinalizedReview;',deps);
 deps.loadStoredDraftReview=bind(section('async function loadStoredDraftReview(','function storedStage1Payload(')+';return loadStoredDraftReview;',deps);
 if(fullWeekly){
  const scopeService=require('../../services/ergazomenoi/apasxoliseisEmploymentPeriodScopeService');
  Object.assign(deps,repo,
   require('../../services/ergazomenoi/apasxoliseisWeeklyRepoDeviationPreviewService'),
   require('../../services/ergazomenoi/apasxoliseisWeeklyCanonicalDecisionSnapshotInputService'),
   require('../../services/ergazomenoi/apasxoliseisWeeklyCanonicalDecisionResolutionService'),
   require('../../services/ergazomenoi/apasxoliseisWeeklySixthSeventhDayPolicyService'),
   require('../../services/ergazomenoi/apasxoliseisWeeklyHrLifecycleProjectionService'),scopeService,
   require('../../services/ergazomenoi/apasxoliseisWeeklyHrStage2BulkContextScopeService'),
   require('../../services/ergazomenoi/apasxoliseisWeeklyHrStage2BulkSearchGateService'),
   require('../../services/ergazomenoi/apasxoliseisWeeklyHrStage2BulkPreviewService'),
   require('../../services/ergazomenoi/apasxoliseisWeeklyRepoTransferPreparedStage2ResolverService'),
   require('../../services/ergazomenoi/apasxoliseisWeeklyPostCheckWritePlanService'),
   require('../../services/ergazomenoi/apasxoliseisWeeklyIllegalOvertimeCalculationService'),
   require('../../services/ergazomenoi/apasxoliseisLeaveProvenanceService'),
   require('../../services/ergazomenoi/apasxoliseisReusablePolicyDecisionService'),
   require('../../services/ergazomenoi/apasxoliseisStage4BlockedDeviationPresentationService'));
  // The business chain is real. Only storage, ownership I/O and external
  // company calendars use the same isolated adapters as the daily checks.
  deps.buildNoCardsDisplayContext=async()=>({argiesByDateKey:new Map(),companyFlags:{}});
  deps.clampDateStartUtc=dates.dateOnlyUtc;deps.clampDateEndUtc=v=>new Date(dates.dateKeyUtc(v)+'T23:59:59.999Z');
  deps.asDateOnlyUtc=(v,end=false)=>end?deps.clampDateEndUtc(v):dates.dateOnlyUtc(v);
  deps.ApasxoliseisCompanyPolicyRuleModel=empty;deps.ApasxoliseisWeeklyHrWorkflowAuditModel=empty;
  deps.ApasxoliseisWeeklyRepoTransferDecisionModel=empty;
  Object.assign(deps,require('../../services/ergazomenoi/deferredCrossPeriodRepoAuthoritativeService'));
  deps.attachOrphanResolutionPreviews=require('../../services/ergazomenoi/apasxoliseisOrphanCardResolutionService').attachOrphanResolutionPreviews;
  deps.ApasxoliseisPeriodFrozenSnapshotModel.find=filter=>query(f.previousFinalized&&matches(f.previousFinalized,filter)?[f.previousFinalized]:[]);deps.ErgazomenoiErganhModel=empty;
  const deviations=[];f.weeklyDeviations=deviations;
  deps.ProdhlomenaOrariaDeviationsModel={find:filter=>query(deviations.filter(r=>matches(r,filter))),
   deleteMany:async filter=>{for(let i=deviations.length-1;i>=0;i--)if(matches(deviations[i],filter))deviations.splice(i,1);},
   insertMany:async rows=>deviations.push(...structuredClone(rows))};
  deps.fenceEmployeeHistoryReferences=async()=>{};
  deps.replaceWeeklyRepoDeviations=bind(section('async function replaceWeeklyRepoDeviations(','async function completeBulkSafePairTransfer(')+';return replaceWeeklyRepoDeviations;',deps);
  const runPost=bind(section('async function runWeeklyRepoPostCheck(','async function replaceWeeklyRepoDeviations(')+';return runWeeklyRepoPostCheck;',deps);
  deps.runWeeklyRepoPostCheck=async args=>{f.weeklyPostCheckCalls=(f.weeklyPostCheckCalls||0)+1;return runPost(args);};
  deps.phaseDetectorService=require('../../services/kinhseis/phaseDetectorService');
  const phase=bind(section('async function buildReviewPhaseContextByKodikos(','function getReviewPhaseCodeForRow(')+';return buildReviewPhaseContextByKodikos;',deps);
  deps.buildReviewPhaseContextByKodikos=async args=>{const out=await phase(args);f.weeklyPhaseCount=out.size;return out;};
  deps.findReviewOperationalPhaseForDate=bind(section('function findReviewOperationalPhaseForDate(','async function buildReviewPhaseContextByKodikos(')+';return findReviewOperationalPhaseForDate;',deps);
  deps.getReviewPhaseCodeForRow=bind(section('function getReviewPhaseCodeForRow(','function reviewIsFullTimeProfile(')+';return getReviewPhaseCodeForRow;',deps);
  deps.stage3AuditDecisionDatesByEmployeeWeek=bind(section('function stage3AuditDecisionDatesByEmployeeWeek(','async function buildPreparedReviewLifecycleContext(')+';return stage3AuditDecisionDatesByEmployeeWeek;',deps);
  const lifecycle=bind(section('async function buildPreparedReviewLifecycleContext(','async function loadStoredFinalizedReview(')+';return buildPreparedReviewLifecycleContext;',deps);
  deps.buildPreparedReviewLifecycleContext=async args=>{const out=await lifecycle(args);f.weeklyLifecycleCount=out.lifecycleByWeek.size;return out;};
  deps.getWeeklyRepoProfileInfo=repo.getWeeklyRepoProfileInfo;
  deps.buildWeeklyRepoTransferAtomicInputForPreparedWeek=require('../../services/ergazomenoi/apasxoliseisWeeklyRepoTransferAtomicPageProjectionService').buildWeeklyRepoTransferAtomicInputForPreparedWeek;
  deps.validateApplySession=require('../../services/ergazomenoi/apasxoliseisWeeklyRepoTransferApplyCommandService').validateApplySession;
  deps.prepareWeeklyHrStage2PairRecords=bind(section('async function prepareWeeklyHrStage2PairRecords(','async function loadWeeklyHrStage2BatchPreparedContexts(')+';return prepareWeeklyHrStage2PairRecords;',deps);
  deps.assertActiveEmploymentReviewPeriodReadable=async()=>({scope,state:{effective_mode:'NORMAL'}});
  deps.stage2BulkStateCache=new(require('../../services/ergazomenoi/apasxoliseisWeeklyHrStage2BulkStateCacheService').WeeklyHrStage2BulkStateCache)();
  deps.stage2BulkRequestScope=bind(section('function stage2BulkRequestScope(','function createWeeklyHrStage2BulkResponseStream(')+';return stage2BulkRequestScope;',deps);
 }
 const canonicalContext=require('../../services/ergazomenoi/apasxoliseisWeeklyCanonicalDecisionContextService');
 const canonical=require('../../services/ergazomenoi/apasxoliseisWeeklyCanonicalDecisionService');
 Object.assign(deps,canonicalContext,canonical,require('../../services/ergazomenoi/apasxoliseisReviewErrorPresentationService'),require('../../services/ergazomenoi/apasxoliseisWeeklyRepoTransferAppliedProtectionService'));
 deps.loadWeeklyCanonicalDecisionContext=async args=>{try{return await canonicalContext.loadWeeklyCanonicalDecisionContext({...args,models:{employeeModel:deps.ErgazomenoiModel,rowModel:model,historyModel:deps.IstorikoProslhpseonAllagonModel,executionModel:empty,decisionModel}});}catch(error){f.contextError=error.details;throw error;}};
 deps.recordWeeklyCanonicalDecision=args=>canonical.recordWeeklyCanonicalDecision({...args,decisionModel,indexReadinessGuard:async()=>({ready:true}),referenceFence:async()=>{},now:new Date('2026-05-31T12:00:00Z')});
 deps.assertActiveEmploymentReviewPeriodNormal=async()=>{await period.assertNormalPeriod({scope,now:new Date('2026-05-31'),periodControlModel:{findOne:()=>query(finalized?{status:'FINALIZED'}:null)}});return {scope,token:'synthetic'};};
 deps.runWithPeriodWriteFence=async({work})=>({result:await work({session:{synthetic:true}})});
 if(automatic){
  Object.assign(deps,require('../../services/ergazomenoi/apasxoliseisWeeklyRepoTransferAtomicPageProjectionService'));
  deps.getWeeklyRepoTransferApplyRuntimeState=()=>require('../../services/ergazomenoi/apasxoliseisWeeklyRepoTransferApplyRuntimeGuardService').getWeeklyRepoTransferApplyRuntimeState({NODE_ENV:'test',ALLOW_REPO_TRANSFER_APPLY:'true'});
  deps.assertWeeklyRepoTransferApplyIndexesReady=async()=>({ready:true});
  deps.listActiveReusablePolicyDecisionRecords=async()=>approvals;
  deps.buildAtomicRepoTransferPolicyPreviewProjection=bind(section('async function buildAtomicRepoTransferPolicyPreviewProjection(','function getWeekRangesInsidePeriod(')+';return buildAtomicRepoTransferPolicyPreviewProjection;',deps);
  deps.runPossibleLeaveRepoAutoRuntime=require('../../services/ergazomenoi/apasxoliseisPossibleLeaveRepoAutoRuntimeService').runPossibleLeaveRepoAutoRuntime;
  deps.createWeeklyRepoTransferDecision=async()=>{throw new Error('Unexpected automatic decision without a unique safe HR-authorized pair');};
  deps.applyWeeklyRepoTransfer=async()=>{throw new Error('Unexpected automatic apply without a unique safe HR-authorized pair');};
  if(atomicStore){f.atomic=require('../../../test/fixtures/erganhWeeklyRepoTransferSyntheticRuntime').syntheticRuntime(f,{failExecution});f.atomic.attach(deps);}
  deps.automaticRepoTransferCallbacks=bind(section('function automaticRepoTransferCallbacks(','function getDailyDeclaredMinutes(')+';return automaticRepoTransferCallbacks;',deps);
 }
 const hr=handler('createWeeklyCanonicalDecision','createWeeklyRepoTransferDecision',deps);
 const calc=handler('calcApasxolhseisPeriodoy','getWeeklyHrWorkflowStage1',deps),review=handler('getProdhlomenaOrariaForReview','getProdhlomenaOrariaOrphanQualityCheck',deps);
 const app=express();app.use(express.json());app.use((req,res,next)=>{req.session={userId:'507f191e810c19729de860ea',userRole:'HR',userStatus:'A',userName:'Synthetic HR',companyKodikos:'SYNTHETIC',userTeam:f.scope.team,companyInUse:f.scope.company_kod,yearInUse:'2026',appDate:'2026-05-31'};req.programmataAccessScope={effectiveTeam:f.scope.team,companyId:f.scope.company_kod,ypokatasthma:'0000',dateRange:{startDate:new Date('2026-05-01'),endDate:new Date('2026-05-31')}};next();});
 // URLs and handlers match usersRoute.js; route security is checked separately.
 assert.match(routeSource,/router\.get\('\/api\/prodhlomena-oraria\/review'.*erganhController\.getProdhlomenaOrariaForReview/);
 app.post('/api/prodhlomena-oraria/review/canonical-decisions',hr);
 app.post('/ergazomenoi/programmata/calcApasxolhseisPeriodoy',calc);app.get('/api/prodhlomena-oraria/review',review);
 const server=app.listen(0,'127.0.0.1');await once(server,'listening');const origin='http://127.0.0.1:'+server.address().port;
 return {f,before,writes,historyQueries,historyReads,decisionRecords,async hr(classification,request='synthetic-hr-decision'){httpRequests++;const r=await fetch(origin+'/api/prodhlomena-oraria/review/canonical-decisions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ypokatasthma:'0000',employee_kodikos:f.employee.kodikos,week_start:'2026-05-04',request_id:request,decision_type:'CLASSIFICATION_BY_DATE',decision_payload:{classification_by_date:classification},notes:'Ρητή συνθετική απόφαση HR'})});return {status:r.status,body:await r.json()};},async calc(){httpRequests++;const r=await fetch(origin+'/ergazomenoi/programmata/calcApasxolhseisPeriodoy',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({apo_hmeromhnia:'2026-05-01',eos_hmeromhnia:'2026-05-31'})});return {status:r.status,body:await r.json()};},async review(){httpRequests++;const r=await fetch(origin+'/api/prodhlomena-oraria/review?apo_hmeromhnia=2026-05-01&eos_hmeromhnia=2026-05-31&ypokatasthma=0000');return {status:r.status,body:await r.json()};},close:()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();})};
}
test('real card-calculation HTTP handler produces identical daily updates with unrelated finalized legacy uncertainty',async()=>{
 const clean=await start(data('clean')),legacy=await start(data());try{
 const a=await clean.calc(),b=await legacy.calc();assert.equal(a.status,200,JSON.stringify(a)+' '+clean.f.lastError);assert.equal(b.status,200,JSON.stringify(b)+' '+legacy.f.lastError);
 assert.ok(legacy.writes.length>0);assert.deepEqual(legacy.writes,clean.writes);assert.deepEqual(legacy.f.history,legacy.before.history);
 assert.deepEqual(legacy.f.oldFinalized,legacy.before.oldFinalized);assert.deepEqual(legacy.f.rows[1],legacy.before.rows[1]);
 assert.equal(policy.inspectEmployeeHistorySave({scope:legacy.f.scope,currentEmployee:legacy.f.employee,historyRows:legacy.f.history}).status,'LEGACY_REVIEW_REQUIRED');
 }finally{await clean.close();await legacy.close();}
});
test('real review HTTP handler accepts legacy compatibility and returns the same business rows without writes',async()=>{
 const clean=await start(data('clean')),legacy=await start(data());try{
 const a=await clean.review(),b=await legacy.review();assert.equal(a.status,200,JSON.stringify(a)+' '+clean.f.lastError);assert.equal(b.status,200,JSON.stringify(b)+' '+legacy.f.lastError);
 assert.ok(legacy.historyReads.some(ids=>ids.includes('507f1f77bcf86cd799439088')));assert.deepEqual(b.body.read_warnings,[]);assert.deepEqual(b.body.rows,a.body.rows);assert.equal(legacy.writes.length,0);
 assert.deepEqual(legacy.f.history,legacy.before.history);assert.deepEqual(legacy.f.rows,legacy.before.rows);assert.deepEqual(legacy.f.frozen,legacy.before.frozen);assert.deepEqual(legacy.f.previousFinalized,legacy.before.previousFinalized);
 }finally{await clean.close();await legacy.close();}
});
for(const kind of ['overlap','ambiguous-selection','missing-workdays','missing-weekly-hours','uncertain-departure','no-verified-history','no-history-no-terms'])test(`real HTTP paths continue with explicit assumptions and no fabricated amounts: ${kind}`,async()=>{
 const h=await start(data(kind),{fullWeekly:true});try{
 const calculated=await h.calc();assert.equal(calculated.status,200,JSON.stringify(calculated));
 assert.equal(calculated.body.calculation_executed,true);assert.equal(calculated.body.all_results_documented,false);
 assert.ok(calculated.body.unavailable_results.length);assert.ok(h.writes.length);
 for(const row of h.f.rows.filter(r=>!r.is_locked)){
  assert.equal(row.ores_ergasias_apologistika,row.cards_ores_ergasias);assert.equal(row.ores_paranomhs_yperorias_apologistika,0);
  assert.equal(row.compensation_breakdown_apologistika.total_amount,null);
  assert.equal(row.compensation_breakdown_apologistika.status,'LEGACY_FALLBACK_ASSUMED');
  assert.equal(row.compensation_breakdown_apologistika.amounts.grossWorkAmount,null);
  assert.equal(row.compensation_breakdown_apologistika.rates.paidHourlyRate,null);
  assert.equal(row.compensation_breakdown_apologistika.assumed_work_terms.hmeres_ergasias_ebdomadas,5);
 }
 const calculatedRows=structuredClone(h.f.rows),writeCount=h.writes.length;
 const shown=await h.review();assert.equal(shown.status,200,JSON.stringify(shown)+' '+h.f.lastError);assert.notEqual(shown.body.source,'STORED_DRAFT');assert.ok(shown.body.read_warnings.length);
 assert.equal(shown.body.canonicalLifecycleProjections.length,1);
 const lifecycle=shown.body.canonicalLifecycleProjections[0].lifecycle_projection;
 assert.equal(lifecycle.history_pending,true);
 assert.equal(lifecycle.all_results_documented,false);
 assert.equal(lifecycle.weekly_analysis_presentation_status,'PROVISIONAL');
 assert.equal(lifecycle.current_stage,'STAGE1');
 assert.equal(lifecycle.requires_hr_action,true);
 assert.equal(lifecycle.total_pending_count,1);
 assert.equal(lifecycle.stages.stage1.business_status,'OPEN');
 assert.equal(lifecycle.stages.stage1.weekly_confirmation_required,true);
 assert.equal(lifecycle.stages.stage1.pending_count,1);
 assert.deepEqual(lifecycle.stages.stage1.pending_reasons,['STAGE1_WEEKLY_CONFIRMATION_REQUIRED']);
 for(const key of ['stage2','stage3']){
  assert.equal(lifecycle.stages[key].business_status,'COMPLETED');
  assert.equal(lifecycle.stages[key].pending_count,0);
  assert.deepEqual(lifecycle.stages[key].pending_dates,[]);
  assert.deepEqual(lifecycle.stages[key].pending_reasons,[]);
 }
 assert.equal(lifecycle.stages.stage2.resolution_route,undefined);
 assert.equal(lifecycle.stages.stage4.business_status,'OPEN');
 assert.equal(lifecycle.stages.stage4.final_weekly_analysis,undefined);
 for(const stage of Object.values(lifecycle.stages)){
  assert.deepEqual(stage.blockers,[]);
  assert.equal(stage.history_pending,true);
  assert.equal(stage.all_results_documented,false);
  assert.equal(stage.independent_checks_executed,true);
  assert.equal(stage.final_weekly_analysis_available,false);
  assert.ok(stage.read_warnings.some(item=>item.code==='EMPLOYEE_HISTORY_COVERAGE_REQUIRED'));
 }
 assert.ok(shown.body.canonicalLifecycleProjections.every(p=>p.lifecycle_projection.stages.stage1.diagnostics.length));
 assert.deepEqual(h.f.rows,calculatedRows);assert.equal(h.writes.length,writeCount);
 assert.deepEqual(h.f.history,h.before.history);assertFrozenUnchanged(h);
 }finally{await h.close();}
});
test('finalized review is served from the frozen snapshot and recalculation stays forbidden',async()=>{
 const h=await start(data('overlap'),{finalized:true});try{
 const shown=await h.review();assert.equal(shown.status,200,JSON.stringify(shown)+' '+h.f.lastError);assert.equal(shown.body.source,'FROZEN_FINALIZED');assert.equal(h.historyReads.length,0);assert.equal(shown.body.rows[0].ores_ergasias_apologistika,6.37);
 const calculated=await h.calc();assert.equal(calculated.status,409);assert.equal(calculated.body.code,'PERIOD_CONTROL_FINALIZED');assert.equal(h.writes.length,0);assert.deepEqual(h.f.frozen,h.before.frozen);
 }finally{await h.close();}
});


function fullWeekData(kind='legacy',days=5,weekendWork=false){
 const f=data(kind);const active=f.history.at(-1);
 for(const row of [f.employee,active])Object.assign(row,{aa_eggrafhs:'0002',afora_proslhpsh:false,
  hmeres_ergasias_ebdomadas:days,ores_ergasias_ebdomadas:40,mo_oron_hmerhsias_ergasias:40/days,
  typos_ebdomadas:days===6?'6HMERH':'5HMERH',nomimoOromisthio:8,pragmatikoOromisthio:10,pososto_prosayxhshs_6hs_hmeras:40});
 if(kind==='clean')f.history.unshift({...structuredClone(active),_id:'507f1f77bcf86cd799439088',aa_eggrafhs:'0001',afora_proslhpsh:true,
  hmeromhnia_isxyos_oron_ergasias_apo:'2026-01-01',hmeromhnia_isxyos_oron_ergasias_eos:'2026-03-31',
  hmeromhnia_allaghs_symbashs:'2026-01-01',hmeromhnia_isxyos_dialleimatos_apo:'2026-01-01',pragmatikosMisthos:1200,synolo_symbashs:1200});
 f.rows=Array.from({length:35},(_,i)=>{
  const date=new Date(Date.UTC(2026,3,27+i)),key=dates.dateKeyUtc(date),weekday=date.getUTCDay()||7;
  const normal=weekday<=days,exception=Boolean(weekendWork&&(key==='2026-05-09'||weekendWork===true&&key==='2026-05-10'));
  const hours=exception?(weekday===7?2:weekendWork==='sixth'?8:9):normal?40/days:0;
  const start=exception&&weekday===7?'22:00':hours?'08:00':'';
  const end=exception&&weekday===7?'00:00':hours===9?'17:00':hours===8?'16:00':hours?'14:40':'';
  const locked=key==='2026-05-05'||key<'2026-05-01';
  return {...f.scope,_id:(0x640000000000000000000000n+BigInt(i+1)).toString(16),ypokatasthma:'0000',hmeromhnia:date,
   kathgoria_ergasias:normal?'ΕΡΓ':'ΑΝ',ores_ergasias:normal?40/days:0,repo:!normal,
   apo_ora_01:normal?'08:00':'',eos_ora_01:normal?(days===5?'16:00':'14:40'):'',
   cards_apo_ora_01:start,cards_eos_ora_01:end,cards_ores_ergasias:hours,is_locked:locked,
   ...(locked?{apologistiko_biblio:true,kathgoria_ergasias_apologistika:'ΕΡΓ',ores_ergasias_apologistika:hours}:{} )};
 });
 f.previousFinalized={team:f.scope.team,company_kod:f.scope.company_kod,ypokatasthma:'0000',period_start:new Date('2026-04-01'),period_end:new Date('2026-04-30'),frozen_snapshot:{daily_results:f.rows.filter(r=>dates.dateKeyUtc(r.hmeromhnia)<'2026-05-01').map(r=>({...structuredClone(r),effective_profile_employee_id:f.employee._id}))}};
 if(kind==='missing-workdays')delete active.hmeres_ergasias_ebdomadas;
 if(kind==='missing-weekly-hours')delete active.ores_ergasias_ebdomadas;
 return f;
}
for(const [days,weekendWork]of [[5,false],[5,'sixth'],[5,true],[6,true]])test(`full weekly chain: ${days}-day contract, weekend work=${weekendWork}`,async()=>{
 const clean=await start(fullWeekData('clean',days,weekendWork),{fullWeekly:true}),legacy=await start(fullWeekData('legacy',days,weekendWork),{fullWeekly:true});
 try{
  assert.equal(policy.inspectEmployeeHistorySave({scope:clean.f.scope,currentEmployee:clean.f.employee,historyRows:clean.f.history}).status,'CLEAN');
  assert.equal(require('../../utils/ergazomenoi/employmentHistoryCoverage').assertVerifiedHistoryCoverageForDate('2026-05-04',legacy.f.history,legacy.f.employee).status,'LEGACY_COMPATIBLE');
  const a=await clean.calc(),b=await legacy.calc();assert.equal(a.status,200,JSON.stringify(a)+' '+clean.f.lastError);assert.equal(b.status,200,JSON.stringify(b)+' '+legacy.f.lastError);
  assert.equal(legacy.f.weeklyPostCheckCalls,1);assert.equal(b.body.weeklyRepoPostCheck.recordsChecked,31);assert.ok(b.body.weeklyRepoPostCheck.recordsUpdated>0);
  assert.deepEqual(b.body.weeklyRepoPostCheck,a.body.weeklyRepoPostCheck);assert.deepEqual(legacy.writes,clean.writes);assert.deepEqual(legacy.f.rows,clean.f.rows);
  for(const row of legacy.before.rows.filter(r=>r.is_locked||dates.dateKeyUtc(r.hmeromhnia)<'2026-05-01'))assert.deepEqual(legacy.f.rows.find(r=>r._id===row._id),row);
  const ra=await clean.review(),rb=await legacy.review();assert.equal(ra.status,200,JSON.stringify(ra)+' '+clean.f.lastError);assert.equal(rb.status,200,JSON.stringify(rb)+' '+legacy.f.lastError);
  assert.deepEqual(rb.body.read_warnings,[]);assert.equal(legacy.f.weeklyPhaseCount,1);assert.equal(legacy.f.weeklyLifecycleCount,5);
  assert.deepEqual(rb.body.rows,ra.body.rows);assert.deepEqual(rb.body.deviations,ra.body.deviations);assert.deepEqual(rb.body.canonicalLifecycleProjections,ra.body.canonicalLifecycleProjections);
  assert.ok(rb.body.stage2BulkPreview);assert.equal(rb.body.canonicalLifecycleProjections.length,5);
  if(weekendWork===true&&days===6){const sunday=legacy.f.rows.find(r=>dates.dateKeyUtc(r.hmeromhnia)==='2026-05-10');
   const illegal=['ores_paranomhs_yperorias_apologistika','ores_paranomhs_yperorias_nyxtas_apologistika','ores_paranomhs_yperorias_argion_apologistika','ores_paranomhs_yperorias_argion_nyxtas_apologistika'].reduce((n,k)=>n+Number(sunday[k]||0),0);assert.equal(illegal,2);}
  if(weekendWork===true&&days===5){
   const week=b.body.weeklyRepoPostCheck.deviations.find(d=>dates.dateKeyUtc(d.week_apo)==='2026-05-04');
   assert.equal(week.status,'NEEDS_HR_DECISION');assert.ok(week.reasons.includes('SEVENTH_DAY_IDENTITY_NOT_DETERMINISTIC'));
   const sunday=legacy.f.rows.find(r=>dates.dateKeyUtc(r.hmeromhnia)==='2026-05-10');
   assert.equal(sunday.compensation_breakdown_apologistika.status,'NEEDS_HR_DECISION');
   const lifecycle=rb.body.canonicalLifecycleProjections.find(x=>dates.dateKeyUtc(x.scope.week_start)==='2026-05-04').lifecycle_projection;
   assert.equal(lifecycle.requires_hr_action,true);
  }
  if(weekendWork==='sixth'){
   const saturday=legacy.f.rows.find(r=>dates.dateKeyUtc(r.hmeromhnia)==='2026-05-09');
   assert.ok(saturday.compensation_breakdown_apologistika.hours.sixthDayHours>0);
  }
  assert.equal(policy.inspectEmployeeHistorySave({scope:legacy.f.scope,currentEmployee:legacy.f.employee,historyRows:legacy.f.history}).status,'LEGACY_REVIEW_REQUIRED');
  assert.deepEqual(legacy.f.history,legacy.before.history);assert.deepEqual(legacy.f.oldFinalized,legacy.before.oldFinalized);assert.deepEqual(legacy.f.frozen,legacy.before.frozen);assert.deepEqual(legacy.f.previousFinalized,legacy.before.previousFinalized);
 }finally{await clean.close();await legacy.close();}
});
for(const kind of ['overlap','ambiguous-selection','missing-workdays','missing-weekly-hours','uncertain-departure'])test(`full weekly chain continues without fabricated results: ${kind}`,async()=>{
 const h=await start(fullWeekData(kind),{fullWeekly:true});try{
  const calc=await h.calc();assert.equal(calc.status,200,JSON.stringify(calc)+' '+h.f.lastError);assert.equal(calc.body.all_results_documented,false);
  const review=await h.review();assert.equal(review.status,200,JSON.stringify(review)+' '+h.f.lastError);assert.notEqual(review.body.source,'STORED_DRAFT');assert.ok(review.body.read_warnings.length);
  assertFrozenUnchanged(h);assert.deepEqual(h.f.history,h.before.history);
  assert.ok(review.body.canonicalLifecycleProjections.every(p=>Object.values(p.lifecycle_projection.stages).every(s=>!s.blockers.includes('EMPLOYEE_HISTORY_COVERAGE_REQUIRED'))));
 }finally{await h.close();}
});
test('full weekly calculation with overlapping old history retains real seventh-day minutes and provisional amounts',async()=>{
 const f=fullWeekData('overlap',5,true);
 const h=await start(f,{fullWeekly:true});try{
  const initial=await h.calc();assert.equal(initial.status,200,JSON.stringify(initial)+' '+h.f.lastError);
  const saved=await h.hr({'2026-05-08':'SIXTH','2026-05-09':'NORMAL','2026-05-10':'SEVENTH'},'synthetic-legacy-seventh');
  assert.equal(saved.status,201,JSON.stringify(saved)+' '+h.f.lastError);
  const calculated=await h.calc();assert.equal(calculated.status,200,JSON.stringify(calculated)+' '+h.f.lastError);
  assert.equal(calculated.body.all_results_documented,false);
  const sunday=h.f.rows.find(row=>dates.dateKeyUtc(row.hmeromhnia)==='2026-05-10');
  assert.equal(illegalHours(sunday),2,JSON.stringify({post:calculated.body.weeklyRepoPostCheck,comp:sunday.compensation_breakdown_apologistika}));
  assert.equal(sunday.compensation_breakdown_apologistika.status,'LEGACY_FALLBACK_ASSUMED');
  assert.equal(sunday.compensation_breakdown_apologistika.amounts.grossWorkAmount,null);
  assert.equal(sunday.compensation_breakdown_apologistika.rates.paidHourlyRate,null);
  const shown=await h.review();assert.equal(shown.status,200,JSON.stringify(shown)+' '+h.f.lastError);
  assert.ok(shown.body.read_warnings.every(warning=>warning.blocking===false));
  assertFrozenUnchanged(h);
 }finally{await h.close();}
});
test('full weekly chain never recalculates a finalized period',async()=>{
 const h=await start(fullWeekData('overlap'),{fullWeekly:true,finalized:true});try{
  const r=await h.review();assert.equal(r.status,200);assert.equal(r.body.source,'FROZEN_FINALIZED');assert.equal(h.f.weeklyLifecycleCount,undefined);
  const c=await h.calc();assert.equal(c.status,409);assert.equal(c.body.code,'PERIOD_CONTROL_FINALIZED');assert.equal(h.writes.length,0);assert.equal(h.f.weeklyPostCheckCalls,undefined);
  assert.deepEqual(h.f.frozen,h.before.frozen);assert.deepEqual(h.f.oldFinalized,h.before.oldFinalized);
 }finally{await h.close();}
});

function assertFrozenUnchanged(h){
 for(const row of h.before.rows.filter(r=>r.is_locked||dates.dateKeyUtc(r.hmeromhnia)<'2026-05-01'))assert.deepEqual(h.f.rows.find(r=>r._id===row._id),row);
 for(const key of ['history','frozen','oldFinalized','previousFinalized'])assert.deepEqual(h.f[key],h.before[key],key);
}
const illegalHours=row=>['ores_paranomhs_yperorias_apologistika','ores_paranomhs_yperorias_nyxtas_apologistika','ores_paranomhs_yperorias_argion_apologistika','ores_paranomhs_yperorias_argion_nyxtas_apologistika'].reduce((n,k)=>n+Number(row[k]||0),0);
test('remaining weekly HR: actual decision HTTP validates and resolves ambiguity equally for CLEAN and LEGACY_COMPATIBLE',async()=>{
 const clean=await start(fullWeekData('clean',5,true),{fullWeekly:true}),legacy=await start(fullWeekData('legacy',5,true),{fullWeekly:true});
 try{
  for(const h of [clean,legacy]){
   const initial=await h.calc();assert.equal(initial.status,200,JSON.stringify(initial)+' '+h.f.lastError);
   const week=initial.body.weeklyRepoPostCheck.deviations.find(d=>dates.dateKeyUtc(d.week_apo)==='2026-05-04');assert.equal(week.status,'NEEDS_HR_DECISION');
   const before=structuredClone(h.f.rows);
   const invalid=await h.hr({'2026-05-08':'SIXTH','2026-05-09':'SIXTH','2026-05-10':'SEVENTH'},'synthetic-invalid-hr');
   assert.equal(invalid.status,409,JSON.stringify(invalid)+' '+h.f.lastError);assert.equal(invalid.body.code,'CANONICAL_DECISION_CLASSIFICATION_INVALID',JSON.stringify(h.f.contextError));assert.equal(h.decisionRecords.length,0);assert.deepEqual(h.f.rows,before);
   const saved=await h.hr({'2026-05-08':'SIXTH','2026-05-09':'NORMAL','2026-05-10':'SEVENTH'});assert.equal(saved.status,201,JSON.stringify(saved)+' '+h.f.lastError);assert.equal(h.decisionRecords.length,1);assert.deepEqual(h.f.rows,before);
   const calculated=await h.calc();assert.equal(calculated.status,200,JSON.stringify(calculated)+' '+h.f.lastError);
   const sunday=h.f.rows.find(r=>dates.dateKeyUtc(r.hmeromhnia)==='2026-05-10');assert.equal(illegalHours(sunday),2,JSON.stringify({post:calculated.body.weeklyRepoPostCheck,comp:sunday.compensation_breakdown_apologistika}));assert.notEqual(sunday.compensation_breakdown_apologistika.status,'NEEDS_HR_DECISION');
   const reviewed=await h.review();assert.equal(reviewed.status,200,JSON.stringify(reviewed)+' '+h.f.lastError);assert.deepEqual(reviewed.body.read_warnings,[]);h.result=reviewed.body;
   assertFrozenUnchanged(h);
  }
  assert.deepEqual(legacy.f.rows,clean.f.rows);assert.deepEqual(legacy.result.rows,clean.result.rows);assert.deepEqual(legacy.result.deviations,clean.result.deviations);
  assert.equal(policy.inspectEmployeeHistorySave({scope:legacy.f.scope,currentEmployee:legacy.f.employee,historyRows:legacy.f.history}).status,'LEGACY_REVIEW_REQUIRED');
 }finally{await clean.close();await legacy.close();}
});
for(const kind of ['clean','legacy'])test(`remaining weekly automatic: enabled runtime retains HR ambiguity and locked days (${kind})`,async()=>{
 const h=await start(fullWeekData(kind,5,true),{fullWeekly:true,automatic:true});try{
  const r=await h.calc();assert.equal(r.status,200,JSON.stringify(r)+' '+h.f.lastError);assert.equal(r.body.weeklyRepoPostCheck.automaticRepoTransfer.enabled,true);assert.equal(r.body.weeklyRepoPostCheck.automaticRepoTransfer.applied,0);assert.equal(h.decisionRecords.length,0);
  assert.ok(r.body.weeklyRepoPostCheck.automaticRepoTransfer.results.some(x=>x.status==='NEEDS_HR'));
  const week=r.body.weeklyRepoPostCheck.deviations.find(d=>dates.dateKeyUtc(d.week_apo)==='2026-05-04');assert.equal(week.status,'NEEDS_HR_DECISION');
  assertFrozenUnchanged(h);
 }finally{await h.close();}
});
test('remaining weekly HR: finalized period rejects decision and automatic runtime without writes',async()=>{
 const h=await start(fullWeekData('legacy',5,true),{fullWeekly:true,automatic:true,finalized:true});try{
  const hr=await h.hr({'2026-05-08':'SIXTH','2026-05-10':'SEVENTH'});assert.equal(hr.status,409,JSON.stringify(hr)+' '+h.f.lastError);assert.equal(hr.body.code,'PERIOD_CONTROL_FINALIZED');assert.equal(h.decisionRecords.length,0);
  const calc=await h.calc();assert.equal(calc.status,409);assert.equal(h.writes.length,0);assert.deepEqual(h.f.rows,h.before.rows);assertFrozenUnchanged(h);
 }finally{await h.close();}
});


function reusableSourceApproval(f){return {_id:'660000000000000000000001',team:f.scope.team,company_kod:f.scope.company_kod,ypokatasthma:'0000',reuse_scope:'FUTURE_IDENTICAL',reuse_status:'ACTIVE',decision_status:'RECORDED',decision_type:'APPROVE_PROPOSAL',created_by_user_name:'Synthetic original HR',created_at:'2026-04-01T00:00:00Z',items:[{role:'SOURCE_BECOMES_WORK',kathgoria_ergasias:'ΑΝ',cards_ores_ergasias:8,proposed_values:{kathgoria_ergasias_apologistika:'ΕΡΓ'}}]};}
for(const scenario of ['no-approval','ambiguous-pair','locked-target'])test(`remaining weekly automatic: real enabled chain protects ${scenario} equally for CLEAN and LEGACY_COMPATIBLE`,async()=>{
 const handles=[];try{
  const outputs=[];
  for(const kind of ['clean','legacy']){
   const f=fullWeekData(kind,5,scenario==='ambiguous-pair'?true:'sixth');const target=f.rows.find(r=>dates.dateKeyUtc(r.hmeromhnia)==='2026-05-06');
   Object.assign(target,{cards_apo_ora_01:'',cards_eos_ora_01:'',cards_ores_ergasias:0});
   if(scenario==='locked-target')Object.assign(target,{is_locked:true,apologistiko_biblio:true,ores_ergasias_apologistika:0,kathgoria_ergasias_apologistika:'ΕΡΓ',kathgoria_adeias_apologistika:'POSSIBLE_LEAVE'});
   const h=await start(f,{fullWeekly:true,automatic:true,approvals:scenario==='no-approval'?[]:[reusableSourceApproval(f)]});handles.push(h);
   const result=await h.calc();assert.equal(result.status,200,JSON.stringify(result)+' '+h.f.lastError);
   const auto=result.body.weeklyRepoPostCheck.automaticRepoTransfer;assert.equal(auto.enabled,true);assert.equal(auto.applied,0);assert.equal(h.decisionRecords.length,0);
   const item=auto.results.find(x=>(x.reasons||[]).includes(scenario==='ambiguous-pair'?'MULTIPLE_AUTHORIZED_PAIRS':'NO_UNIQUE_AUTHORIZED_PAIR'));assert.ok(item,JSON.stringify(auto));assert.equal(item.status,'NEEDS_HR');
   assertFrozenUnchanged(h);outputs.push({rows:h.f.rows,auto});
  }
  assert.deepEqual(outputs[1],outputs[0]);
 }finally{for(const h of handles)await h.close();}
});
test('remaining weekly HR: review lifecycle must consume the recorded explicit decision',async()=>{
 const h=await start(fullWeekData('legacy',5,true),{fullWeekly:true});try{
  assert.equal((await h.calc()).status,200);
  assert.equal((await h.hr({'2026-05-08':'SIXTH','2026-05-09':'NORMAL','2026-05-10':'SEVENTH'})).status,201);
  assert.equal((await h.calc()).status,200);
  const review=await h.review();assert.equal(review.status,200);
  const stage4=review.body.canonicalLifecycleProjections.find(x=>dates.dateKeyUtc(x.scope.week_start)==='2026-05-04').lifecycle_projection.stages.stage4;
  assertFrozenUnchanged(h);
  assert.equal(stage4.business_status,'COMPLETED',JSON.stringify({status:stage4.business_status,reasons:stage4.pending_reasons}));
 }finally{await h.close();}
});

const hrClassification={'2026-05-08':'SIXTH','2026-05-09':'NORMAL','2026-05-10':'SEVENTH'};
function stage4ForMay4(result){assert.equal(result.status,200,JSON.stringify(result));return result.body.canonicalLifecycleProjections.find(x=>dates.dateKeyUtc(x.scope.week_start)==='2026-05-04').lifecycle_projection.stages.stage4;}
test('stage4 decisions: absent, valid and repeated decision have CLEAN/LEGACY parity without duplicate records',async()=>{
 const outputs=[];for(const kind of ['clean','legacy']){
  const h=await start(fullWeekData(kind,5,true),{fullWeekly:true});try{
   assert.equal((await h.calc()).status,200);
   assert.equal(stage4ForMay4(await h.review()).business_status,'BLOCKED');
   assert.equal((await h.hr(hrClassification)).status,201);
   const retry=await h.hr(hrClassification);assert.equal(retry.status,200,JSON.stringify(retry));assert.equal(retry.body.idempotent,true);assert.equal(h.decisionRecords.length,1);
   assert.equal((await h.calc()).status,200);
   const first=stage4ForMay4(await h.review());assert.equal(first.business_status,'COMPLETED');
   const rows=structuredClone(h.f.rows);assert.equal((await h.calc()).status,200);
   const repeated=stage4ForMay4(await h.review());assert.equal(repeated.business_status,'COMPLETED');assert.equal(h.decisionRecords.length,1);assert.deepEqual(h.f.rows,rows);
   const savedAgain=await h.hr(hrClassification);assert.equal(savedAgain.status,200,JSON.stringify(savedAgain));assert.equal(savedAgain.body.idempotent,true);assert.equal(h.decisionRecords.length,1);
   assertFrozenUnchanged(h);outputs.push({rows:h.f.rows,stage4:repeated});
  }finally{await h.close();}
 }
 assert.deepEqual(outputs[1],outputs[0]);
});
for(const change of ['cards','profile'])test(`stage4 decisions: stale ${change} snapshot stays blocked for CLEAN and LEGACY`,async()=>{
 for(const kind of ['clean','legacy']){
  const h=await start(fullWeekData(kind,5,true),{fullWeekly:true});try{
   assert.equal((await h.calc()).status,200);assert.equal((await h.hr(hrClassification)).status,201);assert.equal((await h.calc()).status,200);
   assert.equal(stage4ForMay4(await h.review()).business_status,'COMPLETED');
   if(change==='cards'){const row=h.f.rows.find(r=>dates.dateKeyUtc(r.hmeromhnia)==='2026-05-10');row.cards_eos_ora_01='00:01';row.cards_ores_ergasias=121/60;}
   else h.f.history.at(-1).pragmatikoOromisthio=11;
   assert.equal((await h.calc()).status,200);const stale=stage4ForMay4(await h.review());assert.equal(stale.business_status,'BLOCKED');assert.ok(stale.pending_reasons.includes('CANONICAL_DECISION_STALE'),JSON.stringify(stale.pending_reasons));assert.equal(h.decisionRecords.length,1);
   for(const key of ['frozen','oldFinalized','previousFinalized'])assert.deepEqual(h.f[key],h.before[key]);
   for(const row of h.before.rows.filter(r=>r.is_locked))assert.deepEqual(h.f.rows.find(r=>r._id===row._id),row);
  }finally{await h.close();}
 }
});

function uniqueTransferData(kind){const f=fullWeekData(kind,5,'sixth');const row=f.rows.find(r=>dates.dateKeyUtc(r.hmeromhnia)==='2026-05-06');Object.assign(row,{cards_apo_ora_01:'',cards_eos_ora_01:'',cards_ores_ergasias:0});return f;}
test('positive atomic transfer: full HTTP chain persists a unique approved pair for CLEAN and LEGACY',async()=>{
 const outputs=[];for(const kind of ['clean','legacy']){
  const f=uniqueTransferData(kind),h=await start(f,{fullWeekly:true,automatic:true,approvals:[reusableSourceApproval(f)],atomicStore:true});try{
   const result=await h.calc();assert.equal(result.status,200,JSON.stringify(result)+' '+h.f.lastError);
   const auto=result.body.weeklyRepoPostCheck.automaticRepoTransfer;assert.equal(auto.applied,1,JSON.stringify(auto));
   assert.equal(f.atomic.state.decisions.length,1);assert.equal(f.atomic.state.executions.length,1);assert.equal(f.atomic.state.audits.length,2);
   const source=f.rows.find(r=>dates.dateKeyUtc(r.hmeromhnia)==='2026-05-09'),target=f.rows.find(r=>dates.dateKeyUtc(r.hmeromhnia)==='2026-05-06');assert.equal(source.repo_apologistika,false);assert.equal(target.repo_apologistika,true);assert.equal(target.kathgoria_ergasias_apologistika,'ΑΝ');
   const review=await h.review();assert.equal(review.status,200,JSON.stringify(review)+' '+f.lastError);assert.equal(review.body.rows.find(r=>r._id===target._id).repo_apologistika,true);
   for(const row of h.before.rows.filter(r=>r.is_locked))assert.deepEqual(f.rows.find(r=>r._id===row._id),row);
   for(const key of ['frozen','oldFinalized','previousFinalized'])assert.deepEqual(f[key],h.before[key]);
   const savedState=structuredClone(f.atomic.state);const replay=await f.atomic.replay();assert.equal(replay.idempotent,true);assert.deepEqual(f.atomic.state,savedState);
   const businessPair=rows=>rows.map(({compensation_breakdown_apologistika,...row})=>row);
   const pairBefore=structuredClone([source,target]);
   const retry=await h.calc();assert.equal(retry.status,200,JSON.stringify(retry)+' '+f.lastError);assert.equal(retry.body.weeklyRepoPostCheck.automaticRepoTransfer.applied,0);
   assert.equal(f.atomic.state.decisions.length,1);assert.equal(f.atomic.state.executions.length,1);assert.equal(f.atomic.state.audits.length,2);assert.deepEqual(businessPair(pairBefore.map(r=>f.rows.find(x=>x._id===r._id))),businessPair(pairBefore));
   assert.ok(pairBefore.every(r=>f.rows.find(x=>x._id===r._id).compensation_breakdown_apologistika?.status==='READY'));
   const {decision_fingerprint,...execution}=f.atomic.state.executions[0];assert.equal(decision_fingerprint,f.atomic.state.decisions[0].snapshot_fingerprint);
   outputs.push({rows:f.rows,execution});
  }finally{await h.close();}
 }
 assert.deepEqual(outputs[1],outputs[0]);
});

test('positive atomic transfer: execution insertion failure rolls back both days and audits, then retry applies once',async()=>{
 for(const kind of ['clean','legacy']){
  const f=uniqueTransferData(kind),h=await start(f,{fullWeekly:true,automatic:true,approvals:[reusableSourceApproval(f)],atomicStore:true,failExecution:true});try{
   const failed=await h.calc();assert.equal(failed.status,500,JSON.stringify(failed));assert.equal(failed.body.code,'SYNTHETIC_EXECUTION_FAILURE');
   assert.equal(f.atomic.state.decisions.length,1);assert.equal(f.atomic.state.executions.length,0);assert.equal(f.atomic.state.audits.length,0);assert.deepEqual(f.rows,f.atomic.atomicBefore);
   const retry=await h.calc();assert.equal(retry.status,200,JSON.stringify(retry)+' '+f.lastError);assert.equal(retry.body.weeklyRepoPostCheck.automaticRepoTransfer.applied,1);assert.equal(f.atomic.state.decisions.length,1);assert.equal(f.atomic.state.executions.length,1);assert.equal(f.atomic.state.audits.length,2);
   for(const row of h.before.rows.filter(r=>r.is_locked))assert.deepEqual(f.rows.find(r=>r._id===row._id),row);
   for(const key of ['frozen','oldFinalized','previousFinalized'])assert.deepEqual(f[key],h.before[key]);
  }finally{await h.close();}
 }
});

test('mixed employees: ambiguous History cannot change the clean employee calculation or block review',async()=>{
 const cleanData=data('clean');
 cleanData.employee._id='507f1f77bcf86cd799439066';
 cleanData.employee.kodikos='0031';cleanData.scope.kodikos='0031';
 for(const row of [...cleanData.rows,...cleanData.history])row.kodikos='0031';
 cleanData.history[0]._id='507f1f77bcf86cd799439065';
 const mixedData=data('no-verified-history');
 mixedData.employees=[mixedData.employee,structuredClone(cleanData.employee)];
 mixedData.history.push(...structuredClone(cleanData.history));
 mixedData.rows.push(...cleanData.rows.map(row=>({...structuredClone(row),_id:'clean-'+row._id})));
 const clean=await start(cleanData),mixed=await start(mixedData);
 try{
  assert.equal((await clean.calc()).status,200);
  const result=await mixed.calc();assert.equal(result.status,200,JSON.stringify(result));
  assert.equal(result.body.employeesCount,2);assert.equal(result.body.all_results_documented,false);
  for(const row of clean.f.rows){const actual=mixed.f.rows.find(r=>r._id==='clean-'+row._id);assert.deepEqual({...actual,_id:row._id},row);}
  const review=await mixed.review();assert.equal(review.status,200,JSON.stringify(review));
  assert.ok(review.body.rows.some(r=>r.kodikos==='0031'));
  assert.ok(review.body.canonicalLifecycleProjections.every(p=>Object.values(p.lifecycle_projection.stages).every(s=>!s.blockers.includes('EMPLOYEE_HISTORY_COVERAGE_REQUIRED'))));
  assert.deepEqual(mixed.f.history,mixed.before.history);assertFrozenUnchanged(mixed);
 }finally{await clean.close();await mixed.close();}
});
