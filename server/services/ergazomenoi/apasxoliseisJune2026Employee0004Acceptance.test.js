'use strict';

const assert = require('node:assert/strict');
const { resolveDailyActualWorkFacts } = require('./apasxoliseisDailyActualWorkFactsService');
const { analyzeWeeklySixthSeventhDay } = require('./apasxoliseisWeeklySixthSeventhDayPolicyService');
const { analyzeWeeklyRepoTransferSinglePairV2 } = require('./apasxoliseisWeeklyRepoTransferSinglePairService');
const { materializeSourceValues, materializeTargetValues } =
    require('./apasxoliseisWeeklyRepoTransferSinglePairProposalService');
const { buildSeventhDayAttendanceUpdate } =
    require('./apasxoliseisWeeklyPostCheckWritePlanService');
const { buildDailyCompensationBreakdown } =
    require('./apasxoliseisDailyCompensationBreakdownService');
const {
    buildWeeklyRepoDeviationPreview,
    attachSixthDayPresentationToRows
} = require('./apasxoliseisWeeklyRepoDeviationPreviewService');

const PROFILE = Object.freeze({ typos_apasxolhshs: 'PLHRHS', plhrhs_apasxolhsh: true,
    hmeres_ergasias_ebdomadas: 5, ores_ergasias_ebdomadas: 40,
    mo_oron_hmerhsias_ergasias: 8, pososto_prosayxhshs_6hs_hmeras: 0,
    eidikh_kathgoria_ergazomenoy: '0009',
    pragmatikoOromisthio: 10,
    evelikth_proselefsh: 120, source: '0004_JUNE_FIXTURE' });

function row(date, { category = 'ΕΡΓ', hours = 8, cardHours = 0,
    declared = hours > 0 ? ['12:00', '20:00'] : null, cards = null, ...extra } = {}) {
    return { _id: `row-${date}`, team: 'THA', company_kod: '0004', ypokatasthma: '0000',
        kodikos: '0004', hmeromhnia: date, kathgoria_ergasias: category,
        ores_ergasias: hours, repo: category === 'ΑΝ', cards_ores_ergasias: cardHours,
        apo_ora_01: declared?.[0] || '', eos_ora_01: declared?.[1] || '',
        cards_apo_ora_01: cards?.[0] || '', cards_eos_ora_01: cards?.[1] || '',
        cards_apo_ora_02: '', cards_eos_ora_02: '', cards_apo_ora_03: '', cards_eos_ora_03: '',
        adeia: false, adeia_apologistika: false, astheneia: false,
        astheneia_apologistika: false, ...extra };
}

function week(start, overrides) {
    return Array.from({ length: 7 }, (_, index) => {
        const date = new Date(`${start}T00:00:00.000Z`);
        date.setUTCDate(date.getUTCDate() + index);
        const key = date.toISOString().slice(0, 10);
        return row(key, overrides[key] || {});
    });
}

const weekA = week('2026-06-08', {
    '2026-06-10': { category: 'ΑΝ', hours: 0, declared: null, cardHours: 6.87,
        cards: ['15:15', '22:07'] },
    '2026-06-11': { declared: ['12:00', '20:00'], cardHours: 0 },
    '2026-06-12': { cardHours: 7.5, cards: ['12:00', '19:30'],
        kathgoria_ergasias_apologistika: 'ΑΝ', repo_apologistika: true },
    '2026-06-14': { declared: ['14:51', '22:51'], cardHours: 0,
        cards: ['14:51', ''] }
});
for (const date of ['2026-06-08', '2026-06-09', '2026-06-13']) {
    Object.assign(weekA.find((item) => item.hmeromhnia === date), {
        cards_ores_ergasias: 7, cards_apo_ora_01: '12:00', cards_eos_ora_01: '19:00'
    });
}
const repoA = analyzeWeeklyRepoTransferSinglePairV2({ weekRows: weekA,
    employmentProfile: PROFILE });
assert.equal(repoA.eligibility_status, 'NEEDS_REVIEW');
const orphanA = resolveDailyActualWorkFacts(weekA[6]);
assert.equal(orphanA.cardHours, 0);
assert.equal(orphanA.cardVerificationStatus, 'UNVERIFIED');
assert.equal(orphanA.category, 'ΕΡΓ');
assert.equal(orphanA.actualWorkHours, 0);
assert.equal(orphanA.countsAsActualWorkDay, true);
const effectiveA = weekA.map((item) => item.hmeromhnia === '2026-06-10'
    ? { ...item, kathgoria_ergasias_apologistika: 'ΕΡΓ', repo_apologistika: false }
    : item.hmeromhnia === '2026-06-11'
      ? { ...item, ...materializeTargetValues('ΑΝ') }
      : item.hmeromhnia === '2026-06-14' ? { ...item,
          kathgoria_ergasias_apologistika: 'ΕΡΓ',
          apo_ora_01_apologistika: '14:51', eos_ora_01_apologistika: '23:21',
          ores_ergasias_apologistika: 8,
          orphan_card_resolution: { status: 'HR_APPROVED',
              approved_start: '14:51', approved_end: '23:21', approved_hours: 8,
              policy_version: 'orphan-card-continuous:v1' } } : item);
const sixthA = analyzeWeeklySixthSeventhDay({ weekRows: effectiveA,
    effectiveProfile: PROFILE, hourlyRate: PROFILE.pragmatikoOromisthio,
    isCalculatedWorkHoursAuthoritativeForRow: (item) => item.hmeromhnia === '2026-06-14' });
assert.equal(sixthA.status, 'READY');
assert.equal(sixthA.sixthDay.hmeromhnia, '2026-06-14');
assert.equal(sixthA.sixthDay.sixthDayHours, 8);
assert.equal(sixthA.sixthDay.premiumRate, 0);
assert.equal(sixthA.sixthDay.premiumAmount, 0);
assert.equal(sixthA.seventhDay, null);
assert.ok(!sixthA.reasons.includes('CANONICAL_REPO_IDENTITIES_NOT_DETERMINISTIC'));
const approvedOrphanDay = sixthA.dailyFacts.find((day) => day.hmeromhnia === '2026-06-14');
assert.equal(approvedOrphanDay.actualWorkHours, 8);
assert.equal(approvedOrphanDay.cardVerificationStatus, 'HR_APPROVED_ORPHAN');

const previewA = buildWeeklyRepoDeviationPreview({
    rows: effectiveA,
    periodStart: '2026-06-08',
    periodEnd: '2026-06-14',
    asOfDate: '2026-06-15',
    resolveWeeklyProfile: () => ({ expectedWeeklyRepo: 2, effectiveProfile: PROFILE })
});
const deviationA = previewA.deviations[0];
assert.equal(deviationA.actual_workdays, 6);
assert.equal(deviationA.sixth_day_count, 1);
assert.equal(deviationA.seventh_day_count, 0);
assert.equal(deviationA.sixth_day_date, '2026-06-14');
assert.equal(
    attachSixthDayPresentationToRows(effectiveA, [deviationA])
        .find((item) => item.hmeromhnia === '2026-06-14').is_sixth_day,
    true
);

const weekB = week('2026-06-15', {
    '2026-06-16': { category: 'ΕΡΓ', hours: 8,
        cardHours: 508 / 60, cards: ['14:18', '22:46'],
        ores_ergasias_apologistika: 7.97 },
    '2026-06-17': { category: 'ΑΝ', hours: 0, declared: null,
        cardHours: 419 / 60, cards: ['15:41', '22:40'],
        ores_ergasias_apologistika: 6.48 }
});
weekB.forEach((item) => {
    if (item.cards_apo_ora_01) return;
    item.cards_ores_ergasias = 7;
    item.cards_apo_ora_01 = '12:00';
    item.cards_eos_ora_01 = '19:00';
});
Object.assign(weekB[6], {
    cards_ores_ergasias: 437 / 60,
    cards_apo_ora_01: '15:40',
    cards_eos_ora_01: '22:57',
    ores_ergasias_apologistika: 6.78
});
const repoB = analyzeWeeklyRepoTransferSinglePairV2({ weekRows: weekB,
    employmentProfile: PROFILE });
assert.equal(repoB.eligibility_status, 'NOT_APPLICABLE');
assert.ok(repoB.reasons.includes('SEVEN_ACTUAL_WORK_DAYS_REPO_TRANSFER_FORBIDDEN'));
const sixthB = analyzeWeeklySixthSeventhDay({ weekRows: weekB, effectiveProfile: PROFILE });
assert.equal(sixthB.status, 'READY');
assert.equal(sixthB.sixthDay.hmeromhnia, '2026-06-21');
assert.equal(sixthB.sixthDay.actualWorkHours, 6.78);
assert.equal(sixthB.seventhDay.hmeromhnia, '2026-06-17');
assert.equal(sixthB.seventhDay.cardHours, 419 / 60);
assert.equal(sixthB.seventhDay.actualWorkHours, 6.48);
assert.equal(sixthB.seventhDay.illegalOvertimeHours, 6.48);
const seventhAttendanceB = buildSeventhDayAttendanceUpdate(weekB[2]);
assert.equal(seventhAttendanceB.apologistiko_biblio, true);
assert.equal(seventhAttendanceB.apo_ora_01_apologistika, '15:41');
assert.equal(seventhAttendanceB.eos_ora_01_apologistika, '22:40');
const compensationB = buildDailyCompensationBreakdown({
    row: weekB[2], paidHourlyRate: 10, legalHourlyRate: 8,
    weeklyIllegalOvertimeHours: sixthB.seventhDay.illegalOvertimeHours
});
assert.equal(compensationB.hours.actualWorkHours, 6.48);
assert.equal(compensationB.hours.illegalOvertimeHours, 6.48);

const weekC = week('2026-06-22', {
    '2026-06-24': { category: 'ΑΝ', hours: 0, declared: null, cardHours: 9.6,
        cards: ['12:59', '22:35'] },
    '2026-06-25': { cardHours: 7.5, cards: ['12:00', '19:30'],
        kathgoria_ergasias_apologistika: 'ΑΝ', repo_apologistika: true },
    '2026-06-26': { declared: ['12:00', '20:00'], cardHours: 0 },
    '2026-06-28': { cardHours: 508 / 60, cards: ['15:15', '23:43'],
        ores_ergasias_apologistika: 7.97 }
});
for (const date of ['2026-06-22', '2026-06-23', '2026-06-27']) {
    Object.assign(weekC.find((item) => item.hmeromhnia === date), {
        cards_ores_ergasias: 7, cards_apo_ora_01: '12:00', cards_eos_ora_01: '19:00'
    });
}
const repoC = analyzeWeeklyRepoTransferSinglePairV2({ weekRows: weekC,
    employmentProfile: PROFILE });
assert.equal(repoC.eligibility_status, 'ELIGIBLE');
assert.equal(repoC.source.hmeromhnia, '2026-06-24');
assert.equal(repoC.target.hmeromhnia, '2026-06-26');
for (const [flexible, expectedBook] of [[120, false], [59, false], [58, true]]) {
    const source = materializeSourceValues(weekC[2], weekC[4],
        { evelikth_proselefsh: flexible }).proposedValues;
    assert.equal(source.apologistiko_biblio, expectedBook);
    assert.equal(source.apo_ora_01_apologistika, '12:59');
    assert.equal(source.eos_ora_01_apologistika, '20:59');
}
const effectiveC = weekC.map((item) => item.hmeromhnia === '2026-06-24'
    ? { ...item, ...materializeSourceValues(item, weekC[4], PROFILE).proposedValues }
    : item.hmeromhnia === '2026-06-26'
      ? { ...item, ...materializeTargetValues('ΑΝ') } : item);
const targetC = effectiveC[4];
assert.equal(targetC.repo_apologistika, true);
assert.equal(targetC.apologistiko_biblio, true);
assert.equal(targetC.ores_ergasias_apologistika, 0);
assert.equal(targetC.apo_ora_01_apologistika, '');
const sixthC = analyzeWeeklySixthSeventhDay({ weekRows: effectiveC,
    effectiveProfile: PROFILE });
assert.equal(sixthC.status, 'READY');
assert.equal(sixthC.sixthDay.hmeromhnia, '2026-06-28');
assert.equal(sixthC.sixthDay.actualWorkHours, 7.97);
assert.equal(sixthC.seventhDay, null);

console.log('0004 June 2026 exact acceptance fixtures passed');
