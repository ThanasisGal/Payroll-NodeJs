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
        kathgoria_ergasias: 'ΕΡΓ',
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

const laterCardHoursOverEight = week([7, 7, 7, 7, 7, 9, 0]);
assert.strictEqual(analyzeWeeklySixthSeventhDay({
    weekRows: laterCardHoursOverEight,
    effectiveProfile: { hmeres_ergasias_ebdomadas: 5, pososto_prosayxhshs_6hs_hmeras: 40 },
    hourlyRate: 10
}).sixthDay.hmeromhnia, '2026-07-31');

const productionSevenDayExample = week([8.60, 7.97, 6.48, 7.32, 7.42, 8.12, 6.78]);
result = analyzeWeeklySixthSeventhDay({
    weekRows: productionSevenDayExample,
    effectiveProfile: { hmeres_ergasias_ebdomadas: 5, pososto_prosayxhshs_6hs_hmeras: 40 },
    hourlyRate: 10
});
assert.strictEqual(result.sixthDay.hmeromhnia, '2026-07-31');
assert.strictEqual(result.sixthDay.actualWorkHours, 7.42);
assert.strictEqual(result.seventhDay.hmeromhnia, '2026-08-02');

const incompleteInterval = week([7, 7, 7, 7, 7, 7, 0]);
incompleteInterval[5].cards_eos_ora_01 = '';
result = analyzeWeeklySixthSeventhDay({
    weekRows: incompleteInterval,
    effectiveProfile: { hmeres_ergasias_ebdomadas: 5, pososto_prosayxhshs_6hs_hmeras: 40 },
    hourlyRate: 10
});
assert.strictEqual(result.status, 'NEEDS_HR_DECISION');
assert.strictEqual(result.sixthDay, null);
assert.ok(result.reasons.includes('CARD_VERIFICATION_PENDING'));
assert.ok(result.warnings.includes('INCOMPLETE_CARD_INTERVAL'));

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
assert.strictEqual(result.sixthDay.value, 70);
assert.strictEqual(result.sixthDay.premiumRate, 0);
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

result = analyze([7, 7, 7, 7, 7, 6, 9]);
assert.strictEqual(result.seventhDay.hmeromhnia, '2026-08-02');
assert.strictEqual(result.sixthDay.hmeromhnia, '2026-08-01');
assert.ok(result.warnings.includes('SEVENTH_CONSECUTIVE_ACTUAL_WORK_DAY_CONTRACT_VIOLATION'));
assert.strictEqual(result.seventhDay.actualWorkHours, 9);
assert.strictEqual(result.seventhDay.illegalOvertimeHours, 9);
assert.strictEqual(result.seventhDay.severity, 'SERIOUS_VIOLATION');
assert.strictEqual(result.seventhDay.classification, 'SEVENTH_DAY_ILLEGAL_OVERTIME');

const declaredAboveActual = week([7, 7, 7, 7, 7, 7, 7]);
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

const employee0004RegressionWeek = week([8.60, 7.97, 6.48, 7.32, 7.42, 8.12, 7.28]);
employee0004RegressionWeek.forEach((day, index) => {
    const date = new Date('2026-06-15T00:00:00.000Z');
    date.setUTCDate(date.getUTCDate() + index);
    day.hmeromhnia = date.toISOString().slice(0, 10);
    day.ores_ergasias = [8.60, 7.97, 6.48, 7.32, 7.42, 8.12, 6.78][index];
});
Object.assign(employee0004RegressionWeek[6], {
    cards_apo_ora_01: '15:40',
    cards_eos_ora_01: '22:57',
    cards_ores_ergasias: 7.28,
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
assert.strictEqual(firstRegressionResult.sixthDay.hmeromhnia, '2026-06-19');
assert.strictEqual(firstRegressionResult.seventhDay.hmeromhnia, '2026-06-21');
assert.strictEqual(firstRegressionResult.seventhDay.actualWorkHours, 7.28);
assert.strictEqual(firstRegressionResult.seventhDay.illegalOvertimeHours, 7.28);
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
assert.strictEqual(result.sixthDay.value, 77);

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
assert.strictEqual(unchangedProfileSeventhDay.status, 'READY');
assert.strictEqual(unchangedProfileSeventhDay.sixthDay.hmeromhnia, '2026-08-01');
assert.strictEqual(unchangedProfileSeventhDay.seventhDay.hmeromhnia, '2026-08-02');
assert.strictEqual(unchangedProfileSeventhDay.seventhDay.illegalOvertimeHours, 9);

console.log('weekly sixth/seventh-day policy tests passed');
