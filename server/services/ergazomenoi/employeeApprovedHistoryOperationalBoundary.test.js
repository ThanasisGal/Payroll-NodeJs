'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const crypto=require('node:crypto');
const A={hash:x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex'),
    equal:(x,y)=>JSON.stringify(x)===JSON.stringify(y)};
const C={HIRE:'hmeromhnia_proslhpshs',START:'hmeromhnia_isxyos_oron_ergasias_apo',END:'hmeromhnia_isxyos_oron_ergasias_eos'};
const scope={team:'THA',company_kod:'610000000000000000000001',kodikos:'0002'};
const employee={...scope,_id:'620000000000000000000900',hmeromhnia_proslhpshs:'2026-02-02'};
const prior={...scope,_id:'620000000000000000000002',hmeromhnia_proslhpshs:'2026-02-02',
    hmeromhnia_isxyos_oron_ergasias_apo:new Date('2026-06-03'),hmeromhnia_isxyos_oron_ergasias_eos:null,hmeres_ergasias_ebdomadas:5};
const successor={...prior,_id:'620000000000000000000003',hmeromhnia_isxyos_oron_ergasias_apo:new Date('2026-11-23'),
    afora_allagh_oron_ergasias:true,hmeres_ergasias_ebdomadas:6};
const bctx={module:{exports:{}},require:p=>p.endsWith('ApplyContract')?A:C,Date};
vm.runInNewContext(fs.readFileSync(__dirname+'/employeeApprovedHistoryImmutableBoundaryService.js','utf8'),bctx);
const B=bctx.module.exports;
const boundary=B.receipt({scope,currentEmployee:employee,prior,successor,effectiveFrom:'2026-11-23'});
const audited=()=>({mutationSource:B.OPERATION,employeeScope:{...scope,employee_id:employee._id},
    diagnostics:{version:B.WRITER_VERSION,outcome:'COMMITTED',operation:'NEW_CHANGE',actorUserId:'synthetic',
        fromHistoryId:prior._id,insertedHistoryId:successor._id,effectiveFrom:'2026-11-23',boundary},
    historyBefore:[structuredClone(prior)],historyAfter:[structuredClone(prior),structuredClone(successor)]});
class Query {}
const mongoose={Query, trusted:x=>x};
const stubs={
    mongoose,'./employeeHistoryAutomaticReconstructionApplyContract':A,
    './employeeHistoryApprovedProposalContract':{OPERATION:'EMPLOYEE_HISTORY_APPROVED_PROPOSAL',VERSION:'approved:v1',permittedFields:[]},
    './employeeHistoryRowApprovalService':{VERSION:'row:v1',STATUS:'APPROVED_RESOLVED',blank:()=>false,verify:()=>{}},
    './employeeApprovedHistoryImmutableBoundaryService':B,
    '../../utils/ergazomenoi/employmentHistoryCanonicalStatus':{isInactiveHistoryRow:()=>false},
    '../../utils/ergazomenoi/employmentProfileHistory':{effectiveStart:r=>new Date(r[C.START]),effectiveEnd:r=>r[C.END]&&new Date(r[C.END])},
    '../../models/employeeHistoryRepairAudit':{collection:{name:'RepairAudits'}},
    '../../models/ergazomenoi':{ErgazomenoiModel:{collection:{name:'Employees'}}}
};
const opctx={module:{exports:{}},require:p=>{if(!(p in stubs))throw Error('Unexpected require '+p);return stubs[p];},Date,Set,Map,WeakMap,Array};
vm.runInNewContext(fs.readFileSync(__dirname+'/employeeHistoryOperationalReadService.js','utf8'),opctx,
    {filename:'employeeHistoryOperationalReadService.js'});
const service=opctx.module.exports;
function harness({history=[prior,successor],audits=[audited()]}={}) {
    const requests=[];
    const connection={collection:name=>name==='RepairAudits'?{
        find(filter){requests.push({name,filter});assert.ok(filter.$and,'scoped AND is mandatory');
            assert.ok(filter.$and[0].$or.some(branch=>branch['employeeScope.kodikos']===scope.kodikos));
            return {project(){return this},sort(){return this},async toArray(){return audits}};}
    }:name==='Employees'?{find(filter,{projection}){
        assert.equal(projection.hmeromhnia_proslhpshs,1);
        return {async toArray(){return [employee]}};
    }}:name==='History' ? {aggregate(pipeline){
        const branches=pipeline.find(step=>step.$replaceWith).$replaceWith.$switch.branches;
        return {async toArray(){return history.map(row=>{
            const entry=branches.find(branch=>A.equal(branch.case.$eq[1].$literal,row));
            return structuredClone(entry?entry.then.$literal:row);
        });}};
    }}: {}};
    class HistoryQuery extends Query {
        constructor(){super();this.op='find';this.model={db:connection,collection:{name:'History'},
            schema:{eachPath(){}},find:f=>({select(){return this},session(){return this},
                async lean(){return history.filter(row=>f._id.$in.includes(String(row._id)))}})};}
        getFilter(){return scope}
        getOptions(){return {}}
        mongooseOptions(){return {lean:true}}
        projection(){return {}}
        cast(){return scope}
        then(resolve,reject){return Promise.resolve(structuredClone(history)).then(resolve,reject)}
    }
    return {query:new HistoryQuery(),requests};
}
test('operational history reads verified logical close without changing physical row',async()=>{
    const h=harness();const rows=await service.readOperationalHistory(h.query);
    assert.equal(h.requests.length,1);
    assert.equal(prior[C.END],null);
    assert.equal(rows.length,2);
    assert.equal(rows[0][C.END].toISOString().slice(0,10),'2026-11-22');
    assert.equal(rows[1][C.END],null);
    const slices=service.operationalHistorySlices(rows,new Date('2026-11-23'),new Date('2026-12-01'));
    assert.ok(slices.every(slice=>slice.history[0][C.END]));
});
test('opt-out still returns physical snapshots for protected material',async()=>{
    const {query,requests}=harness();const rows=await service.readOperationalHistory(query,{useCorrections:false});
    assert.equal(rows[0][C.END],null);
    assert.equal(requests.length,0);
});
test('tampered physical predecessor fails closed rather than publishing a guessed timeline',async()=>{
    const changed={...prior,hmeres_ergasias_ebdomadas:7};
    await assert.rejects(service.readOperationalHistory(harness({history:[changed,successor]}).query),
        /EMPLOYEE_APPROVED_ATOMIC_BOUNDARY/);
});
test('tampered audit receipt fails closed instead of turning old physical rows into CLEAN',async()=>{
    const bad=structuredClone(audited());bad.diagnostics.boundary.effectiveFrom='2026-11-24';
    await assert.rejects(service.readOperationalHistory(harness({audits:[bad]}).query),
        /EMPLOYEE_APPROVED_ATOMIC_BOUNDARY/);
});
test('a NEW_CHANGE audit without its immutable proof cannot be silently ignored',async()=>{
    const bad=audited();delete bad.diagnostics.boundary;
    await assert.rejects(service.readOperationalHistory(harness({audits:[bad]}).query),
        /EMPLOYEE_APPROVED_ATOMIC_BOUNDARY/);
});

test('operational reader preserves independently VERIFIED latest approval and logical period end',async()=>{
    const approved={...prior,recordedLegacyCorrection:'APPROVED',
        hmeres_ergasias_ebdomadas:5};
    const P=stubs['./employeeHistoryApprovedProposalContract'];
    const R=stubs['./employeeHistoryRowApprovalService'];
    const trustedApproval={_id:'640000000000000000000001',mutationSource:P.OPERATION,
        employeeScope:{...scope,employee_id:employee._id},diagnostics:{
            version:P.VERSION,operation:'UPDATE',outcome:'COMMITTED',actorUserId:'ACTOR',
            binding:{actorUserId:'ACTOR',employeeId:employee._id,scope},
            targetHistoryId:prior._id,declaration:'Ναι',explicitChanges:{},actualAfter:prior,
            rowApproval:{version:R.VERSION,status:R.STATUS,mode:'CORRECTION_EDITION',
                approvedContent:approved,approvedContentHash:A.hash(approved),
                verification:{version:R.VERSION,verifiedAt:new Date('2026-11-21')}}
        }};
    const proof={approvalAuditId:trustedApproval._id,
        approvedContentHash:trustedApproval.diagnostics.rowApproval.approvedContentHash,
        editionFingerprint:B.fingerprint(approved)};
    const atomic=audited();atomic.diagnostics.boundary=B.receipt({scope,currentEmployee:employee,
        prior,businessPrior:approved,approvedEdition:proof,successor,effectiveFrom:'2026-11-23'});
    const original=structuredClone(prior);
    const h=harness({audits:[trustedApproval,atomic]});
    const rows=await service.readOperationalHistory(h.query);
    assert.equal(rows[0].recordedLegacyCorrection,'APPROVED');
    assert.equal(rows[0][C.END].toISOString().slice(0,10),'2026-11-22');
    assert.deepEqual(prior,original);
    const revoked=structuredClone(trustedApproval);revoked.diagnostics.rowApproval.verification.verifiedAt=null;
    await assert.rejects(service.readOperationalHistory(harness({audits:[revoked,atomic]}).query),
        /EMPLOYEE_APPROVED_ATOMIC_BOUNDARY/);
});

test('APPROVAL_ONLY on the predecessor is still mandatory receipt provenance',async()=>{
    const P=stubs['./employeeHistoryApprovedProposalContract'];
    const R=stubs['./employeeHistoryRowApprovalService'];
    const priorApproval={_id:'640000000000000000000011',mutationSource:P.OPERATION,
        employeeScope:{...scope,employee_id:employee._id},diagnostics:{
            version:P.VERSION,operation:'UPDATE',outcome:'COMMITTED',actorUserId:'ACTOR',
            binding:{actorUserId:'ACTOR',employeeId:employee._id,scope},
            targetHistoryId:prior._id,declaration:'Ναι',explicitChanges:{},actualAfter:prior,
            rowApproval:{version:R.VERSION,status:R.STATUS,mode:'APPROVAL_ONLY',
                hasCorrectionEdition:false,approvedContent:prior,approvedContentHash:A.hash(prior),
                verification:{version:R.VERSION,verifiedAt:new Date('2026-11-21')}}
        }};
    const boundary=B.receipt({scope,currentEmployee:employee,prior,businessPrior:prior,
        approvedEdition:{approvalAuditId:priorApproval._id,
            approvedContentHash:priorApproval.diagnostics.rowApproval.approvedContentHash,
            editionFingerprint:B.fingerprint(prior)},
        successor,effectiveFrom:'2026-11-23'});
    const atomic=audited();atomic.diagnostics.boundary=boundary;
    const rows=await service.readOperationalHistory(harness({audits:[priorApproval,atomic]}).query);
    assert.equal(rows[0][C.END].toISOString().slice(0,10),'2026-11-22');
});
