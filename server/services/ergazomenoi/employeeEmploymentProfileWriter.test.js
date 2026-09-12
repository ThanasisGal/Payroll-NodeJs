'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { writeEmployeeEmploymentProfile, MODE_CORRECT_EXISTING } = require('./employeeEmploymentProfileWriter');
const C = require('../../utils/ergazomenoi/employmentProfileContract');
const { buildCompleteProfileSnapshot } = require('../../utils/ergazomenoi/employmentProfileHistory');
const scope = { team: 'TEST', company_kod: 'company', kodikos: '0031' };

function database(initial = { employee: null, history: [] }, fail = '') {
    let committed = structuredClone(initial); let draft; let ended = false; let writes = 0;
    const session = { async withTransaction(work) {
        draft = structuredClone(committed);
        try { await work(); committed = draft; } finally { draft = null; }
    }, async endSession() { ended = true; } };
    const query = (read) => ({ session(value) { assert.equal(value, session); return this; }, async lean() { return structuredClone(read()); } });
    const matches = (row, filter) => row && Object.entries(filter).every(([key, value]) =>
        value === null ? row[key] == null : value instanceof Date ? new Date(row[key]).getTime() === value.getTime() : row[key] === value);
    const employeeModel = {
        findOne: () => query(() => draft.employee),
        async updateOne(filter, update, options) {
            assert.equal(options.session, session); writes++;
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
    const { selectMaintenanceMode, MODE_LEGACY_MAINTENANCE } = require('./employeeEmploymentProfileWriter');
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
