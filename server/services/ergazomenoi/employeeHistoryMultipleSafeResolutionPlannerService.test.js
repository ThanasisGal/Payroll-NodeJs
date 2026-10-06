'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { canonicalizeEmployeeHistory } = require('./employeeHistoryCanonicalizationService');
const { RESOLUTION_CLASSES } = require('./employeeHistoryResolutionAnalysisService');
const { PLAN_STATUSES, SHAPE_KINDS,
    planEmployeeHistoryMultipleSafeResolution,
    resolveEmployeeHistoryMultipleSafeChoice } =
    require('./employeeHistoryMultipleSafeResolutionPlannerService');
const { shapeALifecycleFixture } =
    require('./fixtures/uniqueSafeEmployeeHistoryRepairFixtures');
const {
    samePeriodMateriallyDifferentProfilesFixture,
    correctionFromHireOrSpecialtyChangeFixture,
    optionalIntermediateProfileFixture,
    realStartOfFourDayProfileFixture
} = require('./fixtures/multipleSafeEmployeeHistoryResolutionFixtures');

function planner(fixture, overrides = {}) {
    return planEmployeeHistoryMultipleSafeResolution({ ...fixture, ...overrides });
}

function choose(fixture, choiceId, answers) {
    const result = planner(fixture);
    return resolveEmployeeHistoryMultipleSafeChoice({ plannerResult: result, choiceId, answers,
        currentEmployee: fixture.currentEmployee,
        completeHistoryRows: fixture.completeHistoryRows });
}
function assertClean(execution) {
    assert.equal(execution.hypotheticalCanonicalResult.status, 'CLEAN');
    assert.equal(execution.hypotheticalCanonicalResult.cleanupRequired, false);
    assert.equal(execution.secondCanonicalResult.status, 'CLEAN');
    assert.match(execution.planFingerprint, /^[a-f0-9]{64}$/);
}

const detections = [
    [samePeriodMateriallyDifferentProfilesFixture,
        SHAPE_KINDS.SAME_PERIOD_PROFILE_ALTERNATIVES,
        ['KEEP_TWO_DAY_PROFILE', 'KEEP_FOUR_DAY_PROFILE', 'SPLIT_AT_2026_06_29']],
    [correctionFromHireOrSpecialtyChangeFixture,
        SHAPE_KINDS.CORRECTION_FROM_HIRE_OR_SPECIALTY_CHANGE,
        ['CORRECTION_FROM_HIRE', 'SPECIALTY_CHANGE_2026_07_02',
            'SPECIALTY_CHANGE_OTHER_DATE']],
    [optionalIntermediateProfileFixture,
        SHAPE_KINDS.OPTIONAL_INTERMEDIATE_PROFILE,
        ['INTERMEDIATE_PROFILE_NOT_REAL', 'INTERMEDIATE_PROFILE_FROM_2026_06_02',
            'INTERMEDIATE_PROFILE_OTHER_DATE']],
    [realStartOfFourDayProfileFixture,
        SHAPE_KINDS.FOUR_DAY_PROFILE_EFFECTIVE_START,
        ['FOUR_DAY_PROFILE_FROM_HIRE', 'FOUR_DAY_PROFILE_FROM_2026_07_13',
            'FOUR_DAY_PROFILE_FROM_OTHER_DATE']]
];

const expectedLabels = {
    [SHAPE_KINDS.SAME_PERIOD_PROFILE_ALTERNATIVES]: [
        'Ίσχυαν 2 ημέρες / 14 ώρες για όλη την περίοδο',
        'Ίσχυαν 4 ημέρες / 30 ώρες για όλη την περίοδο',
        'Έγινε πραγματική αλλαγή στις 29/06/2026'
    ],
    [SHAPE_KINDS.CORRECTION_FROM_HIRE_OR_SPECIALTY_CHANGE]: [
        'Η ειδικότητα 0004 ίσχυε από την πρόσληψη',
        'Η ειδικότητα άλλαξε στις 02/07/2026',
        'Η ειδικότητα άλλαξε σε άλλη ημερομηνία'
    ],
    [SHAPE_KINDS.OPTIONAL_INTERMEDIATE_PROFILE]: [
        'Η απασχόληση 2 ημερών / 16 ωρών ήταν λανθασμένη',
        'Η απασχόληση 2 ημερών / 16 ωρών ίσχυσε από 02/06/2026',
        'Η απασχόληση 2 ημερών / 16 ωρών ξεκίνησε σε άλλη ημερομηνία'
    ],
    [SHAPE_KINDS.FOUR_DAY_PROFILE_EFFECTIVE_START]: [
        'Οι 4 ημέρες / 34 ώρες ίσχυαν από την πρόσληψη',
        'Οι 4 ημέρες / 34 ώρες ίσχυαν από 13/07/2026',
        'Οι 4 ημέρες / 34 ώρες ίσχυαν από άλλη ημερομηνία'
    ]
};

const expectedOtherDateBounds = {
    [SHAPE_KINDS.CORRECTION_FROM_HIRE_OR_SPECIALTY_CHANGE]:
        { min: '2026-06-25', max: '2026-07-02' },
    [SHAPE_KINDS.OPTIONAL_INTERMEDIATE_PROFILE]:
        { min: '2026-05-26', max: '2026-06-08' },
    [SHAPE_KINDS.FOUR_DAY_PROFILE_EFFECTIVE_START]:
        { min: '2026-06-28', max: '2026-07-22' }
};

for (const [factory, kind, optionIds] of detections) test(
    `${kind} is detected generically with an exact deterministic safe option set`, () => {
        const fixture = factory();
        const first = planner(fixture);
        const second = planner(fixture);
        assert.equal(first.status, PLAN_STATUSES.APPLICABLE);
        assert.equal(first.resolutionClass, RESOLUTION_CLASSES.MULTIPLE_SAFE_BUSINESS_PLANS);
        assert.equal(first.resolutionKind, 'GUIDED_BUSINESS_CHOICE');
        assert.equal(first.shapeKind, kind);
        assert.deepEqual(first.businessOptions.map(option => option.id), optionIds);
        assert.deepEqual(first.businessOptions.map(option => option.label), expectedLabels[kind]);
        const dateOption = first.businessOptions.find(option => option.inputs);
        assert.deepEqual(dateOption?.inputs?.[0] && {
            min: dateOption.inputs[0].min, max: dateOption.inputs[0].max
        }, expectedOtherDateBounds[kind]);
        assert.equal(first.optionSetFingerprint, second.optionSetFingerprint);
        assert.equal(JSON.stringify(first.businessOptions).includes('historyId'), false);
        assert.equal(JSON.stringify(first.businessOptions).includes('_id'), false);
    });

test('M1 executes both whole-period meanings and the offered split as clean cloned states', () => {
    const fixture = samePeriodMateriallyDifferentProfilesFixture();
    for (const choiceId of ['KEEP_TWO_DAY_PROFILE', 'KEEP_FOUR_DAY_PROFILE',
        'SPLIT_AT_2026_06_29']) assertClean(choose(fixture, choiceId));
    assert.equal(choose(fixture, 'KEEP_TWO_DAY_PROFILE').physicalDeleteIds.length, 0);
});

test('M2 supports correction, predefined change and bounded alternate change date', () => {
    const fixture = correctionFromHireOrSpecialtyChangeFixture();
    const correction = choose(fixture, 'CORRECTION_FROM_HIRE');
    assertClean(correction);
    assert.deepEqual(correction.physicalDeleteIds, ['507f1f77bcf86cd799439211']);
    assertClean(choose(fixture, 'SPECIALTY_CHANGE_2026_07_02'));
    const alternate = choose(fixture, 'SPECIALTY_CHANGE_OTHER_DATE',
        { effectiveDate: '2026-06-28' });
    assertClean(alternate);
    assert.equal(alternate.normalizedAnswers.effectiveDate, '2026-06-28');
    for (const effectiveDate of ['2026-06-24', '2026-07-03', '2026-02-30',
        '06/28/2026', '2026-06-28T00:00:00.000Z', '2026-06-28T03:00:00+03:00']) {
        assert.throws(() => choose(fixture,
        'SPECIALTY_CHANGE_OTHER_DATE', { effectiveDate }), error =>
        ['EMPLOYEE_HISTORY_RESOLUTION_DATE_INVALID',
            'EMPLOYEE_HISTORY_RESOLUTION_DATE_OUT_OF_RANGE'].includes(error.code));
    }
});

test('M3 supports removal, predefined intermediate start and a safe alternate start', () => {
    const fixture = optionalIntermediateProfileFixture();
    for (const choiceId of ['INTERMEDIATE_PROFILE_NOT_REAL',
        'INTERMEDIATE_PROFILE_FROM_2026_06_02']) assertClean(choose(fixture, choiceId));
    assertClean(choose(fixture, 'INTERMEDIATE_PROFILE_OTHER_DATE',
        { effectiveDate: '2026-05-30' }));
    for (const effectiveDate of ['2026-05-25', '2026-06-09']) assert.throws(() =>
        choose(fixture, 'INTERMEDIATE_PROFILE_OTHER_DATE', { effectiveDate }), error =>
        error.code === 'EMPLOYEE_HISTORY_RESOLUTION_DATE_OUT_OF_RANGE');
});

test('M4 supports from-hire, predefined split and a safe alternate split', () => {
    const fixture = realStartOfFourDayProfileFixture();
    for (const choiceId of ['FOUR_DAY_PROFILE_FROM_HIRE',
        'FOUR_DAY_PROFILE_FROM_2026_07_13']) assertClean(choose(fixture, choiceId));
    assertClean(choose(fixture, 'FOUR_DAY_PROFILE_FROM_OTHER_DATE',
        { effectiveDate: '2026-07-05' }));
    for (const effectiveDate of ['2026-06-27', '2026-07-23']) assert.throws(() =>
        choose(fixture, 'FOUR_DAY_PROFILE_FROM_OTHER_DATE', { effectiveDate }), error =>
        error.code === 'EMPLOYEE_HISTORY_RESOLUTION_DATE_OUT_OF_RANGE');
});

test('strict choice and answer allowlists reject unknown choices, extra answers and row ids', () => {
    const fixture = realStartOfFourDayProfileFixture();
    for (const [choiceId, answers] of [
        ['UNKNOWN', undefined],
        ['FOUR_DAY_PROFILE_FROM_HIRE', {}],
        ['FOUR_DAY_PROFILE_FROM_OTHER_DATE', { effectiveDate: '2026-07-05', historyId: 'x' }],
        ['FOUR_DAY_PROFILE_FROM_OTHER_DATE', { historyId: 'x' }]
    ]) assert.throws(() => choose(fixture, choiceId, answers), error =>
        error.code === 'EMPLOYEE_HISTORY_RESOLUTION_INVALID_REQUEST');
});

test('BUSINESS_FACT_REQUIRED-shaped and UNIQUE_SAFE_PLAN histories never become multiple', () => {
    const unique = shapeALifecycleFixture();
    assert.notEqual(planner(unique).status, PLAN_STATUSES.APPLICABLE);
    assert.equal(planner(unique, { existingResolutionAnalysis: {
        resolutionClass: RESOLUTION_CLASSES.UNIQUE_SAFE_PLAN
    } }).reason, 'UNIQUE_SAFE_PLAN_OWNS_AMBIGUITY');

    const businessFact = samePeriodMateriallyDifferentProfilesFixture();
    businessFact.completeHistoryRows[1].hmeres_ergasias_ebdomadas = 3;
    businessFact.completeHistoryRows[1].ores_ergasias_ebdomadas = 20;
    assert.equal(planner(businessFact).status, PLAN_STATUSES.NOT_APPLICABLE);
});

test('current-master agreement and schedule evidence only offer choices, never silently select one', () => {
    const m2 = planner(correctionFromHireOrSpecialtyChangeFixture());
    assert.equal(m2.status, PLAN_STATUSES.APPLICABLE);
    assert.equal(m2.businessOptions.length, 3);
    assert.equal(m2.businessOptions.some(option => option.recommended === true), false);
    const m4 = planner(realStartOfFourDayProfileFixture());
    assert.equal(m4.businessOptions.length, 3);
    assert.equal(m4.businessOptions.some(option => option.selected === true), false);
});

test('LIVE and UNKNOWN reference states fail closed before an option is offered', () => {
    const live = samePeriodMateriallyDifferentProfilesFixture();
    const liveResult = planner(live, { referencePartitioner: references => ({
        frozenProvenance: [], liveDereference: references
    }) });
    assert.equal(liveResult.status, PLAN_STATUSES.BLOCKED);
    assert.equal(liveResult.referenceClass, 'LIVE_REFERENCE');

    const unknown = samePeriodMateriallyDifferentProfilesFixture();
    delete unknown.protectedReferenceSummary['m1-two-day'];
    const unknownResult = planner(unknown);
    assert.equal(unknownResult.status, PLAN_STATUSES.BLOCKED);
    assert.equal(unknownResult.reason, 'REFERENCE_STATE_NOT_LOADED');
});

test('resolved output is canonical, stable and idempotent', () => {
    for (const [factory, , options] of detections) {
        const fixture = factory();
        const execution = choose(fixture, options[0]);
        const current = { ...fixture.currentEmployee, ...execution.currentPatch };
        const canonical = canonicalizeEmployeeHistory({ scope: fixture.scope,
            currentEmployee: current, historyRows: execution.desiredHistoryRows });
        assert.equal(canonical.status, 'CLEAN');
        assert.equal(canonical.cleanupRequired, false);
    }
});
