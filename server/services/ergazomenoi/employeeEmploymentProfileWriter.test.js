'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { writeEmployeeEmploymentProfile, selectMaintenanceMode, MODE_CORRECT_EXISTING } = require('./employeeEmploymentProfileWriter');
const C = require('../../utils/ergazomenoi/employmentProfileContract');
const { buildCompleteProfileSnapshot } = require('../../utils/ergazomenoi/employmentProfileHistory');
const { resolveEmploymentProfileFactsForDate } = require('../../utils/ergazomenoi/employmentProfileHistory');
const { resolveEmploymentTypeFromFormData } = require('../../utils/ergazomenoi/getOrarioTermsForDate');
const { profileError } = require('../../utils/ergazomenoi/employmentProfileMaintenance');
const { buildEmploymentCycles } = require('./employeeEmploymentCycleResolverService');
const scope = { team: 'TEST', company_kod: 'company', kodikos: '0031' };
const canonicalWorkTerms = ['kathestos_apasxolhshs', 'typos_apasxolhshs', 'typos_ebdomadas',
    'hmeres_ergasias_ebdomadas', 'ores_ergasias_ebdomadas', 'mo_oron_hmerhsias_ergasias',
    'apasxolhsh_basei_symbashs', 'pososto_prosayxhshs_6hs_hmeras'];
function assertCanonicalWorkTermsMatch(current, history) {
    for (const field of canonicalWorkTerms) {
        assert.equal(Object.hasOwn(current, field), Object.hasOwn(history, field), field);
        assert.deepEqual(current[field], history[field], field);
    }
}

function database(initial = { employee: null, history: [] }, fail = '') {
    let committed = structuredClone(initial); let draft; let ended = false; let writes = 0;
    const session = { async withTransaction(work) {
        draft = structuredClone(committed);
        try { await work(); if (fail === 'commit') throw new Error('commit failed'); committed = draft; } finally { draft = null; }
    }, async endSession() { ended = true; } };
    const query = (read) => ({ session(value) { assert.equal(value, session); return this; }, async lean() { return structuredClone(read()); } });
    const matches = (row, filter) => row && Object.entries(filter).every(([key, value]) =>
        value === null ? row[key] == null : value instanceof Date ? new Date(row[key]).getTime() === value.getTime() : row[key] === value);
    const employeeModel = {
        findOne: () => query(() => draft.employee),
        async updateOne(filter, update, options) {
            assert.equal(options.session, session); writes++;
            if (fail === 'employee') throw new Error('employee failed');
            if (!matches(draft.employee, filter)) return { matchedCount: 0 };
            Object.assign(draft.employee, update.$set); return { matchedCount: 1 };
        },
        async create([record], options) {
            assert.equal(options.session, session); writes++;
            draft.employee = { _id: 'employee', ...record }; return [draft.employee];
        }
    };
    const historyModel = {
        find: () => query(() => draft.history),
        async updateOne(filter, update, options) {
            assert.equal(options.session, session); writes++;
            if (fail === 'close') throw new Error('close failed');
            if (fail === `close:${filter._id}`) throw new Error('close failed');
            const row = draft.history.find((row) => matches(row, filter));
            if (!row || fail === 'stale') return { matchedCount: 0 };
            Object.assign(row, update.$set);
            return { matchedCount: 1 };
        },
        async create([record], options) {
            assert.equal(options.session, session); writes++;
            if (fail === 'history') throw new Error('history failed');
            const row = { _id: `history-${draft.history.length}`, ...record };
            draft.history.push(row); return [row];
        }
    };
    return { dependencies: { connection: { startSession: async () => session }, employeeModel, historyModel,
        capabilityProbe: async () => true }, state: () => committed, ended: () => ended, writes: () => writes };
}
const arrangement = { [C.ENABLED]: true, [C.TYPE]: 'APPROVED_TIME_SHIFT_INTERRUPTION',
    [C.FROM]: '2026-09-01', [C.START]: '13:00', [C.END]: '14:00' };

test('initial employee and complete history commit together', async () => {
    const db = database();
    await writeEmployeeEmploymentProfile({ ...db.dependencies, scope, newEmployee: { eponymo: 'TEST' }, effectiveFrom: '2026-04-01' });
    assert.equal(db.state().employee[C.ENABLED], false);
    const history = db.state().history[0];
    for (const field of C.FACT_FIELDS) assert.deepEqual(history[field], db.state().employee[field], field);
    assert.equal(history.afora_proslhpsh, true); assert.equal(db.ended(), true);
});
test('a new arrangement appends complete history and closes previous version', async () => {
    const initial = buildCompleteProfileSnapshot({ effectiveFrom: '2026-04-01' });
    const db = database({ employee: { _id: 'employee', ...scope, ...initial, localNote: 'preserve' },
        history: [{ _id: 'old', ...scope, ...initial, aa_eggrafhs: '0001' }] });
    await writeEmployeeEmploymentProfile({ ...db.dependencies, scope, input: arrangement, effectiveFrom: '2026-09-15' });
    assert.equal(db.state().history.length, 2);
    assert.equal(db.state().history[0][C.ENABLED], false);
    assert.equal(db.state().history[0].hmeromhnia_isxyos_oron_ergasias_eos.toISOString(), '2026-09-14T00:00:00.000Z');
    assert.equal(db.state().history[1][C.ENABLED], true);
    assert.equal(db.state().employee.localNote, 'preserve');
    assert.equal(db.state().history[1].aa_eggrafhs, '0002');
});

function legacyShadowState() {
    const end = new Date('2026-10-15');
    const base = { ...buildCompleteProfileSnapshot({ effectiveFrom: '2026-05-28' }),
        hmeromhnia_proslhpshs: '2026-05-28', hmeromhnia_isxyos_oron_ergasias_eos: end,
        kathestos_apasxolhshs: '0', typos_apasxolhshs: '0',
        hmeres_ergasias_ebdomadas: 5, ores_ergasias_ebdomadas: 40,
        mo_oron_hmerhsias_ergasias: 8, nomimosMisthos: 1000,
        pragmatikosMisthos: 1100, poso_symbashs_01: 1100 };
    const legacy = { ...base, _id: 'legacy-0001', ...scope, aa_eggrafhs: '0001',
        createdAt: new Date('2026-05-28') };
    for (const field of C.FACT_FIELDS) delete legacy[field];
    delete legacy.employment_profile_source;
    const recorded = { ...base, _id: 'recorded-0002', ...scope, aa_eggrafhs: '0002',
        createdAt: new Date('2026-05-29') };
    return { employee: { ...base, _id: 'employee', ...scope, energos: true,
        archived: false, hmeromhnia_apoxorhshs: null }, history: [legacy, recorded] };
}
function rotatingAppend(db) {
    const type = resolveEmploymentTypeFromFormData({ kathestos_apasxolhshs_stathera: 'ΕΚ_ΠΕΡΙΤΡΟΠΗΣ' });
    assert.equal(type, '2');
    const changes = { hmeromhnia_proslhpshs: '2026-05-28',
        hmeromhnia_allaghs_symbashs: '2026-09-22',
        hmeromhnia_allaghs_orarioy_apo: '2026-09-22',
        hmeromhnia_allaghs_orarioy_eos: '2026-09-28',
        hmeromhnia_isxyos_oron_ergasias_apo: '2026-09-22',
        hmeromhnia_isxyos_oron_ergasias_eos: null,
        kathestos_apasxolhshs: type, typos_apasxolhshs: type,
        hmeres_ergasias_ebdomadas: 1, ores_ergasias_ebdomadas: 8,
        mo_oron_hmerhsias_ergasias: 8, nomimosMisthos: 300,
        pragmatikosMisthos: 350, poso_symbashs_01: 350 };
    return writeEmployeeEmploymentProfile({ ...db.dependencies, scope, employeeId: 'employee',
        effectiveFrom: '2026-09-22', maintenance: { originalHistoryId: 'recorded-0002',
            employeeChanges: changes, historyChanges: changes } });
}

test('legacy shadow and recorded V1 close together before one rotating profile append', async () => {
    const initial = legacyShadowState();
    const db = database(initial);
    const saved = await rotatingAppend(db);
    const state = db.state();
    assert.equal(saved.mode, 'MODE_NEW_VERSION');
    assert.equal(state.history.length, 3);
    assert.deepEqual(state.history.slice(0, 2).map(row => row._id), initial.history.map(row => row._id));
    for (const row of state.history.slice(0, 2)) {
        assert.equal(new Date(row.hmeromhnia_isxyos_oron_ergasias_eos).toISOString().slice(0, 10), '2026-09-21');
        assert.equal(new Date(row.hmeromhnia_isxyos_oron_ergasias_apo).toISOString().slice(0, 10), '2026-05-28');
    }
    for (let index = 0; index < 2; index++) assert.deepEqual(state.history[index], {
        ...initial.history[index],
        hmeromhnia_isxyos_oron_ergasias_eos: new Date('2026-09-21')
    });
    assert.equal(C.readEmploymentProfile(state.history[0]).recorded, false);
    assert.equal(Object.hasOwn(state.history[0], C.SCHEMA_VERSION), false);
    assert.equal(C.readEmploymentProfile(state.history[1]).recorded, true);
    assert.equal(state.history[0].nomimosMisthos, initial.history[0].nomimosMisthos);
    const next = state.history[2];
    assertCanonicalWorkTermsMatch(state.employee, next);
    assert.equal(state.employee.typos_apasxolhshs, '2');
    assert.equal(state.employee.typos_ebdomadas, '');
    assert.equal(C.readEmploymentProfile(next).recorded, true);
    assert.equal(next.aa_eggrafhs, '0003');
    assert.equal(new Date(next.hmeromhnia_isxyos_oron_ergasias_apo).toISOString().slice(0, 10), '2026-09-22');
    assert.equal(next.hmeromhnia_isxyos_oron_ergasias_eos, null);
    assert.equal(new Date(next.hmeromhnia_allaghs_orarioy_eos).toISOString().slice(0, 10), '2026-09-28');
    for (const record of [next, state.employee]) {
        assert.equal(record.kathestos_apasxolhshs, '2');
        assert.equal(record.hmeres_ergasias_ebdomadas, 1);
        assert.equal(record.ores_ergasias_ebdomadas, 8);
        assert.equal(record.mo_oron_hmerhsias_ergasias, 8);
        assert.equal(record.nomimosMisthos, 300);
        assert.equal(record.pragmatikosMisthos, 350);
        assert.equal(record.poso_symbashs_01, 350);
        assert.equal(record.hmeromhnia_proslhpshs, '2026-05-28');
    }
    assert.equal(state.employee.hmeromhnia_apoxorhshs, null);
    assert.equal(state.employee.energos, true);
    const cycles = buildEmploymentCycles({ currentEmployee: state.employee, history: state.history });
    assert.equal(cycles.length, 1);
    assert.equal(cycles[0].hire_date, '2026-05-28');
    assert.equal(resolveEmploymentProfileFactsForDate('2026-09-21', state.history).historyId, 'recorded-0002');
    assert.equal(resolveEmploymentProfileFactsForDate('2026-09-22', state.history).historyId, next._id);
});

test('other overlapping predecessor shapes fail closed before writes', async () => {
    const cases = {
        'two recorded profiles': state => Object.assign(state.history[0],
            Object.fromEntries(C.FACT_FIELDS.map(field => [field, state.history[1][field]]))),
        'different starts': state => { state.history[0].hmeromhnia_isxyos_oron_ergasias_apo = '2026-06-01'; },
        'different hires': state => { state.history[0].hmeromhnia_proslhpshs = '2026-06-01'; },
        'different ends': state => { state.history[0].hmeromhnia_isxyos_oron_ergasias_eos = '2026-10-16'; },
        'legacy row created later': state => { state.history[0].createdAt = new Date('2026-05-30'); },
        'newer cycle': state => { state.history.push({ ...scope, _id: 'newer-cycle',
            hmeromhnia_proslhpshs: '2026-07-01', aa_eggrafhs: '0003' }); }
    };
    for (const [name, mutate] of Object.entries(cases)) {
        const initial = legacyShadowState(); mutate(initial);
        const db = database(initial);
        await assert.rejects(rotatingAppend(db), error => error.code === 'EMPLOYEE_PROFILE_HISTORY_OVERLAP', name);
        assert.equal(db.writes(), 0, name);
        assert.deepEqual(db.state(), initial, name);
    }
});

test('all legacy-shadow writes roll back on each failure point', async () => {
    for (const fail of ['close:legacy-0001', 'close:recorded-0002', 'stale', 'employee', 'history', 'commit']) {
        const initial = legacyShadowState();
        const db = database(initial, fail);
        await assert.rejects(rotatingAppend(db), undefined, fail);
        assert.deepEqual(db.state(), initial, fail);
        assert.equal(db.ended(), true, fail);
    }
});

test('ambiguous overlap has a dedicated Greek response', () => {
    let status;
    const response = { status(value) { status = value; return this; }, json(value) { return value; } };
    const error = Object.assign(new Error('overlap'), { code: 'EMPLOYEE_PROFILE_HISTORY_OVERLAP', statusCode: 409 });
    const result = profileError(response, error);
    assert.equal(status, 409);
    assert.equal(result.reason, error.code);
    assert.match(result.message, /επικαλυπτόμενες ενεργές περιόδους/);
    assert.match(result.message, /δεν αποθηκεύτηκε/);
});
test('history failure rolls back an initial employee insert', async () => {
    const db = database(undefined, 'history');
    await assert.rejects(writeEmployeeEmploymentProfile({ ...db.dependencies, scope, newEmployee: {}, effectiveFrom: '2026-09-01' }), /history failed/);
    assert.deepEqual(db.state(), { employee: null, history: [] }); assert.equal(db.ended(), true);
});
test('history create or close failure rolls back employee and previous history', async () => {
    const initial = { employee: { _id: 'employee', ...scope }, history: [{ _id: 'old', ...scope,
        hmeromhnia_isxyos_oron_ergasias_apo: '2026-04-01', hmeromhnia_isxyos_oron_ergasias_eos: null }] };
    for (const fail of ['history', 'close']) {
        const db = database(initial, fail);
        await assert.rejects(writeEmployeeEmploymentProfile({ ...db.dependencies, scope, input: arrangement, effectiveFrom: '2026-09-15' }));
        assert.deepEqual(db.state(), initial); assert.equal(db.ended(), true);
    }
});
test('invalid submissions fail before any mock write', async () => {
    const db = database();
    await assert.rejects(writeEmployeeEmploymentProfile({ ...db.dependencies, scope, newEmployee: {},
        input: { [C.ENABLED]: true }, effectiveFrom: '2026-09-01' }));
    assert.equal(db.writes(), 0); assert.equal(db.state().employee, null);
});
test('standalone topology cannot fall back to non-atomic updates', async () => {
    const db = database();
    await assert.rejects(writeEmployeeEmploymentProfile({ ...db.dependencies, scope, newEmployee: {},
        capabilityProbe: async () => false, effectiveFrom: '2026-09-01' }),
    (error) => error.code === 'EMPLOYEE_PROFILE_TRANSACTIONS_UNAVAILABLE');
    assert.equal(db.writes(), 0);
});
test('same-date or retroactive changes cannot overwrite a later profile', async () => {
    const initial = { employee: { _id: 'employee', ...scope }, history: [{ _id: 'future',
        hmeromhnia_isxyos_oron_ergasias_apo: '2026-09-15' }] };
    for (const effectiveFrom of ['2026-09-01', '2026-09-15']) {
        const db = database(initial);
        await assert.rejects(writeEmployeeEmploymentProfile({ ...db.dependencies, scope, input: arrangement, effectiveFrom }),
            (error) => error.code === 'EMPLOYEE_PROFILE_NON_APPEND_CHANGE');
        assert.deepEqual(db.state(), initial); assert.equal(db.writes(), 0);
    }
});
test('unrelated fields cannot make history differ from current employee', async () => {
    const db = database({ employee: { _id: 'employee', ...scope }, history: [] });
    await assert.rejects(writeEmployeeEmploymentProfile({ ...db.dependencies, scope,
        input: { ores_ergasias_ebdomadas: 20 }, effectiveFrom: '2026-09-01' }));
    assert.equal(db.writes(), 0);
});
test('profile changes retain existing contract amounts without recalculation', async () => {
    const db = database({ employee: { _id: 'employee', ...scope, symbash: 'old-contract',
        nomimosMisthos: 1200, poso_symbashs_01: 1200 }, history: [] });
    await writeEmployeeEmploymentProfile({ ...db.dependencies, scope, input: arrangement, effectiveFrom: '2026-09-01' });
    assert.equal(db.state().history[0].symbash, 'old-contract');
    assert.equal(db.state().history[0].nomimosMisthos, 1200);
    assert.equal(db.state().history[0].poso_symbashs_01, 1200);
    assert.equal(db.state().employee.nomimosMisthos, 1200);
});

function correctionState() {
    const old = { ...scope, ...buildCompleteProfileSnapshot({ effectiveFrom: '2026-04-01' }),
        _id: 'old', aa_eggrafhs: '0001', hmeromhnia_isxyos_oron_ergasias_eos: new Date('2026-08-31') };
    const latest = { ...scope, ...buildCompleteProfileSnapshot({ input: arrangement, effectiveFrom: '2026-09-01' }),
        _id: 'latest', aa_eggrafhs: '0002' };
    return { employee: { ...latest, _id: 'employee', localNote: 'keep' }, history: [old, latest] };
}
test('same-date exact latest correction changes current and the same history row atomically', async () => {
    const initial = correctionState(); const db = database(initial);
    const result = await writeEmployeeEmploymentProfile({ ...db.dependencies, scope,
        mode: MODE_CORRECT_EXISTING, historyId: 'latest', effectiveFrom: '2026-09-01',
        input: { [C.START]: '12:00', [C.END]: '13:00' } });
    assert.equal(result.currentUpdated, true);
    assert.equal(db.state().history.length, 2);
    assert.deepEqual(db.state().history[0], initial.history[0]);
    for (const field of C.FACT_FIELDS) assert.deepEqual(db.state().employee[field], db.state().history[1][field]);
    assert.equal(db.state().employee[C.START], '12:00');
    assert.equal(db.state().employee.localNote, 'keep');
    for (const field of ['_id', 'aa_eggrafhs', 'hmeromhnia_isxyos_oron_ergasias_apo', 'hmeromhnia_isxyos_oron_ergasias_eos']) {
        assert.deepEqual(db.state().history[1][field], initial.history[1][field]);
    }
});
test('latest complete correction restores absent canonical current fields without appending history', async () => {
    const initial = legacyShadowState();
    const appended = database(initial);
    await rotatingAppend(appended);
    const saved = structuredClone(appended.state());
    delete saved.employee.typos_apasxolhshs;
    delete saved.employee.typos_ebdomadas;
    const db = database(saved);
    const latest = saved.history[2];
    const result = await writeEmployeeEmploymentProfile({ ...db.dependencies, scope,
        employeeId: 'employee', mode: MODE_CORRECT_EXISTING, historyId: latest._id,
        effectiveFrom: '2026-09-22', input: {} });
    assert.equal(result.currentUpdated, true);
    assert.equal(db.state().history.length, 3);
    assert.deepEqual(db.state().history.slice(0, 2), saved.history.slice(0, 2));
    assertCanonicalWorkTermsMatch(db.state().employee, db.state().history[2]);
    assert.equal(db.state().employee.typos_apasxolhshs, '2');
    assert.equal(db.state().employee.typos_ebdomadas, '');
});
test('older complete correction preserves surrounding boundaries and never copies current arrangement', async () => {
    const initial = correctionState(); const db = database(initial);
    const result = await writeEmployeeEmploymentProfile({ ...db.dependencies, scope,
        mode: MODE_CORRECT_EXISTING, historyId: 'old', effectiveFrom: '2026-04-01', input: { dialleima_se_lepta: 20 } });
    assert.equal(result.currentUpdated, false);
    assert.deepEqual(db.state().employee, initial.employee);
    assert.deepEqual(db.state().history[1], initial.history[1]);
    assert.equal(db.state().history[0][C.ENABLED], false);
    assert.equal(db.state().history[0].dialleima_se_lepta, 20);
    assert.deepEqual(db.state().history[0].hmeromhnia_isxyos_oron_ergasias_eos, initial.history[0].hmeromhnia_isxyos_oron_ergasias_eos);
});
test('correction rejects wrong identity or date without writes', async () => {
    for (const [historyId, effectiveFrom] of [['missing', '2026-09-01'], ['old', '2026-09-01'], ['latest', '2026-09-02']]) {
        const initial = correctionState(); const db = database(initial);
        await assert.rejects(writeEmployeeEmploymentProfile({ ...db.dependencies, scope,
            mode: MODE_CORRECT_EXISTING, historyId, effectiveFrom }), /CORRECTION_IDENTITY_MISMATCH/);
        assert.deepEqual(db.state(), initial); assert.equal(db.writes(), 0);
    }
});
test('correction history failure or stale match rolls back current facts', async () => {
    for (const fail of ['close', 'stale']) {
        const initial = correctionState(); const db = database(initial, fail);
        await assert.rejects(writeEmployeeEmploymentProfile({ ...db.dependencies, scope,
            mode: MODE_CORRECT_EXISTING, historyId: 'latest', effectiveFrom: '2026-09-01', input: { [C.START]: '12:30' } }));
        assert.deepEqual(db.state(), initial); assert.equal(db.ended(), true);
    }
});
test('old incomplete legacy correction requires explicit missing facts instead of current defaults', async () => {
    const initial = correctionState();
    delete initial.history[0][C.ENABLED]; delete initial.history[0][C.SCHEMA_VERSION];
    const db = database(initial);
    await assert.rejects(writeEmployeeEmploymentProfile({ ...db.dependencies, scope,
        mode: MODE_CORRECT_EXISTING, historyId: 'old', effectiveFrom: '2026-04-01', input: { dialleima_se_lepta: 20 } }),
    /LEGACY_CORRECTION_REQUIRES_FACTS/);
    assert.equal(db.writes(), 0);
    await writeEmployeeEmploymentProfile({ ...db.dependencies, scope,
        mode: MODE_CORRECT_EXISTING, historyId: 'old', effectiveFrom: '2026-04-01', input: { [C.ENABLED]: false } });
    assert.equal(db.state().history[0][C.SCHEMA_VERSION], 1);
    assert.deepEqual(db.state().employee, initial.employee);
});
test('correction rejects mismatched current identity', async () => {
    const initial = correctionState();
    initial.employee.hmeromhnia_isxyos_oron_ergasias_apo = new Date('2026-10-01');
    const db = database(initial);
    await assert.rejects(writeEmployeeEmploymentProfile({ ...db.dependencies, scope,
        mode: MODE_CORRECT_EXISTING, historyId: 'latest', effectiveFrom: '2026-09-01' }),
    /CURRENT_IDENTITY_MISMATCH/);
    assert.equal(db.writes(), 0);
});

test('exact non-boundary termination correction is allowed over pre-existing legacy overlap', async () => {
    const initial = correctionState();
    initial.history[0].hmeromhnia_isxyos_oron_ergasias_eos = null;
    initial.history[1].hmeromhnia_apoxorhshs = null;
    initial.employee.hmeromhnia_apoxorhshs = null;
    const unrelatedBefore = structuredClone(initial.history[0]);
    const db = database(initial);
    const result = await writeEmployeeEmploymentProfile({ ...db.dependencies, scope,
        employeeId: 'employee', mode: MODE_CORRECT_EXISTING, historyId: 'latest',
        effectiveFrom: '2026-09-01', input: {}, maintenance: {
            employeeChanges: { hmeromhnia_apoxorhshs: new Date('2026-09-10') },
            historyChanges: { hmeromhnia_apoxorhshs: new Date('2026-09-10') },
            correctableIdentityFields: ['hmeromhnia_apoxorhshs']
        } });
    assert.equal(result.history._id, 'latest');
    assert.equal(db.state().history.length, 2);
    assert.deepEqual(db.state().history[0], unrelatedBefore);
    assert.equal(new Date(db.state().history[1].hmeromhnia_apoxorhshs)
        .toISOString().slice(0, 10), '2026-09-10');
    assert.deepEqual(db.state().history[1].hmeromhnia_isxyos_oron_ergasias_apo,
        initial.history[1].hmeromhnia_isxyos_oron_ergasias_apo);
    assert.deepEqual(db.state().history[1].hmeromhnia_isxyos_oron_ergasias_eos,
        initial.history[1].hmeromhnia_isxyos_oron_ergasias_eos);
});
test('normal latest legacy Maintenance correction keeps its identity and creates no duplicate', async () => {
    const from = new Date('2026-04-01');
    const row = { ...scope, _id: 'legacy', aa_eggrafhs: '0001',
        hmeromhnia_allaghs_orarioy_apo: from, hmeromhnia_allaghs_orarioy_eos: null,
        dialleima_se_lepta: 15 };
    const db = database({ employee: { ...row, _id: 'employee' }, history: [row] });
    await writeEmployeeEmploymentProfile({ ...db.dependencies, scope,
        mode: MODE_CORRECT_EXISTING, historyId: 'legacy', effectiveFrom: '2026-04-01',
        input: { dialleima_se_lepta: 20 } });
    assert.equal(db.state().history.length, 1);
    assert.equal(db.state().history[0]._id, 'legacy');
    assert.deepEqual(db.state().history[0].hmeromhnia_allaghs_orarioy_apo, from);
    assert.equal(db.state().employee.dialleima_se_lepta, 20);
    assert.equal(C.readEmploymentProfile(db.state().history[0]).recorded, true);
});

test('Maintenance selects the open modern row over a finite legacy schedule fallback without creating a duplicate', async () => {
    const identity = {
        hmeromhnia_proslhpshs: new Date('2026-04-23'),
        hmeromhnia_allaghs_symbashs: new Date('2026-04-23'),
        hmeromhnia_allaghs_orarioy_apo: new Date('2026-04-23'),
        hmeromhnia_allaghs_orarioy_eos: new Date('2026-04-29'),
        hmeromhnia_isxyos_oron_ergasias_apo: new Date('2026-04-23'),
        hmeromhnia_isxyos_oron_ergasias_eos: null,
        hmeromhnia_lhxhs_symbashs: new Date('2026-10-31'),
        hmeromhnia_apoxorhshs: new Date('2026-04-24')
    };
    const legacy = { ...scope, ...identity, _id: 'legacy', aa_eggrafhs: '0001', afora_proslhpsh: true };
    delete legacy.hmeromhnia_isxyos_oron_ergasias_apo;
    delete legacy.hmeromhnia_isxyos_oron_ergasias_eos;
    const modern = { ...scope, ...identity, _id: 'modern', aa_eggrafhs: '0002',
        employment_profile_source: 'ERGOMENOI_CONTROLLER', afora_proslhpsh: true,
        afora_allagh_oron_ergasias: true };
    const current = { ...modern, _id: 'employee' };

    assert.deepEqual(selectMaintenanceMode([legacy, modern], identity), {
        mode: MODE_CORRECT_EXISTING,
        historyId: 'modern'
    });

    const db = database({ employee: current, history: [legacy, modern] });
    const result = await writeEmployeeEmploymentProfile({ ...db.dependencies, scope,
        employeeId: 'employee', effectiveFrom: '2026-04-23', maintenance: {
            identity, employeeChanges: {}, historyChanges: {}
        } });
    assert.equal(result.history._id, 'modern');
    assert.equal(db.state().history.length, 2);
});

test('Maintenance identity keeps true equal effective boundaries ambiguous', () => {
    const identity = Object.fromEntries(require('../../utils/ergazomenoi/employmentProfileTransition')
        .IDENTITY_FIELDS.map(field => [field, null]));
    Object.assign(identity, {
        hmeromhnia_allaghs_orarioy_apo: new Date('2026-04-23'),
        hmeromhnia_allaghs_orarioy_eos: new Date('2026-04-29'),
        hmeromhnia_isxyos_oron_ergasias_apo: new Date('2026-04-23'),
        hmeromhnia_isxyos_oron_ergasias_eos: null
    });
    const first = { ...identity, _id: 'first' };
    const second = { ...identity, _id: 'second' };
    assert.throws(() => selectMaintenanceMode([first, second], identity), (error) =>
        error.code === 'EMPLOYEE_PROFILE_AMBIGUOUS_IDENTITY' && error.statusCode === 409);
});

test('Maintenance identity distinguishes missing, explicit null and finite effective ends', () => {
    const { IDENTITY_FIELDS } = require('../../utils/ergazomenoi/employmentProfileTransition');
    const openIdentity = Object.fromEntries(IDENTITY_FIELDS.map(field => [field, null]));
    Object.assign(openIdentity, {
        hmeromhnia_allaghs_orarioy_apo: new Date('2026-04-23'),
        hmeromhnia_allaghs_orarioy_eos: new Date('2026-04-29'),
        hmeromhnia_isxyos_oron_ergasias_apo: new Date('2026-04-23'),
        hmeromhnia_isxyos_oron_ergasias_eos: null
    });
    const missingEnd = { ...openIdentity, _id: 'legacy' };
    delete missingEnd.hmeromhnia_isxyos_oron_ergasias_apo;
    delete missingEnd.hmeromhnia_isxyos_oron_ergasias_eos;
    const explicitNull = { ...openIdentity, _id: 'open' };
    const finiteEnd = { ...openIdentity, _id: 'finite',
        hmeromhnia_isxyos_oron_ergasias_eos: new Date('2026-04-30') };

    assert.deepEqual(selectMaintenanceMode([missingEnd, explicitNull, finiteEnd], openIdentity), {
        mode: MODE_CORRECT_EXISTING, historyId: 'open'
    });
    assert.deepEqual(selectMaintenanceMode([missingEnd, explicitNull, finiteEnd], {
        ...openIdentity, hmeromhnia_isxyos_oron_ergasias_eos: new Date('2026-04-29')
    }), { mode: MODE_CORRECT_EXISTING, historyId: 'legacy' });
    assert.deepEqual(selectMaintenanceMode([missingEnd, explicitNull, finiteEnd], {
        ...openIdentity, hmeromhnia_isxyos_oron_ergasias_eos: new Date('2026-04-30')
    }), { mode: MODE_CORRECT_EXISTING, historyId: 'finite' });
});

for (const terminationType of ['ma_217', 'ma_222', 'ma_227']) test(
    `exact Maintenance termination ${terminationType} corrects departure on the same history row`,
    async () => {
        const initial = correctionState();
        initial.employee.hmeromhnia_apoxorhshs = null;
        initial.history[1].hmeromhnia_apoxorhshs = null;
        const db = database(initial);
        const result = await writeEmployeeEmploymentProfile({ ...db.dependencies, scope,
            employeeId: 'employee', mode: MODE_CORRECT_EXISTING, historyId: 'latest',
            effectiveFrom: '2026-09-01', input: {}, maintenance: {
                employeeChanges: { hmeromhnia_apoxorhshs: new Date('2026-09-10') },
                historyChanges: { hmeromhnia_apoxorhshs: new Date('2026-09-10') },
                correctableIdentityFields: ['hmeromhnia_apoxorhshs']
            } });
        assert.equal(result.history._id, 'latest');
        assert.equal(db.state().history.length, 2);
        assert.equal(db.state().history[0].hmeromhnia_apoxorhshs ?? null, null);
        assert.equal(new Date(db.state().history[1].hmeromhnia_apoxorhshs).toISOString().slice(0, 10), '2026-09-10');
        assert.equal(new Date(db.state().employee.hmeromhnia_apoxorhshs).toISOString().slice(0, 10), '2026-09-10');
    }
);

test('exact older termination correction targets only its historyId with a later row present', async () => {
    const initial = correctionState();
    initial.history[0].hmeromhnia_apoxorhshs = null;
    const db = database(initial);
    await writeEmployeeEmploymentProfile({ ...db.dependencies, scope,
        employeeId: 'employee', mode: MODE_CORRECT_EXISTING, historyId: 'old',
        effectiveFrom: '2026-04-01', input: Object.fromEntries(C.FACT_FIELDS
            .filter(field => ![C.SCHEMA_VERSION, C.TYPE_VERSION].includes(field))
            .map(field => [field, initial.history[0][field]])), maintenance: {
            employeeChanges: { hmeromhnia_apoxorhshs: new Date('2026-06-30') },
            historyChanges: { hmeromhnia_apoxorhshs: new Date('2026-06-30') },
            correctableIdentityFields: ['hmeromhnia_apoxorhshs']
        } });
    assert.equal(db.state().history.length, 2);
    assert.equal(new Date(db.state().history[0].hmeromhnia_apoxorhshs).toISOString().slice(0, 10), '2026-06-30');
    assert.deepEqual(db.state().history[1], initial.history[1]);
    assert.deepEqual(db.state().employee, initial.employee);
});

test('no-change Maintenance selects real May version and preserves non-terms history noise', async () => {
    const { IDENTITY_FIELDS } = require('../../utils/ergazomenoi/employmentProfileTransition');
    const { MODE_LEGACY_MAINTENANCE } = require('./employeeEmploymentProfileWriter');
    const identity = Object.fromEntries(IDENTITY_FIELDS.map(field => [field, null]));
    Object.assign(identity, { hmeromhnia_allaghs_orarioy_apo: new Date('2026-05-25'),
        hmeromhnia_isxyos_oron_ergasias_apo: new Date('2026-05-25'),
        hmeromhnia_isxyos_oron_ergasias_eos: new Date('2026-10-05') });
    const real = { ...scope, ...identity, _id: 'real', aa_eggrafhs: '0002', afora_allagh_oron_ergasias: true };
    const noise = { ...real, _id: 'noise', aa_eggrafhs: '0003', afora_allagh_oron_ergasias: false,
        hmeromhnia_isxyos_oron_ergasias_apo: null, hmeromhnia_isxyos_oron_ergasias_eos: null };
    const initial = { employee: { ...real, _id: 'employee' }, history: [noise, real] };
    assert.deepEqual(selectMaintenanceMode(initial.history, identity), { mode: MODE_CORRECT_EXISTING, historyId: 'real' });
    const db = database(initial);
    const result = await writeEmployeeEmploymentProfile({ ...db.dependencies, scope, employeeId: 'employee',
        effectiveFrom: '2026-05-25', maintenance: { identity, employeeChanges: {}, historyChanges: {} } });
    assert.equal(result.mode, MODE_LEGACY_MAINTENANCE);
    assert.equal(result.history._id, 'real');
    assert.deepEqual(db.state(), initial);
    // A pre-existing overlap is not newly introduced by this non-boundary correction.
    const overlap = { ...noise, afora_allagh_oron_ergasias: true };
    const conflicting = database({ ...initial, history: [real, overlap] });
    await writeEmployeeEmploymentProfile({ ...conflicting.dependencies, scope,
        employeeId: 'employee', effectiveFrom: '2026-05-25',
        maintenance: { identity, employeeChanges: {}, historyChanges: {} } });
    assert.deepEqual(conflicting.state().history, [real, overlap]);
});

function noHistoryMaintenanceState(dates = {}) {
    return { employee: { _id: 'employee', ...scope, eponymo: 'Imported',
        hmeromhnia_isxyos_oron_ergasias_apo: null,
        hmeromhnia_allaghs_orarioy_apo: null,
        hmeromhnia_proslhpshs: null,
        ...dates }, history: [] };
}

test('imported employee without history creates one baseline from existing effective date', async () => {
    const db = database(noHistoryMaintenanceState({
        hmeromhnia_isxyos_oron_ergasias_apo: '2025-05-01' }));
    await writeEmployeeEmploymentProfile({ ...db.dependencies, scope, employeeId: 'employee',
        maintenance: { employeeChanges: { email: 'saved@example.invalid' }, historyChanges: {} } });
    assert.equal(db.state().history.length, 1);
    assert.equal(new Date(db.state().history[0].hmeromhnia_isxyos_oron_ergasias_apo)
        .toISOString().slice(0, 10), '2025-05-01');
});

test('first no-history maintenance persists departure in employee and the single baseline', async () => {
    const db = database(noHistoryMaintenanceState({ hmeromhnia_proslhpshs: '2025-05-01' }));
    await writeEmployeeEmploymentProfile({ ...db.dependencies, scope, employeeId: 'employee',
        maintenance: { employeeChanges: { hmeromhnia_apoxorhshs: new Date('2026-09-10') },
            historyChanges: { hmeromhnia_apoxorhshs: new Date('2026-09-10') } } });
    assert.equal(db.state().history.length, 1);
    assert.equal(new Date(db.state().history[0].hmeromhnia_apoxorhshs).toISOString().slice(0, 10), '2026-09-10');
    assert.equal(new Date(db.state().employee.hmeromhnia_apoxorhshs).toISOString().slice(0, 10), '2026-09-10');
});

for (const [name, dates, expected] of [
    ['schedule start fallback', { hmeromhnia_allaghs_orarioy_apo: '2025-06-01',
        hmeromhnia_proslhpshs: '2025-05-01' }, '2025-06-01'],
    ['hire date fallback', { hmeromhnia_proslhpshs: '2025-05-01' }, '2025-05-01']
]) test(`no-history baseline uses ${name}`, async () => {
    const db = database(noHistoryMaintenanceState(dates));
    await writeEmployeeEmploymentProfile({ ...db.dependencies, scope, employeeId: 'employee',
        maintenance: { employeeChanges: {}, historyChanges: {} } });
    assert.equal(db.state().history.length, 1);
    assert.equal(new Date(db.state().history[0].hmeromhnia_isxyos_oron_ergasias_apo)
        .toISOString().slice(0, 10), expected);
});

test('no-history baseline without any safe effective date fails before writes', async () => {
    const initial = noHistoryMaintenanceState(); const db = database(initial);
    await assert.rejects(writeEmployeeEmploymentProfile({ ...db.dependencies, scope,
        employeeId: 'employee', maintenance: { employeeChanges: {}, historyChanges: {} } }),
    error => error.code === 'INVALID_EMPLOYMENT_PROFILE' && error.field === 'effectiveFrom');
    assert.equal(db.writes(), 0); assert.deepEqual(db.state(), initial);
});

test('ordinary profile version cannot create a new employment cycle by changing hire date', async () => {
    const baseline = buildCompleteProfileSnapshot({ effectiveFrom: '2026-04-01' });
    const initial = {
        employee: { _id: 'employee', ...scope, ...baseline,
            hmeromhnia_proslhpshs: '2025-01-01', hmeromhnia_apoxorhshs: null },
        history: [{ _id: 'old', ...scope, ...baseline, aa_eggrafhs: '0001',
            hmeromhnia_proslhpshs: '2025-01-01', hmeromhnia_apoxorhshs: null }]
    };
    const db = database(initial);
    await assert.rejects(writeEmployeeEmploymentProfile({
        ...db.dependencies,
        scope,
        employeeId: 'employee',
        input: arrangement,
        effectiveFrom: '2026-09-15',
        maintenance: {
            employeeChanges: { hmeromhnia_proslhpshs: '2026-09-15' },
            historyChanges: { hmeromhnia_proslhpshs: '2026-09-15' }
        }
    }), error => error.code === 'EMPLOYEE_PROFILE_HIRE_DATE_CHANGE_REQUIRES_REHIRE');
    assert.deepEqual(db.state(), initial);
    assert.equal(db.writes(), 0);
});


test('ordinary appended profile inherits the existing employment-cycle hire identity', async () => {
    const baseline = buildCompleteProfileSnapshot({ effectiveFrom: '2026-04-01' });
    const initial = {
        employee: {
            _id: 'employee',
            ...scope,
            ...baseline,
            hmeromhnia_proslhpshs: '2025-01-01',
            hmeromhnia_apoxorhshs: null
        },
        history: [{
            _id: 'old',
            ...scope,
            ...baseline,
            aa_eggrafhs: '0001',
            hmeromhnia_proslhpshs: '2025-01-01',
            hmeromhnia_apoxorhshs: null,
            afora_proslhpsh: true
        }]
    };
    const db = database(initial);

    await writeEmployeeEmploymentProfile({
        ...db.dependencies,
        scope,
        employeeId: 'employee',
        input: arrangement,
        effectiveFrom: '2026-09-15'
    });

    const stored = db.state();
    assert.equal(
        new Date(stored.employee.hmeromhnia_proslhpshs).toISOString().slice(0, 10),
        '2025-01-01'
    );
    assert.equal(
        new Date(stored.history[1].hmeromhnia_proslhpshs).toISOString().slice(0, 10),
        '2025-01-01'
    );
    assert.equal(stored.history[1].afora_proslhpsh, false);
});

test('closed relationship is stored inactive even when submitted active', async () => {
    const db = database();
    await writeEmployeeEmploymentProfile({
        ...db.dependencies,
        scope,
        newEmployee: {
            eponymo: 'Closed',
            energos: true,
            hmeromhnia_proslhpshs: '2026-01-01',
            hmeromhnia_apoxorhshs: '2026-07-31'
        },
        effectiveFrom: '2026-01-01'
    });
    assert.equal(db.state().employee.energos, false);
});

test('maintenance departure forces current master inactive', async () => {
    const initial = {
        employee: {
            _id: 'employee',
            ...scope,
            energos: true,
            hmeromhnia_proslhpshs: '2026-01-01',
            hmeromhnia_apoxorhshs: null,
            hmeromhnia_isxyos_oron_ergasias_apo: '2026-01-01'
        },
        history: [{
            _id: 'old',
            ...scope,
            aa_eggrafhs: '0001',
            hmeromhnia_proslhpshs: '2026-01-01',
            hmeromhnia_apoxorhshs: null,
            hmeromhnia_isxyos_oron_ergasias_apo: '2026-01-01',
            hmeromhnia_isxyos_oron_ergasias_eos: null,
            afora_proslhpsh: true
        }]
    };
    const db = database(initial);
    await writeEmployeeEmploymentProfile({
        ...db.dependencies,
        scope,
        employeeId: 'employee',
        effectiveFrom: '2026-01-01',
        maintenance: {
            employeeChanges: {
                energos: true,
                hmeromhnia_apoxorhshs: new Date('2026-07-31')
            },
            historyChanges: {
                hmeromhnia_apoxorhshs: new Date('2026-07-31')
            },
            identity: {
                hmeromhnia_proslhpshs: new Date('2026-01-01'),
                hmeromhnia_allaghs_symbashs: null,
                hmeromhnia_allaghs_orarioy_apo: null,
                hmeromhnia_allaghs_orarioy_eos: null,
                hmeromhnia_isxyos_oron_ergasias_apo: new Date('2026-01-01'),
                hmeromhnia_isxyos_oron_ergasias_eos: null,
                hmeromhnia_lhxhs_symbashs: null,
                hmeromhnia_apoxorhshs: null
            },
            originalHistoryId: 'old',
            correctableIdentityFields: ['hmeromhnia_apoxorhshs']
        }
    });
    assert.equal(db.state().employee.energos, false);
});
