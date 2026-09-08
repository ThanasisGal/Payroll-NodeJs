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
const S = require('./apasxoliseisApprovedHourlyLeaveService');
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
    cards_apo_ora_02: '14:00', cards_eos_ora_02: '16:00', cards_ores_ergasias: 6 };
const categories = [{ kodikos: 'test-leave', perigrafh: 'Δοκιμαστική άδεια' }];
const history = (changes = {}) => [buildCompleteProfileSnapshot({ input: {
    ...employee, [C.ENABLED]: true, [C.TYPE]: 'APPROVED_LEAVE_INTERRUPTION',
    [C.FROM]: '2026-09-01', [C.START]: '12:00', [C.END]: '14:00',
    [C.CATEGORY]: 'test-leave', ...changes }, effectiveFrom: '2026-09-01' })];
function derive(row = baseRow, changes = {}, options = {}) {
    return S.deriveApprovedHourlyLeave({ row, effectiveEmployee: employee, leaveCategories: categories,
        resolvedArrangement: resolveEmploymentProfileFactsForDate(row.hmeromhnia, history(changes),
            { currentEmployee: employee, scheduledWorkingDay: S.scheduledWorkingDay(row) }), ...options });
}
function calculate(row = baseRow, fact = derive(row), options = {}) {
    return buildEmploymentDailyCalculationUpdate({ row, effectiveEmployee: employee,
        approvedHourlyLeave: fact, operations, argiesDateSet: new Set(), ...options });
}

test('basic credit, exact attendance, category, daily coverage and typed round-trip', async () => {
    const before = structuredClone(baseRow);
    const fact = derive();
    assert.equal(fact.creditedMinutes, 120);
    const plan = calculate(baseRow, fact);
    const output = { ...baseRow, ...plan.sanitizedUpdate };
    assert.equal(output.ores_ergasias_apologistika, 6);
    assert.equal(output.ores_apoysias_apologistika, 0);
    assert.equal(output[S.FLAG], true);
    assert.deepEqual(output[S.SEGMENTS], [{ apo_lepto: 720, eos_lepto: 840 }]);
    assert.equal(output.apo_ora_egkekrimenhs_oroadeias_apologistika, '12:00');
    assert.equal(output.eos_ora_egkekrimenhs_oroadeias_apologistika, '14:00');
    assert.equal(output.explicit_hourly_leave_hours, 2);
    assert.equal(output.kathgoria_adeias_apologistika, 'test-leave');
    assert.equal(output.apo_ora_02_apologistika, '14:00');
    assert.equal(output.eos_ora_02_apologistika, '16:00');
    const facts = resolveDailyActualWorkFacts(output);
    assert.equal(facts.actualWorkHours, 6);
    assert.equal(facts.leaveHours, 2);
    assert.equal(facts.contractualCoveredHours, 8);
    const doc = new ProdhlomenaOrariaModel(output); await doc.validate();
    assert.deepEqual(ProdhlomenaOrariaModel.hydrate(doc.toObject()).toObject()[S.SEGMENTS], output[S.SEGMENTS]);
    assert.deepEqual(baseRow, before);
    assert.equal(mongoose.connection.readyState, 0);
});
test('partial actual work always wins', () => {
    const fact = derive({ ...baseRow, cards_eos_ora_01: '12:30', cards_ores_ergasias: 6.5 });
    assert.deepEqual(fact.creditedIntervals, [{ apo_lepto: 750, eos_lepto: 840 }]);
    assert.equal(fact.creditedHours, 1.5);
});
test('split declared schedule persists both segments, never its gap or bounding interval', () => {
    const row = { ...baseRow, eos_ora_01: '12:00', apo_ora_02: '14:00', eos_ora_02: '18:00',
        cards_eos_ora_01: '11:00', cards_apo_ora_02: '15:00', cards_eos_ora_02: '18:00' };
    const fact = derive(row, { [C.START]: '11:00', [C.END]: '15:00' });
    const update = calculate(row, fact).sanitizedUpdate;
    assert.deepEqual(update[S.SEGMENTS], [{ apo_lepto: 660, eos_lepto: 720 }, { apo_lepto: 840, eos_lepto: 900 }]);
    assert.equal(update.explicit_hourly_leave_hours, 2);
    assert.equal(update.apo_ora_egkekrimenhs_oroadeias_apologistika, '');
    assert.equal(update.eos_ora_egkekrimenhs_oroadeias_apologistika, '');
});
test('exact external break and explicitly credited leave intervals exclude minutes', () => {
    const fact = derive(baseRow, {}, { effectiveEmployee: { ...employee, dialleima_entos_ektos_orarioy: false,
        dialleima_apo_ora_01: '12:30', dialleima_eos_ora_01: '13:00' },
        existingCreditedIntervals: [{ apo_lepto: 780, eos_lepto: 810 }] });
    assert.deepEqual(fact.creditedIntervals, [{ apo_lepto: 720, eos_lepto: 750 }, { apo_lepto: 810, eos_lepto: 840 }]);
});
for (const [name, changes, row] of [
    ['disabled', { [C.ENABLED]: false }, baseRow],
    ['expired', { [C.UNTIL]: '2026-09-06' }, baseRow],
    ['before start', { [C.FROM]: '2026-09-08' }, baseRow],
    ['weekday excluded', { [C.DAYS]: [2] }, baseRow],
    ['repo', {}, { ...baseRow, repo: true }],
    ['non-working', {}, { ...baseRow, kathgoria_ergasias: 'ΜΕ' }],
    ['time shift', { [C.TYPE]: 'APPROVED_TIME_SHIFT_INTERRUPTION' }, baseRow],
    ['other', { [C.TYPE]: 'OTHER_APPROVED_ARRANGEMENT' }, baseRow]
]) test(`${name}: byte/field-equivalent to existing calculation`, () => {
    const fact = derive(row, changes);
    assert.equal(fact.arrangementEffective, false);
    assert.deepEqual(calculate(row, fact).sanitizedUpdate, calculate(row, null).sanitizedUpdate);
});
test('raw employee fields without recorded eligible history are neutral', () => {
    const raw = { ...employee, ...history()[0] };
    const resolvedArrangement = resolveEmploymentProfileFactsForDate(baseRow.hmeromhnia, [],
        { currentEmployee: raw, scheduledWorkingDay: true });
    assert.equal(S.deriveApprovedHourlyLeave({ row: baseRow, resolvedArrangement }).creditedMinutes, 0);
});
test('scheduled Sunday and holiday premiums are actual-work-only', () => {
    const row = { ...baseRow, hmeromhnia: '2026-09-06', argia: true };
    const update = calculate(row, derive(row), { argiesDateSet: new Set(['2026-09-06']) }).sanitizedUpdate;
    assert.equal(update.explicit_hourly_leave_hours, 2);
    assert.equal(update.ores_argion_prosayxhsh_apologistika, 6);
});
test('overnight eligibility uses shift-start weekday; post-midnight work keeps its date', () => {
    const row = { ...baseRow, apo_ora_01: '22:00', eos_ora_01: '06:00',
        cards_apo_ora_01: '22:00', cards_eos_ora_01: '00:00',
        cards_apo_ora_02: '02:00', cards_eos_ora_02: '06:00' };
    const fact = derive(row, { [C.START]: '00:00', [C.END]: '02:00', [C.DAYS]: [1] });
    assert.deepEqual(fact.creditedIntervals, [{ apo_lepto: 1440, eos_lepto: 1560 }]);
    const update = calculate(row, fact, { argiesDateSet: new Set(['2026-09-08']) }).sanitizedUpdate;
    assert.equal(update.ores_nyxtas_apologistika, 6);
    assert.equal(update.ores_argion_prosayxhsh_apologistika, 4);
});
for (const category of ['', 'unknown', 'POSSIBLE_LEAVE']) test(`invalid category ${category} requests review without credit`, () => {
    const fact = derive(baseRow, { [C.CATEGORY]: category });
    assert.equal(fact.requiresHrReview, true);
    assert.equal(fact.creditedMinutes, 0);
    assert(calculate(baseRow, fact).protectionDiagnostics.includes(fact.reason));
});
for (const [name, changes] of [
    ['no cards', { cards_apo_ora_01: '', cards_eos_ora_01: '', cards_apo_ora_02: '', cards_eos_ora_02: '', cards_ores_ergasias: 0 }],
    ['unresolved orphan', { cards_eos_ora_02: '' }]
]) test(`${name} retains existing calculation/review path`, () => {
    const row = { ...baseRow, ...changes };
    const fact = derive(row);
    assert.equal(fact.creditedMinutes, 0);
    const update = calculate(row, fact).sanitizedUpdate;
    const baseline = calculate(row, null).sanitizedUpdate;
    for (const key of Object.keys(baseline)) assert.deepEqual(update[key], baseline[key], key);
});
for (const changes of [{ is_locked: true }, { hr_declared_leave: true }, { astheneia: true },
    { orphan_card_resolution: { status: 'HR_APPROVED' } }]) test(`authoritative state preserved: ${JSON.stringify(changes)}`, () => {
    const row = { ...baseRow, ...changes };
    assert.deepEqual(calculate(row, derive(row)).sanitizedUpdate, {});
});
test('weekly contractual credit does not increase actual work or worked-day duration', () => {
    const row = { ...baseRow, ...calculate().sanitizedUpdate };
    const facts = resolveDailyActualWorkFacts(row);
    assert.equal(32 + facts.actualWorkHours, 38);
    assert.equal(32 + facts.contractualCoveredHours, 40);
    assert.equal(facts.countsAsActualWorkDay, true);
    assert.equal(facts.actualWorkHours, 6);
});
test('early departure tolerance applies to final unexplained ten minutes', () => {
    const row = { ...baseRow, cards_eos_ora_01: '15:30', cards_apo_ora_02: '', cards_eos_ora_02: '', cards_ores_ergasias: 7.5 };
    const fact = derive(row, { [C.START]: '15:30', [C.END]: '15:50' });
    assert.equal(fact.creditedMinutes, 20);
    assert.equal(fact.unexplainedMinutes, 10);
    assert.equal(calculate(row, fact, { proorhApoxorhshMinutes: 15 }).sanitizedUpdate.ores_apoysias_apologistika, 0);
});
test('zero segments reset prior calculated leave without independent cleanup writes', () => {
    const row = { ...baseRow, ...calculate().sanitizedUpdate };
    const update = calculate(row, derive(row, { [C.ENABLED]: false })).sanitizedUpdate;
    assert.equal(update[S.FLAG], false);
    assert.deepEqual(update[S.SEGMENTS], []);
    assert.equal(update.explicit_hourly_leave_hours, 0);
    assert.equal(update.apo_ora_egkekrimenhs_oroadeias_apologistika, '');
    assert.equal(update.eos_ora_egkekrimenhs_oroadeias_apologistika, '');
});

test('weekly analyzer keeps 38 actual hours and two leave hours, counting five actual days', () => {
    const { analyzeWeeklySixthSeventhDay } = require('./apasxoliseisWeeklySixthSeventhDayPolicyService');
    const rows = Array.from({ length: 7 }, (_, index) => ({ ...baseRow,
        hmeromhnia: `2026-09-${String(7 + index).padStart(2, '0')}`,
        repo: index >= 5, kathgoria_ergasias: index >= 5 ? 'ΑΝ' : 'ΕΡΓ',
        cards_apo_ora_01: index < 5 ? '08:00' : '', cards_eos_ora_01: index < 5 ? '16:00' : '',
        cards_apo_ora_02: '', cards_eos_ora_02: '', cards_ores_ergasias: index < 5 ? 8 : 0 }));
    const friday = { ...baseRow, hmeromhnia: '2026-09-11' };
    rows[4] = { ...friday, ...calculate(friday, derive(friday)).sanitizedUpdate };
    const analysis = analyzeWeeklySixthSeventhDay({ weekRows: rows,
        effectiveProfile: { ...employee, pososto_prosayxhshs_6hs_hmeras: 40 } });
    assert.equal(analysis.dailyFacts.reduce((sum, day) => sum + day.actualWorkHours, 0), 38);
    assert.equal(analysis.dailyFacts.reduce((sum, day) => sum + day.actualWorkHours + day.leaveHours, 0), 40);
    assert.equal(analysis.dailyFacts.filter(day => day.countsAsActualWorkDay).length, 5);
    assert.equal(analysis.sixthDay, null);
    assert.equal(analysis.seventhDay, null);
    const { buildWeeklyRepoPostCheckWritePlan } = require('./apasxoliseisWeeklyPostCheckWritePlanService');
    const { buildWeeklyIllegalOvertimeUpdate } = require('./apasxoliseisWeeklyIllegalOvertimeCalculationService');
    const projectedRows = rows.map((row, index) => {
        const projected = { ...row, _id: `507f1f77bcf86cd79943902${index}`, kodikos: '0001', ypokatasthma: '0001' };
        // The legacy post-check projection did not select the scalar total.
        delete projected.explicit_hourly_leave_hours;
        return projected;
    });
    const plan = buildWeeklyRepoPostCheckWritePlan({ sessionTeam: 'test', companyId: '507f1f77bcf86cd799439012',
        apoDate: new Date('2026-09-07'), eosDate: new Date('2026-09-13'),
        employees: [{ ...employee, kodikos: '0001' }], rows: projectedRows,
        resolveProfileForDate: () => employee, buildWeeklyIllegalOvertimeUpdate });
    const fridayUpdate = plan.bulkOps.find(op => String(op.updateOne.filter._id) === projectedRows[4]._id).updateOne.update.$set;
    assert.equal(fridayUpdate.ores_pragmatikhs_ergasias_apologistika, 6);
    assert.equal(fridayUpdate.ores_adeias_pistomenes_apologistika, 2);
    const saturday = { ...baseRow, hmeromhnia: '2026-09-12' };
    rows[5] = { ...saturday, ...calculate(saturday, derive(saturday)).sanitizedUpdate,
        repo: true, kathgoria_ergasias: 'ΑΝ' };
    const sixth = analyzeWeeklySixthSeventhDay({ weekRows: rows,
        effectiveProfile: { ...employee, pososto_prosayxhshs_6hs_hmeras: 40 }, hourlyRate: 10 });
    assert.equal(sixth.sixthDay.sixthDayHours, 6);
});

test('arrangement resolver uses borrowing history and the correct current employee, never local raw fields', () => {
    const { resolveArrangementContext } = require('./apasxoliseisEffectiveHolidayContextProviderService');
    const local = { ...employee, afora_daneismo_ergazomenoy: true, typos_ergodoth_daneismoy: false,
        hmnia_enarxhs_daneismoy: '2026-09-01', hmnia_lhxhs_daneismoy: '2026-09-30' };
    const input = { employee: local, reviewDate: baseRow.hmeromhnia,
        normalHistory: history({ [C.ENABLED]: false }), scheduledWorkingDay: true,
        borrowedContext: { borrowingEmployee: employee, borrowingHistory: history() } };
    const result = resolveArrangementContext(input);
    assert.equal(result.arrangementEffective, true);
    assert.equal(result.facts[C.CATEGORY], 'test-leave');
    assert.equal(resolveArrangementContext({ ...input, scheduledWorkingDay: false }).arrangementEffective, false);
});

test('inactive foundation defaults preserve the exact approved-base frozen projection and fingerprint', () => {
    const file = __dirname + '/apasxoliseisPeriodFrozenSnapshotService.js';
    const source = require('node:child_process').execFileSync('git', ['show',
        '222f3184fe27101a2013ffe96b4afd09ffd07812:server/services/ergazomenoi/apasxoliseisPeriodFrozenSnapshotService.js'], { encoding: 'utf8' });
    const baseline = new Module(file, module); baseline.filename = file; baseline.paths = module.paths;
    baseline._compile(source, file);
    const input = { dailyResults: [{ ...baseRow, [S.FLAG]: false, [S.SEGMENTS]: [], explicit_hourly_leave_hours: 0 }] };
    assert.deepEqual(require('./apasxoliseisPeriodFrozenSnapshotService').buildEmploymentPeriodFrozenSnapshot(input),
        baseline.exports.buildEmploymentPeriodFrozenSnapshot(input));
});

test('newly selected authority metadata cannot change legacy daily operation inputs', () => {
    const { approvedLeaveCalculationRow } = require('../../controllers/ergazomenoi/erganhController')
        .__orphanDailyCalculationTestHooks;
    const loaded = { ...baseRow, adeia_apologistika: true, kathgoria_adeias_apologistika: 'stored',
        orphan_card_resolution: { status: 'HR_APPROVED' } };
    const legacy = { ...baseRow }; delete legacy.kathgoria_ergasias;
    const inactive = derive(loaded, { [C.ENABLED]: false });
    assert.deepEqual(approvedLeaveCalculationRow(loaded, inactive), legacy);
    assert.deepEqual(calculate(approvedLeaveCalculationRow(loaded, inactive), inactive).sanitizedUpdate,
        calculate(legacy, null).sanitizedUpdate);
    assert.equal(approvedLeaveCalculationRow(loaded, derive(loaded)), loaded);
    const { resolveArrangementContext } = require('./apasxoliseisEffectiveHolidayContextProviderService');
    assert.equal(resolveArrangementContext({ employee, reviewDate: baseRow.hmeromhnia,
        normalHistory: [{ hmeromhnia_allaghs_orarioy_apo: '2026-01-01' },
            { hmeromhnia_allaghs_orarioy_apo: '2026-02-01' }], scheduledWorkingDay: true }).arrangementEffective, false);
});

test('frozen serialization retains exact segments and provenance; missing recalculation authority stops safely', () => {
    const { buildEmploymentPeriodFrozenSnapshot } = require('./apasxoliseisPeriodFrozenSnapshotService');
    const { classifyLeaveProvenance, LEAVE_PROVENANCE } = require('./apasxoliseisLeaveProvenanceService');
    const row = { ...baseRow, ...calculate().sanitizedUpdate };
    const { snapshot } = buildEmploymentPeriodFrozenSnapshot({ dailyResults: [row] });
    assert.deepEqual(snapshot.daily_results[0][S.SEGMENTS], row[S.SEGMENTS]);
    assert.equal(classifyLeaveProvenance(row), LEAVE_PROVENANCE.APPROVED_ARRANGEMENT_HOURLY_LEAVE);
    assert.throws(() => calculate(snapshot.daily_results[0], null),
        { code: 'APPROVED_HOURLY_LEAVE_CONTEXT_REQUIRED' });
    assert.deepEqual(calculate({ ...row, is_locked: true }, null).sanitizedUpdate, {});
});

test('frozen authoritative week recalculates changed cards from archived eligibility/category authority only', () => {
    const resolvedArrangement = resolveEmploymentProfileFactsForDate(baseRow.hmeromhnia, history(),
        { currentEmployee: employee, scheduledWorkingDay: true });
    const row = { ...baseRow, ...calculate().sanitizedUpdate, kodikos: '0001', ypokatasthma: '0001',
        effective_profile_resolved: { ...employee, approved_hourly_leave_context: {
            resolvedArrangement, leaveCategories: categories, breakProfile: employee } } };
    const baselineSnapshot = { scope: { team: 'test', company_kod: '507f1f77bcf86cd799439012',
        ypokatasthma: '0001', period_start: '2026-09-07', period_end: '2026-09-13' },
        employees: [{ ...employee, kodikos: '0001' }], daily_results: [row],
        weekly_calculation_context: { profile_history: history(), calendar_facts: [] } };
    const contextRows = Array.from({ length: 6 }, (_, index) => ({ ...baseRow,
        _id: `507f1f77bcf86cd79943902${index}`, kodikos: '0001', ypokatasthma: '0001', is_locked: true,
        hmeromhnia: `2026-09-${String(8 + index).padStart(2, '0')}`,
        effective_profile_resolved: employee }));
    const result = runFrozenWeek({ employeeKodikos: '0001', weekStart: '2026-09-07',
        frozenRows: [{ ...row, cards_eos_ora_01: '12:30', cards_ores_ergasias: 6.5 }, ...contextRows], baselineSnapshot });
    assert.equal(result.correctedRows[0].explicit_hourly_leave_hours, 1.5);
    assert.equal(result.correctedRows[0].ores_ergasias_apologistika, 6.5);
    assert.equal(result.correctedRows[0].ores_apoysias_apologistika, 0);
    assert.equal(result.correctedRows[0].eos_ora_02_apologistika, '16:00');
    assert.deepEqual(result.correctedRows[0][S.SEGMENTS], [{ apo_lepto: 750, eos_lepto: 840 }]);
    assert.equal(row.explicit_hourly_leave_hours, 2);
    assert.equal(mongoose.connection.readyState, 0);
});
