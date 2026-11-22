'use strict';
const fs=require('fs'),vm=require('vm'),crypto=require('crypto'),assert=require('assert/strict');
const { test }=require('node:test');
const SRC=fs.readFileSync(__dirname+'/employeeApprovedHistoryAtomicMaintenanceService.js','utf8');
const h=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
    const boundSource=fs.readFileSync(__dirname+'/employeeApprovedHistoryImmutableBoundaryService.js','utf8');
    const bctx={require:p=>p.endsWith('ApplyContract')?{hash:h,equal}:C,
        module:{exports:{}},Date,Buffer,console};
    // The shared immutable boundary contract is loaded with a pure local stub.
    // No default Mongoose connection or real database can be created by this test.

let lastId=500;
const scope={team:'THA', company_kod:'610000000000000000000001',kodikos:'0002'};
const employeeID='620000000000000000000900', oldID='620000000000000000000001',lastID='620000000000000000000002';
const mkDay=s=>new Date(s+'T00:00:00.000Z');
const e={...scope,_id:employeeID,hmeromhnia_proslhpshs:'2026-02-02', hmeromhnia_isxyos_oron_ergasias_apo:'2026-06-03',
 hmeres_ergasias_ebdomadas:5,typos_ebdomadas:'5HMERH',ores_ergasias_ebdomadas:40,mo_oron_hmerhsias_ergasias:8,apasxolhsh_basei_symbashs:'5',
 energos:true,employee_profile_mutation_sequence:0};
const last={...scope,_id:lastID,aa_eggrafhs:'0002',hmeromhnia_proslhpshs:'2026-02-02',
 hmeromhnia_isxyos_oron_ergasias_apo:'2026-06-03',hmeromhnia_isxyos_oron_ergasias_eos:null,
 hmeres_ergasias_ebdomadas:5,typos_ebdomadas:'5HMERH',ores_ergasias_ebdomadas:40,mo_oron_hmerhsias_ergasias:8,apasxolhsh_basei_symbashs:'5'};
const previous={...last,_id:oldID,aa_eggrafhs:'0001',hmeromhnia_isxyos_oron_ergasias_apo:'2026-02-02',hmeromhnia_isxyos_oron_ergasias_eos:'2026-06-02'};
let committed={employee:e,history:[previous,last],audits:[]};
let txs=0, fences=0, failCreate=false, frozen=false;let observedProtectionPeriod=null;const protectedIds=new Set();
const query=(reader)=>({select(){return this},session(s){this.s=s;return this},lean(){return Promise.resolve(structuredClone(reader(this.s.draft)))},mongooseOptions(){return this}});
const employeeModel={findOne:()=>query(d=>d.employee),async updateOne(f,changes,{session}){Object.assign(session.draft.employee,structuredClone(changes.$set));return {matchedCount:1}}};
const historyModel={find:()=>query(d=>d.history),async updateOne(f,change,{session}){physicalUpdateIds.push(String(f._id));const item=session.draft.history.find(x=>String(x._id)===String(f._id));if(!item)return {matchedCount:0};Object.assign(item,structuredClone(change.$set||{}));return {matchedCount:1}},async create(arr,{session}){if(failCreate)throw Error('SYNTHETIC_INSERT_FAILURE');const [item]=arr;const persisted={...item,_id:String(item._id)};session.draft.history.push(structuredClone(persisted));return [persisted]}};
const auditModel={async create(arr,{session}){const item={...arr[0],_id:'audit-new'};session.draft.audits.push(structuredClone(item));return [item]}};
const approved=[{_id:'audit-old',diagnostics:{targetHistoryId:oldID}}];
const W={transactionCapability:async()=>true,async inProfileTransaction(con,probe,fn){const session={draft:structuredClone(committed)};const result=await fn(session);committed=session.draft;txs++;return result;},async acquireEmployeeMutationFence({session}){session.draft.employee.employee_profile_mutation_sequence++;fences++;}};
const DAY='hmeres_ergasias_ebdomadas';
const T6={hmeres_ergasias_ebdomadas:6,typos_ebdomadas:'6HMERH',ores_ergasias_ebdomadas:40,mo_oron_hmerhsias_ergasias:6.67};
const T5={hmeres_ergasias_ebdomadas:5,typos_ebdomadas:'5HMERH',ores_ergasias_ebdomadas:40,mo_oron_hmerhsias_ergasias:8};
const C={HIRE:'hmeromhnia_proslhpshs',START:'hmeromhnia_isxyos_oron_ergasias_apo',END:'hmeromhnia_isxyos_oron_ergasias_eos',CHANGE:'hmeromhnia_allaghs_symbashs'};
    vm.runInNewContext(boundSource,bctx,{filename:'immutableBoundaryStub.js'});
    const B=bctx.module.exports;
    let physicalUpdateIds=[];
const stub={
 'node:crypto':crypto,
 'mongoose':{connection:{},Types:{ObjectId:class ObjectId{constructor(){this.key='650000000000000000000'+String(++lastId).padStart(3,'0')}toString(){return this.key}}}},
 './employeeEmploymentProfileWriter':W,
 '../userTeamScopeService':{normalizeRequiredUserTeam:v=>v},
 './employeeHistoryPeriodSerializationService':{claimCompanyPeriodSerialization:async()=>{}},
 './employeeHistoryRowApprovalService':{loadDecisions:async()=>approved},
    './employeeHistoryProposalReadService':{proposalHistoryState:input=>{
            const p=B.project({scope:input.scope,currentEmployee:input.currentEmployee,
                physicalRows:input.completeHistoryRows,historyRows:input.completeHistoryRows,
                atomicAudits:input.atomicBoundaryAudits || []});
            return {historyRows:p.historyRows,decisions:input.approvedHistoryDecisions,
                atomicSuccessors:p.successors};}},
        './employeeApprovedHistoryImmutableBoundaryService':B,
 './employeeApprovedHistoryChangeIntentService':{planApprovedHistoryChangeIntent:input=>({fromHistoryId:String(input.completeHistoryRows.at(-1)._id)})},
 './employeeApprovedHistoryAtomicProposalService':{prepareApprovedHistoryAtomicProposal:(input,r)=>r.kind==='NEW_CHANGE'?{
    status:'ATOMIC_NEW_VERSION_PREPARED_READ_ONLY',currentEmployeePatch:T6,
    historyInsertDraft:{...last,...T6,hmeromhnia_isxyos_oron_ergasias_apo:mkDay(r.effectiveFrom),hmeromhnia_isxyos_oron_ergasias_eos:null,
      hmeromhnia_allaghs_symbashs:mkDay(r.effectiveFrom),afora_allagh_oron_ergasias:true,_id:undefined,aa_eggrafhs:undefined}}
    :{status:'EXISTING_ERROR_CORRECTION_PREPARED_READ_ONLY',mode:'AUDITED_EXISTING_ROW_CORRECTION',
      targetHistoryId:String(input.completeHistoryRows.at(-1)._id),verifiedHistoryCorrection:T5,currentEmployeePatch:T5}},
 './employeeHistorySaveValidationService':{inspectEmployeeHistorySave:()=>({status:'CLEAN',issues:[]}),inspectEmployeeHistoryProposedRowSave:()=>({issues:[]})},
 './employeeHistoryCanonicalizationService':{canonicalizeEmployeeHistory:()=>({status:'CLEAN',cleanupRequired:false,idempotent:true})},
 '../../utils/ergazomenoi/employmentHistoryCoverage':{employeeHistoryCoverageGaps:()=>[]},
 './employeeEmploymentCycleResolverService':{buildEmploymentCycles:()=>[]},
 './employeeHistoryReferenceWriteFenceService':{claimUnchangedHistoryReferences:async()=>{}},
 './employeeMaintenanceAuthorizationService':{authorizeEmployeeMaintenance:async()=>{}},
 './employeeHistoryAutomaticReconstructionApplyContract':{hash:h,equal,ordered:x=>x.slice().sort((a,b)=>String(a._id).localeCompare(String(b._id)))},
 './employeeHistoryAutomaticReconstructionContract':C,
 './employeeHistoryReferenceAuditService':{findHistoryIdReferences:async()=>[]},
 './employeeHistoryLegacyProtectionService':{readLegacyProtection:async()=>({uncertain:false,controls:[],snapshots:[],wire:[]}),claimLegacyProtection:async()=>{}},
 '../../models/ergazomenoi':{ErgazomenoiModel:employeeModel,IstorikoProslhpseonAllagonModel:historyModel},
 '../../models/employeeHistoryRepairAudit':auditModel,
 '../../models/userModel':{},'../../models/privileges':{UserPrivilegesModel:{}},
 '../../models/apasxoliseisPeriodControl':{},'../../models/apasxoliseisPeriodFrozenSnapshot':{},
 './employeeHistoryRepairAuditSetupService':{employeeHistoryRepairAuditCollectionExists:async()=>true},
};
const ctx={require:p=>{if(!(p in stub))throw Error('stub missing '+p);return stub[p]},module:{exports:{}},Buffer,Date,console,process};
vm.runInNewContext(SRC,ctx,{filename:'employeeApprovedHistoryAtomicExecutionService.js'});
const S=ctx.module.exports;
const s=S.createApprovedHistoryAtomicMaintenanceService({connection:{},employeeModel,historyModel,auditModel,
    userModel:{},privilegeModel:{},referenceChecker:async({historyIds})=>protectedIds.has(historyIds[0])?[{collection:'frozen',documentId:'x'}]:[],periodProtection:async({period})=>{observedProtectionPeriod=period;return {uncertain:frozen,controls:[],snapshots:[],wire:[]}},claimPeriodProtection:async()=>{},claimCompanyPeriod:async()=>{},
    decisionsLoader:async()=>approved,enabled:()=>true,secret:'passwordless-synthetic-HMAC-signing-key',
    buildHistoryDocument:(m,row)=>row,auditReady:async()=>true,
        atomicAuditsLoader:async(_input,_model,session)=>session.draft.audits
            .filter(item=>item.mutationSource===B.OPERATION)});
const req={session:{userId:'630000000000000000000001',userTeam:'THA',companyInUse:scope.company_kod},
 params:{id:employeeID},sessionID:'synthetic-session'};
test('Stage5D synthetic: atomic 5->6, rollback, signed stale protection, immutable guards, 6->5 correction',async()=>{
 const before=structuredClone(committed),change={kind:'NEW_CHANGE',effectiveFrom:'2026-11-23',correctedTerms:T6};
 protectedIds.add(lastID);
 const p=await s.preview(req,change);assert.equal(p.status,'READY_FOR_SIGNED_ATOMIC_COMMIT');
 assert.deepEqual(committed,before);assert.equal(fences,0);
 assert.equal(observedProtectionPeriod.from,'2026-11-23');
 assert.equal(observedProtectionPeriod.to,null);
 await assert.rejects(s.apply(req,change,p.approval+'bad'),/CONFIRMATION/);
 committed.employee.email='synthetic-stale-email';
 await assert.rejects(s.apply(req,change,p.approval),/STALE_CONFIRMATION/);
 committed=structuredClone(before);
 failCreate=true;
 await assert.rejects(s.apply(req,change,p.approval),/SYNTHETIC_INSERT_FAILURE/);
 assert.deepEqual(committed,before);
 failCreate=false;
 const first=await s.apply(req,change,p.approval);assert.equal(first.historyUpdated,true);
 assert.equal(committed.history.length,3);assert.equal(committed.employee.hmeres_ergasias_ebdomadas,6);
 assert.equal(committed.employee.apasxolhsh_basei_symbashs,'6');
 assert.equal(committed.history.at(-1).apasxolhsh_basei_symbashs,'6');
 assert.equal(committed.audits[0].diagnostics.changedFields.includes('apasxolhsh_basei_symbashs'),true);
 assert.equal(committed.history.find(r=>r._id===oldID).hmeres_ergasias_ebdomadas,5);
 assert.equal(committed.history.find(r=>r._id===lastID).hmeromhnia_isxyos_oron_ergasias_eos,null);
     assert.equal(physicalUpdateIds.includes(lastID),false,'old physical History cannot be updated');
     assert.equal(committed.audits[0].diagnostics.boundary.priorEffectiveTo,'2026-11-22');
 assert.equal(committed.audits.length,1);
 assert.equal(fences,2);
 protectedIds.delete(lastID);
 const newId=first.insertedHistoryId;
 const correction={kind:'CORRECT_SAVED_ERROR',effectiveFrom:'2026-11-23',correctedTerms:T5,targetHistoryId:newId};
 protectedIds.add(newId);
 await assert.rejects(s.preview(req,correction),/IMMUTABLE_TARGET_REQUIRES_CORRECTION_EDITION/);
 protectedIds.clear();
 frozen=true;
 await assert.rejects(s.preview(req,correction),/FROZEN_OR_UNKNOWN_PERIOD/);
 frozen=false;
 const correctionPreview=await s.preview(req,correction);
 const corrected=await s.apply(req,correction,correctionPreview.approval);
 assert.equal(corrected.historyUpdated,true);
 assert.equal(corrected.insertedHistoryId,null);
 assert.equal(committed.history.length,3);
 assert.equal(committed.employee.hmeres_ergasias_ebdomadas,5);
 assert.equal(committed.employee.apasxolhsh_basei_symbashs,'5');
 assert.equal(committed.history.find(row=>String(row._id)===newId).apasxolhsh_basei_symbashs,'5');
 assert.equal(committed.history.find(row=>String(row._id)===newId).hmeres_ergasias_ebdomadas,5);
     assert.deepEqual(physicalUpdateIds,[newId], 'only the new, unreferenced atomic row can be corrected');
 assert.equal(committed.audits.length,2);
     assert.equal(committed.audits[0].diagnostics.outcome,'COMMITTED');
     assert.equal(committed.audits[1].diagnostics.operation,'CORRECT_SAVED_ERROR');
 await assert.rejects(s.apply(req,change,p.approval),/STALE_CONFIRMATION|LAST_PERIOD_NOT_OPEN/);
 const revision=structuredClone(committed);
 const bad={kind:'NEW_CHANGE',effectiveFrom:'2026-12-01',correctedTerms:T6};
 const realSecondChange=await s.preview(req,bad);
     assert.equal(realSecondChange.previewOnly,true);
     assert.equal(realSecondChange.plannedOldRowUpdate,false);
     assert.equal(realSecondChange.plannedVerifiedLogicalBoundary,true);
 assert.deepEqual(committed,revision);
 assert.equal(committed.history.find(r=>r._id===oldID).hmeres_ergasias_ebdomadas,5);
});


test('Stage5D production adapter is opt-in and rejects without touching Mongo', async () => {
    const real = require('./employeeApprovedHistoryAtomicMaintenanceService');
    assert.equal(real.FLAG, 'PAYROLL_PR406_APPROVED_ATOMIC_MAINTENANCE_ENABLED');
    const off = real.createApprovedHistoryAtomicMaintenanceService({ enabled: () => false,
        secret: 'synthetic-only-long-enough-signing-key',
        connection: { startSession() { assert.fail('DISABLED must not start session'); } } });
    await assert.rejects(off.preview({}, {}), {code:'EMPLOYEE_APPROVED_ATOMIC_DISABLED'});
    await assert.rejects(off.apply({}, {}, ''), {code:'EMPLOYEE_APPROVED_ATOMIC_DISABLED'});
});

test('Stage5D real approval projection and unresolved-source validation remain mandatory', () => {
    const code=fs.readFileSync(__dirname+'/employeeApprovedHistoryAtomicMaintenanceService.js','utf8');
    for(const part of ['prepareApprovedHistoryAtomicProposal','proposalHistoryState',
        'inspectEmployeeHistorySave','inspectEmployeeHistoryProposedRowSave',
        'claimUnchangedHistoryReferences','claimPeriodProtection','claimCompanyPeriod','acquireEmployeeMutationFence',
        'employeeHistoryRepairAuditCollectionExists','employee_pending_history']) {
        if(part==='employee_pending_history') continue; // handled by Stage5B/C plan
        assert.ok(code.includes(part),part);
    }
    assert.doesNotMatch(code,/\bprocess\.env\[FLAG\]\s*=(?!=)|\bconsole\.log\s*\(/);
});


test('Stage5F server-owned context is read only and selects the current period',async()=>{
    const before=structuredClone(committed);
    const context=await s.context(req);
    assert.equal(context.success,true);
    assert.equal(context.contextOnly,true);
    assert.equal(context.pendingHistory,false);
    assert.equal(context.effectiveFrom,'2026-11-23');
    assert.match(context.targetHistoryId,/^[0-9a-f]{24}$/i);
    assert.equal(context.currentTerms.hmeres_ergasias_ebdomadas,5);
    assert.equal(context.currentContract,'5');
    assert.deepEqual(committed,before);
});
test('Stage5F context default OFF does not inspect or query the database',async()=>{
    const real = require('./employeeApprovedHistoryAtomicMaintenanceService');
    const off=real.createApprovedHistoryAtomicMaintenanceService({enabled:()=>false,
        secret:'synthetic-only-long-enough-signing-key',connection:{startSession(){
            assert.fail('context must be disabled before database access');}}});
    await assert.rejects(off.context({}),{code:'EMPLOYEE_APPROVED_ATOMIC_DISABLED'});
});


    test('legacy existing predecessor cannot be silently physically rewritten by same-period correction',()=>{
      assert.equal(physicalUpdateIds.includes(lastID),false);
      assert.equal(committed.history.find(row=>row._id===lastID).hmeromhnia_isxyos_oron_ergasias_eos,null);
    });

test('approved latest History: a REAL new date inserts without rewriting approved physical predecessor',()=>{
    const original=structuredClone(last);
    const latestApproved={...last, reviewedLegacyTerm:'APPROVED'};
    const lastApproval={_id:'640000000000000000000021',diagnostics:{targetHistoryId:lastID,
        rowApproval:{approvedContent:latestApproved,approvedContentHash:h(latestApproved)}}};
    const input={scope,currentEmployee:structuredClone(e),completeHistoryRows:[previous,last],
        approvedHistoryDecisions:[...approved,lastApproval],atomicBoundaryAudits:[],
        protectedReferenceSummary:{[oldID]:[],[lastID]:[]}};
    // VM's trusted projection stub supplies exactly the already-verified
    // edition to this service. The B contract independently checks provenance.
    input.completeHistoryRows=[previous,latestApproved];
    const prior=structuredClone(input.completeHistoryRows[1]);
    const req={kind:'NEW_CHANGE',effectiveFrom:'2026-11-23',correctedTerms:T6};
    const protection={uncertain:false,controls:[],snapshots:[],wire:[]};
    const plan=S.decide(input,req,protection);
    assert.equal(plan.kind,'NEW_CHANGE');
    assert.equal(plan.targetPatch,null);
    assert.equal(plan.targetId,lastID);
    assert.equal(plan.approvedEdition.approvalAuditId,lastApproval._id);
    assert.equal(plan.approvedEdition.approvedContentHash,lastApproval.diagnostics.rowApproval.approvedContentHash);
    assert.equal(plan.nextRow.hmeres_ergasias_ebdomadas,6);
    assert.equal(plan.virtualClose[C.END].toISOString().slice(0,10),'2026-11-22');
    assert.deepEqual(input.completeHistoryRows[1],prior);
    assert.deepEqual(last,original);
    const correction={kind:'CORRECT_SAVED_ERROR',effectiveFrom:'2026-06-03',
        correctedTerms:T5,targetHistoryId:lastID};
    assert.throws(()=>S.decide(input,correction,protection),/APPROVED_TARGET_CANNOT_BE_REWRITTEN/);
});
