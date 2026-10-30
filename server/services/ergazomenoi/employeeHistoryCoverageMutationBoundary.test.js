'use strict';
const { test, before, after, mock } = require('node:test');
const assert = require('node:assert/strict');
const { forbidRealSettlementMongo } = require('../../../test/fixtures/forbidRealSettlementMongo');
const { assertRecordedValidityBoundaries } = require('./employeeHistoryAutomaticReconstructionSaveContract');
const { planWithdrawalPeriodCorrections } = require('./employeeHistoryUserConfirmedCorrectionPlannerService');
const { employeeHistoryCoverageGaps, assertVerifiedHistoryCoverageForDate } = require('../../utils/ergazomenoi/employmentHistoryCoverage');
const { canonicalizeEmployeeHistory } = require('./employeeHistoryCanonicalizationService');
const F = require('./fixtures/unifiedEmployeeHistorySettlementFixtures');
const C = require('./employeeHistoryAutomaticReconstructionContract');
before(() => forbidRealSettlementMongo(mock));
after(() => mock.restoreAll());
const date = value => value == null ? null : new Date(value).toISOString().slice(0,10);
function input() {
    return F.input([F.period(1,{[C.CONTRACT_END]:'2026-12-31'})]);
}
function unsupportedPlan(data) {
    return { rowDiffs:[{historyId:data.completeHistoryRows[0]._id,field:C.END,
        sourceField:C.CONTRACT_END,after:new Date('2026-12-31')}],
    proposedRows:data.completeHistoryRows.map(row=>({...row,[C.END]:new Date('2026-12-31')})) };
}
const blockedValidity = work => assert.throws(work,error=>error.code==='EMPLOYEE_HISTORY_MANUAL_REVIEW_REQUIRED'&&
    error.validityReason==='CONTRACT_END_IS_NOT_RECORDED_TERMS_VALIDITY'&&
    date(error.unsupportedValidityBoundaries[0].until)==='2026-12-31');

test('covered existing History does not authorize copying expiry into previously open work-terms validity',()=>{
    const data=input(),before=structuredClone(data),plan=unsupportedPlan(data);
    assert.deepEqual(employeeHistoryCoverageGaps({currentEmployee:data.currentEmployee,historyRows:data.completeHistoryRows}),[]);
    assert.equal(canonicalizeEmployeeHistory({scope:data.scope,currentEmployee:data.currentEmployee,historyRows:data.completeHistoryRows}).status,'CLEAN');
    blockedValidity(()=>assertRecordedValidityBoundaries({plan,currentEmployee:data.currentEmployee,historyRows:data.completeHistoryRows}));
    assert.deepEqual(data,before);
});

test('an independently recorded validity endpoint supports the composite plan without creating a departure',()=>{
    const data=input(),plan=unsupportedPlan(data);data.currentEmployee[C.END]='2026-12-31';
    assertRecordedValidityBoundaries({plan,currentEmployee:data.currentEmployee,historyRows:data.completeHistoryRows});
    assert.equal(data.currentEmployee[C.DEPARTURE],null);assert.equal(data.currentEmployee.energos,true);
    assert.equal(data.currentEmployee[C.CONTRACT_END],'2026-12-31');
});

for(const inactive of [false,true])test(`another cycle or a withdrawn record cannot supply validity proof, inactive=${inactive}`,()=>{
    const data=input(),donor={...data.completeHistoryRows[0],_id:F.identity(2),[C.END]:'2026-12-31'};
    if(inactive)donor.employment_history_canonical_status='WITHDRAWN_ERRONEOUS';
    else donor[C.HIRE]='2025-01-01';
    const plan=unsupportedPlan(data);data.completeHistoryRows.push(donor);
    blockedValidity(()=>assertRecordedValidityBoundaries({plan,currentEmployee:data.currentEmployee,historyRows:data.completeHistoryRows}));
});

function withdrawalData({closed=false}={}) {
    const data=F.input([F.period(1,{to:'2026-01-31',[C.CONTRACT_END]:'2026-12-31'}),
        F.period(2,{from:'2026-02-01',to:'2026-02-28',[C.CONTRACT_END]:'2026-12-31'}),
        F.period(3,{from:'2026-03-01',to:closed?'2026-06-30':null,
            departure:closed?'2026-06-30':null,[C.CONTRACT_END]:'2026-12-31'})]);
    return {data,args:{scope:data.scope,currentEmployee:data.currentEmployee,
        historyRows:data.completeHistoryRows.slice(0,2),coverageEvidenceRows:data.completeHistoryRows}};
}

test('terminal withdrawal asks explicit confirmation of open validity while coverage still ends at the real contract expiry',()=>{
    const {data,args}=withdrawalData(),before=structuredClone(data);
    const pending=planWithdrawalPeriodCorrections(args);assert.equal(pending.status,'DECISIONS_REQUIRED');
    assert.deepEqual(pending.conflicts[0].intents.map(intent=>intent.id),['CONFIRM_EXISTING']);
    const result=planWithdrawalPeriodCorrections({...args,decisions:[{conflictId:'WITHDRAWAL_BOUNDARY_0',intent:'CONFIRM_EXISTING'}]});
    assert.equal(result.status,'CONFIRMED');assert.equal(result.historyRows[1][C.END],null);
    assert.equal(result.historyRows[1][C.CONTRACT_END],'2026-12-31');
    assert.deepEqual(employeeHistoryCoverageGaps({currentEmployee:data.currentEmployee,historyRows:result.historyRows}),[]);
    assert.throws(()=>assertVerifiedHistoryCoverageForDate('2027-01-01',result.historyRows,data.currentEmployee),{code:'EMPLOYEE_HISTORY_COVERAGE_REQUIRED'});
    assert.deepEqual(data,before);
});

test('terminal withdrawal with a recorded departure still requires the actual validity date',()=>{
    const {data,args}=withdrawalData({closed:true}),before=structuredClone(data);
    const pending=planWithdrawalPeriodCorrections(args);assert.equal(pending.status,'DECISIONS_REQUIRED');
    assert.deepEqual(pending.conflicts[0].intents.map(intent=>intent.id),['OTHER_DATE']);
    assert.throws(()=>planWithdrawalPeriodCorrections({...args,decisions:[{conflictId:'WITHDRAWAL_BOUNDARY_0',intent:'CONFIRM_EXISTING'}]}),
        {code:'EMPLOYEE_HISTORY_USER_CORRECTION_INVALID_REQUEST'});
    const result=planWithdrawalPeriodCorrections({...args,decisions:[{conflictId:'WITHDRAWAL_BOUNDARY_0',intent:'OTHER_DATE',effectiveDate:'2026-06-30'}]});
    assert.equal(date(result.historyRows[1][C.END]),'2026-06-30');
    assert.equal(data.currentEmployee[C.DEPARTURE],'2026-06-30');assert.deepEqual(data,before);
});
