const assert = require('assert');

const {
    getOrarioTermsForDate,
    resolveEmploymentTypeValue,
    resolveEmploymentTypeFromFormData,
    normalizeWeeklyWorkdaysValue,
    resolveEffectiveWeeklyWorkdays,
    buildCanonicalWorkTermsSnapshotFields
} = require('./getOrarioTermsForDate');
const {
    normalizeEmploymentType
} = require('../../services/ergazomenoi/apasxoliseisWeeklyRepoTransferSinglePairService');
const {
    resolveEffectiveExpectedWeeklyRepo
} = require('../../services/ergazomenoi/apasxoliseisWeeklyRepoTransferExpectedRepoResolverService');

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
    [1, 2, 3, 4, '1', '2', '3', '4'].forEach((value) => {
        assert.strictEqual(normalizeWeeklyWorkdaysValue(value), Number(value));
    });
    [5, '5', '5HMERH', '5ΗΜΕΡΗ', '5ΗΜΕΡΟ'].forEach((value) => {
        assert.strictEqual(normalizeWeeklyWorkdaysValue(value), 5);
    });
    [6, '6', '6HMERH', '6ΗΜΕΡΗ', '6ΗΜΕΡΟ'].forEach((value) => {
        assert.strictEqual(normalizeWeeklyWorkdaysValue(value), 6);
    });
    [0, 7, '5.0', 'invalid', null, undefined].forEach((value) => {
        assert.strictEqual(normalizeWeeklyWorkdaysValue(value), null);
    });

    assert.strictEqual(
        resolveEffectiveWeeklyWorkdays({
            hmeres_ergasias_ebdomadas: 3,
            typos_ebdomadas: '6HMERH',
            apasxolhsh_basei_symbashs: '5'
        }),
        3
    );
}

function testHistoryWeeklyWorkdaysFieldLevelFallback() {
    const baseFive = { hmeres_ergasias_ebdomadas: 5 };
    const nullDays = historyRecord({ hmeres_ergasias_ebdomadas: null });
    assert.strictEqual(
        getOrarioTermsForDate('2026-06-10', [nullDays], baseFive)
            .hmeres_ergasias_ebdomadas,
        5
    );

    const baseSix = { hmeres_ergasias_ebdomadas: 6 };
    const undefinedDays = historyRecord();
    delete undefinedDays.hmeres_ergasias_ebdomadas;
    assert.strictEqual(
        getOrarioTermsForDate('2026-06-10', [undefinedDays], baseSix)
            .hmeres_ergasias_ebdomadas,
        6
    );

    assert.strictEqual(
        getOrarioTermsForDate('2026-06-10', [historyRecord({
            hmeres_ergasias_ebdomadas: 6
        })], baseFive).hmeres_ergasias_ebdomadas,
        6
    );

    const priorTerms = historyRecord({
        _id: 'prior-terms',
        hmeromhnia_isxyos_oron_ergasias_apo: '2026-06-01',
        hmeres_ergasias_ebdomadas: 6
    });
    const laterSchedule = historyRecord({
        _id: 'later-schedule',
        hmeromhnia_isxyos_oron_ergasias_apo: '2026-06-08',
        hmeres_ergasias_ebdomadas: null,
        ores_ergasias_ebdomadas: 32
    });
    const layered = getOrarioTermsForDate(
        '2026-06-10',
        [priorTerms, laterSchedule],
        baseFive
    );
    assert.strictEqual(layered.istorikoId, 'later-schedule');
    assert.strictEqual(layered.hmeres_ergasias_ebdomadas, 6);
}

function testAprilPartialAndBoundaryWeeksKeepContractualWeeklyDays() {
    const base = { hmeres_ergasias_ebdomadas: 5 };
    const incompleteHireHistory = historyRecord({
        hmeromhnia_isxyos_oron_ergasias_apo: null,
        hmeromhnia_allaghs_orarioy_apo: '2026-04-23',
        hmeromhnia_allaghs_orarioy_eos: '2026-05-03',
        hmeres_ergasias_ebdomadas: null
    });
    for (const date of ['2026-04-23', '2026-04-26', '2026-04-27', '2026-05-03']) {
        const profile = getOrarioTermsForDate(date, [incompleteHireHistory], base);
        assert.strictEqual(profile.hmeres_ergasias_ebdomadas, 5);
        const repoResolution = resolveEffectiveExpectedWeeklyRepo({ effectiveProfile: profile });
        assert.strictEqual(repoResolution.ok, true);
        assert.notStrictEqual(
            repoResolution.reason,
            'INVALID_EFFECTIVE_WEEKLY_WORKDAYS'
        );
    }
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

function testExplicitTermsChangeFlagPrecedence() {
    const fallback = { hmeres_ergasias_ebdomadas: 5, ores_ergasias_ebdomadas: 40 };
    const scheduleOnly = historyRecord({ afora_allagh_oron_ergasias: false,
        hmeromhnia_isxyos_oron_ergasias_apo: null,
        hmeromhnia_allaghs_orarioy_apo: '2026-06-01',
        hmeromhnia_allaghs_orarioy_eos: '2026-06-30',
        hmeres_ergasias_ebdomadas: 2, ores_ergasias_ebdomadas: 14 });
    assert.strictEqual(getOrarioTermsForDate('2026-06-10', [scheduleOnly], fallback).source,
        'ERG_AKTUAL');

    const explicitLegacy = { ...scheduleOnly, _id: 'explicit-true',
        afora_allagh_oron_ergasias: true };
    assert.strictEqual(getOrarioTermsForDate('2026-06-10', [explicitLegacy], fallback).istorikoId,
        'explicit-true');

    const legacyWithoutFlag = { ...scheduleOnly, _id: 'legacy-without-flag' };
    delete legacyWithoutFlag.afora_allagh_oron_ergasias;
    assert.strictEqual(getOrarioTermsForDate(
        '2026-06-10', [legacyWithoutFlag], fallback).istorikoId, 'legacy-without-flag');

    const explicitFalseNewDates = historyRecord({ _id: 'explicit-false-new',
        afora_allagh_oron_ergasias: false, hmeres_ergasias_ebdomadas: 3 });
    assert.strictEqual(getOrarioTermsForDate(
        '2026-06-10', [explicitFalseNewDates], fallback).source, 'ERG_AKTUAL');

    const overlapping = [
        historyRecord({ _id: 'older', hmeromhnia_isxyos_oron_ergasias_apo: '2026-06-01',
            hmeres_ergasias_ebdomadas: 4 }),
        historyRecord({ _id: 'latest', hmeromhnia_isxyos_oron_ergasias_apo: '2026-06-08',
            hmeres_ergasias_ebdomadas: 5 })
    ];
    assert.strictEqual(getOrarioTermsForDate('2026-06-10', overlapping, fallback).istorikoId,
        'latest');
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
    testHistoryWeeklyWorkdaysFieldLevelFallback();
    testAprilPartialAndBoundaryWeeksKeepContractualWeeklyDays();
    testSnapshotFields();
    testInputImmutability();
    testExplicitTermsChangeFlagPrecedence();
    console.log('getOrarioTermsForDate tests passed');
}

run();
