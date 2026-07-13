const assert = require('assert');

const {
    getOrarioTermsForDate,
    resolveEmploymentTypeValue,
    resolveEmploymentTypeFromFormData,
    normalizeWeeklyWorkdaysValue,
    resolveEffectiveWeeklyWorkdays,
    resolveExpectedWeeklyRepo,
    buildCanonicalWorkTermsSnapshotFields
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
        mhniaia_repo: 2,
        ...overrides
    };
}

function currentProfile(overrides = {}) {
    return getOrarioTermsForDate('2026-06-10', [], {
        hmeres_ergasias_ebdomadas: 5,
        ores_ergasias_ebdomadas: 40,
        mo_oron_hmerhsias_ergasias: 8,
        apasxolhsh_basei_symbashs: '5',
        mhniaia_repo: 2,
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

function testExplicitRepoWins() {
    [1, '1', '1,0'].forEach((repo) => {
        assert.strictEqual(
            resolveExpectedWeeklyRepo({ mhniaia_repo: repo, hmeres_ergasias_ebdomadas: 5 }),
            1
        );
    });
    [2, '2', '2,0'].forEach((repo) => {
        assert.strictEqual(
            resolveExpectedWeeklyRepo({ mhniaia_repo: repo, hmeres_ergasias_ebdomadas: 6 }),
            2
        );
    });
}

function testDerivedCurrentAndHistoryRepo() {
    assert.strictEqual(
        currentProfile({ mhniaia_repo: 0, hmeres_ergasias_ebdomadas: 5 }).mhniaia_repo,
        2
    );
    assert.strictEqual(
        currentProfile({ mhniaia_repo: undefined, hmeres_ergasias_ebdomadas: 6 }).mhniaia_repo,
        1
    );
    assert.strictEqual(
        effectiveHistory({ mhniaia_repo: 0, hmeres_ergasias_ebdomadas: 5 }).mhniaia_repo,
        2
    );
    assert.strictEqual(
        effectiveHistory({ mhniaia_repo: undefined, hmeres_ergasias_ebdomadas: 6 }).mhniaia_repo,
        1
    );
}

function testWeeklyDayStringAndCurrentContractFallbacks() {
    assert.strictEqual(
        effectiveHistory({
            mhniaia_repo: 0,
            hmeres_ergasias_ebdomadas: undefined,
            typos_ebdomadas: '5HMERH'
        }).mhniaia_repo,
        2
    );
    assert.strictEqual(
        effectiveHistory({
            mhniaia_repo: 0,
            hmeres_ergasias_ebdomadas: undefined,
            typos_ebdomadas: '6HMERH'
        }).mhniaia_repo,
        1
    );
    assert.strictEqual(
        currentProfile({
            mhniaia_repo: 0,
            hmeres_ergasias_ebdomadas: undefined,
            apasxolhsh_basei_symbashs: '5'
        }).mhniaia_repo,
        2
    );
    assert.strictEqual(
        currentProfile({
            mhniaia_repo: 0,
            hmeres_ergasias_ebdomadas: undefined,
            apasxolhsh_basei_symbashs: '6'
        }).mhniaia_repo,
        1
    );
}

function testUnsupportedWorkdaysRemainUnresolved() {
    [0, 1, 2, 3, 4, 7, undefined, 'invalid'].forEach((workdays) => {
        assert.strictEqual(
            resolveExpectedWeeklyRepo({
                mhniaia_repo: 0,
                hmeres_ergasias_ebdomadas: workdays
            }),
            0
        );
    });

    assert.strictEqual(
        resolveExpectedWeeklyRepo({
            kathestos_apasxolhshs: '0',
            ores_ergasias_ebdomadas: 40,
            hmeres_ergasias_ebdomadas: 0,
            mhniaia_repo: 0
        }),
        0
    );
}

function testSnapshotFields() {
    const fiveDay = buildCanonicalWorkTermsSnapshotFields({
        kathestos_apasxolhshs: '0',
        apasxolhsh_basei_symbashs: '6',
        hmeres_ergasias_ebdomadas: 5,
        mhniaia_repo: 2
    });
    assert.deepStrictEqual(fiveDay, {
        kathestos_apasxolhshs: '0',
        typos_apasxolhshs: '0',
        typos_ebdomadas: '5HMERH',
        mhniaia_repo: 2
    });

    const sixDay = buildCanonicalWorkTermsSnapshotFields({
        kathestos_apasxolhshs: '2',
        apasxolhsh_basei_symbashs: '5',
        hmeres_ergasias_ebdomadas: 6,
        mhniaia_repo: 1
    });
    assert.deepStrictEqual(sixDay, {
        kathestos_apasxolhshs: '2',
        typos_apasxolhshs: '2',
        typos_ebdomadas: '6HMERH',
        mhniaia_repo: 1
    });
}

function testInputImmutability() {
    const employee = {
        kathestos_apasxolhshs: '0',
        hmeres_ergasias_ebdomadas: 5,
        ores_ergasias_ebdomadas: 40,
        mhniaia_repo: 2
    };
    const history = [historyRecord({ kathestos_apasxolhshs: '1' })];
    const employeeBefore = clone(employee);
    const historyBefore = clone(history);

    getOrarioTermsForDate('2026-06-10', history, employee);

    assert.deepStrictEqual(employee, employeeBefore);
    assert.deepStrictEqual(history, historyBefore);
}

function run() {
    testCurrentCanonicalEmploymentTypes();
    testHistoryCanonicalEmploymentTypesAndPrecedence();
    testSafeLegacyFallback();
    testWeeklyDayValuesAreRejected();
    testInvalidCanonicalDoesNotUseLegacyFallback();
    testFormCanonicalInvalidValueBlocksLegacyFallback();
    testWeeklyWorkdaysNormalizationAndPriority();
    testExplicitRepoWins();
    testDerivedCurrentAndHistoryRepo();
    testWeeklyDayStringAndCurrentContractFallbacks();
    testUnsupportedWorkdaysRemainUnresolved();
    testSnapshotFields();
    testInputImmutability();
    console.log('getOrarioTermsForDate tests passed');
}

run();
