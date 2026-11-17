'use strict';
// Synthetic source documents only; never loads the application's connection.
const mongoose = require('mongoose');
const { seedApprovedProposal } = require('./employeeHistoryApprovedProposalMongo');
const X = require('../../server/services/ergazomenoi/employeeHistoryProposalXlsxService');
const E = require('../../server/services/ergazomenoi/employeeHistoryProposalEditorService');
const C = require('../../server/services/ergazomenoi/employeeHistoryAutomaticReconstructionContract');
const Legacy = require('../../server/services/ergazomenoi/employeeHistoryLegacyStructureCertificationService');
const date = value => new Date(value);
async function seedLegacyStructure(db) {
    const f = await seedApprovedProposal(db, { employeeCode: '0002' });
    // The documented ambiguity: physical order 0001,0002,0003 is NOT chronology.
    const starts = ['2026-02-02','2026-06-03','2026-04-01'];
    for (const [index,row] of f.history.entries()) {
        await db.historyModel.collection.updateOne({_id:row._id}, {$set:{
            [C.HIRE]:date(starts[0]), [C.CHANGE]:date(starts[index]),
            hmeromhnia_allaghs_orarioy_apo:date(starts[index]),
            hmeromhnia_allaghs_orarioy_eos:index===0?date('2026-02-08'):null,
            afora_proslhpsh:index<2, afora_allagh_dialleimatos:false,
            ypokatasthma:'0000', dialleima_se_lepta:30,
            employment_profile_schema_version:null,
        }, $unset:{[C.START]:1,[C.END]:1,hmeromhnia_isxyos_dialleimatos_apo:1}});
    }
    await db.employeeModel.collection.updateOne({_id:f.employee._id},{$set:{
        [C.HIRE]:date(starts[0]),[C.CHANGE]:date(starts[1]),[C.START]:date(starts[1]),
        ypokatasthma:'0000',dialleima_se_lepta:30,
    },$unset:{hmeromhnia_isxyos_dialleimatos_apo:1}});
    await db.companyModel.collection.updateOne({_id:new mongoose.Types.ObjectId(f.scope.company_kod)},{$set:{kod:'0003'}});
    await db.periodControlModel.collection.deleteMany({company_kod:f.scope.company_kod});
    const input=f.input; f.input=async()=>({...await input(),companyBusinessCode:'0003'});
    return f;
}
async function rowCompletion(f, row, values = {}) {
    const baseline=await X.buildEmployeeHistoryProposalWorkbook(await f.input(),f.catalogs,{selection:`UPDATE:${row._id}`});
    const model=E.editorModel(baseline,f.catalogs), controls=new Map(model.rows.filter(r=>r.control).map(r=>[r.control.index,r.control]));
    return {caseId:baseline.caseSelection.selectedCase.id,snapshotFingerprint:baseline.snapshotFingerprint,
        context:E.editorContext(f.req,baseline.snapshotFingerprint,baseline.caseSelection.selectedCase.id),
        changes:baseline.editableCells.flatMap((entry,index)=>{
            const key=entry.canonicalField||entry.role;
            if(!C.PROFILE_FIELDS.includes(key)&&!Object.hasOwn(values,key))return [];
            const raw=Object.hasOwn(values,key)?values[key]:controls.get(index).value;
            return [{index,value:raw==null||raw==='-1'?'':raw}];
        })};
}
async function legacyProposal(f,{scheduleOnly=false}={}) {
    if(scheduleOnly)await f.dependencies.employeeModel.collection.updateOne({_id:f.employee._id},{$set:{
        [C.CHANGE]:date('2026-04-01'),[C.START]:date('2026-04-01')}});
    const events=[];
    for(const [index,row] of f.history.entries()){
        const from=['2026-02-02','2026-06-03','2026-04-01'][index], technical=scheduleOnly&&index===1;
        events.push({historyId:String(row._id),kind:technical?'SCHEDULE_ONLY':index===0?'INITIAL_TERMS':'TERMS_CHANGE',
            from:technical?null:from,breakFrom:technical?null:from,breakConfirmed:!technical,
            evidence:`Συνθετικό πρωτότυπο ${index+1}: ${technical?'μόνο εβδομαδιαίο ωράριο':'όροι και αρχικά στοιχεία διαλείμματος από '+from}`,
            completion:index===0||technical?null:await rowCompletion(f,row)});
    }
    return {selection:`UPDATE:${f.history[0]._id}`,completion:await rowCompletion(f,f.history[0],{
        [C.START]:'2026-02-02',[C.END]:'2026-03-31',EVIDENCE:'Συνθετικό αρχείο Α1–Α3. Καμία νέα πρόσληψη.',DECLARATION:'1'}),
        legacyCertification:{version:Legacy.VERSION,confirmed:true,events}};
}
const approved=(proposal,preview)=>({proposal,approval:{token:preview.approval.token,confirmed:true},
    certification:{token:preview.certificationApproval.token,confirmed:true}});
module.exports={seedLegacyStructure,rowCompletion,legacyProposal,approved};

async function seedLegacyFrozen(f,{version='employment-period-frozen:v2',finalized=false,historyIndex=0,from='2026-02-01',to='2026-02-28'}={}) {
    const F=require('../../server/services/ergazomenoi/apasxoliseisPeriodFrozenSnapshotService');
    const {storedFrozenFingerprint}=require('../../server/services/ergazomenoi/employeeHistoryFrozenProvenanceContract');
    const scope={team:f.scope.team,company_kod:f.scope.company_kod,ypokatasthma:'0000',period_start:date(from),period_end:date(to)};
    const input=await f.input();
    const built=F.buildEmploymentPeriodFrozenSnapshot({scope,employees:[input.currentEmployee],profileHistory:[input.completeHistoryRows.find(r=>String(r._id)===String(f.history[historyIndex]._id))],
        dailyResults:[{kodikos:'0002',ypokatasthma:'0000',hmeromhnia:from==='2026-02-01'?'2026-02-05':from,
            ores_ergasias_apologistika:7.5,ores_pragmatikhs_ergasias_apologistika:7.5,
            effective_profile_istoriko_id:String(f.history[historyIndex]._id)}],
        payrollResults:[{kodikos:'0002',plhroteo:1234.56,synolo_apodoxon:1500}]});
    const snapshot={...built.snapshot,snapshot_schema_version:version};
    if(version==='employment-period-frozen:v1')delete snapshot.weekly_calculation_context;
    const id=new mongoose.Types.ObjectId(), fingerprint=storedFrozenFingerprint(snapshot);
    await f.dependencies.frozenModel.collection.insertOne({_id:id,...scope,snapshot_schema_version:version,
        source_calculation_version:snapshot.source_calculation_version,frozen_snapshot_fingerprint:fingerprint,frozen_snapshot:snapshot});
    if(finalized)await f.dependencies.periodControlModel.collection.insertOne({...scope,status:'FINALIZED',frozen_snapshot_id:id,frozen_snapshot_fingerprint:fingerprint});
    return {id,scope,snapshot,raw:()=>f.dependencies.frozenModel.collection.findOne({_id:id},{raw:true})};
}
module.exports.seedLegacyFrozen=seedLegacyFrozen;

async function rawState(f) {
    const d=f.dependencies,scope={team:f.scope.team,company_kod:f.scope.company_kod};
    const read=async(model,filter)=>Promise.all((await model.collection.find(filter).sort({_id:1}).toArray()).map(r=>model.collection.findOne({_id:r._id},{raw:true})));
    return {company:await d.companyModel.collection.findOne({_id:new mongoose.Types.ObjectId(f.scope.company_kod)},{raw:true}),
        history:await read(d.historyModel,f.scope),current:await d.employeeModel.collection.findOne({_id:f.employee._id},{raw:true}),
        controls:await read(d.periodControlModel,scope),frozen:await read(d.frozenModel,scope),
        audit:await read(d.auditModel,{'employeeScope.employee_id':f.employee._id})};
}
module.exports.rawState=rawState;
