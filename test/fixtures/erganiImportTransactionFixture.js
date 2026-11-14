'use strict';

const assert = require('node:assert/strict');
const { fixture, store, scope } = require('./employeeProfileTransactionStore');
const authorizedScope = { team: scope.team, company_kod: scope.company_kod, ypokatasthma: '0000' };
const clone = structuredClone;
const date = '2026-06-01';
const inputRow = { rowNumber: 1, ypokatasthma: '0000', afm: '123456789',
    hmeromhnia_raw: '01/06/2026', apo_ora: '08:00', eos_ora: '16:00', h_check: 'Ok' };

function employmentFixture(kind = 'valid') {
    const f = fixture();
    Object.assign(f.employee, { ...authorizedScope, afm: inputRow.afm });
    if (kind === 'missing') {
        f.employee.hmeromhnia_proslhpshs = null;
        for (const row of f.history) row.hmeromhnia_proslhpshs = null;
    } else if (kind === 'incomplete-past') {
        f.employee.hmeromhnia_proslhpshs = '2026-07-01';
        for (const row of f.history) row.hmeromhnia_proslhpshs = null;
    } else if (kind === 'overlap') {
        f.history[0].hmeromhnia_proslhpshs = '2025-01-01';
        f.history[0].hmeromhnia_apoxorhshs = '2026-06-30';
    } else if (kind === 'before-hire') {
        for (const row of [f.employee, ...f.history]) row.hmeromhnia_proslhpshs = '2026-06-02';
    } else if (kind === 'after-departure') {
        f.employee.hmeromhnia_apoxorhshs = '2026-05-31';
    } else if (kind === 'gap') {
        f.history = [{ ...f.history[0], hmeromhnia_apoxorhshs: '2026-05-31' }];
        f.employee.hmeromhnia_proslhpshs = '2026-06-02';
    }
    return f;
}

function matches(row, filter) {
    return Object.entries(filter).every(([key, expected]) => {
        if (key === '$or') return expected.some(item => matches(row, item));
        if (expected instanceof Date) return new Date(row[key]).getTime() === expected.getTime();
        if (expected && typeof expected === 'object') {
            if ('$gte' in expected || '$lte' in expected) return (
                (!('$gte' in expected) || new Date(row[key]) >= expected.$gte) &&
                (!('$lte' in expected) || new Date(row[key]) <= expected.$lte));
            if ('$in' in expected) return expected.$in.includes(row[key]);
            if ('$ne' in expected) return row[key] !== expected.$ne;
        }
        return String(row[key]) === String(expected);
    });
}

function importHarness({ kind = 'valid', existing = true, locked = false, periodStatus = null, fixtures = null, initialRows = null,
    missingEmployee = false, ambiguousEmployee = false, failAfterWrite = false } = {}) {
    const f = employmentFixture(kind);
    const db = store(fixtures || (missingEmployee ? [] : [f]));
    const initial = initialRows || (existing ? [{ _id: 'schedule-1', ...authorizedScope, kodikos: scope.kodikos,
        hmeromhnia: new Date(date), is_locked: locked }] : []);
    function materialize(audits) {
        const rows = clone(initial);
        for (const event of audits.filter(item => item.kind === 'ergani-import-operation')) {
            const index = rows.findIndex(row => row._id === event.row._id);
            if (index < 0) rows.push(clone(event.row)); else rows[index] = clone(event.row);
        }
        return rows;
    }
    function query(load) {
        let session;
        return { select() { return this; }, session(value) { session = value; return this; },
            lean: async () => load(session) };
    }
    const employeeModel = { ...db.deps.employeeModel,
        find: filter => query(session => {
            const employees = (session?.draft || db.state()).employees.filter(row => matches(row, filter));
            return ambiguousEmployee && employees.length ? [...employees, { ...employees[0], _id: 'ambiguous' }] : employees;
        }) };
    const writes = [];
    const dependencies = { authorizedScope, ergazomenoiModel: employeeModel,
        workWriteDependencies: { ...db.deps, employeeModel, periodControlModel: {
            find: () => query(session => { assert.ok(session); return periodStatus ? [{ _id: 'period', status: periodStatus }] : []; }),
            updateOne: async (_filter, _update, { session }) => {
                await db.deps.auditModel.create([{ kind: 'period-fence' }], { session });
                return { matchedCount: 1 };
            }
        } },
        argiesModel: { find: () => query(() => []) },
        loadAppliedProtectionForRows: async () => ({ entriesByRowId: {}, diagnostics: [], hasConflicts: false }),
        prodhlomenaModel: {
            find: filter => query(session => materialize((session?.draft || db.state()).audits).filter(row => matches(row, filter))),
            bulkWrite: async (operations, { session }) => {
                assert.ok(session);
                writes.push({ operations: clone(operations), session: session.id, attempt: session.attempt });
                const result = { matchedCount: 0, modifiedCount: 0, upsertedCount: 0 };
                for (const { updateOne: op } of operations) {
                    const rows = materialize(session.draft.audits);
                    let row = rows.find(row => matches(row, op.filter));
                    if (row) {
                        result.matchedCount++;
                        const updated = { ...row, ...clone(op.update.$set || {}) };
                        if (JSON.stringify(updated) === JSON.stringify(row)) continue;
                        result.modifiedCount++;
                        row = updated;
                    } else if (op.upsert) {
                        row = { _id: 'inserted-' + rows.length, ...clone(op.update.$setOnInsert) };
                        result.upsertedCount++;
                    } else continue;
                    await db.deps.auditModel.create([{ kind: 'ergani-import-operation', row }], { session });
                }
                if (failAfterWrite) throw Error('SYNTHETIC_IMPORT_WRITE_FAILURE');
                return result;
            }
        }
    };
    return { db, dependencies, writes, rows: () => materialize(db.state().audits), fixture: f };
}

function scheduleSheet(rows = [inputRow]) {
    return { eachRow(fn) { rows.forEach((row, index) => {
        const values = [row.ypokatasthma, row.afm, 'TEST', 'USER', row.hmeromhnia_raw, row.kathgoria ?? 'ΕΡΓ', row.apo_ora, row.eos_ora];
        fn({ getCell(number) { const value = values[number - 1]; return { value, text: String(value ?? '') }; } }, index + 1);
    }); } };
}

module.exports = { authorizedScope, date, employmentFixture, importHarness, inputRow, scheduleSheet };
