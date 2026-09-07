'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const cp = require('node:child_process');
const vm = require('node:vm');
const fs = require('node:fs');
const T = require('./employmentProfileTemporal');
const C = require('./employmentProfileContract');
const H = require('./employmentProfileHistory');
const B = require('./resolveBreakConfigurationForDate');
const Terms = require('./getOrarioTermsForDate');
const W = require('../../services/ergazomenoi/employeeEmploymentProfileWriter');
const Borrowed = require('../../services/ergazomenoi/apasxoliseisBorrowedEmploymentProfileResolverService');
const Review = require('../../services/ergazomenoi/apasxoliseisReviewEmploymentProfileService');
const Weekly = require('../../services/ergazomenoi/apasxoliseisWeeklyCanonicalDecisionContextService');
const Atomic = require('../../services/ergazomenoi/apasxoliseisWeeklyRepoTransferAuthoritativeContextService');
const scope = { team: 'fixture', company_kod: 'fixture', kodikos: '0001' };
const clone = value => JSON.parse(JSON.stringify(value));
const legacy = () => ({ ...scope, _id: 'employee', dialleima_se_lepta: 30,
    dialleima_entos_ektos_orarioy: false, hmeres_ergasias_ebdomadas: 5,
    ores_ergasias_ebdomadas: 40, mo_oron_hmerhsias_ergasias: 8, kathestos_apasxolhshs: '0',
    typos_apasxolhshs: '0', typos_ebdomadas: '5HMERH', symbatikes_ores_ergasias: 40,
    hmeromhnia_allaghs_orarioy_apo: '2026-01-01', hmeromhnia_allaghs_orarioy_eos: '2026-01-07' });
function memory(employee = legacy(), history = [], fail = false) {
    let state = clone({ employee, history }), draft;
    const session = { async withTransaction(work) { draft = clone(state); try { await work(); if (fail) throw Error('rollback'); state = draft; } finally { draft = null; } }, async endSession() {} };
    const matches = (row, filter) => Object.entries(filter).every(([k, v]) =>
        v == null ? row[k] == null : v instanceof Date ? new Date(row[k]).getTime() === v.getTime() : String(row[k]) === String(v));
    const query = read => ({ session(s) { assert.equal(s, session); return this; }, sort() { return this; }, async lean() { return clone(read()); } });
    const employeeModel = {
        findOne: filter => query(() => matches(draft.employee, filter) ? draft.employee : null),
        async updateOne(filter, update, { session: s }) { assert.equal(s, session); assert(matches(draft.employee, filter)); Object.assign(draft.employee, clone(update.$set)); return { matchedCount: 1 }; }
    };
    const historyModel = {
        find: filter => query(() => draft.history.filter(row => matches(row, filter))),
        async create([row], { session: s }) { assert.equal(s, session); const saved = { ...clone(row), _id: 'h' + draft.history.length }; draft.history.push(saved); return [saved]; },
        async updateOne(filter, update, { session: s }) { assert.equal(s, session); const row = draft.history.find(row => matches(row, filter)); if (!row) return { matchedCount: 0 }; Object.assign(row, clone(update.$set)); return { matchedCount: 1 }; },
        async deleteOne(filter, { session: s }) { assert.equal(s, session); const i = draft.history.findIndex(row => matches(row, filter)); if (i < 0) return { deletedCount: 0 }; draft.history.splice(i, 1); return { deletedCount: 1 }; }
    };
    const deps = { scope, employeeId: employee._id, employeeModel, historyModel,
        connection: { startSession: async () => session }, capabilityProbe: async () => true };
    return { state: () => clone(state), deps, append: (date, minutes, patch = {}) => W.writeEmployeeEmploymentProfile({ ...deps,
        effectiveFrom: date, input: { dialleima_se_lepta: minutes }, maintenance: undefined,
        // New version work-term changes use the existing mapped seam.
        ...(Object.keys(patch).length ? { maintenance: { employeeChanges: patch, historyChanges: patch,
            identity: Object.fromEntries(['hmeromhnia_proslhpshs', 'hmeromhnia_allaghs_symbashs',
                'hmeromhnia_allaghs_orarioy_apo', 'hmeromhnia_allaghs_orarioy_eos', T.START, T.END,
                'hmeromhnia_lhxhs_symbashs', 'hmeromhnia_apoxorhshs'].map(f => [f, f === T.START ? date : null])) } } : {}) }) };
}
const breaks = (db, dates) => { const s = db.state(); return dates.map(d => B.resolveBreakConfigurationForDate(d, s.history, s.employee).break_minutes); };
const project = (row, fields) => Object.fromEntries(Object.entries(row).filter(([key]) => fields.split(/\s+/).includes(key)));

test('first and second transactional V1 transitions preserve exact break and standard work-term chronology', async () => {
    const db = memory();
    await db.append('2026-09-15', 15, { ores_ergasias_ebdomadas: 32, hmeres_ergasias_ebdomadas: 4, kathestos_apasxolhshs: '1', typos_apasxolhshs: '1' });
    assert.deepEqual(breaks(db, ['2026-06-15', '2026-09-14', '2026-09-15', '2026-09-16']), [30, 30, 15, 15]);
    const first = db.state();
    for (const date of ['2026-06-15', '2026-09-14', '2026-09-15']) {
        const p = Terms.getOrarioTermsForDate(date, first.history, first.employee);
        assert.equal(p.ores_ergasias_ebdomadas, date < '2026-09-15' ? 40 : 32);
        assert.equal(p.hmeres_ergasias_ebdomadas, date < '2026-09-15' ? 5 : 4);
        assert.equal(p.kathestos_apasxolhshs, date < '2026-09-15' ? '0' : '1');
    }
    await db.append('2026-10-20', 20);
    assert.deepEqual(breaks(db, ['2026-09-14', '2026-09-15', '2026-10-19', '2026-10-20']), [30, 15, 15, 20]);
    assert.deepEqual(db.state().employee[T.ANCHOR], first.employee[T.ANCHOR]);
});
test('explicit legacy break/work terms win over the observed baseline, V1 wins from its start', async () => {
    const row = { ...scope, _id: 'old', afora_allagh_oron_ergasias: true, afora_allagh_dialleimatos: true,
        hmeromhnia_isxyos_dialleimatos_apo: '2026-06-01', hmeromhnia_allaghs_orarioy_apo: '2026-06-01',
        hmeromhnia_allaghs_orarioy_eos: '2026-08-31', dialleima_se_lepta: 25, ores_ergasias_ebdomadas: 35 };
    const db = memory(legacy(), [row]); await db.append('2026-09-15', 15);
    assert.deepEqual(breaks(db, ['2026-05-01', '2026-06-15', '2026-09-15']), [30, 25, 15]);
    const s = db.state(); assert.equal(Terms.getOrarioTermsForDate('2026-06-15', s.history, s.employee).ores_ergasias_ebdomadas, 35);
    assert.deepEqual(s.history[0], row);
});
test('canonical/atomic production projections preserve selected V1 and all resolver results', async () => {
    const db = memory(); await db.append('2026-09-15', 15); await db.append('2026-10-20', 20);
    const s = db.state();
    for (const [hp, ep] of [[Weekly.HISTORY_SELECT_FIELDS, Weekly.CANONICAL_EMPLOYEE_PROFILE_FIELDS],
        [Atomic.ATOMIC_REPO_TRANSFER_HISTORY_FIELDS, Atomic.ATOMIC_REPO_TRANSFER_EMPLOYEE_FIELDS]]) {
        const rows = s.history.map(row => project(row, hp)), employee = project(s.employee, ep);
        assert(rows.every(T.complete));
        for (const date of ['2026-06-15', '2026-09-16', '2026-12-01']) {
            assert.deepEqual(B.resolveBreakConfigurationForDate(date, rows, employee), B.resolveBreakConfigurationForDate(date, s.history, s.employee));
            assert.deepEqual(Terms.getOrarioTermsForDate(date, rows, employee), Terms.getOrarioTermsForDate(date, s.history, s.employee));
            assert.deepEqual(H.resolveEmploymentProfileFactsForDate(date, rows, { currentEmployee: employee }), H.resolveEmploymentProfileFactsForDate(date, s.history, { currentEmployee: s.employee }));
        }
    }
});
test('V1 null end is open-ended, legacy null end retains schedule end', () => {
    const row = H.buildCompleteProfileSnapshot({ current: legacy(), effectiveFrom: '2026-09-15' });
    row.hmeromhnia_allaghs_orarioy_eos = '2026-09-30';
    for (const date of ['2026-10-15', '2026-12-01']) assert(Terms.isEffectiveTermsRowForDate(row, date));
    const old = { ...row }; delete old[C.SCHEMA_VERSION];
    assert.equal(Terms.isEffectiveTermsRowForDate(old, '2026-10-15'), false);
});
test('exact first/later V1 corrections never overwrite anchor', async () => {
    const db = memory(); await db.append('2026-09-15', 15); await db.append('2026-10-20', 20);
    const s = db.state();
    for (const row of s.history) await W.writeEmployeeEmploymentProfile({ ...db.deps, mode: W.MODE_CORRECT_EXISTING,
        historyId: row._id, effectiveFrom: row[T.START], input: { dialleima_se_lepta: 25 } });
    assert.deepEqual(db.state().employee[T.ANCHOR], s.employee[T.ANCHOR]);
    assert.equal(breaks(db, ['2026-06-15'])[0], 30);
});
test('supported exact legacy Maintenance correction captures only observed pre-change values once', async () => {
    const employee = legacy(); employee[T.START] = '2026-01-01';
    const row = { ...scope, _id: 'old', [T.START]: '2026-01-01', [T.END]: null };
    const db = memory(employee, [row]);
    await W.writeEmployeeEmploymentProfile({ ...db.deps, mode: W.MODE_CORRECT_EXISTING, historyId: row._id,
        effectiveFrom: '2026-01-01', input: { dialleima_se_lepta: 15 } });
    assert.equal(db.state().employee[T.ANCHOR].facts.dialleima_se_lepta, 30);
    assert(!Object.hasOwn(db.state().employee[T.ANCHOR].facts, C.ENABLED));
});
test('earliest V1 deletion retains anchor and never extends it through a deleted V1 gap', async () => {
    const db = memory(); await db.append('2026-09-15', 15); await db.append('2026-10-20', 20);
    const s = db.state();
    await W.writeEmployeeEmploymentHistoryOperations({ ...db.deps, operations: [{ state: 'deleted', historyId: s.history[0]._id }] });
    assert.deepEqual(db.state().employee[T.ANCHOR], s.employee[T.ANCHOR]);
    assert.equal(breaks(db, ['2026-06-15'])[0], 30);
    const state = db.state(); assert.equal(B.resolveBreakConfigurationForDate('2026-09-16', state.history, state.employee).source, 'UNRECORDED_PROFILE');
});
test('later transaction failure rolls back compatibility metadata with current/history', async () => {
    const db = memory(legacy(), [], true), before = db.state();
    await assert.rejects(db.append('2026-09-15', 15)); assert.deepEqual(db.state(), before);
});
test('unanchored future current fails closed; missing observable anchor fields are not invented', () => {
    const current = H.buildCompleteProfileSnapshot({ current: legacy(), effectiveFrom: '2026-09-15' });
    assert.equal(T.fallback('2026-06-15', current).source, 'UNRECORDED_PROFILE');
    const a = T.capture({ dialleima_se_lepta: 30 }, [], '2026-09-15');
    assert.deepEqual(a.facts, { dialleima_se_lepta: 30 });
    assert.equal(T.fallback('2026-09-15', current).source, 'CURRENT_PROFILE');
});
test('pure legacy standard/break resolution matches exact deployed baseline', () => {
    const baseline = file => { const module = { exports: {} }; vm.runInNewContext(cp.execFileSync('git', ['show', `bba736417cf30ff9d2de6e460496b96b552b21ba:server/utils/ergazomenoi/${file}.js`], { encoding: 'utf8' }), { module, exports: module.exports, Date }); return module.exports; };
    const oldTerms = baseline('getOrarioTermsForDate'), oldBreak = baseline('resolveBreakConfigurationForDate');
    const employee = legacy();
    const rows = [{ ...employee, _id: 'old', afora_allagh_oron_ergasias: true, afora_allagh_dialleimatos: true,
        hmeromhnia_isxyos_dialleimatos_apo: '2026-01-01' }];
    for (const date of ['2025-12-01', '2026-01-03', '2026-06-15']) for (const history of [[], rows]) {
        assert.deepEqual(clone(Terms.getOrarioTermsForDate(date, history, employee)), clone(oldTerms.getOrarioTermsForDate(date, history, employee)));
        assert.deepEqual(clone(B.resolveBreakConfigurationForDate(date, history, employee)), clone(oldBreak.resolveBreakConfigurationForDate(date, history, employee)));
    }
});
test('borrowed and review profiles resolve historical type/days instead of later current', async () => {
    const db = memory(); await db.append('2026-09-15', 15, { hmeres_ergasias_ebdomadas: 6, ores_ergasias_ebdomadas: 32, kathestos_apasxolhshs: '1' });
    const s = db.state();
    const loan = { afora_daneismo_ergazomenoy: true, typos_ergodoth_daneismoy: false, hmnia_enarxhs_daneismoy: '2026-01-01' };
    const before = Borrowed.resolveEffectiveEmploymentProfileForReviewDate({ reviewDate: '2026-06-15', normalEmployee: loan,
        borrowedContext: { borrowingEmployee: s.employee, borrowingHistory: s.history } });
    assert.equal(before.hmeres_ergasias_ebdomadas, 5); assert.equal(before.ores_ergasias_ebdomadas, 40);
    assert.equal(before.resolution_blocked, false); assert.equal(Review.resolveReviewIsFullTimeProfile(before), true);
});
test('approved arrangement never derives from compatibility/current fallback', async () => {
    const db = memory(); await db.append('2026-09-15', 15);
    const s = db.state();
    s.employee[C.ENABLED] = true;
    const resolved = H.resolveEmploymentProfileFactsForDate('2026-06-15', s.history, { currentEmployee: s.employee, scheduledWorkingDay: true });
    assert.equal(resolved.arrangementEffective, false); assert.equal(resolved.facts[C.ENABLED], false);
    assert.equal(resolved.facts.dialleima_se_lepta, 30);
});

test('frozen serialization retains V1 and compatibility provenance without changing legacy projection', async () => {
    const Frozen = require('../../services/ergazomenoi/apasxoliseisPeriodFrozenSnapshotService');
    const db = memory(); await db.append('2026-09-15', 15); await db.append('2026-10-20', 20);
    const s = db.state();
    const result = Frozen.buildEmploymentPeriodFrozenSnapshot({ employees: [s.employee], profileHistory: s.history,
        dailyResults: [{ kodikos: scope.kodikos, hmeromhnia: '2026-09-16' }] }).snapshot;
    assert(result.weekly_calculation_context.profile_history.every(T.complete));
    assert.deepEqual(result.employees[0][T.ANCHOR], s.employee[T.ANCHOR]);
    assert.equal(B.resolveBreakConfigurationForDate('2026-06-15', result.weekly_calculation_context.profile_history, result.employees[0]).break_minutes, 30);
    assert.equal(B.resolveBreakConfigurationForDate('2026-09-16', result.weekly_calculation_context.profile_history, result.employees[0]).break_minutes, 15);
});
test('actual borrowed preload projections retain the same canonical temporal fields', async () => {
    const db = memory(); await db.append('2026-09-15', 15);
    const s = db.state(); s.employee.company_kod = 'borrowed'; s.history.forEach(row => { row.company_kod = 'borrowed'; });
    const loan = { _id: 'loan', afora_daneismo_ergazomenoy: true, typos_ergodoth_daneismoy: false,
        afm_daneizomenoy_ergodoth: 'fixture-afm', kodikos_ergazomenoy_alloy_ergodoth: scope.kodikos,
        hmnia_enarxhs_daneismoy: '2026-01-01' };
    const model = rows => ({ find: () => ({ select(fields) { return { lean: async () => rows.map(row => project(row, fields)) }; } }) });
    const contexts = await Borrowed.preloadBorrowedEmploymentProfileContexts({ team: scope.team, employees: [loan], models: {
        companiesModel: model([{ _id: 'borrowed', afm: 'fixture-afm' }]), employeeModel: model([s.employee]), historyModel: model(s.history) } });
    const context = contexts.get('loan'); assert(T.complete(context.borrowingHistory[0]));
    const profile = Borrowed.resolveEffectiveEmploymentProfileForReviewDate({ reviewDate: '2026-06-15', normalEmployee: loan, borrowedContext: context });
    assert.equal(profile.ores_ergasias_ebdomadas, 40); assert.equal(profile.dialleima_se_lepta, 30);
});
test('actual controller temporal merge removes newer current facts for historical requests', async () => {
    const source = fs.readFileSync(__dirname + '/../../controllers/ergazomenoi/erganhController.js', 'utf8');
    const methods = source.slice(source.indexOf('function getOrarioTermsForDate('), source.indexOf('function getWorkTimeRules('));
    const resolve = vm.runInNewContext(`${methods}\ngetEffectiveEmployeeForDate`, {
        temporalProfile: T, resolveTemporalWorkTerms: Terms.getOrarioTermsForDate, resolveTemporalFacts: H.resolveEmploymentProfileFactsForDate });
    const db = memory(); await db.append('2026-09-15', 15, { ores_ergasias_ebdomadas: 32 });
    const s = db.state(), p = resolve({ hmeromhnia: '2026-06-15' }, s.employee, s.history);
    assert.equal(p.dialleima_se_lepta, 30); assert.equal(p.ores_ergasias_ebdomadas, 40);
    assert.equal(p._workTermsSource, 'PRE_V1_COMPATIBILITY_ANCHOR');
});
test('all known anchor fact families survive; client input cannot replace metadata', async () => {
    const original = { ...legacy(), synexes_diakekomeno: true, typos_orarioy: true,
        evelikth_proselefsh: 15, dialleima_apo_ora_01: '12:00', dialleima_eos_ora_01: '12:30' };
    const db = memory(original);
    await W.writeEmployeeEmploymentProfile({ ...db.deps, effectiveFrom: '2026-09-15', input: {
        dialleima_se_lepta: 15, dialleima_apo_ora_01: '13:00', dialleima_eos_ora_01: '13:15',
        evelikth_proselefsh: 30, synexes_diakekomeno: false, typos_orarioy: false, symbatikes_ores_ergasias: 32 } });
    const s = db.state(), p = H.resolveEmploymentProfileFactsForDate('2026-06-15', s.history, { currentEmployee: s.employee });
    for (const field of T.ANCHOR_FIELDS.filter(f => Object.hasOwn(original, f))) assert.deepEqual(p.facts[field], original[field], field);
    const payload = require('./employmentProfileMaintenance').profileInput({ [T.ANCHOR]: { facts: { dialleima_se_lepta: 99 } } }, 'edit');
    assert.deepEqual(payload, {});
});
test('valid arrangement full vs projected history has identical active provenance', () => {
    const row = H.buildCompleteProfileSnapshot({ effectiveFrom: '2026-09-15', input: { [C.ENABLED]: true,
        [C.TYPE]: 'OTHER_APPROVED_ARRANGEMENT', [C.FROM]: '2026-09-15', [C.DAYS]: [2] } });
    const options = { scheduledWorkingDay: true };
    const full = H.resolveEmploymentProfileFactsForDate('2026-09-15', [row], options);
    assert.equal(full.arrangementEffective, true);
    assert.deepEqual(H.resolveEmploymentProfileFactsForDate('2026-09-15', [project(row, Weekly.HISTORY_SELECT_FIELDS)], options), full);
});

test('anchored first boundary cannot move and import cannot clear compatibility metadata', async () => {
    const db = memory(); await db.append('2026-09-15', 15); const before = db.state();
    await assert.rejects(W.writeEmployeeEmploymentHistoryOperations({ ...db.deps, operations: [{ state: 'modified', historyId: before.history[0]._id,
        input: {}, effectiveFrom: '2026-09-20', maintenance: { submittedFields: [T.START], historyChanges: { [T.START]: '2026-09-20' } } }] }),
    error => error.code === 'EMPLOYEE_PROFILE_RETROSPECTIVE_BOUNDARY_UNSUPPORTED');
    assert.deepEqual(db.state(), before);
    const { buildTblProsopExistingUpdate } = require('./tblProsopImportUpdate');
    const imported = { ...before.employee, ...buildTblProsopExistingUpdate({ D: 'Updated' }, { eponymo: 'Updated' }).$set };
    assert.deepEqual(imported[T.ANCHOR], before.employee[T.ANCHOR]);
    assert.equal(B.resolveBreakConfigurationForDate('2026-06-15', before.history, imported).break_minutes, 30);
    const Model = require('../../models/ergazomenoi').ErgazomenoiModel;
    assert.deepEqual(clone(Model.hydrate(imported).toObject()[T.ANCHOR]), before.employee[T.ANCHOR]);
});
