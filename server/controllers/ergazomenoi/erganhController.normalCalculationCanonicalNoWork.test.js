'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const mongoose = require('mongoose');

mongoose.connect = mongoose.createConnection = () => {
    throw new Error('Απαγορεύεται σύνδεση βάσης στη δοκιμή');
};
mongoose.Query.prototype.exec = () => {
    throw new Error('Απαγορεύεται ερώτημα βάσης στη δοκιμή');
};

const originalLoad = Module._load;
let hooks;
try {
    Module._load = function (request, parent, isMain) {
        if (request === 'libxmljs2') return {};
        if (request === '../../config/aws') return { s3Client: {} };
        return originalLoad.call(this, request, parent, isMain);
    };
    hooks = require('./erganhController').__orphanDailyCalculationTestHooks;
} finally {
    Module._load = originalLoad;
}

const {
    buildEmploymentDailyCalculationUpdate,
    buildStage1EffectiveHolidayDailyCalculationUpdate
} = require('../../services/ergazomenoi/apasxoliseisEmploymentDailyCalculationAdapterService');
const { buildArgiesByDateKey } = require(
    '../../services/ergazomenoi/apasxoliseisWeeklyRepoTransferAuthoritativeContextService');

const fullTimeProfile = {
    typos_apasxolhshs: '0',
    typos_ebdomadas: '5ΗΜΕΡΗ',
    hmeres_ergasias_ebdomadas: 5,
    ores_ergasias_ebdomadas: 40,
    mo_oron_hmerhsias_ergasias: 8
};
const rotatingProfile = {
    typos_apasxolhshs: '2',
    typos_ebdomadas: '5ΗΜΕΡΗ',
    hmeres_ergasias_ebdomadas: 3,
    ores_ergasias_ebdomadas: 24,
    mo_oron_hmerhsias_ergasias: 8
};

function noWorkRow(overrides = {}) {
    return {
        _id: new mongoose.Types.ObjectId('68d9c239e2c73b9c35a00001'),
        hmeromhnia: new Date('2026-09-07T00:00:00.000Z'),
        kathgoria_ergasias: 'ΑΝ',
        repo: true,
        ores_ergasias: 0,
        cards_ores_ergasias: 0,
        cards_apo_ora_01: '', cards_eos_ora_01: '',
        cards_apo_ora_02: '', cards_eos_ora_02: '',
        cards_apo_ora_03: '', cards_eos_ora_03: '',
        ...overrides
    };
}

function calculate(row, effectiveEmployee = fullTimeProfile) {
    return buildEmploymentDailyCalculationUpdate({
        row,
        effectiveEmployee,
        argiesDateSet: new Set(),
        weeklyState: { weeklyRegularCardsMinutes: 0, processedRegularMinutes: 0,
            weeklyOverworkCapMinutes: 300, weeklyLegalLimitMinutes: 600,
            usedOverworkMinutes: 0, isFirstPartialWeek: false },
        operations: hooks.AUTHORITATIVE_DAILY_CALCULATION_OPERATIONS
    }).sanitizedUpdate;
}

function assertCanonicalNoWork(update, { category, repo }) {
    assert.equal(update.apologistiko_biblio, true);
    assert.equal(update.kathgoria_ergasias_apologistika, category);
    assert.equal(update.repo_apologistika, repo);
    assert.equal(update.adeia_apologistika, false);
    assert.equal(update.kathgoria_adeias_apologistika, '');
    assert.equal(update.astheneia_apologistika, false);
    assert.equal(update.apousia_apologistika, false);
    assert.equal(update.ores_ergasias_apologistika, 0);
}

test('normal no-work/no-card πλήρους απασχόλησης παράγει πλήρες canonical ΑΝ', () => {
    const update = calculate(noWorkRow());
    assertCanonicalNoWork(update, { category: 'ΑΝ', repo: true });
});

test('normal no-work/no-card εκ περιτροπής παράγει πλήρες canonical ΜΕ', () => {
    const update = calculate(noWorkRow({ kathgoria_ergasias: 'ΜΕ', repo: false }), rotatingProfile);
    assertCanonicalNoWork(update, { category: 'ΜΕ', repo: false });
});

test('normal no-work/no-card δεν παράγει μερική σημαία ρεπό', () => {
    for (const [profile, expectedCategory] of [
        [fullTimeProfile, 'ΑΝ'],
        [rotatingProfile, 'ΜΕ']
    ]) {
        const update = calculate(noWorkRow(), profile);
        assert.ok(update.repo_apologistika !== true ||
            update.kathgoria_ergasias_apologistika === 'ΑΝ');
        assert.equal(update.kathgoria_ergasias_apologistika, expectedCategory);
    }
});

test('άγνωστο ή αντικρουόμενο ημερήσιο προφίλ αποτυγχάνει κλειστά', () => {
    const unknownProfiles = [
        {},
        { kathestos_apasxolhshs: '0', typos_apasxolhshs: '1',
            typos_ebdomadas: '5ΗΜΕΡΗ', hmeres_ergasias_ebdomadas: 5 }
    ];
    const staleStates = [
        { repo_apologistika: true, kathgoria_ergasias_apologistika: '',
            apologistiko_biblio: true },
        { repo_apologistika: true, kathgoria_ergasias_apologistika: 'ΑΝ',
            apologistiko_biblio: true },
        { repo_apologistika: false, kathgoria_ergasias_apologistika: 'ΜΕ',
            apologistiko_biblio: true }
    ];
    for (const [index, staleState] of staleStates.entries()) {
        const inputRow = noWorkRow({ ...staleState,
            adeia_apologistika: true, kathgoria_adeias_apologistika: 'STALE',
            astheneia_apologistika: true, apousia_apologistika: true });
        const sanitizedUpdate = calculate(inputRow,
            unknownProfiles[index % unknownProfiles.length]);
        const finalRow = { ...inputRow, ...sanitizedUpdate };
        assert.equal(finalRow.apologistiko_biblio, false);
        assert.equal(finalRow.repo_apologistika, false);
        assert.equal(finalRow.kathgoria_ergasias_apologistika, '');
        assert.equal(finalRow.adeia_apologistika, false);
        assert.equal(finalRow.kathgoria_adeias_apologistika, '');
        assert.equal(finalRow.astheneia_apologistika, false);
        assert.equal(finalRow.apousia_apologistika, false);
        assert.notEqual(finalRow.kathgoria_ergasias_apologistika, 'ΑΝ');
        assert.notEqual(finalRow.kathgoria_ergasias_apologistika, 'ΜΕ');
    }
});

test('άδεια, ασθένεια, αργία, πραγματική εργασία και κλείδωμα δεν επαναταξινομούνται', () => {
    const leave = calculate(noWorkRow({ adeia: true, kathgoria_adeias: 'ΑΔΚΑΝ' }));
    assert.equal(leave.adeia_apologistika, true);
    assert.equal(leave.repo_apologistika, false);
    assert.ok(!['ΑΝ', 'ΜΕ'].includes(leave.kathgoria_ergasias_apologistika));

    const sickness = calculate(noWorkRow({ astheneia: true }));
    assert.equal(sickness.astheneia_apologistika, true);
    assert.equal(sickness.repo_apologistika, false);

    const companyFlags = { apasxolhsh_kata_tis_argies: false,
        leitoyrgia_stis_mh_ypoxreotikes_argies: false };
    const holiday = buildStage1EffectiveHolidayDailyCalculationUpdate({
        row: noWorkRow({ repo: false, kathgoria_ergasias: 'ΕΡΓ', ores_ergasias: 8,
            apo_ora_01: '08:00', eos_ora_01: '16:00' }),
        effectiveEmployee: fullTimeProfile,
        weeklyState: { weeklyRegularCardsMinutes: 0, processedRegularMinutes: 0,
            weeklyOverworkCapMinutes: 300, weeklyLegalLimitMinutes: 600,
            usedOverworkMinutes: 0, isFirstPartialWeek: false },
        holidayContext: { companyFlags, argiesByDateKey: buildArgiesByDateKey([{
            hmeromhnia: new Date('2026-09-07T00:00:00.000Z'),
            ypoxreotikh_argia: true,
            leitoyrgia_etaireias: false,
            perigrafh: 'ΥΠΟΧΡΕΩΤΙΚΗ ΑΡΓΙΑ'
        }], companyFlags) },
        operations: hooks.AUTHORITATIVE_DAILY_CALCULATION_OPERATIONS
    }).sanitizedUpdate;
    assert.equal(holiday.argia_apologistika, true);
    assert.equal(holiday.repo_apologistika, false);
    assert.ok(!['ΑΝ', 'ΜΕ'].includes(holiday.kathgoria_ergasias_apologistika));

    const actualWork = calculate(noWorkRow({ repo: false, kathgoria_ergasias: 'ΕΡΓ',
        ores_ergasias: 8, cards_ores_ergasias: 8,
        apo_ora_01: '08:00', eos_ora_01: '16:00',
        cards_apo_ora_01: '08:00', cards_eos_ora_01: '16:00' }));
    assert.equal(actualWork.repo_apologistika, false);
    assert.ok(!['ΑΝ', 'ΜΕ'].includes(actualWork.kathgoria_ergasias_apologistika));

    assert.deepEqual(calculate(noWorkRow({ is_locked: true })), {});
});

test('κανονικός και διορθωτικός υπολογισμός έχουν ίδια canonical έξοδο', () => {
    const normal = calculate(noWorkRow());
    const corrective = calculate(noWorkRow({
        apologistiko_biblio: true,
        kathgoria_ergasias_apologistika: 'ΕΡΓ',
        repo_apologistika: false,
        apousia_apologistika: false,
        ores_ergasias_apologistika: 5
    }));
    assert.deepEqual(corrective, normal);
    assertCanonicalNoWork(corrective, { category: 'ΑΝ', repo: true });
});
