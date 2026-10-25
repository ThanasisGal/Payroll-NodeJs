'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { runEmployeeWorkWrite } = require('./employeeWorkWriteFenceService');
const W = require('./employeeEmploymentProfileWriter');
const { fixture, store, scope, starts, historyId, deferred, transient, FIELD } = require('../../../test/fixtures/employeeProfileTransactionStore');
const document = (date = '2026-01-01', employeeScope = scope) => ({ ...employeeScope, hmeromhnia: date });
// The synthetic transaction store persists work payloads in its generic audit
// document list. They obey the same commit/rollback as the Employee and History.
const write = (db, documents = [document()], extra = {}) => runEmployeeWorkWrite({
    ...db.deps, documents,
    work: async ({ session }) => db.deps.auditModel.create([{ kind: 'synthetic-work', documents }], { session }),
    ...extra
});
const historyChange = db => W.writeEmployeeEmploymentHistoryOperations({ ...db.deps,
    scope, employeeId: 'employee', operations: [{ state: 'modified', historyId: historyId('employee', 0), effectiveFrom: starts[0],
        maintenance: { historyChanges: { hmeromhnia_lhxhs_symbashs: '2026-11-30' },
            employeeChanges: { hmeromhnia_lhxhs_symbashs: '2026-11-30' }, submittedFields: ['hmeromhnia_lhxhs_symbashs'] } }] });

test('work uses the persisted History Employee fence before business reads and commits once', async () => {
    const db = store(), before = db.state();
    await write(db);
    assert.equal(db.state().employees[0][FIELD], 1);
    assert.deepEqual(db.state().history, before.history);
    assert.equal(db.state().audits.length, 1);
    const fence = db.events.findIndex(event => event.type === 'fence');
    assert.ok(db.events.findIndex(event => event.type === 'read' && event.kind === 'history') > fence);
    assert.equal(db.events.filter(event => event.type === 'commit').length, 1);
});

test('work before hire or after departure is refused with no persisted increment', async () => {
    for (const date of ['2025-12-31', '2026-07-01']) {
        const f = fixture();
        f.employee.hmeromhnia_apoxorhshs = '2026-06-30';
        const db = store([f]), before = db.state();
        await assert.rejects(write(db, [document(date)]), { code: 'EMPLOYEE_WORK_WRITE_OUTSIDE_EMPLOYMENT' });
        assert.deepEqual(db.state(), before);
    }
});

test('failure after work persistence rolls back work, Employee increment, History and audit', async () => {
    const db = store(), before = db.state();
    await assert.rejects(write(db, [document()], { work: async ({ session }) => {
        await db.deps.auditModel.create([{ kind: 'work' }], { session });
        await db.deps.historyModel.updateOne({ _id: historyId('employee', 0) }, { $set: { marker: 'attempt' } }, { session });
        throw Error('synthetic write failure');
    } }), /synthetic write failure/);
    assert.deepEqual(db.state(), before);
    assert.equal(db.events.some(event => event.type === 'commit'), false);
});

test('unavailable transactions block work before any business read or callback', async () => {
    const db = store(), before = db.state(); let called = false;
    await assert.rejects(write(db, [document()], { capabilityProbe: async () => false,
        work: async () => { called = true; } }), { code: 'EMPLOYEE_WORK_WRITE_PROTECTION_UNAVAILABLE' });
    assert.equal(called, false); assert.deepEqual(db.state(), before); assert.deepEqual(db.events, []);
});

test('retry rereads changed hire and refuses previously eligible work without preserving first-attempt writes', async () => {
    const db = store();
    db.hooks.beforeCommit = session => {
        if (session.attempt === 1) {
            db.changeCommittedEmployee('employee', { hmeromhnia_proslhpshs: '2026-01-02' });
            // Remove old evidence as an independently committed lifecycle change.
            for (const row of db.state().history) db.changeCommittedHistory(row._id, { hmeromhnia_proslhpshs: '2026-01-02' });
            throw transient();
        }
    };
    await assert.rejects(write(db), { code: 'EMPLOYEE_WORK_WRITE_OUTSIDE_EMPLOYMENT' });
    assert.equal(db.state().audits.length, 0);
    assert.equal(db.state().employees[0][FIELD], undefined);
    assert.equal(db.events.filter(event => event.type === 'fence').length, 2);
});

test('real History writer and work insertion contend on the same Employee before work business reads', async () => {
    const db = store(), held = deferred(), release = deferred(), conflict = deferred(), committed = deferred();
    db.hooks.read = async (session, kind) => {
        if (session.id === 1 && kind === 'employees' && !session.held) {
            session.held = true; held.resolve(); await release.promise;
        }
    };
    db.hooks.retry = async session => { assert.equal(session.id, 2); conflict.resolve(); await committed.promise; };
    const history = historyChange(db); await held.promise;
    const work = write(db); await conflict.promise;
    assert.equal(db.events.some(event => event.session === 2 && event.kind === 'history'), false);
    release.resolve(); await history; committed.resolve(); await work;
    const historyRead = db.events.find(event => event.session === 2 && event.kind === 'history');
    assert.equal(historyRead.attempt, 2);
    assert.equal(new Date(historyRead.value.find(row => row._id === historyId('employee', 0)).hmeromhnia_lhxhs_symbashs).toISOString().slice(0, 10), '2026-11-30');
    assert.equal(db.state().employees[0][FIELD], 2);
});

test('batch validation rejects missing scope and rolls back every employee when one date is outside employment', async () => {
    const other = { ...scope, kodikos: '0032' }, db = store([fixture(), fixture('other', other)]), before = db.state();
    await assert.rejects(write(db, [{ hmeromhnia: '2026-01-01' }]), { code: 'EMPLOYEE_WORK_WRITE_SCOPE_REQUIRED' });
    await assert.rejects(write(db, [document(), document('2025-12-31', other)]), { code: 'EMPLOYEE_WORK_WRITE_OUTSIDE_EMPLOYMENT' });
    assert.deepEqual(db.state(), before);
});

const controller = require('../../controllers/ergazomenoi/erganhController');
function importHarness() {
    const f = fixture(); Object.assign(f.employee, { afm: '123456789', ypokatasthma: '0000' });
    const db = store([f]), authorizedScope = { team: scope.team, company_kod: scope.company_kod, ypokatasthma: '0000' };
    const employeeModel = { ...db.deps.employeeModel, find: () => ({ lean: async () => [f.employee] }) };
    const rows = [], sessions = [];
    return { db, rows, sessions, dependencies: { authorizedScope, ergazomenoiModel: employeeModel,
        workWriteDependencies: { ...db.deps, employeeModel },
        argiesModel: { find: () => ({ lean: async () => [] }) },
        loadAppliedProtectionForRows: async () => ({ entriesByRowId: {}, diagnostics: [], hasConflicts: false }),
        prodhlomenaModel: { find: () => ({ select() { return this; }, lean: async () => [] }),
            bulkWrite: async (operations, { session }) => {
                assert.ok(session); sessions.push(session.id); rows.push(...operations);
                await db.deps.auditModel.create([{ kind: 'work-import', operations }], { session });
                return { upsertedCount: operations.length, modifiedCount: operations.length, matchedCount: operations.length };
            } }
    } };
}
const importRows = [{ rowNumber: 1, ypokatasthma: '0000', afm: '123456789', hmeromhnia_raw: '01/01/2026', apo_ora: '08:00', eos_ora: '16:00', h_check: 'Ok' }];
const sheet = { eachRow(fn) {
    const values = ['0000', '123456789', 'TEST', 'USER', '01/01/2026', 'ΕΡΓ', '08:00', '16:00'];
    fn({ getCell(number) { const value = values[number - 1]; return { value, text: value }; } }, 1);
} };
for (const kind of ['schedule', 'actual-work']) {
    const importWork = harness => kind === 'schedule'
        ? controller.__scheduleDownloadTestHooks.saveTelikoToProdhlomena(sheet, '2026', harness.dependencies.authorizedScope, harness.dependencies)
        : controller.__cardsDownloadTestHooks.saveKartesPayloadToMongo(importRows, harness.dependencies);
    test(`real ${kind} import uses shared fence and same-session persistence`, async () => {
        const h = importHarness(); await importWork(h);
        assert.equal(h.db.state().employees[0][FIELD], 1);
        assert.equal(h.db.state().audits.length, 1); assert.deepEqual(h.sessions, [1]);
    });
    test(`real ${kind} import refuses stale employee discovery after hire changes`, async () => {
        const h = importHarness(), before = h.db.state();
        h.db.changeCommittedEmployee('employee', { hmeromhnia_proslhpshs: '2026-01-02' });
        for (const row of before.history) h.db.changeCommittedHistory(row._id, { hmeromhnia_proslhpshs: '2026-01-02' });
        await assert.rejects(importWork(h), { code: 'EMPLOYEE_WORK_WRITE_OUTSIDE_EMPLOYMENT' });
        assert.equal(h.db.state().audits.length, 0); assert.deepEqual(h.rows, []);
    });
    test(`real ${kind} import never falls back to unfenced persistence`, async () => {
        const h = importHarness(), before = h.db.state();
        h.dependencies.workWriteDependencies.capabilityProbe = async () => false;
        await assert.rejects(importWork(h), { code: 'EMPLOYEE_WORK_WRITE_PROTECTION_UNAVAILABLE' });
        assert.deepEqual(h.db.state(), before); assert.deepEqual(h.rows, []);
    });
}

test('actual cycle gap cannot receive work and leaves both cycles unchanged', async () => {
    const f = fixture();
    f.history = [
        { ...f.history[0], hmeromhnia_apoxorhshs: '2026-01-31' },
        { ...f.history[2], hmeromhnia_proslhpshs: '2026-03-01' }
    ];
    f.employee.hmeromhnia_proslhpshs = '2026-03-01';
    const db = store([f]), before = db.state();
    await assert.rejects(write(db, [document('2026-02-15')]), { code: 'EMPLOYEE_WORK_WRITE_OUTSIDE_EMPLOYMENT' });
    assert.deepEqual(db.state(), before);
});

test('second schedule chunk failure rolls back the entire import including the successful first chunk', async () => {
    const h = importHarness(), before = h.db.state();
    let calls = 0;
    const originalWrite = h.dependencies.prodhlomenaModel.bulkWrite;
    h.dependencies.prodhlomenaModel.bulkWrite = async (...args) => {
        if (++calls === 2) throw Error('synthetic second chunk failure');
        return originalWrite(...args);
    };
    const largeSheet = { eachRow(fn) {
        for (let index = 0; index < 1001; index++) {
            const date = new Date(Date.UTC(2026, 0, 1 + index));
            const day = `${date.getUTCDate()}/${date.getUTCMonth() + 1}/${date.getUTCFullYear()}`;
            const values = ['0000', '123456789', 'TEST', 'USER', day, 'ΕΡΓ', '08:00', '16:00'];
            fn({ getCell(number) { const value = values[number - 1]; return { value, text: value }; } }, index + 1);
        }
    } };
    await assert.rejects(controller.__scheduleDownloadTestHooks.saveTelikoToProdhlomena(largeSheet, '2026', h.dependencies.authorizedScope, h.dependencies), /synthetic second chunk failure/);
    assert.equal(calls, 2);
    assert.deepEqual(h.db.state(), before);
});
