'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { RESOLUTION_CLASSES } = require('./employeeHistoryResolutionAnalysisService');
const { classifyEmployeeHistoryResolutionCapability } =
    require('./employeeHistoryResolutionCapabilityService');
const { shapeALifecycleFixture } =
    require('./fixtures/uniqueSafeEmployeeHistoryRepairFixtures');
const { samePeriodMateriallyDifferentProfilesFixture,
    correctionFromHireOrSpecialtyChangeFixture,
    optionalIntermediateProfileFixture,
    realStartOfFourDayProfileFixture } =
    require('./fixtures/multipleSafeEmployeeHistoryResolutionFixtures');
const { competingDepartureDatesFixture, departureAndHistoricalPayFactFixture } =
    require('./fixtures/businessFactEmployeeHistoryResolutionFixtures');
const { h1MissingInitialProfileFixture, h2KpkBoundaryFixture,
    h3IntermediateOverlapFixture } =
    require('./fixtures/userConfirmedEmployeeHistoryCorrectionFixtures');

test('capability classification preserves UNIQUE and identifies exactly the four generic MULTIPLE shapes', () => {
    const unique = classifyEmployeeHistoryResolutionCapability(shapeALifecycleFixture());
    assert.equal(unique.resolutionClass, RESOLUTION_CLASSES.UNIQUE_SAFE_PLAN);
    assert.equal(unique.factCollectionReady, false);
    assert.equal(unique.userConfirmedCorrectionReady, false);
    for (const factory of [samePeriodMateriallyDifferentProfilesFixture,
        correctionFromHireOrSpecialtyChangeFixture, optionalIntermediateProfileFixture,
        realStartOfFourDayProfileFixture]) {
        const result = classifyEmployeeHistoryResolutionCapability(factory());
        assert.equal(result.resolutionClass,
            RESOLUTION_CLASSES.MULTIPLE_SAFE_BUSINESS_PLANS, factory().name);
        assert.equal(result.factCollectionReady, false, factory().name);
        assert.equal(result.userConfirmedCorrectionReady, false, factory().name);
    }
});

test('eight sanitized unsupported ambiguity variants remain BUSINESS_FACT_REQUIRED', () => {
    const variants = [
        ['AMBIGUOUS_DEPARTURE_FACTS', row => { row.hmeromhnia_apoxorhshs = '2026-08-30'; }],
        ['UNSUPPORTED_THREE_DAY_ALTERNATIVE', row => {
            row.hmeres_ergasias_ebdomadas = 3; row.ores_ergasias_ebdomadas = 21;
        }],
        ['UNSUPPORTED_HOURS_ALTERNATIVE', row => { row.ores_ergasias_ebdomadas = 29; }],
        ['UNSUPPORTED_SPECIALTY_AND_HOURS', row => {
            row.eidikothta_symbashs = '0099'; row.ores_ergasias_ebdomadas = 31;
        }],
        ['UNSUPPORTED_SCHEDULE_ONLY_EVIDENCE', row => {
            row.hmeromhnia_allaghs_orarioy_apo = '2026-06-30';
            row.hmeres_ergasias_ebdomadas = 3;
        }],
        ['UNSUPPORTED_CURRENT_AGREEMENT', row => {
            row.hmeres_ergasias_ebdomadas = 6; row.ores_ergasias_ebdomadas = 40;
        }],
        ['UNSUPPORTED_MULTIPLE_BOUNDARIES', row => {
            row.hmeromhnia_isxyos_oron_ergasias_eos = '2026-07-04';
            row.hmeres_ergasias_ebdomadas = 3;
        }],
        ['UNSUPPORTED_BUSINESS_MEANING', row => {
            row.hmeres_ergasias_ebdomadas = 1; row.ores_ergasias_ebdomadas = 7;
        }]
    ];
    for (const [name, mutate] of variants) {
        const fixture = samePeriodMateriallyDifferentProfilesFixture();
        mutate(fixture.completeHistoryRows[1]);
        const result = classifyEmployeeHistoryResolutionCapability(fixture);
        assert.equal(result.resolutionClass, RESOLUTION_CLASSES.BUSINESS_FACT_REQUIRED, name);
    }
});

test('unknown and live references fail closed as ADMIN_REVIEW_REQUIRED', () => {
    const unknown = samePeriodMateriallyDifferentProfilesFixture();
    delete unknown.protectedReferenceSummary['m1-two-day'];
    assert.equal(classifyEmployeeHistoryResolutionCapability(unknown).resolutionClass,
        RESOLUTION_CLASSES.ADMIN_REVIEW_REQUIRED);
});

test('exactly five generic departure cases remain BUSINESS_FACT_REQUIRED and become collection-ready', () => {
    const fixtures = [
        competingDepartureDatesFixture({ name: 'departure-one', hire: '2026-04-29',
            firstDeparture: '2026-08-19', secondDeparture: '2026-08-20' }),
        departureAndHistoricalPayFactFixture(),
        competingDepartureDatesFixture({ name: 'departure-three', hire: '2026-04-23',
            firstDeparture: '2026-07-04', secondDeparture: '2026-07-05',
            includeOpenProfile: false }),
        competingDepartureDatesFixture({ name: 'departure-four', hire: '2026-05-02',
            firstDeparture: '2026-06-25', secondDeparture: '2026-06-28' }),
        competingDepartureDatesFixture({ name: 'departure-five', hire: '2026-06-22',
            firstDeparture: '2026-07-27', secondDeparture: '2026-07-31' })
    ];
    for (const fixture of fixtures) {
        const result = classifyEmployeeHistoryResolutionCapability(fixture);
        assert.equal(result.resolutionClass, RESOLUTION_CLASSES.BUSINESS_FACT_REQUIRED);
        assert.equal(result.factCollectionReady, true);
        assert.equal(result.userConfirmedCorrectionReady, false);
        assert.equal(result.businessFactPlan.status, 'APPLICABLE');
    }
});

test('ακριβώς τα τρία γενικά H1/H2/H3 είναι userConfirmedCorrectionReady', () => {
    const fixtures = [h1MissingInitialProfileFixture(), h2KpkBoundaryFixture(),
        h3IntermediateOverlapFixture()];
    const shapes = new Set();
    for (const fixture of fixtures) {
        const result = classifyEmployeeHistoryResolutionCapability(fixture);
        assert.equal(result.resolutionClass, RESOLUTION_CLASSES.BUSINESS_FACT_REQUIRED,
            fixture.name);
        assert.equal(result.factCollectionReady, false, fixture.name);
        assert.equal(result.userConfirmedCorrectionReady, true, fixture.name);
        assert.equal(result.userCorrectionPlan.status, 'APPLICABLE', fixture.name);
        shapes.add(result.userCorrectionPlan.shapeKind);
    }
    assert.equal(shapes.size, 3);
});

test('initial-profile fact shapes stay BUSINESS_FACT_REQUIRED without incomplete questions', () => {
    const deferred = [
        ['missing-initial-work-terms', row => { row.hmeres_ergasias_ebdomadas = 3; }],
        ['conflicting-initial-hours', row => { row.ores_ergasias_ebdomadas = 29; }],
        ['specialty-and-terms-required', row => {
            row.eidikothta_symbashs = '0099'; row.hmeres_ergasias_ebdomadas = 4;
        }]
    ];
    for (const [name, mutate] of deferred) {
        const fixture = departureAndHistoricalPayFactFixture();
        mutate(fixture.completeHistoryRows[2]);
        const result = classifyEmployeeHistoryResolutionCapability(fixture);
        assert.equal(result.resolutionClass, RESOLUTION_CLASSES.BUSINESS_FACT_REQUIRED, name);
        assert.equal(result.factCollectionReady, false, name);
    }
});
