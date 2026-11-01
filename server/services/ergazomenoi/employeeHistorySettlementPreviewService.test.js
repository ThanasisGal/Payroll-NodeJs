'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildEmployeeHistorySettlementPreview: project } = require('./employeeHistorySettlementPreviewService');
const { planEmployeeHistoryAutomaticSettlement: settle } = require('./employeeHistoryAutomaticReconstructionPlannerService');
const A = require('./employeeHistoryAutomaticReconstructionApplyContract');
const F = require('./fixtures/automaticEmployeeHistoryReconstructionFixtures');
const M = require('./fixtures/multipleSafeEmployeeHistoryResolutionFixtures');
function input() {
    const data = F.real0006BoundaryStructure();
    data.completeHistoryRows.forEach(row => Object.assign(row, { evelikth_proselefsh: 0, symbatikes_ores_ergasias: 40 }));
    data.protectedReferenceSummary = Object.fromEntries(data.completeHistoryRows.map(row => [String(row._id), [{
        collection: 'Apasxoliseis_Period_Frozen_Snapshots', documentId: 'synthetic-frozen' }]]));
    return data;
}
test('verified settlement projects approved assumptions as information, with no questions, plans or identities', () => {
    const data = input(), before = A.stringify(data), result = project(data);
    assert.equal(result.state, 'automatic');
    assert.equal(result.previewOnly, true);
    assert.deepEqual(result.questions, []);
    assert.ok(result.assumptions.length);
    assert.ok(result.actions.some(item => /23\/04\/2026/.test(item)));
    assert.ok(result.actions.some(item => /Συνδυασμός 2/.test(item)));
    assert.doesNotMatch(JSON.stringify(result), /600000000000|synthetic-frozen|fingerprint|proposedRows|historyId|canonical|patch/);
    assert.equal(A.stringify(data), before);
});
test('only independently verified unchanged History reports clean', () => {
    const data = input();
    data.completeHistoryRows = settle(data).proposedRows;
    const result = project(data);
    assert.equal(result.state, 'clean');
    assert.deepEqual(result.actions, []);
    assert.deepEqual(result.questions, []);
});
test('real ambiguity projects established business choices only, with no preselected answer', () => {
    const data = M.samePeriodMateriallyDifferentProfilesFixture();
    data.completeHistoryRows.forEach(row => Object.assign(row, { evelikth_proselefsh: 0, symbatikes_ores_ergasias: 40 }));
    const result = project(data);
    assert.equal(result.state, 'decision');
    assert.equal(result.questions.length, 1);
    assert.equal(result.questions[0].options.length, 3);
    assert.doesNotMatch(JSON.stringify(result), /internalPlans|survivorId|fingerprint|selected/);
    assert.deepEqual(project(data, {}, { simpleDecisionsOnly: true }), result);
});

for (const make of [M.correctionFromHireOrSpecialtyChangeFixture, M.optionalIntermediateProfileFixture,
    M.realStartOfFourDayProfileFixture,
    require('./fixtures/businessFactEmployeeHistoryResolutionFixtures').competingDepartureDatesFixture])
test(`normal form leaves ${make.name} with the administrator`, () => {
    const data = make();
    data.completeHistoryRows.forEach(row => Object.assign(row, { evelikth_proselefsh: 0, symbatikes_ores_ergasias: 40 }));
    const result = project(data, {}, { simpleDecisionsOnly: true });
    assert.equal(result.state, 'unknown');
    assert.deepEqual(result.questions, []);
    assert.deepEqual(result.actions, []);
});
for (const kind of ['missingReferences', 'unknownReferences', 'unrecordedFacts']) test(`${kind} safely remains unknown`, () => {
    const data = input();
    if (kind === 'missingReferences') data.protectedReferenceSummary = {};
    if (kind === 'unknownReferences') data.protectedReferenceSummary[String(data.completeHistoryRows[0]._id)] = [{ collection: 'Unknown' }];
    if (kind === 'unrecordedFacts') data.completeHistoryRows.forEach(row => { delete row.evelikth_proselefsh; });
    const result = project(data);
    assert.equal(result.state, 'unknown');
    assert.deepEqual(result.actions, []);
    assert.deepEqual(result.questions, []);
});

function uniqueInput(recorded = true) {
    const data = require('./fixtures/uniqueSafeEmployeeHistoryRepairFixtures').shapeBCorrectedProfileFixture();
    if (recorded) [data.currentEmployee, ...data.completeHistoryRows].forEach(row =>
        Object.assign(row, { evelikth_proselefsh: 0, symbatikes_ores_ergasias: 40 }));
    return data;
}
test('an applicable unique plan is independently verified and projected without execution capability or input mutation', () => {
    const data = uniqueInput(), before = A.stringify(data);
    const capability = require('./employeeHistoryResolutionCapabilityService').classifyEmployeeHistoryResolutionCapability(data);
    assert.equal(capability.uniquePlan.status, 'APPLICABLE');
    assert.notEqual(settle(data).status, 'CLEAN');
    const result = project(data, {}, { simpleDecisionsOnly: true });
    assert.equal(result.state, 'automatic');
    assert.equal(result.previewOnly, true);
    assert.equal(result.executionEnabled, false);
    assert.ok(result.actions.some(item => item.startsWith('Ισχύοντα στοιχεία')));
    assert.ok(result.actions.some(item => item.includes('Συνδυασμός 1')));
    assert.doesNotMatch(JSON.stringify(result), /shape-b|fingerprint|desiredHistoryRows|historyId|currentPatch/);
    assert.equal(A.stringify(data), before);
});
test('APPLICABLE alone cannot approve a unique plan with unrecorded required facts', () => {
    const data = uniqueInput(false), before = A.stringify(data);
    const capability = require('./employeeHistoryResolutionCapabilityService').classifyEmployeeHistoryResolutionCapability(data);
    assert.equal(capability.uniquePlan.status, 'APPLICABLE');
    const result = project(data, {}, { simpleDecisionsOnly: true });
    assert.equal(result.state, 'unknown');
    assert.equal(result.reviewRequired, true);
    assert.deepEqual(result.actions, []);
    assert.equal(A.stringify(data), before);
});
for (const kind of ['missing', 'unknown', 'mismatched']) test(`unique repair cannot bypass ${kind} protected-reference evidence`, () => {
    const data = uniqueInput(), id = String(data.completeHistoryRows[0]._id);
    if (kind === 'missing') delete data.protectedReferenceSummary[id];
    if (kind === 'unknown') data.protectedReferenceSummary[id] = [{ collection: 'Unknown' }];
    if (kind === 'mismatched') data.protectedReferenceSummary[id][0].historyId = 'another-history';
    assert.equal(project(data).state, 'unknown');
});


const { buildSettlementExplanation: explain } = require('./employeeHistorySettlementExplanationService');
const U = require('./fixtures/unifiedEmployeeHistorySettlementFixtures');
const { sortHistoryForPresentation } = require('../../utils/ergazomenoi/employmentHistoryPresentation');
test('settlement explanation: real coordinator contradiction is read-only and has no execution capability', t => {
    require('../../../test/fixtures/forbidRealSettlementMongo').forbidRealSettlementMongo(t.mock);
    const data = U.families.find(item => item.number === 26).make(), before = A.stringify(data);
    const result = project(data, {}, { unified: true });
    assert.equal(result.state, 'unknown');
    assert.equal(result.executionEnabled, false);
    assert.match(result.explanation.finding, /διαφορετικές ημερομηνίες αποχώρησης/);
    assert.match(result.explanation.safety, /ημερομηνία αποχώρησης/);
    assert.match(result.explanation.locations.join(' '), /δεν προσδιορίζουν με ασφάλεια/);
    assert.doesNotMatch(JSON.stringify(result.explanation), /620000000000|historyId|aa_eggrafhs|fingerprint|token|stack|SYNTHETIC/);
    assert.equal(A.stringify(data), before);
});
test('settlement explanation: missing or unknown diagnostics do not invent a contradiction or location', () => {
    for (const plan of [{}, { reason: 'NO_SAFE_COMPLETE_PLAN' }, {reason: 'SECRET_INTERNAL', attempts: [null, {issues: ['SECRET_INTERNAL'], coverageGaps: [{}]}]}]) {
        const result = explain({plan});
        assert.match(result.finding, /Κανένα.*δεν επαληθεύτηκε/);
        assert.doesNotMatch(result.finding, /περιέχουν αντίφαση/);
        assert.match(result.locations.join(' '), /δεν προσδιορίζουν με ασφάλεια/);
        assert.doesNotMatch(JSON.stringify(result), /SECRET_INTERNAL|undefined|Invalid Date/);
    }
});
function explanationGapFixture() {
    const before = U.period(81, { to: '2026-01-31', aa_eggrafhs: '9876' });
    const after = U.period(82, { from: '2026-03-01', aa_eggrafhs: '0123' });
    const inactive = U.period(83, { from: '2026-01-01', employment_history_canonical_status: 'WITHDRAWN_ERRONEOUS' });
    const rows = [after, inactive, before];
    const plan = {reason: 'HISTORY_COVERAGE_MISSING', attempts: [{solver:'EXISTING_STATE',
        coverageGaps:[{hire:'2026-01-01',from:'2026-02-01',to:'2026-02-28',beforeHistoryId:before._id,afterHistoryId:after._id}]}]};
    return {rows, plan};
}
test('settlement explanation: real diagnostic boundaries use chronological visible numbers, including inactive rows', () => {
    const {rows, plan} = explanationGapFixture(), original = A.stringify(rows);
    const result = explain({plan,completeHistoryRows:rows});
    assert.equal(sortHistoryForPresentation(rows)[0]._id, rows[2]._id);
    assert.match(result.locations[0], /01\/02\/2026 έως 28\/02\/2026/);
    assert.match(result.locations[0], /Α\/Α 0001, 0002/);
    assert.doesNotMatch(JSON.stringify(result), /9876|0123|620000000000|beforeHistoryId|afterHistoryId/);
    assert.equal(A.stringify(rows), original);
});
test('settlement explanation: moved candidate boundaries never accuse original table rows', () => {
    const {rows, plan} = explanationGapFixture();
    plan.attempts[0].solver = 'MISSING_PERIODS';
    plan.attempts[0].coverageGaps[0].from = '2026-02-02';
    plan.attempts[0].coverageGaps[0].to = '2026-02-27';
    const result = explain({plan, completeHistoryRows:rows});
    assert.match(result.locations[0], /υποψήφιας πρότασης/);
    assert.doesNotMatch(result.locations[0], /Α\/Α/);
    assert.match(result.locations[0], /Δεν προσδιορίζεται με ασφάλεια/);
});
test('settlement explanation: invalid dates and unknown identities never become invented references', () => {
    const {rows, plan} = explanationGapFixture();
    plan.attempts[0].coverageGaps[0].from = '2026-02-31';
    let result = explain({plan,completeHistoryRows:rows});
    assert.doesNotMatch(JSON.stringify(result), /31\/02|Α\/Α/);
    plan.attempts[0].coverageGaps[0].from = '2026-02-01';
    plan.attempts[0].coverageGaps[0].beforeHistoryId = 'SECRET_TOKEN';
    plan.attempts[0].coverageGaps[0].afterHistoryId = 'OTHER_SECRET';
    result = explain({plan,completeHistoryRows:rows});
    assert.doesNotMatch(JSON.stringify(result), /SECRET|Α\/Α/);
});

test('settlement explanation: incomplete row evidence and candidate-only issues remain qualified', () => {
    const descriptions = {CONFLICTING_PROFILE_EVENTS:'Υπάρχουν διαφορετικοί όροι για την ίδια περίοδο.'};
    const plan = {reason:'NO_SAFE_COMPLETE_PLAN',issues:['CONFLICTING_PROFILE_EVENTS','SECRET_INTERNAL'],attempts:[{solver:'CANDIDATE',issues:['CONFLICTING_PROFILE_EVENTS']}]};
    for (const rows of [[null], [{_id:'same'},{_id:'same'}]]) {
        const result = explain({plan,completeHistoryRows:rows,descriptions});
        assert.match(result.finding,/Κανένα.*δεν επαληθεύτηκε/);
        assert.match(result.locations[0],/υποψήφιας πρότασης/);
        assert.doesNotMatch(JSON.stringify(result),/SECRET_INTERNAL|Α\/Α/);
    }
});
