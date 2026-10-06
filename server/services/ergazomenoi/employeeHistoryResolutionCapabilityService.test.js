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

test('capability classification preserves UNIQUE and identifies exactly the four generic MULTIPLE shapes', () => {
    assert.equal(classifyEmployeeHistoryResolutionCapability(shapeALifecycleFixture())
        .resolutionClass, RESOLUTION_CLASSES.UNIQUE_SAFE_PLAN);
    for (const factory of [samePeriodMateriallyDifferentProfilesFixture,
        correctionFromHireOrSpecialtyChangeFixture, optionalIntermediateProfileFixture,
        realStartOfFourDayProfileFixture]) {
        assert.equal(classifyEmployeeHistoryResolutionCapability(factory()).resolutionClass,
            RESOLUTION_CLASSES.MULTIPLE_SAFE_BUSINESS_PLANS, factory().name);
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
