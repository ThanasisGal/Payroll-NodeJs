'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Module = require('node:module');
const originalLoad = Module._load;
let operations, runFrozenWeek;
try {
    Module._load = function (request, parent, isMain) {
        if (request === 'libxmljs2') return {};
        return originalLoad.call(this, request, parent, isMain);
    };
    operations = require('../../controllers/ergazomenoi/erganhController')
        .__orphanDailyCalculationTestHooks.AUTHORITATIVE_DAILY_CALCULATION_OPERATIONS;
    runFrozenWeek = require('../../controllers/ergazomenoi/erganhController')
        .__orphanDailyCalculationTestHooks.runFrozenAuthoritativeEmploymentWeek;
} finally { Module._load = originalLoad; }
const S = require('./apasxoliseisApprovedTimeShiftService');
const Leave = require('./apasxoliseisApprovedHourlyLeaveService');
const C = require('../../utils/ergazomenoi/employmentProfileContract');
const { buildCompleteProfileSnapshot, resolveEmploymentProfileFactsForDate } = require('../../utils/ergazomenoi/employmentProfileHistory');
const { buildEmploymentDailyCalculationUpdate } = require('./apasxoliseisEmploymentDailyCalculationAdapterService');
const { resolveDailyActualWorkFacts } = require('./apasxoliseisDailyActualWorkFactsService');
const { ProdhlomenaOrariaModel } = require('../../models/ergazomenoi');
const employee = { hmeres_ergasias_ebdomadas: 5, ores_ergasias_ebdomadas: 40,
    mo_oron_hmerhsias_ergasias: 8, typos_apasxolhshs: '0', dialleima_entos_ektos_orarioy: true,
    dialleima_se_lepta: 0 };
const baseRow = { _id: '507f1f77bcf86cd799439011', hmeromhnia: '2026-09-07',
    kathgoria_ergasias: 'ΕΡΓ', apo_ora_01: '08:00', eos_ora_01: '16:00', ores_ergasias: 8,
    cards_apo_ora_01: '08:00', cards_eos_ora_01: '12:00',
    cards_apo_ora_02: '14:00', cards_eos_ora_02: '18:00', cards_ores_ergasias: 8 };
const history = (changes = {}) => [buildCompleteProfileSnapshot({ input: {
    ...employee, [C.ENABLED]: true, [C.TYPE]: 'APPROVED_TIME_SHIFT_INTERRUPTION',
    [C.FROM]: '2026-09-01', [C.START]: '12:00', [C.END]: '14:00',
    [C.CATEGORY]: 'test-leave', ...changes }, effectiveFrom: '2026-09-01' })];
function derive(row = baseRow, changes = {}, options = {}) {
    return S.deriveApprovedTimeShift({ row, effectiveEmployee: employee,
        resolvedArrangement: resolveEmploymentProfileFactsForDate(row.hmeromhnia, history(changes),
            { currentEmployee: employee, scheduledWorkingDay: Leave.scheduledWorkingDay(row) }), ...options });
}
function calculate(row = baseRow, fact = derive(row), options = {}) {
    return buildEmploymentDailyCalculationUpdate({ row, effectiveEmployee: employee,
        approvedTimeShift: fact, operations, argiesDateSet: new Set(), ...options });
}

const seg = (apo_lepto, eos_lepto) => ({ apo_lepto, eos_lepto });
const state = (processed = 0) => ({ weeklyRegularCardsMinutes: 3000, processedRegularMinutes: processed,
    weeklyOverworkCapMinutes: 300, weeklyLegalLimitMinutes: 2700, usedOverworkMinutes: 0 });
for (const [end, work, matched, absence] of [['18:00', 8, 120, 0], ['17:00', 7, 60, 1], ['16:00', 6, 0, 2], ['19:00', 9, 120, 0]]) {
    test(`work until ${end}: exact compensation, absence, actual work and persistence`, async () => {
        const row = { ...baseRow, cards_eos_ora_02: end, cards_ores_ergasias: work };
        const fact = derive(row), weeklyState = state();
        const update = calculate(row, fact, { weeklyState }).sanitizedUpdate;
        assert.equal(fact.matchedMinutes, matched);
        assert.equal(fact.unmatchedMinutes, 120 - matched);
        assert.equal(update.ores_apoysias_apologistika, absence);
        assert.equal(update.ores_ergasias_apologistika, work);
        assert.equal(weeklyState.processedRegularMinutes, work * 60);
        assert.deepEqual(update[S.FIELD], { diastimata_elleimmatos: [seg(720, 840)],
            diastimata_anaplhroshs: matched ? [seg(960, 960 + matched)] : [],
            antistoixismena_lepta: matched, ypoloipomena_lepta: 120 - matched });
        const output = { ...row, ...update };
        assert.equal(resolveDailyActualWorkFacts(output).actualWorkHours, work);
        assert.equal(resolveDailyActualWorkFacts(output).leaveHours, 0);
        const doc = new ProdhlomenaOrariaModel(output); await doc.validate();
        assert.deepEqual(ProdhlomenaOrariaModel.hydrate(doc.toObject()).toObject()[S.FIELD], update[S.FIELD]);
        assert.equal(mongoose.connection.readyState, 0);
    });
}
for (const [name, row, matched] of [
    ['later independent work', { cards_eos_ora_02: '16:00', cards_apo_ora_03: '20:00', cards_eos_ora_03: '22:00' }, 0],
    ['contiguous pairs', { cards_eos_ora_02: '17:00', cards_apo_ora_03: '17:00', cards_eos_ora_03: '18:00' }, 120],
    ['gap terminates extension', { cards_eos_ora_02: '17:00', cards_apo_ora_03: '17:15', cards_eos_ora_03: '18:00' }, 60],
    ['earlier extra never matches', { cards_apo_ora_01: '07:00', cards_eos_ora_02: '16:00' }, 0],
    ['actual inside interruption', { cards_eos_ora_01: '12:30' }, 90]
]) test(name, () => assert.equal(derive({ ...baseRow, ...row }).matchedMinutes, matched));
test('split schedule, multiple shortages: only last declared end, allocate once', () => {
    const row = { ...baseRow, eos_ora_01: '12:00', apo_ora_02: '14:00', eos_ora_02: '18:00',
        cards_eos_ora_01: '11:00', cards_apo_ora_02: '15:00', cards_eos_ora_02: '20:00' };
    const fact = derive(row, { [C.START]: '11:00', [C.END]: '15:00' });
    assert.deepEqual(fact.shortageIntervals, [seg(660, 720), seg(840, 900)]);
    assert.deepEqual(fact.matchedCompensationIntervals, [seg(1080, 1200)]);
    assert.equal(fact.matchedMinutes, 120);
    assert.deepEqual(calculate(row, fact).sanitizedUpdate[S.FIELD].diastimata_elleimmatos, fact.shortageIntervals);
});
for (const [name, start, end, shortage, matched] of [
    ['break inside interruption', '12:30', '13:00', 90, 90],
    ['break after declared end', '17:00', '17:15', 120, 60],
    ['break at declared end', '16:00', '16:15', 120, 0]
]) test(name, () => {
    const fact = derive(baseRow, {}, { effectiveEmployee: { ...employee, dialleima_entos_ektos_orarioy: false,
        dialleima_apo_ora_01: start, dialleima_eos_ora_01: end } });
    assert.equal(fact.shortageMinutes, shortage); assert.equal(fact.matchedMinutes, matched);
});
test('explicit prior credited intervals do not create debt', () => {
    assert.equal(derive(baseRow, {}, { existingCreditedIntervals: [seg(720, 780)] }).shortageMinutes, 60);
});
for (const [name, changes, rowChanges] of [
    ['disabled', { [C.ENABLED]: false }, {}], ['expired', { [C.UNTIL]: '2026-09-06' }, {}],
    ['before start', { [C.FROM]: '2026-09-08' }, {}], ['weekday', { [C.DAYS]: [2] }, {}],
    ['repo', {}, { repo: true }], ['nonworking', {}, { kathgoria_ergasias: 'ΜΕ' }],
    ['other', { [C.TYPE]: 'OTHER_APPROVED_ARRANGEMENT' }, {}],
    ['hourly leave', { [C.TYPE]: 'APPROVED_LEAVE_INTERRUPTION' }, {}]
]) test(`${name} calculation neutral`, () => {
    const row = { ...baseRow, ...rowChanges }; const fact = derive(row, changes);
    assert.equal(fact.matchedMinutes, 0); assert.equal(fact.arrangementEffective, false);
    assert.deepEqual(calculate(row, fact).sanitizedUpdate, calculate(row, null).sanitizedUpdate);
});
for (const [name, fields] of [
    ['locked', { is_locked: true }], ['approved orphan', { orphan_card_resolution: { status: 'HR_APPROVED' } }],
    ['leave', { adeia: true }], ['sickness', { astheneia: true }], ['hourly authority', { explicit_hourly_leave_hours: 2 }]
]) test(`${name} authority protected`, () => {
    const row = { ...baseRow, ...fields }; const fact = derive(row);
    assert.equal(fact.protected, true); assert.deepEqual(calculate(row, fact).sanitizedUpdate, {});
});
test('explicit HR protection', () => {
    const fact = derive(baseRow, {}, { hrAuthoritative: true });
    assert.deepEqual(calculate(baseRow, fact).sanitizedUpdate, {});
});
for (const [name, fields] of [
    ['no cards', { cards_apo_ora_01: '', cards_eos_ora_01: '', cards_apo_ora_02: '', cards_eos_ora_02: '', cards_ores_ergasias: 0 }],
    ['unresolved', { cards_eos_ora_02: '' }]
]) test(`${name} retains review path`, () => {
    const row = { ...baseRow, ...fields }, fact = derive(row);
    assert.equal(fact.reason, 'CARD_EVIDENCE_REQUIRED'); assert.equal(fact.shortageMinutes, 0);
    const { [S.FIELD]: cleared, ...update } = calculate(row, fact).sanitizedUpdate;
    assert.equal(cleared, null); assert.deepEqual(update, calculate(row, null).sanitizedUpdate);
});
const overnight = { ...baseRow, apo_ora_01: '22:00', eos_ora_01: '06:00',
    cards_apo_ora_01: '22:00', cards_eos_ora_01: '01:00', cards_apo_ora_02: '02:00', cards_eos_ora_02: '07:00' };
test('overnight continuity uses shift-start eligibility and real next-day position', () => {
    const fact = derive(overnight, { [C.START]: '01:00', [C.END]: '02:00' });
    assert.deepEqual(fact.shortageIntervals, [seg(1500, 1560)]);
    assert.deepEqual(fact.matchedCompensationIntervals, [seg(1800, 1860)]);
    assert.equal(calculate(overnight, fact).sanitizedUpdate.ores_nyxtas_apologistika, 7);
});
test('overnight post-end gap cannot resume compensation', () => {
    const row = { ...overnight, cards_eos_ora_02: '06:00', cards_apo_ora_03: '06:15', cards_eos_ora_03: '07:00' };
    assert.equal(derive(row, { [C.START]: '01:00', [C.END]: '02:00' }).matchedMinutes, 0);
});
test('final tolerance only after matching', () => {
    const row = { ...baseRow, cards_eos_ora_01: '12:00', cards_apo_ora_02: '12:30', cards_eos_ora_02: '16:20', cards_ores_ergasias: 47 / 6 };
    const fact = derive(row, { [C.END]: '12:30' });
    assert.equal(fact.unmatchedMinutes, 10);
    assert.equal(calculate(row, fact, { proorhApoxorhshMinutes: 15 }).sanitizedUpdate.ores_apoysias_apologistika, 0);
});
test('inactive recalculation resets old facts; active no shortage also resets', () => {
    const row = { ...baseRow, [S.FIELD]: S.approvedTimeShiftUpdate(derive())[S.FIELD] };
    assert.equal(calculate(row, derive(row, { [C.ENABLED]: false })).sanitizedUpdate[S.FIELD], null);
    const full = { ...row, cards_eos_ora_01: '16:00', cards_apo_ora_02: '', cards_eos_ora_02: '' };
    assert.equal(calculate(full, derive(full)).sanitizedUpdate[S.FIELD], null);
    assert.throws(() => calculate(row, null), { code: 'APPROVED_TIME_SHIFT_CONTEXT_REQUIRED' });
});
const sumPrefix = (update, prefix) => Object.entries(update).filter(([key]) => key.startsWith(prefix))
    .reduce((sum, [, value]) => sum + Number(value), 0);
test('exact compensation suppresses ordinary overwork/legal overtime but excess remains', () => {
    const row = { ...baseRow, cards_apo_ora_01: '06:00', cards_eos_ora_02: '19:00', cards_ores_ergasias: 11 };
    const fact = derive(row), weeklyState = state();
    const update = calculate(row, fact, { weeklyState }).sanitizedUpdate;
    const ordinary = calculate(row, null, { weeklyState: state() }).sanitizedUpdate;
    assert.equal(sumPrefix(ordinary, 'ores_yperergasias_'), 1);
    assert.equal(sumPrefix(ordinary, 'ores_nominhs_yperorias_'), 2);
    assert.equal(sumPrefix(update, 'ores_yperergasias_'), 0);
    assert.equal(sumPrefix(update, 'ores_nominhs_yperorias_'), 1);
    assert.equal(update.apo_ora_yperories, '18:00');
    assert.equal(update.eos_ora_yperories, '19:00');
    assert.equal(weeklyState.processedRegularMinutes, 660);
});
test('additional work exemption affects only matched minutes', () => {
    const partTime = { ...employee, typos_apasxolhshs: '1', mo_oron_hmerhsias_ergasias: 4, ores_ergasias_ebdomadas: 20 };
    const row = { ...baseRow, eos_ora_01: '12:00', ores_ergasias: 4, cards_apo_ora_01: '07:00',
        cards_eos_ora_01: '10:00', cards_apo_ora_02: '11:00', cards_eos_ora_02: '14:00', cards_ores_ergasias: 6 };
    const fact = derive(row, { [C.START]: '10:00', [C.END]: '11:00' }, { effectiveEmployee: partTime });
    const update = calculate(row, fact, { effectiveEmployee: partTime, weeklyState: state() }).sanitizedUpdate;
    assert.equal(fact.matchedMinutes, 60);
    assert.equal(update.ores_prostheths_ergasias_apologistika, 1);
    assert.equal(update.ores_ergasias_apologistika, 6);
});
test('weekly actual position advances through compensation for later work', () => {
    const weeklyState = state(44 * 60);
    const update = calculate(baseRow, derive(), { weeklyState }).sanitizedUpdate;
    assert.equal(weeklyState.processedRegularMinutes, 52 * 60);
    assert.equal(sumPrefix(update, 'ores_nominhs_yperorias_'), 5);
    const later = { ...baseRow, hmeromhnia: '2026-09-08', cards_eos_ora_01: '09:00',
        cards_apo_ora_02: '', cards_eos_ora_02: '', cards_ores_ergasias: 1 };
    const laterUpdate = calculate(later, null, { weeklyState }).sanitizedUpdate;
    assert.equal(sumPrefix(laterUpdate, 'ores_nominhs_yperorias_'), 1);
    assert.equal(weeklyState.processedRegularMinutes, 53 * 60);
});
test('hard daily illegal overtime overrides matched compensation', () => {
    const row = { ...baseRow, cards_apo_ora_01: '00:00', cards_ores_ergasias: 16 };
    const update = calculate(row, derive(row), { weeklyState: state() }).sanitizedUpdate;
    const baseline = calculate(row, null, { weeklyState: state() }).sanitizedUpdate;
    assert.equal(sumPrefix(update, 'ores_paranomhs_yperorias_'), sumPrefix(baseline, 'ores_paranomhs_yperorias_'));
    assert.ok(sumPrefix(update, 'ores_paranomhs_yperorias_') >= 2);
});
for (const [name, date, holidayDates] of [
    ['Sunday', '2026-09-13', []], ['holiday', '2026-09-07', ['2026-09-07']]
]) test(`${name} compensation retains actual work premiums`, () => {
    const row = { ...baseRow, hmeromhnia: date };
    const update = calculate(row, derive(row), { argiesDateSet: new Set(holidayDates) }).sanitizedUpdate;
    assert.equal(update.ores_argion_prosayxhsh_apologistika, 8);
});
test('night compensation retains real timestamps crossing into Sunday', () => {
    const row = { ...overnight, hmeromhnia: '2026-09-12', apo_ora_01: '18:00', eos_ora_01: '02:00',
        cards_apo_ora_01: '18:00', cards_eos_ora_01: '21:00', cards_apo_ora_02: '22:00', cards_eos_ora_02: '03:00' };
    const fact = derive(row, { [C.START]: '21:00', [C.END]: '22:00', [C.DAYS]: [6] });
    const update = calculate(row, fact).sanitizedUpdate;
    assert.deepEqual(fact.matchedCompensationIntervals, [seg(1560, 1620)]);
    assert.equal(update.ores_nyxtas_apologistika, 5);
    assert.equal(update.ores_argion_prosayxhsh_apologistika, 3);
});
test('weekly sixth/seventh and hard overlay count compensation as actual work', () => {
    const { analyzeWeeklySixthSeventhDay } = require('./apasxoliseisWeeklySixthSeventhDayPolicyService');
    const { buildWeeklyIllegalOvertimeUpdate } = require('./apasxoliseisWeeklyIllegalOvertimeCalculationService');
    const rows = Array.from({ length: 7 }, (_, i) => {
        const row = { ...baseRow, hmeromhnia: `2026-09-${String(7 + i).padStart(2, '0')}` };
        return { ...row, ...calculate(row, derive(row)).sanitizedUpdate };
    });
    rows[6].repo = true; rows[6].kathgoria_ergasias = 'ΑΝ';
    const analysis = analyzeWeeklySixthSeventhDay({ weekRows: rows,
        effectiveProfile: { ...employee, kathestos_apasxolhshs: '0', hmeres_ergasias_ebdomadas: 6, pososto_prosayxhshs_6hs_hmeras: 40 }, hourlyRate: 10 });
    assert.equal(analysis.seventhDay.actualWorkHours, 8);
    assert.equal(analysis.seventhDay.illegalOvertimeHours, 8);
    const hard = buildWeeklyIllegalOvertimeUpdate(rows[6], employee, 8, new Set(), { clearOverlappingLegal: true });
    assert.equal(sumPrefix(hard, 'ores_paranomhs_yperorias_'), 8);
});
test('stale hourly leave is reset through existing leave recalculation contract', () => {
    const row = { ...baseRow, egkekrimenh_oroadeia_apologistika: true, explicit_hourly_leave_hours: 2,
        egkekrimena_diastimata_oroadeias_apologistika: [seg(720, 840)], kathgoria_adeias_apologistika: 'test-leave' };
    const resolvedArrangement = resolveEmploymentProfileFactsForDate(row.hmeromhnia, history(),
        { currentEmployee: employee, scheduledWorkingDay: true });
    const approvedHourlyLeave = Leave.deriveApprovedHourlyLeave({ row, effectiveEmployee: employee, resolvedArrangement });
    const update = calculate(row, derive(row), { approvedHourlyLeave }).sanitizedUpdate;
    assert.equal(update.egkekrimenh_oroadeia_apologistika, false);
    assert.equal(update.explicit_hourly_leave_hours, 0);
    assert.deepEqual(update.egkekrimena_diastimata_oroadeias_apologistika, []);
    assert.equal(update[S.FIELD].antistoixismena_lepta, 120);
});
test('temporal resolver activates time shift from history, never raw current fields alone', () => {
    const { resolveArrangementContext } = require('./apasxoliseisEffectiveHolidayContextProviderService');
    assert.equal(resolveArrangementContext({ employee, reviewDate: baseRow.hmeromhnia, normalHistory: history(),
        scheduledWorkingDay: true }).arrangementEffective, true);
    assert.equal(resolveArrangementContext({ employee: { ...employee, ...history()[0] },
        reviewDate: baseRow.hmeromhnia, scheduledWorkingDay: true }).arrangementEffective, false);
});
test('frozen corrective replay uses archived authority and recalculates matched minutes from corrected cards', () => {
    const resolvedArrangement = resolveEmploymentProfileFactsForDate(baseRow.hmeromhnia, history(),
        { currentEmployee: employee, scheduledWorkingDay: true });
    const row = { ...baseRow, ...calculate().sanitizedUpdate, kodikos: '0001', ypokatasthma: '0001',
        effective_profile_resolved: { ...employee, approved_time_shift_context: { resolvedArrangement, breakProfile: employee } } };
    const baselineSnapshot = { scope: { team: 'test', company_kod: '507f1f77bcf86cd799439012',
        ypokatasthma: '0001', period_start: '2026-09-07', period_end: '2026-09-13' },
        employees: [{ ...employee, kodikos: '0001', [C.ENABLED]: false }], daily_results: [row],
        weekly_calculation_context: { profile_history: [], calendar_facts: [] } };
    const contextRows = Array.from({ length: 6 }, (_, index) => ({ ...baseRow,
        _id: `507f1f77bcf86cd79943902${index}`, kodikos: '0001', ypokatasthma: '0001', is_locked: true,
        hmeromhnia: `2026-09-${String(8 + index).padStart(2, '0')}`, effective_profile_resolved: employee }));
    const result = runFrozenWeek({ employeeKodikos: '0001', weekStart: '2026-09-07',
        frozenRows: [{ ...row, cards_eos_ora_02: '17:00', cards_ores_ergasias: 7 }, ...contextRows], baselineSnapshot });
    const corrected = result.correctedRows.find(x => String(x._id) === row._id);
    assert.equal(corrected[S.FIELD].antistoixismena_lepta, 60);
    assert.equal(corrected[S.FIELD].ypoloipomena_lepta, 60);
    assert.equal(corrected.ores_apoysias_apologistika, 1);
    assert.equal(corrected.eos_ora_02_apologistika, '17:00');
    assert.equal(mongoose.connection.readyState, 0);
});
test('derivation does not mutate card, profile or prior-credit inputs', () => {
    const row = structuredClone(baseRow), effectiveEmployee = structuredClone(employee);
    const resolvedArrangement = resolveEmploymentProfileFactsForDate(row.hmeromhnia, history(),
        { currentEmployee: employee, scheduledWorkingDay: true });
    const input = { row, effectiveEmployee, resolvedArrangement, existingCreditedIntervals: [seg(720, 750)] };
    const before = structuredClone(input);
    const fact = S.deriveApprovedTimeShift(input);
    assert.equal(fact.shortageMinutes, 90);
    assert.deepEqual(input, before);
});
test('archived HR authority protects the daily result even without original orphan metadata', () => {
    const fact = derive(baseRow, {}, { hrAuthoritative: true });
    const archivedRow = { ...baseRow, ...calculate().sanitizedUpdate };
    assert.deepEqual(calculate(archivedRow, fact).sanitizedUpdate, {});
});
