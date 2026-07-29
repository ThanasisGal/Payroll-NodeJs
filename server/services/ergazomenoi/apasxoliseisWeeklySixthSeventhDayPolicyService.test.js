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
        cards_ores_ergasias: cards
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
assert.strictEqual(result.sixthDay.value, 98);

result = analyze([7, 7, 7, 7, 7, 7, 0]);
assert.strictEqual(result.sixthDay.hmeromhnia, '2026-08-01');

const noCardSunday = week([7, 7, 7, 7, 7, 7, 0]);
assert.strictEqual(analyzeWeeklySixthSeventhDay({
    weekRows: noCardSunday,
    effectiveProfile: { hmeres_ergasias_ebdomadas: 5, pososto_prosayxhshs_6hs_hmeras: 40 },
    hourlyRate: 10
}).sixthDay.hmeromhnia, '2026-08-01');

const mixedLeave = week([7, 7, 7, 7, 7, 4, 0]);
Object.assign(mixedLeave[5], { adeia: true, kathgoria_ergasias: 'ΑΔΕΙΑ' });
result = analyzeWeeklySixthSeventhDay({
    weekRows: mixedLeave,
    effectiveProfile: { hmeres_ergasias_ebdomadas: 5, pososto_prosayxhshs_6hs_hmeras: 40 },
    hourlyRate: 10
});
assert.strictEqual(result.sixthDay.hmeromhnia, '2026-07-31');

result = analyze([4, 4, 4, 4, 4, 9, 0]);
assert.ok(result.warnings.includes('SIXTH_DAY_DAILY_HOURS_EXCEED_EIGHT'));
assert.strictEqual(result.sixthDay.value, 126);

result = analyze([4, 4, 4, 4, 4, 4, 0]);
assert.strictEqual(result.status, 'NEEDS_HR_DECISION');
assert.ok(result.reasons.includes('SIXTH_DAY_CANDIDATE_NOT_DETERMINISTIC'));

assert.strictEqual(analyze([7, 7, 7, 7, 7, 7, 0], { pososto_prosayxhshs_6hs_hmeras: 0 }).sixthDay.value, 70);
assert.strictEqual(analyze([7, 7, 7, 7, 7, 7, 0], { pososto_prosayxhshs_6hs_hmeras: 12.5 }).sixthDay.value, 78.75);
for (const rate of [null, '', -1, 'invalid']) {
    result = analyze([7, 7, 7, 7, 7, 7, 0], { pososto_prosayxhshs_6hs_hmeras: rate });
    assert.strictEqual(result.status, 'NEEDS_HR_DECISION');
    assert.ok(result.reasons.includes('MISSING_OR_INVALID_SIXTH_DAY_PREMIUM_RATE'));
}

result = analyze([7, 7, 7, 7, 7, 6, 9]);
assert.strictEqual(result.seventhDay.hmeromhnia, '2026-08-02');
assert.strictEqual(result.sixthDay.hmeromhnia, '2026-08-01');
assert.ok(result.warnings.includes('SEVENTH_CONSECUTIVE_ACTUAL_WORK_DAY_CONTRACT_VIOLATION'));
assert.strictEqual(result.seventhDay.actualWorkHours, 9);

result = analyze([7, 7, 7, 7, 7, 7, 0], { profile_changed_inside_week: true });
assert.strictEqual(result.status, 'NEEDS_HR_DECISION');
assert.ok(result.reasons.includes('PROFILE_CHANGED_INSIDE_WEEK'));

console.log('weekly sixth/seventh-day policy tests passed');
