'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const W = require('./employeeEmploymentProfileWriter');
const { buildEmployeeHistoryEditorStateToken } = require('./employeeHistoryEditorStateService');
const { FIELD, scope, starts, historyId, deferred, fixture, store } =
    require('../../../test/fixtures/employeeProfileTransactionStore');

function snapshot(db, id = 'employee') {
    const state = db.state(), currentEmployee = state.employees.find(row => row._id === id);
    const historyRows = state.history.filter(row => ['team', 'company_kod', 'kodikos']
        .every(field => row[field] === currentEmployee[field]));
    return { currentEmployee, historyRows };
}
const token = (db, id) => buildEmployeeHistoryEditorStateToken(snapshot(db, id));
function update(index = 0, date = '2026-11-30', id = 'employee') {
    return { state: 'modified', historyId: historyId(id, index), effectiveFrom: starts[index],
        maintenance: { historyChanges: { hmeromhnia_lhxhs_symbashs: date },
            employeeChanges: { hmeromhnia_lhxhs_symbashs: date },
            submittedFields: ['hmeromhnia_lhxhs_symbashs'] } };
}
function save(db, expectedStateToken, operations = [update()], id = 'employee', extra = {}) {
    const current = snapshot(db, id).currentEmployee;
    return W.writeEmployeeEmploymentHistoryOperations({ ...db.deps,
        scope: Object.fromEntries(['team', 'company_kod', 'kodikos'].map(field => [field, current[field]])),
        employeeId: id, expectedStateToken, operations, ...extra });
}
const stale = error => {
    assert.equal(error.code, 'EMPLOYEE_HISTORY_EDITOR_STALE');
    assert.equal(error.statusCode, 409);
    assert.equal(error.message, 'EMPLOYEE_HISTORY_EDITOR_STALE');
    return true;
};

test('valid page token preserves normal mutation behavior and reload obtains the new token', async () => {
    const db = store(), expected = token(db), original = db.state();
    assert.equal((await save(db, expected)).success, true);
    assert.notEqual(token(db), expected);
    assert.equal(db.state().employees[0][FIELD], 1, 'nested planning reacquires no second fence');
    assert.equal(new Date(db.state().history.find(row => row._id === historyId('employee', 0))
        .hmeromhnia_lhxhs_symbashs).toISOString().slice(0, 10), '2026-11-30');
    assert.equal(db.state().history.length, original.history.length);
    assert.equal((await save(db, token(db), [update(1)])).success, true);
});

for (const [name, mutate] of [
    ['classic two-tab same-row change', (db, expected) => save(db, expected, [update(0, '2026-10-31')])],
    ['different History row change', (db, expected) => save(db, expected, [update(1)])],
    ['inserted History row', (db, expected) => save(db, expected, [{ state: 'inserted', effectiveFrom: '2026-04-01',
        maintenance: { historyChanges: {}, employeeChanges: {}, submittedFields: [] } }])],
    ['deleted History row', (db, expected) => save(db, expected, [{ state: 'deleted', historyId: historyId('employee', 1) }])],
    ['current Employee lifecycle change', db => W.writeEmployeeDeparture({ ...db.deps,
        scope, employeeId: 'employee', departureDate: '2026-06-30' })]
]) test(`${name}: old page is rejected with zero committed writes, including fence rollback`, async () => {
    const db = store(), a = token(db), b = token(db);
    assert.equal(a, b);
    await mutate(db, b);
    const committedB = db.state(), start = db.events.length;
    let references = 0, audits = 0;
    await assert.rejects(save(db, a, [update(0, '2026-09-30')], 'employee', {
        referenceChecker: async () => { references++; return []; },
        auditCollectionChecker: async () => { audits++; return true; }
    }), stale);
    assert.deepEqual(db.state(), committedB);
    assert.equal(references, 0); assert.equal(audits, 0);
    assert.deepEqual(db.events.slice(start).map(event => event.type), ['fence', 'read', 'read', 'end']);
    assert.equal(db.state().employees[0][FIELD], committedB.employees[0][FIELD]);
});

for (const expected of [undefined, null, '', {}, 'forged', 'f'.repeat(64)]) {
    test(`explicit ${JSON.stringify(expected)} expectation fails closed inside the transaction`, async () => {
        const db = store(), before = db.state();
        await assert.rejects(save(db, expected), stale);
        assert.deepEqual(db.state(), before);
        assert.deepEqual(db.events.map(event => event.type), ['fence', 'read', 'read', 'end']);
    });
}

test('fake browser sequence, current state, row snapshots and activeSession cannot bypass fresh comparison', async () => {
    const db = store(), old = token(db), oldSnapshot = snapshot(db);
    await save(db, old, [update(1)]);
    const before = db.state();
    await assert.rejects(save(db, old, [update()], 'employee', {
        employee_profile_mutation_sequence: 1, historyExpectedRevision: token(db),
        currentEmployee: oldSnapshot.currentEmployee, historyRows: oldSnapshot.historyRows,
        activeSession: { fake: true }
    }), stale);
    assert.deepEqual(db.state(), before);
});

test('trusted writer callers can omit the browser expectation; supplied undefined cannot bypass it', async () => {
    const db = store();
    assert.equal((await W.writeEmployeeEmploymentHistoryOperations({ ...db.deps,
        scope, employeeId: 'employee', operations: [update()] })).success, true);
    await assert.rejects(save(db, undefined, [update(1)]), stale);
});

test('fence increments alone do not invalidate the otherwise current business token', async () => {
    const db = store(), expected = token(db);
    await save(db, expected, []);
    assert.equal(db.state().employees[0][FIELD], 1);
    assert.equal(token(db), expected);
    assert.equal((await save(db, expected)).success, true);
});

test('another employee can commit without staling this page', async () => {
    const otherScope = { ...scope, kodikos: '0032' };
    const db = store([fixture(), fixture('other', otherScope)]), a = token(db);
    await save(db, token(db, 'other'), [update(1, '2026-10-31', 'other')], 'other');
    assert.equal(token(db), a);
    assert.equal((await save(db, a)).success, true);
});

test('comparison follows fresh fenced reads and precedes the first business write', async () => {
    const db = store();
    await save(db, token(db));
    assert.deepEqual(db.events.slice(0, 3).map(event => [event.type, event.kind]),
        [['fence', 'employees'], ['read', 'employees'], ['read', 'history']]);
    assert.ok(db.events.findIndex(event => event.type === 'write') > 2);
    // With the same valid operation, a wrong token stops at exactly these reads.
    const wrong = store();
    await assert.rejects(save(wrong, 'f'.repeat(64)), stale);
    assert.equal(wrong.events.some(event => event.type === 'write' || event.type === 'commit'), false);
});

test('controller preflight can match while a competing fenced writer commits; transactional retry rejects', async () => {
    const db = store(), expected = token(db);
    const held = deferred(), release = deferred(), conflicted = deferred(), committed = deferred();
    db.hooks.read = async (session, kind) => {
        if (session.id === 1 && kind === 'employees' && !session.held) {
            session.held = true; held.resolve(); await release.promise;
        }
    };
    db.hooks.retry = async session => {
        assert.equal(session.id, 2); conflicted.resolve(); await committed.promise;
    };
    const b = save(db, expected, [update(1)]);
    await held.promise;
    assert.equal(token(db), expected, 'outside-transaction preflight still matches');
    const a = save(db, expected, [update(0, '2026-09-30')]).then(
        () => { throw Error('obsolete page unexpectedly saved'); }, error => error);
    await conflicted.promise;
    assert.equal(db.events.some(event => event.session === 2 && event.type === 'read'), false);
    release.resolve(); await b;
    const stateAfterB = db.state(); committed.resolve();
    stale(await a);
    assert.deepEqual(db.state(), stateAfterB);
    assert.equal(db.state().employees[0][FIELD], 1, 'A retry fence increment rolled back');
    const commitB = db.events.findIndex(event => event.type === 'commit' && event.session === 1);
    assert.ok(db.events.findIndex(event => event.type === 'read' && event.session === 2) > commitB);
    const readsA = db.events.filter(event => event.type === 'read' && event.session === 2);
    assert.ok(readsA.every(event => event.attempt === 2));
    assert.notEqual(buildEmployeeHistoryEditorStateToken({
        currentEmployee: readsA.find(event => event.kind === 'employees').value,
        historyRows: readsA.find(event => event.kind === 'history').value
    }), expected);
    assert.equal(db.events.some(event => event.type === 'write' && event.session === 2), false);
});
