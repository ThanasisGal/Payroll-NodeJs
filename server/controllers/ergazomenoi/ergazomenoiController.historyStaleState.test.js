'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ejs = require('ejs');
const W = require('../../services/ergazomenoi/employeeEmploymentProfileWriter');
const S = require('../../services/ergazomenoi/employeeHistoryEditorStateService');
const M = require('../../utils/ergazomenoi/employmentProfileMaintenance');
const Terms = require('../../utils/ergazomenoi/getOrarioTermsForDate');
const { semanticHistoryRows } = require('../../utils/ergazomenoi/employmentHistoryCanonicalStatus');
const { buildEmployeeMaintenanceIdentity } = require('../../services/ergazomenoi/employeeMaintenanceHistoryPlannerService');
const { dateKeyUtc } = require('../../utils/date/mondaySundayWeek');
const { FIELD, scope, fixture, store, historyId } = require('../../../test/fixtures/employeeProfileTransactionStore');
const source = fs.readFileSync(__dirname + '/ergazomenoiController.js', 'utf8').replaceAll('\r', '');
const partial = fs.readFileSync(__dirname + '/../../../views/ergazomenoi/ergazomenoi/partials/edit/cardBodies/section7/istoriko.ejs', 'utf8');

function method(name, next) {
    const start = source.indexOf(`    static ${name} = `), end = source.indexOf(`    static ${next}`, start);
    assert.ok(start >= 0 && end > start);
    return source.slice(start, end).trim().replace(`static ${name} = `, '').replace(/;$/, '');
}
const response = () => ({ code: 200, status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; }, render(view, locals) { this.view = view; this.locals = locals; } });
const stateToken = db => S.buildEmployeeHistoryEditorStateToken({
    currentEmployee: db.state().employees[0], historyRows: db.state().history
});

async function submit(db, expectedStateToken, { authorized = true, extra = {}, updates } = {}) {
    let writerCalls = 0, reads = 0;
    const helpers = source.slice(source.indexOf('function valueOrEmpty('), source.indexOf('// ✅ HELPERS: Εμπλουτισμός ιστορικού'));
    const handler = vm.runInNewContext(`${helpers}\n(${method('updateIstorikoData', 'searchPostErgazomenoi')})`, {
        Date, console: { error() {} }, ...S, ...M, ...Terms, buildEmployeeMaintenanceIdentity,
        canManageEmployeeHistory: async () => authorized,
        ErgazomenoiModel: { findOne() { reads++; return { lean: async () => db.state().employees[0] }; } },
        writeEmployeeEmploymentHistoryOperations: args => { writerCalls++;
            return W.writeEmployeeEmploymentHistoryOperations({ ...args, ...db.deps }); }
    });
    const req = { session: { userId: 'authorized-test-user', userTeam: scope.team, companyInUse: scope.company_kod },
        body: { employeeId: 'employee', expectedStateToken, updates: updates || [{ state: 'modified',
            _id: historyId('employee', 0), data: { hmeromhnia_lhxhs_symbashs: '2026-11-30' } }], ...extra } };
    const res = response(); await handler(req, res);
    return { res, writerCalls, reads };
}

test('actual edit handler renders a token from full persisted History before enrichment, with hidden rows excluded from display', async () => {
    const initial = fixture();
    const redundant = { ...initial.history[0], _id: 'redundant', employment_history_canonical_status: 'REDUNDANT_REFERENCED',
        employment_history_canonical_survivor_id: initial.history[0]._id };
    initial.history.push(redundant);
    const options = [];
    const query = value => ({ mongooseOptions(value) { options.push(value); return this; },
        sort() { return this; }, lean() { return this; }, exec: async () => value,
        then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); } });
    const context = { Date, console: { error() {} }, ...S, ...M, semanticHistoryRows,
        CompaniesModel: { findById: () => query({}) }, ErgazomenoiModel: { findById: () => query(initial.employee) },
        IstorikoProslhpseonAllagonModel: { find: () => query(initial.history) },
        PerifereiesModel: { find: () => query([]) }, GenikesParametroiModel: { find: () => query([]) },
        ProdhlomenaOrariaModel: { find: () => query([]) }, mongoose: { trusted: value => value },
        getEmploymentProfileUiContext: async () => ({}), canManageEmployeeHistory: async () => true,
        buildEmployeeMaintenanceIdentity, dateKeyUtc, selectMaintenanceMode: W.selectMaintenanceMode,
        enrichIstorikoRowsForDetails: async rows => rows.map(row => ({ ...row, __lookups: { label: 'display-only' } })) };
    const handler = vm.runInNewContext(`(${method('editErgazomenoiForm', 'getIstorikoData')})`, context);
    const res = response();
    await handler({ params: { id: 'employee' }, session: { userTeam: scope.team,
        companyInUse: scope.company_kod, yearInUse: 2026 } }, res, error => { throw error; });
    const expected = S.buildEmployeeHistoryEditorStateToken({ currentEmployee: initial.employee, historyRows: initial.history });
    assert.equal(res.locals.employeeHistoryStateToken, expected);
    assert.equal(options[0].includeRedundantHistoryArtifacts, true);
    assert.equal(res.locals.istorikoData.length, 3);
    assert.notEqual(expected, S.buildEmployeeHistoryEditorStateToken({ currentEmployee: initial.employee,
        historyRows: res.locals.istorikoData }));
    const html = ejs.render(partial, res.locals);
    assert.ok(html.includes(`data-expected-state-token="${expected}"`));
    assert.ok(html.includes('id="updateIstorikoBtn"'));
    assert.equal(html.includes('employee_profile_mutation_sequence'), false);
});

test('History view safely escapes the attribute and carries no replacement maintenance revision', () => {
    const html = ejs.render(partial, { ergazomenoiData: fixture().employee, istorikoData: [],
        canManageEmployeeHistory: true, employeeHistoryStateToken: '\"><script>alert(1)</script>' });
    assert.ok(html.includes('&#34;&gt;&lt;script&gt;'));
    assert.equal(html.includes('<script>'), false);
    assert.equal(html.includes('historyExpectedRevision'), false);
});

for (const [name, expected] of [['missing', undefined], ['empty', ''], ['malformed', 'old-browser'],
    ['object', { $ne: null }], ['wrong-length', 'a'.repeat(63)]]) {
    test(`browser ${name} token fails closed before writer or business reads`, async () => {
        const db = store(), before = db.state();
        const { res, writerCalls, reads } = await submit(db, expected);
        assert.equal(res.code, 409); assert.equal(res.body.reason, 'EMPLOYEE_HISTORY_EDITOR_STALE');
        assert.equal(writerCalls, 0); assert.equal(reads, 0); assert.deepEqual(db.state(), before);
        assert.match(res.body.message, /Δεν αποθηκεύτηκε καμία αλλαγή/);
        for (const number of ['1.', '2.', '3.']) assert.ok(res.body.message.includes(number));
        assert.ok(res.body.message.endsWith('EMPLOYEE_HISTORY_EDITOR_STALE'));
    });
}

test('even an empty batch requires a token because existing canonical renumbering can write', async () => {
    const db = store(), before = db.state();
    const { res, writerCalls } = await submit(db, undefined, { updates: [] });
    assert.equal(res.code, 409); assert.equal(writerCalls, 0); assert.deepEqual(db.state(), before);
});

test('well-formed forged token reaches transactional comparison and cannot authorize a mutation', async () => {
    const db = store(), before = db.state();
    const { res, writerCalls } = await submit(db, 'f'.repeat(64), { extra: {
        employee_profile_mutation_sequence: 0, historyExpectedRevision: stateToken(db), currentEmployee: before.employees[0] } });
    assert.equal(res.code, 409); assert.equal(res.body.reason, 'EMPLOYEE_HISTORY_EDITOR_STALE');
    assert.equal(writerCalls, 1); assert.deepEqual(db.state(), before);
    assert.equal(JSON.stringify(res.body).includes(stateToken(db)), false);
    assert.equal(JSON.stringify(res.body).includes('f'.repeat(64)), false);
});

test('actual HTTP two-tab flow: B saves, A receives typed 409 with no committed changes', async () => {
    const db = store(), a = stateToken(db), b = stateToken(db);
    const saved = await submit(db, b);
    assert.equal(saved.res.code, 200, saved.res.body.message);
    const beforeA = db.state();
    assert.notEqual(stateToken(db), a);
    const rejected = await submit(db, a, { updates: [{ state: 'modified', _id: historyId('employee', 1),
        data: { hmeromhnia_lhxhs_symbashs: '2026-10-31' } }] });
    assert.equal(rejected.res.code, 409); assert.equal(rejected.res.body.reason, 'EMPLOYEE_HISTORY_EDITOR_STALE');
    assert.deepEqual(db.state(), beforeA); assert.equal(db.state().employees[0][FIELD], 1);
});

test('authorization remains authoritative before token validation', async () => {
    const db = store(), before = db.state();
    const { res, writerCalls, reads } = await submit(db, undefined, { authorized: false });
    assert.equal(res.code, 403); assert.equal(writerCalls, 0); assert.equal(reads, 0);
    assert.deepEqual(db.state(), before);
});
