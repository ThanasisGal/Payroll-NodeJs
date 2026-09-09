'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const mongoose = require('mongoose');
// Καμία δοκιμή αυτού του αρχείου δεν επιτρέπεται να φτάσει στη βάση.
mongoose.connect = mongoose.createConnection = () => { throw new Error('Απαγορεύεται σύνδεση βάσης στη δοκιμή'); };
mongoose.Query.prototype.exec = () => { throw new Error('Απαγορεύεται ερώτημα βάσης στη δοκιμή'); };
const originalLoad = Module._load;
let hooks;
try {
    Module._load = function (request, parent, isMain) {
        if (request === 'libxmljs2') return {};
        if (request === '../../config/aws') return { s3Client: {} };
        return originalLoad.call(this, request, parent, isMain);
    };
    hooks = require('./erganhController').__orphanDailyCalculationTestHooks;
} finally { Module._load = originalLoad; }
const { buildEmploymentDailyCalculationUpdate } = require('../../services/ergazomenoi/apasxoliseisEmploymentDailyCalculationAdapterService');
const { analyzeWeeklySixthSeventhDay } = require('../../services/ergazomenoi/apasxoliseisWeeklySixthSeventhDayPolicyService');
const { buildWeeklyIllegalOvertimeUpdate } = require('../../services/ergazomenoi/apasxoliseisWeeklyIllegalOvertimeCalculationService');
const { OVERLAPPING_LEGAL_FIELDS } = require('../../services/ergazomenoi/apasxoliseisWeeklyIllegalOvertimeMappingService');
const { buildDailyCompensationBreakdown } = require('../../services/ergazomenoi/apasxoliseisDailyCompensationBreakdownService');
const { resolveDailyActualWorkFacts } = require('../../services/ergazomenoi/apasxoliseisDailyActualWorkFactsService');
const employee = { hmeres_ergasias_ebdomadas: 6, ores_ergasias_ebdomadas: 40,
    mo_oron_hmerhsias_ergasias: 6.67, typos_apasxolhshs: '0',
    dialleima_entos_ektos_orarioy: false, dialleima_se_lepta: 30 };
const row = { kodikos: '0031', hmeromhnia: '2026-04-05', repo: true, kathgoria_ergasias: 'ΑΝ',
    ores_ergasias: 0, cards_apo_ora_01: '12:30', cards_eos_ora_01: '17:59', cards_ores_ergasias: 329 / 60 };
const daily = (rec, profile = employee) => ({ ...rec, ...buildEmploymentDailyCalculationUpdate({
    row: rec, effectiveEmployee: profile, argiesDateSet: new Set(),
    weeklyState: { processedRegularMinutes: 0, weeklyRegularCardsMinutes: 1800, usedOverworkMinutes: 0 },
    operations: hooks.AUTHORITATIVE_DAILY_CALCULATION_OPERATIONS
}).sanitizedUpdate });

test('0031 / 05-04: ολόκληρη η ημερήσια και εβδομαδιαία διαδρομή δίνει 4.98 / 4.98 / 4.98', () => {
    const before = structuredClone(row);
    const target = daily(row);
    assert.equal(hooks.getPayrollDailyWorkMinutes(row, employee), 299);
    assert.equal(target.ores_ergasias_apologistika, 4.98);
    assert.equal(target.ores_argion_ergasia_apologistika, 4.98);
    const weekRows = Array.from({ length: 6 }, (_, i) => daily({
        hmeromhnia: new Date(Date.UTC(2026, 2, 30 + i)).toISOString().slice(0, 10),
        repo: false, kathgoria_ergasias: 'ΕΡΓ', ores_ergasias: 3,
        apo_ora_01: '09:00', eos_ora_01: '12:00',
        cards_apo_ora_01: '09:00', cards_eos_ora_01: '12:00', cards_ores_ergasias: 3
    })).concat(target).map((r, i) => ({ ...r, _id: `fixture-${i}`, kodikos: '0031' }));
    const analysis = analyzeWeeklySixthSeventhDay({ weekRows, effectiveProfile: employee,
        calculatedWorkHoursAuthoritative: true, allowDeclaredRepoIdentityOverride: true });
    assert.equal(analysis.seventhDay.hmeromhnia, '2026-04-05');
    assert.equal(analysis.seventhDay.severity, 'SERIOUS_VIOLATION');
    assert.equal(analysis.seventhDay.illegalOvertimeHours, 4.98);
    assert.ok(weekRows.reduce((sum, r) => sum + r.ores_ergasias_apologistika, 0) < 40);
    const overlay = buildWeeklyIllegalOvertimeUpdate(target, employee,
        analysis.seventhDay.illegalOvertimeHours, new Set(), { clearOverlappingLegal: true });
    assert.equal(overlay.ores_paranomhs_yperorias_argion_apologistika, 4.98);
    for (const field of OVERLAPPING_LEGAL_FIELDS) assert.equal(overlay[field], 0, field);
    const breakdown = buildDailyCompensationBreakdown({ row: { ...target, ...overlay },
        paidHourlyRate: 10, legalHourlyRate: 8, calculatedWorkHoursAuthoritative: true,
        weeklyIllegalOvertimeHours: analysis.seventhDay.illegalOvertimeHours });
    assert.equal(breakdown.hours.actualWorkHours, 4.98);
    assert.equal(breakdown.hours.sundayHolidayWorkHours, 4.98);
    assert.equal(breakdown.hours.illegalOvertimeHours, 4.98);
    assert.equal(breakdown.amounts.baseActualWorkAmount, 49.8);
    assert.equal(breakdown.accumulationRule, 'BASE_ONCE_PREMIUMS_CUMULATIVE');
    const { buildWeeklyRepoPostCheckWritePlan } = require('../../services/ergazomenoi/apasxoliseisWeeklyPostCheckWritePlanService');
    const profile = { ...employee, kodikos: '0031', pragmatikoOromisthio: 10, nomimoOromisthio: 8 };
    // Παράγεται μόνο σχέδιο στη μνήμη. Δεν καλείται καμία μέθοδος βάσης.
    const plan = buildWeeklyRepoPostCheckWritePlan({ sessionTeam: 'TEST', companyId: 'TEST',
        apoDate: new Date('2026-04-01'), eosDate: new Date('2026-04-30'), employees: [profile],
        rows: weekRows.filter(r => r.hmeromhnia >= '2026-04-01'), weeklyContextRows: weekRows,
        sameRunDailyCalculatedRowIds: new Set(weekRows.map(r => r._id)),
        resolveProfileForDate: () => profile, buildWeeklyIllegalOvertimeUpdate });
    const finalUpdate = plan.bulkOps.find(op => op.updateOne.filter._id === 'fixture-6').updateOne.update.$set;
    assert.equal(finalUpdate.ores_pragmatikhs_ergasias_apologistika, 4.98);
    assert.equal(finalUpdate.ores_paranomhs_yperorias_argion_apologistika, 4.98);
    assert.equal(finalUpdate.compensation_breakdown_apologistika.hours.actualWorkHours, 4.98);
    assert.equal(finalUpdate.compensation_breakdown_apologistika.amounts.baseActualWorkAmount, 49.8);
    assert.ok(plan.bulkOps.every(op => !['fixture-0', 'fixture-1'].includes(op.updateOne.filter._id)));
    assert.deepEqual(daily(row), target);
    assert.deepEqual(row, before);
});
test('σπαστό ωράριο διατηρεί 8 πραγματικές ώρες σε όλους τους ημερήσιους καταναλωτές', () => {
    const rec = { ...row, repo: false, kathgoria_ergasias: 'ΕΡΓ', ores_ergasias: 8,
        apo_ora_01: '08:00', eos_ora_01: '12:00', apo_ora_02: '16:00', eos_ora_02: '20:00',
        cards_apo_ora_01: '08:00', cards_eos_ora_01: '12:00', cards_apo_ora_02: '16:00', cards_eos_ora_02: '20:00', cards_ores_ergasias: 8 };
    const result = daily(rec);
    assert.equal(result.ores_ergasias_apologistika, 8);
    assert.equal(result.ores_argion_prosayxhsh_apologistika, 8);
    assert.equal(resolveDailyActualWorkFacts(result, { calculatedWorkHoursAuthoritative: true }).actualWorkHours, 8);
});
test('ελλιπές δεύτερο ζεύγος: τα αποδεδειγμένα λεπτά αφαιρούν διάλειμμα μόνο μία φορά', () => {
    const result = daily({ ...row, cards_apo_ora_02: '20:00', cards_eos_ora_02: '' });
    assert.equal(result.ores_ergasias_apologistika, 4.98);
    const facts = resolveDailyActualWorkFacts(result, { calculatedWorkHoursAuthoritative: true });
    assert.equal(facts.actualWorkHours, 4.98);
    assert.ok(facts.warnings.includes('INCOMPLETE_CARD_INTERVAL'));
});
test('εγκεκριμένες ώρες ορφανής κάρτας χρησιμοποιούν το ίδιο συνθετικό διάλειμμα', () => {
    const approved = { ...row, cards_eos_ora_01: '', apo_ora_01_apologistika: '12:30',
        eos_ora_01_apologistika: '17:59', orphan_card_resolution: { status: 'HR_APPROVED' } };
    assert.equal(hooks.getPayrollDailyWorkMinutes(approved, employee), 299);
});
test('εσωτερικό διάλειμμα και μικρή παρουσία διατηρούν την ορθή πραγματική εργασία', () => {
    assert.equal(daily(row, { ...employee, dialleima_entos_ektos_orarioy: true }).ores_ergasias_apologistika, 5.48);
    const short = daily({ ...row, cards_eos_ora_01: '16:40', cards_ores_ergasias: 250 / 60 });
    assert.equal(short.ores_ergasias_apologistika, 4);
    assert.equal(short.ores_argion_ergasia_apologistika, 4);
});

test('η έκτη ημέρα καταναλώνει καθαρές ώρες χωρίς αλλαγή επιλογής ημέρας', () => {
    const profile = { ...employee, hmeres_ergasias_ebdomadas: 5, pososto_prosayxhshs_6hs_hmeras: 40 };
    const rows = Array.from({ length: 7 }, (_, i) => daily({
        hmeromhnia: new Date(Date.UTC(2026, 2, 30 + i)).toISOString().slice(0, 10),
        repo: i >= 5, kathgoria_ergasias: i >= 5 ? 'ΑΝ' : 'ΕΡΓ', ores_ergasias: i >= 5 ? 0 : 8,
        cards_apo_ora_01: i === 6 ? '' : '08:00', cards_eos_ora_01: i === 6 ? '' : '16:00',
        cards_ores_ergasias: i === 6 ? 0 : 8
    }, profile));
    const analysis = analyzeWeeklySixthSeventhDay({ weekRows: rows, effectiveProfile: profile,
        calculatedWorkHoursAuthoritative: true, allowDeclaredRepoIdentityOverride: true });
    assert.equal(analysis.sixthDay.hmeromhnia, '2026-04-04');
    assert.equal(analysis.sixthDay.sixthDayHours, 7.5);
    assert.equal(analysis.seventhDay, null);
});
test('συνθετικό και ισοδύναμο ρητό διάλειμμα έχουν ίδιες συνέπειες στην εγκεκριμένη αναπλήρωση', () => {
    const { deriveApprovedTimeShift } = require('../../services/ergazomenoi/apasxoliseisApprovedTimeShiftService');
    const C = require('../../utils/ergazomenoi/employmentProfileContract');
    const rec = { hmeromhnia: '2026-04-03', kathgoria_ergasias: 'ΕΡΓ', apo_ora_01: '08:00', eos_ora_01: '16:00',
        cards_apo_ora_01: '08:00', cards_eos_ora_01: '11:00', cards_apo_ora_02: '12:00', cards_eos_ora_02: '18:00' };
    const args = { row: rec, resolvedArrangement: { arrangementEffective: true,
        facts: { [C.TYPE]: 'APPROVED_TIME_SHIFT_INTERRUPTION', [C.START]: '11:00', [C.END]: '12:00' } } };
    const synthetic = deriveApprovedTimeShift({ ...args, effectiveEmployee: employee });
    const explicit = deriveApprovedTimeShift({ ...args, effectiveEmployee: { ...employee,
        dialleima_apo_ora_01: '16:00', dialleima_eos_ora_01: '16:30' } });
    assert.deepEqual(synthetic, explicit);
    assert.equal(synthetic.shortageMinutes, 60);
    assert.equal(synthetic.matchedMinutes, 0);
});
test('η αποτύπωση κρατά τα δηλωμένα ζεύγη διαλείμματος χωρίς αποθήκευση συνθετικών πεδίων', () => {
    const { buildEmploymentPeriodFrozenSnapshot } = require('../../services/ergazomenoi/apasxoliseisPeriodFrozenSnapshotService');
    const explicit = { ...row, dialleima_apo_ora_01: '14:00', dialleima_eos_ora_01: '14:30' };
    const calculated = daily(explicit);
    const snapshot = buildEmploymentPeriodFrozenSnapshot({ scope: { team: 'TEST', company_kod: 'TEST',
        ypokatasthma: '0000', period_start: '2026-04-01', period_end: '2026-04-30' }, dailyResults: [calculated] });
    assert.equal(snapshot.snapshot.daily_results[0].dialleima_apo_ora_01, '14:00');
    assert.equal(snapshot.snapshot.daily_results[0].dialleima_eos_ora_01, '14:30');
    for (const field of ['breakIntervals', 'workIntervals', 'removedMinutes', 'netMinutes']) {
        assert.equal(Object.hasOwn(daily(row), field), false);
    }
});

test('safeOrphan: οι καθαρές ώρες προκύπτουν από τον κοινό επιλυτή', () => {
    const result = daily({ hmeromhnia: '2026-04-01', kathgoria_ergasias: 'ΕΡΓ',
        ores_ergasias: 250 / 60, apo_ora_01: '12:30', eos_ora_01: '16:40',
        cards_apo_ora_01: '12:30', cards_eos_ora_01: '', cards_ores_ergasias: 0 });
    assert.equal(result.ores_ergasias_apologistika, 4);
    assert.equal(result.ores_pragmatikhs_ergasias_apologistika, 4);
    assert.equal(result.apo_ora_01_apologistika, '12:30');
    assert.equal(result.eos_ora_01_apologistika, '16:40');
});
