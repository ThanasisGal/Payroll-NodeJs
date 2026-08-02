const assert = require('assert');
const {
    buildDailyCompensationBreakdown
} = require('./apasxoliseisDailyCompensationBreakdownService');

const row = {
    company_kod: 'COMPANY-1',
    hmeromhnia: '2026-08-01',
    kathgoria_ergasias: 'ΕΡΓ',
    ores_ergasias: 8,
    cards_ores_ergasias: 10,
    ores_nyxtas_apologistika: 2,
    ores_argion_prosayxhsh_apologistika: 2,
    ores_argion_ergasia_apologistika: 0
};

let result = buildDailyCompensationBreakdown({
    row,
    paidHourlyRate: 10,
    legalHourlyRate: 8,
    sixthDayHours: 8,
    weeklyIllegalOvertimeHours: 2,
    sixthDayMandatoryRatePercent: 40
});
assert.strictEqual(result.status, 'READY');
assert.strictEqual(result.hours.actualWorkHours, 10);
assert.strictEqual(result.hours.nightHours, 2);
assert.strictEqual(result.hours.sundayHolidayWorkHours, 2);
assert.strictEqual(result.hours.sixthDayHours, 8);
assert.strictEqual(result.hours.illegalOvertimeHours, 2);
assert.strictEqual(result.amounts.baseActualWorkAmount, 100);
assert.strictEqual(result.amounts.premiumTotalAmount, 72);
assert.strictEqual(result.amounts.grossWorkAmount, 172);
assert.strictEqual(result.accumulationRule, 'BASE_ONCE_PREMIUMS_CUMULATIVE');

result = buildDailyCompensationBreakdown({
    row: {
        company_kod: 'COMPANY-1',
        hmeromhnia: '2026-08-02',
        kathgoria_ergasias: 'ΑΡΓΙΑ',
        argia: true,
        ores_ergasias: 8,
        cards_ores_ergasias: 0
    },
    paidHourlyRate: 10,
    legalHourlyRate: 8
});
assert.strictEqual(result.status, 'READY');
assert.strictEqual(result.hours.actualWorkHours, 0);
assert.strictEqual(result.hours.holidayCreditedHours, 8);
assert.strictEqual(result.hours.sundayHolidayWorkHours, 0);
assert.strictEqual(result.amounts.grossWorkAmount, 0);

result = buildDailyCompensationBreakdown({
    row: {
        company_kod: 'COMPANY-1',
        hmeromhnia: '2026-08-03',
        kathgoria_ergasias: 'ΑΔΕΙΑ',
        adeia: true,
        ores_ergasias: 8,
        cards_ores_ergasias: 4
    },
    paidHourlyRate: 10,
    legalHourlyRate: 8
});
assert.strictEqual(result.status, 'NEEDS_HR_DECISION');
assert.ok(result.reasons.includes('FULL_DAY_LEAVE_WITH_CARD_WORK_REQUIRES_HR_DECISION'));
assert.strictEqual(result.amounts.grossWorkAmount, null);

result = buildDailyCompensationBreakdown({
    row: { ...row, cards_ores_ergasias: 8 },
    paidHourlyRate: 10,
    legalHourlyRate: 8,
    companyRules: [{
        _id: 'bad-night-rate',
        company_kod: 'COMPANY-1',
        policy_code: 'NIGHT_PREMIUM',
        rate_percent: 10,
        effective_from: '2026-01-01',
        version: 'v1',
        justification: 'Κανόνας προς απόρριψη',
        legal_basis_type: 'ΕΤΑΙΡΙΚΟΣ',
        legal_basis_reference: 'RULE-1',
        status: 'ACTIVE'
    }]
});
assert.strictEqual(result.components[0].ratePercent, 25);
assert.strictEqual(result.components[0].policyStatus, 'REJECTED_LESS_FAVORABLE');
assert.ok(result.warnings.includes('REJECTED_LESS_FAVORABLE'));

result = buildDailyCompensationBreakdown({ row, paidHourlyRate: 0, legalHourlyRate: 0 });
assert.strictEqual(result.status, 'NEEDS_HR_DECISION');
assert.ok(result.reasons.includes('MISSING_PAID_HOURLY_RATE'));
assert.ok(result.reasons.includes('MISSING_LEGAL_HOURLY_RATE'));
assert.strictEqual(result.amounts.grossWorkAmount, null);

console.log('daily cumulative compensation breakdown tests passed');
