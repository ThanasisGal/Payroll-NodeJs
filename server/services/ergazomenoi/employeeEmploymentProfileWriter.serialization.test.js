'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const mongoose = require('mongoose');
const W = require('./employeeEmploymentProfileWriter');
const { ErgazomenoiModel, IstorikoProslhpseonAllagonModel } = require('../../models/ergazomenoi');
const { buildCompleteProfileSnapshot } = require('../../utils/ergazomenoi/employmentProfileHistory');
const { canonicalizeEmployeeHistory } = require('./employeeHistoryCanonicalizationService');
const FIELD = 'employee_profile_mutation_sequence';
const scope = { team: 'TEST', company_kod: 'company', kodikos: '0031' };
const starts = ['2026-01-01', '2026-02-01', '2026-03-01'];
const clone = structuredClone;
const historyId = (id, index) => `507f1f77bcf86cd799439${id === 'employee' ? '1' : '2'}${String(index).padStart(2, '0')}`;
function deferred() {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return { promise, resolve };
}
function fixture(id = 'employee', employeeScope = scope) {
    const history = starts.map((from, index) => ({
        ...buildCompleteProfileSnapshot({ effectiveFrom: from }), ...employeeScope,
        _id: historyId(id, index), aa_eggrafhs: String(index + 1).padStart(4, '0'),
        hmeromhnia_proslhpshs: starts[0], hmeromhnia_apoxorhshs: null,
        afora_proslhpsh: index === 0,
        hmeromhnia_isxyos_oron_ergasias_eos: ['2026-01-31', '2026-02-28', null][index],
        hmeromhnia_lhxhs_symbashs: '2026-12-31',
        createdAt: new Date(from), updatedAt: new Date(from)
    }));
    const employee = { ...history[2], _id: id, energos: true };
    assert.equal(canonicalizeEmployeeHistory({ scope: employeeScope,
        currentEmployee: employee, historyRows: history }).status, 'CLEAN');
    return { employee, history };
}
function transient() {
    const error = new mongoose.mongo.MongoServerError({ message: 'synthetic WriteConflict', code: 112 });
    error.addErrorLabel('TransientTransactionError');
    return error;
}
// Test-only snapshot isolation model. Document owners simulate Mongo contention;
// production owns no JS locks. Commits apply document deltas and check versions,
// rather than replacing the store and losing concurrent unrelated commits.
function store(fixtures = [fixture()]) {
    let committed = { employees: fixtures.map(f => clone(f.employee)),
        history: fixtures.flatMap(f => clone(f.history)), audits: [] };
    let nextSession = 0;
    const versions = new Map(), owners = new Map(), events = [], hooks = {};
    const matches = (row, filter) => row && Object.entries(filter).every(([field, expected]) =>
        expected && typeof expected === 'object' && !(expected instanceof Date) && expected.$in
            ? expected.$in.map(String).includes(String(row[field]))
            : expected instanceof Date ? new Date(row[field]).getTime() === expected.getTime()
            : expected == null ? row[field] == null : String(row[field]) === String(expected));
    const keyFor = (kind, id) => `${kind}:${id}`;
    function rowFor(state, key) {
        const [kind, ...id] = key.split(':');
        return state[kind].find(row => String(row._id) === id.join(':'));
    }
    function claim(session, kind, id) {
        const key = keyFor(kind, id), owner = owners.get(key);
        if ((owner && owner !== session) ||
            (versions.get(key) || 0) !== (session.versions.get(key) || 0)) throw transient();
        owners.set(key, session); session.touched.add(key);
    }
    function release(session) {
        for (const [key, owner] of owners) if (owner === session) owners.delete(key);
    }
    const connection = { async startSession() {
        const session = { id: ++nextSession, attempt: 0,
            async withTransaction(work) {
                for (;;) {
                    assert.ok(++session.attempt <= 4, 'bounded deterministic retry');
                    session.draft = clone(committed); session.versions = new Map(versions);
                    session.auditStart = session.draft.audits.length;
                    session.touched = new Set();
                    try {
                        await work();
                        await hooks.beforeCommit?.(session);
                        for (const key of session.touched) {
                            if ((versions.get(key) || 0) !== (session.versions.get(key) || 0)) throw transient();
                        }
                        for (const key of session.touched) {
                            const kind = key.split(':')[0], row = rowFor(session.draft, key);
                            const index = committed[kind].findIndex(item => keyFor(kind, item._id) === key);
                            if (index >= 0) committed[kind].splice(index, 1);
                            if (row) committed[kind].push(clone(row));
                            versions.set(key, (versions.get(key) || 0) + 1);
                        }
                        committed.audits.push(...clone(session.draft.audits.slice(session.auditStart)));
                        events.push({ type: 'commit', session: session.id, attempt: session.attempt });
                        return;
                    } catch (error) {
                        if (!error.hasErrorLabel?.('TransientTransactionError')) throw error;
                        events.push({ type: 'retry', session: session.id, attempt: session.attempt });
                        release(session);
                        await hooks.retry?.(session);
                    } finally { release(session); }
                }
            }, async endSession() { events.push({ type: 'end', session: session.id }); }
        };
        return session;
    } };
    function query(kind, filter) {
        return { mongooseOptions() { return this; }, select(value) { this.projection = value; return this; },
            session(value) { this.s = value; return this; }, async lean() {
                const rows = this.s.draft[kind].filter(row => matches(row, filter));
                const value = kind === 'employees' ? rows[0] || null : rows;
                events.push({ type: 'read', kind, session: this.s.id, attempt: this.s.attempt,
                    value: clone(value), projection: this.projection });
                await hooks.read?.(this.s, kind);
                if (kind === 'employees' && value) {
                    if (this.projection === '_id') return { _id: value._id };
                    const { [FIELD]: ignored, ...businessState } = value;
                    return clone(businessState);
                }
                return clone(value);
            }
        };
    }
    function updateOne(kind) {
        return async (filter, update, { session, timestamps }) => {
            const row = session.draft[kind].find(item => matches(item, filter));
            if (!row) return { matchedCount: 0 };
            if (kind === 'employees' && update.$inc?.[FIELD]) {
                assert.equal(timestamps, false);
                assert.deepEqual(Object.keys(filter).sort(), ['_id', 'company_kod', 'kodikos', 'team']);
                assert.deepEqual(update, { $inc: { [FIELD]: 1 } });
            }
            claim(session, kind, row._id);
            if (update.$set) Object.assign(row, clone(update.$set));
            for (const [field, increment] of Object.entries(update.$inc || {})) row[field] = (row[field] || 0) + increment;
            events.push({ type: update.$inc?.[FIELD] ? 'fence' : 'write', kind,
                session: session.id, attempt: session.attempt, id: row._id });
            return { matchedCount: 1 };
        };
    }
    const employeeModel = { findOne: filter => query('employees', filter), updateOne: updateOne('employees'),
        async create([row], { session }) {
            const created = { ...clone(row), _id: row._id || 'new-employee' };
            claim(session, 'employees', created._id); session.draft.employees.push(created); return [created];
        }, async deleteOne(filter, { session }) {
            const row = session.draft.employees.find(item => matches(item, filter));
            if (!row) return { deletedCount: 0 };
            claim(session, 'employees', row._id);
            session.draft.employees = session.draft.employees.filter(item => item !== row);
            return { deletedCount: 1 };
        } };
    const historyModel = { find: filter => query('history', filter), updateOne: updateOne('history'),
        async updateMany(filter, update, options) {
            const rows = options.session.draft.history.filter(row => matches(row, filter));
            for (const row of rows) await historyModel.updateOne({ _id: row._id }, update, options);
            return { matchedCount: rows.length };
        }, async deleteMany(filter, { session }) {
            const rows = session.draft.history.filter(row => matches(row, filter));
            for (const row of rows) claim(session, 'history', row._id);
            session.draft.history = session.draft.history.filter(row => !rows.includes(row));
            return { deletedCount: rows.length };
        }, async create([row], { session }) {
            const created = clone(row);
            claim(session, 'history', created._id); session.draft.history.push(created); return [created];
        } };
    const auditModel = { async create([row], { session }) {
        session.draft.audits.push(clone(row)); return [row];
    } };
    return { deps: { connection, employeeModel, historyModel, auditModel,
        capabilityProbe: async () => true, referenceChecker: async () => [],
        auditCollectionChecker: async () => true }, events, hooks, state: () => clone(committed),
        changeCommittedEmployee(id, patch) {
            Object.assign(committed.employees.find(row => row._id === id), clone(patch));
            const key = keyFor('employees', id); versions.set(key, (versions.get(key) || 0) + 1);
        },
        changeCommittedHistory(id, patch) {
            Object.assign(committed.history.find(row => row._id === id), clone(patch));
            const key = keyFor('history', id); versions.set(key, (versions.get(key) || 0) + 1);
        } };
}
function update(index = 0, date = '2026-11-30', id = 'employee') {
    return { state: 'modified', historyId: historyId(id, index), effectiveFrom: starts[index],
        maintenance: { historyChanges: { hmeromhnia_lhxhs_symbashs: date },
            employeeChanges: { hmeromhnia_lhxhs_symbashs: date },
            submittedFields: ['hmeromhnia_lhxhs_symbashs'] } };
}
const generic = (db, operations, id = 'employee', employeeScope = scope) =>
    W.writeEmployeeEmploymentHistoryOperations({ ...db.deps, scope: employeeScope, employeeId: id, operations });
async function interleave(db, first, second) {
    const held = deferred(), release = deferred(), conflicted = deferred(), firstCommitted = deferred();
    db.hooks.read = async (session, kind) => {
        if (session.id === 1 && kind === 'employees' && !session.held) {
            session.held = true; held.resolve(); await release.promise;
        }
    };
    db.hooks.retry = async session => { assert.equal(session.id, 2); conflicted.resolve(); await firstCommitted.promise; };
    const a = first(); await held.promise;
    const b = second(); await conflicted.promise;
    assert.equal(db.events.filter(e => e.type === 'read' && e.session === 2).length, 0,
        'competing transaction must conflict at Employee before business reads');
    release.resolve(); const resultA = await a; firstCommitted.resolve(); const resultB = await b;
    const readsB = db.events.filter(e => e.type === 'read' && e.session === 2);
    assert.ok(readsB.length); assert.ok(readsB.every(e => e.attempt === 2));
    const commitA = db.events.findIndex(e => e.type === 'commit' && e.session === 1);
    assert.ok(db.events.findIndex(e => e.type === 'read' && e.session === 2) > commitA);
    assert.equal(db.state().employees[0][FIELD], 2);
    return { resultA, resultB, readsB };
}

for (const [name, firstOperations] of [
    ['different history rows', [update(1)]],
    ['same history row', [update(0)]],
    ['insert versus update', [{ state: 'inserted', effectiveFrom: '2026-04-01',
        maintenance: { historyChanges: {}, employeeChanges: {}, submittedFields: [] } }]],
    ['delete versus update', [{ state: 'deleted', historyId: historyId('employee', 1) }]]
]) test(`same employee: ${name} conflicts before reads and retries from committed state`, async () => {
    const db = store();
    const { readsB } = await interleave(db, () => generic(db, firstOperations),
        () => generic(db, [update(0, '2026-10-31')]));
    const readHistory = readsB.find(e => e.kind === 'history').value;
    if (name === 'different history rows') assert.equal(new Date(readHistory.find(r =>
        r._id === historyId('employee', 1)).hmeromhnia_lhxhs_symbashs).toISOString().slice(0, 10), '2026-11-30');
    if (name === 'same history row') assert.equal(new Date(readHistory.find(r =>
        r._id === historyId('employee', 0)).hmeromhnia_lhxhs_symbashs).toISOString().slice(0, 10), '2026-11-30');
    if (name === 'insert versus update') assert.equal(readHistory.length, 4);
    if (name === 'delete versus update') assert.equal(readHistory.some(r => r._id === historyId('employee', 1)), false);
});

test('controlled departure and generic history share the same Employee fence', async () => {
    const db = store();
    const { readsB } = await interleave(db, () => W.writeEmployeeDeparture({ ...db.deps,
        scope, employeeId: 'employee', departureDate: '2026-06-30' }),
    () => generic(db, [update()]));
    assert.equal(readsB.find(e => e.kind === 'employees').value.energos, false);
});

test('guided/unique-safe outer save and nested profile acquire only once, and contend with generic history', async () => {
    const db = store();
    assert.equal(W.writeEmployeeEmploymentProfileWithUniqueSafeRepair,
        W.writeEmployeeEmploymentProfileWithGuidedResolution);
    await interleave(db, () => W.writeEmployeeEmploymentProfileWithUniqueSafeRepair({ ...db.deps,
        scope, employeeId: 'employee', mode: W.MODE_CORRECT_EXISTING,
        historyId: historyId('employee', 1), effectiveFrom: starts[1], maintenance: update(1).maintenance }),
    () => generic(db, [update()]));
    assert.equal(db.events.filter(e => e.type === 'fence' && e.session === 1).length, 1);
});

test('different employees commit independently while the first transaction remains held', async () => {
    const otherScope = { ...scope, kodikos: '0032' }, db = store([fixture(), fixture('other', otherScope)]);
    const held = deferred(), release = deferred();
    db.hooks.read = async (session, kind) => {
        if (session.id === 1 && kind === 'employees' && !session.held) {
            session.held = true; held.resolve(); await release.promise;
        }
    };
    const a = generic(db, [update()]); await held.promise;
    await generic(db, [update(0, '2026-10-31', 'other')], 'other', otherScope);
    assert.ok(db.events.some(e => e.type === 'commit' && e.session === 2));
    assert.equal(db.events.some(e => e.type === 'commit' && e.session === 1), false);
    assert.equal(db.events.some(e => e.type === 'retry'), false);
    release.resolve(); await a;
    assert.ok(db.state().employees.every(row => row[FIELD] === 1));
});

test('failed business mutation rolls back fence, current, history and audit', async () => {
    const db = store(), before = db.state();
    await assert.rejects(generic(db, [{ state: 'deleted', historyId: 'unknown' }]));
    assert.deepEqual(db.state(), before);
    assert.equal(db.events.filter(e => e.type === 'fence').length, 1);
    assert.equal(db.events.some(e => e.type === 'commit'), false);
});

test('driver-style callback retry reacquires, rereads and replans a mixed batch, with one committed audit', async () => {
    const db = store();
    db.hooks.beforeCommit = session => {
        if (session.attempt === 1) {
            db.changeCommittedHistory(historyId('employee', 0), { hmeromhnia_lhxhs_symbashs: '2026-09-30' });
            throw transient();
        }
    };
    await generic(db, [{ state: 'deleted', historyId: historyId('employee', 1) },
        update(2, '2026-10-31')]);
    assert.equal(db.events.filter(e => e.type === 'fence').length, 2);
    assert.equal(db.events.filter(e => e.type === 'commit').length, 1);
    assert.equal(db.state().employees[0][FIELD], 1);
    assert.equal(db.state().audits.length, 1);
    const retained = db.state().history.find(row => row._id === historyId('employee', 0));
    assert.equal(new Date(retained.hmeromhnia_lhxhs_symbashs).toISOString().slice(0, 10), '2026-09-30');
    assert.equal(db.events.filter(e => e.type === 'fence' && e.attempt === 2).length, 1,
        'nested writes share the reacquired outer fence');
});

test('a generic nested mixed batch acquires once and metadata never becomes business/history state', async () => {
    const db = store(), initialCurrent = db.state().employees[0];
    await generic(db, [update(), update(1)]);
    assert.equal(db.events.filter(e => e.type === 'fence').length, 1);
    const { [FIELD]: sequence, ...businessCurrent } = db.state().employees[0];
    assert.equal(sequence, 1); assert.deepEqual(businessCurrent, initialCurrent);
    assert.ok(db.state().history.every(row => !Object.hasOwn(row, FIELD)));
    assert.equal(db.state().audits.length, 0);
});

test('exact scope mismatch cannot acquire or expose foreign employee state', async () => {
    const db = store(), before = db.state();
    await assert.rejects(generic(db, [update()], 'employee', { ...scope, team: 'foreign' }),
        error => error.code === 'EMPLOYEE_PROFILE_NOT_FOUND');
    assert.deepEqual(db.state(), before);
    assert.equal(db.events.some(e => ['read', 'fence', 'commit'].includes(e.type)), false);
});

test('existing no-op repair advances only hidden metadata; initial create needs no existing fence', async () => {
    const db = store(), before = db.state().employees[0];
    const result = await W.repairEmployeeHistoryCanonical({ ...db.deps, scope, employeeId: 'employee' });
    assert.equal(result.changed, false);
    const { [FIELD]: sequence, ...business } = db.state().employees[0];
    assert.equal(sequence, 1); assert.deepEqual(business, before);
    assert.equal(db.state().audits.length, 0);
    const fresh = store([]);
    await W.writeEmployeeEmploymentProfile({ ...fresh.deps, scope,
        newEmployee: { _id: 'new-employee', hmeromhnia_proslhpshs: starts[0] }, effectiveFrom: starts[0] });
    assert.equal(fresh.events.some(e => e.type === 'fence'), false);
    assert.equal(Object.hasOwn(fresh.state().employees[0], FIELD), false);
});

test('optional schema metadata is excluded from selection/defaults and History snapshots', () => {
    assert.equal(ErgazomenoiModel.schema.path(FIELD).options.select, false);
    assert.equal(Object.hasOwn(new ErgazomenoiModel({}).toObject(), FIELD), false);
    assert.equal(IstorikoProslhpseonAllagonModel.schema.path(FIELD), undefined);
    assert.equal(Object.hasOwn(buildCompleteProfileSnapshot({ current: { [FIELD]: 12 },
        effectiveFrom: starts[0] }), FIELD), false);
    const id = new mongoose.Types.ObjectId();
    const q = ErgazomenoiModel.updateOne({ ...scope, _id: id }, { $inc: { [FIELD]: 1 } }, { timestamps: false });
    assert.deepEqual(q._castUpdate(q.getUpdate()), { $inc: { [FIELD]: 1 } });
    assert.equal(q._mongooseOptions.timestamps, false);
});

for (const [name, options] of [
    ['writeEmployeeEmploymentProfile', { effectiveFrom: '2026-04-01' }],
    ['writeEmployeeEmploymentProfileWithGuidedResolution', { effectiveFrom: '2026-04-01' }],
    ['writeEmployeeEmploymentProfileWithUniqueSafeRepair', { effectiveFrom: '2026-04-01' }],
    ['writeEmployeeDeparture', { departureDate: '2026-06-30' }],
    ['writeEmployeeDepartureDateCorrection', { requestedDepartureDate: '2026-06-30' }],
    ['writeEmployeeDepartureCancellation', {}],
    ['writeEmployeeInvalidDepartureCorrection', {}],
    ['writeEmployeeRehire', { rehireDate: '2026-06-30' }],
    ['writeEmployeeEmploymentHistoryOperations', { operations: [update()] }],
    ['deleteEmployeeAndEmploymentHistory', {}],
    ['repairEmployeeHistoryCanonical', {}],
    ['repairEmployeeLegacyOpenCycles', {}]
]) test(`${name}: acquires exactly one scoped fence before its first business read`, async () => {
    const db = store();
    // Some controlled requests intentionally fail their existing business policy
    // on this clean active fixture. Their fence still precedes validation reads.
    try { await W[name]({ ...db.deps, scope, employeeId: 'employee', ...options }); }
    catch (error) { assert.ok(error.code, 'only an existing typed policy rejection is permitted'); }
    const fences = db.events.filter(e => e.type === 'fence');
    assert.equal(fences.length, 1);
    assert.equal(fences[0].id, 'employee');
    assert.equal(db.events[0].type, 'fence');
    assert.ok(db.events.some(e => e.type === 'read'));
});

test('caller-supplied sequence cannot replace metadata or enter History', async () => {
    const db = store(), operation = update();
    operation.maintenance.historyChanges[FIELD] = 999;
    operation.maintenance.employeeChanges[FIELD] = 999;
    await generic(db, [operation]);
    assert.equal(db.state().employees[0][FIELD], 1);
    assert.ok(db.state().history.every(row => !Object.hasOwn(row, FIELD)));
});

test('legacy internal id-less caller resolves identity only, then fences and reads that exact employee', async () => {
    const db = store();
    await W.writeEmployeeEmploymentProfile({ ...db.deps, scope, effectiveFrom: '2026-04-01' });
    assert.equal(db.events[0].type, 'read');
    assert.equal(db.events[0].projection, '_id');
    assert.equal(db.events[1].type, 'fence');
    assert.equal(db.events[1].id, 'employee');
    assert.equal(db.state().employees[0][FIELD], 1);
});

test('one active session cannot inherit a different employee fence', async () => {
    // Expose only private session hooks in a separately compiled test module.
    // No production export or request option gains access to ACTIVE_SESSION.
    const fs = require('node:fs'), Module = require('node:module');
    const filename = require.resolve('./employeeEmploymentProfileWriter');
    const instrumented = new Module(filename, module);
    instrumented.filename = filename; instrumented.paths = module.paths;
    instrumented._compile(fs.readFileSync(filename, 'utf8') +
        '\nmodule.exports.testHooks = { ACTIVE_SESSION, inProfileTransaction };\n', filename);
    const writer = instrumented.exports, otherScope = { ...scope, kodikos: '0032' };
    const db = store([fixture(), fixture('other', otherScope)]);
    await writer.testHooks.inProfileTransaction(db.deps.connection, db.deps.capabilityProbe, async session => {
        for (const [employeeId, selectedScope] of [['employee', scope], ['other', otherScope]]) {
            await writer.writeEmployeeEmploymentProfile({ ...db.deps, scope: selectedScope, employeeId,
                mode: W.MODE_CORRECT_EXISTING, historyId: historyId(employeeId, 0),
                effectiveFrom: starts[0], maintenance: update(0, '2026-11-30', employeeId).maintenance,
                [writer.testHooks.ACTIVE_SESSION]: session });
        }
    });
    assert.deepEqual(db.events.filter(e => e.type === 'fence').map(e => e.id), ['employee', 'other']);
    assert.ok(db.state().employees.every(row => row[FIELD] === 1));
    assert.equal(db.events.filter(e => e.type === 'commit').length, 1);
});

test('departure retry revalidates original form echoes instead of retaining omissions from an aborted attempt', async () => {
    const db = store(), initialPay = db.state().employees[0].nomimosMisthos;
    db.hooks.beforeCommit = session => {
        if (session.attempt === 1) {
            db.changeCommittedEmployee('employee', { nomimosMisthos: 100 });
            db.changeCommittedHistory(historyId('employee', 2), { nomimosMisthos: 100 });
            throw transient();
        }
    };
    await assert.rejects(W.writeEmployeeDeparture({ ...db.deps, scope, employeeId: 'employee',
        departureDate: '2026-06-30', maintenance: {
            rejectConcurrentProfileChanges: true,
            employeeChanges: { nomimosMisthos: initialPay },
            submittedEmployeeFields: ['nomimosMisthos']
        } }), error => error.code === 'EMPLOYEE_DEPARTURE_PROFILE_CHANGE_REQUIRES_SEPARATE_SAVE');
    assert.equal(db.events.filter(e => e.type === 'fence').length, 2);
    assert.equal(db.events.some(e => e.type === 'commit'), false);
    assert.equal(db.state().employees[0].nomimosMisthos, 100);
    assert.equal(db.state().employees[0].hmeromhnia_apoxorhshs, null);
    assert.equal(Object.hasOwn(db.state().employees[0], FIELD), false);
    assert.equal(db.state().audits.length, 0);
});

test('retry derives an omitted baseline date again from fresh current state', async () => {
    const imported = fixture(); imported.history = [];
    imported.employee.hmeromhnia_isxyos_oron_ergasias_apo = starts[0];
    imported.employee.hmeromhnia_isxyos_dialleimatos_apo = starts[0];
    const db = store([imported]);
    db.hooks.beforeCommit = session => {
        if (session.attempt === 1) {
            db.changeCommittedEmployee('employee', {
                hmeromhnia_isxyos_oron_ergasias_apo: starts[1],
                hmeromhnia_isxyos_dialleimatos_apo: starts[1]
            });
            throw transient();
        }
    };
    await W.writeEmployeeEmploymentProfile({ ...db.deps, scope, employeeId: 'employee',
        maintenance: { employeeChanges: {}, historyChanges: {} } });
    assert.equal(db.state().history.length, 1);
    assert.equal(new Date(db.state().history[0].hmeromhnia_isxyos_oron_ergasias_apo)
        .toISOString().slice(0, 10), starts[1]);
    assert.equal(db.state().employees[0][FIELD], 1);
    assert.equal(db.events.filter(e => e.type === 'fence').length, 2);
});

test('pre-transaction validation failure creates no fence or persistent mutation', async () => {
    const db = store(), before = db.state();
    await assert.rejects(W.writeEmployeeEmploymentProfile({ ...db.deps, scope,
        employeeId: 'employee', input: { browserFenceBypass: true } }));
    assert.deepEqual(db.events, []); assert.deepEqual(db.state(), before);
});
