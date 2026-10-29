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
