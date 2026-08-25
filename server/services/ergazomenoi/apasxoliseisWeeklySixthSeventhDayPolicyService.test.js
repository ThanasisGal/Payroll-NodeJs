const assert = require('assert');
const {
    analyzeWeeklySixthSeventhDay
} = require('./apasxoliseisWeeklySixthSeventhDayPolicyService');

function week(hours = [8, 8, 8, 8, 8, 7, 0]) {
    return hours.map((cards, index) => {
        const date = new Date('2026-07-27T00:00:00.000Z');
        date.setUTCDate(date.getUTCDate() + index);
        return ({
        hmeromhnia: date.toISOString().slice(0, 10),
        kathgoria_ergasias: index >= 5 ? 'ΑΝ' : 'ΕΡΓ',
        repo: index >= 5,
        ores_ergasias: 8,
        cards_ores_ergasias: cards,
        cards_apo_ora_01: cards > 0 ? '09:00' : '',
        cards_eos_ora_01: cards > 0 ? '17:00' : ''
    });
    });
}
function analyze(hours, profile = {}, hourlyRate = 10) {
    return analyzeWeeklySixthSeventhDay({
        weekRows: week(hours),
        effectiveProfile: {
            hmeres_ergasias_ebdomadas: 5,
            pososto_prosayxhshs_6hs_hmeras: 40,
            source: 'ERG_AKTUAL',
            ...profile
        },
        hourlyRate
    });
}

let result = analyze([4, 4, 4, 4, 4, 7, 0]);
assert.strictEqual(result.status, 'READY');
assert.strictEqual(result.sixthDay.hmeromhnia, '2026-08-01');
assert.strictEqual(result.sixthDay.premiumRate, 40);
assert.strictEqual(result.sixthDay.value, 98);
assert.strictEqual(result.sixthDay.baseAmount, 70);
assert.strictEqual(result.sixthDay.premiumAmount, 28);
assert.strictEqual(result.sixthDay.sixthDayHours, 7);
assert.strictEqual(result.sixthDay.illegalOvertimeHours, 0);

result = analyze([7, 7, 7, 7, 7, 7, 0]);
assert.strictEqual(result.sixthDay.hmeromhnia, '2026-08-01');

const june0004Hours = [9.18, 6.58, 6.37, 0, 9.03, 6.35, 8];
const june0004Rows = june0004Hours.map((hours, index) => {
    const date = new Date('2026-06-08T00:00:00.000Z');
    date.setUTCDate(date.getUTCDate() + index);
    const day = date.toISOString().slice(0, 10);
    return {
        hmeromhnia: day,
        kathgoria_ergasias: day === '2026-06-10' ? 'ΑΝ' : 'ΕΡΓ',
        kathgoria_ergasias_apologistika: day === '2026-06-11' ? '' : 'ΕΡΓ',
        astheneia_apologistika: day === '2026-06-11',
        repo: day === '2026-06-10',
        repo_apologistika: false,
        ores_ergasias_apologistika: hours,
        cards_ores_ergasias: day === '2026-06-11' || day === '2026-06-14' ? 0 : hours,
        cards_apo_ora_01: day === '2026-06-11' ? '' : day === '2026-06-14' ? '14:51' : '12:00',
        cards_eos_ora_01: day === '2026-06-11' || day === '2026-06-14' ? '' : '20:00',
        ...(day === '2026-06-14' ? {
            apo_ora_01_apologistika: '14:51',
            eos_ora_01_apologistika: '23:21',
            orphan_card_resolution: {
                status: 'HR_APPROVED', policy_version: 'orphan-card-continuous:v1'
            }
        } : {})
    };
});
const june0004 = analyzeWeeklySixthSeventhDay({
    weekRows: june0004Rows,
    effectiveProfile: {
        hmeres_ergasias_ebdomadas: 5,
        pososto_prosayxhshs_6hs_hmeras: 0,
        eidikh_kathgoria_ergazomenoy: '0009'
    }
});
assert.strictEqual(june0004.status, 'READY');
assert.deepStrictEqual(june0004.reasons, []);
assert.strictEqual(june0004.sixthDay.hmeromhnia, '2026-06-14');
assert.strictEqual(june0004.sixthDay.sixthDayHours, 8);
assert.strictEqual(june0004.sixthDay.cardVerificationStatus, 'HR_APPROVED_ORPHAN');
assert.strictEqual(june0004.seventhDay, null);
assert.ok(!june0004.reasons.includes('CANONICAL_REPO_IDENTITIES_NOT_DETERMINISTIC'));

const chronologicalCandidates = analyze([6.58, 6.37, 9.18, 9.03, 6.35, 8, 0]);
assert.strictEqual(chronologicalCandidates.sixthDay.hmeromhnia, '2026-08-01');

const fallbackClosestToEight = analyze([9.8, 9.6, 9.4, 9.2, 9.1, 9.05, 0]);
assert.strictEqual(fallbackClosestToEight.sixthDay.hmeromhnia, '2026-08-01');
assert.ok(fallbackClosestToEight.warnings.includes(
    'SIXTH_DAY_NO_STANDARD_CANDIDATE_CLOSEST_TO_EIGHT'));
assert.ok(fallbackClosestToEight.warnings.includes('SIXTH_DAY_DAILY_HOURS_EXCEED_EIGHT'));

const laterCardHoursOverEight = week([7, 7, 7, 7, 7, 9, 0]);
assert.strictEqual(analyzeWeeklySixthSeventhDay({
    weekRows: laterCardHoursOverEight,
    effectiveProfile: { hmeres_ergasias_ebdomadas: 5, pososto_prosayxhshs_6hs_hmeras: 40 },
    hourlyRate: 10
}).sixthDay.hmeromhnia, '2026-07-31');

const productionSevenDayExample = week([8.60, 7.97, 6.48, 7.32, 7.42, 8.12, 6.78]);
productionSevenDayExample.forEach((day) => Object.assign(day, {
    kathgoria_ergasias: 'ΕΡΓ', repo: false
}));
Object.assign(productionSevenDayExample[2], { kathgoria_ergasias: 'ΑΝ', repo: true });
Object.assign(productionSevenDayExample[6], { kathgoria_ergasias: 'ΕΡΓ', repo: false });
const singleWorkedRepoResult = analyzeWeeklySixthSeventhDay({
    weekRows: productionSevenDayExample,
    effectiveProfile: { hmeres_ergasias_ebdomadas: 5, pososto_prosayxhshs_6hs_hmeras: 40 },
    hourlyRate: 10
});
result = singleWorkedRepoResult;
assert.strictEqual(result.status, 'READY');
assert.strictEqual(result.sixthDay.hmeromhnia, '2026-08-02');
assert.strictEqual(result.sixthDay.actualWorkHours, 6.78);
assert.strictEqual(result.seventhDay.hmeromhnia, '2026-07-29');
assert.strictEqual(result.seventhDay.actualWorkHours, 6.48);

const incompleteInterval = week([7, 7, 7, 7, 7, 7, 0]);
incompleteInterval[5].cards_eos_ora_01 = '';
result = analyzeWeeklySixthSeventhDay({
    weekRows: incompleteInterval,
    effectiveProfile: { hmeres_ergasias_ebdomadas: 5, pososto_prosayxhshs_6hs_hmeras: 40 },
    hourlyRate: 10
});
assert.strictEqual(result.status, 'NEEDS_HR_DECISION');
assert.strictEqual(result.sixthDay, undefined);
assert.ok(result.reasons.includes('ORPHAN_CARD_DURATION_REQUIRES_HR_DECISION'));
assert.ok(result.reasons.includes('ORPHAN_CARD_DURATION_REQUIRES_HR_DECISION'));

const noCardSunday = week([7, 7, 7, 7, 7, 7, 0]);
assert.strictEqual(analyzeWeeklySixthSeventhDay({
    weekRows: noCardSunday,
    effectiveProfile: { hmeres_ergasias_ebdomadas: 5, pososto_prosayxhshs_6hs_hmeras: 40 },
    hourlyRate: 10
}).sixthDay.hmeromhnia, '2026-08-01');

const zeroCardLatest = week([7, 7, 7, 7, 7, 0, 0]);
Object.assign(zeroCardLatest[5], { argia: true, ores_ergasias: 8 });
result = analyzeWeeklySixthSeventhDay({
    weekRows: zeroCardLatest,
    effectiveProfile: { hmeres_ergasias_ebdomadas: 5, pososto_prosayxhshs_6hs_hmeras: 40 },
    hourlyRate: 10
});
assert.strictEqual(result.status, 'NOT_APPLICABLE');
assert.strictEqual(result.sixthDay, null);

const holidayWithoutCards = week([7, 7, 7, 7, 7, 7, 0]);
Object.assign(holidayWithoutCards[5], {
    argia: true,
    cards_ores_ergasias: 0,
    cards_apo_ora_01: '',
    cards_eos_ora_01: ''
});
result = analyzeWeeklySixthSeventhDay({
    weekRows: holidayWithoutCards,
    effectiveProfile: { hmeres_ergasias_ebdomadas: 5, pososto_prosayxhshs_6hs_hmeras: 40 },
    hourlyRate: 10
});
assert.strictEqual(result.dailyFacts[5].countsAsActualWorkDay, false);
assert.strictEqual(result.status, 'NOT_APPLICABLE');
assert.strictEqual(result.sixthDay, null);

const noCardCandidate = week([0, 0, 0, 0, 0, 0, 0]);
for (const day of noCardCandidate.slice(0, 6)) {
    Object.assign(day, { argia: true, ores_ergasias: 8 });
}
result = analyzeWeeklySixthSeventhDay({
    weekRows: noCardCandidate,
    effectiveProfile: { hmeres_ergasias_ebdomadas: 5, pososto_prosayxhshs_6hs_hmeras: 40 },
    hourlyRate: 10
});
assert.strictEqual(result.status, 'NOT_APPLICABLE');
assert.strictEqual(result.sixthDay, null);

const mixedLeave = week([7, 7, 7, 7, 7, 4, 0]);
Object.assign(mixedLeave[5], { adeia: true, kathgoria_ergasias: 'ΑΔΕΙΑ' });
result = analyzeWeeklySixthSeventhDay({
    weekRows: mixedLeave,
    effectiveProfile: { hmeres_ergasias_ebdomadas: 5, pososto_prosayxhshs_6hs_hmeras: 40 },
    hourlyRate: 10
});
assert.strictEqual(result.status, 'NEEDS_HR_DECISION');
assert.ok(result.reasons.includes('FULL_DAY_LEAVE_WITH_CARD_WORK_REQUIRES_HR_DECISION'));

const explicitHourlyLeave = week([7, 7, 7, 7, 7, 4, 0]);
Object.assign(explicitHourlyLeave[5], {
    adeia: true,
    kathgoria_ergasias: 'ΑΔΕΙΑ',
    explicit_hourly_leave_hours: 4
});
result = analyzeWeeklySixthSeventhDay({
    weekRows: explicitHourlyLeave,
    effectiveProfile: { hmeres_ergasias_ebdomadas: 5, pososto_prosayxhshs_6hs_hmeras: 40 },
    hourlyRate: 10
});
assert.strictEqual(result.sixthDay.hmeromhnia, '2026-07-31');

const declaredOverEight = week([9, 9, 9, 9, 9, 9, 0]);
declaredOverEight[5].ores_ergasias = 9;
result = analyzeWeeklySixthSeventhDay({
    weekRows: declaredOverEight,
    effectiveProfile: {
        hmeres_ergasias_ebdomadas: 5,
        pososto_prosayxhshs_6hs_hmeras: 40
    },
    hourlyRate: 10
});
assert.ok(result.warnings.includes('SIXTH_DAY_DAILY_HOURS_EXCEED_EIGHT'));
assert.strictEqual(result.sixthDay.value, 112);
assert.strictEqual(result.sixthDay.sixthDayHours, 8);
assert.strictEqual(result.sixthDay.illegalOvertimeHours, 1);
assert.strictEqual(result.sixthDay.classification, 'SIXTH_DAY_WITH_ILLEGAL_OVERTIME');

const declaredAtMostFive = week([4, 4, 4, 4, 4, 4, 0]);
declaredAtMostFive.slice(0, 6).forEach((day) => {
    day.ores_ergasias = 5;
});
result = analyzeWeeklySixthSeventhDay({
    weekRows: declaredAtMostFive,
    effectiveProfile: {
        hmeres_ergasias_ebdomadas: 5,
        pososto_prosayxhshs_6hs_hmeras: 40
    }
});
assert.strictEqual(result.status, 'READY');
assert.strictEqual(result.sixthDay.hmeromhnia, '2026-08-01');

result = analyze([7, 7, 7, 7, 7, 7, 0], {
    pososto_prosayxhshs_6hs_hmeras: 0,
    eidikh_kathgoria_ergazomenoy: '0009'
});
assert.strictEqual(result.status, 'READY');
assert.strictEqual(result.premiumRate, 0);
assert.strictEqual(result.sixthDay.value, 70);
assert.strictEqual(result.sixthDay.premiumRate, 0);
for (const exemptRate of [undefined, null, '']) {
    result = analyze([7, 7, 7, 7, 7, 7, 0], {
        pososto_prosayxhshs_6hs_hmeras: exemptRate,
        eidikh_kathgoria_ergazomenoy: '0009'
    });
    assert.strictEqual(result.status, 'READY');
    assert.strictEqual(result.premiumRate, 0);
    assert.strictEqual(result.sixthDay.premiumRate, 0);
    assert.ok(!result.reasons.includes('MISSING_OR_INVALID_SIXTH_DAY_PREMIUM_RATE'));
}
result = analyze([7, 7, 7, 7, 7, 7, 0], {
    pososto_prosayxhshs_6hs_hmeras: 0,
    eidikh_kathgoria_ergazomenoy: '0001'
});
assert.strictEqual(result.status, 'NEEDS_HR_DECISION');
assert.ok(result.reasons.includes('ZERO_SIXTH_DAY_PREMIUM_RATE_WITHOUT_EXEMPTION'));
assert.strictEqual(analyze([7, 7, 7, 7, 7, 7, 0], { pososto_prosayxhshs_6hs_hmeras: 12.5 }).sixthDay.value, 78.75);
for (const rate of [null, '', -1, 'invalid']) {
    result = analyze([7, 7, 7, 7, 7, 7, 0], { pososto_prosayxhshs_6hs_hmeras: rate });
    assert.strictEqual(result.status, 'NEEDS_HR_DECISION');
    assert.ok(result.reasons.includes('MISSING_OR_INVALID_SIXTH_DAY_PREMIUM_RATE'));
    assert.strictEqual(result.sixthDay.hmeromhnia, '2026-08-01');
    assert.strictEqual(result.sixthDay.premiumRate, null);
    assert.strictEqual(result.sixthDay.value, null);
}

const singleWorkedRepoSeventh = week([7, 7, 7, 7, 7, 8, 9]);
Object.assign(singleWorkedRepoSeventh[5], { kathgoria_ergasias: 'ΕΡΓ', repo: false });
result = analyzeWeeklySixthSeventhDay({
    weekRows: singleWorkedRepoSeventh,
    effectiveProfile: { hmeres_ergasias_ebdomadas: 5,
        pososto_prosayxhshs_6hs_hmeras: 40 },
    hourlyRate: 10
});
assert.strictEqual(result.seventhDay.hmeromhnia, '2026-08-02');
assert.strictEqual(result.sixthDay.hmeromhnia, '2026-08-01');
assert.ok(result.warnings.includes('SEVENTH_CONSECUTIVE_ACTUAL_WORK_DAY_CONTRACT_VIOLATION'));
assert.strictEqual(result.seventhDay.actualWorkHours, 9);
assert.strictEqual(result.seventhDay.illegalOvertimeHours, 9);
assert.strictEqual(result.seventhDay.severity, 'SERIOUS_VIOLATION');
assert.strictEqual(result.seventhDay.classification, 'SEVENTH_DAY_ILLEGAL_OVERTIME');

const declaredAboveActual = week([7, 7, 7, 7, 7, 7, 7]);
Object.assign(declaredAboveActual[5], { kathgoria_ergasias: 'ΕΡΓ', repo: false });
declaredAboveActual[6].ores_ergasias = 10;
const declaredAboveActualResult = analyzeWeeklySixthSeventhDay({
    weekRows: declaredAboveActual,
    effectiveProfile: {
        hmeres_ergasias_ebdomadas: 5,
        pososto_prosayxhshs_6hs_hmeras: 40
    },
    hourlyRate: 10
});
assert.strictEqual(declaredAboveActualResult.seventhDay.actualWorkHours, 7);
assert.strictEqual(declaredAboveActualResult.seventhDay.illegalOvertimeHours, 7);

const sameActualDifferentDeclared = week([7, 7, 7, 7, 7, 7, 7]);
Object.assign(sameActualDifferentDeclared[5], { kathgoria_ergasias: 'ΕΡΓ', repo: false });
sameActualDifferentDeclared[6].ores_ergasias = 3;
const sameActualDifferentDeclaredResult = analyzeWeeklySixthSeventhDay({
    weekRows: sameActualDifferentDeclared,
    effectiveProfile: {
        hmeres_ergasias_ebdomadas: 5,
        pososto_prosayxhshs_6hs_hmeras: 40
    },
    hourlyRate: 10
});
assert.strictEqual(
    sameActualDifferentDeclaredResult.seventhDay.illegalOvertimeHours,
    declaredAboveActualResult.seventhDay.illegalOvertimeHours
);

const postDailyZero = week([7, 7, 7, 7, 7, 7, 0]);
postDailyZero[5].ores_ergasias_apologistika = 0;
const postDailyZeroResult = analyzeWeeklySixthSeventhDay({
    weekRows: postDailyZero,
    effectiveProfile: {
        hmeres_ergasias_ebdomadas: 5,
        pososto_prosayxhshs_6hs_hmeras: 40
    },
    calculatedWorkHoursAuthoritative: true
});
assert.strictEqual(postDailyZeroResult.status, 'NOT_APPLICABLE');
assert.strictEqual(postDailyZeroResult.dailyFacts[5].actualWorkHours, 0);
assert.strictEqual(postDailyZeroResult.sixthDay, null);

const lockedHrZero = week([7, 7, 7, 7, 7, 7, 0]);
Object.assign(lockedHrZero[5], {
    is_locked: true,
    locked_by: 'HR',
    locked_at: new Date('2026-08-01T12:00:00.000Z'),
    ores_ergasias_apologistika: 0
});
const lockedHrZeroResult = analyzeWeeklySixthSeventhDay({
    weekRows: lockedHrZero,
    effectiveProfile: {
        hmeres_ergasias_ebdomadas: 5,
        pososto_prosayxhshs_6hs_hmeras: 40
    }
});
assert.strictEqual(lockedHrZeroResult.status, 'NOT_APPLICABLE');
assert.strictEqual(lockedHrZeroResult.dailyFacts[5].actualWorkHours, 0);
assert.strictEqual(lockedHrZeroResult.sixthDay, null);

const employee0004RegressionWeek = week([8.60, 7.97, 6.48, 7.32, 7.42, 8.12, 7.28]);
employee0004RegressionWeek.forEach((day, index) => {
    const date = new Date('2026-06-15T00:00:00.000Z');
    date.setUTCDate(date.getUTCDate() + index);
    day.hmeromhnia = date.toISOString().slice(0, 10);
    day.ores_ergasias = [8.60, 7.97, 6.48, 7.32, 7.42, 8.12, 6.78][index];
});
Object.assign(employee0004RegressionWeek[1], { kathgoria_ergasias: 'ΕΡΓ', repo: false });
Object.assign(employee0004RegressionWeek[2], { kathgoria_ergasias: 'ΑΝ', repo: true });
Object.assign(employee0004RegressionWeek[5], { kathgoria_ergasias: 'ΕΡΓ', repo: false });
Object.assign(employee0004RegressionWeek[6], { kathgoria_ergasias: 'ΕΡΓ', repo: false });
Object.assign(employee0004RegressionWeek[6], {
    cards_apo_ora_01: '15:40',
    cards_eos_ora_01: '22:57',
    cards_ores_ergasias: 7.28,
    ores_ergasias_apologistika: 6.78,
    ores_nyxtas_apologistika: 0.45,
    ores_argion_prosayxhsh_apologistika: 6.78
});
const regressionInput = {
    weekRows: employee0004RegressionWeek,
    effectiveProfile: {
        hmeres_ergasias_ebdomadas: 5,
        pososto_prosayxhshs_6hs_hmeras: 40
    },
    hourlyRate: 10
};
const firstRegressionResult = analyzeWeeklySixthSeventhDay(regressionInput);
const secondRegressionResult = analyzeWeeklySixthSeventhDay(regressionInput);
assert.strictEqual(firstRegressionResult.status, 'READY');
assert.strictEqual(firstRegressionResult.sixthDay.hmeromhnia, '2026-06-21');
assert.strictEqual(firstRegressionResult.sixthDay.sixthDayHours, 6.78);
assert.strictEqual(firstRegressionResult.seventhDay.hmeromhnia, '2026-06-17');
assert.strictEqual(firstRegressionResult.seventhDay.actualWorkHours, 6.48);
assert.strictEqual(firstRegressionResult.seventhDay.illegalOvertimeHours, 6.48);
assert.deepStrictEqual(secondRegressionResult, firstRegressionResult);

for (const noLongerExempt of ['0018', '0020', '0021']) {
    result = analyze([7, 7, 7, 7, 7, 7, 0], {
        pososto_prosayxhshs_6hs_hmeras: 0,
        eidikh_kathgoria_ergazomenoy: noLongerExempt
    });
    assert.strictEqual(result.status, 'NEEDS_HR_DECISION');
    assert.ok(result.reasons.includes('ZERO_SIXTH_DAY_PREMIUM_RATE_WITHOUT_EXEMPTION'));
}

result = analyze([7, 7, 7, 7, 7, 7, 0], {
    pososto_prosayxhshs_6hs_hmeras: 10,
    eidikh_kathgoria_ergazomenoy: '0020'
});
assert.strictEqual(result.status, 'READY');
assert.strictEqual(result.premiumRate, 10);
assert.strictEqual(result.sixthDay.premiumRate, 10);
assert.strictEqual(result.sixthDay.value, 77);

result = analyze([7, 7, 7, 7, 7, 7, 0], {
    pososto_prosayxhshs_6hs_hmeras: 40,
    eidikh_kathgoria_ergazomenoy: '0020'
});
assert.strictEqual(result.status, 'READY');
assert.strictEqual(result.premiumRate, 40);
assert.strictEqual(result.sixthDay.premiumRate, 40);

const mixedProfileSixthDay = analyze(
    [7, 7, 7, 7, 7, 7, 0],
    { profile_changed_inside_week: true }
);
assert.strictEqual(mixedProfileSixthDay.status, 'NEEDS_HR_DECISION');
assert.deepStrictEqual(mixedProfileSixthDay.reasons, ['PROFILE_CHANGED_INSIDE_WEEK']);
assert.strictEqual(mixedProfileSixthDay.sixthDay, null);
assert.strictEqual(mixedProfileSixthDay.seventhDay, null);

const mixedProfileSeventhDay = analyze(
    [7, 7, 7, 7, 7, 7, 9],
    { profile_changed_inside_week: true }
);
assert.strictEqual(mixedProfileSeventhDay.status, 'NEEDS_HR_DECISION');
assert.deepStrictEqual(mixedProfileSeventhDay.reasons, ['PROFILE_CHANGED_INSIDE_WEEK']);
assert.strictEqual(mixedProfileSeventhDay.sixthDay, null);
assert.strictEqual(mixedProfileSeventhDay.seventhDay, null);

const unchangedProfileSeventhDay = analyze(
    [7, 7, 7, 7, 7, 7, 9],
    { profile_changed_inside_week: false }
);
assert.strictEqual(unchangedProfileSeventhDay.status, 'NEEDS_HR_DECISION');
assert.ok(unchangedProfileSeventhDay.reasons.includes(
    'WORKED_DECLARED_REPO_DAYS_REQUIRE_HR_CLASSIFICATION'));
assert.strictEqual(unchangedProfileSeventhDay.seventhDay, null);

function profilesByDate(workdays, rates = [], categories = []) {
    return Object.fromEntries(workdays.map((days, index) => {
        const date = new Date('2026-07-27T00:00:00.000Z');
        date.setUTCDate(date.getUTCDate() + index);
        return [date.toISOString().slice(0, 10), {
            kathestos_apasxolhshs: '0', hmeres_ergasias_ebdomadas: days,
            pososto_prosayxhshs_6hs_hmeras: rates[index] ?? 40,
            eidikh_kathgoria_ergazomenoy: categories[index] || ''
        }];
    }));
}

for (const workdays of [
    [4, 4, 4, 4, 4, 4, 4],
    [4, 4, 3, 3, 3, 3, 3],
    [3, 5, 5, 5, 5, 5, 5],
    [1, 1, 1, 1, 1, 2, 2]
]) {
    const structuralResult = analyzeWeeklySixthSeventhDay({
        weekRows: week([7, 7, 7, 7, 7, 7, 0]),
        effectiveProfile: { hmeres_ergasias_ebdomadas: workdays.at(-1),
            pososto_prosayxhshs_6hs_hmeras: 40 },
        effectiveProfilesByDate: profilesByDate(workdays)
    });
    assert.strictEqual(structuralResult.status, 'NOT_APPLICABLE');
    assert.deepStrictEqual(structuralResult.reasons, []);
}

const rateChangesAfterSixth = analyzeWeeklySixthSeventhDay({
    weekRows: week([7, 7, 7, 7, 7, 7, 0]),
    effectiveProfile: { hmeres_ergasias_ebdomadas: 5,
        pososto_prosayxhshs_6hs_hmeras: 10, profile_changed_inside_week: true },
    effectiveProfilesByDate: profilesByDate(
        [5, 5, 5, 5, 5, 5, 5], [10, 10, 10, 10, 10, 40, 40])
});
assert.strictEqual(rateChangesAfterSixth.status, 'READY');
assert.strictEqual(rateChangesAfterSixth.sixthDay.premiumRate, 40);

const sixthBeforeRateChangeRows = week([7, 7, 7, 7, 7, 9, 0]);
const rateChangesAfterSelectedSixth = analyzeWeeklySixthSeventhDay({
    weekRows: sixthBeforeRateChangeRows,
    effectiveProfile: { hmeres_ergasias_ebdomadas: 5,
        pososto_prosayxhshs_6hs_hmeras: 40, profile_changed_inside_week: true },
    effectiveProfilesByDate: profilesByDate(
        [5, 5, 5, 5, 5, 5, 5], [10, 10, 10, 10, 10, 40, 40])
});
assert.strictEqual(rateChangesAfterSelectedSixth.status, 'READY');
assert.strictEqual(rateChangesAfterSelectedSixth.sixthDay.hmeromhnia, '2026-07-31');
assert.strictEqual(rateChangesAfterSelectedSixth.sixthDay.premiumRate, 10);

const exemptOnSixthDate = analyzeWeeklySixthSeventhDay({
    weekRows: week([7, 7, 7, 7, 7, 7, 0]),
    effectiveProfile: { hmeres_ergasias_ebdomadas: 5,
        pososto_prosayxhshs_6hs_hmeras: 40 },
    effectiveProfilesByDate: profilesByDate(
        [5, 5, 5, 5, 5, 5, 5], [40, 40, 40, 40, 40, 40, 40],
        ['', '', '', '', '', '0009', ''])
});
assert.strictEqual(exemptOnSixthDate.status, 'READY');
assert.strictEqual(exemptOnSixthDate.sixthDay.premiumRate, 0);

// C3.4: the two current canonical repo identities drive the handoff from the
// selected sixth day to the complementary remaining repo.
const basicIdentity = analyze([7, 7, 7, 7, 7, 7, 0]);
assert.deepStrictEqual(basicIdentity.canonicalRepoDayIdentities, [
    '2026-08-01',
    '2026-08-02'
]);
assert.strictEqual(basicIdentity.sixthDayRepoIdentity, '2026-08-01');
assert.strictEqual(basicIdentity.remainingRepoIdentity, '2026-08-02');
assert.strictEqual(basicIdentity.seventhDay, null);

const bothReposWorked = analyze([7, 7, 7, 7, 7, 8, 9]);
assert.strictEqual(bothReposWorked.status, 'NEEDS_HR_DECISION');
assert.deepStrictEqual(bothReposWorked.reasons, [
    'WORKED_DECLARED_REPO_DAYS_REQUIRE_HR_CLASSIFICATION'
]);
assert.strictEqual(bothReposWorked.sixthDay, null);
assert.strictEqual(bothReposWorked.seventhDay, null);

// Reverse chronological trap: Sunday is selected as sixth by the existing
// standard-candidate tie-break, so the earlier Saturday identity is seventh.
const reverseChronological = analyze([7, 7, 7, 7, 7, 9, 7]);
assert.strictEqual(reverseChronological.status, 'NEEDS_HR_DECISION');
assert.ok(reverseChronological.reasons.includes(
    'WORKED_DECLARED_REPO_DAYS_REQUIRE_HR_CLASSIFICATION'));
assert.strictEqual(reverseChronological.seventhDay, null);

const transferredRepoWeek = week([7, 7, 7, 7, 7, 7, 7]);
Object.assign(transferredRepoWeek[4], {
    kathgoria_ergasias_apologistika: 'ΑΝ',
    repo_apologistika: true
});
Object.assign(transferredRepoWeek[5], {
    kathgoria_ergasias_apologistika: 'ΕΡΓ',
    repo_apologistika: false
});
Object.assign(transferredRepoWeek[6], {
    kathgoria_ergasias: 'ΑΝ',
    repo: true
});
const transferredRepoResult = analyzeWeeklySixthSeventhDay({
    weekRows: transferredRepoWeek,
    effectiveProfile: {
        hmeres_ergasias_ebdomadas: 5,
        pososto_prosayxhshs_6hs_hmeras: 40
    },
    hourlyRate: 10
});
assert.deepStrictEqual(transferredRepoResult.canonicalRepoDayIdentities, [
    '2026-08-01',
    '2026-08-02'
]);
assert.strictEqual(transferredRepoResult.status, 'NEEDS_HR_DECISION');
assert.ok(transferredRepoResult.reasons.includes(
    'WORKED_DECLARED_REPO_DAYS_REQUIRE_HR_CLASSIFICATION'));
assert.strictEqual(transferredRepoResult.sixthDay, null);
assert.strictEqual(transferredRepoResult.seventhDay, null);

const changedSixthSelection = analyze([7, 7, 7, 7, 7, 7, 9]);
assert.strictEqual(changedSixthSelection.status, 'NEEDS_HR_DECISION');
assert.strictEqual(changedSixthSelection.seventhDay, null);

const nonRepoLastOccurrence = week([7, 7, 7, 7, 7, 7, 7]);
Object.assign(nonRepoLastOccurrence[2], { kathgoria_ergasias: 'ΑΝ', repo: true });
Object.assign(nonRepoLastOccurrence[3], { kathgoria_ergasias: 'ΑΝ', repo: true });
Object.assign(nonRepoLastOccurrence[5], { kathgoria_ergasias: 'ΕΡΓ', repo: false });
Object.assign(nonRepoLastOccurrence[6], { kathgoria_ergasias: 'ΕΡΓ', repo: false });
const nonRepoLastResult = analyzeWeeklySixthSeventhDay({
    weekRows: nonRepoLastOccurrence,
    effectiveProfile: { hmeres_ergasias_ebdomadas: 5, pososto_prosayxhshs_6hs_hmeras: 40 },
    hourlyRate: 10
});
assert.strictEqual(nonRepoLastResult.status, 'NEEDS_HR_DECISION');
assert.ok(nonRepoLastResult.reasons.includes(
    'WORKED_DECLARED_REPO_DAYS_REQUIRE_HR_CLASSIFICATION'));
assert.strictEqual(nonRepoLastResult.seventhDay, null);

const ambiguousRepoWeek = week([7, 7, 7, 7, 7, 7, 7]);
ambiguousRepoWeek.forEach((day) => Object.assign(day, {
    kathgoria_ergasias: 'ΕΡΓ',
    repo: false
}));
const ambiguousRepoResult = analyzeWeeklySixthSeventhDay({
    weekRows: ambiguousRepoWeek,
    effectiveProfile: { hmeres_ergasias_ebdomadas: 5, pososto_prosayxhshs_6hs_hmeras: 40 }
});
assert.strictEqual(ambiguousRepoResult.status, 'NEEDS_HR_DECISION');
assert.ok(ambiguousRepoResult.reasons.includes('CANONICAL_REPO_IDENTITIES_NOT_DETERMINISTIC'));
assert.strictEqual(ambiguousRepoResult.sixthDay, null);
assert.strictEqual(ambiguousRepoResult.seventhDay, null);

const humanClassificationRows = week([7, 7, 7, 7, 7, 8, 7]);
const humanClassificationResult = analyzeWeeklySixthSeventhDay({
    weekRows: humanClassificationRows,
    effectiveProfile: { hmeres_ergasias_ebdomadas: 5, pososto_prosayxhshs_6hs_hmeras: 40 },
    hourlyRate: 10,
    classificationByDateOverride: {
        '2026-08-01': 'SIXTH',
        '2026-08-02': 'SEVENTH'
    }
});
assert.strictEqual(humanClassificationResult.status, 'READY');
assert.strictEqual(humanClassificationResult.sixthDay.hmeromhnia, '2026-08-01');
assert.strictEqual(humanClassificationResult.sixthDay.sixthDayHours, 8);
assert.strictEqual(humanClassificationResult.sixthDay.illegalOvertimeHours, 0);
assert.strictEqual(humanClassificationResult.seventhDay.hmeromhnia, '2026-08-02');
assert.strictEqual(humanClassificationResult.seventhDay.illegalOvertimeHours, 7);

const invalidHumanClassification = analyzeWeeklySixthSeventhDay({
    weekRows: humanClassificationRows,
    effectiveProfile: { hmeres_ergasias_ebdomadas: 5, pososto_prosayxhshs_6hs_hmeras: 40 },
    classificationByDateOverride: { '2026-08-01': 'NORMAL' }
});
assert.strictEqual(invalidHumanClassification.status, 'NEEDS_HR_DECISION');
assert.deepStrictEqual(invalidHumanClassification.reasons, [
    'CANONICAL_DECISION_CLASSIFICATION_INVALID'
]);

assert.strictEqual(singleWorkedRepoResult.seventhDay.illegalOvertimeHours, 6.48);
assert.strictEqual(singleWorkedRepoResult.seventhDay.classification, 'SEVENTH_DAY_ILLEGAL_OVERTIME');
assert.strictEqual(singleWorkedRepoResult.seventhDay.severity, 'SERIOUS_VIOLATION');
assert.strictEqual(Object.hasOwn(singleWorkedRepoResult.seventhDay, 'sixthDayHours'), false);

// With exactly six actual workdays, the latest standard candidate is SIXTH.
const sixActualNonRepoSixth = analyze([7, 7.9, 7, 7, 7, 7, 0]);
assert.strictEqual(sixActualNonRepoSixth.status, 'READY');
assert.strictEqual(sixActualNonRepoSixth.sixthDayIdentity, '2026-08-01');
assert.strictEqual(sixActualNonRepoSixth.sixthDay.hmeromhnia, '2026-08-01');
assert.strictEqual(sixActualNonRepoSixth.sixthDayRepoIdentity, '2026-08-01');
assert.strictEqual(sixActualNonRepoSixth.remainingRepoIdentity, '2026-08-02');
assert.strictEqual(sixActualNonRepoSixth.seventhDay, null);
const sixActualNonRepoOverride = analyzeWeeklySixthSeventhDay({
    weekRows: week([7, 7.9, 7, 7, 7, 7, 0]),
    effectiveProfile: { hmeres_ergasias_ebdomadas: 5, pososto_prosayxhshs_6hs_hmeras: 40 },
    classificationByDateOverride: {
        '2026-07-28': 'SIXTH',
        '2026-08-01': 'NORMAL'
    }
});
assert.strictEqual(sixActualNonRepoOverride.status, 'READY');
assert.strictEqual(sixActualNonRepoOverride.sixthDayIdentity, '2026-07-28');

const differentNonRepoSixthRows = week([7, 7.9, 7.5, 7, 7, 7, 0]);
const automaticDifferentNonRepoSixth = analyzeWeeklySixthSeventhDay({
    weekRows: differentNonRepoSixthRows,
    effectiveProfile: { hmeres_ergasias_ebdomadas: 5, pososto_prosayxhshs_6hs_hmeras: 40 }
});
assert.strictEqual(automaticDifferentNonRepoSixth.sixthDayIdentity, '2026-08-01');
const humanDifferentNonRepoSixth = analyzeWeeklySixthSeventhDay({
    weekRows: differentNonRepoSixthRows,
    effectiveProfile: { hmeres_ergasias_ebdomadas: 5, pososto_prosayxhshs_6hs_hmeras: 40 },
    classificationByDateOverride: {
        '2026-07-28': 'NORMAL',
        '2026-07-29': 'SIXTH',
        '2026-08-01': 'NORMAL'
    }
});
assert.strictEqual(humanDifferentNonRepoSixth.status, 'READY');
assert.strictEqual(humanDifferentNonRepoSixth.sixthDayIdentity, '2026-07-29');
assert.strictEqual(humanDifferentNonRepoSixth.sixthDay.hmeromhnia, '2026-07-29');
assert.strictEqual(humanDifferentNonRepoSixth.sixthDay.actualWorkHours, 7.5);
assert.strictEqual(humanDifferentNonRepoSixth.sixthDay.sixthDayHours, 7.5);
assert.strictEqual(humanDifferentNonRepoSixth.sixthDayRepoIdentity, null);

const differentRepoSixthRows = week([7, 7.9, 7.5, 7, 7, 7.6, 0]);
const humanDifferentRepoSixth = analyzeWeeklySixthSeventhDay({
    weekRows: differentRepoSixthRows,
    effectiveProfile: { hmeres_ergasias_ebdomadas: 5, pososto_prosayxhshs_6hs_hmeras: 40 },
    classificationByDateOverride: {
        '2026-07-28': 'NORMAL',
        '2026-08-01': 'SIXTH'
    }
});
assert.strictEqual(humanDifferentRepoSixth.status, 'READY');
assert.strictEqual(humanDifferentRepoSixth.sixthDayIdentity, '2026-08-01');
assert.strictEqual(humanDifferentRepoSixth.sixthDay.hmeromhnia, '2026-08-01');
assert.strictEqual(humanDifferentRepoSixth.sixthDay.actualWorkHours, 7.6);
assert.strictEqual(humanDifferentRepoSixth.sixthDay.sixthDayHours, 7.6);
assert.strictEqual(humanDifferentRepoSixth.sixthDayRepoIdentity, '2026-08-01');

const sevenActualRepoSixth = analyze([7, 7, 7, 7, 7, 7.9, 7.8]);
assert.strictEqual(sevenActualRepoSixth.status, 'NEEDS_HR_DECISION');
assert.ok(sevenActualRepoSixth.reasons.includes(
    'WORKED_DECLARED_REPO_DAYS_REQUIRE_HR_CLASSIFICATION'));
assert.strictEqual(sevenActualRepoSixth.seventhDay, null);

const ambiguousNonRepoRows = week([7, 7.9, 7, 7, 7, 7.8, 7.7]);
const sevenActualNonRepoSixth = analyzeWeeklySixthSeventhDay({
    weekRows: ambiguousNonRepoRows,
    effectiveProfile: { hmeres_ergasias_ebdomadas: 5, pososto_prosayxhshs_6hs_hmeras: 40 }
});
assert.strictEqual(sevenActualNonRepoSixth.status, 'NEEDS_HR_DECISION');
assert.deepStrictEqual(sevenActualNonRepoSixth.reasons, [
    'WORKED_DECLARED_REPO_DAYS_REQUIRE_HR_CLASSIFICATION'
]);
assert.strictEqual(sevenActualNonRepoSixth.seventhDay, null);

const resolvedAmbiguousClassification = analyzeWeeklySixthSeventhDay({
    weekRows: ambiguousNonRepoRows,
    effectiveProfile: { hmeres_ergasias_ebdomadas: 5, pososto_prosayxhshs_6hs_hmeras: 40 },
    classificationByDateOverride: {
        '2026-07-28': 'SIXTH',
        '2026-08-01': 'SEVENTH'
    }
});
assert.strictEqual(resolvedAmbiguousClassification.status, 'READY');
assert.strictEqual(resolvedAmbiguousClassification.sixthDayIdentity, '2026-07-28');
assert.strictEqual(resolvedAmbiguousClassification.sixthDayRepoIdentity, null);
assert.strictEqual(resolvedAmbiguousClassification.seventhDay.hmeromhnia, '2026-08-01');
assert.strictEqual(resolvedAmbiguousClassification.remainingRepoIdentity, '2026-08-01');

for (const invalidClassification of [
    { '2026-07-28': 'SIXTH', '2026-07-29': 'SIXTH', '2026-08-01': 'SEVENTH' },
    { '2026-07-28': 'SIXTH', '2026-08-01': 'SEVENTH', '2026-08-02': 'SEVENTH' },
    { '2026-07-28': 'SIXTH', '2026-07-27': 'SEVENTH' },
    { '2026-07-28': 'SIXTH,SEVENTH', '2026-08-01': 'SEVENTH' }
]) {
    const invalid = analyzeWeeklySixthSeventhDay({
        weekRows: ambiguousNonRepoRows,
        effectiveProfile: { hmeres_ergasias_ebdomadas: 5, pososto_prosayxhshs_6hs_hmeras: 40 },
        classificationByDateOverride: invalidClassification
    });
    assert.strictEqual(invalid.status, 'NEEDS_HR_DECISION');
    assert.ok(invalid.reasons.includes('CANONICAL_DECISION_CLASSIFICATION_INVALID'));
}
const nonActualSixth = analyzeWeeklySixthSeventhDay({
    weekRows: week([7, 7, 7, 7, 7, 7, 0]),
    effectiveProfile: { hmeres_ergasias_ebdomadas: 5, pososto_prosayxhshs_6hs_hmeras: 40 },
    classificationByDateOverride: { '2026-08-02': 'SIXTH' }
});
assert.strictEqual(nonActualSixth.status, 'NEEDS_HR_DECISION');
assert.ok(nonActualSixth.reasons.includes('CANONICAL_DECISION_CLASSIFICATION_INVALID'));

for (const [name, nonActualUpdate] of [
    ['clean repo', { kathgoria_ergasias: 'ΑΝ', repo: true, cards_ores_ergasias: 0,
        cards_apo_ora_01: '', cards_eos_ora_01: '' }],
    ['HR sickness', { kathgoria_ergasias: 'ΕΡΓ', repo: false,
        astheneia_apologistika: true, cards_ores_ergasias: 0,
        cards_apo_ora_01: '', cards_eos_ora_01: '' }],
    ['HR leave', { kathgoria_ergasias: 'ΕΡΓ', repo: false,
        adeia_apologistika: true, cards_ores_ergasias: 0,
        cards_apo_ora_01: '', cards_eos_ora_01: '' }],
    ['HR absence', { kathgoria_ergasias: 'ΕΡΓ', repo: false,
        apousia_apologistika: true, cards_ores_ergasias: 0,
        cards_apo_ora_01: '', cards_eos_ora_01: '' }]
]) {
    const fixtureRows = week([7, 7, 7, 7, 7, 7, 0]);
    Object.assign(fixtureRows[6], nonActualUpdate);
    const fixtureResult = analyzeWeeklySixthSeventhDay({
        weekRows: fixtureRows,
        effectiveProfile: { hmeres_ergasias_ebdomadas: 5,
            pososto_prosayxhshs_6hs_hmeras: 40 }
    });
    assert.strictEqual(fixtureResult.status, 'READY', name);
    assert.strictEqual(fixtureResult.dailyFacts[6].countsAsActualWorkDay, false, name);
    assert.strictEqual(fixtureResult.seventhDay, null, name);
}

const hireTuesdaySixWorkdays = week([0, 8, 8, 8, 8, 8, 8]).slice(1);
const hireTuesdayDates = hireTuesdaySixWorkdays.map((row) => row.hmeromhnia);
const hireTuesdayAnalysis = analyzeWeeklySixthSeventhDay({
    weekRows: hireTuesdaySixWorkdays,
    expectedDateKeys: hireTuesdayDates,
    effectiveProfile: { hmeres_ergasias_ebdomadas: 5,
        pososto_prosayxhshs_6hs_hmeras: 40 }
});
assert.strictEqual(hireTuesdayAnalysis.status, 'READY');
assert.strictEqual(hireTuesdayAnalysis.dailyFacts.length, 6);
assert.strictEqual(hireTuesdayAnalysis.sixthDay.hmeromhnia, '2026-08-02');
assert.strictEqual(hireTuesdayAnalysis.seventhDay, null);

const hireSaturdayTwoWorkdays = week([0, 0, 0, 0, 0, 8, 8]).slice(5);
const hireSaturdayAnalysis = analyzeWeeklySixthSeventhDay({
    weekRows: hireSaturdayTwoWorkdays,
    expectedDateKeys: hireSaturdayTwoWorkdays.map((row) => row.hmeromhnia),
    effectiveProfile: { hmeres_ergasias_ebdomadas: 5,
        pososto_prosayxhshs_6hs_hmeras: 40 }
});
assert.strictEqual(hireSaturdayAnalysis.status, 'NOT_APPLICABLE');
assert.strictEqual(hireSaturdayAnalysis.dailyFacts.length, 2);
assert.strictEqual(hireSaturdayAnalysis.sixthDay, null);

const mismatchedEmploymentSlice = analyzeWeeklySixthSeventhDay({
    weekRows: hireSaturdayTwoWorkdays,
    expectedDateKeys: ['2026-07-31', ...hireSaturdayTwoWorkdays.map((row) => row.hmeromhnia)],
    effectiveProfile: { hmeres_ergasias_ebdomadas: 5,
        pososto_prosayxhshs_6hs_hmeras: 40 }
});
assert.strictEqual(mismatchedEmploymentSlice.status, 'NEEDS_HR_DECISION');
assert.ok(mismatchedEmploymentSlice.reasons.includes(
    'INVALID_OR_INCOMPLETE_MONDAY_SUNDAY_WEEK'));

console.log('weekly sixth/seventh-day policy tests passed');
