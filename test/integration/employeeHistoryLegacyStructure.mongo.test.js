'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const mongoose=require('mongoose');
const {startApprovedProposalMongo}=require('../fixtures/employeeHistoryApprovedProposalMongo');
const {seedLegacyStructure,legacyProposal,approved,seedLegacyFrozen,rawState}=require('../fixtures/employeeHistoryLegacyStructure');
const {createEmployeeHistoryApprovedProposalService:create}=require('../../server/services/ergazomenoi/employeeHistoryApprovedProposalService');
const C=require('../../server/services/ergazomenoi/employeeHistoryAutomaticReconstructionContract');
const A=require('../../server/services/ergazomenoi/employeeHistoryAutomaticReconstructionApplyContract');
const P=require('../../server/services/ergazomenoi/employeeHistoryApprovedProposalContract');
const Legacy=require('../../server/services/ergazomenoi/employeeHistoryLegacyStructureCertificationService');
const binary=process.env.PAYROLL_APPROVED_PROPOSAL_TEST_MONGOD;
const proxy=(model,overrides)=>new Proxy(model,{get(target,key){const value=Object.hasOwn(overrides,key)?overrides[key]:Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;}});
const iso=v=>v?.toISOString().slice(0,10)||null;

test('Συνολική πιστοποίηση πραγματικής legacy δομής: υπάρχουσες ταυτότητες, άγνωστα γεγονότα και ατομικότητα',
    {skip:!binary,timeout:240000},async t=>{
    assert.equal(P.enabled(),false);assert.equal(mongoose.connection.readyState,0);
    const db=await startApprovedProposalMongo(binary);t.after(db.close);console.log(`Απομονωμένη βάση: ${db.folder}`);
    for(const version of ['employment-period-frozen:v1','employment-period-frozen:v2','employment-period-frozen:v3'])
    await t.test(`${version}: πραγματικό COMMIT χωρίς PeriodControls Φεβ–Απρ, αμετάβλητο BSON και ανεξάρτητο πλήρες κλείσιμο`,async()=>{
        const f=await seedLegacyStructure(db),frozen=await seedLegacyFrozen(f,{version});
        await seedLegacyFrozen(f,{version,finalized:true,historyIndex:1,from:'2026-09-01',to:'2026-09-30'});
        const proposal=await legacyProposal(f),service=create(f.dependencies),before=await rawState(f),input=await f.input();
        const diag=Legacy.diagnosis(input);assert.equal(diag.rows[0].termsTo,null);assert.equal(diag.rows[0].scheduleTo,'2026-02-08');
        const commands=[];db.connection.getClient().on('commandStarted',observe);
        function observe(e){commands.push(e.commandName);}
        const preview=await service.certificationPreview(f.req,proposal);
        db.connection.getClient().off('commandStarted',observe);
        assert.equal(commands.some(c=>['insert','update','delete','findAndModify'].includes(c)),false);
        assert.deepEqual(await rawState(f),before);assert.equal(preview.physicalWrites.history.coordinatedRows.length,3);
        assert.equal(preview.physicalWrites.referencePayloadsModified,false);
        assert.equal(preview.certification.certifiedRows.length,3);
        const projection=require('../../server/services/ergazomenoi/apasxoliseisStoredReviewReadService').projectStoredFrozenReview;
        const frozenReview=projection({snapshot:frozen.snapshot,scope:frozen.scope,kodikos:'0002'});
        const result=await service.apply(f.req,approved(proposal,preview));
        assert.equal(result.selectedCaseStatus,'VERIFIED_RESOLVED');assert.equal(result.verification.canonicalIdempotent,true);
        assert.equal(result.verification.coverageGapCount,0);assert.deepEqual(result.verification.remainingIssues,[]);
        const after=await rawState(f);assert.deepEqual(after.frozen,before.frozen);assert.deepEqual(after.controls,before.controls);
        assert.equal(after.controls.length,1);assert.equal(after.audit.length,1);assert.equal(after.history.length,3);
        assert.deepEqual(projection({snapshot:(await db.frozenModel.collection.findOne({_id:frozen.id})).frozen_snapshot,scope:frozen.scope,kodikos:'0002'}),frozenReview);
        const stored=(await f.input()).completeHistoryRows;
        const boundaries=stored.map(row=>[row.aa_eggrafhs,iso(row[C.START]),iso(row[C.END]),row.afora_proslhpsh,row.afora_allagh_dialleimatos]).sort();
        assert.deepEqual(boundaries,[['0001','2026-02-02','2026-03-31',true,false],['0002','2026-06-03',null,false,false],['0003','2026-04-01','2026-06-02',false,false]]);
        assert.equal(iso(stored.find(r=>r.aa_eggrafhs==='0001').hmeromhnia_allaghs_orarioy_eos),'2026-02-08');
        const audit=await db.auditModel.findOne({'employeeScope.employee_id':f.employee._id}).lean();
        assert.equal(audit.diagnostics.companySerialization.after,1);assert.equal(audit.diagnostics.legacyCertification.coordinatedChanges.length,3);
        for(const row of stored){
            const old=input.completeHistoryRows.find(r=>String(r._id)===String(row._id));
            const approvedFields=preview.physicalWrites.history.coordinatedRows.find(r=>r.historyId===String(row._id)).fields;
            for(const field of new Set([...Object.keys(old),...Object.keys(row)]))if(!approvedFields.includes(field)&&field!=='updatedAt')
                assert.ok(A.equal(row[field],old[field]),`Μη εγκεκριμένη μεταβολή ${row.aa_eggrafhs}/${field}`);
        }
        const breaks=require('../../server/utils/ergazomenoi/resolveBreakConfigurationForDate').resolveBreakConfigurationForDate;
        assert.equal(breaks('2026-02-15',stored,input.currentEmployee).break_minutes,30);
        const saved=await rawState(f);assert.equal((await service.apply(f.req,approved(proposal,preview))).alreadyApplied,true);
        assert.equal((await service.reconcile(f.req,{proposal,token:preview.approval.token})).selectedCaseStatus,'VERIFIED_RESOLVED');
        assert.deepEqual(await rawState(f),saved);
    });
    await t.test('Εναλλακτικό τεκμηριωμένο γεγονός 03/06: μόνο ωράριο, διατήρηση φυσικής γραμμής χωρίς νέα σύμβαση',async()=>{
        const f=await seedLegacyStructure(db),proposal=await legacyProposal(f,{scheduleOnly:true}),service=create(f.dependencies);
        const preview=await service.certificationPreview(f.req,proposal),result=await service.apply(f.req,approved(proposal,preview));
        assert.equal(result.selectedCaseStatus,'VERIFIED_RESOLVED');
        const row=await db.historyModel.collection.findOne({_id:f.history[1]._id});
        assert.equal(row[C.START],null);assert.equal(row[C.END],null);assert.equal(row.afora_proslhpsh,false);assert.equal(row.afora_allagh_oron_ergasias,false);
        assert.equal(iso(row.hmeromhnia_allaghs_orarioy_apo),'2026-06-03');assert.equal(row.dialleima_se_lepta,30);
        assert.equal(await db.historyModel.collection.countDocuments(f.scope),3);
    });
    for(const [name,mutate,reason] of [
        ['άγνωστο γεγονός 03/06',p=>p.legacyCertification.events[1].kind='UNKNOWN','LEGACY_EVENT_EVIDENCE_REQUIRED'],
        ['χωρίς πρωτότυπο',p=>p.legacyCertification.events[2].evidence='','LEGACY_EVENT_EVIDENCE_REQUIRED'],
        ['χωρίς ημερομηνία όρων',p=>p.legacyCertification.events[1].from=null,'LEGACY_TERMS_DATE_REQUIRED'],
        ['μη υπαρκτή ημερομηνία όρων',p=>p.legacyCertification.events[1].from='2026-02-30','LEGACY_TERMS_DATE_REQUIRED'],
        ['χωρίς χωριστή δήλωση αρχικού διαλείμματος',p=>p.legacyCertification.events[0].breakConfirmed=false,'LEGACY_INITIAL_BREAK_FACTS_REQUIRED'],
        ['λείπει αρχική δήλωση ημερομηνίας',p=>p.legacyCertification.events[0].from=null,'LEGACY_INITIAL_EVENT_REQUIRED'],
        ['διπλό πραγματικό αρχικό γεγονός',p=>p.legacyCertification.events[1].kind='INITIAL_TERMS','LEGACY_INITIAL_EVENT_REQUIRED'],
        ['λείπει γραμμή',p=>p.legacyCertification.events.pop(),'LEGACY_STRUCTURE_STALE'],
    ])await t.test(`${name}: ακριβές εμπόδιο χωρίς καμία αποθήκευση`,async()=>{
        const f=await seedLegacyStructure(db),p=await legacyProposal(f),s=create(f.dependencies),before=await rawState(f);mutate(p);
        await assert.rejects(s.certificationPreview(f.req,p),e=>e.reason===reason);assert.deepEqual(await rawState(f),before);
    });
    await t.test('Άγνωστη τιμή προφίλ άλλης γραμμής δεν δανείζεται τιμή από τρέχοντα εργαζόμενο',async()=>{
        const f=await seedLegacyStructure(db);await db.historyModel.collection.updateOne({_id:f.history[2]._id},{$unset:{dialleima_se_lepta:1}});
        const p=await legacyProposal(f),before=await rawState(f);
        await assert.rejects(create(f.dependencies).certificationPreview(f.req,p),e=>e.reason==='LEGACY_PROFILE_FACT_REQUIRED'&&e.problems[0].fieldId==='dialleima_se_lepta');
        assert.deepEqual(await rawState(f),before);
    });
    await t.test('Η λήξη ωραρίου 08/02 στο ΜΕΤΑ δεν αντικαθιστά σιωπηρά την τεκμηριωμένη λήξη όρων 31/03',async()=>{
        const f=await seedLegacyStructure(db),p=await legacyProposal(f);
        const baseline=await require('../../server/services/ergazomenoi/employeeHistoryProposalXlsxService').buildEmployeeHistoryProposalWorkbook(await f.input(),f.catalogs,{selection:p.selection});
        p.completion.changes.find(c=>baseline.editableCells[c.index].canonicalField===C.END).value='2026-02-08';
        await assert.rejects(create(f.dependencies).certificationPreview(f.req,p),e=>e.reason==='LEGACY_XLSX_DATE_CONFLICT'&&/2026-02-08/.test(e.problems[0].problem));
    });
    for(const [name,change,reason] of [
        ['άγνωστα όρια υφιστάμενης περιόδου',async(f)=>db.periodControlModel.collection.insertOne({team:f.scope.team,company_kod:f.scope.company_kod,ypokatasthma:'0000',status:'LOCKED'}),'PROTECTION_UNKNOWN'],
        ['LOCKED',async(f)=>db.periodControlModel.collection.insertOne({team:f.scope.team,company_kod:f.scope.company_kod,ypokatasthma:'0000',period_start:new Date('2026-03-01'),period_end:new Date('2026-03-31'),status:'LOCKED'}),'PERIOD_PROTECTED'],
        ['ενεργός υπολογισμός',async(f)=>db.periodControlModel.collection.insertOne({team:f.scope.team,company_kod:f.scope.company_kod,ypokatasthma:'0000',period_start:new Date('2026-03-01'),period_end:new Date('2026-03-31'),status:'OPEN',active_calculation_id:'busy'}),'PERIOD_BUSY'],
        ['οριστικοποίηση χωρίς αυτάρκες στιγμιότυπο',async(f)=>db.periodControlModel.collection.insertOne({team:f.scope.team,company_kod:f.scope.company_kod,ypokatasthma:'0000',period_start:new Date('2026-03-01'),period_end:new Date('2026-03-31'),status:'FINALIZED'}),'REFERENCE'],
        ['άγνωστη παλαιά έκδοση',async(f)=>seedLegacyFrozen(f,{version:'employment-period-frozen:v0'}),'REFERENCE'],
        ['άγνωστο σχήμα αναφοράς ακόμη και με συνεπές hash',async(f)=>{const ref=await seedLegacyFrozen(f);const doc=await db.frozenModel.collection.findOne({_id:ref.id});doc.frozen_snapshot.daily_results[0].live_history_lookup={history_id:String(f.history[0]._id)};await db.frozenModel.collection.updateOne({_id:ref.id},{$set:{frozen_snapshot:doc.frozen_snapshot,frozen_snapshot_fingerprint:require('../../server/services/ergazomenoi/employeeHistoryFrozenProvenanceContract').storedFrozenFingerprint(doc.frozen_snapshot)}});},'REFERENCE'],
        ['άλλη μη επαληθευμένη reference collection',async(f)=>db.connection.collection('Oraria_Apologistika').insertOne({...f.scope,effective_profile_istoriko_id:String(f.history[0]._id)}),'REFERENCE'],
        ['αλλοιωμένα αποθηκευμένα ποσά',async(f)=>{const ref=await seedLegacyFrozen(f);await db.frozenModel.collection.updateOne({_id:ref.id},{$set:{'frozen_snapshot.payroll_results.0.plhroteo':999999}});},'REFERENCE'],
    ])await t.test(`${name}: κλείδωμα χωρίς αλλαγή αποτελεσμάτων ή πλασματικά OPEN`,async()=>{
        const f=await seedLegacyStructure(db);await change(f);const p=await legacyProposal(f),before=await rawState(f);
        await assert.rejects(create(f.dependencies).certificationPreview(f.req,p),e=>e.reason===reason);assert.deepEqual(await rawState(f),before);
    });

    await t.test('Ανενεργή εκδοχή και οι φυσικές της τιμές παραμένουν ακριβώς αμετάβλητες',async()=>{
        const f=await seedLegacyStructure(db),id=new mongoose.Types.ObjectId();
        const inactive={...f.history[0],...f.scope,_id:id,aa_eggrafhs:'0000',employment_history_canonical_status:'REDUNDANT_REFERENCED',employment_history_canonical_survivor_id:String(f.history[0]._id)};
        await db.historyModel.collection.insertOne(inactive);const raw=await db.historyModel.collection.findOne({_id:id},{raw:true});
        const p=await legacyProposal(f),s=create(f.dependencies),preview=await s.certificationPreview(f.req,p);
        assert.equal(preview.physicalWrites.history.coordinatedRows.length,3);
        const result=await s.apply(f.req,approved(p,preview));assert.equal(result.selectedCaseStatus,'VERIFIED_RESOLVED');
        assert.deepEqual(await db.historyModel.collection.findOne({_id:id},{raw:true}),raw);
    });
    await t.test('Πραγματικό γεγονός μεταβολής διαλείμματος δεν αντικαθίσταται από αρχική πιστοποίηση',async()=>{
        const f=await seedLegacyStructure(db);await db.historyModel.collection.updateOne({_id:f.history[2]._id},{$set:{afora_allagh_dialleimatos:true,hmeromhnia_isxyos_dialleimatos_apo:new Date('2026-04-15')}});
        const p=await legacyProposal(f),before=await rawState(f);
        await assert.rejects(create(f.dependencies).certificationPreview(f.req,p),e=>e.reason==='LEGACY_BREAK_CHANGE_EVENT_CONFLICT');
        assert.deepEqual(await rawState(f),before);
    });
    await t.test('Πρόβλημα σε άλλη ιστορική εγγραφή εμποδίζει το συνολικό κλείσιμο',async()=>{
        const f=await seedLegacyStructure(db);await db.historyModel.collection.updateOne({_id:f.history[2]._id},{$unset:{nomimosMisthos:1}});
        const p=await legacyProposal(f),before=await rawState(f);
        await assert.rejects(create(f.dependencies).certificationPreview(f.req,p),e=>e.reason==='LEGACY_FULL_HISTORY_NOT_VERIFIED'&&e.problems[0].fieldId==='nomimosMisthos');
        assert.deepEqual(await rawState(f),before);
    });
    await t.test('Ταυτόχρονη μεταβολή άλλης συντονισμένης γραμμής δεν χάνεται μετά από ανάγνωση παλιάς έκδοσης',async()=>{
        const f=await seedLegacyStructure(db),p=await legacyProposal(f),preview=await create(f.dependencies).certificationPreview(f.req,p);
        const {deferred}=require('../fixtures/employeeProfileTransactionStore'),reached=deferred(),release=deferred();let once=true;
        const service=create({...f.dependencies,loadCatalogs:async()=>{if(once){once=false;reached.resolve();await release.promise;}return f.catalogs;}});
        const pending=service.apply(f.req,approved(p,preview));const outcome=pending.then(r=>({r}),e=>({e}));await reached.promise;
        await db.historyModel.collection.updateOne({_id:f.history[2]._id},{$set:{nomimosMisthos:1750,updatedAt:new Date()}});release.resolve();
        const result=await outcome;assert.equal(result.e?.reason,'STALE');
        assert.equal((await db.historyModel.collection.findOne({_id:f.history[2]._id})).nomimosMisthos,1750);
        assert.equal(await db.auditModel.collection.countDocuments({'employeeScope.employee_id':f.employee._id}),0);
        assert.equal(await db.periodControlModel.collection.countDocuments({company_kod:f.scope.company_kod}),0);
    });
    await t.test('Χωριστές υπογραφές, παρωχημένη προεπισκόπηση, rollback audit και επανάληψη',async()=>{
        const f=await seedLegacyStructure(db),p=await legacyProposal(f),s=create(f.dependencies),preview=await s.certificationPreview(f.req,p),before=await rawState(f);
        const body=approved(p,preview);delete body.certification;
        await assert.rejects(s.apply(f.req,body),e=>e.reason==='PROFILE_CERTIFICATION_REQUIRED');
        const forged=approved(structuredClone(p),preview);forged.proposal.legacyCertification.events[1].from='2026-05-01';
        await assert.rejects(s.apply(f.req,forged),e=>e.reason==='APPROVAL');
        const failed=create({...f.dependencies,auditModel:proxy(db.auditModel,{async create(){throw Error('synthetic audit failure');}})});
        await assert.rejects(failed.apply(f.req,approved(p,preview)),/synthetic audit failure/);assert.deepEqual(await rawState(f),before);
        await db.historyModel.collection.updateOne({_id:f.history[2]._id},{$set:{updatedAt:new Date()}});
        const stale=await rawState(f);await assert.rejects(s.apply(f.req,approved(p,preview)),e=>e.reason==='STALE');assert.deepEqual(await rawState(f),stale);
    });
});
