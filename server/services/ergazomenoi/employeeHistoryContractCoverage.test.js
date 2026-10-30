'use strict';
const { test, before, after, mock } = require('node:test');
const assert = require('node:assert/strict');
const { forbidRealSettlementMongo } = require('../../../test/fixtures/forbidRealSettlementMongo');
const { employeeHistoryCoverageGaps: gaps, assertVerifiedHistoryCoverageForDate: guard,
    requiredCoverageForCycle } = require('../../utils/ergazomenoi/employmentHistoryCoverage');
const { coordinateEmployeeHistorySettlement: coordinate } = require('./employeeHistorySettlementCoordinatorService');
const { buildUnifiedEmployeeHistorySettlementPreview: preview } = require('./employeeHistorySettlementPreviewService');
const { buildEmploymentCycles, isEmployeeRelationshipActive } = require('./employeeEmploymentCycleResolverService');
const { planEvidencedMissingHistoryPeriods: fill } = require('./employeeHistoryMissingPeriodCorrectionService');
const { resolveEffectiveEmploymentProfileForReviewDate: review } = require('./apasxoliseisBorrowedEmploymentProfileResolverService');
const { getWeeklyRepoProfileInfo: weekly } = require('./apasxoliseisWeeklyRepoTransferAuthoritativeContextService');
const { historyCompletionStatus } = require('./employeeHistoryAutomaticReconstructionApplyContract');
const F = require('./fixtures/unifiedEmployeeHistorySettlementFixtures');
const END = 'hmeromhnia_lhxhs_symbashs';
const day = value => value == null ? null : new Date(value).toISOString().slice(0,10);
const active = plan => plan.proposedRows.filter(row => !row.employment_history_canonical_status);
const coverage = data => gaps({currentEmployee:data.currentEmployee,historyRows:data.completeHistoryRows});
before(() => forbidRealSettlementMongo(mock));
after(() => mock.restoreAll());
function expiry(data, date) {
    for (const row of [data.currentEmployee,...data.completeHistoryRows]) row[END] = date;
    return data;
}
function unchangedFacts(data, plan) {
    assert.deepEqual(plan.currentPatch, {});
    const before = new Set([data.currentEmployee,...data.completeHistoryRows].map(row => day(row.hmeromhnia_apoxorhshs)));
    for (const row of active(plan)) assert.ok(before.has(day(row.hmeromhnia_apoxorhshs)));
    const ends = new Set([data.currentEmployee,...data.completeHistoryRows].map(row=>day(row[END])));
    for (const row of active(plan)) assert.ok(ends.has(day(row[END])));
    assert.equal(isEmployeeRelationshipActive(data.currentEmployee),true);
    assert.equal(plan.mode,'PREVIEW_ONLY');assert.equal(plan.executionEnabled,false);
}

test('A: expiry and original compatibility baseline preserve the two actual periods without inventing February/March',()=>{
    const data=expiry(F.references(F.initialGap()),'2027-01-31');
    data.currentEmployee.employment_profile_pre_v1={source:'PRE_V1_CURRENT_OBSERVATION',before:'2026-04-01',facts:{ores_ergasias_ebdomadas:40}};
    const original=structuredClone(data),plan=coordinate(data);
    assert.equal(plan.status,'CLEAN');assert.equal(plan.noOp,true);
    assert.deepEqual(active(plan).map(row=>[day(row.hmeromhnia_isxyos_oron_ergasias_apo),day(row.hmeromhnia_isxyos_oron_ergasias_eos),row.synolo_symbashs]),
        [['2026-04-01','2026-09-28',1100],['2026-09-29','2027-01-31',1300]]);
    assert.deepEqual(coverage(data),[]);unchangedFacts(data,plan);assert.deepEqual(data,original);
    guard('2026-03-01',data.completeHistoryRows,data.currentEmployee);
    assert.equal(historyCompletionStatus({...data,plan:{status:'NO_OP'}}),'CLEAN');
});

test('B: safe initial gap completion, actual departure and rehire survive; second contract has no infinite tail',()=>{
    const data=F.references(F.input([
        F.period(1,{hire:'2025-12-01',from:'2026-04-01',to:'2026-07-31',departure:'2026-07-31',[END]:'2026-07-31'}),
        F.period(2,{hire:'2026-09-16',[END]:'2027-07-30'})]));
    const original=structuredClone(data),plan=coordinate(data);
    assert.equal(plan.status,'CLEAN',JSON.stringify({reason:plan.reason,attempts:plan.attempts}));
    const periods=active(plan);
    assert.ok(periods.some(row=>day(row.hmeromhnia_isxyos_oron_ergasias_apo)==='2025-12-01'&&
        day(row.hmeromhnia_isxyos_oron_ergasias_eos)==='2026-03-31'&&row.ores_ergasias_ebdomadas===40));
    assert.deepEqual(buildEmploymentCycles({currentEmployee:data.currentEmployee,history:plan.proposedRows}).map(c=>[c.hire_date,c.departure_date]),
        [['2025-12-01','2026-07-31'],['2026-09-16',null]]);
    assert.deepEqual(gaps({currentEmployee:data.currentEmployee,historyRows:plan.proposedRows}),[]);
    unchangedFacts(data,plan);assert.deepEqual(data,original);
    for(const row of data.completeHistoryRows) assert.deepEqual(plan.proposedRows.find(r=>r._id===row._id),row);
});

test('archived sanitized B retains real unrelated contradictions instead of certifying CLEAN',()=>{
    const f=require('./fixtures/real0002SanitizedHistoryFixture').buildReal0002SanitizedHistoryFixture();
    const data={...f,completeHistoryRows:f.history,protectedReferenceSummary:Object.fromEntries(f.history.map(r=>[r._id,[]]))};
    const original=structuredClone(data),plan=coordinate(data);
    assert.notEqual(plan.status,'CLEAN');assert.equal(plan.reason,'CONFLICTING_PROFILE_EVENTS');
    assert.deepEqual(coverage(data).map(g=>[g.from,g.to]),[['2025-12-01','2026-03-31']]);
    assert.deepEqual(data,original);
});

test('indefinite contracts preserve open coverage; finite validity alone does not become departure',()=>{
    const data=F.input();assert.deepEqual(coverage(data),[]);
    data.completeHistoryRows[0].hmeromhnia_isxyos_oron_ergasias_eos='2026-12-31';
    assert.deepEqual(coverage(data).map(g=>[g.from,g.to]),[['2027-01-01',null]]);
    assert.equal(buildEmploymentCycles({currentEmployee:data.currentEmployee,history:data.completeHistoryRows})[0].departure_date,null);
});

test('documented extension changes the required limit and uses the new actual terms',()=>{
    const data=F.input([F.period(1,{to:'2026-06-30',[END]:'2026-06-30',pay:1200}),
        F.period(2,{from:'2026-07-01',to:'2027-01-31',[END]:'2027-01-31',pay:1400})]);
    assert.deepEqual(coverage(data),[]);guard('2026-09-01',data.completeHistoryRows,data.currentEmployee);
    const plan=coordinate(data);assert.equal(plan.status,'CLEAN');assert.equal(active(plan).at(-1).synolo_symbashs,1400);
    unchangedFacts(data,plan);
});

for(const version of [undefined,1]) test(`expiry bounds legacy/versioned coverage independently of as-of date, schema=${version}`,()=>{
    const data=expiry(F.input([F.period(1,{to:'2027-01-31'})]),'2027-01-31');
    if(version)for(const row of [data.currentEmployee,...data.completeHistoryRows])row.employment_profile_schema_version=version;
    for(const asOfDate of ['2026-01-01','2028-01-01'])assert.deepEqual(gaps({...data,historyRows:data.completeHistoryRows,asOfDate}),[]);
});

for(const [date,reason] of [['invalid','INVALID_RECORDED_CONTRACT_END'],['2026-02-30','INVALID_RECORDED_CONTRACT_END'],
    ['2025-12-31','CONTRACT_END_BEFORE_HIRE']])test(`invalid expiry remains a concrete blocking diagnosis: ${date}`,()=>{
    const data=expiry(F.input(),date),before=structuredClone(data);
    assert.equal(coverage(data)[0].reason,reason);assert.equal(fill({...data,historyRows:data.completeHistoryRows}).reason,reason);
    assert.notEqual(coordinate(data).status,'CLEAN');assert.deepEqual(data,before);
});

test('a later real work-terms event cannot be hidden behind the old expiry',()=>{
    const data=expiry(F.input([F.period(1,{to:'2026-06-30'}),F.period(2,{from:'2026-07-01'})]),'2026-06-30');
    assert.equal(coverage(data)[0].reason,'CONTRACT_CONTINUATION_NOT_EVIDENCED');
    const plan=coordinate(data);assert.notEqual(plan.status,'CLEAN');
    const message=preview(data).message;assert.match(message,/μεταγενέστερα γεγονότα.*Δεν αποθηκεύτηκε.*1\..*2\..*ΙΣΤ-ΑΥΤ-3Α/s);
    assert.doesNotMatch(message,/620000|CONTRACT_|historyId/);
});

test('a real departure before expiry is the earlier bound, without altering contract expiry',()=>{
    const data=expiry(F.input([F.period(1,{to:'2026-05-31',departure:'2026-05-31'})]),'2026-12-31');
    assert.deepEqual(coverage(data),[]);
    const requirement=requiredCoverageForCycle({hire:'2026-01-01',current:data.currentEmployee,members:data.completeHistoryRows});
    assert.equal(day(requirement.until),'2026-05-31');assert.equal(day(requirement.contractEnd),'2026-12-31');
});

test('review, borrowing and weekly repo calculations reject post-expiry work even with open terms',()=>{
    const data=expiry(F.input(),'2026-06-30'),employee=data.currentEmployee,history=data.completeHistoryRows;
    const assertBlocked=fn=>assert.throws(fn,error=>error.code==='EMPLOYEE_HISTORY_COVERAGE_REQUIRED'&&
        error.details.coverageGaps[0].reason==='CONTRACT_CONTINUATION_NOT_EVIDENCED');
    assertBlocked(()=>guard('2026-07-01',history,employee));
    assertBlocked(()=>review({reviewDate:'2026-07-01',normalEmployee:employee,normalHistory:history}));
    assertBlocked(()=>review({reviewDate:'2026-07-01',normalEmployee:{...employee,afora_daneismo_ergazomenoy:true,
        typos_ergodoth_daneismoy:false,hmnia_enarxhs_daneismoy:'2026-01-01'},borrowedContext:{borrowingEmployee:employee,borrowingHistory:history}}));
    assertBlocked(()=>weekly({week:{weekStart:new Date('2026-06-29'),weekEnd:new Date('2026-07-05')},istorikoRows:history,ergazomenos:employee}));
    const resolved=review({reviewDate:'2026-06-29',normalEmployee:employee,normalHistory:history});
    assert.equal(resolved.hmeres_ergasias_ebdomadas,5);assert.equal(resolved.ores_ergasias_ebdomadas,40);
});

test('a refused missing-period solution keeps its exact interval and reason internally',()=>{
    const data=expiry(F.input([F.period(1,{to:'2026-06-30'})]),'2026-06-30');
    data.currentEmployee.hmeromhnia_isxyos_oron_ergasias_apo='2026-07-01';
    const plan=coordinate(data);assert.notEqual(plan.status,'CLEAN');
    assert.ok(plan.attempts.some(a=>a.coverageGaps?.some(g=>g.reason==='CONTRACT_CONTINUATION_NOT_EVIDENCED'&&g.from==='2026-07-01'&&g.to==='2026-07-01')));
});

test('equally dated conflicting expiries cannot be silently normalized to CLEAN',()=>{
    const first=F.period(1,{[END]:'2026-06-30'}),second={...first,_id:F.identity(2),[END]:'2026-07-31'};
    const data=F.input([first,second]);
    assert.equal(coverage(data)[0].reason,'CONFLICTING_RECORDED_CONTRACT_END');
    const plan=coordinate(data);assert.notEqual(plan.status,'CLEAN');assert.deepEqual(plan.proposedRows,[]);
});

test('departure after expiry requires documentation and does not shorten away the actual event',()=>{
    const data=expiry(F.input([F.period(1,{to:'2026-07-31',departure:'2026-07-31'})]),'2026-06-30');
    const before=structuredClone(data);
    assert.equal(coverage(data)[0].reason,'CONTRACT_CONTINUATION_NOT_EVIDENCED');
    assert.notEqual(coordinate(data).status,'CLEAN');assert.deepEqual(data,before);
});

test('a finite contract cannot hide internal gaps or overlapping historical terms',()=>{
    const data=expiry(F.input([F.period(1,{to:'2026-01-31'}),F.period(2,{from:'2026-03-01',to:'2026-06-30'})]),'2026-06-30');
    assert.deepEqual(coverage(data).map(g=>[g.from,g.to]),[['2026-02-01','2026-02-28']]);
    assert.throws(()=>guard('2026-02-15',data.completeHistoryRows,data.currentEmployee),{code:'EMPLOYEE_HISTORY_COVERAGE_REQUIRED'});
    data.completeHistoryRows[0].hmeromhnia_isxyos_oron_ergasias_eos='2026-03-31';
    assert.throws(()=>guard('2026-03-15',data.completeHistoryRows,data.currentEmployee),{code:'EMPLOYEE_HISTORY_COVERAGE_REQUIRED'});
});
