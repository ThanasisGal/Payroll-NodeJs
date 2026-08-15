const assert = require('assert');

const {
    getOrarioTermsForDate,
    resolveEmploymentTypeValue,
    resolveEmploymentTypeFromFormData,
    normalizeWeeklyWorkdaysValue,
    resolveEffectiveWeeklyWorkdays,
    buildCanonicalWorkTermsSnapshotFields,
    resolveWorkTermsPeriodIntent,
    getPreviousUtcDate,
    getEffectiveTermsApo,
    getEffectiveTermsEos
} = require('./getOrarioTermsForDate');
const {
    normalizeEmploymentType
} = require('../../services/ergazomenoi/apasxoliseisWeeklyRepoTransferSinglePairService');

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function historyRecord(overrides = {}) {
    return {
        _id: 'history-1',
        afora_allagh_oron_ergasias: true,
        hmeromhnia_isxyos_oron_ergasias_apo: '2026-06-01',
        hmeromhnia_isxyos_oron_ergasias_eos: null,
        hmeres_ergasias_ebdomadas: 5,
        ores_ergasias_ebdomadas: 40,
        mo_oron_hmerhsias_ergasias: 8,
        typos_ebdomadas: '5HMERH',
        ...overrides
    };
}

function currentProfile(overrides = {}) {
    return getOrarioTermsForDate('2026-06-10', [], {
        hmeres_ergasias_ebdomadas: 5,
        ores_ergasias_ebdomadas: 40,
        mo_oron_hmerhsias_ergasias: 8,
        apasxolhsh_basei_symbashs: '5',
        ...overrides
    });
}

function effectiveHistory(overrides = {}) {
    return getOrarioTermsForDate('2026-06-10', [historyRecord(overrides)], {});
}

function testCurrentCanonicalEmploymentTypes() {
    const expected = { 0: 'PLHRHS', 1: 'MERIKH', 2: 'EK_PERITROPHS' };

    Object.entries(expected).forEach(([raw, normalized]) => {
        const profile = currentProfile({ kathestos_apasxolhshs: raw });
        assert.strictEqual(profile.kathestos_apasxolhshs, raw);
        assert.strictEqual(profile.typos_apasxolhshs, raw);
        assert.strictEqual(normalizeEmploymentType(profile.typos_apasxolhshs), normalized);
        assert.strictEqual(profile.source, 'ERG_AKTUAL');
    });
}

function testHistoryCanonicalEmploymentTypesAndPrecedence() {
    const cases = [
        ['0', '5', 'PLHRHS'],
        ['1', '6', 'MERIKH'],
        ['2', '5', 'EK_PERITROPHS']
    ];

    cases.forEach(([canonical, badLegacy, normalized]) => {
        const profile = effectiveHistory({
            kathestos_apasxolhshs: canonical,
            typos_apasxolhshs: badLegacy
        });
        assert.strictEqual(profile.kathestos_apasxolhshs, canonical);
        assert.strictEqual(profile.typos_apasxolhshs, canonical);
        assert.strictEqual(normalizeEmploymentType(profile.typos_apasxolhshs), normalized);
        assert.strictEqual(profile.source, 'ISTORIKO');
        assert.strictEqual(profile.istorikoId, 'history-1');
    });
}

function testHistoricalSixthDayPremiumRatePrecedence() {
    const profile = getOrarioTermsForDate(
        '2026-06-10',
        [historyRecord({ pososto_prosayxhshs_6hs_hmeras: 12.5 })],
        { pososto_prosayxhshs_6hs_hmeras: 40 }
    );
    assert.strictEqual(profile.source, 'ISTORIKO');
    assert.strictEqual(profile.pososto_prosayxhshs_6hs_hmeras, 12.5);

    const fallback = currentProfile({ pososto_prosayxhshs_6hs_hmeras: 0 });
    assert.strictEqual(fallback.pososto_prosayxhshs_6hs_hmeras, 0);
}

function testSafeLegacyFallback() {
    const expected = {
        PLHRHS: 'PLHRHS',
        MERIKH: 'MERIKH',
        EK_PERITROPHS: 'EK_PERITROPHS'
    };

    Object.entries(expected).forEach(([legacy, normalized]) => {
        const profile = effectiveHistory({
            kathestos_apasxolhshs: '',
            typos_apasxolhshs: legacy
        });
        assert.strictEqual(normalizeEmploymentType(profile.typos_apasxolhshs), normalized);
    });
}

function testWeeklyDayValuesAreRejected() {
    ['5', '6', '5HMERH', '6HMERH'].forEach((weeklyDayType) => {
        assert.strictEqual(normalizeEmploymentType(weeklyDayType), null);
        assert.strictEqual(
            resolveEmploymentTypeValue({
                kathestos_apasxolhshs: '',
                typos_apasxolhshs: weeklyDayType
            }),
            ''
        );
        const profile = effectiveHistory({
            kathestos_apasxolhshs: '',
            typos_apasxolhshs: weeklyDayType
        });
        assert.strictEqual(profile.typos_apasxolhshs, '');
        assert.strictEqual(normalizeEmploymentType(profile.typos_apasxolhshs), null);
    });
}

function testInvalidCanonicalDoesNotUseLegacyFallback() {
    assert.strictEqual(
        resolveEmploymentTypeValue({
            kathestos_apasxolhshs: '5',
            typos_apasxolhshs: 'PLHRHS'
        }),
        ''
    );
}

function testFormCanonicalInvalidValueBlocksLegacyFallback() {
    [
        ['5', 'PLHRHS'],
        ['6', 'MERIKH'],
        ['5HMERH', 'EK_PERITROPHS']
    ].forEach(([canonical, legacy]) => {
        assert.strictEqual(
            resolveEmploymentTypeFromFormData({
                kathestos_apasxolhshs: canonical,
                typos_apasxolhshs: legacy
            }),
            ''
        );
    });

    assert.strictEqual(
        resolveEmploymentTypeFromFormData({
            kathestos_apasxolhshs_stathera: '5',
            kathestos_apasxolhshs: '0',
            typos_apasxolhshs: 'PLHRHS'
        }),
        ''
    );

    assert.strictEqual(
        resolveEmploymentTypeFromFormData({
            kathestos_apasxolhshs_stathera: '',
            kathestos_apasxolhshs: '0'
        }),
        '0'
    );
    assert.strictEqual(
        resolveEmploymentTypeFromFormData({
            kathestos_apasxolhshs_stathera: '',
            kathestos_apasxolhshs: '',
            typos_apasxolhshs: 'PLHRHS'
        }),
        '0'
    );
    assert.strictEqual(
        resolveEmploymentTypeFromFormData({
            kathestos_apasxolhshs_stathera: '1',
            kathestos_apasxolhshs: '0'
        }),
        '1'
    );
    assert.strictEqual(
        resolveEmploymentTypeFromFormData({
            kathestos_apasxolhshs_stathera: '   ',
            kathestos_apasxolhshs: '2'
        }),
        '2'
    );
}

function testWeeklyWorkdaysNormalizationAndPriority() {
    [5, '5', '5HMERH', '5ΗΜΕΡΗ', '5ΗΜΕΡΟ'].forEach((value) => {
        assert.strictEqual(normalizeWeeklyWorkdaysValue(value), 5);
    });
    [6, '6', '6HMERH', '6ΗΜΕΡΗ', '6ΗΜΕΡΟ'].forEach((value) => {
        assert.strictEqual(normalizeWeeklyWorkdaysValue(value), 6);
    });
    [0, 1, 2, 3, 4, 7, '5.0', 'invalid', null, undefined].forEach((value) => {
        assert.strictEqual(normalizeWeeklyWorkdaysValue(value), null);
    });

    assert.strictEqual(
        resolveEffectiveWeeklyWorkdays({
            hmeres_ergasias_ebdomadas: 3,
            typos_ebdomadas: '6HMERH',
            apasxolhsh_basei_symbashs: '5'
        }),
        6
    );
}

function testSnapshotFields() {
    const fiveDay = buildCanonicalWorkTermsSnapshotFields({
        kathestos_apasxolhshs: '0',
        apasxolhsh_basei_symbashs: '6',
        hmeres_ergasias_ebdomadas: 5
    });
    assert.deepStrictEqual(fiveDay, {
        kathestos_apasxolhshs: '0',
        typos_apasxolhshs: '0',
        typos_ebdomadas: '5HMERH',
        pososto_prosayxhshs_6hs_hmeras: null
    });

    const sixDay = buildCanonicalWorkTermsSnapshotFields({
        kathestos_apasxolhshs: '2',
        apasxolhsh_basei_symbashs: '5',
        hmeres_ergasias_ebdomadas: 6
    });
    assert.deepStrictEqual(sixDay, {
        kathestos_apasxolhshs: '2',
        typos_apasxolhshs: '2',
        typos_ebdomadas: '6HMERH',
        pososto_prosayxhshs_6hs_hmeras: null
    });
}

function testInputImmutability() {
    const employee = {
        kathestos_apasxolhshs: '0',
        hmeres_ergasias_ebdomadas: 5,
        ores_ergasias_ebdomadas: 40
    };
    const history = [historyRecord({ kathestos_apasxolhshs: '1' })];
    const employeeBefore = clone(employee);
    const historyBefore = clone(history);

    getOrarioTermsForDate('2026-06-10', history, employee);

    assert.deepStrictEqual(employee, employeeBefore);
    assert.deepStrictEqual(history, historyBefore);
}

function testScheduleOnlyDoesNotBecomeTermsPeriod() {
    const intent = resolveWorkTermsPeriodIntent({
        hmeromhnia_allaghs_orarioy_apo: '2026-06-22',
        hmeromhnia_allaghs_orarioy_eos: '2026-06-28',
        hmeromhnia_isxyos_oron_ergasias_apo: '2026-05-25',
        kathestos_apasxolhshs: '0',
        hmeres_ergasias_ebdomadas: 5,
        ores_ergasias_ebdomadas: 40
    });
    assert.deepStrictEqual(intent, {
        isTermsChange: false,
        effectiveFrom: null,
        effectiveTo: null,
        valid: true
    });
    const profile = getOrarioTermsForDate('2026-06-22', [historyRecord({
        afora_allagh_oron_ergasias: false,
        hmeromhnia_allaghs_orarioy_apo: '2026-06-22',
        hmeromhnia_allaghs_orarioy_eos: '2026-06-28',
        kathestos_apasxolhshs: '1'
    })], { kathestos_apasxolhshs: '0' });
    assert.strictEqual(profile.source, 'ERG_AKTUAL');
    assert.strictEqual(profile.kathestos_apasxolhshs, '0');
}

function testAuthoritativeMutationCodesCreateOpenEndedTermsPeriod() {
    for (const code of ['007', '008', '014', '015']) {
        const intent = resolveWorkTermsPeriodIntent({
            typos_metabolhs: [code],
            hmeromhnia_metabolhs: '2026-08-20',
            // Schedule/contract dates must not define the terms period.
            hmeromhnia_allaghs_orarioy_apo: '2026-08-18',
            hmeromhnia_isxyos_oron_ergasias_eos: '2026-12-31'
        });
        assert.strictEqual(intent.isTermsChange, true, code);
        assert.strictEqual(intent.valid, true, code);
        assert.strictEqual(intent.effectiveFrom.toISOString().slice(0, 10), '2026-08-20');
        assert.strictEqual(intent.effectiveTo, null);
    }
}

function testUnrelatedMutationCodeIsScheduleOnly() {
    const intent = resolveWorkTermsPeriodIntent({
        typos_metabolhs: ['006'],
        hmeromhnia_metabolhs: '2026-08-20',
        hmeromhnia_allaghs_orarioy_apo: '2026-08-18'
    });
    assert.deepStrictEqual(intent, {
        isTermsChange: false,
        effectiveFrom: null,
        effectiveTo: null,
        valid: true
    });
}

function testMutationDateIsRequiredAndClosesPreviousAtPreviousDay() {
    const missingDate = resolveWorkTermsPeriodIntent({ typos_metabolhs: ['007'] });
    assert.strictEqual(missingDate.isTermsChange, true);
    assert.strictEqual(missingDate.valid, false);
    assert.strictEqual(getPreviousUtcDate('2026-08-20').toISOString().slice(0, 10),
        '2026-08-19');
    assert.strictEqual(getPreviousUtcDate(null), null);
}

function testExplicitTermsDatesDoNotFallBackByTruthiness() {
    const explicitEnd = {
        hmeromhnia_isxyos_oron_ergasias_eos: '2026-06-14',
        hmeromhnia_allaghs_orarioy_eos: '2026-06-30'
    };
    assert.strictEqual(getEffectiveTermsEos(explicitEnd).toISOString().slice(0, 10),
        '2026-06-14');

    const openEnded = {
        hmeromhnia_isxyos_oron_ergasias_eos: null,
        hmeromhnia_allaghs_orarioy_eos: '2026-06-22'
    };
    assert.strictEqual(getEffectiveTermsEos(openEnded), null);

    const legacyEnd = { hmeromhnia_allaghs_orarioy_eos: '2026-06-22' };
    assert.strictEqual(getEffectiveTermsEos(legacyEnd).toISOString().slice(0, 10),
        '2026-06-22');

    const explicitNullStart = {
        hmeromhnia_isxyos_oron_ergasias_apo: null,
        hmeromhnia_allaghs_orarioy_apo: '2026-06-16'
    };
    assert.strictEqual(getEffectiveTermsApo(explicitNullStart), null);
    const legacyStart = { hmeromhnia_allaghs_orarioy_apo: '2026-06-16' };
    assert.strictEqual(getEffectiveTermsApo(legacyStart).toISOString().slice(0, 10),
        '2026-06-16');
}

function testOpenEndedTermsPeriodOutlivesItsScheduleWindow() {
    const full = historyRecord({
        _id: 'full',
        kathestos_apasxolhshs: '0',
        hmeromhnia_isxyos_oron_ergasias_apo: '2026-06-15',
        hmeromhnia_isxyos_oron_ergasias_eos: null,
        hmeromhnia_allaghs_orarioy_apo: '2026-06-16',
        hmeromhnia_allaghs_orarioy_eos: '2026-06-22'
    });
    for (const date of [
        '2026-06-15', '2026-06-22', '2026-06-23', '2026-06-30',
        '2026-07-01', '2026-07-05', '2026-10-16'
    ]) {
        const result = getOrarioTermsForDate(date, [full], {});
        assert.strictEqual(result.kathestos_apasxolhshs, '0', date);
        assert.strictEqual(result.istorikoId, 'full', date);
    }
}

function testExplicitConsecutiveTermsPeriodsResolveByDate() {
    const intent = resolveWorkTermsPeriodIntent({
        typos_metabolhs: ['014'],
        hmeromhnia_metabolhs: '2026-06-15',
        kathestos_apasxolhshs: '0'
    });
    assert.strictEqual(intent.valid, true);
    assert.strictEqual(intent.effectiveFrom.toISOString().slice(0, 10), '2026-06-15');

    const periods = [
        historyRecord({ _id: 'partial', kathestos_apasxolhshs: '1',
            hmeromhnia_isxyos_oron_ergasias_apo: '2026-05-25',
            hmeromhnia_isxyos_oron_ergasias_eos: '2026-06-14' }),
        historyRecord({ _id: 'full', kathestos_apasxolhshs: '0',
            hmeromhnia_isxyos_oron_ergasias_apo: '2026-06-15',
            hmeromhnia_isxyos_oron_ergasias_eos: null })
    ];
    assert.strictEqual(getOrarioTermsForDate('2026-06-14', periods, {})
        .kathestos_apasxolhshs, '1');
    assert.strictEqual(getOrarioTermsForDate('2026-06-15', periods, {})
        .kathestos_apasxolhshs, '0');
    for (const date of ['2026-07-01', '2026-07-05', '2026-10-16']) {
        assert.strictEqual(getOrarioTermsForDate(date, periods, {})
            .kathestos_apasxolhshs, '0', date);
    }
}

function testEqualEffectiveStartUsesDeterministicSecondaryOrder() {
    const sameStart = [
        historyRecord({ _id: 'older', aa_eggrafhs: '0002',
            kathestos_apasxolhshs: '1', updatedAt: '2026-06-01T00:00:00Z' }),
        historyRecord({ _id: 'newer', aa_eggrafhs: '0003',
            kathestos_apasxolhshs: '0', updatedAt: '2026-06-02T00:00:00Z' })
    ];
    for (const order of [sameStart, [...sameStart].reverse()]) {
        const result = getOrarioTermsForDate('2026-06-10', order, {});
        assert.strictEqual(result.istorikoId, 'newer');
        assert.strictEqual(result.kathestos_apasxolhshs, '0');
    }
}

function run() {
    testCurrentCanonicalEmploymentTypes();
    testHistoryCanonicalEmploymentTypesAndPrecedence();
    testHistoricalSixthDayPremiumRatePrecedence();
    testSafeLegacyFallback();
    testWeeklyDayValuesAreRejected();
    testInvalidCanonicalDoesNotUseLegacyFallback();
    testFormCanonicalInvalidValueBlocksLegacyFallback();
    testWeeklyWorkdaysNormalizationAndPriority();
    testSnapshotFields();
    testInputImmutability();
    testScheduleOnlyDoesNotBecomeTermsPeriod();
    testAuthoritativeMutationCodesCreateOpenEndedTermsPeriod();
    testUnrelatedMutationCodeIsScheduleOnly();
    testMutationDateIsRequiredAndClosesPreviousAtPreviousDay();
    testExplicitTermsDatesDoNotFallBackByTruthiness();
    testOpenEndedTermsPeriodOutlivesItsScheduleWindow();
    testExplicitConsecutiveTermsPeriodsResolveByDate();
    testEqualEffectiveStartUsesDeterministicSecondaryOrder();
    console.log('getOrarioTermsForDate tests passed');
}

run();
