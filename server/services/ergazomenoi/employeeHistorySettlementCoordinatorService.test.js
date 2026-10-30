'use strict';
const { test, before, after, mock } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { forbidRealSettlementMongo } = require('../../../test/fixtures/forbidRealSettlementMongo');
const { coordinateEmployeeHistorySettlement: coordinate } = require('./employeeHistorySettlementCoordinatorService');
const { buildUnifiedEmployeeHistorySettlementPreview: project } = require('./employeeHistorySettlementPreviewService');
const { prepareEmployeeEmploymentHistorySettlement: prepare } = require('./employeeEmploymentProfileWriter');
const A = require('./employeeHistoryAutomaticReconstructionApplyContract');
const { clone } = require('./employeeHistoryAutomaticSettlementPreparationContract');
const { isInactiveHistoryRow } = require('../../utils/ergazomenoi/employmentHistoryCanonicalStatus');
const { employeeHistoryCoverageGaps } = require('../../utils/ergazomenoi/employmentHistoryCoverage');
const { buildEmploymentCycles, resolveEmploymentCycleForDate } = require('./employeeEmploymentCycleResolverService');
const F = require('./fixtures/unifiedEmployeeHistorySettlementFixtures');
const day = value => value ? new Date(value).toISOString().slice(0,10) : null;
const active = plan => plan.proposedRows.filter(row => !isInactiveHistoryRow(row));
before(() => forbidRealSettlementMongo(mock));
after(() => mock.restoreAll());
function inputAfter(data, plan) {
    return { ...clone(data), currentEmployee: { ...clone(data.currentEmployee), ...clone(plan.currentPatch) },
        completeHistoryRows: clone(plan.proposedRows), protectedReferenceSummary: Object.fromEntries(plan.proposedRows.map(row =>
            [String(row._id), clone(data.protectedReferenceSummary[String(row._id)] || [])])) };
}
function assertProtected(data, plan) {
    for (const original of data.completeHistoryRows) {
        if (!data.protectedReferenceSummary[String(original._id)]?.length && !isInactiveHistoryRow(original)) continue;
        const target = plan.proposedRows.find(row => String(row._id) === String(original._id));
        assert.ok(target, 'the exact referenced physical identity survives');
        if (isInactiveHistoryRow(original) || !isInactiveHistoryRow(target)) assert.deepEqual(target, original);
        else {
            const { employment_history_canonical_status: status, employment_history_canonical_survivor_id: survivor, ...payload } = target;
            assert.equal(status,'REDUNDANT_REFERENCED'); assert.deepEqual(payload,original);
            assert.ok(active(plan).some(row => String(row._id) === String(survivor)), 'retirement refers directly to an active survivor');
        }
    }
}
function assertFinal(data, plan) {
    assert.equal(plan.status,'CLEAN'); assert.equal(plan.verification.status,'CLEAN');
    assert.deepEqual(plan.verification.issues,[]);assert.deepEqual(plan.verification.coverageGaps,[]);
    assert.equal(plan.executionEnabled,false);assert.equal(plan.mode,'PREVIEW_ONLY');
    assertProtected(data,plan);
    assert.deepEqual(employeeHistoryCoverageGaps({currentEmployee:{...data.currentEmployee,...plan.currentPatch},
        historyRows:plan.proposedRows,requiredHistoryRows:data.completeHistoryRows}),[]);
    for (const row of active(plan).filter(row=>row.hmeromhnia_isxyos_oron_ergasias_apo)) {
        assert.ok(row.hmeres_ergasias_ebdomadas > 0);
        assert.ok(Math.abs(row.hmeres_ergasias_ebdomadas*row.mo_oron_hmerhsias_ergasias-row.ores_ergasias_ebdomadas)<0.01);
    }
}
for (const family of F.families) test(`family ${String(family.number).padStart(2,'0')}: ${family.name}`,()=>{
    const data=family.make(),before=A.stringify(data),plan=coordinate(data),preview=project(data);
    assert.equal(plan.outcome,family.expected,JSON.stringify({reason:plan.reason,attempts:plan.attempts}));
    assert.equal(A.stringify(data),before,'no source, reference, snapshot, amount or revision was mutated');
    assert.equal(preview.previewOnly,true);assert.equal(preview.executionEnabled,false);
    if (['CLEAN','AUTOMATIC'].includes(family.expected)) {
        assertFinal(data,plan);
        assert.equal(preview.state,family.expected==='CLEAN'?'clean':'automatic');
        if(family.number===19)for(const original of data.completeHistoryRows){
            const period=active(plan).find(row=>day(row.hmeromhnia_isxyos_oron_ergasias_apo)===day(original.hmeromhnia_isxyos_oron_ergasias_apo));
            assert.ok(period);for(const field of ['symbash','eidikothta_symbashs','synolo_symbashs','hmeromhnia_allaghs_symbashs'])
                assert.deepEqual(period[field],original[field],'actual contract, specialty, pay and change dates survive');
        }
        const second=coordinate(inputAfter(data,plan));
        assert.equal(second.status,'CLEAN',JSON.stringify(second)); assert.equal(second.noOp,true,'a second check is a true fixed point');
    } else if (family.expected==='BUSINESS_DECISION_REQUIRED') {
        assert.equal(preview.state,'decision');assert.ok(preview.questions.length);
        assert.deepEqual(plan.proposedRows,[],'no partial proposal escapes before a real decision');
    } else {
        assert.equal(preview.state,'unknown');assert.ok(plan.reason);
        assert.match(preview.message,/Δεν αποθηκεύτηκε καμία αλλαγή.*1\..*2\..*ΙΣΤ-ΑΥΤ-3Α/s);
        assert.deepEqual(plan.proposedRows,[]);
    }
    assert.doesNotMatch(JSON.stringify(preview),/6200000000000000|synthetic-snapshot|proposedRows|historyIds|canonical_status|currentPatch|internalPlans/);
    assert.equal(mongoose.connection.readyState,0);
});

for(const number of [1,2,3,4,5,6,7,8,9,10,12,15,16,18,19,20,21,23,24,27]) for(const protection of ['first','all'])
test(`family ${number}, protected=${protection}: complete proposal and immutable protected originals`,()=>{
    const data=F.references(F.families.find(f=>f.number===number).make(),protection),before=A.stringify(data);
    const plan=coordinate(data);assertFinal(data,plan);assert.equal(A.stringify(data),before);
    const next=coordinate(inputAfter(data,plan));assert.equal(next.noOp,true,JSON.stringify({reason:next.reason,attempts:next.attempts}));
});

for(const number of [1,2,3,4,5,6,7,8,9,10,12,14,15,16,18,19,20,21,23,27])
test(`family ${number}: unrelated earlier finalized cycle is preserved in the whole-state verification`,()=>{
    const data=F.families.find(f=>f.number===number).make();
    const previous={...F.period(800,{hire:'2020-01-01',to:'2020-12-31',departure:'2020-12-31',pay:800}),...data.scope};
    data.completeHistoryRows.unshift(previous);data.protectedReferenceSummary[String(previous._id)]=[{collection:'Apasxoliseis_Period_Frozen_Snapshots',historyId:String(previous._id),documentId:'synthetic-earlier-finalized'}];
    const before=A.stringify(data),plan=coordinate(data);
    if(number===14){assert.equal(plan.status,'BUSINESS_DECISION_REQUIRED');assert.equal(plan.decisions[0].id,'cycle_2');}
    else {
        assertFinal(data,plan);assert.ok(plan.verification.cycles.length>=2);
        assert.deepEqual(plan.proposedRows.find(row=>String(row._id)===String(previous._id)),previous);
    }
    assert.equal(A.stringify(data),before);
});

test('acceptance A: 02/02–31/03 uses earliest recorded historical terms, preserving both real subsequent changes and amounts',()=>{
    const data=F.references(F.initialGap()),plan=coordinate(data);assertFinal(data,plan);
    const initial=active(plan).find(row=>day(row.hmeromhnia_isxyos_oron_ergasias_apo)==='2026-02-02');
    assert.ok(initial);assert.equal(day(initial.hmeromhnia_isxyos_oron_ergasias_eos),'2026-03-31');
    assert.equal(initial.synolo_symbashs,1100);assert.equal(initial.pragmatikosMisthos,1100);
    assert.ok(active(plan).some(row=>day(row.hmeromhnia_isxyos_oron_ergasias_apo)==='2026-04-01'&&row.synolo_symbashs===1100));
    assert.ok(active(plan).some(row=>day(row.hmeromhnia_isxyos_oron_ergasias_apo)==='2026-09-29'&&row.synolo_symbashs===1300));
    assert.ok(plan.assumptions.some(item=>item.code==='EARLIEST_HISTORICAL_TERMS_CONTINUE_BACK_TO_HIRE'&&item.businessRationale));
    assert.equal(day(active(plan).at(-1).hmeromhnia_isxyos_oron_ergasias_eos),'2027-01-31','a real finite boundary cannot become open');
});
test('acceptance B: later empty duplicate cannot erase 31/07 departure or create an employment gap before 16/09 rehire',()=>{
    const data=F.references(F.rehire()),plan=coordinate(data);assertFinal(data,plan);
    const context={currentEmployee:data.currentEmployee,history:plan.proposedRows};
    const cycles=buildEmploymentCycles(context);assert.equal(cycles.length,2);
    assert.equal(cycles[0].departure_date,'2026-07-31');assert.equal(cycles[1].hire_date,'2026-09-16');
    for(const date of ['2026-08-01','2026-08-31','2026-09-15']) assert.equal(resolveEmploymentCycleForDate(date,context).status,'BETWEEN_CYCLES');
    assert.equal(resolveEmploymentCycleForDate('2026-07-31',context).status,'EMPLOYED');
    assert.equal(resolveEmploymentCycleForDate('2026-09-16',context).status,'EMPLOYED');
    assert.ok(!active(plan).some(row=>day(row.hmeromhnia_isxyos_oron_ergasias_apo)>='2026-08-01'&&day(row.hmeromhnia_isxyos_oron_ergasias_apo)<'2026-09-16'));
});
test('acceptance C: all old complementary referenced rows keep their original payload and resolve to one active logical period',()=>{
    const data=F.references(F.duplicates(true)),plan=coordinate(data);assertFinal(data,plan);
    assert.equal(active(plan).length,1);assert.equal(active(plan)[0].synolo_symbashs,1200);
    assert.equal(active(plan)[0].eidikothta_symbashs,'SYNTHETIC_SPECIALTY');
    for(const original of data.completeHistoryRows) assert.ok(plan.proposedRows.some(row=>String(row._id)===String(original._id)));
});

for(const protection of ['none','all']) test(`family 11: every general salary alternative has its own verified result, protected=${protection}`,()=>{
    const data=F.references(F.payAlternatives(),protection),pending=coordinate(data),decision=pending.decisions[0];
    assert.equal(decision.kind,'MULTIPLE');assert.equal(decision.options.length,2);
    const observed=new Set();
    for(const option of decision.options){
        const plan=coordinate({...data,businessDecision:{snapshotFingerprint:pending.snapshotFingerprint,selections:{cycle_1:{choiceId:option.id}}}});
        assertFinal(data,plan);observed.add(active(plan).find(row=>day(row.hmeromhnia_isxyos_oron_ergasias_apo)==='2026-01-01').synolo_symbashs);
        assert.equal(active(plan).find(row=>day(row.hmeromhnia_isxyos_oron_ergasias_apo)==='2026-04-01').synolo_symbashs,1500);
    }
    assert.deepEqual([...observed].sort(),[1100,1300]);
});
test('family 14: missing flexibility remains unknown until the real number is supplied, including an explicit zero',()=>{
    for(const value of [0,45,120]){
        const data=F.references(F.unknownArrival()),pending=coordinate(data);
        assert.equal(pending.status,'BUSINESS_DECISION_REQUIRED');
        const decision=pending.decisions[0],answers=Object.fromEntries(decision.plan.factQuestions.map(question=>[question.id,value]));
        assert.equal(decision.plan.factQuestions.length,1);
        const plan=coordinate({...data,businessDecision:{snapshotFingerprint:pending.snapshotFingerprint,selections:{cycle_1:{answers}}}});
        assertFinal(data,plan);assert.equal(active(plan)[0].evelikth_proselefsh,value);
        assert.equal(data.completeHistoryRows[0].evelikth_proselefsh,undefined);
    }
});
for(const [days,hours] of [[5,40],[6,40],[3,18]]) test(`family 15: actual ${days} days/${hours} hours survive without a new payroll formula`,()=>{
    const data=F.input([F.period(1,{days,hours})]),plan=coordinate(data);assertFinal(data,plan);
    assert.equal(plan.noOp,true);assert.equal(active(plan)[0].hmeres_ergasias_ebdomadas,days);
    assert.equal(active(plan)[0].ores_ergasias_ebdomadas,hours);assert.equal(active(plan)[0].mo_oron_hmerhsias_ergasias,hours/days);
});
test('family 17: the legacy cleanup policy cannot remove a real open prior cycle or fabricate departure from next hire',()=>{
    const data=F.openPast(),before=A.stringify(data),plan=coordinate(data);
    assert.equal(plan.status,'ADMIN_REQUIRED');assert.equal(plan.reason,'EMPLOYMENT_CYCLE_OPEN_BEFORE_NEXT_HIRE');
    assert.ok(plan.attempts.some(item=>item.solver==='LEGACY_OPEN_CYCLE_CLEANUP'&&item.reason==='UNPROVEN_CYCLE_REMOVAL_REJECTED'));
    assert.deepEqual(plan.proposedRows,[]);assert.equal(A.stringify(data),before);
});
test('family 25: business choices bind complete typed snapshots, amounts, revisions and references',()=>{
    const data=F.payAlternatives(),pending=coordinate(data);
    const selected={snapshotFingerprint:pending.snapshotFingerprint,selections:{cycle_1:{choiceId:pending.decisions[0].options[0].id}}};
    for(const mutate of [d=>{d.completeHistoryRows[0].synolo_symbashs=1101;},d=>{d.completeHistoryRows[0].updatedAt=new Date('2026-02-01');},
        d=>{d.completeHistoryRows[0].history_reference_fence=1;},d=>{d.currentEmployee.employee_profile_mutation_sequence=1;},
        d=>{d.protectedReferenceSummary[String(d.completeHistoryRows[0]._id)].push({collection:'Oraria_Apologistika',historyId:String(d.completeHistoryRows[0]._id),documentId:'synthetic-concurrent'});}]){
        const changed=clone(data);mutate(changed);const before=A.stringify(changed);
        assert.throws(()=>coordinate({...changed,businessDecision:selected}),{code:'EMPLOYEE_HISTORY_SETTLEMENT_DECISION_INVALID',statusCode:409});
        assert.equal(A.stringify(changed),before);
    }
});
test('new coordinator plans cannot enter either writer contract or obtain an executable approval',()=>{
    const data=F.initialGap(),proposal=coordinate(data);assertFinal(data,proposal);
    assert.equal(proposal.requiresWriterContractExtension,true);
    assert.throws(()=>A.buildAutomaticReconstructionPhysicalPlan({plan:proposal,completeHistoryRows:data.completeHistoryRows}));
    assert.throws(()=>prepare({...data,proposal,actorUserId:F.identity(700),employeeId:String(data.currentEmployee._id),approval:{confirmed:true,fingerprint:proposal.proposalFingerprint}}),
        {code:'EMPLOYEE_HISTORY_SETTLEMENT_PREPARATION_CLEAN_PROPOSAL_REQUIRED'});
});

test('composition: an initial gap and two alternative historical salaries require one factual choice and then one complete verified proposal',()=>{
    const data=F.references(F.input([F.period(1,{from:'2026-02-01',to:'2026-03-31',pay:1100}),
        F.period(2,{from:'2026-02-01',to:'2026-03-31',pay:1300}),F.period(3,{from:'2026-04-01',pay:1500})]));
    const pending=coordinate(data);assert.equal(pending.status,'BUSINESS_DECISION_REQUIRED');
    assert.equal(pending.decisions[0].options.length,2);
    for(const option of pending.decisions[0].options){
        const plan=coordinate({...data,businessDecision:{snapshotFingerprint:pending.snapshotFingerprint,selections:{cycle_1:{choiceId:option.id}}}});
        assertFinal(data,plan);const periods=active(plan);
        const initial=periods.find(row=>day(row.hmeromhnia_isxyos_oron_ergasias_apo)==='2026-01-01');
        const chosen=periods.find(row=>day(row.hmeromhnia_isxyos_oron_ergasias_apo)==='2026-02-01');
        assert.equal(initial.synolo_symbashs,chosen.synolo_symbashs);
        assert.ok([1100,1300].includes(initial.synolo_symbashs));
        assert.equal(periods.find(row=>day(row.hmeromhnia_isxyos_oron_ergasias_apo)==='2026-04-01').synolo_symbashs,1500);
    }
});
test('composition: two independent conflicting periods are resolved together without allowing the first resolver reason to discard the second',()=>{
    const data=F.references(F.input([F.period(1,{to:'2026-03-31',pay:1100}),F.period(2,{to:'2026-03-31',pay:1300}),
        F.period(3,{from:'2026-04-01',to:'2026-06-30',pay:1400}),F.period(4,{from:'2026-04-01',to:'2026-06-30',pay:1500}),
        F.period(5,{from:'2026-07-01',pay:1600})]));
    const pending=coordinate(data);assert.equal(pending.status,'BUSINESS_DECISION_REQUIRED');
    assert.equal(pending.decisions[0].options.length,4);const observed=new Set();
    for(const option of pending.decisions[0].options){
        const plan=coordinate({...data,businessDecision:{snapshotFingerprint:pending.snapshotFingerprint,selections:{cycle_1:{choiceId:option.id}}}});
        assertFinal(data,plan);observed.add(active(plan).filter(row=>day(row.hmeromhnia_isxyos_oron_ergasias_apo)<'2026-07-01').map(row=>row.synolo_symbashs).join('/'));
    }
    assert.deepEqual([...observed].sort(),['1100/1400','1100/1500','1300/1400','1300/1500']);
});
test('a sparse lifecycle anchor without actual work terms cannot certify a clean History',()=>{
    const data=F.input();for(const row of [data.currentEmployee,...data.completeHistoryRows]){
        delete row.hmeromhnia_isxyos_oron_ergasias_apo;delete row.hmeres_ergasias_ebdomadas;
        delete row.ores_ergasias_ebdomadas;delete row.mo_oron_hmerhsias_ergasias;row.afora_allagh_oron_ergasias=false;
    }
    assert.notEqual(coordinate(data).status,'CLEAN');assert.notEqual(project(data).state,'clean');
});

test('family 28: the existing transactional maintenance writer saves an independent email while all pending History and audits stay exact',async()=>{
    const data=F.openPast();assert.equal(coordinate(data).status,'ADMIN_REQUIRED');
    const {store}=require('../../../test/fixtures/employeeProfileTransactionStore');
    const db=store([{employee:{...data.currentEmployee,oristikh_enhmerosh:true},history:data.completeHistoryRows}]);
    const before=db.state(),query=value=>({select(){return this;},session(){return this;},lean:async()=>value});
    const result=await require('./employeeEmploymentProfileWriter').writeEmployeeMaintenance({...db.deps,scope:data.scope,
        employeeId:String(data.currentEmployee._id),actorUserId:F.identity(700),
        expectedEmployeeStateToken:require('../../utils/ergazomenoi/employeeSaveState').employeeStateToken(before.employees[0]),
        userModel:{findById:()=>query({situation:'A',team:data.scope.team,privileges:'U'})},
        privilegeModel:{findOne:()=>query({privileges:{update:true}})},input:{},
        maintenance:{employeeChanges:{email:'independent@example.invalid'},submittedEmployeeFields:['email'],historyChanges:{},
            submittedProfileFields:[],submittedFormValues:{email:'independent@example.invalid'}}});
    assert.equal(result.employeeUpdated,true);assert.equal(result.historyUpdated,false);assert.equal(result.ambiguousHistoryPreserved,true);
    assert.equal(db.state().employees[0].email,'independent@example.invalid');assert.deepEqual(db.state().history,before.history);assert.deepEqual(db.state().audits,before.audits);
    assert.equal(db.events.some(event=>event.kind==='history'&&event.type==='write'),false);
    assert.equal(db.events.filter(event=>event.type==='commit').length,1);
});

test('existing user-confirmed correction composes with missing numeric facts without losing the original factual answers or creating zero defaults',()=>{
    const data=require('./fixtures/userConfirmedEmployeeHistoryCorrectionFixtures').h2KpkBoundaryFixture();
    const before=A.stringify(data),pending=coordinate(data);assert.equal(pending.decisions[0].kind,'USER_CORRECTION');
    const confirmation={responsibilityAccepted:true,decisions:[
        {conflictId:'INITIAL_PROFILE_START',intent:'FROM_HIRE'},
        {conflictId:'INITIAL_PROFILE_TERMS',intent:'CONFIRM_EXISTING',value:'PROFILE_CANDIDATE_1'},
        {conflictId:'FIELD_KPK',intent:'CONFIRM_EXISTING'}]};
    const businessDecision={snapshotFingerprint:pending.snapshotFingerprint,selections:{cycle_1:{confirmation}}};
    const continued=coordinate({...data,businessDecision});assert.equal(continued.status,'BUSINESS_DECISION_REQUIRED');
    assert.equal(continued.decisions[0].kind,'FACTS');assert.deepEqual(continued.decisions[0].precedingSelection,{confirmation});
    assert.equal(continued.decisions[0].answerKey,'facts');
    const projected=project({...data,businessDecision});assert.equal(projected.decisionContext.groups[0].answerKey,'facts');
    assert.deepEqual(projected.decisionContext.groups[0].priorSelection,{confirmation});
    const rules=continued.decisions[0].plan.internalResolutionRules.numericRules;
    assert.equal(rules.length,3);
    assert.equal(rules.filter(rule=>rule.field==='symbatikes_ores_ergasias').length,2);
    const arrival=rules.find(rule=>rule.field==='evelikth_proselefsh');assert.ok(arrival);
    assert.equal(data.completeHistoryRows.find(row=>row._id==='h2-incomplete-initial').evelikth_proselefsh,undefined);
    assert.equal(data.completeHistoryRows.find(row=>row._id==='h2-later-profile').evelikth_proselefsh,0);
    assert.equal(continued.decisions[0].input.completeHistoryRows.find(row=>arrival.historyIds.includes(String(row._id))).evelikth_proselefsh,undefined,
        'later zero is not evidence for the earlier period');
    businessDecision.selections.cycle_1.facts=Object.fromEntries(rules.map(rule=>[rule.id,rule.field==='evelikth_proselefsh'?15:40]));
    const complete=coordinate({...data,businessDecision});assertFinal(data,complete);
    assert.equal(complete.currentPatch.symbatikes_ores_ergasias,40);
    assert.equal(active(complete).find(row=>day(row.hmeromhnia_isxyos_oron_ergasias_apo)==='2026-04-24').krathsh_01,'0111');
    assert.equal(active(complete).find(row=>day(row.hmeromhnia_isxyos_oron_ergasias_apo)==='2026-05-25').krathsh_01,'0115');
    const initial=active(complete).find(row=>day(row.hmeromhnia_isxyos_oron_ergasias_apo)==='2026-04-24');
    const later=active(complete).find(row=>day(row.hmeromhnia_isxyos_oron_ergasias_apo)==='2026-05-25');
    assert.equal(initial.evelikth_proselefsh,15);assert.equal(later.evelikth_proselefsh,0);
    assert.equal(day(initial.hmeromhnia_isxyos_oron_ergasias_eos),'2026-05-24');
    for(const row of[initial,later])for(const field of['symbash','eidikothta_symbashs','synolo_symbashs','nomimosMisthos','pragmatikosMisthos'])
        assert.equal(row[field],data.completeHistoryRows.find(original=>original._id==='h2-later-profile')[field]);
    const second=coordinate(inputAfter(data,complete));assertFinal(inputAfter(data,complete),second);assert.equal(second.noOp,true);
    assert.equal(A.stringify(data),before);
});
for(const factoryName of ['competingDepartureDatesFixture','departureAndHistoricalPayFactFixture'])
test(`existing business-fact resolver ${factoryName} remains usable from the unified preview`,()=>{
    const data=require('./fixtures/businessFactEmployeeHistoryResolutionFixtures')[factoryName]();
    for(const row of [data.currentEmployee,...data.completeHistoryRows])Object.assign(row,{evelikth_proselefsh:0,symbatikes_ores_ergasias:40});
    const before=A.stringify(data),pending=coordinate(data),decision=pending.decisions[0];assert.equal(decision.kind,'FACTS');
    const answers=Object.fromEntries(decision.plan.factQuestions.filter(question=>question.type==='SINGLE_CHOICE').map(question=>[question.id,question.options[0].id]));
    const complete=coordinate({...data,businessDecision:{snapshotFingerprint:pending.snapshotFingerprint,selections:{cycle_1:{answers}}}});
    assertFinal(data,complete);assert.equal(A.stringify(data),before);
});

for(const field of ['synolo_symbashs','pragmatikosMisthos','poso_symbashs_01','misthologiko_klimakio'])
for(const value of (field.startsWith('poso_symbashs_')?[NaN,Infinity,'1200']:[-1,NaN,Infinity,'1200']))
test(`invalid recorded numeric amount ${field}=${String(value)} can never certify a clean final state`,()=>{
    const data=F.input();data.completeHistoryRows[0][field]=value;data.currentEmployee[field]=value;
    const before=A.stringify(data),plan=coordinate(data);assert.notEqual(plan.status,'CLEAN');assert.equal(A.stringify(data),before);
    assert.deepEqual(plan.proposedRows,[]);
});
test('missing historical monetary amounts are never supplied from later current pay or converted to zero',()=>{
    const data=F.input([F.period(1,{to:'2026-03-31'}),F.period(2,{from:'2026-04-01',pay:1500})]);
    for(const field of ['synolo_symbashs','pragmatikosMisthos'])delete data.completeHistoryRows[0][field];
    const plan=coordinate(data);assertFinal(data,plan);
    const earlier=active(plan).find(row=>day(row.hmeromhnia_isxyos_oron_ergasias_apo)==='2026-01-01');
    for(const field of ['synolo_symbashs','pragmatikosMisthos'])assert.equal(Object.hasOwn(earlier,field),false);
    assert.equal(active(plan).find(row=>day(row.hmeromhnia_isxyos_oron_ergasias_apo)==='2026-04-01').synolo_symbashs,1500);
});

test('a required gap repair does not backfill unknown earlier wages from a later dated pay profile',()=>{
    const data=F.intermediate(true);
    for(const field of ['synolo_symbashs','pragmatikosMisthos','nomimosMisthos'])delete data.completeHistoryRows[0][field];
    const plan=coordinate(data);assertFinal(data,plan);
    const earlier=active(plan).find(row=>day(row.hmeromhnia_isxyos_oron_ergasias_apo)==='2026-01-01');
    assert.equal(day(earlier.hmeromhnia_isxyos_oron_ergasias_eos),'2026-04-09');
    for(const field of ['synolo_symbashs','pragmatikosMisthos','nomimosMisthos'])assert.equal(Object.hasOwn(earlier,field),false);
});

for(const laterAmount of [0,1500]) test(`gap repair preserves unknown historical amounts even when later recorded pay is ${laterAmount}`,()=>{
    const data=F.intermediate(true),fields=['synolo_symbashs','pragmatikosMisthos','nomimosMisthos','poso_symbashs_01'];
    for(const field of fields){delete data.completeHistoryRows[0][field];data.completeHistoryRows[1][field]=laterAmount;data.currentEmployee[field]=laterAmount;}
    const plan=coordinate(data);assertFinal(data,plan);
    const earlier=active(plan).find(row=>day(row.hmeromhnia_isxyos_oron_ergasias_apo)==='2026-01-01');
    const later=active(plan).find(row=>day(row.hmeromhnia_isxyos_oron_ergasias_apo)==='2026-04-10');
    for(const field of fields){assert.equal(Object.hasOwn(earlier,field),false);assert.equal(later[field],laterAmount);}
});

test('recorded negative contract components are valid deductions and retain their exact signed values during complementary repair',()=>{
    const data=F.duplicates(true);data.completeHistoryRows[0].poso_symbashs_04=-19.8;
    data.completeHistoryRows[0].poso_symbashs_basei_oron_ergasias_04=-19.8;
    delete data.currentEmployee.poso_symbashs_04;delete data.currentEmployee.poso_symbashs_basei_oron_ergasias_04;
    const plan=coordinate(data);assertFinal(data,plan);assert.equal(active(plan)[0].poso_symbashs_04,-19.8);
    assert.equal(active(plan)[0].poso_symbashs_basei_oron_ergasias_04,-19.8);
});

test('conflicting current-period salaries remain two actual business alternatives; choosing either also previews the matching current terms',()=>{
    const data=F.references(F.input([F.period(1,{pay:1100}),F.period(2,{pay:1300})]));
    const pending=coordinate(data);assert.equal(pending.status,'BUSINESS_DECISION_REQUIRED');assert.equal(pending.decisions[0].options.length,2);
    const salaries=new Set();for(const option of pending.decisions[0].options){
        const plan=coordinate({...data,businessDecision:{snapshotFingerprint:pending.snapshotFingerprint,selections:{cycle_1:{choiceId:option.id}}}});
        assertFinal(data,plan);salaries.add(active(plan)[0].synolo_symbashs);
        assert.equal({...data.currentEmployee,...plan.currentPatch}.synolo_symbashs,active(plan)[0].synolo_symbashs);
    }
    assert.deepEqual([...salaries].sort(),[1100,1300]);
});

for(const recorded of [false,true])test(`the established corroborated unique correction is retained, recorded arrival=${recorded}`,()=>{
    const data=require('./fixtures/uniqueSafeEmployeeHistoryRepairFixtures').shapeBCorrectedProfileFixture();
    for(const row of[data.currentEmployee,...data.completeHistoryRows]){row.symbatikes_ores_ergasias=40;if(recorded)row.evelikth_proselefsh=0;else delete row.evelikth_proselefsh;}
    const before=A.stringify(data),plan=coordinate(data);
    if(recorded){assertFinal(data,plan);assert.ok(plan.sources.includes('ESTABLISHED_UNIQUE_SAFE_REPAIR'));}
    else{assert.equal(plan.status,'BUSINESS_DECISION_REQUIRED');assert.equal(plan.decisions[0].kind,'FACTS');
        const answers=Object.fromEntries(plan.decisions[0].plan.factQuestions.map(question=>[question.id,0]));
        const complete=coordinate({...data,businessDecision:{snapshotFingerprint:plan.snapshotFingerprint,selections:{cycle_1:{answers}}}});assertFinal(data,complete);
        assert.equal(complete.currentPatch.evelikth_proselefsh,0);assert.ok(active(complete).some(row=>row.employment_profile_schema_version===1),'recorded schema obligations are preserved');}
    assert.equal(A.stringify(data),before);
});

test('real requests without fixture asOfDate still reach the factual resolver; the default is a calendar day in Greece',t=>{
    t.mock.timers.enable({apis:['Date'],now:new Date('2026-10-29T22:30:00.000Z')});
    const data=require('./fixtures/businessFactEmployeeHistoryResolutionFixtures').competingDepartureDatesFixture();delete data.asOfDate;
    const plan=coordinate(data);assert.equal(plan.status,'BUSINESS_DECISION_REQUIRED');assert.equal(plan.decisions[0].kind,'FACTS');
    const date=plan.decisions[0].plan.factQuestions.find(question=>question.type==='DATE');
    assert.equal(date.max,'2026-10-30','the non-midnight server clock must never be passed as a persisted calendar date');
});

test('already retained BSON identities and native survivor links remain byte-for-byte unchanged on a clean recheck',()=>{
    const data=F.input();const survivor=new mongoose.Types.ObjectId(F.identity(1));data.completeHistoryRows[0]._id=survivor;
    const artifact={...clone(data.completeHistoryRows[0]),_id:new mongoose.Types.ObjectId(F.identity(2)),
        employment_history_canonical_status:'REDUNDANT_REFERENCED',employment_history_canonical_survivor_id:survivor};
    data.completeHistoryRows.push(artifact);data.protectedReferenceSummary=Object.fromEntries(data.completeHistoryRows.map(row=>[String(row._id),[]]));
    const before=A.stringify(data),plan=coordinate(data);assertFinal(data,plan);assert.equal(plan.noOp,true);
    assert.deepEqual(plan.proposedRows.find(row=>String(row._id)===String(artifact._id)),artifact);
    assert.ok(plan.proposedRows.find(row=>String(row._id)===String(artifact._id)).employment_history_canonical_survivor_id instanceof mongoose.Types.ObjectId);
    assert.equal(A.stringify(data),before);
});

test('three independent ambiguous periods offer two real choices each and all eight combinations verify together',()=>{
    const data=F.references(F.threeIndependentAlternatives()),pending=coordinate(data),decision=pending.decisions[0];
    assert.equal(decision.kind,'MULTIPLE_GROUPS');assert.equal(decision.plan.businessGroups.length,3);
    const preview=project(data);assert.equal(preview.questions.length,3);assert.ok(preview.questions.every(question=>question.options.length===2));
    const observed=new Set();for(let mask=0;mask<8;mask++){
        const answers=Object.fromEntries(decision.plan.businessGroups.map((group,index)=>[group.id,group.options[(mask>>index)&1].id]));
        const complete=coordinate({...data,businessDecision:{snapshotFingerprint:pending.snapshotFingerprint,
            selections:{cycle_1:{choiceId:decision.options[0].id,answers}}}});
        assertFinal(data,complete);observed.add(active(complete).map(row=>row.synolo_symbashs).join('/'));
        assert.equal(active(complete).at(-1).synolo_symbashs,1700);
    }
    assert.equal(observed.size,8);
});

test('business choices preserve displayed precision of recorded hourly rates instead of making different amounts look identical',()=>{
    const data=F.payAlternatives();data.completeHistoryRows[0].pragmatikoOromisthio=6.125;data.completeHistoryRows[1].pragmatikoOromisthio=6.124;
    const preview=project(data);assert.equal(preview.state,'decision');
    const descriptions=preview.questions[0].options.map(option=>option.description).join('\n');
    assert.match(descriptions,/6,125 €/);assert.match(descriptions,/6,124 €/);
});
