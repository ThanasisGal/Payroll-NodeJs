'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const W = require('./employeeEmploymentProfileWriter');
const S = require('./employeeHistoryEditorStateService');
const A = require('./employeeHistoryAuthorizationService');
const P = require('./employeeHistoryProblemScopeService');
const { FIELD, scope, historyId, fixture, store, deferred } = require('../../../test/fixtures/employeeProfileTransactionStore');
const { userModel, problemFixture, snapshot, token, problemScope, modify } = require('../../../test/fixtures/employeeHistorySupervisor');
const problemId = historyId('employee', 0), cleanId = historyId('employee', 1);
const insert = (anchorHistoryId = problemId) => ({ state: 'inserted', anchorHistoryId,
    effectiveFrom: '2026-04-01', maintenance: { historyChanges: {}, employeeChanges: {}, submittedFields: [] } });
function save(db, operations = [modify()], extra = {}, writer = W) {
    return writer.writeEmployeeEmploymentHistoryOperations({ ...db.deps, scope,
        employeeId: 'employee', expectedStateToken: token(db), actorUserId: 'authenticated-supervisor',
        userModel: userModel(), operations, ...extra });
}
const forbidden = error => {
    assert.equal(error.code, 'EMPLOYEE_HISTORY_SUPERVISOR_SCOPE_FORBIDDEN');
    assert.equal(error.statusCode, 403); return true;
};
function noBusinessChanges(db, before, start = 0) {
    assert.deepEqual(db.state(), before);
    assert.equal(db.events.slice(start).some(event => ['write', 'commit'].includes(event.type)), false);
    assert.equal(db.state().employees[0][FIELD], before.employees[0][FIELD]);
}

// Reimplemented archive tests using the current writer and transactional D0a/D0b fixtures.
test('currently problematic modification passes authorization and existing writer commits normally', async () => {
    const db = store([problemFixture()]);
    assert.deepEqual(problemScope(db).problematicHistoryIds, [problemId]);
    assert.equal((await save(db)).success, true);
    assert.equal(db.state().employees[0][FIELD], 1);
    assert.equal(new Date(db.state().history.find(row => row._id === problemId).hmeromhnia_lhxhs_symbashs)
        .toISOString().slice(0, 10), '2026-11-30');
});

test('problematic Delete passes authorization and remains subject to existing reference safety', async () => {
    const initial = fixture(); initial.history[1].hmeromhnia_isxyos_oron_ergasias_eos = null;
    const db = store([initial]), before = db.state(); let references = 0;
    await assert.rejects(save(db, [{ state: 'deleted', historyId: cleanId }], {
        referenceChecker: async () => { references++; return [{ historyId: cleanId, modelName: 'SyntheticReference' }]; }
    }), error => { assert.notEqual(error.code, 'EMPLOYEE_HISTORY_SUPERVISOR_SCOPE_FORBIDDEN');
        assert.match(error.code, /REFERENCE/); return true; });
    assert.ok(references > 0); assert.deepEqual(db.state(), before);
});

test('valid persisted problematic Add anchor reaches normal append and commits', async () => {
    const db = store([problemFixture()]);
    assert.equal((await save(db, [insert()])).success, true);
    assert.equal(db.state().history.length, 4);
    assert.equal(db.state().employees[0][FIELD], 1);
});

for (const [name, operation] of [
    ['modified clean row', modify(cleanId)],
    ['deleted clean row', { state: 'deleted', historyId: cleanId }],
    ['missing anchor', { ...insert(), anchorHistoryId: undefined }],
    ['clean persisted anchor', insert(cleanId)],
    ['nonexistent anchor', insert('nonexistent')],
    ['foreign anchor', insert(historyId('other', 0))],
    ['anchor object', insert({ $ne: null })],
    ['new unsaved row as anchor', insert('new-unsaved-id')],
    ['foreign target', modify(historyId('other', 0))],
    ['browser problematic flag', { ...modify(cleanId), problematic: true, isProblematic: true }],
    ['browser actor claims', { ...modify(cleanId), role: 'ADMIN_FULL', privileges: 'A', team: 'THA', situation: 'A', authorized: true }]
]) test(`${name} is forbidden before business, audit or reference writes; fence rolls back`, async () => {
    const db = store([problemFixture(), problemFixture('other', { ...scope, kodikos: '0032' })]);
    const before = db.state(); let references = 0, audits = 0;
    await assert.rejects(save(db, [operation], { referenceChecker: async () => { references++; return []; },
        auditCollectionChecker: async () => { audits++; return true; } }), forbidden);
    noBusinessChanges(db, before); assert.equal(references, 0); assert.equal(audits, 0);
    assert.deepEqual(db.events.map(event => event.type), ['fence', 'read', 'read', 'end']);
});

test('CLEAN scope cannot grant Supervisor edits, deletes or Add', async () => {
    for (const operations of [[modify()], [{ state: 'deleted', historyId: problemId }], [insert()]]) {
        const db = store(), before = db.state();
        assert.equal(problemScope(db).overallStatus, 'CLEAN');
        await assert.rejects(save(db, operations), forbidden); noBusinessChanges(db, before);
    }
});

test('unresolved problem scope fails closed without affecting full Admin gate', async () => {
    const initial = problemFixture(); initial.employee.hmeromhnia_proslhpshs = '2025-01-01';
    const db = store([initial]), before = db.state();
    assert.equal(problemScope(db).deterministicallyResolved, false);
    await assert.rejects(save(db), forbidden); noBusinessChanges(db, before);
    await assert.rejects(save(db, [modify()], { userModel: userModel({ privileges: 'A', team: 'THA', situation: 'A' }) }),
        error => { assert.equal(error.code, 'EMPLOYEE_HISTORY_MANUAL_REVIEW_REQUIRED'); return true; });
});

test('empty Supervisor batch cannot canonicalize or renumber, even with a current token', async () => {
    const initial = problemFixture(); initial.history[0].aa_eggrafhs = '0009';
    const db = store([initial]), before = db.state();
    await assert.rejects(save(db, []), forbidden); noBusinessChanges(db, before);
});

test('Admin empty batch retains existing canonicalization and full clean-row access', async () => {
    const admin = { userModel: userModel({ privileges: 'A', team: 'THA', situation: 'A' }) };
    const db = store([problemFixture()]);
    assert.equal((await save(db, [], admin)).success, true);
    assert.equal(problemScope(db).overallStatus, 'CLEAN');
    assert.equal((await save(db, [modify(cleanId)], admin)).success, true);
    assert.equal((await save(db, [insert(null)], admin)).success, true);
});

for (const user of [null, { privileges: 'S', team: 'THA', situation: 'I' },
    { privileges: 'A', team: 'BLG', situation: 'A' }, { privileges: 'HR', team: 'THA', situation: 'A' }]) {
    test(`fresh transaction actor ${JSON.stringify(user)} rejects forged Admin mode`, async () => {
        const db = store([problemFixture()]), before = db.state();
        await assert.rejects(save(db, [modify()], { userModel: userModel(user),
            accessMode: 'ADMIN_FULL', employeeHistoryAccessMode: 'ADMIN_FULL', canManageEmployeeHistory: true }),
            error => error.code === 'EMPLOYEE_HISTORY_MANAGEMENT_FORBIDDEN' && error.statusCode === 403);
        noBusinessChanges(db, before);
    });
}

test('mixed all-authorized modify/delete/insert batch proceeds to existing business validation', async () => {
    const initial = problemFixture(); initial.history[1].hmeromhnia_isxyos_oron_ergasias_eos = null;
    const db = store([initial]);
    assert.deepEqual(problemScope(db).problematicHistoryIds, [problemId, cleanId]);
    const explicit = modify();
    explicit.maintenance.historyChanges.hmeromhnia_isxyos_oron_ergasias_eos = '2026-01-31';
    explicit.maintenance.submittedFields.push('hmeromhnia_isxyos_oron_ergasias_eos');
    assert.equal((await save(db, [explicit, { state: 'deleted', historyId: cleanId }, insert()])).success, true);
});

test('one unauthorized operation rejects the entire mixed batch before any writes', async () => {
    const db = store([problemFixture()]), before = db.state();
    await assert.rejects(save(db, [modify(), insert(), { state: 'deleted', historyId: cleanId }]), forbidden);
    noBusinessChanges(db, before);
});

test('duplicate persisted operation IDs cannot escape the exact identity checks', async () => {
    const db = store([problemFixture()]), before = db.state();
    await assert.rejects(save(db, [modify(), { state: 'deleted', historyId: problemId }]),
        error => error.code === 'INVALID_EMPLOYMENT_PROFILE');
    noBusinessChanges(db, before);
});

test('page-load problematic IDs and caller snapshots cannot authorize a clean current target', async () => {
    const db = store([problemFixture()]), pageIds = problemScope(db).problematicHistoryIds;
    await W.writeEmployeeEmploymentHistoryOperations({ ...db.deps, scope, employeeId: 'employee', operations: [] });
    const before = db.state(), start = db.events.length;
    assert.equal(problemScope(db).overallStatus, 'CLEAN');
    await assert.rejects(save(db, [modify()], { expectedProblematicHistoryIds: pageIds,
        problematicHistoryIds: pageIds, currentEmployee: problemFixture().employee,
        originalHistoryRows: problemFixture().history }), forbidden);
    noBusinessChanges(db, before, start);
});

function instrumentedWriter(db, calls) {
    const filename = require.resolve('./employeeEmploymentProfileWriter'), R = createRequire(filename);
    const module = { exports: {} };
    const load = vm.runInThisContext('(function(require, module, exports) {\n' +
        fs.readFileSync(filename, 'utf8') + '\n})', { filename });
    load(name => {
            if (name === './employeeHistoryEditorStateService') return { ...S,
                assertEmployeeHistoryEditorState(args) { calls.push('token'); return S.assertEmployeeHistoryEditorState(args); } };
            if (name === './employeeHistoryProblemScopeService') return { ...P,
                identifyEmployeeHistoryProblemScope(args) {
                    calls.push('problem-scope');
                    const reads = db.events.filter(event => event.type === 'read');
                    const { [FIELD]: ignored, ...readEmployee } = reads[0].value;
                    assert.deepEqual(JSON.parse(JSON.stringify(args.currentEmployee)), JSON.parse(JSON.stringify(readEmployee)));
                    assert.deepEqual(JSON.parse(JSON.stringify(args.completeHistoryRows)), JSON.parse(JSON.stringify(reads[1].value)));
                    assert.deepEqual(JSON.parse(JSON.stringify(args.scope)), scope);
                    assert.ok(!args.completeHistoryRows.some(row => row.__lookups));
                    return P.identifyEmployeeHistoryProblemScope(args);
                } };
            return R(name);
        }, module, module.exports);
    return module.exports;
}

test('deterministic transaction order is fence -> same fresh reads -> token -> actor -> scope -> business', async () => {
    const db = store([problemFixture()]), calls = [];
    const fence = db.deps.employeeModel.updateOne;
    db.deps.employeeModel.updateOne = async (...args) => { calls.push(args[1].$inc?.[FIELD] ? 'fence' : 'business'); return fence(...args); };
    db.hooks.read = async (session, kind) => calls.push(`read-${kind}`);
    const write = db.deps.historyModel.updateOne;
    db.deps.historyModel.updateOne = async (...args) => { calls.push('business'); return write(...args); };
    await save(db, [modify()], { userModel: userModel(undefined, capture => {
        assert.ok(capture.session); calls.push('actor');
    }) }, instrumentedWriter(db, calls));
    assert.deepEqual(calls.slice(0, 6), ['fence', 'read-employees', 'read-history', 'token', 'actor', 'problem-scope']);
    assert.ok(calls.indexOf('business') > 5);
});

test('fixed problematic row rejects obsolete token with 409 before fresh authorization; fence rolls back', async () => {
    const db = store([problemFixture()]), expected = token(db), calls = [];
    await W.writeEmployeeEmploymentHistoryOperations({ ...db.deps, scope, employeeId: 'employee', operations: [] });
    const before = db.state(), start = db.events.length;
    assert.equal(problemScope(db).overallStatus, 'CLEAN');
    await assert.rejects(save(db, [modify()], { expectedStateToken: expected }, instrumentedWriter(db, calls)),
        error => error.code === 'EMPLOYEE_HISTORY_EDITOR_STALE' && error.statusCode === 409);
    assert.deepEqual(calls, ['token']); noBusinessChanges(db, before, start);
});

test('another employee commit neither stales this Supervisor nor changes row scope', async () => {
    const otherScope = { ...scope, kodikos: '0032' };
    const db = store([problemFixture(), fixture('other', otherScope)]), expected = token(db), beforeScope = problemScope(db);
    await W.writeEmployeeEmploymentHistoryOperations({ ...db.deps, scope: otherScope, employeeId: 'other',
        operations: [modify(historyId('other', 1))] });
    assert.equal(token(db), expected); assert.deepEqual(problemScope(db), beforeScope);
    assert.equal((await save(db, [modify()], { expectedStateToken: expected })).success, true);
});

test('competing repair commits behind a Promise barrier; retry rereads and stale check precedes authorization', async () => {
    const db = store([problemFixture()]), expected = token(db);
    const held = deferred(), release = deferred(), conflict = deferred(), committed = deferred();
    db.hooks.read = async (session, kind) => {
        if (session.id === 1 && kind === 'employees' && !session.held) {
            session.held = true; held.resolve(); await release.promise;
        }
    };
    db.hooks.retry = async () => { conflict.resolve(); await committed.promise; };
    const repair = W.writeEmployeeEmploymentHistoryOperations({ ...db.deps, scope, employeeId: 'employee', operations: [] });
    await held.promise;
    const pending = save(db, [modify()], { expectedStateToken: expected }).catch(error => error);
    await conflict.promise; release.resolve(); await repair;
    const after = db.state(); committed.resolve();
    assert.equal((await pending).code, 'EMPLOYEE_HISTORY_EDITOR_STALE');
    assert.deepEqual(db.state(), after); assert.equal(after.employees[0][FIELD], 1);
    assert.equal(db.events.some(event => event.session === 2 && event.type === 'write'), false);
    assert.ok(db.events.filter(event => event.session === 2 && event.type === 'read').every(event => event.attempt === 2));
});
