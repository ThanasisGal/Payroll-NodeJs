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
const before={...scope,_id:'620000000000000000000001',hmeromhnia_proslhpshs:'2026-02-02',
    hmeromhnia_isxyos_oron_ergasias_apo:new Date('2026-02-02'),hmeromhnia_isxyos_oron_ergasias_eos:new Date('2026-06-02'),hmeres_ergasias_ebdomadas:5};
const prior={...before,_id:'620000000000000000000002',hmeromhnia_isxyos_oron_ergasias_apo:new Date('2026-06-03'),hmeromhnia_isxyos_oron_ergasias_eos:null};
const successor={...prior,_id:'620000000000000000000003',hmeromhnia_isxyos_oron_ergasias_apo:new Date('2026-11-23'),
    afora_allagh_oron_ergasias:true,hmeres_ergasias_ebdomadas:6};
const bctx={module:{exports:{}},require:p=>p.endsWith('ApplyContract')?A:C,Date};
vm.runInNewContext(fs.readFileSync(__dirname+'/employeeApprovedHistoryImmutableBoundaryService.js','utf8'),bctx);
const B=bctx.module.exports;
const boundary=B.receipt({scope,currentEmployee:employee,prior,successor,effectiveFrom:'2026-11-23'});
const atomic={mutationSource:B.OPERATION,employeeScope:{...scope,employee_id:employee._id},
    diagnostics:{version:B.WRITER_VERSION,outcome:'COMMITTED',operation:'NEW_CHANGE',actorUserId:'test',
        fromHistoryId:prior._id,insertedHistoryId:successor._id,effectiveFrom:'2026-11-23',boundary},
    historyBefore:[structuredClone(prior)],historyAfter:[structuredClone(prior),structuredClone(successor)]};
const priorApproval={_id:'approved-before',diagnostics:{rowApproval:{approvedContent:before}}};
const pctx={module:{exports:{}},require:p=>p.endsWith('OperationalReadService')?
    {boundDecision:(audit,row)=>audit===priorApproval&&row._id===before._id}:B,Date};
vm.runInNewContext(fs.readFileSync(__dirname+'/employeeHistoryProposalReadService.js','utf8'),pctx);
const read=pctx.module.exports.proposalHistoryState;
const input=(atomicAudits=[atomic])=>({scope,currentEmployee:employee,completeHistoryRows:[before,prior,successor],
    approvedHistoryDecisions:[priorApproval],atomicBoundaryAudits:atomicAudits});
test('approved older corrections stay approved, without any second approval request',()=>{
    const result=read(input());
    assert.equal(result.decisions.length,1);
    assert.equal(result.decisions[0],priorApproval);
    assert.equal(result.historyRows[0].hmeres_ergasias_ebdomadas,5);
    assert.equal(result.historyRows[1][C.END].toISOString().slice(0,10),'2026-11-22');
    assert.equal(prior[C.END],null);
    assert.equal(result.atomicSuccessors.length,1);
});
test('no verified boundary means no invented physical or virtual history date',()=>{
    const result=read(input([]));
    assert.equal(result.historyRows[1][C.END],null);
    assert.equal(result.atomicBoundaries.length,0);
});
test('independently approved edition and atomic boundary are separate provenance',()=>{
    const result=read(input());
    assert.equal(result.atomicBoundaries.length,1);
    assert.equal(result.decisions.length,1);
    assert.equal(result.historyRows.length,3);
});


test('proposal history can preserve a verified approved latest edition AND signed close',()=>{
    const approvedPrior={...prior,reviewed:'approved'};
    const latestApproval={_id:'650000000000000000000001',diagnostics:{targetHistoryId:prior._id,
        rowApproval:{approvedContent:approvedPrior,approvedContentHash:A.hash(approvedPrior)}}};
    const signed=B.receipt({scope,currentEmployee:employee,prior,businessPrior:approvedPrior,
        approvedEdition:{approvalAuditId:latestApproval._id,
            approvedContentHash:latestApproval.diagnostics.rowApproval.approvedContentHash,
            editionFingerprint:B.fingerprint(approvedPrior)},
        successor,effectiveFrom:'2026-11-23'});
    const a=structuredClone(atomic);a.diagnostics.boundary=signed;
    const temp={module:{exports:{}},Date,require:path=>path.endsWith('OperationalReadService') ?
        {boundDecision:(audit,row)=> audit===latestApproval && row._id===prior._id} : B};
    vm.runInNewContext(fs.readFileSync(__dirname+'/employeeHistoryProposalReadService.js','utf8'),temp);
    const input={scope,currentEmployee:employee,completeHistoryRows:[prior,successor],
        approvedHistoryDecisions:[latestApproval],atomicBoundaryAudits:[a]};
    const result=temp.module.exports.proposalHistoryState(input);
    assert.equal(result.decisions.length,1);
    assert.equal(result.historyRows[0].reviewed,'approved');
    assert.equal(result.historyRows[0][C.END].toISOString().slice(0,10),'2026-11-22');
    assert.equal(prior[C.END],null);
});
