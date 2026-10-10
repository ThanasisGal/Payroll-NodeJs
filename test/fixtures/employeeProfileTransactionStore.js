'use strict';
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { buildCompleteProfileSnapshot } = require('../../server/utils/ergazomenoi/employmentProfileHistory');
const { canonicalizeEmployeeHistory } = require('../../server/services/ergazomenoi/employeeHistoryCanonicalizationService');
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
function store(fixtures = [fixture()], { cloneFn = structuredClone } = {}) {
    const clone = cloneFn;
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
                    if (this.projection?.includes('+employee_profile_mutation_sequence')) return clone(value);
                    const { [FIELD]: ignored, ...businessState } = value;
                    return clone(businessState);
                }
                // Match History's Mongoose select:false metadata. A full-document
                // boundary must explicitly request it on every compared read.
                if (kind === 'history' && !this.projection?.includes('+history_reference_fence')) {
                    return clone(value.map(({ history_reference_fence, ...row }) => row));
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

module.exports = { FIELD, scope, starts, clone, historyId, deferred, fixture, store, transient };
