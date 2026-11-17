'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {startApprovedProposalMongo}=require('../fixtures/employeeHistoryApprovedProposalMongo');
const {seedLegacyStructure,legacyProposal,approved,rawState}=require('../fixtures/employeeHistoryLegacyStructure');
const {createEmployeeHistoryApprovedProposalService:create}=require('../../server/services/ergazomenoi/employeeHistoryApprovedProposalService');
const Period=require('../../server/services/ergazomenoi/apasxoliseisPeriodControlService');
const Reconstruction=require('../../server/services/ergazomenoi/apasxoliseisHistoricalPeriodReconstructionService');
const C=require('../../server/services/ergazomenoi/employeeHistoryAutomaticReconstructionContract');
const binary=process.env.PAYROLL_APPROVED_PROPOSAL_TEST_MONGOD;
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
const timeout=p=>Promise.race([p,new Promise((_,reject)=>{const timer=setTimeout(()=>reject(Error('synthetic race barrier timeout')),10000);timer.unref();})]);
async function runner(db,work){const session=await db.connection.startSession();try{let result;await session.withTransaction(async()=>result=await work(session));return result;}finally{await session.endSession();}}
const scope=f=>({team:f.scope.team,company_kod:f.scope.company_kod,ypokatasthma:'0000',period_start:new Date('2026-03-01'),period_end:new Date('2026-03-31')});
const initialNow=new Date('2026-04-01');
test('MongoDB: κοινή σειριοποίηση απουσίας PeriodControls με τους τέσσερις πραγματικούς δημιουργούς περιόδου',
    {skip:!binary,timeout:180000},async t=>{
    const db=await startApprovedProposalMongo(binary);t.after(db.close);
    const periodAudit=db.connection.model('LegacyTestPeriodAudit',require('../../server/models/apasxoliseisPeriodControlAudit').schema.clone());await periodAudit.createCollection();
    const lifecycleAudit=db.connection.model('LegacyTestLifecycleAudit',require('../../server/models/apasxoliseisPeriodLifecycleAudit').schema.clone());await lifecycleAudit.createCollection();
    const paths={
        LOCK:async(f)=>runner(db,dbSession=>Period.transitionPeriodControl({session:{...f.req.session,userRole:'A'},scope:scope(f),action:'LOCK',
            reason:'Συνθετικό κλείδωμα',requestId:`lock-${f.actor}`,now:initialNow,dbSession,transactionRunner:null,
            periodControlModel:db.periodControlModel,auditModel:periodAudit})),
        CALCULATION:async(f)=>Period.acquirePeriodCalculationOwnership({scope:scope(f),now:initialNow,calculationId:`calculation-${f.actor}`,
            periodControlModel:db.periodControlModel,indexGuard:async()=>{},transactionRunner:work=>runner(db,work)}),
        WRITE:async(f)=>runner(db,session=>Period.fencePeriodForWrite({scope:scope(f),now:initialNow,expectedToken:{exists:false},session,periodControlModel:db.periodControlModel})),
        HISTORICAL_AUTHORIZATION:async(f)=>Reconstruction.authorizeHistoricalReconstruction({session:{...f.req.session,userRole:'A'},scope:scope(f),
            reason:'Συνθετική ανακατασκευή',requestId:`history-${f.actor}`,confirmation:true,now:new Date('2026-11-17'),
            periodControlModel:db.periodControlModel,auditModel:lifecycleAudit,transactionRunner:work=>runner(db,work)}),
    };
    for(const [name,write] of Object.entries(paths)){
        await t.test(`${name}: περίοδος δεσμεύεται μετά την ανάγνωση απουσίας, η έγκριση ακυρώνεται χωρίς ιστορική εγγραφή`,async()=>{
            const f=await seedLegacyStructure(db),p=await legacyProposal(f),preview=await create(f.dependencies).certificationPreview(f.req,p);
            const reached=deferred(),release=deferred();let once=true;
            const service=create({...f.dependencies,loadSchedules:async()=>{if(once){once=false;reached.resolve();await release.promise;}return [];}});
            const applied=service.apply(f.req,approved(p,preview));const outcome=applied.then(r=>({r}),e=>({e}));
            await timeout(reached.promise);const historyBefore=(await rawState(f)).history;
            try{await write(f);}finally{release.resolve();}
            const result=await timeout(outcome);assert.equal(result.e?.reason,({LOCK:'PERIOD_PROTECTED',CALCULATION:'PERIOD_BUSY'})[name]||'STALE');
            assert.deepEqual((await rawState(f)).history,historyBefore);assert.equal((await rawState(f)).audit.length,0);
            assert.equal(await db.periodControlModel.collection.countDocuments({company_kod:f.scope.company_kod}),1);
            const company=await db.companyModel.collection.findOne({_id:new(require('mongoose').Types.ObjectId)(f.scope.company_kod)});
            assert.equal(company.employee_history_period_mutation_sequence,1);
        });
        await t.test(`${name}: η διόρθωση κρατά πρώτη τη δέσμευση και ο δημιουργός περιόδου επανεκκινεί μετά το COMMIT`,async()=>{
            const f=await seedLegacyStructure(db),p=await legacyProposal(f),preview=await create(f.dependencies).certificationPreview(f.req,p);
            const reached=deferred(),release=deferred(),sent=deferred();let once=true;
            const service=create({...f.dependencies,loadCatalogs:async()=>{if(once){once=false;reached.resolve();await release.promise;}return f.catalogs;}});
            const applied=service.apply(f.req,approved(p,preview));const outcome=applied.then(r=>({r}),e=>({e}));await timeout(reached.promise);
            // The real driver sends the competing company CAS while the first
            // transaction owns it. Its work must retry under snapshot isolation.
            const client=db.connection.getClient();
            const observe=e=>{if(e.commandName==='update'&&e.command.update==='Companies'&&String(e.command.updates?.[0]?.q?._id)===f.scope.company_kod)sent.resolve();};
            client.on('commandStarted',observe);let competing;
            try{competing=write(f);await timeout(sent.promise);}finally{client.off('commandStarted',observe);release.resolve();}
            const corrected=await timeout(outcome);
            await competing;
            // A concurrent new period can make post-commit protection reread
            // report COMMITTED_STATE_CHANGED. That is honest; the audit and all
            // physical history rows must still form one complete correction.
            if(corrected.e){assert.equal(corrected.e.saved,true);assert.equal(corrected.e.reason,'COMMITTED_STATE_CHANGED');}
            else assert.equal(corrected.r?.outcome,'COMMITTED');
            const rows=(await f.input()).completeHistoryRows;
            assert.deepEqual(rows.map(r=>r.aa_eggrafhs).sort(),['0001','0002','0003']);
            assert.equal(rows.find(r=>r.aa_eggrafhs==='0001')[C.END].toISOString().slice(0,10),'2026-03-31');
            assert.equal(await db.auditModel.collection.countDocuments({'employeeScope.employee_id':f.employee._id}),1);
            const company=await db.companyModel.collection.findOne({_id:new(require('mongoose').Types.ObjectId)(f.scope.company_kod)});
            assert.equal(company.employee_history_period_mutation_sequence,2);
        });
    }
    await t.test('Υφιστάμενο control: η επανάληψη εγγραφής διατηρεί μόνο την παλιά δέσμευση περιόδου, χωρίς νέο μετρητή εταιρείας',async()=>{
        const f=await seedLegacyStructure(db);await paths.WRITE(f);
        const before=await rawState(f),record=await db.periodControlModel.findOne(scope(f)).lean();
        await runner(db,session=>Period.fencePeriodForWrite({scope:scope(f),now:initialNow,session,
            expectedToken:{exists:true,stored_status:'OPEN',version:record.version},periodControlModel:db.periodControlModel}));
        const after=await rawState(f);assert.deepEqual(after.company,before.company);
        assert.deepEqual(after.history,before.history);assert.deepEqual(after.audit,before.audit);
        const reread=await db.periodControlModel.findOne(scope(f)).lean();assert.equal(reread.write_fence_version,record.write_fence_version+1);
    });
    for(const name of ['LOCK','HISTORICAL_AUTHORIZATION'])await t.test(`${name}: ίδια ήδη καταγεγραμμένη ενέργεια δεν αυξάνει την έκδοση εταιρείας`,async()=>{
        const f=await seedLegacyStructure(db);await paths[name](f);const before=await rawState(f);
        assert.equal((await paths[name](f)).idempotent,true);assert.deepEqual(await rawState(f),before);
    });
});
