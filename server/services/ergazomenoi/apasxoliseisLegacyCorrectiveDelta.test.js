'use strict';

const assert = require('node:assert/strict');
const { buildCorrectiveResult } = require('./apasxoliseisPeriodLifecycleService');
const { buildDailyCompensationBreakdown } =
    require('./apasxoliseisDailyCompensationBreakdownService');

const rowId = 'legacy-orphan-row';
const profile = { kodikos: '0004', hmeres_ergasias_ebdomadas: 5,
    eidikh_kathgoria_ergazomenoy: '0009', pososto_prosayxhshs_6hs_hmeras: 0,
    pragmatikoOromisthio: 7.60125, nomimoOromisthio: 8 };
const baselineRow = { _id: rowId, kodikos: '0004', company_kod: 'company',
    hmeromhnia: '2026-06-14', kathgoria_ergasias: 'ΕΡΓ', ores_ergasias: 8,
    cards_apo_ora_01: '14:51', cards_eos_ora_01: '', cards_ores_ergasias: 0,
    ores_nyxtas_apologistika: 1.35, ores_argion_prosayxhsh_apologistika: 8,
    ores_argion_ergasia_apologistika: 0, sixth_day_hours: 0, seventh_day_hours: 0,
    compensation_breakdown_apologistika: { amounts: { baseActualWorkAmount: null,
        premiumTotalAmount: null, grossWorkAmount: null } },
    effective_profile_resolved: profile };
const correctedFacts = { ...baselineRow, apo_ora_01_apologistika: '14:51',
    eos_ora_01_apologistika: '23:21', ores_ergasias_apologistika: 8,
    ores_pragmatikhs_ergasias_apologistika: 8, sixth_day_hours: 8,
    orphan_card_resolution: { status: 'HR_APPROVED',
        policy_version: 'orphan-card-continuous:v1' } };
const correctedBreakdown = buildDailyCompensationBreakdown({ row: correctedFacts,
    companyKod: 'company', paidHourlyRate: profile.pragmatikoOromisthio,
    legalHourlyRate: profile.nomimoOromisthio, sixthDayHours: 8,
    sixthDayMandatoryRatePercent: 0, companyRules: [],
    calculatedWorkHoursAuthoritative: true });
assert.equal(correctedBreakdown.status, 'READY');
assert.equal(correctedBreakdown.components.find((item) =>
    item.code === 'SIXTH_DAY_PREMIUM').premiumAmount, 0);

const result = buildCorrectiveResult({ baselineSnapshot: {
    scope: { company_kod: 'company' }, employees: [profile],
    daily_results: [baselineRow], weekly_calculation_context: { profile_history: [] },
    policy_context: { rules: [] }, payroll_results: []
}, correctedRows: [{ ...correctedFacts,
    compensation_breakdown_apologistika: correctedBreakdown }],
correctedContext: {}, verifiedEvidence: [{ row_id: rowId }],
requiresNewSubmission: false, deadline: '2026-07-31', now: new Date('2026-07-01') });

const delta = result.corrective_delta.rows[0];
assert.equal(delta.sixth_day_hours, 8);
assert.equal(delta.baseActualWorkAmount, 0);
assert.equal(delta.premiumTotalAmount, 0);
assert.equal(delta.grossWorkAmount, 0);
assert.equal(result.corrective_delta.totals.grossWorkAmount, 0);

console.log('legacy corrective comparable-baseline delta: PASS');
