'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { writeEmployeeDeparture, writeEmployeeDepartureCancellation, writeEmployeeRehire } = require('./employeeEmploymentProfileWriter');
const { buildEmploymentCycles, resolveEmploymentCycleForDate } = require('./employeeEmploymentCycleResolverService');
const { buildEmployeeDepartureTransition } = require('./employeeDepartureLifecycleTransitionService');
const C = require('../../utils/ergazomenoi/employmentProfileContract');

const scope = { team: 'THA', company_kod: 'company', kodikos: '0014' };
const date = value => value == null ? null : new Date(value).toISOString().slice(0, 10);
const clone = value => structuredClone(value);

function auditedFixture() {
    const hire = '2026-04-25';
    const history = [
        ['0001', '2026-04-25', null], ['0002', '2026-05-25', null],
        ['0003', '2026-06-01', null], ['0004', '2026-06-08', null],
        ['0005', '2026-06-15', null], ['0006', null, '2026-07-06']
    ].map(([sequence, profileStart, scheduleStart]) => ({
        _id: `history-${sequence}`, ...scope, aa_eggrafhs: sequence,
        hmeromhnia_proslhpshs: hire, hmeromhnia_apoxorhshs: null,
        hmeromhnia_isxyos_oron_ergasias_apo: profileStart,
        hmeromhnia_isxyos_oron_ergasias_eos: ({
            '0001': '2026-05-24', '0002': '2026-05-31',
            '0003': '2026-06-07', '0004': '2026-06-14'
        })[sequence] || null,
        hmeromhnia_allaghs_orarioy_apo: scheduleStart,
        hmeromhnia_allaghs_orarioy_eos: sequence === '0006' ? '2026-07-12' : null,
        afora_allagh_oron_ergasias: sequence !== '0006',
        createdAt: `2026-07-${sequence === '0006' ? '06' : '01'}T00:00:00.000Z`
    }));
    return { employee: { _id: 'employee-0014', ...scope, archived: false, energos: true,
        hmeromhnia_proslhpshs: hire, hmeromhnia_apoxorhshs: null,
        hmeromhnia_isxyos_oron_ergasias_apo: '2026-05-25',
        hmeromhnia_isxyos_oron_ergasias_eos: '2026-10-15',
        hmeromhnia_lhxhs_symbashs: '2026-10-31',
        hmeromhnia_allaghs_orarioy_apo: '2026-07-06',
        hmeromhnia_allaghs_orarioy_eos: '2026-07-12' }, history };
}

function database(initial, fail = '') {
    let committed = clone(initial), draft = null, writes = 0;
    const session = { async withTransaction(work) {
        draft = clone(committed);
        try { await work(); committed = draft; } finally { draft = null; }
    }, async endSession() {} };
    const matches = (row, filter) => row && Object.entries(filter).every(([key, value]) =>
        value == null ? row[key] == null : value instanceof Date
            ? new Date(row[key]).getTime() === value.getTime() : String(row[key]) === String(value));
    const query = read => ({ session(value) { assert.equal(value, session); return this; },
        async lean() { return clone(read()); } });
    const employeeModel = {
        findOne: filter => query(() => matches(draft.employee, filter) ? draft.employee : null),
        async updateOne(filter, update, options) {
            assert.equal(options.session, session); writes++;
            if (!matches(draft.employee, filter)) return { matchedCount: 0 };
            Object.assign(draft.employee, clone(update.$set)); return { matchedCount: 1 };
        }
    };
    const historyModel = {
        find: filter => query(() => draft.history.filter(row => matches(row, filter))),
        async updateOne(filter, update, options) {
            assert.equal(options.session, session); writes++;
            if (fail === 'history' || (fail === 'second-history' && writes === 3)) {
                throw Error('history failed');
            }
            const row = draft.history.find(item => matches(item, filter));
            if (!row) return { matchedCount: 0 };
            Object.assign(row, clone(update.$set)); return { matchedCount: 1 };
        },
        async create([record], options) {
            assert.equal(options.session, session); writes++;
            const row = { _id: `history-${String(draft.history.length + 1).padStart(4, '0')}`, ...clone(record) };
            draft.history.push(row); return [row];
        }
    };
    return { state: () => clone(committed), writes: () => writes,
        deps: { connection: { startSession: async () => session }, capabilityProbe: async () => true,
            employeeModel, historyModel } };
}

async function depart(db, departureDate = '2026-09-20', extra = {}) {
    return writeEmployeeDeparture({ ...db.deps, scope, employeeId: 'employee-0014', departureDate,
        ...extra });
}

test('audited six-row first departure closes terminal evidence and latest profile without a new row', async () => {
    const before = auditedFixture(), db = database(before);
    const selection = buildEmployeeDepartureTransition({ currentEmployee: before.employee,
        history: before.history, departureDate: '2026-09-20' });
    assert.equal(selection.terminalHistoryRow._id, 'history-0006');
    assert.equal(selection.latestProfileRow._id, 'history-0005');
    await depart(db);
    const after = db.state();
    assert.equal(date(after.employee.hmeromhnia_apoxorhshs), '2026-09-20');
    assert.equal(after.employee.energos, false);
    assert.equal(date(after.employee.hmeromhnia_isxyos_oron_ergasias_eos), '2026-09-20');
    assert.equal(date(after.employee.hmeromhnia_lhxhs_symbashs), '2026-10-31');
    assert.equal(after.employee.hmeromhnia_proslhpshs, before.employee.hmeromhnia_proslhpshs);
    assert.equal(after.employee.hmeromhnia_allaghs_orarioy_apo, before.employee.hmeromhnia_allaghs_orarioy_apo);
    assert.equal(after.history.length, 6);
    assert.deepEqual(after.history.map(row => row._id), before.history.map(row => row._id));
    assert.deepEqual(after.history.slice(0, 4), before.history.slice(0, 4));
    assert.equal(date(after.history[4].hmeromhnia_isxyos_oron_ergasias_eos), '2026-09-20');
    assert.equal(after.history[4].hmeromhnia_isxyos_oron_ergasias_apo, before.history[4].hmeromhnia_isxyos_oron_ergasias_apo);
    assert.equal(date(after.history[5].hmeromhnia_apoxorhshs), '2026-09-20');
    assert.equal(after.history[5].hmeromhnia_isxyos_oron_ergasias_apo, null);
    assert.equal(after.history[5].afora_allagh_oron_ergasias, false);
    assert.equal(buildEmploymentCycles({ currentEmployee: after.employee, history: after.history }).length, 1);
    const historyOnly = buildEmploymentCycles({ history: after.history });
    assert.equal(historyOnly.length, 1);
    assert.equal(historyOnly[0].departure_date, '2026-09-20');
    assert.equal(resolveEmploymentCycleForDate('2026-09-20', { history: after.history }).status, 'EMPLOYED');
    assert.equal(resolveEmploymentCycleForDate('2026-09-21', { history: after.history }).status, 'AFTER_LAST_DEPARTURE');
});

test('same departure repeats safely; different departure and archived employee reject without writes', async () => {
    const db = database(auditedFixture());
    await depart(db);
    const closed = db.state();
    await depart(db);
    assert.deepEqual(db.state(), closed);
    const count = db.writes();
    await assert.rejects(depart(db, '2026-09-21'), { code: 'EMPLOYEE_DEPARTURE_CONFLICT' });
    assert.equal(db.writes(), count);
    const archived = auditedFixture(); archived.employee.archived = true;
    const other = database(archived);
    await assert.rejects(depart(other), { code: 'EMPLOYEE_DEPARTURE_CURRENT_CYCLE_MISMATCH' });
    assert.equal(other.writes(), 0);
});

test('controlled cancellation restores only departure-clamped boundaries in one cycle', async () => {
    const before = auditedFixture(), db = database(before);
    await depart(db);
    const closed = db.state();
    assert.equal(closed.employee.employment_departure_restore.departure, '2026-09-20');
    const result = await writeEmployeeDepartureCancellation({ ...db.deps, scope, employeeId: 'employee-0014' });
    assert.equal(result.mode, 'MODE_DEPARTURE_CANCELLATION');
    const after = db.state();
    assert.equal(after.history.length, before.history.length);
    assert.deepEqual(after.history.map(row => row._id), before.history.map(row => row._id));
    assert.deepEqual(after.history, before.history);
    assert.equal(after.employee.hmeromhnia_apoxorhshs, null);
    assert.equal(after.employee.energos, true);
    assert.equal(date(after.employee.hmeromhnia_isxyos_oron_ergasias_eos), '2026-10-15');
    assert.equal(after.employee.employment_departure_restore, null);
    assert.equal(buildEmploymentCycles({ currentEmployee: after.employee, history: after.history }).length, 1);
});

test('cancellation without recorded boundary provenance rejects before writes', async () => {
    const db = database(auditedFixture());
    await depart(db);
    const closed = db.state();
    delete closed.employee.employment_departure_restore;
    const unknown = database(closed);
    await assert.rejects(writeEmployeeDepartureCancellation({ ...unknown.deps, scope,
        employeeId: 'employee-0014' }), { code: 'EMPLOYEE_DEPARTURE_CANCELLATION_PROVENANCE_REQUIRED' });
    assert.equal(unknown.writes(), 0);
});

test('cancellation history failure rolls back the employee reopening', async () => {
    const departed = database(auditedFixture());
    await depart(departed);
    const closed = departed.state();
    const db = database(closed, 'history');
    await assert.rejects(writeEmployeeDepartureCancellation({ ...db.deps, scope,
        employeeId: 'employee-0014' }), /history failed/);
    assert.deepEqual(db.state(), closed);
});

test('same-day departure allowed; before-hire and future history event reject without writes', async () => {
    const initial = auditedFixture(); initial.history = [initial.history[0]];
    initial.employee.hmeromhnia_isxyos_oron_ergasias_apo = '2026-04-25';
    initial.employee.hmeromhnia_allaghs_orarioy_apo = '2026-04-25';
    initial.employee.hmeromhnia_allaghs_orarioy_eos = '2026-04-25';
    const sameDay = database(initial);
    await depart(sameDay, '2026-04-25');
    assert.equal(date(sameDay.state().history[0].hmeromhnia_apoxorhshs), '2026-04-25');
    const earlier = database(initial);
    await assert.rejects(depart(earlier, '2026-04-24'), { code: 'EMPLOYEE_DEPARTURE_BEFORE_HIRE' });
    assert.equal(earlier.writes(), 0);
    const future = database(auditedFixture());
    await assert.rejects(depart(future, '2026-06-20'), { code: 'EMPLOYEE_DEPARTURE_CONFLICT' });
    assert.equal(future.writes(), 0);
});

test('earlier profile end is preserved and a newer cycle is rejected without writes', async () => {
    const initial = auditedFixture();
    initial.employee.hmeromhnia_isxyos_oron_ergasias_eos = '2026-08-31';
    initial.history[4].hmeromhnia_isxyos_oron_ergasias_eos = '2026-08-31';
    const db = database(initial);
    await depart(db);
    assert.equal(date(db.state().employee.hmeromhnia_isxyos_oron_ergasias_eos), '2026-08-31');
    assert.equal(date(db.state().history[4].hmeromhnia_isxyos_oron_ergasias_eos), '2026-08-31');
    const newer = auditedFixture();
    newer.history.push({ ...newer.history[0], _id: 'later-cycle', aa_eggrafhs: '0007',
        hmeromhnia_proslhpshs: '2026-11-01', hmeromhnia_apoxorhshs: null,
        hmeromhnia_isxyos_oron_ergasias_apo: '2026-11-01' });
    const mismatch = database(newer);
    await assert.rejects(depart(mismatch), { code: 'EMPLOYEE_DEPARTURE_CURRENT_CYCLE_MISMATCH' });
    assert.equal(mismatch.writes(), 0);
});

test('history failure rolls back employee and all history changes', async () => {
    for (const point of ['history', 'second-history']) {
        const initial = auditedFixture(), db = database(initial, point);
        await assert.rejects(depart(db, '2026-09-20', { maintenance: {
            employeeChanges: { email: 'changed@example.invalid', logos_peratosis: 'Καταγγελία',
                parathrhseis_peratosis: 'departure note', energos: true },
            historyChanges: { nomimosMisthos: 1300 },
            submittedHistoryChanges: { nomimosMisthos: 1300 },
            submittedEmployeeFields: ['email', 'logos_peratosis', 'parathrhseis_peratosis', 'energos']
        } }), /history failed/);
        assert.deepEqual(db.state(), initial);
    }
});

test('unsafe profile change during departure returns a conflict before any write', async () => {
    const db = database(auditedFixture());
    await assert.rejects(depart(db, '2026-09-20', {
        input: { evelikth_proselefsh: 1 }
    }), { code: 'EMPLOYEE_DEPARTURE_PROFILE_CHANGE_REQUIRES_SEPARATE_SAVE' });
    assert.equal(db.writes(), 0);
});

test('same-current-profile fact correction is saved with departure on the exact profile row', async () => {
    const initial = auditedFixture();
    const facts = C.normalizeEmploymentProfileSubmission({}, {});
    Object.assign(initial.employee, facts);
    Object.assign(initial.history[4], facts);
    initial.employee.hmeromhnia_isxyos_oron_ergasias_apo = '2026-06-15';
    const db = database(initial);
    await depart(db, '2026-09-20', { input: { evelikth_proselefsh: 1 } });
    assert.equal(db.state().employee.evelikth_proselefsh, 1);
    assert.equal(db.state().history[4].evelikth_proselefsh, 1);
    assert.equal(db.state().history[4]._id, 'history-0005');
    assert.equal(db.state().history[5].evelikth_proselefsh, undefined);
    assert.equal(db.state().history.length, 6);
});

test('rehire after audited departure starts a new cycle without altering schedule-only evidence', async () => {
    const db = database(auditedFixture());
    await depart(db);
    const closed = db.state();
    await writeEmployeeRehire({ ...db.deps, scope, employeeId: 'employee-0014',
        rehireDate: '2026-10-01', employeeChanges: {
            hmeres_ergasias_ebdomadas: 5, ores_ergasias_ebdomadas: 40,
            mo_oron_hmerhsias_ergasias: 8, pososto_prosayxhshs_6hs_hmeras: 40
        } });
    const after = db.state();
    assert.equal(after.history.length, 7);
    assert.deepEqual(after.history.slice(0, 6), closed.history);
    assert.equal(after.history[5].hmeromhnia_isxyos_oron_ergasias_apo, null);
    assert.equal(date(after.employee.hmeromhnia_proslhpshs), '2026-10-01');
    const cycles = buildEmploymentCycles({ currentEmployee: after.employee, history: after.history });
    assert.equal(cycles.length, 2);
    assert.equal(cycles[0].departure_date, '2026-09-20');
    assert.equal(cycles[1].hire_date, '2026-10-01');
});
