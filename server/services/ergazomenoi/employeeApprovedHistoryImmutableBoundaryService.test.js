'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const vm=require('node:vm');
const fs=require('node:fs');
const serial=x=>JSON.stringify(x,(_key,value)=> value && value._bsontype==='ObjectId'?String(value):value);
const A={hash:x=>crypto.createHash('sha256').update(serial(x)).digest('hex'),equal:(x,y)=>serial(x)===serial(y)};
const C={HIRE:'hmeromhnia_proslhpshs',START:'hmeromhnia_isxyos_oron_ergasias_apo',END:'hmeromhnia_isxyos_oron_ergasias_eos'};
const src=fs.readFileSync(__dirname+'/employeeApprovedHistoryImmutableBoundaryService.js','utf8');
const context={module:{exports:{}},require:p=>p.endsWith('ApplyContract')?A:C,Date,Error,Object,String,Map,Set,Array};
vm.runInNewContext(src,context,{filename:'employeeApprovedHistoryImmutableBoundaryService.js'});
const B=context.module.exports;
const scope={team:'THA',company_kod:'610000000000000000000001',kodikos:'0002'};
const employee={...scope,_id:'620000000000000000000900',hmeromhnia_proslhpshs:'2026-02-02'};
const prior={...scope,_id:'620000000000000000000002',hmeromhnia_proslhpshs:'2026-02-02',
    hmeromhnia_isxyos_oron_ergasias_apo:new Date('2026-06-03'),hmeromhnia_isxyos_oron_ergasias_eos:null,hmeres_ergasias_ebdomadas:5};
const successor={...prior,_id:'620000000000000000000003',hmeromhnia_isxyos_oron_ergasias_apo:new Date('2026-11-23'),
    afora_allagh_oron_ergasias:true,hmeres_ergasias_ebdomadas:6};
const receipt = () => B.receipt({scope,currentEmployee:employee,prior,successor,effectiveFrom:'2026-11-23'});
const audit = () => ({mutationSource:B.OPERATION,employeeScope:{...scope,employee_id:employee._id},
    diagnostics:{version:B.WRITER_VERSION,outcome:'COMMITTED', operation:'NEW_CHANGE',actorUserId:'synthetic-actor',
        fromHistoryId:prior._id, insertedHistoryId:successor._id,effectiveFrom:'2026-11-23',boundary:receipt()},
    historyBefore:[structuredClone(prior)],historyAfter:[structuredClone(prior),structuredClone(successor)]});
const project = (a=[audit()], physical=[prior,successor], effective=physical) =>
    B.project({scope,currentEmployee:employee,physicalRows:physical,historyRows:effective,atomicAudits:a});

test('new genuine 5-to-6: old PHYSICAL row remains unchanged; verified logical close only',()=>{
    const snapshot=structuredClone(prior);
    const output=project();
    assert.deepEqual(prior,snapshot);
    assert.equal(prior[C.END],null);
    assert.equal(output.historyRows[0][C.END].toISOString().slice(0,10),'2026-11-22');
    assert.equal(output.historyRows[1][C.END],null);
    assert.equal(output.boundaries.length,1);
    assert.deepEqual([...output.successors],[successor._id]);
});
test('older physical fingerprints exclude only private reference-fence metadata',()=>{
    const copy=structuredClone(prior);copy.history_reference_fence=100;
    assert.equal(project([audit()],[copy,successor]).boundaries.length,1);
    assert.equal(copy[C.END],null);
});
test('same-period correction of the new row retains original effective date and one new event',()=>{
    const corrected=structuredClone(successor);corrected.hmeres_ergasias_ebdomadas=5;
    const p=project([audit()],[prior,corrected]);
    assert.equal(p.boundaries.length,1);
    assert.equal(p.historyRows.length,2);
    assert.equal(p.historyRows[1].hmeres_ergasias_ebdomadas,5);
    assert.equal(p.historyRows[1][C.START].toISOString().slice(0,10),'2026-11-23');
});
test('second genuine change can close the previously corrected latest period, never its original physical row',()=>{
    const corrected={...successor,hmeres_ergasias_ebdomadas:5};
    const third={...corrected,_id:'620000000000000000000004',hmeres_ergasias_ebdomadas:6,
        [C.START]:new Date('2026-12-01')};
    const b2=B.receipt({scope,currentEmployee:employee,prior:corrected,successor:third,effectiveFrom:'2026-12-01'});
    const a2={...audit(),diagnostics:{...audit().diagnostics,fromHistoryId:corrected._id,
        insertedHistoryId:third._id,effectiveFrom:'2026-12-01',boundary:b2},
        historyBefore:[structuredClone(corrected)],historyAfter:[structuredClone(corrected),structuredClone(third)]};
    const projected=project([audit(),a2],[prior,corrected,third]);
    assert.equal(projected.boundaries.length,2);
    assert.equal(projected.historyRows[1][C.END].toISOString().slice(0,10),'2026-11-30');
    assert.equal(corrected[C.END],null);
});
test('unsigned, not committed or fake previous approvals are never accepted',()=>{
    for(const mutation of [a=>{a.diagnostics.outcome='PENDING';},a=>{delete a.diagnostics.boundary;},
        a=>{a.diagnostics.boundary.version='APPROVED_RESOLVED';}]){
        const a=structuredClone(audit());mutation(a);
        assert.throws(()=>project([a]),/EMPLOYEE_APPROVED_ATOMIC_BOUNDARY/);
    }
});
test('no spoofed or altered source or successor can manufacture a valid boundary',()=>{
    for(const mutation of [a=>{a.diagnostics.boundary.priorFingerprint='tampered';},
        a=>{a.historyAfter[0].hmeres_ergasias_ebdomadas=7;},
        a=>{a.historyAfter[1][C.START]='2026-11-24';},
        a=>{a.employeeScope.company_kod='another';},
        a=>{a.diagnostics.insertedHistoryId='620000000000000000000999';}]){
        const a=structuredClone(audit());mutation(a);
        assert.throws(()=>project([a]),/EMPLOYEE_APPROVED_ATOMIC_BOUNDARY/);
    }
    const altered={...prior,hmeres_ergasias_ebdomadas:7};
    assert.throws(()=>project([audit()],[altered,successor]),/BOUNDARY/);
});
test('no missing successor or duplicate boundary can be silently ignored',()=>{
    assert.throws(()=>project([audit()],[prior]),/BOUNDARY/);
    assert.throws(()=>project([audit(),audit()]),/BOUNDARY/);
});
test('an approved edition of the source cannot be overwritten by a logical closure',()=>{
    const approved={...prior,hmeres_ergasias_ebdomadas:7};
    assert.throws(()=>project([audit()],[prior,successor],[approved,successor]),/BOUNDARY/);
});
test('without an atomic receipt there is no virtual closure and no false CLEAN',()=>{
    assert.equal(project([]).boundaries.length,0);
    assert.equal(project([]).historyRows[0][C.END],null);
});
test('snapshot-based audit is a read-only record: no write-side fields are invented',()=>{
    assert.deepEqual(Object.keys(receipt()).sort(),[
        'version','priorHistoryId','successorHistoryId','effectiveFrom','priorEffectiveTo',
        'priorFingerprint','successorIdentityFingerprint'].sort());
    assert.equal(receipt().priorEffectiveTo,'2026-11-22');
});


// PR406 final review: a physically immutable predecessor may also have an
// independently VERIFIED business edition. Neither provenance can be forged.
test('signed NEW_CHANGE can logically close a VERIFIED approved last edition without rewriting it',()=>{
    const physical=structuredClone(prior), business={...prior,
        // The separately approved correction may have repaired work terms.
        hmeres_ergasias_ebdomadas:5, recordedLegacyCorrection:'APPROVED'};
    const decision={_id:'640000000000000000000001',
        diagnostics:{targetHistoryId:prior._id,rowApproval:{
            approvedContent:business,approvedContentHash:A.hash(business)}}};
    const proof={approvalAuditId:decision._id,approvedContentHash:decision.diagnostics.rowApproval.approvedContentHash,
        editionFingerprint:B.fingerprint(business)};
    const b=B.receipt({scope,currentEmployee:employee,prior,
        businessPrior:business,approvedEdition:proof,successor,effectiveFrom:'2026-11-23'});
    const committed=audit();committed.diagnostics.boundary=b;
    const args={scope,currentEmployee:employee,physicalRows:[prior,successor],
        historyRows:[business,successor],atomicAudits:[committed],verifiedApprovals:[decision]};
    const result=B.project(args);
    assert.equal(result.historyRows[0].recordedLegacyCorrection,'APPROVED');
    assert.equal(result.historyRows[0][C.END].toISOString().slice(0,10),'2026-11-22');
    assert.deepEqual(prior,physical);assert.equal(prior[C.END],null);
    assert.equal(result.boundaries.length,1);
    // Removing, changing or replacing the old independently verified approval
    // must NOT leave behind an accepted logical boundary.
    const corrupted=structuredClone(committed);
    corrupted.diagnostics.boundary.approvedEdition.editionFingerprint='wrong';
    for(const damaged of [
        {...args,verifiedApprovals:[]},
        {...args,verifiedApprovals:[{...decision,_id:'640000000000000000000002'}]},
        {...args,historyRows:[{...business,recordedLegacyCorrection:'FORGED'},successor]},
        {...args,atomicAudits:[corrupted]}
    ]) assert.throws(()=>B.project(damaged),/EMPLOYEE_APPROVED_ATOMIC_BOUNDARY/);
});

test('approved prior with a finite old physical end uses verified OPEN business edition only',()=>{
    const finite={...prior,[C.END]:new Date('2026-10-01')};
    const business={...finite,[C.END]:null,verifiedDateCorrection:true};
    const decision={_id:'640000000000000000000011',diagnostics:{targetHistoryId:prior._id,
        rowApproval:{approvedContent:business,approvedContentHash:A.hash(business)}}};
    const proof={approvalAuditId:decision._id,approvedContentHash:decision.diagnostics.rowApproval.approvedContentHash,
        editionFingerprint:B.fingerprint(business)};
    const b=B.receipt({scope,currentEmployee:employee,prior:finite,businessPrior:business,
        approvedEdition:proof,successor,effectiveFrom:'2026-11-23'});
    const committed=audit();committed.diagnostics.boundary=b;
    committed.historyBefore=[structuredClone(finite)];
    committed.historyAfter=[structuredClone(finite),structuredClone(successor)];
    const effective=B.project({scope,currentEmployee:employee,physicalRows:[finite,successor],
        historyRows:[business,successor],atomicAudits:[committed],verifiedApprovals:[decision]});
    assert.equal(effective.historyRows[0][C.END].toISOString().slice(0,10),'2026-11-22');
    assert.equal(finite[C.END].toISOString().slice(0,10),'2026-10-01');
    assert.throws(()=>B.receipt({scope,currentEmployee:employee,prior:finite,
        successor,effectiveFrom:'2026-11-23'}),/RECEIPT/);
    const closed={...business,[C.END]:new Date('2026-11-01')};
    assert.throws(()=>B.receipt({scope,currentEmployee:employee,prior:finite,businessPrior:closed,
        approvedEdition:proof,successor,effectiveFrom:'2026-11-23'}),/APPROVED_PROOF|RECEIPT/);
});
