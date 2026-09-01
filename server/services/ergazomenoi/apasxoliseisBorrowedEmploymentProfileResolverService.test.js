'use strict';

const assert = require('assert');
const test = require('node:test');
const {
    PROFILE_SOURCE,
    BLOCK_REASON,
    employeeKey,
    isActiveLoan,
    resolveEffectiveEmploymentProfileForReviewDate,
    preloadBorrowedEmploymentProfileContexts
} = require('./apasxoliseisBorrowedEmploymentProfileResolverService');
const {
    getWeeklyRepoProfileInfo
} = require('./apasxoliseisWeeklyRepoTransferAuthoritativeContextService');
const {
    resolveEffectiveExpectedWeeklyRepo
} = require('./apasxoliseisWeeklyRepoTransferExpectedRepoResolverService');
const {
    analyzeWeeklySixthSeventhDay
} = require('./apasxoliseisWeeklySixthSeventhDayPolicyService');
const {
    buildEmploymentPeriodFrozenSnapshot
} = require('./apasxoliseisPeriodFrozenSnapshotService');

function local(workdays, overrides = {}) {
    return {
        _id: 'local-0031', team: 'THA', company_kod: 'lending', kodikos: '0031',
        hmeres_ergasias_ebdomadas: workdays,
        ores_ergasias_ebdomadas: 40,
        kathestos_apasxolhshs: '0',
        pososto_prosayxhshs_6hs_hmeras: 40,
        ...overrides
    };
}

function borrowed(workdays, overrides = {}) {
    return local(workdays, {
        _id: 'borrowing-0003', company_kod: 'borrowing', kodikos: '0003', ...overrides
    });
}

function lendingLoan(workdays, overrides = {}) {
    return local(workdays, {
        afora_daneismo_ergazomenoy: true,
        typos_ergodoth_daneismoy: false,
        hmnia_enarxhs_daneismoy: new Date('2026-01-10T00:00:00.000Z'),
        hmnia_lhxhs_daneismoy: new Date('2026-01-20T00:00:00.000Z'),
        afm_daneizomenoy_ergodoth: '094259216',
        kodikos_ergazomenoy_alloy_ergodoth: '0003',
        ...overrides
    });
}

function context(workdays, overrides = {}) {
    return {
        reason: null,
        borrowingCompanyId: 'borrowing',
        borrowingEmployee: borrowed(workdays),
        borrowingHistory: [],
        ...overrides
    };
}

function resolve(date, employee, borrowedContext, normalHistory = []) {
    return resolveEffectiveEmploymentProfileForReviewDate({
        reviewDate: date,
        normalEmployee: employee,
        normalHistory,
        borrowedContext
    });
}

test('normal non-borrowed 5-day and 6-day profiles are unchanged', () => {
    for (const workdays of [5, 6]) {
        const profile = resolve('2026-01-15', local(workdays), null);
        assert.strictEqual(profile.hmeres_ergasias_ebdomadas, workdays);
        assert.strictEqual(profile.resolution_source, PROFILE_SOURCE.LOCAL);
    }
});

test('active loan uses borrowing workdays and Stage 2 expected repo', () => {
    for (const [lending, borrowing, expectedRepo] of [[5, 6, 1], [6, 5, 2]]) {
        const profile = resolve('2026-01-15', lendingLoan(lending), context(borrowing));
        assert.strictEqual(profile.hmeres_ergasias_ebdomadas, borrowing);
        assert.strictEqual(profile.resolution_source, PROFILE_SOURCE.BORROWING);
        const repo = resolveEffectiveExpectedWeeklyRepo({ effectiveProfile: profile });
        assert.strictEqual(repo.ok, true);
        assert.strictEqual(repo.effectiveExpectedWeeklyRepo, expectedRepo);
    }
});

test('loan interval is inclusive and resolves local outside its boundaries', () => {
    const employee = lendingLoan(5);
    const borrowedContext = context(6);
    assert.strictEqual(resolve('2026-01-09', employee, borrowedContext).resolution_source,
        PROFILE_SOURCE.LOCAL);
    assert.strictEqual(resolve('2026-01-10', employee, borrowedContext).resolution_source,
        PROFILE_SOURCE.BORROWING);
    assert.strictEqual(resolve('2026-01-20', employee, borrowedContext).resolution_source,
        PROFILE_SOURCE.BORROWING);
    assert.strictEqual(resolve('2026-01-21', employee, borrowedContext).resolution_source,
        PROFILE_SOURCE.LOCAL);
});

function history(id, from, to, workdays) {
    return {
        _id: id,
        afora_allagh_oron_ergasias: true,
        hmeromhnia_isxyos_oron_ergasias_apo: new Date(`${from}T00:00:00.000Z`),
        hmeromhnia_isxyos_oron_ergasias_eos: to
            ? new Date(`${to}T00:00:00.000Z`) : null,
        hmeres_ergasias_ebdomadas: workdays,
        ores_ergasias_ebdomadas: 40,
        kathestos_apasxolhshs: '0'
    };
}

test('borrowing history changes date-effectively 5→6 and 6→5', () => {
    const employee = lendingLoan(5, {
        hmnia_enarxhs_daneismoy: new Date('2026-01-01'),
        hmnia_lhxhs_daneismoy: new Date('2026-12-31')
    });
    for (const [before, after] of [[5, 6], [6, 5]]) {
        const borrowedContext = context(after, { borrowingHistory: [
            history('old', '2026-01-01', '2026-06-14', before),
            history('new', '2026-06-15', '2026-12-31', after)
        ] });
        assert.strictEqual(resolve('2026-06-14', employee, borrowedContext)
            .hmeres_ergasias_ebdomadas, before);
        assert.strictEqual(resolve('2026-06-15', employee, borrowedContext)
            .hmeres_ergasias_ebdomadas, after);
    }
});

test('mapping, history and profile failures block without lending fallback', () => {
    const employee = lendingLoan(6);
    for (const reason of [BLOCK_REASON.COMPANY_AMBIGUOUS, BLOCK_REASON.EMPLOYEE_AMBIGUOUS]) {
        const profile = resolve('2026-01-15', employee, { reason });
        assert.strictEqual(profile.resolution_blocked, true);
        assert.strictEqual(profile.resolution_reason, reason);
        assert.strictEqual(profile.hmeres_ergasias_ebdomadas, null);
    }
    const overlap = context(5, { borrowingHistory: [
        history('one', '2026-01-01', '2026-01-31', 5),
        history('two', '2026-01-10', '2026-01-20', 6)
    ] });
    assert.strictEqual(resolve('2026-01-15', employee, overlap).resolution_reason,
        BLOCK_REASON.HISTORY_OVERLAP);
    const missing = context(0, { borrowingEmployee: borrowed(0) });
    const missingProfile = resolve('2026-01-15', employee, missing);
    assert.strictEqual(missingProfile.resolution_blocked, true);
    assert.strictEqual(missingProfile.resolution_reason, BLOCK_REASON.PROFILE_MISSING);
    assert.strictEqual(missingProfile.hmeres_ergasias_ebdomadas, null);
});

function fakeModel(rows = []) {
    return {
        find() {
            return {
                select() {
                    return { lean: async () => rows.map((row) => ({ ...row })) };
                }
            };
        }
    };
}

async function preload({ companies = [], employees = [], histories = [], localEmployee } = {}) {
    const localRow = localEmployee || lendingLoan(5);
    const contexts = await preloadBorrowedEmploymentProfileContexts({
        team: 'THA',
        employees: [localRow],
        models: {
            companiesModel: fakeModel(companies),
            employeeModel: fakeModel(employees),
            historyModel: fakeModel(histories)
        }
    });
    return { localRow, context: contexts.get(employeeKey(localRow)) };
}

test('preloader resolves exactly one borrowing company and employee', async () => {
    const result = await preload({
        companies: [{ _id: 'borrowing', afm: '094259216' }],
        employees: [borrowed(6)]
    });
    assert.strictEqual(result.context.reason, null);
    assert.strictEqual(result.context.borrowingCompanyId, 'borrowing');
    assert.strictEqual(result.context.borrowingEmployee.kodikos, '0003');
    assert.strictEqual(resolve('2026-01-15', result.localRow, result.context)
        .hmeres_ergasias_ebdomadas, 6);
});

test('preloader fails closed for missing or duplicate borrowing company', async () => {
    const missing = await preload();
    assert.strictEqual(missing.context.reason, BLOCK_REASON.COMPANY_MISSING);
    const duplicate = await preload({ companies: [
        { _id: 'borrowing-a', afm: '094259216' },
        { _id: 'borrowing-b', afm: '094259216' }
    ] });
    assert.strictEqual(duplicate.context.reason, BLOCK_REASON.COMPANY_AMBIGUOUS);
});

test('preloader fails closed for missing or duplicate borrowing employee', async () => {
    const company = [{ _id: 'borrowing', afm: '094259216' }];
    const missing = await preload({ companies: company });
    assert.strictEqual(missing.context.reason, BLOCK_REASON.EMPLOYEE_MISSING);
    const duplicate = await preload({ companies: company, employees: [
        borrowed(5, { _id: 'one' }), borrowed(6, { _id: 'two' })
    ] });
    assert.strictEqual(duplicate.context.reason, BLOCK_REASON.EMPLOYEE_AMBIGUOUS);
});

test('preloader fails closed for incomplete borrowed mapping', async () => {
    for (const overrides of [
        { afm_daneizomenoy_ergodoth: '' },
        { kodikos_ergazomenoy_alloy_ergodoth: '' }
    ]) {
        const result = await preload({ localEmployee: lendingLoan(5, overrides) });
        assert.strictEqual(result.context.reason, BLOCK_REASON.INVALID_MAPPING);
    }
});

test('null loan end remains active after the start date', () => {
    const employee = lendingLoan(5, { hmnia_lhxhs_daneismoy: null });
    assert.strictEqual(isActiveLoan('2026-01-09', employee), false);
    assert.strictEqual(isActiveLoan('2026-12-31', employee), true);
    assert.strictEqual(resolve('2026-12-31', employee, context(6)).resolution_source,
        PROFILE_SOURCE.BORROWING);
});

test('invalid nonzero borrowing weekly workdays fail closed', () => {
    for (const workdays of [4, 7]) {
        const profile = resolve('2026-01-15', lendingLoan(6), context(workdays));
        assert.strictEqual(profile.resolution_blocked, true);
        assert.strictEqual(profile.resolution_reason, BLOCK_REASON.WEEKLY_WORKDAYS_INVALID);
        assert.strictEqual(profile.hmeres_ergasias_ebdomadas, null);
    }
});

test('overlap with explicit false flag and effective dates fails closed', () => {
    const rows = [
        history('one', '2026-01-01', '2026-01-31', 5),
        { ...history('two', '2026-01-10', '2026-01-20', 6),
            afora_allagh_oron_ergasias: false }
    ];
    const profile = resolve('2026-01-15', lendingLoan(5),
        context(6, { borrowingHistory: rows }));
    assert.strictEqual(profile.resolution_blocked, true);
    assert.strictEqual(profile.resolution_reason, BLOCK_REASON.HISTORY_OVERLAP);
});

test('explicit-false schedule-only history does not overlap real borrowing terms', () => {
    const realTerms = history('6a476485e275226dd172d30a', '2026-04-01', null, 6);
    const scheduleOnly = {
        _id: '6a8888e56aeaefb3c884f5f6',
        afora_allagh_oron_ergasias: false,
        hmeromhnia_isxyos_oron_ergasias_apo: null,
        hmeromhnia_isxyos_oron_ergasias_eos: null,
        hmeromhnia_allaghs_orarioy_apo: new Date('2026-04-01T00:00:00.000Z'),
        hmeromhnia_allaghs_orarioy_eos: new Date('2026-04-07T00:00:00.000Z'),
        hmeres_ergasias_ebdomadas: 6
    };
    const profile = resolve('2026-04-02', lendingLoan(5, {
        hmnia_enarxhs_daneismoy: new Date('2026-01-01T00:00:00.000Z'),
        hmnia_lhxhs_daneismoy: null
    }), context(6, { borrowingHistory: [realTerms, scheduleOnly] }));
    assert.strictEqual(profile.resolution_blocked, false);
    assert.strictEqual(profile.resolution_reason, null);
    assert.strictEqual(profile.profile_history_id, '6a476485e275226dd172d30a');
    assert.strictEqual(profile.hmeres_ergasias_ebdomadas, 6);
});

test('two real borrowing terms rows still fail closed as history overlap', () => {
    const profile = resolve('2026-04-02', lendingLoan(5, {
        hmnia_enarxhs_daneismoy: new Date('2026-01-01T00:00:00.000Z'),
        hmnia_lhxhs_daneismoy: null
    }), context(6, { borrowingHistory: [
        history('real-a', '2026-04-01', null, 6),
        history('real-b', '2026-04-02', '2026-04-05', 5)
    ] }));
    assert.strictEqual(profile.resolution_blocked, true);
    assert.strictEqual(profile.resolution_reason, BLOCK_REASON.HISTORY_OVERLAP);
});

test('legacy borrowing history without an explicit terms flag remains compatible', () => {
    const legacy = {
        _id: 'legacy-without-flag',
        hmeromhnia_allaghs_orarioy_apo: new Date('2026-04-01T00:00:00.000Z'),
        hmeromhnia_allaghs_orarioy_eos: new Date('2026-04-07T00:00:00.000Z'),
        hmeres_ergasias_ebdomadas: 6,
        ores_ergasias_ebdomadas: 40,
        kathestos_apasxolhshs: '0'
    };
    const profile = resolve('2026-04-02', lendingLoan(5, {
        hmnia_enarxhs_daneismoy: new Date('2026-01-01T00:00:00.000Z'),
        hmnia_lhxhs_daneismoy: null
    }), context(6, { borrowingHistory: [legacy] }));
    assert.strictEqual(profile.resolution_blocked, false);
    assert.strictEqual(profile.profile_history_id, 'legacy-without-flag');
    assert.strictEqual(profile.hmeres_ergasias_ebdomadas, 6);
});

test('explicit-false borrowing history with new terms dates remains fail closed', () => {
    const realTerms = history('real-terms', '2026-04-01', null, 6);
    const explicitFalseTerms = {
        ...history('explicit-false-new-terms', '2026-04-02', '2026-04-05', 5),
        afora_allagh_oron_ergasias: false
    };
    const profile = resolve('2026-04-02', lendingLoan(5, {
        hmnia_enarxhs_daneismoy: new Date('2026-01-01T00:00:00.000Z'),
        hmnia_lhxhs_daneismoy: null
    }), context(6, { borrowingHistory: [realTerms, explicitFalseTerms] }));
    assert.strictEqual(profile.resolution_blocked, true);
    assert.strictEqual(profile.resolution_reason, BLOCK_REASON.HISTORY_OVERLAP);
});

function weekRows(workedDays) {
    return Array.from({ length: 7 }, (_, index) => {
        const date = new Date(Date.UTC(2026, 0, 12 + index)).toISOString().slice(0, 10);
        const scheduled = index < workedDays;
        return {
            _id: `row-${index}`, hmeromhnia: date,
            kathgoria_ergasias: scheduled ? 'ΕΡΓ' : 'ΑΝ',
            repo: !scheduled, ores_ergasias: scheduled ? 8 : 0,
            cards_ores_ergasias: scheduled ? 7 : 0,
            cards_apo_ora_01: scheduled ? '09:00' : '',
            cards_eos_ora_01: scheduled ? '16:00' : ''
        };
    });
}

test('borrowing 5-day drives sixth-day policy and borrowing 6-day drives seventh-day policy', () => {
    const fiveDayRows = weekRows(5);
    Object.assign(fiveDayRows[5], { cards_ores_ergasias: 7,
        cards_apo_ora_01: '09:00', cards_eos_ora_01: '16:00' });
    const fiveDay = analyzeWeeklySixthSeventhDay({ weekRows: fiveDayRows,
        effectiveProfile: { ...resolve('2026-01-15', lendingLoan(6), context(5)),
            pososto_prosayxhshs_6hs_hmeras: 40 }, hourlyRate: 10 });
    assert.strictEqual(fiveDay.status, 'READY');
    assert.strictEqual(fiveDay.sixthDay.classification, 'SIXTH_DAY');

    const sixDayRows = weekRows(6);
    Object.assign(sixDayRows[6], { cards_ores_ergasias: 4,
        cards_apo_ora_01: '09:00', cards_eos_ora_01: '13:00' });
    const sixDay = analyzeWeeklySixthSeventhDay({ weekRows: sixDayRows,
        effectiveProfile: resolve('2026-01-15', lendingLoan(5), context(6)) });
    assert.strictEqual(sixDay.status, 'READY');
    assert.strictEqual(sixDay.seventhDay.classification, 'SEVENTH_DAY_ILLEGAL_OVERTIME');
});

test('weekly and frozen final profile preserve borrowing provenance, including 0031 6→6', () => {
    const employee = lendingLoan(6, { hmnia_enarxhs_daneismoy: new Date('2026-01-01'),
        hmnia_lhxhs_daneismoy: new Date('2027-12-31') });
    const resolveDate = (date) => resolve(date, employee, context(6));
    const weekly = getWeeklyRepoProfileInfo({
        week: { weekStart: new Date('2026-01-12'), weekEnd: new Date('2026-01-18'),
            naturalWeekEnd: new Date('2026-01-18') },
        ergazomenos: employee,
        resolveProfileForDate: resolveDate
    });
    assert.strictEqual(weekly.effectiveProfile.hmeres_ergasias_ebdomadas, 6);
    assert.strictEqual(weekly.effectiveProfile.resolution_source, PROFILE_SOURCE.BORROWING);
    assert.strictEqual(weekly.expectedWeeklyRepo, 1);
    const frozen = buildEmploymentPeriodFrozenSnapshot({
        scope: { team: 'THA' },
        employees: [employee],
        dailyResults: [{ _id: 'row', kodikos: '0031', hmeromhnia: '2026-01-15',
            effective_weekly_workdays: 6,
            effective_profile_source: weekly.effectiveProfile.resolution_source,
            effective_profile_company_id: weekly.effectiveProfile.profile_company_id,
            effective_profile_employee_id: weekly.effectiveProfile.profile_employee_id }]
    }).snapshot;
    assert.strictEqual(frozen.daily_results[0].effective_profile_source,
        PROFILE_SOURCE.BORROWING);
    assert.strictEqual(frozen.daily_results[0].effective_profile_company_id, 'borrowing');
    assert.strictEqual(frozen.daily_results[0].effective_profile_employee_id, 'borrowing-0003');
});

test('loan source change inside week is preserved daily and blocks mixed 5→6 week', () => {
    const employee = lendingLoan(5, {
        hmnia_enarxhs_daneismoy: new Date('2026-01-15T00:00:00.000Z'),
        hmnia_lhxhs_daneismoy: null
    });
    const resolveDate = (date) => resolve(date, employee, context(6));
    const profiles = Object.fromEntries(
        Array.from({ length: 7 }, (_, index) => {
            const date = new Date(Date.UTC(2026, 0, 12 + index));
            const key = date.toISOString().slice(0, 10);
            return [key, resolveDate(date)];
        })
    );
    assert.strictEqual(profiles['2026-01-14'].resolution_source, PROFILE_SOURCE.LOCAL);
    assert.strictEqual(profiles['2026-01-15'].resolution_source, PROFILE_SOURCE.BORROWING);
    const weekly = getWeeklyRepoProfileInfo({
        week: { weekStart: new Date('2026-01-12'), weekEnd: new Date('2026-01-18'),
            naturalWeekEnd: new Date('2026-01-18') },
        ergazomenos: employee,
        resolveProfileForDate: resolveDate
    });
    assert.strictEqual(weekly.profileChangedInsideWeek, true);
    const expected = resolveEffectiveExpectedWeeklyRepo({ effectiveProfile: weekly.effectiveProfile });
    assert.strictEqual(expected.ok, false);
    assert.strictEqual(expected.reason, 'PROFILE_CHANGED_INSIDE_WEEK');
    const analysis = analyzeWeeklySixthSeventhDay({
        weekRows: weekRows(6), effectiveProfile: weekly.effectiveProfile,
        effectiveProfilesByDate: profiles
    });
    assert.notStrictEqual(analysis.status, 'READY');
});
