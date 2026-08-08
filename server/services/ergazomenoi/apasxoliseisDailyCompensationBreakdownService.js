const {
    resolveDailyActualWorkFacts
} = require('./apasxoliseisDailyActualWorkFactsService');
const {
    POLICY_CODE,
    COMMON_RATE_PERCENT,
    resolveCompanyPolicyRate
} = require('./apasxoliseisCompanyPolicyRuleService');
const { roundPayrollMoney } = require('../kinhseis/payrollMoneyService');

const POLICY_VERSION = 'daily-cumulative-compensation-breakdown:v2';
const STATUS = Object.freeze({
    READY: 'READY',
    PARTIALLY_VERIFIED: 'PARTIALLY_VERIFIED',
    UNVERIFIED: 'UNVERIFIED',
    NEEDS_HR_DECISION: 'NEEDS_HR_DECISION'
});

function numberOrNull(value) {
    if (value === null || value === undefined || String(value).trim() === '') return null;
    const parsed = Number(String(value).replace(',', '.').trim());
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function numberOrZero(value) {
    return numberOrNull(value) ?? 0;
}

function hourlyRateOrNull(value) {
    const rate = numberOrNull(value);
    return rate !== null && rate > 0 ? rate : null;
}

function money(value) {
    return roundPayrollMoney(value);
}

function sumFields(row, fields) {
    return money(fields.reduce((total, field) => total + numberOrZero(row?.[field]), 0));
}

function buildDailyCompensationBreakdown({
    row = {},
    companyKod = row.company_kod,
    atDate = row.hmeromhnia,
    paidHourlyRate = null,
    legalHourlyRate = null,
    sixthDayHours = 0,
    weeklyIllegalOvertimeHours = 0,
    sixthDayMandatoryRatePercent = null,
    companyRules = [],
    blockingReasons = []
} = {}) {
    const facts = resolveDailyActualWorkFacts(row);
    const paidRate = hourlyRateOrNull(paidHourlyRate);
    const legalRate = hourlyRateOrNull(legalHourlyRate);
    const actualWorkHours = numberOrZero(facts.actualWorkHours);
    const nightHours = numberOrZero(row.ores_nyxtas_apologistika);
    const holidayWorkHours = sumFields(row, [
        'ores_argion_prosayxhsh_apologistika',
        'ores_argion_ergasia_apologistika'
    ]);
    const storedIllegalOvertimeHours = sumFields(row, [
        'ores_paranomhs_yperorias_apologistika',
        'ores_paranomhs_yperorias_nyxtas_apologistika',
        'ores_paranomhs_yperorias_argion_apologistika',
        'ores_paranomhs_yperorias_argion_nyxtas_apologistika'
    ]);
    const sixthHours = numberOrZero(sixthDayHours);
    const illegalOvertimeHours = Math.max(
        storedIllegalOvertimeHours,
        numberOrZero(weeklyIllegalOvertimeHours)
    );

    const reasons = [
        ...facts.reasons,
        ...(Array.isArray(blockingReasons) ? blockingReasons : [])
    ];
    const warnings = [...facts.warnings];
    const hourChecks = { nightHours, holidayWorkHours, sixthHours, illegalOvertimeHours };
    for (const [name, hours] of Object.entries(hourChecks)) {
        if (hours > actualWorkHours + 0.02) reasons.push(`${name.toUpperCase()}_EXCEEDS_ACTUAL_WORK`);
    }

    const rateInputs = [
        [POLICY_CODE.NIGHT_PREMIUM, COMMON_RATE_PERCENT[POLICY_CODE.NIGHT_PREMIUM]],
        [
            POLICY_CODE.SUNDAY_HOLIDAY_PREMIUM,
            COMMON_RATE_PERCENT[POLICY_CODE.SUNDAY_HOLIDAY_PREMIUM]
        ],
        [
            POLICY_CODE.SIXTH_DAY_PREMIUM,
            numberOrNull(sixthDayMandatoryRatePercent) ?? 0
        ],
        [
            POLICY_CODE.ILLEGAL_OVERTIME_PREMIUM,
            COMMON_RATE_PERCENT[POLICY_CODE.ILLEGAL_OVERTIME_PREMIUM]
        ]
    ];
    const rates = Object.fromEntries(
        rateInputs.map(([policyCode, baseline]) => [
            policyCode,
            resolveCompanyPolicyRate({
                companyKod,
                policyCode,
                atDate,
                commonRatePercent: baseline,
                mandatoryFloorRatePercent: baseline,
                companyRules
            })
        ])
    );
    for (const rate of Object.values(rates)) {
        if (rate.status.startsWith('REJECTED_')) warnings.push(rate.status);
    }

    if (actualWorkHours > 0 && paidRate === null) reasons.push('MISSING_PAID_HOURLY_RATE');
    if ((nightHours > 0 || holidayWorkHours > 0) && legalRate === null) {
        reasons.push('MISSING_LEGAL_HOURLY_RATE');
    }

    const component = (code, hours, rate, baseRate, rateBasis) => ({
        code,
        hours: money(hours),
        ratePercent: rate.ratePercent,
        rateBasis,
        baseHourlyRate: baseRate,
        premiumAmount:
            baseRate === null ? null : money(hours * baseRate * rate.ratePercent / 100),
        policySource: rate.source,
        policyStatus: rate.status,
        appliedRuleId: rate.appliedRuleId
    });

    const components = [
        component(POLICY_CODE.NIGHT_PREMIUM, nightHours, rates.NIGHT_PREMIUM, legalRate, 'LEGAL_HOURLY_RATE'),
        component(
            POLICY_CODE.SUNDAY_HOLIDAY_PREMIUM,
            holidayWorkHours,
            rates.SUNDAY_HOLIDAY_PREMIUM,
            legalRate,
            'LEGAL_HOURLY_RATE'
        ),
        component(POLICY_CODE.SIXTH_DAY_PREMIUM, sixthHours, rates.SIXTH_DAY_PREMIUM, paidRate, 'PAID_HOURLY_RATE'),
        component(
            POLICY_CODE.ILLEGAL_OVERTIME_PREMIUM,
            illegalOvertimeHours,
            rates.ILLEGAL_OVERTIME_PREMIUM,
            paidRate,
            'PAID_HOURLY_RATE'
        )
    ];

    const baseWorkAmount = paidRate === null ? null : money(actualWorkHours * paidRate);
    const premiumAmounts = components.map((item) => item.premiumAmount);
    const premiumTotalAmount = premiumAmounts.some((value) => value === null)
        ? null
        : money(premiumAmounts.reduce((total, value) => total + value, 0));
    const grossWorkAmount = baseWorkAmount === null || premiumTotalAmount === null
        ? null
        : money(baseWorkAmount + premiumTotalAmount);
    const hasBlockingReason = reasons.length > 0;
    const verificationStatus = [STATUS.PARTIALLY_VERIFIED, STATUS.UNVERIFIED].includes(
        facts.cardVerificationStatus
    )
        ? facts.cardVerificationStatus
        : STATUS.READY;

    return Object.freeze({
        policyVersion: POLICY_VERSION,
        status: hasBlockingReason ? STATUS.NEEDS_HR_DECISION : verificationStatus,
        reasons: [...new Set(reasons)],
        warnings: [...new Set(warnings)],
        hours: {
            declaredWorkHours: facts.declaredWorkHours,
            actualWorkHours,
            paidLeaveHours: facts.leaveHours,
            holidayCreditedHours: facts.holidayCreditedHours,
            nightHours,
            sundayHolidayWorkHours: holidayWorkHours,
            sixthDayHours: sixthHours,
            illegalOvertimeHours
        },
        rates: {
            paidHourlyRate: paidRate,
            legalHourlyRate: legalRate
        },
        components,
        amounts: {
            baseActualWorkAmount: hasBlockingReason ? null : baseWorkAmount,
            premiumTotalAmount: hasBlockingReason ? null : premiumTotalAmount,
            grossWorkAmount: hasBlockingReason ? null : grossWorkAmount
        },
        accumulationRule: 'BASE_ONCE_PREMIUMS_CUMULATIVE'
    });
}

module.exports = { POLICY_VERSION, STATUS, buildDailyCompensationBreakdown };
