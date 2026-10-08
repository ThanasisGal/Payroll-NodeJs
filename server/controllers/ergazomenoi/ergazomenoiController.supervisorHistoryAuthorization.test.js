'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ejs = require('ejs');
const W = require('../../services/ergazomenoi/employeeEmploymentProfileWriter');
const A = require('../../services/ergazomenoi/employeeHistoryAuthorizationService');
const P = require('../../services/ergazomenoi/employeeHistoryProblemScopeService');
const S = require('../../services/ergazomenoi/employeeHistoryEditorStateService');
const M = require('../../utils/ergazomenoi/employmentProfileMaintenance');
const Terms = require('../../utils/ergazomenoi/getOrarioTermsForDate');
const { semanticHistoryRows } = require('../../utils/ergazomenoi/employmentHistoryCanonicalStatus');
const { buildEmployeeMaintenanceIdentity } = require('../../services/ergazomenoi/employeeMaintenanceHistoryPlannerService');
const { dateKeyUtc } = require('../../utils/date/mondaySundayWeek');
const { scope, fixture, historyId, store } = require('../../../test/fixtures/employeeProfileTransactionStore');
const { supervisor, userModel, problemFixture, token } = require('../../../test/fixtures/employeeHistorySupervisor');
const source = fs.readFileSync(__dirname + '/ergazomenoiController.js', 'utf8').replaceAll('\r', '');
const partial = fs.readFileSync(__dirname + '/../../../views/ergazomenoi/ergazomenoi/partials/edit/cardBodies/section7/istoriko.ejs', 'utf8');
const problemId = historyId('employee', 0), cleanId = historyId('employee', 1);
const response = () => ({ code: 200, status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; }, render(view, locals) { this.locals = locals; this.view = view; return this; } });
function method(name, next) {
    const start = source.indexOf(`    static ${name} = `), end = source.indexOf(`    static ${next}`, start);
    return source.slice(start, end).trim().replace(`static ${name} = `, '').replace(/;$/, '');
}
const helpers = source.slice(source.indexOf('function valueOrEmpty('), source.indexOf('// ✅ HELPERS: Εμπλουτισμός ιστορικού'));
function authenticatedRequest(body = {}) {
    return { params: { id: 'employee' }, session: { userId: 'authenticated-supervisor',
        userTeam: scope.team, companyInUse: scope.company_kod, yearInUse: 2026 }, body };
}
async function page(user = supervisor, initial = problemFixture()) {
    const captures = [];
    const query = value => ({ mongooseOptions(options) { assert.equal(options.includeRedundantHistoryArtifacts, true); return options; },
        sort() { return this; }, lean() { return this; }, exec: async () => value,
        then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); } });
    const context = { Date, console: { error() {} }, ...A, ...S, ...M, semanticHistoryRows,
        getEmployeeHistoryAccess: id => A.getEmployeeHistoryAccess(id, { userModel: userModel(user, c => captures.push(c)) }),
        identifyEmployeeHistoryProblemScope(args) {
            assert.equal(args.currentEmployee, initial.employee);
            assert.equal(args.completeHistoryRows, initial.history);
            assert.equal(args.completeHistoryRows.some(row => row.__lookups), false);
            assert.equal(JSON.stringify(args.scope), JSON.stringify(scope));
            return P.identifyEmployeeHistoryProblemScope(args);
        },
        CompaniesModel: { findById: () => query({}) }, ErgazomenoiModel: { findById: () => query(initial.employee) },
        IstorikoProslhpseonAllagonModel: { find(filter) { assert.equal(JSON.stringify(filter), JSON.stringify(scope)); return query(initial.history); } },
        PerifereiesModel: { find: () => query([]) }, GenikesParametroiModel: { find: () => query([]) },
        ProdhlomenaOrariaModel: { find: () => query([]) }, mongoose: { trusted: value => value },
        getEmploymentProfileUiContext: async () => ({}), buildEmployeeMaintenanceIdentity, dateKeyUtc,
        selectMaintenanceMode: W.selectMaintenanceMode,
        enrichIstorikoRowsForDetails: async rows => rows.map(row => ({ ...row, __lookups: { isProblematic: true } })) };
    const handler = vm.runInNewContext(`(${method('editErgazomenoiForm', 'getIstorikoData')})`, context);
    const res = response(); await handler(authenticatedRequest(), res, error => { throw error; });
    assert.equal(captures[0].id, 'authenticated-supervisor');
    return { res, html: ejs.render(partial, res.locals) };
}
function buttons(html, id, disabled) {
    const row = html.slice(html.indexOf(`data-id="${id}"`)).split('</tr>')[0];
    assert.ok(row.includes('data-record='), 'readable History data preserved');
    for (const action of ['add', 'edit', 'delete', 'undo']) {
        const button = row.match(new RegExp(`<button[^>]*data-action="${action}"[^>]*>`))?.[0];
        assert.ok(button, action); assert.equal(/disabled aria-disabled="true"/.test(button), disabled, action);
    }
}

test('Supervisor page recomputes from raw full History and enables only problematic persisted row', async () => {
    const { res, html } = await page();
    assert.equal(res.locals.employeeHistoryAccessMode, 'SUPERVISOR_PROBLEM_SCOPE');
    assert.equal(res.locals.canManageEmployeeHistory, false, 'broad Admin compatibility never expanded');
    assert.deepEqual(res.locals.problematicHistoryIds, [problemId]);
    buttons(html, problemId, false); buttons(html, cleanId, true);
    assert.equal(res.locals.employeeHistoryStateToken, S.buildEmployeeHistoryEditorStateToken({
        currentEmployee: problemFixture().employee, historyRows: problemFixture().history }));
});

test('Supervisor CLEAN page disables every persisted row action and Save', async () => {
    const { html, res } = await page(supervisor, fixture());
    assert.deepEqual(res.locals.problematicHistoryIds, []);
    for (const id of [problemId, cleanId, historyId('employee', 2)]) buttons(html, id, true);
    assert.match(html.slice(html.indexOf('id="updateIstorikoBtn"')).split('>')[0], /disabled aria-disabled="true"/);
});

test('Admin on identical problematic page retains all normal actions including clean rows', async () => {
    const { html, res } = await page({ privileges: 'A', situation: 'A', team: 'THA' });
    assert.equal(res.locals.employeeHistoryAccessMode, 'ADMIN_FULL');
    buttons(html, problemId, false); buttons(html, cleanId, false);
});

for (const user of [{ privileges: 'HR', situation: 'A', team: 'THA' },
    { privileges: 'S', situation: 'I', team: 'THA' }, { privileges: 'A', situation: 'A', team: 'BLG' }, null]) {
    test(`page ${JSON.stringify(user)} disables mutations while preserving readable rows`, async () => {
        const { html, res } = await page(user);
        assert.equal(res.locals.employeeHistoryAccessMode, 'NONE');
        buttons(html, problemId, true); buttons(html, cleanId, true);
    });
}

async function submit({ db = store([problemFixture()]), user = supervisor, updates = [], extra = {}, actorUser = user } = {}) {
    let calls = 0; const lookups = [], actors = [];
    const handler = vm.runInNewContext(`${helpers}\n(${method('updateIstorikoData', 'searchPostErgazomenoi')})`, {
        Date, console: { error() {} }, ...A, ...S, ...M, ...Terms, buildEmployeeMaintenanceIdentity,
        getEmployeeHistoryAccess: id => A.getEmployeeHistoryAccess(id, { userModel: userModel(user) }),
        ErgazomenoiModel: { findOne(filter) { lookups.push(filter);
            return { lean: async () => db.state().employees.find(row => Object.keys(filter).every(key => row[key] === filter[key])) || null }; } },
        writeEmployeeEmploymentHistoryOperations(args) { calls++;
            assert.equal(args.actorUserId, 'authenticated-supervisor');
            assert.equal(Object.hasOwn(args, 'accessMode'), false);
            assert.equal(Object.hasOwn(args, 'expectedProblematicHistoryIds'), false);
            return W.writeEmployeeEmploymentHistoryOperations({ ...args, ...db.deps, userModel: userModel(actorUser, c => actors.push(c)) }); }
    });
    const req = authenticatedRequest({ employeeId: 'employee', expectedStateToken: token(db), updates,
        role: 'ADMIN_FULL', privileges: 'A', team: 'THA', situation: 'A', employeeHistoryAccessMode: 'ADMIN_FULL',
        expectedProblematicHistoryIds: [cleanId], canManageHistory: true, ...extra });
    const res = response(), before = db.state(); await handler(req, res);
    return { res, calls, lookups, actors, db, before };
}

for (const state of ['modified', 'deleted']) test(`actual forged clean-row ${state} request rejects with typed 403 and zero committed changes`, async () => {
    const { res, db, before, lookups } = await submit({ updates: [{ state, _id: cleanId, problematic: true,
        data: { hmeromhnia_lhxhs_symbashs: '2026-11-30' } }] });
    assert.equal(res.code, 403); assert.equal(res.body.reason, 'EMPLOYEE_HISTORY_SUPERVISOR_SCOPE_FORBIDDEN');
    assert.deepEqual(db.state(), before);
    assert.equal(JSON.stringify(lookups[0]), JSON.stringify({ _id: 'employee', team: scope.team, company_kod: scope.company_kod }));
    assert.equal(JSON.stringify(res.body).includes(problemId), false);
    assert.match(res.body.message, /Δεν αποθηκεύτηκε καμία αλλαγή/);
    for (const n of ['1.', '2.', '3.']) assert.ok(res.body.message.includes(n));
    assert.ok(res.body.message.endsWith('EMPLOYEE_HISTORY_SUPERVISOR_SCOPE_FORBIDDEN'));
});

test('controller passes persisted Add anchor but server validates it inside transaction', async () => {
    const { res, actors, db } = await submit({ updates: [{ state: 'inserted', anchorHistoryId: problemId,
        data: { hmeromhnia_allaghs_orarioy_apo: '2026-04-01' } }] });
    assert.equal(res.code, 200); assert.equal(db.state().history.length, 4);
    assert.ok(actors[0].session);
});

test('Supervisor empty browser batch fails closed, including canonicalization path', async () => {
    const { res, db, before, calls } = await submit();
    assert.equal(res.code, 403); assert.equal(calls, 1); assert.deepEqual(db.state(), before);
});

test('NONE empty browser batch is rejected before writer despite forged Admin claims', async () => {
    const { res, calls, db, before } = await submit({ user: null });
    assert.equal(res.code, 403); assert.equal(calls, 0); assert.deepEqual(db.state(), before);
});

test('current-token problematic request still rejects if actor was deactivated after controller preflight', async () => {
    const { res, db, before, actors } = await submit({ actorUser: { ...supervisor, situation: 'I' },
        updates: [{ state: 'modified', _id: problemId, data: {} }] });
    assert.equal(res.code, 403); assert.equal(res.body.reason, 'EMPLOYEE_HISTORY_MANAGEMENT_FORBIDDEN');
    assert.ok(actors[0].session); assert.deepEqual(db.state(), before);
});

test('stale problematic page rejects with 409 before scope and preserves state after another writer fixes it', async () => {
    const db = store([problemFixture()]), expectedStateToken = token(db);
    await W.writeEmployeeEmploymentHistoryOperations({ ...db.deps, scope, employeeId: 'employee', operations: [] });
    const { res, before, actors } = await submit({ db, extra: { expectedStateToken },
        updates: [{ state: 'modified', _id: problemId, data: {} }] });
    assert.equal(res.code, 409); assert.equal(res.body.reason, 'EMPLOYEE_HISTORY_EDITOR_STALE');
    assert.deepEqual(db.state(), before); assert.equal(actors.length, 0);
});

test('foreign Employee ID remains outside the server-controlled session scope', async () => {
    const foreign = fixture('other', { ...scope, company_kod: 'foreign-company' });
    const db = store([problemFixture(), foreign]);
    const { res, calls, before } = await submit({ db, extra: { employeeId: 'other', companyInUse: 'foreign-company', userTeam: 'THA' } });
    assert.equal(res.code, 404); assert.equal(calls, 0); assert.deepEqual(db.state(), before);
});
