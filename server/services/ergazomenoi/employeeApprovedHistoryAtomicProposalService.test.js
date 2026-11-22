'use strict';
const { test, before, after, mock } = require('node:test');
const assert = require('node:assert/strict');
const F = require('../../../test/fixtures/employeeHistoryResolvedProposal');
const A = require('./employeeHistoryAutomaticReconstructionApplyContract');
const C = require('./employeeHistoryAutomaticReconstructionContract');
const { prepareApprovedHistoryAtomicProposal: prepare } = require('./employeeApprovedHistoryAtomicProposalService');
const T6 = Object.freeze({hmeres_ergasias_ebdomadas: 6, typos_ebdomadas:'6HMERH',
    ores_ergasias_ebdomadas: 40, mo_oron_hmerhsias_ergasias: 6.67});
const T5 = Object.freeze({hmeres_ergasias_ebdomadas: 5, typos_ebdomadas:'5HMERH',
    ores_ergasias_ebdomadas: 40, mo_oron_hmerhsias_ergasias: 8});
const fixture = () => {
    const input = F.resolvedProposalFixture({independent: false});
    F.approveSyntheticEdition(input);
    return input;
};
const newVersion = (extra = {}) => ({kind: 'NEW_CHANGE', effectiveFrom:'2026-11-23', correctedTerms:T6, ...extra});
const correction = (data, extra = {}) => ({kind:'CORRECT_SAVED_ERROR',
    targetHistoryId:String(data.completeHistoryRows.at(-1)._id), effectiveFrom:'2026-06-03',
    correctedTerms:T5, ...extra});
const mistaken = () => {
    const data=fixture(), last=data.completeHistoryRows.at(-1);
    for(const target of [data.currentEmployee, last]) Object.assign(target,T6);
    return data;
};
before(() => require('../../../test/fixtures/forbidRealSettlementMongo').forbidRealSettlementMongo(mock));
after(() => mock.restoreAll());

test('5->6: one unpersisted new event, old physical row IDs untouched', () => {
    const data=fixture(), before=A.stringify(data), r=prepare(data,newVersion());
    assert.equal(r.status,'ATOMIC_NEW_VERSION_PREPARED_READ_ONLY',JSON.stringify(r));
    assert.equal(r.executionEnabled,false);
    assert.equal(r.currentEmployeePatch.hmeres_ergasias_ebdomadas,6);
    assert.equal(r.historyInsertDraft[C.START].toISOString().slice(0,10),'2026-11-23');
    assert.equal(r.historyInsertDraft[C.END],null);
    assert.equal(r.historyInsertDraft.afora_proslhpsh,false);
    assert.equal(r.historyInsertDraft.afora_allagh_oron_ergasias,true);
    assert.equal(Object.hasOwn(r.historyInsertDraft,'hmeromhnia_allaghs_orarioy_apo'),false);
    assert.equal(Object.hasOwn(r.historyInsertDraft,'hmeromhnia_allaghs_orarioy_eos'),false);
    for(const field of ['_id','aa_eggrafhs','history_reference_fence','updatedAt','createdAt'])
        assert.equal(Object.hasOwn(r.historyInsertDraft,field),false,field);
    assert.deepEqual(r.physicalHistoryRowsToUpdate,[]);
    assert.deepEqual(r.physicalHistoryRowsToDelete,[]);
    assert.deepEqual(r.originalHistoryRowIds,data.completeHistoryRows.map(x=>String(x._id)));
    assert.equal(A.stringify(data),before);
});
test('5->6: protected older history remains 100% physically unchanged', () => {
    const data=fixture(), before=A.stringify(data.protectedReferenceSummary);
    const r=prepare(data,newVersion());
    assert.equal(r.status,'ATOMIC_NEW_VERSION_PREPARED_READ_ONLY');
    assert.equal(r.protectedOriginalReferencesMustRemainIdentical,true);
    assert.equal(A.stringify(data.protectedReferenceSummary),before);
});
test('no fake 6->5 later period for mistaken 6-day saved entry',()=>{
    const data=mistaken(), before=A.stringify(data), r=prepare(data,correction(data));
    assert.equal(r.status,'EXISTING_ERROR_CORRECTION_PREPARED_READ_ONLY',JSON.stringify(r));
    assert.equal(r.noInventedSecondPeriod,true);
    assert.equal(r.effectiveFrom,'2026-06-03');
    assert.deepEqual(r.physicalHistoryRowsToInsert,[]);
    assert.deepEqual(r.physicalHistoryRowsToDelete,[]);
    assert.equal(r.currentEmployeePatch.hmeres_ergasias_ebdomadas,5);
    assert.equal(A.stringify(data),before);
});
test('frozen erroneous row may only be an immutable approved correction edition',()=>{
    const data=mistaken(), id=String(data.completeHistoryRows.at(-1)._id);
    data.protectedReferenceSummary[id]=[{collection:'Apasxoliseis_Period_Frozen_Snapshots',documentId:'frozen-synthetic'}];
    const r=prepare(data,correction(data));
    assert.equal(r.status,'EXISTING_ERROR_CORRECTION_PREPARED_READ_ONLY');
    assert.equal(r.mode,'AUDITED_IMMUTABLE_CORRECTION_EDITION');
    assert.deepEqual(r.physicalHistoryRowsToUpdate,[]);
});
test('a referenced old approved row is never added to physical update/delete sets',()=>{
    const data=fixture(), first=data.completeHistoryRows[0]._id;
    const r=prepare(data,newVersion());
    assert.equal(r.status,'ATOMIC_NEW_VERSION_PREPARED_READ_ONLY');
    assert.ok(data.protectedReferenceSummary[String(first)].length>0);
    assert.deepEqual(r.physicalHistoryRowsToUpdate,[]);
});
test('prior approved history is not magically CLEAN, no write permission granted',()=>{
    const data=fixture(), r=prepare(data,newVersion());
    assert.equal(r.executionEnabled,false);
    assert.equal(r.employeeWritten,false);
    assert.equal(r.historyWritten,false);
    assert.equal(r.auditWritten,false);
    assert.equal(r.signedConfirmationRequired,true);
    assert.equal(r.fullValidationAndAuditRequiredBeforeCommit,true);
});
test('missing target reference metadata fails closed',()=>{
    const data=fixture();delete data.protectedReferenceSummary[String(data.completeHistoryRows.at(-1)._id)];
    assert.equal(prepare(data,newVersion()).status,'TARGET_REFERENCE_PROOF_REQUIRED');
});
test('replayed pending change cannot produce a new draft',()=>{
    const data=fixture();data.currentEmployee.employee_pending_history={id:'pending'};
    assert.equal(prepare(data,newVersion()).status,'FIRST_CHANGE_STILL_PENDING');
});
test('revoked or tampered approval never produces new draft',()=>{
    const data=fixture();data.approvedHistoryDecisions[0].diagnostics.rowApproval.verification.verifiedAt=null;
    assert.equal(prepare(data,newVersion()).status,'NO_VERIFIED_PRIOR_APPROVAL');
});
test('earlier finite terminal end cannot be silently stretched into new date',()=>{
    const data=fixture();data.completeHistoryRows.at(-1)[C.END]=new Date('2026-11-01');
    const r=prepare(data,newVersion());
    assert.notEqual(r.status,'ATOMIC_NEW_VERSION_PREPARED_READ_ONLY');
});
test('no explicit actual new event or consistent work terms means no draft',()=>{
    const data=fixture();
    assert.equal(prepare(data,newVersion({correctedTerms:T5})).status,'NO_CHANGE');
    assert.equal(prepare(data,newVersion({correctedTerms:{...T6,typos_ebdomadas:'5HMERH'}})).status,
        'COMPLETE_COHERENT_WORK_TERMS_REQUIRED');
});
test('correction cannot silently substitute a later effective date',()=>{
    const data=mistaken();
    assert.equal(prepare(data,correction(data,{effectiveFrom:'2026-11-24'})).status,
        'CORRECTION_MUST_KEEP_ORIGINAL_EFFECTIVE_DATE');
});
test('absence of verified prior approval blocks correction as well as insertion',()=>{
    const data=mistaken();data.approvedHistoryDecisions=[];
    assert.equal(prepare(data,correction(data)).status,'NO_VERIFIED_PRIOR_APPROVAL');
});
